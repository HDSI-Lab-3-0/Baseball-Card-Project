"""
Swing/Pitch Pose Tester — Raspberry Pi 5 version (USB webcam).

Can be run manually (keyboard) or triggered by Astro (CLI args).

Usage:
  Manual:   python test_swing_pi.py
  Via Astro: python test_swing_pi.py --mode pitch --headless

Setup:
    pip install opencv-python numpy tflite-runtime

Make sure model.tflite is in the same directory as this script.

Manual controls (when not in headless mode):
  SPACE — record a swing clip
  P     — record a pitch clip
  ESC   — quit
"""

import cv2
import time
import numpy as np
from ai_edge_litert.interpreter import Interpreter
import requests
import argparse

# =========================
# SETTINGS
# =========================
MODEL_PATH = "model.tflite"
CLIP_SECONDS = 5.0
MIN_KP_CONF = 0.3
MIN_BALL_RADIUS = 15
SHOW_BALL = True
SAVE_HERO_FRAME = True
ASTRO_SERVER = "http://localhost:4321"

CAM_WIDTH = 640
CAM_HEIGHT = 480
POSE_EVERY_N_FRAMES = 1
# =========================

KEYPOINT_NAMES = [
    "nose", "left_eye", "right_eye", "left_ear", "right_ear",
    "left_shoulder", "right_shoulder", "left_elbow", "right_elbow",
    "left_wrist", "right_wrist", "left_hip", "right_hip",
    "left_knee", "right_knee", "left_ankle", "right_ankle",
]

print("Loading MoveNet...")
interpreter = Interpreter(model_path=MODEL_PATH)
interpreter.allocate_tensors()
input_details = interpreter.get_input_details()
output_details = interpreter.get_output_details()
print("MoveNet loaded.\n")



def run_movenet(frame):
    img = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    img = cv2.resize(img, (192, 192))
    img = np.expand_dims(img, axis=0).astype(np.uint8)
    interpreter.set_tensor(input_details[0]["index"], img)
    interpreter.invoke()
    keypoints = interpreter.get_tensor(output_details[0]["index"])
    return keypoints[0][0]


def kp(frame_kps, name):
    idx = KEYPOINT_NAMES.index(name)
    y, x, conf = frame_kps[idx]
    return (x, y) if conf > MIN_KP_CONF else None


def draw_pose(frame, keypoints):
    h, w = frame.shape[:2]
    edges = [
        ("left_shoulder", "right_shoulder"),
        ("left_shoulder", "left_elbow"), ("left_elbow", "left_wrist"),
        ("right_shoulder", "right_elbow"), ("right_elbow", "right_wrist"),
        ("left_shoulder", "left_hip"), ("right_shoulder", "right_hip"),
        ("left_hip", "right_hip"),
        ("left_hip", "left_knee"), ("left_knee", "left_ankle"),
        ("right_hip", "right_knee"), ("right_knee", "right_ankle"),
    ]
    for a, b in edges:
        pa = kp(keypoints, a)
        pb = kp(keypoints, b)
        if pa and pb:
            cv2.line(frame,
                     (int(pa[0] * w), int(pa[1] * h)),
                     (int(pb[0] * w), int(pb[1] * h)),
                     (0, 200, 255), 2)
    for y, x, conf in keypoints:
        if conf > MIN_KP_CONF:
            cv2.circle(frame, (int(x * w), int(y * h)), 4, (0, 255, 255), -1)


def detect_green_ball(frame):
    hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
    mask = cv2.inRange(hsv, np.array([35, 80, 80]), np.array([85, 255, 255]))
    mask = cv2.GaussianBlur(mask, (7, 7), 0)
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return None
    c = max(contours, key=cv2.contourArea)
    (x, y), radius = cv2.minEnclosingCircle(c)
    if radius < MIN_BALL_RADIUS:
        return None
    return (int(x), int(y)), int(radius)


def norm(raw, lo, hi):
    clamped = max(lo, min(raw, hi))
    return int(75 + ((clamped - lo) / (hi - lo)) * 24)


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
    doubled = [2 * a for a in angles_deg]
    rads = np.radians(doubled)
    xs = np.cos(rads)
    ys = np.sin(rads)
    max_sweep = 0.0
    for i in range(len(rads)):
        for j in range(i + 1, len(rads)):
            dot = xs[i] * xs[j] + ys[i] * ys[j]
            dot = max(-1.0, min(1.0, dot))
            sweep = np.degrees(np.arccos(dot))
            if sweep > max_sweep:
                max_sweep = sweep
    return max_sweep / 2


def hip_rotation_range(pose_frames):
    angles = []
    for f in pose_frames:
        lh, rh = kp(f, "left_hip"), kp(f, "right_hip")
        if lh and rh:
            angles.append(np.degrees(np.arctan2(rh[1] - lh[1], rh[0] - lh[0])))
    return _axis_angle_range(angles)


def max_shoulder_hip_separation(pose_frames):
    peak = 0.0
    for f in pose_frames:
        ls, rs = kp(f, "left_shoulder"), kp(f, "right_shoulder")
        lh, rh = kp(f, "left_hip"), kp(f, "right_hip")
        if ls and rs and lh and rh:
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


def analyze(pose_frames, mode):
    if len(pose_frames) < 3:
        print("Not enough frames to analyze.")
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
            "ROTATION":  norm(features["hip_rotation_range"], 2, 30),
            "FORM":      norm(features["max_separation"], 5, 40),
            "STYLE":     norm(features["max_spread"], 0.05, 0.35),
        }
    else:
        features = {
            "peak_arm_extension":  peak_arm_extension(pose_frames),
            "peak_leg_kick":       peak_leg_kick(pose_frames),
            "hip_rotation_range":  hip_rotation_range(pose_frames),
            "total_body_movement": total_body_movement(pose_frames),
        }
        stats = {
            "POWER":        norm(features["peak_arm_extension"], 0.2, 0.5),
            "FORM":         norm(features["peak_leg_kick"], 0.0, 0.08),
            "INTIMIDATION": norm(features["hip_rotation_range"], 5, 45),
            "HUSTLE":       norm(features["total_body_movement"], 0.5, 2.0),
        }

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


def send_to_astro(record_mode, stats, features):
    try:
        res = requests.post(
            f"{ASTRO_SERVER}/api/generate-card",
            json={
                "mode": record_mode,
                "stats": stats,
                "features": {k: float(v) for k, v in features.items()}
            },
            timeout=5
        )
        print("\nSent to Astro:", res.status_code, res.text)
    except Exception as e:
        print("Failed to send to Astro:", e)


def run_headless(mode):
    """Run a single clip in headless mode (no window), triggered by Astro."""
    print(f"Headless mode: recording {CLIP_SECONDS}s {mode} clip...")

    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        print("Cannot open camera.")
        return

    cap.set(cv2.CAP_PROP_FRAME_WIDTH, CAM_WIDTH)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, CAM_HEIGHT)
    cap.set(cv2.CAP_PROP_FPS, 30)

    recorded_frames = []
    recorded_poses = []
    start = time.time()

    while time.time() - start < CLIP_SECONDS:
        ret, frame = cap.read()
        if not ret:
            break
        frame = cv2.flip(frame, 1)
        kps = run_movenet(frame)
        recorded_frames.append(frame.copy())
        recorded_poses.append(kps)

    cap.release()

    print(f"Captured {len(recorded_frames)} frames. Analyzing {mode}...")
    stats, features = analyze(recorded_poses, mode)

    if stats:
        print(f"\n--- {mode.upper()} RAW FEATURES ---")
        for k, v in features.items():
            print(f"  {k:<24} {v:.4f}")
        print(f"\n--- {mode.upper()} CARD STATS ---")
        for k, v in stats.items():
            print(f"  {k:<14} {v}")

        if SAVE_HERO_FRAME:
            hero, hero_idx = pick_hero_frame(recorded_frames, recorded_poses)
            path = f"hero_{mode}.jpg"
            cv2.imwrite(path, hero)
            print(f"\nHero frame: index {hero_idx} -> {path}")

        send_to_astro(mode, stats, features)


def run_interactive():
    """Original interactive mode with keyboard controls."""
    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        print("Cannot open camera.")
        return

    cap.set(cv2.CAP_PROP_FRAME_WIDTH, CAM_WIDTH)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, CAM_HEIGHT)
    cap.set(cv2.CAP_PROP_FPS, 30)

    print(f"Camera opened at {CAM_WIDTH}x{CAM_HEIGHT}.")
    print("Controls: SPACE = swing, P = pitch, ESC = quit")

    recording = False
    record_mode = None
    record_start_time = 0.0
    recorded_frames = []
    recorded_poses = []
    last_keypoints = None
    frame_count = 0

    fps_t0 = time.time()
    fps_frames = 0
    fps_display = 0.0

    window_name = "Pose Tester (Pi)"
    cv2.namedWindow(window_name, cv2.WINDOW_NORMAL)

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        frame = cv2.flip(frame, 1)

        if frame_count % POSE_EVERY_N_FRAMES == 0:
            last_keypoints = run_movenet(frame)
        keypoints = last_keypoints
        frame_count += 1

        if keypoints is not None:
            draw_pose(frame, keypoints)

        if SHOW_BALL:
            ball = detect_green_ball(frame)
            if ball:
                center, radius = ball
                cv2.circle(frame, center, radius, (0, 255, 0), 2)

        fps_frames += 1
        if fps_frames >= 30:
            now = time.time()
            fps_display = fps_frames / (now - fps_t0)
            fps_t0 = now
            fps_frames = 0

        if recording:
            recorded_frames.append(frame.copy())
            recorded_poses.append(keypoints)
            elapsed = time.time() - record_start_time
            remaining = max(0, CLIP_SECONDS - elapsed)
            label = f"RECORDING {record_mode.upper()}  {remaining:.1f}s"
            cv2.putText(frame, label, (20, 40),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.9, (0, 0, 255), 3)

            if elapsed >= CLIP_SECONDS:
                recording = False
                print(f"\nCaptured {len(recorded_frames)} frames. Analyzing {record_mode}...")
                stats, features = analyze(recorded_poses, record_mode)
                if stats:
                    print(f"\n--- {record_mode.upper()} RAW FEATURES ---")
                    for k, v in features.items():
                        print(f"  {k:<24} {v:.4f}")
                    print(f"\n--- {record_mode.upper()} CARD STATS ---")
                    for k, v in stats.items():
                        print(f"  {k:<14} {v}")
                    if SAVE_HERO_FRAME:
                        hero, hero_idx = pick_hero_frame(recorded_frames, recorded_poses)
                        path = f"hero_{record_mode}.jpg"
                        cv2.imwrite(path, hero)
                        print(f"\nHero frame: index {hero_idx} -> {path}")

                    send_to_astro(record_mode, stats, features)

                print("\nReady. SPACE = swing, P = pitch, ESC = quit.\n")
        else:
            cv2.putText(frame, "SPACE = swing   P = pitch   ESC = quit",
                        (20, 40), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
            cv2.putText(frame, f"{fps_display:.1f} FPS",
                        (20, 70), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (200, 200, 200), 2)

        cv2.imshow(window_name, frame)

        key = cv2.waitKey(1) & 0xFF
        if key == 27:
            break
        if recording:
            continue
        if key == 32:
            record_mode = "swing"
        elif key == ord("p"):
            record_mode = "pitch"
        else:
            continue

        print(f"Recording {CLIP_SECONDS}s {record_mode}...")
        recording = True
        record_start_time = time.time()
        recorded_frames = []
        recorded_poses = []

    cap.release()
    cv2.destroyAllWindows()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument('--mode', choices=['swing', 'pitch'], default=None,
                        help='Recording mode (required for headless)')
    parser.add_argument('--headless', action='store_true',
                        help='Run a single clip without a window, then exit')
    args = parser.parse_args()

    if args.headless and args.mode:
        run_headless(args.mode)
    else:
        run_interactive()