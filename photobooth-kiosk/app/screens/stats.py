from __future__ import annotations

import customtkinter as ctk

from app import styles
from app.session import AppState, SessionData
from app.screens.base import BaseScreen
from app.services.stats import random_jersey_number


class StatsScreen(BaseScreen):
  def __init__(self, master, session: SessionData, on_next) -> None:
    super().__init__(master, session, AppState.STATS, on_next)

    self.title("Your Stats", "Calculated from your swing (simulated for now).")

    self.nickname_lbl = ctk.CTkLabel(self.content, text="", font=styles.display_font(36), text_color=styles.ACCENT)
    self.nickname_lbl.grid(row=2, column=0, pady=8)

    self.pos_lbl = ctk.CTkLabel(self.content, text="", font=styles.body_font(18), text_color=styles.INK_MUTED)
    self.pos_lbl.grid(row=3, column=0)

    self.stats_frame = ctk.CTkFrame(self.content, fg_color=styles.WHITE, corner_radius=12)
    self.stats_frame.grid(row=4, column=0, pady=24, padx=80, sticky="ew")

    self.fact_lbl = ctk.CTkLabel(
      self.content,
      text="",
      font=styles.body_font(16),
      text_color=styles.INK,
      wraplength=700,
    )
    self.fact_lbl.grid(row=5, column=0, pady=16)

    styles.primary_button(self.content, text="Build My Card", command=on_next, width=320).grid(row=6, column=0, pady=32)

  def on_enter(self) -> None:
    self.session.jersey_number = random_jersey_number()
    self.nickname_lbl.configure(text=self.session.nickname or self.session.player_name)
    self.pos_lbl.configure(text=self.session.position)

    for w in self.stats_frame.winfo_children():
      w.destroy()

    row = 0
    col = 0
    for key, val in self.session.stats.items():
      cell = ctk.CTkFrame(self.stats_frame, fg_color="transparent")
      cell.grid(row=row, column=col, padx=24, pady=16)
      ctk.CTkLabel(cell, text=key, font=styles.body_font(12, "bold"), text_color=styles.INK_MUTED).pack()
      ctk.CTkLabel(cell, text=val, font=styles.display_font(28), text_color=styles.INK).pack()
      col += 1
      if col >= 3:
        col = 0
        row += 1

    self.fact_lbl.configure(text=f"Fun fact: {self.session.fun_fact}")
