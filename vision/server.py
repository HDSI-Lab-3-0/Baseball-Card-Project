"""
Flask server wrapping the pose tracker.

Endpoints:
  GET  /health                -> {"ok": True}
  POST /record?mode=swing     -> records and analyzes a swing
  POST /record?mode=pitch     -> records and analyzes a pitch

Response shape:
  {
    "mode": "swing",
    "stats": {"POWER": 87, ...},
    "features": {...},
    "hero_frame": "data:image/jpeg;base64,..."
  }
"""

import base64
import time
import cv2
import numpy as np
from flask import Flask, jsonify, request
from flask_cors import CORS
from ai_edge_litert.interpreter import Interpreter

# =========================
# SETTINGS
# =========================
MODEL_PATH = "model.tflite"
MIN_KP_CONF = 0.3
SWING_CLIP_SECONDS = 3.0
PITCH_CLIP_SECONDS = 5.0
CAMERA_INDEX = 0
# =========================

KEYPOINT_NAMES = [
    "nose", "left_eye", "right_eye", "left_ear", "right_ear",
    "left_shoulder", "right_shoulder", "left_elbow", "right_elbow",
    "left_wrist", "right_wrist", "left_hip", "right_hip",
    "left_knee", "right_knee", "left_ankle", "right_ankle",
]

# ---- Load MoveNet once at startup ----
print("Loading MoveNet...")
interpreter = Interpreter(model_path=MODEL_PATH)
interpreter.allocate_tensors()
_input_details = interpreter.get_input_details()
_output_details = interpreter.get_output_details()
print("MoveNet loaded.")


# =========================
# Pose + helpers (same as pose_tracker.py)
# =========================

def run_movenet(frame):
    img = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    img = cv2.resize(img, (192, 192))
    img = np.expand_dims(img, axis=0).astype(np.uint8)
    interpreter.set_tensor(_input_details[0]["index"], img)
    interpreter.invoke()
    return interpreter.get_tensor(_output_details[0]["index"])[0][0]


def kp(frame_kps, name, min_conf=MIN_KP_CONF):
    idx = KEYPOINT_NAMES.index(name)
    y, x, conf = frame_kps[idx]
    return (x, y) if conf > min_conf else None


# --- Stat features (trimmed; copy over the robust versions from your tracker) ---

def peak_wrist_velocity(pose_frames):
    peak = 0.0
    for i in range(1, len(pose_frames)):
        for name in ("left_wrist", "right_wrist"):
            a = kp(pose_frames[i - 1], name)
            b = kp(pose_frames[i], name)
            if a and b:
                peak = max(peak, ((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2) ** 0.5)
    return peak


def _axis_angle_range(angles_deg):
    if not angles_deg:
        return 0.0
    rads = np.radians([2 * a for a in angles_deg])
    xs, ys = np.cos(rads), np.sin(rads)
    max_sweep = 0.0
    for i in range(len(rads)):
        for j in range(i + 1, len(rads)):
            dot = max(-1.0, min(1.0, xs[i] * xs[j] + ys[i] * ys[j]))
            max_sweep = max(max_sweep, np.degrees(np.arccos(dot)))
    return max_sweep / 2


def hip_rotation_range(pose_frames):
    angles = []
    for f in pose_frames:
        lh, rh = kp(f, "left_hip", 0.5), kp(f, "right_hip", 0.5)
        if lh and rh:
            dx, dy = rh[0] - lh[0], rh[1] - lh[1]
            if (dx * dx + dy * dy) ** 0.5 < 0.05:
                continue
            angles.append(np.degrees(np.arctan2(dy, dx)))
    return _axis_angle_range(angles)


def max_shoulder_hip_separation(pose_frames):
    peak = 0.0
    for f in pose_frames:
        ls, rs = kp(f, "left_shoulder", 0.5), kp(f, "right_shoulder", 0.5)
        lh, rh = kp(f, "left_hip", 0.5), kp(f, "right_hip", 0.5)
        if not (ls and rs and lh and rh):
            continue
        sa = np.arctan2(rs[1] - ls[1], rs[0] - ls[0])
        ha = np.arctan2(rh[1] - lh[1], rh[0] - lh[0])
        diff = np.arctan2(np.sin(2 * (sa - ha)), np.cos(2 * (sa - ha))) / 2
        peak = max(peak, abs(np.degrees(diff)))
    return peak


def max_limb_spread(pose_frames):
    peak = 0.0
    for f in pose_frames:
        ls, rs = kp(f, "left_shoulder"), kp(f, "right_shoulder")
        if not (ls and rs):
            continue
        cx = (ls[0] + rs[0]) / 2
        spread = 0.0
        for name in ("left_wrist", "right_wrist"):
            w = kp(f, name)
            if w:
                spread += abs(w[0] - cx)
        peak = max(peak, spread)
    return peak


def peak_arm_extension(pose_frames):
    peak = 0.0
    for f in pose_frames:
        for side in ("left", "right"):
            s = kp(f, f"{side}_shoulder")
            w = kp(f, f"{side}_wrist")
            if s and w:
                peak = max(peak, ((s[0] - w[0]) ** 2 + (s[1] - w[1]) ** 2) ** 0.5)
    return peak


def peak_leg_kick(pose_frames):
    peak = 0.0
    for f in pose_frames:
        for side in ("left", "right"):
            hip = kp(f, f"{side}_hip")
            knee = kp(f, f"{side}_knee")
            if hip and knee:
                peak = max(peak, hip[1] - knee[1])
    return peak


def total_body_movement(pose_frames):
    total = 0.0
    for i in range(1, len(pose_frames)):
        for name in ("left_wrist", "right_wrist", "left_ankle", "right_ankle",
                     "left_knee", "right_knee"):
            a = kp(pose_frames[i - 1], name)
            b = kp(pose_frames[i], name)
            if a and b:
                total += ((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2) ** 0.5
    return total


def norm(raw, lo, hi):
    clamped = max(lo, min(raw, hi))
    return int(75 + ((clamped - lo) / (hi - lo)) * 24)


def analyze(pose_frames, mode):
    if len(pose_frames) < 3:
        return None, None

    if mode == "swing":
        features = {
            "peak_wrist_v":       peak_wrist_velocity(pose_frames),
            "hip_rotation_range": hip_rotation_range(pose_frames),
            "max_separation":     max_shoulder_hip_separation(pose_frames),
            "max_spread":         max_limb_spread(pose_frames),
        }
        stats = {
            "POWER":     norm(features["peak_wrist_v"], 0.01, 0.15),
            "BAT_SPEED": norm(features["peak_wrist_v"], 0.01, 0.15),
            "ROTATION":  norm(features["hip_rotation_range"], 2, 20),
            "FORM":      norm(features["max_separation"], 5, 25),
            "STYLE":     norm(features["max_spread"], 0.1, 0.7),
        }
    else:  # pitch
        features = {
            "peak_arm_extension":  peak_arm_extension(pose_frames),
            "peak_leg_kick":       peak_leg_kick(pose_frames),
            "hip_rotation_range":  hip_rotation_range(pose_frames),
            "total_body_movement": total_body_movement(pose_frames),
        }
        stats = {
            "POWER":        norm(features["peak_arm_extension"], 0.2, 0.5),
            "FORM":         norm(features["peak_leg_kick"], 0.0, 0.3),
            "INTIMIDATION": norm(features["hip_rotation_range"], 3, 25),
            "HUSTLE":       norm(features["total_body_movement"], 0.5, 8.0),
        }

    # Convert numpy floats to plain floats for JSON
    features = {k: float(v) for k, v in features.items()}
    return stats, features


def pick_hero_frame(frames, pose_frames):
    best_idx, best_score = 0, -1
    for i, kps in enumerate(pose_frames):
        confident = [(x, y) for y, x, c in kps if c > MIN_KP_CONF]
        if not confident:
            continue
        cx = sum(p[0] for p in confident) / len(confident)
        cy = sum(p[1] for p in confident) / len(confident)
        score = sum(((p[0] - cx) ** 2 + (p[1] - cy) ** 2) ** 0.5 for p in confident)
        if score > best_score:
            best_score = score
            best_idx = i
    return frames[best_idx], best_idx


def frame_to_base64(frame, quality=85):
    """Encode a BGR frame as a base64 JPEG data URL."""
    ok, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, quality])
    if not ok:
        return None
    b64 = base64.b64encode(buf).decode("ascii")
    return f"data:image/jpeg;base64,{b64}"


def record_and_analyze(mode):
    duration = PITCH_CLIP_SECONDS if mode == "pitch" else SWING_CLIP_SECONDS

    cap = cv2.VideoCapture(CAMERA_INDEX)
    if not cap.isOpened():
        return {"error": "Cannot open camera"}, 500

    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)

    frames = []
    poses = []
    start = time.time()

    while time.time() - start < duration:
        ret, frame = cap.read()
        if not ret:
            continue
        frame = cv2.flip(frame, 1)
        poses.append(run_movenet(frame))
        frames.append(frame)

    cap.release()

    if len(poses) < 3:
        return {"error": "Not enough frames captured"}, 500

    stats, features = analyze(poses, mode)
    if stats is None:
        return {"error": "Analysis failed"}, 500

    hero, hero_idx = pick_hero_frame(frames, poses)
    hero_b64 = frame_to_base64(hero)

    return {
        "mode": mode,
        "stats": stats,
        "features": features,
        "hero_frame": hero_b64,
        "hero_frame_index": hero_idx,
        "frame_count": len(frames),
    }, 200


# =========================
# Flask app
# =========================

app = Flask(__name__)
CORS(app)  # allow Astro on any port to call us


@app.route("/health")
def health():
    return jsonify({"ok": True})


@app.route("/record", methods=["POST"])
def record():
    mode = request.args.get("mode", "swing").lower()
    if mode not in ("swing", "pitch"):
        return jsonify({"error": "mode must be 'swing' or 'pitch'"}), 400

    print(f"Recording {mode}...")
    result, status = record_and_analyze(mode)
    print(f"Done. Stats: {result.get('stats')}")
    return jsonify(result), status


if __name__ == "__main__":
    print("Starting server on http://localhost:5001")
    app.run(host="0.0.0.0", port=5001, debug=False)