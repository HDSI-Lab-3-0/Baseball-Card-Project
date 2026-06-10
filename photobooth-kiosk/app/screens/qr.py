from __future__ import annotations

import shutil

import customtkinter as ctk
import qrcode
from PIL import Image, ImageTk

from app import styles
from app.config import OUTPUT_DIR
from app.session import AppState, SessionData
from app.screens.base import BaseScreen
from app.services.output_server import build_download_url, start_output_server


class QRScreen(BaseScreen):
  def __init__(self, master, session: SessionData, on_restart) -> None:
    super().__init__(master, session, AppState.QR, on_restart)
    self._on_restart = on_restart
    self._tk_qr: ImageTk.PhotoImage | None = None
    self._tk_final: ImageTk.PhotoImage | None = None

    self.title("You're All Set!", "Scan the QR code to download your photo.")

    self.qr_label = ctk.CTkLabel(self.content, text="")
    self.qr_label.grid(row=2, column=0, pady=16)

    self.url_label = ctk.CTkLabel(
      self.content,
      text="",
      font=styles.body_font(14),
      text_color=styles.INK_MUTED,
      wraplength=800,
    )
    self.url_label.grid(row=3, column=0, pady=8)

    self.preview_label = ctk.CTkLabel(self.content, text="")
    self.preview_label.grid(row=4, column=0, pady=16)

    path_lbl = ctk.CTkLabel(
      self.content,
      text="",
      font=styles.body_font(12),
      text_color=styles.INK_MUTED,
      wraplength=800,
    )
    path_lbl.grid(row=5, column=0)
    self.path_label = path_lbl

    styles.primary_button(self.content, text="Start Over", command=self._on_restart, width=280).grid(row=6, column=0, pady=32)

  def on_enter(self) -> None:
    s = self.session
    start_output_server(OUTPUT_DIR)

    # Copy session files for HTTP serving: output/{session_id}/final.jpg
    session_http = OUTPUT_DIR / s.session_id
    session_http.mkdir(parents=True, exist_ok=True)
    if s.final_path and s.final_path.exists():
      dest = session_http / "final.jpg"
      shutil.copy2(s.final_path, dest)

    url = build_download_url(s.session_id, "final.jpg")
    self.url_label.configure(text=url)

    qr = qrcode.QRCode(box_size=8, border=2)
    qr.add_data(url)
    qr.make(fit=True)
    qr_img = qr.make_image(fill_color=styles.INK, back_color=styles.WHITE).convert("RGB")
    qr_img = qr_img.resize((280, 280), Image.Resampling.NEAREST)
    self._tk_qr = ImageTk.PhotoImage(qr_img)
    self.qr_label.configure(image=self._tk_qr)

    if s.final_path and s.final_path.exists():
      prev = Image.open(s.final_path)
      prev.thumbnail((500, 400), Image.Resampling.LANCZOS)
      self._tk_final = ImageTk.PhotoImage(prev)
      self.preview_label.configure(image=self._tk_final)

    self.path_label.configure(text=f"Saved locally: {s.final_path}")
