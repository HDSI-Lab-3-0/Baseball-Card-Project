# Baseball Card Photobooth Kiosk

Standalone Python kiosk app for photobooths: payment → name → selfie → swing instructions → motion capture (emulated) → stats → card design → AI stylize + merge → QR download.

## Requirements

- Python 3.10+
- Webcam (optional in dev with `KIOSK_DEV=1` upload fallback)
- OpenRouter API key (optional — offline stylization fallback if missing)

## Setup

```bash
cd photobooth-kiosk
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

Copy the repo-root `.env` or create `photobooth-kiosk/.env`:

```env
OPENROUTER_API_KEY=your_key_here
OPENROUTER_SITE_URL=http://localhost:8765
OPENROUTER_APP_NAME=Baseball Card Kiosk
```

## Run

```bash
# Windowed (development)
python main.py

# Fullscreen kiosk
python main.py --fullscreen
# or
KIOSK_FULLSCREEN=1 python main.py
```

### Environment variables

| Variable | Description |
|----------|-------------|
| `KIOSK_FULLSCREEN` | `1` = borderless fullscreen |
| `KIOSK_DEV` | `1` = allow photo upload without camera |
| `KIOSK_HTTP_PORT` | QR download server port (default `8765`) |
| `OPENROUTER_API_KEY` | Enables AI portrait stylization |

## Output

Each session saves to `photobooth-kiosk/output/{session_id}/`:

- `selfie.jpg`
- `portrait_stylized.jpg`
- `card.png`
- `final.jpg`
- `metadata.json`

The QR screen serves files at `http://<LAN-IP>:8765/{session_id}/final.jpg` — phone must be on the same network.

## Build executable (PyInstaller)

Install PyInstaller in the venv, then build **on the target OS**:

```bash
pip install pyinstaller
pyinstaller build/photobooth.spec
```

Artifact: `dist/BaseballCardKiosk/` (folder distribution with bundled OpenCV).

macOS note: grant Camera permission to the app in System Settings.

## Flow

1. Payment (simulated)
2. Name entry
3. Terms + privacy consent + selfie
4. Swing instructions (animated batter)
5. Recording (emulated countdown)
6. Random stats reveal
7. Team picker + live card preview
8. Processing (OpenRouter or offline stylize + merge)
9. QR download + start over

## Optional fonts

Place bundled fonts in `assets/fonts/` for Bebas Neue and Source Sans 3. The app falls back to system fonts if not present.
