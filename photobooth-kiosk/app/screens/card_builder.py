from __future__ import annotations

import customtkinter as ctk
from PIL import Image, ImageTk

from app import styles
from app.data.teams import TEAM_NAMES, TEAMS
from app.session import AppState, SessionData
from app.screens.base import BaseScreen
from app.services.card_renderer import render_card_pair


class CardBuilderScreen(BaseScreen):
  def __init__(self, master, session: SessionData, on_next) -> None:
    super().__init__(master, session, AppState.CARD_BUILDER, on_next)
    self._on_next = on_next
    self._tk_preview: ImageTk.PhotoImage | None = None

    self.content.grid_columnconfigure(0, weight=1)
    self.content.grid_columnconfigure(1, weight=1)

    left = ctk.CTkFrame(self.content, fg_color="transparent")
    left.grid(row=0, column=0, sticky="nsew", padx=(0, 16))

    title = ctk.CTkLabel(left, text="Design Your Card", font=styles.display_font(40), text_color=styles.INK)
    title.pack(anchor="w", pady=(0, 16))

    ctk.CTkLabel(left, text="Team", font=styles.body_font(14), text_color=styles.INK_MUTED).pack(anchor="w")
    self.team_var = ctk.StringVar(value=session.team)
    self.team_menu = ctk.CTkOptionMenu(
      left,
      variable=self.team_var,
      values=TEAM_NAMES,
      command=self._refresh_preview,
      width=320,
      font=styles.body_font(16),
    )
    self.team_menu.pack(anchor="w", pady=(4, 16))

    ctk.CTkLabel(left, text="Display name", font=styles.body_font(14), text_color=styles.INK_MUTED).pack(anchor="w")
    self.name_lbl = ctk.CTkLabel(left, text="", font=styles.body_font(20), text_color=styles.INK)
    self.name_lbl.pack(anchor="w", pady=(4, 24))

    styles.primary_button(left, text="Create Card", command=self._continue, width=280).pack(anchor="w", pady=8)

    right = ctk.CTkFrame(self.content, fg_color=styles.BG_ALT, corner_radius=12)
    right.grid(row=0, column=1, sticky="nsew")
    self.preview_label = ctk.CTkLabel(right, text="")
    self.preview_label.pack(expand=True, padx=24, pady=24)

  def on_enter(self) -> None:
    self.team_var.set(self.session.team)
    self.name_lbl.configure(text=self.session.nickname or self.session.player_name)
    self._refresh_preview()

  def _refresh_preview(self, *_args) -> None:
    team = self.team_var.get()
    self.session.team = team
    portrait = None
    if self.session.selfie_path and self.session.selfie_path.exists():
      portrait = Image.open(self.session.selfie_path)

    card = render_card_pair(
      player_name=self.session.nickname or self.session.player_name,
      team=team,
      colors=TEAMS.get(team),
      position=self.session.position,
      number=self.session.jersey_number,
      stats=self.session.stats,
      player_image=portrait,
      fun_fact=self.session.fun_fact,
      scale=1,
    )
    preview = card.copy()
    preview.thumbnail((520, 620), Image.Resampling.LANCZOS)
    self._tk_preview = ImageTk.PhotoImage(preview)
    self.preview_label.configure(image=self._tk_preview)

  def _continue(self) -> None:
    self.session.team = self.team_var.get()
    self._on_next()
