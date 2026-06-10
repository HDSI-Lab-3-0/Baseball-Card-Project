from __future__ import annotations

import threading

import customtkinter as ctk

from app import styles
from app.session import AppState, SessionData
from app.screens.base import BaseScreen
from app.services.merge import composite_final, render_card_with_photo
from app.services.stylize import stylize_portrait


class ProcessingScreen(BaseScreen):
  def __init__(self, master, session: SessionData, on_next) -> None:
    super().__init__(master, session, AppState.PROCESSING, on_next)
    self._on_next = on_next

    self.title("Creating Your Card", "Stylizing your photo and building your final card…")

    self.progress = ctk.CTkProgressBar(
      self.content,
      width=500,
      progress_color=styles.ACCENT,
      mode="indeterminate",
    )
    self.progress.grid(row=2, column=0, pady=32)

    self.status = ctk.CTkLabel(
      self.content,
      text="Starting…",
      font=styles.body_font(18),
      text_color=styles.INK_MUTED,
    )
    self.status.grid(row=3, column=0)

    self.ai_note = ctk.CTkLabel(self.content, text="", font=styles.body_font(14), text_color=styles.INK_MUTED)
    self.ai_note.grid(row=4, column=0, pady=8)

  def on_enter(self) -> None:
    try:
      self.progress.start()
    except Exception:
      self.progress.set(0.5)
    threading.Thread(target=self._process, daemon=True).start()

  def on_leave(self) -> None:
    self.progress.stop()

  def _set_status(self, text: str) -> None:
    self.after(0, lambda: self.status.configure(text=text))

  def _process(self) -> None:
    try:
      s = self.session
      selfie = s.selfie_path
      if not selfie or not selfie.exists():
        self._set_status("Error: missing selfie")
        return

      stylized_path = s.session_dir / "portrait_stylized.jpg"
      card_path = s.session_dir / "card.png"
      final_path = s.session_dir / "final.jpg"

      self._set_status("Stylizing portrait…")
      _, used_ai = stylize_portrait(selfie, s.player_name, s.team, stylized_path)
      s.portrait_stylized_path = stylized_path
      s.used_ai_stylize = used_ai

      self._set_status("Rendering baseball card…")
      render_card_with_photo(
        player_name=s.nickname or s.player_name,
        team=s.team,
        position=s.position,
        number=s.jersey_number,
        stats=s.stats,
        portrait_path=stylized_path,
        card_path=card_path,
      )
      s.card_path = card_path

      self._set_status("Merging images…")
      composite_final(
        stylized_path,
        card_path,
        final_path,
        player_name=s.nickname or s.player_name,
        team=s.team,
        position=s.position,
        number=s.jersey_number,
        stats=s.stats,
        fun_fact=s.fun_fact,
      )
      s.final_path = final_path
      s.save_metadata()

      note = "AI stylization applied." if used_ai else "Offline stylization (no API key or API unavailable)."
      self.after(0, lambda: self.ai_note.configure(text=note))
      self.after(0, self._on_next)
    except Exception as exc:
      self._set_status(f"Error: {exc}")
