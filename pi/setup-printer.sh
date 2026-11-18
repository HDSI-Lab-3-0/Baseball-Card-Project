#!/usr/bin/env bash
# One-time setup for the USB printer (HP DeskJet 2900 series).
# Makes it the default printer so the kiosk's "Print card" button prints right away
# (the kiosk runs Chromium with --kiosk-printing, which skips the print dialog).
#
# Usage (on the Pi, printer plugged in by USB and switched on):
#   bash pi/setup-printer.sh
# Then reboot. Safe to run again.

set -euo pipefail

QUEUE="DeskJet2900"
say()  { printf '\n\033[1;33m==> %s\033[0m\n' "$*"; }
fail() { printf '\n\033[1;31mERROR: %s\033[0m\n' "$*" >&2; exit 1; }

[ "$(id -u)" -ne 0 ] || fail "Run this as your normal user, not with sudo."

say "Installing the print system (CUPS + HP drivers + USB printing)"
sudo apt-get update -y
sudo apt-get install -y cups hplip printer-driver-hpcups ipp-usb avahi-daemon
sudo usermod -aG lpadmin "$(id -un)"
sudo systemctl enable --now cups
sudo systemctl restart ipp-usb 2>/dev/null || true

say "Looking for the HP printer on USB"
lsusb | grep -qi "hewlett\|HP, Inc\| HP " || fail "No HP printer found on USB. Plug it in, turn it on, and run this again."
lsusb | grep -i "hewlett\|HP, Inc\| HP "

# Give CUPS / ipp-usb a few seconds to notice the printer
uri=""
for _ in $(seq 1 15); do
  uri="$(sudo lpinfo -v 2>/dev/null | awk '$2 ~ /^(usb|hp):\/\/HP/ {print $2; exit}')"
  [ -n "$uri" ] && break
  sleep 1
done

# Prefer HP's own driver if it knows this model, otherwise go driverless over IPP-USB
driver="$(sudo lpinfo -m 2>/dev/null | grep -iE 'deskjet[ _-]?29[0-9]{2}' | grep -i hpcups | awk 'NR==1{print $1}')"

sudo lpadmin -x "$QUEUE" 2>/dev/null || true
if [ -n "$uri" ] && [ -n "$driver" ]; then
  say "Adding printer with HP driver: $driver"
  sudo lpadmin -p "$QUEUE" -E -v "$uri" -m "$driver"
elif curl -fsS -o /dev/null --max-time 5 http://localhost:60000/ 2>/dev/null; then
  say "Adding printer driverless over IPP-USB"
  sudo lpadmin -p "$QUEUE" -E -v "ipp://localhost:60000/ipp/print" -m everywhere
else
  fail "Found the printer but couldn't set it up automatically.
Try:  sudo hp-setup -i     (pick USB, follow the prompts), then:  lpoptions -d <printer name>"
fi

say "Making it the default printer"
sudo lpadmin -d "$QUEUE"
lpoptions -d "$QUEUE" >/dev/null
sudo lpadmin -p "$QUEUE" -D "DeskJet 2900" -o media=Letter -o print-color-mode=color 2>/dev/null || true
sudo cupsenable "$QUEUE"
sudo cupsaccept "$QUEUE"

# Chromium: print to that printer with backgrounds/colors on and no URL/date header
say "Setting Chromium print defaults"
policy='{
  "PrintingEnabled": true,
  "PrintHeaderFooter": false,
  "PrintingBackgroundGraphicsDefault": "enabled",
  "DefaultPrinterSelection": "{\"kind\": \"local\", \"namePattern\": \".*DeskJet.*\"}"
}'
for dir in /etc/chromium/policies/managed /etc/chromium-browser/policies/managed; do
  sudo mkdir -p "$dir"
  echo "$policy" | sudo tee "$dir/card-printing.json" >/dev/null
done

# Forget any printer Chromium remembered from an earlier print dialog (e.g. "Save as PDF").
# Chromium has to be closed for this, so close the kiosk; it reopens on reboot.
bash "$(dirname "${BASH_SOURCE[0]}")/stop-kiosk.sh" >/dev/null 2>&1 || true
sleep 2
prefs="$HOME/.config/card-kiosk-chromium/Default/Preferences"
if [ -f "$prefs" ]; then
  python3 - "$prefs" <<'PY'
import json, sys
path = sys.argv[1]
with open(path) as f:
    prefs = json.load(f)
prefs.get("printing", {}).pop("print_preview_sticky_settings", None)
with open(path, "w") as f:
    json.dump(prefs, f)
PY
fi

say "Printer status"
lpstat -p "$QUEUE" -d

cat <<EOF

Printer ready. Test it with:   echo "Test print" | lp
Then reboot so the kiosk picks up silent printing:   sudo reboot

If the card button ever stops printing:
  lpstat -p                      is the printer enabled / idle?
  cancel -a                      clear stuck jobs
  sudo cupsenable $QUEUE         re-enable it after a paper jam / out-of-ink pause
EOF
