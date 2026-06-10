from __future__ import annotations

import tkinter as tk
from tkinter import filedialog
from typing import Callable

import customtkinter as ctk
from PIL import Image, ImageTk

from app import styles
from app.config import KIOSK_DEV, LEGAL_DIR
from app.session import AppState, SessionData
from app.screens.base import BaseScreen
from app.services.camera import CameraService


class ConsentSelfieScreen(BaseScreen):
  def __init__(self, master, session: SessionData, on_next: Callable[[], None]) -> None:
    super().__init__(master, session, AppState.CONSENT_SELFIE, on_next)
    self._on_next = on_next
    self._camera = CameraService()
    self._photo_label: ctk.CTkLabel | None = None
    self._tk_image: ImageTk.PhotoImage | None = None
    self._capturing = False

    self.content.grid_rowconfigure(2, weight=1)

    self.title("Photo & Consent", "Review policies, then take your selfie.")

    legal_frame = ctk.CTkFrame(self.content, fg_color=styles.WHITE, corner_radius=8)
    legal_frame.grid(row=2, column=0, sticky="nsew", pady=8)
    legal_frame.grid_columnconfigure(0, weight=1)
    legal_frame.grid_rowconfigure(0, weight=1)

    text = tk.Text(
      legal_frame,
      wrap="word",
      font=("Helvetica", 12),
      bg=styles.WHITE,
      fg=styles.INK,
      height=10,
      relief="flat",
    )
    text.grid(row=0, column=0, sticky="nsew", padx=12, pady=12)
    terms = (LEGAL_DIR / "terms.txt").read_text(encoding="utf-8") if (LEGAL_DIR / "terms.txt").exists() else "Terms and conditions apply."
    privacy = (LEGAL_DIR / "privacy.txt").read_text(encoding="utf-8") if (LEGAL_DIR / "privacy.txt").exists() else "Privacy policy applies."
    text.insert("1.0", terms + "\n\n---\n\n" + privacy)
    text.configure(state="disabled")

    checks = ctk.CTkFrame(self.content, fg_color="transparent")
    checks.grid(row=3, column=0, pady=8)

    self.terms_var = ctk.BooleanVar()
    self.privacy_var = ctk.BooleanVar()
    ctk.CTkCheckBox(checks, text="I accept the Terms and Conditions", variable=self.terms_var, font=styles.body_font(14)).pack(anchor="w", pady=4)
    ctk.CTkCheckBox(checks, text="I accept the Privacy Policy", variable=self.privacy_var, font=styles.body_font(14)).pack(anchor="w", pady=4)

    preview_frame = ctk.CTkFrame(self.content, fg_color=styles.BG_ALT, width=480, height=360)
    preview_frame.grid(row=4, column=0, pady=12)
    preview_frame.grid_propagate(False)
    self._photo_label = tk.Label(
      preview_frame,
      text="Camera preview",
      bg=styles.BG_ALT,
      fg=styles.INK_MUTED,
    )
    self._photo_label.pack(expand=True, fill="both")

    btns = ctk.CTkFrame(self.content, fg_color="transparent")
    btns.grid(row=5, column=0, pady=8)

    self.capture_btn = styles.primary_button(btns, text="Take Photo", command=self._take_photo, width=200)
    self.capture_btn.pack(side="left", padx=8)
    self.continue_btn = styles.primary_button(btns, text="Continue", command=self._continue, width=200, state="disabled")
    self.continue_btn.pack(side="left", padx=8)

    if KIOSK_DEV:
      styles.secondary_button(btns, text="Upload Photo", command=self._upload_fallback, width=160).pack(side="left", padx=8)

    self.status = ctk.CTkLabel(self.content, text="", font=styles.body_font(14), text_color=styles.INK_MUTED)
    self.status.grid(row=6, column=0)

  def on_enter(self) -> None:
    self.terms_var.set(False)
    self.privacy_var.set(False)
    self.continue_btn.configure(state="disabled")
    self._capturing = True
    ok = self._camera.start(self._on_frame)
    if not ok:
      self.status.configure(text="Camera unavailable." + (" Use Upload Photo in dev mode." if KIOSK_DEV else ""))

  def on_leave(self) -> None:
    self._capturing = False
    self._camera.stop()

  def _on_frame(self, img: Image.Image) -> None:
    if not self._capturing or not self._photo_label:
      return
    preview = img.copy()
    preview.thumbnail((460, 340), Image.Resampling.LANCZOS)
    self._tk_image = ImageTk.PhotoImage(preview)
    try:
      self._photo_label.configure(image=self._tk_image, text="")
    except Exception:
      pass

  def _take_photo(self) -> None:
    if not self.terms_var.get() or not self.privacy_var.get():
      self.status.configure(text="Please accept both policies first.")
      return
    path = self.session.session_dir / "selfie.jpg"
    if self._camera.capture_to_file(path):
      self.session.selfie_path = path
      self.continue_btn.configure(state="normal")
      self.status.configure(text="Photo captured!")
    else:
      self.status.configure(text="Could not capture. Try again or upload.")

  def _upload_fallback(self) -> None:
    path = filedialog.askopenfilename(filetypes=[("Images", "*.jpg *.jpeg *.png")])
    if not path:
      return
    dest = self.session.session_dir / "selfie.jpg"
    Image.open(path).convert("RGB").save(dest, "JPEG", quality=92)
    self.session.selfie_path = dest
    self.continue_btn.configure(state="normal")
    img = Image.open(dest)
    img.thumbnail((460, 340), Image.Resampling.LANCZOS)
    self._tk_image = ImageTk.PhotoImage(img)
    self._photo_label.configure(image=self._tk_image, text="")

  def _continue(self) -> None:
    if not self.session.selfie_path:
      self.status.configure(text="Take a photo first.")
      return
    if not self.terms_var.get() or not self.privacy_var.get():
      self.status.configure(text="Please accept both policies.")
      return
    self._on_next()
