#!/usr/bin/env bash
# Closes the kiosk window so you can use the Pi's desktop.
# The website and swing tracker keep running. Reopen with: bash pi/start-kiosk.sh
touch "$HOME/.card-kiosk-stop"
pkill -f "user-data-dir=$HOME/.config/card-kiosk-chromium" || true
echo "Kiosk closed. Reopen it with: bash pi/start-kiosk.sh"