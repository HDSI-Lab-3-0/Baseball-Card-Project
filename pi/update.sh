#!/usr/bin/env bash
# Pulls the latest code from GitHub, rebuilds the site and restarts the kiosk services.
# Run on the Pi from anywhere:  bash pi/update.sh
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"

CONDA="$(command -v conda || echo "$HOME/miniforge3/bin/conda")"
ENV_PREFIX="$("$CONDA" info --base)/envs/baseball-card"
export PATH="$ENV_PREFIX/bin:$PATH"

echo "==> Pulling the latest code"
git pull --ff-only

echo "==> Updating the environment"
"$CONDA" env update -n baseball-card -f environment.yml --prune

echo "==> Rebuilding the website"
npm install --no-audit --no-fund
npm run build

echo "==> Restarting services"
sudo systemctl restart card-tracker.service card-site.service
echo "Done. Refresh the kiosk (or reboot) to see the changes."