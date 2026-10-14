#!/usr/bin/env python3
"""
Swing Vision: MoveNet swing tracker for the Baseball Card Project.

Watches someone swing, tracks 17 body joints with Google's MoveNet model,
measures the swing (hand speed, body turn, extension, balance, quickness)
and turns those measurements into baseball-card stats.

Usage (run from the project folder):
    python vision/swing_vision.py live                 # webcam: SPACE to swing, Q to quit
    python vision/swing_vision.py video my_swing.mp4   # analyze a recorded video
    python vision/swing_vision.py serve                # local server the website can call

Options:
    --model lightning|thunder   lightning is faster (default), thunder is more accurate
    --camera N                  webcam number (default 0)
    --seconds S                 how long to record a swing in live mode (default 3)
    --port P                    server port in serve mode (default 5001)

Requires: numpy, opencv-python, ai-edge-litert (all in environment.yml).
The MoveNet model downloads automatically into vision/models/ on first run.
"""

from __future__ import annotations

import argparse
import base64
import io
import json
import sys
import tarfile
import threading
import time
import urllib.request
from dataclasses import dataclass
from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import cv2
import numpy as np

HERE = Path(__file__).resolve().parent
MODEL_DIR = HERE / "models"
OUTPUT_DIR = HERE / "output"

# ---------------------------------------------------------------------------
# MoveNet model
# ---------------------------------------------------------------------------

MODELS = {
    "lightning": {
        "size": 192,
        "file": "movenet_lightning.tflite",
        "page": "https://www.kaggle.com/models/google/movenet/tfLite/singlepose-lightning-tflite-float16",
        "urls": [
            "https://tfhub.dev/google/lite-model/movenet/singlepose/lightning/tflite/float16/4?lite-format=tflite",
            "https://www.kaggle.com/api/v1/models/google/movenet/tfLite/singlepose-lightning-tflite-float16/1/download",
        ],
    },
    "thunder": {
        "size": 256,
        "file": "movenet_thunder.tflite",
        "page": "https://www.kaggle.com/models/google/movenet/tfLite/singlepose-thunder-tflite-float16",
        "urls": [
            "https://tfhub.dev/google/lite-model/movenet/singlepose/thunder/tflite/float16/4?lite-format=tflite",
            "https://www.kaggle.com/api/v1/models/google/movenet/tfLite/singlepose-thunder-tflite-float16/1/download",
        ],
    },
}

# MoveNet's 17 keypoints, in output order
KP = {
    "nose": 0, "left_eye": 1, "right_eye": 2, "left_ear": 3, "right_ear": 4,
    "left_shoulder": 5, "right_shoulder": 6, "left_elbow": 7, "right_elbow": 8,
    "left_wrist": 9, "right_wrist": 10, "left_hip": 11, "right_hip": 12,
    "left_knee": 13, "right_knee": 14, "left_ankle": 15, "right_ankle": 16,
}

SKELETON = [
    (5, 6), (5, 7), (7, 9), (6, 8), (8, 10), (5, 11), (6, 12), (11, 12),
    (11, 13), (13, 15), (12, 14), (14, 16), (0, 5), (0, 6),
]

MIN_SCORE = 0.3  # ignore joints MoveNet is less sure about than this


def _is_tflite(data: bytes) -> bool:
    return len(data) > 8 and data[4:8] == b"TFL3"


def _extract_tflite(data: bytes) -> bytes | None:
    """Downloads come back either as a raw .tflite or as a .tar.gz holding one."""
    if _is_tflite(data):
        return data
    if data[:2] == b"\x1f\x8b":
        try:
            with tarfile.open(fileobj=io.BytesIO(data), mode="r:gz") as tar:
                for member in tar.getmembers():
                    if member.name.endswith(".tflite"):
                        inner = tar.extractfile(member).read()
                        if _is_tflite(inner):
                            return inner
        except tarfile.TarError:
            return None
    return None


def ensure_model(name: str) -> Path:
    spec = MODELS[name]
    path = MODEL_DIR / spec["file"]
    if path.exists() and _is_tflite(path.read_bytes()[:16]):
        return path

    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    print(f"Downloading MoveNet {name} (one time only)...")
    for url in spec["urls"]:
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "swing-vision/1.0"})
            with urllib.request.urlopen(req, timeout=60) as resp:
                model = _extract_tflite(resp.read())
            if model:
                path.write_bytes(model)
                print(f"Saved model to {path}")
                return path
        except Exception as err:  # try the next source
            print(f"  could not download from {url.split('?')[0]}: {err}")

    sys.exit(
        "\nCould not download the MoveNet model automatically.\n"
        f"Download it by hand from:\n  {spec['page']}\n"
        f"then save the .tflite file as:\n  {path}\n"
    )


def load_interpreter(path: Path):
    try:
        from ai_edge_litert.interpreter import Interpreter
    except ImportError:
        try:
            from tflite_runtime.interpreter import Interpreter
        except ImportError:
            try:
                import tensorflow as tf
                Interpreter = tf.lite.Interpreter
            except ImportError:
                sys.exit("Missing the model runtime. Install it with:  pip install ai-edge-litert")
    interpreter = Interpreter(model_path=str(path), num_threads=4)
    interpreter.allocate_tensors()
    return interpreter


class MoveNet:
    """Runs MoveNet on a frame and returns keypoints in pixel coordinates."""

    def __init__(self, model: str = "lightning", model_path: Path | None = None):
        self.name = model
        self.interpreter = load_interpreter(model_path or ensure_model(model))
        self.input = self.interpreter.get_input_details()[0]
        self.output = self.interpreter.get_output_details()[0]
        self.size = int(self.input["shape"][1])
        self.lock = threading.Lock()  # the interpreter is not thread-safe

    def __call__(self, frame_bgr: np.ndarray) -> np.ndarray:
        """Returns a (17, 3) array of [x_px, y_px, score] for the given BGR frame."""
        h, w = frame_bgr.shape[:2]
        side = max(h, w)
        pad_y, pad_x = (side - h) // 2, (side - w) // 2

        # Letterbox to a square so the body isn't stretched
        square = cv2.copyMakeBorder(
            frame_bgr, pad_y, side - h - pad_y, pad_x, side - w - pad_x, cv2.BORDER_CONSTANT
        )
        img = cv2.cvtColor(cv2.resize(square, (self.size, self.size)), cv2.COLOR_BGR2RGB)
        tensor = np.expand_dims(img, 0).astype(self.input["dtype"])

        with self.lock:
            self.interpreter.set_tensor(self.input["index"], tensor)
            self.interpreter.invoke()
            raw = self.interpreter.get_tensor(self.output["index"])

        yxs = np.asarray(raw).reshape(17, 3)  # [y, x, score], normalized to the square
        x = yxs[:, 1] * side - pad_x
        y = yxs[:, 0] * side - pad_y
        return np.stack([x, y, yxs[:, 2]], axis=1).astype(np.float32)


# ---------------------------------------------------------------------------
# Swing analysis
# ---------------------------------------------------------------------------

TORSO_METERS = 0.52   # typical shoulder-to-hip distance, used to turn pixels into real speed
BAT_TO_HAND = 2.8     # the bat head travels roughly this much faster than the hands
SWING_THRESHOLD = 3.0  # hand speed (torso lengths per second) that counts as a swing


@dataclass
class Frame:
    t: float            # seconds
    kp: np.ndarray      # (17, 3) [x_px, y_px, score]


def _point(kp: np.ndarray, *names: str) -> np.ndarray:
    """Average position of the named joints that were detected confidently; NaN if none."""
    pts = [kp[KP[n], :2] for n in names if kp[KP[n], 2] >= MIN_SCORE]
    return np.mean(pts, axis=0) if pts else np.array([np.nan, np.nan])


def _dist(a: np.ndarray, b: np.ndarray) -> float:
    return float(np.hypot(*(a - b)))


def _clamp(v: float, lo: float = 0.0, hi: float = 100.0) -> float:
    return float(min(hi, max(lo, v)))


def _turn_degrees(widths: np.ndarray, angles: np.ndarray) -> float:
    """How far a body segment (shoulders or hips) rotated during the swing.

    Facing the camera, turning shows up as the segment looking narrower;
    filmed from the side, it shows up as the line tilting. Use whichever is larger.
    """
    w = widths[~np.isnan(widths)]
    a = angles[~np.isnan(angles)]
    by_width = np.degrees(np.arccos(np.clip(w.min() / w.max(), 0, 1))) if len(w) >= 3 and w.max() > 0 else 0.0
    by_angle = float(np.ptp(np.degrees(np.unwrap(a)))) if len(a) >= 3 else 0.0
    return float(min(120.0, max(by_width, by_angle)))


def _fmt_rate(v: float) -> str:
    """Baseball style: .312 instead of 0.312, but 1.045 stays as is."""
    s = f"{v:.3f}"
    return s[1:] if s.startswith("0") else s


def analyze_swing(frames: list[Frame]) -> dict:
    result = {"person_detected": False, "swing_detected": False, "frames_used": len(frames)}
    if len(frames) < 6:
        result["message"] = "Not enough video. Record at least a second of the swing."
        return result

    t = np.array([f.t for f in frames], dtype=np.float64)
    duration = float(t[-1] - t[0])
    result["fps"] = round((len(frames) - 1) / duration, 1) if duration > 0 else None

    sh_mid = np.array([_point(f.kp, "left_shoulder", "right_shoulder") for f in frames])
    hip_mid = np.array([_point(f.kp, "left_hip", "right_hip") for f in frames])
    hands = np.array([_point(f.kp, "left_wrist", "right_wrist") for f in frames])

    def seg(a: str, b: str):
        widths, angles = [], []
        for f in frames:
            pa, pb = f.kp[KP[a]], f.kp[KP[b]]
            if pa[2] >= MIN_SCORE and pb[2] >= MIN_SCORE:
                d = pb[:2] - pa[:2]
                widths.append(float(np.hypot(*d)))
                angles.append(float(np.arctan2(d[1], d[0])))
            else:
                widths.append(np.nan)
                angles.append(np.nan)
        return np.array(widths), np.array(angles)

    sh_w, sh_a = seg("left_shoulder", "right_shoulder")
    hip_w, hip_a = seg("left_hip", "right_hip")

    # Body scale: torso length in pixels, so results don't depend on distance from the camera
    torso = np.array([_dist(s, h) for s, h in zip(sh_mid, hip_mid)])
    torso = torso[~np.isnan(torso)]
    if len(torso) >= 3:
        scale = float(np.median(torso))
    elif np.count_nonzero(~np.isnan(sh_w)) >= 3:
        scale = float(np.nanmedian(sh_w)) * 1.4
    else:
        result["message"] = "Couldn't find a person. Step back so your whole upper body is in view."
        return result
    if scale < 10:
        result["message"] = "You're too far from the camera. Step closer."
        return result
    result["person_detected"] = True

    # Hand speed in torso lengths per second
    speed = np.full(len(frames), np.nan)
    for i in range(1, len(frames)):
        dt = t[i] - t[i - 1]
        if dt > 1e-3 and not (np.isnan(hands[i]).any() or np.isnan(hands[i - 1]).any()):
            speed[i] = _dist(hands[i], hands[i - 1]) / scale / dt
    # 3-frame median removes single-frame jitter spikes
    smooth = np.array([
        np.nanmedian(speed[max(0, i - 1): i + 2]) if not np.all(np.isnan(speed[max(0, i - 1): i + 2])) else np.nan
        for i in range(len(speed))
    ])
    if np.all(np.isnan(smooth)):
        result["message"] = "Couldn't see your hands. Keep your arms in the frame."
        return result

    peak_i = int(np.nanargmax(smooth))
    peak = float(smooth[peak_i])
    if peak < SWING_THRESHOLD:
        result["message"] = "No swing detected. Take a full, fast swing!"
        result["metrics"] = {"peak_hand_speed": round(peak, 2)}
        return result
    result["swing_detected"] = True

    # Swing window: from when the hands start moving fast until they slow down again
    active = np.where(np.nan_to_num(smooth) >= 0.3 * peak)[0]
    start = int(active[active <= peak_i].min())
    end = int(active[active >= peak_i].max())
    win = slice(max(0, start - 2), min(len(frames), end + 3))

    hand_mph = peak * TORSO_METERS * 2.237
    bat_mph = _clamp(hand_mph * BAT_TO_HAND, 15, 105)
    shoulder_turn = _turn_degrees(sh_w[win], sh_a[win])
    hip_turn = _turn_degrees(hip_w[win], hip_a[win])
    # Swing time: how long the hands stay fast, from start of the swing to the finish
    swing_time = float(t[min(end + 1, len(t) - 1)] - t[max(start - 1, 0)])

    reach = [_dist(h, s) / scale for h, s in zip(hands[win], sh_mid[win]) if not (np.isnan(h).any() or np.isnan(s).any())]
    extension = float(max(reach)) if reach else 0.0

    # Balance: how still the hips are after the swing (the finish)
    after = hip_mid[end:]
    after = after[~np.isnan(after).any(axis=1)]
    wobble = float(np.mean(np.std(after, axis=0)) / scale) if len(after) >= 3 else 0.15

    scores = {
        "power": _clamp((bat_mph - 30) / (85 - 30) * 100),
        "rotation": _clamp((shoulder_turn + hip_turn) / 2 / 75 * 100),
        "extension": _clamp((extension - 0.8) / (1.6 - 0.8) * 100),
        "balance": _clamp(100 - wobble * 600),
        "quickness": _clamp((0.75 - swing_time) / (0.75 - 0.2) * 100),
    }
    scores["overall"] = (
        0.30 * scores["power"] + 0.20 * scores["rotation"] + 0.15 * scores["extension"]
        + 0.20 * scores["balance"] + 0.15 * scores["quickness"]
    )

    result["metrics"] = {
        "hand_speed_mph": round(hand_mph, 1),
        "bat_speed_mph_est": round(bat_mph, 1),
        "shoulder_turn_deg": round(shoulder_turn, 1),
        "hip_turn_deg": round(hip_turn, 1),
        "extension": round(extension, 2),
        "finish_wobble": round(wobble, 3),
        "swing_time_s": round(swing_time, 3),
    }
    result["scores"] = {k: round(v) for k, v in scores.items()}
    result["stats"] = card_stats(scores)
    result["archetype"] = archetype(scores)
    result["message"] = f"Swing detected! Estimated bat speed {bat_mph:.0f} mph."
    return result


def card_stats(s: dict) -> dict:
    """Turn 0-100 swing scores into the six stats printed on the card."""
    contact = (0.5 * s["balance"] + 0.3 * s["quickness"] + 0.2 * s["extension"]) / 100
    pop = (0.7 * s["power"] + 0.3 * s["rotation"]) / 100

    avg = 0.210 + 0.130 * contact
    hr = round(4 + 46 * pop)
    rbi = round(_clamp(35 + 1.6 * hr + 30 * contact, 30, 150))
    sb = round(2 + 38 * s["quickness"] / 100)
    obp = avg + 0.055 + 0.045 * s["balance"] / 100
    slg = avg + 0.090 + 0.330 * pop
    war = 0.3 + 7.7 * s["overall"] / 100

    return {
        "AVG": _fmt_rate(avg),
        "HR": str(hr),
        "RBI": str(rbi),
        "SB": str(sb),
        "OPS": _fmt_rate(obp + slg),
        "WAR": f"{war:.1f}",
    }


def archetype(s: dict) -> str:
    best = max(("power", "rotation", "balance", "quickness", "extension"), key=lambda k: s[k])
    if s["overall"] >= 80:
        return "Five-Tool Phenom"
    return {
        "power": "Power Slugger",
        "rotation": "Torque Machine",
        "balance": "Contact Specialist",
        "quickness": "Speedy Leadoff",
        "extension": "Gap-to-Gap Hitter",
    }[best]


# ---------------------------------------------------------------------------
# Drawing
# ---------------------------------------------------------------------------

def draw_pose(frame: np.ndarray, kp: np.ndarray) -> None:
    for a, b in SKELETON:
        if kp[a, 2] >= MIN_SCORE and kp[b, 2] >= MIN_SCORE:
            cv2.line(frame, tuple(map(int, kp[a, :2])), tuple(map(int, kp[b, :2])), (60, 220, 255), 3, cv2.LINE_AA)
    for i, (x, y, s) in enumerate(kp):
        if s >= MIN_SCORE:
            color = (46, 32, 208) if i in (KP["left_wrist"], KP["right_wrist"]) else (240, 240, 240)
            cv2.circle(frame, (int(x), int(y)), 6, color, -1, cv2.LINE_AA)


def banner(frame: np.ndarray, text: str, sub: str = "", color=(63, 182, 244)) -> None:
    h, w = frame.shape[:2]
    cv2.rectangle(frame, (0, 0), (w, 90 if sub else 60), (20, 30, 10), -1)
    cv2.putText(frame, text, (20, 42), cv2.FONT_HERSHEY_DUPLEX, 1.1, color, 2, cv2.LINE_AA)
    if sub:
        cv2.putText(frame, sub, (20, 76), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (230, 230, 230), 1, cv2.LINE_AA)


def save_result(result: dict) -> Path:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    path = OUTPUT_DIR / f"swing_{datetime.now():%Y%m%d_%H%M%S}.json"
    path.write_text(json.dumps(result, indent=2))
    return path


# ---------------------------------------------------------------------------
# Modes
# ---------------------------------------------------------------------------

def open_camera(index: int) -> cv2.VideoCapture:
    # DirectShow opens webcams much faster on Windows
    cap = cv2.VideoCapture(index, cv2.CAP_DSHOW) if sys.platform == "win32" else cv2.VideoCapture(index)
    if not cap.isOpened():
        sys.exit(f"Cannot open camera {index}. Try --camera 1, or close other apps using the webcam.")
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)
    return cap


def run_live(net: MoveNet, camera: int, seconds: float) -> None:
    cap = open_camera(camera)
    window = "Swing Vision"
    cv2.namedWindow(window, cv2.WINDOW_NORMAL)

    state, state_start = "ready", time.time()
    frames: list[Frame] = []
    result: dict | None = None

    print("SPACE = record a swing, Q = quit")
    while True:
        ok, frame = cap.read()
        if not ok:
            print("Lost the camera feed.")
            break
        frame = cv2.flip(frame, 1)  # mirror, like looking in a mirror
        now = time.time()
        kp = net(frame)
        draw_pose(frame, kp)

        if state == "ready":
            banner(frame, "READY - press SPACE to swing", "Stand so your whole body is in view. Q to quit.")
        elif state == "countdown":
            left = 3 - int(now - state_start)
            if left <= 0:
                state, state_start, frames = "recording", now, []
            else:
                banner(frame, f"Get set... {left}", "Swing when it says SWING!")
        if state == "recording":
            frames.append(Frame(now, kp))
            banner(frame, "SWING!", f"Recording {max(0.0, seconds - (now - state_start)):.1f}s", (60, 60, 255))
            if now - state_start >= seconds:
                result = analyze_swing(frames)
                path = save_result(result)
                print(json.dumps(result, indent=2))
                print(f"Saved to {path}")
                state = "result"
        elif state == "result" and result:
            stats = result.get("stats")
            if stats:
                banner(frame, f"{result['archetype']}  |  {result['metrics']['bat_speed_mph_est']:.0f} MPH",
                       "  ".join(f"{k} {v}" for k, v in stats.items()) + "   (SPACE = again)")
            else:
                banner(frame, "Try again!", result.get("message", "") + "  (SPACE = again)", (80, 80, 255))

        cv2.imshow(window, frame)
        key = cv2.waitKey(1) & 0xFF
        if key in (ord("q"), 27):
            break
        if key == ord(" ") and state in ("ready", "result"):
            state, state_start = "countdown", now

    cap.release()
    cv2.destroyAllWindows()


def run_video(net: MoveNet, path: str, show: bool) -> dict:
    cap = cv2.VideoCapture(path)
    if not cap.isOpened():
        sys.exit(f"Cannot open video: {path}")
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    frames: list[Frame] = []
    i = 0
    while True:
        ok, frame = cap.read()
        if not ok:
            break
        kp = net(frame)
        frames.append(Frame(i / fps, kp))
        i += 1
        if show:
            draw_pose(frame, kp)
            cv2.imshow("Swing Vision", frame)
            if cv2.waitKey(1) & 0xFF in (ord("q"), 27):
                break
    cap.release()
    if show:
        cv2.destroyAllWindows()
    result = analyze_swing(frames)
    print(json.dumps(result, indent=2))
    return result


def decode_image(item: str) -> np.ndarray | None:
    if "," in item and item.startswith("data:"):
        item = item.split(",", 1)[1]
    try:
        buf = np.frombuffer(base64.b64decode(item), dtype=np.uint8)
    except (ValueError, TypeError):
        return None
    return cv2.imdecode(buf, cv2.IMREAD_COLOR)


def make_handler(net: MoveNet):
    class Handler(BaseHTTPRequestHandler):
        MAX_BODY = 80 * 1024 * 1024

        def _send(self, code: int, payload: dict) -> None:
            body = json.dumps(payload).encode()
            self.send_response(code)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(body)

        def do_OPTIONS(self):
            self.send_response(204)
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type")
            self.end_headers()

        def do_GET(self):
            if self.path.rstrip("/") == "/health":
                self._send(200, {"ok": True, "model": net.name})
            else:
                self._send(404, {"error": "Not found"})

        def do_POST(self):
            if self.path.rstrip("/") != "/analyze":
                return self._send(404, {"error": "Not found"})
            length = int(self.headers.get("Content-Length") or 0)
            if length <= 0 or length > self.MAX_BODY:
                return self._send(413, {"error": "Request body missing or too large"})
            try:
                body = json.loads(self.rfile.read(length))
            except json.JSONDecodeError:
                return self._send(400, {"error": "Body must be JSON"})

            images = body.get("frames") or []
            stamps = body.get("timestamps")  # milliseconds, optional
            fps = float(body.get("fps") or 30)
            if not images:
                return self._send(400, {"error": "Send {\"frames\": [base64 JPEGs], \"timestamps\": [ms]}"})

            frames: list[Frame] = []
            for i, item in enumerate(images):
                img = decode_image(item)
                if img is None:
                    continue
                t = stamps[i] / 1000 if stamps and i < len(stamps) else i / fps
                frames.append(Frame(t, net(img)))
            self._send(200, analyze_swing(frames))

        def log_message(self, fmt, *args):
            print(f"[{datetime.now():%H:%M:%S}] {fmt % args}")

    return Handler


def run_server(net: MoveNet, host: str, port: int) -> None:
    server = ThreadingHTTPServer((host, port), make_handler(net))
    print(f"Swing Vision server running at http://{host}:{port}")
    print("  GET  /health   check it's running")
    print("  POST /analyze  {\"frames\": [base64 JPEGs], \"timestamps\": [ms]}")
    print("Press Ctrl+C to stop.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    server.server_close()


def main() -> None:
    parser = argparse.ArgumentParser(description="MoveNet swing tracker for baseball cards")
    parser.add_argument("mode", choices=["live", "video", "serve"])
    parser.add_argument("video_path", nargs="?", help="video file (video mode)")
    parser.add_argument("--model", choices=list(MODELS), default="lightning")
    parser.add_argument("--model-path", type=Path, help="use a .tflite file you already have")
    parser.add_argument("--camera", type=int, default=0)
    parser.add_argument("--seconds", type=float, default=3.0)
    parser.add_argument("--show", action="store_true", help="show the video while analyzing (video mode)")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=5001)
    args = parser.parse_args()

    net = MoveNet(args.model, args.model_path)

    if args.mode == "live":
        run_live(net, args.camera, args.seconds)
    elif args.mode == "video":
        if not args.video_path:
            parser.error("video mode needs a file, e.g.  python vision/swing_vision.py video swing.mp4")
        run_video(net, args.video_path, args.show)
    else:
        run_server(net, args.host, args.port)


if __name__ == "__main__":
    main()