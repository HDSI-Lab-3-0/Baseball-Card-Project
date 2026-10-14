#!/usr/bin/env bash
# One-time setup that turns a Raspberry Pi 5 into the baseball card kiosk.
#
# After this runs, every boot will:
#   1. start the swing tracker   (vision/swing_vision.py serve)  as service "card-tracker"
#   2. start the website         (built Astro site on port 4321) as service "card-site"
#   3. open Chromium full screen on the kiosk, with the webcam pre-approved
#
# Usage (on the Pi, from the project folder):
#   cp .env.example .env    # then put your OpenRouter key in .env
#   bash pi/setup.sh
#
# Safe to run again: it updates what's already there.

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
USER_NAME="$(id -un)"
ENV_NAME="baseball-card"

say()  { printf '\n\033[1;33m==> %s\033[0m\n' "$*"; }
fail() { printf '\n\033[1;31mERROR: %s\033[0m\n' "$*" >&2; exit 1; }

cd "$PROJECT_DIR"

# --- Checks ---------------------------------------------------------------
[ "$(id -u)" -ne 0 ] || fail "Run this as your normal user, not with sudo. It asks for sudo when it needs it."
[ "$(uname -m)" = "aarch64" ] || echo "Warning: this is meant for a 64-bit Raspberry Pi OS (aarch64); found $(uname -m)."
[ -f environment.yml ] || fail "environment.yml not found in $PROJECT_DIR"
[ -f .env ] || fail "No .env file. Run:  cp .env.example .env  and put your OPENROUTER_API_KEY in it."
grep -qE '^OPENROUTER_API_KEY=.+' .env || fail ".env has no OPENROUTER_API_KEY value. Add your key, then run this again."

# --- System packages ------------------------------------------------------
say "Installing system packages (Chromium, curl)"
sudo apt-get update -y
if ! command -v chromium >/dev/null && ! command -v chromium-browser >/dev/null; then
  sudo apt-get install -y chromium || sudo apt-get install -y chromium-browser
fi
sudo apt-get install -y curl

# --- Conda (Miniforge) ----------------------------------------------------
if command -v conda >/dev/null; then
  CONDA="$(command -v conda)"
elif [ -x "$HOME/miniforge3/bin/conda" ]; then
  CONDA="$HOME/miniforge3/bin/conda"
else
  say "Installing Miniforge (conda for Raspberry Pi)"
  installer="$(mktemp --suffix=.sh)"
  curl -fsSL -o "$installer" \
    "https://github.com/conda-forge/miniforge/releases/latest/download/Miniforge3-Linux-aarch64.sh"
  bash "$installer" -b -p "$HOME/miniforge3"
  rm -f "$installer"
  CONDA="$HOME/miniforge3/bin/conda"
fi
CONDA_BASE="$("$CONDA" info --base)"
ENV_PREFIX="$CONDA_BASE/envs/$ENV_NAME"

say "Creating/updating the '$ENV_NAME' environment (Python, Node, OpenCV, MoveNet runtime)"
if [ -d "$ENV_PREFIX" ]; then
  "$CONDA" env update -n "$ENV_NAME" -f environment.yml --prune
else
  "$CONDA" env create -n "$ENV_NAME" -f environment.yml
fi

PY="$ENV_PREFIX/bin/python"
NODE="$ENV_PREFIX/bin/node"
[ -x "$PY" ] && [ -x "$NODE" ] || fail "The environment is missing python or node. Check environment.yml includes nodejs."
export PATH="$ENV_PREFIX/bin:$PATH"

# --- Website --------------------------------------------------------------
say "Installing website packages and building the site"
npm install --no-audit --no-fund
npm run build   # note: this bakes the API key from .env into dist/, so rebuild if the key changes

# --- MoveNet model --------------------------------------------------------
say "Downloading the MoveNet model (if needed)"
"$PY" -c "import sys; sys.path.insert(0, 'vision'); import swing_vision as s; s.ensure_model('lightning')"

# --- Services -------------------------------------------------------------
say "Installing the card-tracker and card-site services"
sudo tee /etc/systemd/system/card-tracker.service >/dev/null <<EOF
[Unit]
Description=Baseball card swing tracker (MoveNet)
After=network.target

[Service]
User=$USER_NAME
WorkingDirectory=$PROJECT_DIR
ExecStart=$PY $PROJECT_DIR/vision/swing_vision.py serve --host 127.0.0.1 --port 5001
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

sudo tee /etc/systemd/system/card-site.service >/dev/null <<EOF
[Unit]
Description=Baseball card website
After=network.target card-tracker.service

[Service]
User=$USER_NAME
WorkingDirectory=$PROJECT_DIR
EnvironmentFile=-$PROJECT_DIR/.env
Environment=HOST=127.0.0.1
Environment=PORT=4321
ExecStart=$NODE $PROJECT_DIR/dist/server/entry.mjs
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable card-tracker.service card-site.service
sudo systemctl restart card-tracker.service card-site.service

# --- Chromium: allow the webcam on the kiosk page without a prompt ----------
say "Pre-approving the webcam for the kiosk page"
policy='{
  "VideoCaptureAllowedUrls": ["http://localhost:4321", "http://127.0.0.1:4321"],
  "TranslateEnabled": false,
  "PasswordManagerEnabled": false
}'
for dir in /etc/chromium/policies/managed /etc/chromium-browser/policies/managed; do
  sudo mkdir -p "$dir"
  echo "$policy" | sudo tee "$dir/card-kiosk.json" >/dev/null
done

# --- Start the kiosk on login ----------------------------------------------
say "Opening the kiosk automatically at login"
chmod +x "$PROJECT_DIR/pi/start-kiosk.sh" "$PROJECT_DIR/pi/stop-kiosk.sh" "$PROJECT_DIR/pi/update.sh"
mkdir -p "$HOME/.config/autostart"
cat > "$HOME/.config/autostart/card-kiosk.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=Baseball Card Kiosk
Exec=$PROJECT_DIR/pi/start-kiosk.sh
X-GNOME-Autostart-enabled=true
EOF

# --- Screen settings --------------------------------------------------------
if command -v raspi-config >/dev/null; then
  say "Turning off screen blanking and enabling auto-login to the desktop"
  sudo raspi-config nonint do_blanking 1 || true      # 1 = blanking off
  sudo raspi-config nonint do_boot_behaviour B4 || true  # B4 = desktop, auto-login
fi

# --- Quick health check -------------------------------------------------------
say "Checking that everything is running"
for i in $(seq 1 30); do
  curl -fsS http://127.0.0.1:4321/api/analyze-swing >/dev/null 2>&1 && break
  sleep 1
done
curl -sS http://127.0.0.1:4321/api/analyze-swing || true
echo

cat <<EOF

All set! Reboot to start the kiosk:   sudo reboot

Handy commands:
  bash pi/stop-kiosk.sh                       close the kiosk window (to use the desktop)
  bash pi/start-kiosk.sh                      open it again
  bash pi/update.sh                           pull new code from GitHub and rebuild
  sudo systemctl status card-tracker card-site
  journalctl -u card-tracker -f               live log from the swing tracker
EOF