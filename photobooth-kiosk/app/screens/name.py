from __future__ import annotations

import customtkinter as ctk

from app import styles
from app.session import AppState, SessionData
from app.screens.base import BaseScreen
from app.services.card_renderer import MAX_CARD_NAME_CHARS


class NameScreen(BaseScreen):
  def __init__(self, master, session: SessionData, on_next) -> None:
    super().__init__(master, session, AppState.NAME, on_next)
    self._on_next = on_next

    self.title("What's Your Name?", "This will appear on your baseball card.")

    self.name_var = ctk.StringVar()
    self.name_var.trace_add("write", self._limit_name)
    self.entry = ctk.CTkEntry(
      self.content,
      placeholder_text="Enter your name",
      textvariable=self.name_var,
      font=styles.body_font(24),
      height=56,
      width=500,
      fg_color=styles.WHITE,
      border_color=styles.BORDER,
      text_color=styles.INK,
    )
    self.entry.grid(row=2, column=0, pady=24)
    self.entry.bind("<Return>", lambda _: self._continue())

    self.error = ctk.CTkLabel(self.content, text="", text_color=styles.ERROR, font=styles.body_font(14))
    self.error.grid(row=3, column=0)

    btn = styles.primary_button(self.content, text="Continue", command=self._continue, width=300)
    btn.grid(row=4, column=0, pady=32)

  def on_enter(self) -> None:
    self.entry.delete(0, "end")
    if self.session.player_name:
      self.entry.insert(0, self.session.player_name)
    self.entry.focus()

  def _limit_name(self, *_args) -> None:
    value = self.name_var.get()
    if len(value) > MAX_CARD_NAME_CHARS:
      self.name_var.set(value[:MAX_CARD_NAME_CHARS])

  def _continue(self) -> None:
    name = self.entry.get().strip()
    if not name:
      self.error.configure(text="Please enter your name.")
      return
    if len(name) > MAX_CARD_NAME_CHARS:
      self.error.configure(text=f"Name must be {MAX_CARD_NAME_CHARS} characters or fewer.")
      return
    self.session.player_name = name
    self.error.configure(text="")
    self._on_next()
