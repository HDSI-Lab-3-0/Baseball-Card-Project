#!/usr/bin/env bash
# Opens the kiosk full screen in Chromium and reopens it if it ever closes.
# Started automatically at login by pi/setup.sh. To close it: bash pi/stop-kiosk.sh

KIOSK_URL="${KIOSK_URL:-http://localhost:4321/}"
STOP_FLAG="$HOME/.card-kiosk-stop"
PROFILE="$HOME/.config/card-kiosk-chromium"

rm -f "$STOP_FLAG"

CHROME="$(command -v chromium || command -v chromium-browser)"
if [ -z "$CHROME" ]; then
  echo "Chromium is not installed. Run pi/setup.sh first." >&2
  exit 1
fi

# Wait for the website to come up (it starts as a service at boot)
for _ in $(seq 1 90); do
  curl -fsS -o /dev/null "$KIOSK_URL" && break
  sleep 1
done

while [ ! -f "$STOP_FLAG" ]; do
  # Clear the "Chromium didn't shut down correctly" bubble after a power cut
  sed -i 's/"exited_cleanly":false/"exited_cleanly":true/; s/"exit_type":"Crashed"/"exit_type":"Normal"/' \
    "$PROFILE/Default/Preferences" 2>/dev/null || true

  "$CHROME" \
    --kiosk \
    --user-data-dir="$PROFILE" \
    --noerrdialogs \
    --disable-infobars \
    --no-first-run \
    --disable-session-crashed-bubble \
    --disable-features=Translate \
    --overscroll-history-navigation=0 \
    --disable-pinch \
    --check-for-update-interval=31536000 \
    "$KIOSK_URL"

  sleep 2
done