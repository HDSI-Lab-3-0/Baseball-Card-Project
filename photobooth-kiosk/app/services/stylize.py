"""OpenRouter AI stylization with offline Pillow fallback."""

from __future__ import annotations

import base64
import re
from pathlib import Path

import numpy as np
import requests
from PIL import Image, ImageEnhance, ImageFilter, ImageOps

from app.config import (
  OPENROUTER_API_KEY,
  OPENROUTER_API_URL,
  OPENROUTER_APP_NAME,
  OPENROUTER_MODEL,
  OPENROUTER_SITE_URL,
)


def _image_to_base64(path: Path) -> tuple[str, str]:
  data = path.read_bytes()
  b64 = base64.b64encode(data).decode("ascii")
  suffix = path.suffix.lower()
  media = "image/jpeg" if suffix in (".jpg", ".jpeg") else "image/png"
  return f"data:{media};base64,{b64}", media


def _extract_image_url(completion: dict) -> str | None:
  message = completion.get("choices", [{}])[0].get("message")
  if not message:
    return None

  images = message.get("images")
  if isinstance(images, list) and images:
    return images[0].get("image_url", {}).get("url")

  content = message.get("content")
  if isinstance(content, list):
    for part in content:
      if part.get("type") == "output_image":
        return part.get("image_url", {}).get("url")
      if part.get("type") == "image_url":
        url = part.get("image_url", {}).get("url", "")
        if url.startswith("data:"):
          return url
      if part.get("type") == "image" and part.get("source", {}).get("data"):
        mt = part["source"].get("media_type", "image/png")
        return f"data:{mt};base64,{part['source']['data']}"

  if isinstance(content, str) and content.startswith("http"):
    return content
  return None


def _save_data_url(data_url: str, dest: Path) -> Path:
  if data_url.startswith("data:"):
    match = re.match(r"data:image/(\w+);base64,(.+)", data_url, re.DOTALL)
    if not match:
      raise ValueError("Invalid data URL")
    raw = base64.b64decode(match.group(2))
    dest.write_bytes(raw)
    return dest

  resp = requests.get(data_url, timeout=60)
  resp.raise_for_status()
  dest.write_bytes(resp.content)
  return dest


def stylize_portrait(
  selfie_path: Path,
  player_name: str,
  team: str,
  dest: Path,
) -> tuple[Path, bool]:
  """Returns (path, used_ai)."""
  if not OPENROUTER_API_KEY:
    fallback_stylize(selfie_path, dest)
    return dest, False

  data_url, media_type = _image_to_base64(selfie_path)
  b64_data = data_url.split(",", 1)[1]

  payload = {
    "model": OPENROUTER_MODEL,
    "messages": [
      {
        "role": "user",
        "content": [
          {"type": "image_url", "image_url": {"url": f"data:{media_type};base64,{b64_data}"}},
          {
            "type": "text",
            "text": f'''Transform this photo into a stylized vintage 1980s-90s baseball card portrait for player "{player_name}" of the {team}.

Requirements:
- Keep the person's face and features clearly recognizable - this is the most important
- Apply a classic baseball card aesthetic: warm color tones, slight soft focus, professional sports portrait lighting
- Style similar to Topps or Upper Deck cards from the late 80s/early 90s
- Portrait orientation, head and shoulders framing preferred
- Clean, slightly blurred or gradient background typical of baseball cards
- Add subtle vintage film grain or texture
- Make sure its cartoony

Generate the stylized portrait image now.''',
          },
        ],
      }
    ],
    "modalities": ["text", "image"],
  }

  headers = {
    "Content-Type": "application/json",
    "Authorization": f"Bearer {OPENROUTER_API_KEY}",
    "HTTP-Referer": OPENROUTER_SITE_URL,
    "X-Title": OPENROUTER_APP_NAME,
  }

  try:
    resp = requests.post(OPENROUTER_API_URL, headers=headers, json=payload, timeout=120)
    resp.raise_for_status()
    result = resp.json()
    image_url = _extract_image_url(result)
    if image_url:
      _save_data_url(image_url, dest)
      return dest, True
  except Exception:
    pass

  fallback_stylize(selfie_path, dest)
  return dest, False


def fallback_stylize(selfie_path: Path, dest: Path) -> Path:
  portrait = ImageOps.fit(Image.open(selfie_path).convert("RGB"), (400, 500), Image.Resampling.LANCZOS)
  portrait = ImageEnhance.Color(portrait).enhance(1.15)
  portrait = ImageEnhance.Contrast(portrait).enhance(1.08)
  portrait = ImageEnhance.Brightness(portrait).enhance(1.03)
  portrait = portrait.filter(ImageFilter.GaussianBlur(radius=0.4))

  w, h = 480, 600
  bg = Image.new("RGB", (w, h), (45, 55, 75))
  arr = np.zeros((h, w, 3), dtype=np.uint8)
  for y in range(h):
    t = y / max(h - 1, 1)
    arr[y, :] = (int(45 + 30 * t), int(55 + 25 * t), int(75 + 20 * t))
  bg = Image.fromarray(arr, "RGB")

  mask = _rounded_mask(portrait.size, 20)
  bg.paste(portrait, (40, 50), mask)

  dest.parent.mkdir(parents=True, exist_ok=True)
  bg.save(dest, "JPEG", quality=92)
  return dest


def _rounded_mask(size: tuple[int, int], radius: int) -> Image.Image:
  from PIL import ImageDraw

  mask = Image.new("L", size, 0)
  draw = ImageDraw.Draw(mask)
  draw.rounded_rectangle((0, 0, size[0] - 1, size[1] - 1), radius=radius, fill=255)
  return mask
