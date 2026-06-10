"""Base screen with shared chrome."""

from __future__ import annotations

from typing import Callable

import customtkinter as ctk

from app import styles
from app.session import AppState, SessionData, step_number


class BaseScreen(ctk.CTkFrame):
  def __init__(
    self,
    master,
    session: SessionData,
    state: AppState,
    on_next: Callable[[], None],
    **kwargs,
  ) -> None:
    super().__init__(master, fg_color=styles.BG, **kwargs)
    self.session = session
    self.state = state
    self.on_next = on_next

    self.grid_columnconfigure(0, weight=1)
    self.grid_rowconfigure(1, weight=1)

    header = ctk.CTkFrame(self, fg_color="transparent")
    header.grid(row=0, column=0, sticky="ew", padx=40, pady=(24, 8))
    header.grid_columnconfigure(0, weight=1)

    self.step_label = ctk.CTkLabel(
      header,
      text=f"Step {step_number(state)} of 9",
      font=styles.body_font(14),
      text_color=styles.INK_MUTED,
    )
    self.step_label.grid(row=0, column=0, sticky="w")

    self.content = ctk.CTkFrame(self, fg_color="transparent")
    self.content.grid(row=1, column=0, sticky="nsew", padx=40, pady=16)
    self.content.grid_columnconfigure(0, weight=1)
    self.content.grid_rowconfigure(0, weight=1)

  def on_enter(self) -> None:
    pass

  def on_leave(self) -> None:
    pass

  def title(self, text: str, subtitle: str | None = None) -> None:
    lbl = ctk.CTkLabel(
      self.content,
      text=text,
      font=styles.display_font(48),
      text_color=styles.INK,
    )
    lbl.grid(row=0, column=0, pady=(0, 8))
    if subtitle:
      sub = ctk.CTkLabel(
        self.content,
        text=subtitle,
        font=styles.body_font(18),
        text_color=styles.INK_MUTED,
        wraplength=900,
      )
      sub.grid(row=1, column=0, pady=(0, 24))
