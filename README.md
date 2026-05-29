# ⚾ Baseball Card Generator

A real-time AI-powered sports card kiosk. Walk up, strike a pose, and walk away with a personalized baseball card — stylized by AI, stats calculated from your actual body movement.

---

## What It Does

1. User walks through a kiosk UI on a touchscreen
2. Takes a photo with the webcam
3. Picks their sport, action, and favorite team
4. Performs a 5-second motion clip (swing, pitch, etc.)
5. MoveNet analyzes their pose frame-by-frame
6. Stats are calculated from real body movement data
7. Gemini AI stylizes their photo into a vintage baseball card portrait
8. A fully personalized sports card is revealed on screen

---

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend / Kiosk UI | Astro + React + Tailwind |
| Pose Analysis | Python + MoveNet (TensorFlow Lite) |
| Image Stylization | Google Gemini 2.5 Flash (via OpenRouter) |
| Hardware | Raspberry Pi 5 (or any machine with a webcam) |
| State | In-memory singleton (globalThis) |

---

## Project Structure

```
Baseball-Card-Project/
├── src/
│   ├── components/
│   │   ├── BaseballCard.tsx      # Card UI component
│   │   ├── CardBuilder.tsx       # Web UI card builder
│   │   ├── KioskFlow.tsx         # Touchscreen kiosk flow
│   │   └── PiCardDisplay.tsx     # Live card display (polls for Pi data)
│   ├── data/
│   │   └── teams.ts              # Team names and colors
│   ├── layouts/
│   │   └── Layout.astro          # Base layout
│   ├── lib/
│   │   └── cardStore.ts          # Shared in-memory state (globalThis)
│   └── pages/
│       ├── index.astro           # Main card builder page
│       ├── kiosk.astro           # Kiosk fullscreen page
│       └── api/
│           ├── generate-card.ts  # Main API — handles Pi data + web UI
│           ├── latest-card.ts    # Returns latest card data
│           ├── start-recording.ts # Spawns Python script
│           ├── status.ts         # Returns current recording status
│           └── reset.ts          # Resets store for next player
├── vision/
│   ├── baseball_pi.py            # Pose analysis script (MoveNet)
│   ├── model.tflite              # MoveNet Thunder model
│   └── hero_pitch.jpg            # Last saved hero frame
├── .env                          # API keys (not committed)
└── README.md
```

---

## Setup

### Prerequisites

- Node.js 18+
- Python 3.10+
- A webcam

### 1. Clone and install dependencies

```bash
git clone <your-repo>
cd Baseball-Card-Project
npm install
```

### 2. Set up Python environment

```bash
cd vision
python -m venv baseball-env
baseball-env\Scripts\activate  # Windows
# source baseball-env/bin/activate  # Mac/Linux

pip install opencv-python numpy requests
pip install ai-edge-litert  # for MoveNet on Pi
# or: pip install tflite-runtime  # alternative
```

### 3. Configure environment variables

Copy `.env.example` to `.env` and fill in:

```env
OPENROUTER_API_KEY=your_key_here
OPENROUTER_SITE_URL=http://localhost:4321   # optional
OPENROUTER_APP_NAME=BaseballCardGenerator   # optional
```

Get an OpenRouter API key at [openrouter.ai](https://openrouter.ai).

### 4. Download the MoveNet model

Place `model.tflite` (MoveNet Thunder) in the `vision/` folder.
Download from: https://www.kaggle.com/models/google/movenet/tfLite/singlepose-thunder

---

## Running

### Start Astro dev server

```bash
npm run dev -- --host
```

This binds to all network interfaces so other devices (like a Pi) can reach it.

- Local: `http://localhost:4321`
- Network: `http://<your-ip>:4321`

### Kiosk UI

Open `http://localhost:4321/kiosk` in a browser (fullscreen for best experience).

### Card Builder (web UI)

Open `http://localhost:4321` — upload a photo manually and generate a card.

### Run Python script manually (for testing)

```bash
cd vision
python baseball_pi.py --mode pitch --headless
# or
python baseball_pi.py --mode swing --headless
# or interactive mode (keyboard controls):
python baseball_pi.py
```

---

## How the Kiosk Flow Works

```
Welcome Screen
    ↓ tap "Let's Go"
Photo Screen (webcam snapshot)
    ↓ tap "Use This"
Name Screen (on-screen keyboard)
    ↓ tap "Next"
Sport Screen (Baseball, Soccer, Football, Basketball)
    ↓ tap a sport
Action Screen (Pitch, Swing / Kick / Throw / Shoot)
    ↓ tap an action
Team Screen (pick favorite team)
    ↓ tap a team
Recording Screen (5s countdown + live camera feed)
    ↓ auto-advances after clip
Generating Screen (spinner while AI works)
    ↓ card ready
Reveal Screen (animated card with AI-stylized photo)
    ↓ tap "Play Again" to reset
```

---

## How the Pose Analysis Works

The Python script (`baseball_pi.py`) uses MoveNet to extract 17 body keypoints from every frame of the 5-second clip. From those keypoints it calculates:

| Feature | Description |
|---|---|
| `peak_wrist_velocity` | Max frame-to-frame wrist displacement (swing power) |
| `hip_rotation_range` | Angular sweep of the hip line (rotation) |
| `max_shoulder_hip_separation` | Peak angular difference between shoulder and hip axes (form) |
| `max_limb_spread` | Max wrist spread relative to body center (style) |
| `peak_arm_extension` | Max shoulder-to-wrist distance (pitch power) |
| `peak_leg_kick` | Max knee height relative to hip (pitch form) |
| `total_body_movement` | Cumulative movement across all limbs (hustle) |

Each feature is normalized to a 75–99 stat range using:

```python
def norm(raw, lo, hi):
    clamped = max(lo, min(raw, hi))
    return int(75 + ((clamped - lo) / (hi - lo)) * 24)
```

---

## How the Card is Generated

1. Python POSTs `{ mode, stats, features }` to `/api/generate-card`
2. Astro maps pose stats to baseball card stats (ERA, K, WHIP for pitch / AVG, HR, RBI for swing)
3. Astro retrieves the player's webcam photo from the store
4. Gemini 2.5 Flash stylizes the photo into a vintage baseball card portrait
5. The stylized image + card stats are saved to the store
6. The kiosk browser polls `/api/status` every 1.5s and shows the reveal screen when ready

---

## API Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/api/generate-card` | POST | Handles Pi pose data or web UI card generation |
| `/api/start-recording` | POST | Spawns Python script with mode arg |
| `/api/status` | GET | Returns current recording status and card data |
| `/api/latest-card` | GET | Returns latest card (used by PiCardDisplay) |
| `/api/reset` | POST | Clears store for next player |

---

## Environment Notes

- **Camera conflict**: The browser and Python both use the webcam. The browser releases it before Python starts — there's a 300ms delay to ensure this.
- **State persistence**: All state is in-memory. Restarting `npm run dev` clears it.
- **Network vs localhost**: Use `localhost:4321` when Python runs on the same machine as Astro. Use the network IP only when running Python on a separate device (e.g. actual Raspberry Pi).
- **HTTPS requirement**: `getUserMedia` (webcam) requires HTTPS on non-localhost origins. For network access, either use HTTPS or add the IP to Chrome's insecure origins exception at `chrome://flags/#unsafely-treat-insecure-origin-as-secure`.

---

## Adding a New Sport

1. Add the sport and its actions to `SPORT_ACTIONS` in `KioskFlow.tsx`
2. Add the sport emoji to `SPORT_EMOJIS`
3. Create a new Python script in `vision/` (e.g. `soccer_pi.py`) with sport-specific feature calculations
4. Update `start-recording.ts` to spawn the right script based on `mode`
5. Add stat mappings in `poseStatsToCardStats` in `generate-card.ts`

---

## Credits

- Pose estimation: [MoveNet](https://www.tensorflow.org/hub/tutorials/movenet) by Google
- Image stylization: [Gemini 2.5 Flash](https://openrouter.ai) via OpenRouter
- Card UI inspired by Topps and Upper Deck baseball cards
