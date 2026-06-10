"""Local HTTP server for QR download links."""

from __future__ import annotations

import socket
import threading
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from app.config import HTTP_PORT, OUTPUT_DIR


def get_lan_ip() -> str:
  try:
    with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
      s.connect(("8.8.8.8", 80))
      return s.getsockname()[0]
  except OSError:
    return "127.0.0.1"


class _QuietHandler(SimpleHTTPRequestHandler):
  def log_message(self, format: str, *args) -> None:  # noqa: A003
    pass


_server: ThreadingHTTPServer | None = None
_thread: threading.Thread | None = None


def start_output_server(directory: Path | None = None, port: int | None = None) -> int:
  global _server, _thread
  if _server is not None:
    return _server.server_address[1]

  root = directory or OUTPUT_DIR
  root.mkdir(parents=True, exist_ok=True)
  port = port or HTTP_PORT

  handler = partial(_QuietHandler, directory=str(root))
  _server = ThreadingHTTPServer(("0.0.0.0", port), handler)
  _thread = threading.Thread(target=_server.serve_forever, daemon=True)
  _thread.start()
  return port


def stop_output_server() -> None:
  global _server, _thread
  if _server:
    _server.shutdown()
    _server = None
  _thread = None


def build_download_url(session_id: str, filename: str = "final.jpg", port: int | None = None) -> str:
  port = port or HTTP_PORT
  if _server:
    port = _server.server_address[1]
  ip = get_lan_ip()
  return f"http://{ip}:{port}/{session_id}/{filename}"
