from __future__ import annotations

import customtkinter as ctk

from app import styles
from app.session import AppState, SessionData
from app.screens.base import BaseScreen


class InstructionsScreen(BaseScreen):
  """Bat swing animation via canvas frames."""

  FRAMES = 8

  def __init__(self, master, session: SessionData, on_next) -> None:
    super().__init__(master, session, AppState.INSTRUCTIONS, on_next)

    self.title("How to Swing", "Stand in the capture zone and mimic a full baseball swing.")

    self.canvas = tk_canvas = __import__("tkinter").Canvas(
      self.content,
      width=400,
      height=300,
      bg=styles.BG_ALT,
      highlightthickness=0,
    )
    tk_canvas.grid(row=2, column=0, pady=24)
    self._canvas = tk_canvas
    self._frame = 0
    self._anim_id: str | None = None

    copy = ctk.CTkLabel(
      self.content,
      text="1. Feet shoulder-width apart\n2. Load the bat behind you\n3. Swing through the zone\n4. Hold your finish pose",
      font=styles.body_font(18),
      text_color=styles.INK,
      justify="left",
    )
    copy.grid(row=3, column=0, pady=16)

    styles.primary_button(self.content, text="Got it — Let's go", command=on_next, width=320).grid(row=4, column=0, pady=24)

  def on_enter(self) -> None:
    self._frame = 0
    self._animate()

  def on_leave(self) -> None:
    if self._anim_id:
      self._canvas.after_cancel(self._anim_id)
      self._anim_id = None

  def _draw_batter(self, phase: int) -> None:
    c = self._canvas
    c.delete("all")
    w, h = 400, 300
    cx, cy = w // 2, h - 40

    # Ground
    c.create_line(40, cy, w - 40, cy, fill=styles.BORDER, width=2)

    # Body
    head_y = cy - 110
    c.create_oval(cx - 18, head_y - 18, cx + 18, head_y + 18, fill=styles.INK, outline="")
    c.create_line(cx, head_y + 18, cx, cy - 50, fill=styles.INK, width=4)

    # Legs
    c.create_line(cx, cy - 50, cx - 25, cy, fill=styles.INK, width=4)
    c.create_line(cx, cy - 50, cx + 25, cy, fill=styles.INK, width=4)

    # Bat angle by phase
    angles = [-120, -90, -45, 0, 45, 90, 60, 30]
    angle = angles[phase % len(angles)]
    import math

    rad = math.radians(angle)
    bx = cx + 70 * math.cos(rad)
    by = head_y + 40 + 70 * math.sin(rad)
    c.create_line(cx + 10, head_y + 35, bx, by, fill="#8B4513", width=6)
    c.create_oval(bx - 8, by - 8, bx + 8, by + 8, fill=styles.ACCENT, outline="")

    # Motion arc
    c.create_arc(cx - 80, head_y - 20, cx + 100, head_y + 120, start=200, extent=80, outline=styles.ACCENT, style="arc", width=2)

  def _animate(self) -> None:
    self._draw_batter(self._frame)
    self._frame = (self._frame + 1) % self.FRAMES
    self._anim_id = self._canvas.after(180, self._animate)
