"""Main kiosk application and navigation."""

from __future__ import annotations

import customtkinter as ctk

from app import styles
from app.config import KIOSK_FULLSCREEN, WINDOW_HEIGHT, WINDOW_WIDTH
from app.session import STATE_ORDER, AppState, SessionData
from app.screens.payment import PaymentScreen
from app.screens.name import NameScreen
from app.screens.consent_selfie import ConsentSelfieScreen
from app.screens.instructions import InstructionsScreen
from app.screens.recording import RecordingScreen
from app.screens.stats import StatsScreen
from app.screens.card_builder import CardBuilderScreen
from app.screens.processing import ProcessingScreen
from app.screens.qr import QRScreen


class KioskApp(ctk.CTk):
  def __init__(self, fullscreen: bool = False) -> None:
    styles.apply_theme()
    super().__init__()
    self.title("Baseball Card Photobooth")
    self.configure(fg_color=styles.BG)

    self.session = SessionData()
    self._state = AppState.PAYMENT
    self._screens: dict[AppState, ctk.CTkFrame] = {}
    self._container = ctk.CTkFrame(self, fg_color=styles.BG)
    self._container.pack(fill="both", expand=True)

    self._build_screens()

    if fullscreen or KIOSK_FULLSCREEN:
      self.attributes("-fullscreen", True)
    else:
      self.geometry(f"{WINDOW_WIDTH}x{WINDOW_HEIGHT}")
      self.minsize(800, 600)

    self._show(AppState.PAYMENT)

  def _build_screens(self) -> None:
    builders = {
      AppState.PAYMENT: lambda: PaymentScreen(self._container, self.session, self._advance),
      AppState.NAME: lambda: NameScreen(self._container, self.session, self._advance),
      AppState.CONSENT_SELFIE: lambda: ConsentSelfieScreen(self._container, self.session, self._advance),
      AppState.INSTRUCTIONS: lambda: InstructionsScreen(self._container, self.session, self._advance),
      AppState.RECORDING: lambda: RecordingScreen(self._container, self.session, self._advance),
      AppState.STATS: lambda: StatsScreen(self._container, self.session, self._advance),
      AppState.CARD_BUILDER: lambda: CardBuilderScreen(self._container, self.session, self._advance),
      AppState.PROCESSING: lambda: ProcessingScreen(self._container, self.session, self._advance),
      AppState.QR: lambda: QRScreen(self._container, self.session, self._restart),
    }
    for state, builder in builders.items():
      screen = builder()
      screen.grid(row=0, column=0, sticky="nsew")
      screen.grid_remove()
      self._screens[state] = screen

    self._container.grid_rowconfigure(0, weight=1)
    self._container.grid_columnconfigure(0, weight=1)

  def _show(self, state: AppState) -> None:
    if self._state in self._screens:
      self._screens[self._state].on_leave()
      self._screens[self._state].grid_remove()
    self._state = state
    screen = self._screens[state]
    screen.grid()
    screen.on_enter()

  def _advance(self) -> None:
    idx = STATE_ORDER.index(self._state)
    if idx + 1 < len(STATE_ORDER):
      self._show(STATE_ORDER[idx + 1])

  def _restart(self) -> None:
    self.session.reset()
    self._show(AppState.PAYMENT)
