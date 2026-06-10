from __future__ import annotations

import customtkinter as ctk

from app import styles
from app.session import AppState, SessionData
from app.screens.base import BaseScreen
from app.services.stats import generate_random_stats


class RecordingScreen(BaseScreen):
  def __init__(self, master, session: SessionData, on_next) -> None:
    super().__init__(master, session, AppState.RECORDING, on_next)
    self._on_next = on_next
    self._tick = 0
    self._job: str | None = None

    self.title("Recording Your Swing", "Perform your swing now!")

    self.countdown = ctk.CTkLabel(
      self.content,
      text="3",
      font=styles.display_font(120),
      text_color=styles.ACCENT,
    )
    self.countdown.grid(row=2, column=0, pady=40)

    self.progress = ctk.CTkProgressBar(self.content, width=500, height=16, progress_color=styles.ACCENT)
    self.progress.grid(row=3, column=0, pady=16)
    self.progress.set(0)

    self.status = ctk.CTkLabel(
      self.content,
      text="Get ready…",
      font=styles.body_font(20),
      text_color=styles.INK_MUTED,
    )
    self.status.grid(row=4, column=0)

    btns = ctk.CTkFrame(self.content, fg_color="transparent")
    btns.grid(row=5, column=0, pady=24)
    styles.secondary_button(btns, text="Skip (testing)", command=self._finish, width=200).pack()

  def on_enter(self) -> None:
    self._tick = 3
    self.countdown.configure(text="3")
    self.progress.set(0)
    self.status.configure(text="Get ready…")
    self._schedule()

  def on_leave(self) -> None:
    if self._job:
      self.after_cancel(self._job)
      self._job = None

  def _schedule(self) -> None:
    self._job = self.after(1000, self._step)

  def _step(self) -> None:
    if self._tick > 0:
      self.countdown.configure(text=str(self._tick))
      self.status.configure(text="Swing in…" if self._tick <= 1 else "Get ready…")
      self._tick -= 1
      self._job = self.after(1000, self._step)
      return

    self.countdown.configure(text="⚾")
    self.status.configure(text="Recording…")
    self._record_progress(0)

  def _record_progress(self, val: float) -> None:
    val += 0.08
    self.progress.set(min(val, 1.0))
    if val < 1.0:
      self._job = self.after(200, lambda: self._record_progress(val))
    else:
      self._finish()

  def _finish(self) -> None:
    generated = generate_random_stats()
    self.session.nickname = generated["nickname"]
    self.session.position = generated["position"]
    self.session.stats = generated["stats"]
    self.session.fun_fact = generated["fun_fact"]
    self._on_next()
