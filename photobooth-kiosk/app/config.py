"""Application paths and environment configuration."""

from __future__ import annotations

import os
import sys
from pathlib import Path

# Root of photobooth-kiosk package
PACKAGE_ROOT = Path(__file__).resolve().parent.parent
REPO_ROOT = PACKAGE_ROOT.parent

# PyInstaller bundle support
if getattr(sys, "frozen", False):
    BUNDLE_ROOT = Path(sys._MEIPASS)
else:
    BUNDLE_ROOT = PACKAGE_ROOT

ASSETS_DIR = BUNDLE_ROOT / "assets"
OUTPUT_DIR = PACKAGE_ROOT / "output"
LEGAL_DIR = ASSETS_DIR / "legal"
FONTS_DIR = ASSETS_DIR / "fonts"

OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# Load .env from repo root or package root
try:
    from dotenv import load_dotenv

    for env_path in (REPO_ROOT / ".env", PACKAGE_ROOT / ".env"):
        if env_path.exists():
            load_dotenv(env_path)
            break
except ImportError:
    pass

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "").strip()
OPENROUTER_SITE_URL = os.getenv("OPENROUTER_SITE_URL", "http://localhost:8765")
OPENROUTER_APP_NAME = os.getenv("OPENROUTER_APP_NAME", "Baseball Card Kiosk")
OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions"
OPENROUTER_MODEL = "google/gemini-2.5-flash-image"

KIOSK_FULLSCREEN = os.getenv("KIOSK_FULLSCREEN", "").strip() in ("1", "true", "yes")
KIOSK_DEV = os.getenv("KIOSK_DEV", "").strip() in ("1", "true", "yes")
HTTP_PORT = int(os.getenv("KIOSK_HTTP_PORT", "8765"))

WINDOW_WIDTH = 1080
WINDOW_HEIGHT = 1920
