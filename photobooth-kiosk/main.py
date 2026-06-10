#!/usr/bin/env python3
"""Baseball Card Photobooth Kiosk — entry point."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

# Ensure package root is on path when run as script
ROOT = Path(__file__).resolve().parent
if str(ROOT) not in sys.path:
  sys.path.insert(0, str(ROOT))


def main() -> None:
  parser = argparse.ArgumentParser(description="Baseball Card Photobooth Kiosk")
  parser.add_argument(
    "--fullscreen",
    action="store_true",
    help="Run borderless fullscreen (also KIOSK_FULLSCREEN=1)",
  )
  args = parser.parse_args()

  from app.app import KioskApp

  app = KioskApp(fullscreen=args.fullscreen)
  app.mainloop()


if __name__ == "__main__":
  main()
