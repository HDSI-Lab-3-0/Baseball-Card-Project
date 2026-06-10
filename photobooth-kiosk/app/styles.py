"""Light stadium-programme theme tokens and fonts."""

from __future__ import annotations

from pathlib import Path

import customtkinter as ctk

from app.config import FONTS_DIR

# Warm off-white stadium programme palette
BG = "#F7F4EE"
BG_ALT = "#EDE8DC"
INK = "#1A2744"
INK_MUTED = "#4A5568"
ACCENT = "#2D6A4F"
ACCENT_HOVER = "#1B4332"
BORDER = "#D4CFC3"
WHITE = "#FDFCFA"
ERROR = "#B91C1C"
SUCCESS = "#166534"

# Font families — bundled TTF if present, else system fallbacks
DISPLAY_FAMILY = "Bebas Neue"
BODY_FAMILY = "Source Sans 3"


def _register_fonts() -> None:
    """Register bundled fonts with Tk when available."""
    if not FONTS_DIR.exists():
        return
    try:
        import tkinter.font as tkfont

        root = ctk.CTk()
        root.withdraw()
        for ttf in FONTS_DIR.glob("*.ttf"):
            try:
                tkfont.Font(root=root, name=ttf.stem, file=str(ttf))
            except Exception:
                pass
        root.destroy()
    except Exception:
        pass


def display_font(size: int, weight: str = "normal") -> ctk.CTkFont:
    families = [DISPLAY_FAMILY, "Arial Narrow", "Helvetica Neue", "Arial"]
    return ctk.CTkFont(family=families, size=size, weight=weight)


def body_font(size: int, weight: str = "normal") -> ctk.CTkFont:
    families = [BODY_FAMILY, "Segoe UI", "Helvetica", "Arial"]
    return ctk.CTkFont(family=families, size=size, weight=weight)


def apply_theme() -> None:
    ctk.set_appearance_mode("light")
    ctk.set_default_color_theme("green")


def primary_button(master, **kwargs) -> ctk.CTkButton:
    defaults = {
        "fg_color": ACCENT,
        "hover_color": ACCENT_HOVER,
        "text_color": WHITE,
        "font": body_font(20, "bold"),
        "height": 56,
        "corner_radius": 8,
    }
    defaults.update(kwargs)
    return ctk.CTkButton(master, **defaults)


def secondary_button(master, **kwargs) -> ctk.CTkButton:
    defaults = {
        "fg_color": "transparent",
        "border_width": 2,
        "border_color": INK,
        "text_color": INK,
        "hover_color": BG_ALT,
        "font": body_font(18),
        "height": 48,
        "corner_radius": 8,
    }
    defaults.update(kwargs)
    return ctk.CTkButton(master, **defaults)
