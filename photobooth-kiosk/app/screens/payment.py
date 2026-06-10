from __future__ import annotations

import customtkinter as ctk

from app import styles
from app.session import AppState, SessionData
from app.screens.base import BaseScreen


class PaymentScreen(BaseScreen):
  def __init__(self, master, session: SessionData, on_next) -> None:
    super().__init__(master, session, AppState.PAYMENT, on_next)
    self.content.grid_rowconfigure(2, weight=1)

    self.title("Ready to Play?", "Tap below to start your baseball card experience.")

    price = ctk.CTkLabel(
      self.content,
      text="$5.00",
      font=styles.display_font(72),
      text_color=styles.INK,
    )
    price.grid(row=2, column=0, pady=40)

    hint = ctk.CTkLabel(
      self.content,
      text="Card payment coming soon",
      font=styles.body_font(16),
      text_color=styles.INK_MUTED,
    )
    hint.grid(row=3, column=0)

    btn = styles.primary_button(
      self.content,
      text="Simulate Payment",
      command=on_next,
      width=400,
    )
    btn.grid(row=4, column=0, pady=48)
