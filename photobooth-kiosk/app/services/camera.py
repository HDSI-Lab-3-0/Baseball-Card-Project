"""OpenCV camera capture for selfie preview."""

from __future__ import annotations

import threading
from pathlib import Path
from typing import Callable

import cv2
import numpy as np
from PIL import Image


class CameraService:
  def __init__(self, device_index: int = 0) -> None:
    self.device_index = device_index
    self._cap: cv2.VideoCapture | None = None
    self._running = False
    self._thread: threading.Thread | None = None
    self._latest_frame: np.ndarray | None = None
    self._lock = threading.Lock()
    self._on_frame: Callable[[Image.Image], None] | None = None

  def start(self, on_frame: Callable[[Image.Image], None]) -> bool:
    self._on_frame = on_frame
    self._cap = cv2.VideoCapture(self.device_index)
    if not self._cap.isOpened():
      self._cap = None
      return False
    self._running = True
    self._thread = threading.Thread(target=self._loop, daemon=True)
    self._thread.start()
    return True

  def _loop(self) -> None:
    while self._running and self._cap is not None:
      ret, frame = self._cap.read()
      if not ret:
        continue
      frame = cv2.flip(frame, 1)
      rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
      with self._lock:
        self._latest_frame = rgb
      if self._on_frame:
        self._on_frame(Image.fromarray(rgb))

  def capture_to_file(self, path: Path) -> bool:
    with self._lock:
      if self._latest_frame is None:
        return False
      img = Image.fromarray(self._latest_frame.copy())
    img.save(path, "JPEG", quality=92)
    return True

  def stop(self) -> None:
    self._running = False
    if self._thread:
      self._thread.join(timeout=2.0)
      self._thread = None
    if self._cap:
      self._cap.release()
      self._cap = None
