"""Pillow baseball card renderer for the photobooth kiosk."""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps

from app.data.teams import TEAMS, TeamColors

CARD_W = 320
CARD_H = 512
MAX_CARD_NAME_CHARS = 24
MAX_CARD_LABEL_CHARS = 22


def _hex_to_rgb(hex_color: str) -> tuple[int, int, int]:
  h = hex_color.lstrip("#")
  if len(h) == 8:
    h = h[:6]
  return tuple(int(h[i : i + 2], 16) for i in (0, 2, 4))


def _shade(rgb: tuple[int, int, int], amount: float) -> tuple[int, int, int]:
  return tuple(max(0, min(255, int(channel * amount))) for channel in rgb)


def _luminance(rgb: tuple[int, int, int]) -> float:
  r, g, b = [channel / 255 for channel in rgb]
  return 0.2126 * r + 0.7152 * g + 0.0722 * b


def _contrast_text(bg: tuple[int, int, int]) -> tuple[int, int, int]:
  return _hex_to_rgb("#171717") if _luminance(bg) > 0.55 else _hex_to_rgb("#F7F1E4")


def _normalize_label(text: str, fallback: str, max_chars: int, *, upper: bool = True) -> str:
  value = " ".join((text or fallback).split())
  if len(value) > max_chars:
    value = value[: max_chars - 3].rstrip() + "..."
  return value.upper() if upper else value


def _accent_for_dark(primary: tuple[int, int, int], secondary: tuple[int, int, int], accent: tuple[int, int, int]) -> tuple[int, int, int]:
  panel_luma = _luminance(_hex_to_rgb("#222321"))
  return next(
    (
      color
      for color in (secondary, primary, accent)
      if _luminance(color) > 0.24 and abs(_luminance(color) - panel_luma) > 0.2
    ),
    _hex_to_rgb("#F7F1E4"),
  )


def _rounded_rect_mask(size: tuple[int, int], radius: int) -> Image.Image:
  mask = Image.new("L", size, 0)
  draw = ImageDraw.Draw(mask)
  draw.rounded_rectangle((0, 0, size[0] - 1, size[1] - 1), radius=radius, fill=255)
  return mask


def _load_font(
  size: int,
  bold: bool = False,
  *,
  condensed: bool = False,
  italic: bool = False,
) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
  if condensed:
    candidates = [
      "/System/Library/Fonts/Supplemental/DIN Condensed Bold.ttf",
      "/System/Library/Fonts/Supplemental/Arial Narrow Bold.ttf",
      "/usr/share/fonts/truetype/dejavu/DejaVuSansCondensed-Bold.ttf",
    ]
  elif italic:
    candidates = [
      "/System/Library/Fonts/Supplemental/Arial Bold Italic.ttf",
      "/usr/share/fonts/truetype/dejavu/DejaVuSans-BoldOblique.ttf",
    ]
  elif bold:
    candidates = [
      "/System/Library/Fonts/Supplemental/Arial Black.ttf",
      "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
      "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
      "arialbd.ttf",
    ]
  else:
    candidates = [
      "/System/Library/Fonts/Supplemental/Arial.ttf",
      "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
      "arial.ttf",
    ]
  for path in candidates:
    try:
      return ImageFont.truetype(path, size)
    except OSError:
      continue
  return ImageFont.load_default()


def _fit_font(
  draw: ImageDraw.ImageDraw,
  text: str,
  max_width: int,
  size: int,
  *,
  min_size: int,
  bold: bool = False,
  condensed: bool = False,
  italic: bool = False,
) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
  while size > min_size:
    font = _load_font(size, bold=bold, condensed=condensed, italic=italic)
    if draw.textlength(text, font=font) <= max_width:
      return font
    size -= 1
  return _load_font(min_size, bold=bold, condensed=condensed, italic=italic)


def _draw_text(
  draw: ImageDraw.ImageDraw,
  xy: tuple[float, float],
  text: str,
  font: ImageFont.FreeTypeFont | ImageFont.ImageFont,
  fill: tuple[int, int, int],
  *,
  anchor: str = "la",
) -> None:
  draw.text(xy, text, fill=fill, font=font, anchor=anchor)


def _draw_card_stock(
  draw: ImageDraw.ImageDraw,
  size: tuple[int, int],
  primary: tuple[int, int, int],
  accent: tuple[int, int, int],
  scale: int,
) -> None:
  w, h = size
  paper = _hex_to_rgb("#F3EBDD")
  ink = _hex_to_rgb("#252525")
  fiber = _hex_to_rgb("#E4DAC8")
  for y in range(0, h, 5 * scale):
    draw.line((0, y, w, y), fill=fiber, width=max(1, scale))
  for x in range(3 * scale, w, 19 * scale):
    draw.line((x, 0, x, h), fill=_shade(fiber, 1.03), width=max(1, scale))
  draw.rounded_rectangle((8 * scale, 8 * scale, w - 8 * scale, h - 8 * scale), radius=9 * scale, fill=None, outline=ink, width=3 * scale)
  draw.rounded_rectangle((15 * scale, 15 * scale, w - 15 * scale, h - 15 * scale), radius=5 * scale, fill=None, outline=accent, width=max(2, 2 * scale))
  draw.line((24 * scale, h - 24 * scale, w - 24 * scale, h - 24 * scale), fill=primary, width=2 * scale)


def _paste_photo(card: Image.Image, photo: Image.Image | None, box: tuple[int, int, int, int], accent: tuple[int, int, int], scale: int) -> None:
  x1, y1, x2, y2 = box
  w, h = x2 - x1, y2 - y1
  draw = ImageDraw.Draw(card)
  draw.rounded_rectangle(box, radius=12 * scale, fill=_hex_to_rgb("#222321"), outline=_hex_to_rgb("#222321"), width=5 * scale)
  inset = 4 * scale
  inner_box = (x1 + inset, y1 + inset, x2 - inset, y2 - inset)
  draw.rounded_rectangle(inner_box, radius=8 * scale, fill=_hex_to_rgb("#DED8CA"), outline=accent, width=max(1, scale))

  if photo is None:
    return

  inner_w = inner_box[2] - inner_box[0]
  inner_h = inner_box[3] - inner_box[1]
  fitted = ImageOps.fit(
    photo.copy().convert("RGB"),
    (inner_w, inner_h),
    method=Image.Resampling.LANCZOS,
    centering=(0.5, 0.42),
  )

  mask = _rounded_rect_mask((fitted.width, fitted.height), 7 * scale)
  card.paste(fitted, (inner_box[0], inner_box[1]), mask)


def _draw_banner(
  draw: ImageDraw.ImageDraw,
  box: tuple[int, int, int, int],
  fill: tuple[int, int, int],
  outline: tuple[int, int, int],
  scale: int,
  *,
  notch: str = "right",
) -> None:
  x1, y1, x2, y2 = box
  n = 13 * scale
  if notch == "both":
    points = [(x1, y1), (x2, y1), (x2 - n, (y1 + y2) // 2), (x2, y2), (x1, y2), (x1 + n, (y1 + y2) // 2)]
  elif notch == "left":
    points = [(x1, y1), (x2, y1), (x2, y2), (x1, y2), (x1 + n, (y1 + y2) // 2)]
  else:
    points = [(x1, y1), (x2, y1), (x2 - n, (y1 + y2) // 2), (x2, y2), (x1, y2)]
  draw.polygon(points, fill=fill, outline=outline)


def _draw_baseball_icon(draw: ImageDraw.ImageDraw, center: tuple[int, int], radius: int, scale: int) -> None:
  cx, cy = center
  ink = _hex_to_rgb("#222321")
  seam = _hex_to_rgb("#B52828")
  draw.ellipse((cx - radius, cy - radius, cx + radius, cy + radius), fill=_hex_to_rgb("#F7F1E4"), outline=ink, width=3 * scale)
  draw.arc((cx - radius - 11 * scale, cy - radius, cx + 8 * scale, cy + radius), 300, 60, fill=seam, width=max(1, 2 * scale))
  draw.arc((cx - 8 * scale, cy - radius, cx + radius + 11 * scale, cy + radius), 120, 240, fill=seam, width=max(1, 2 * scale))
  for offset in range(-14 * scale, 17 * scale, 7 * scale):
    draw.line((cx - 16 * scale, cy + offset, cx - 10 * scale, cy + offset + 4 * scale), fill=seam, width=max(1, scale))
    draw.line((cx + 16 * scale, cy + offset, cx + 10 * scale, cy + offset + 4 * scale), fill=seam, width=max(1, scale))


def _draw_stat_table(
  draw: ImageDraw.ImageDraw,
  stats: dict[str, str],
  box: tuple[int, int, int, int],
  scale: int,
  accent: tuple[int, int, int],
) -> None:
  x1, y1, x2, y2 = box
  table_bg = _hex_to_rgb("#111313")
  rule = _hex_to_rgb("#D7DBD7")
  draw.rounded_rectangle(box, radius=3 * scale, fill=table_bg, outline=rule, width=max(1, scale))
  draw.rectangle((x1, y1, x2, y1 + 13 * scale), fill=rule)

  labels = list(stats.items())[:6]
  if len(labels) < 6:
    labels.extend([("", "")] * (6 - len(labels)))

  label_font = _load_font(7 * scale, bold=True)
  value_font = _load_font(9 * scale, bold=True, condensed=True)
  header_font = _load_font(7 * scale, bold=True, condensed=True)
  col_w = (x2 - x1) / 6
  for index, (key, value) in enumerate(labels):
    cx = x1 + col_w * index + col_w / 2
    key = key.upper()
    value = str(value).upper()
    _draw_text(draw, (cx, y1 + 2 * scale), key, header_font, _hex_to_rgb("#242626"), anchor="ma")
    if index:
      x = int(x1 + col_w * index)
      draw.line((x, y1 + 15 * scale, x, y2 - 3 * scale), fill=_shade(rule, 0.45), width=max(1, scale))
    _draw_text(draw, (cx, y1 + 18 * scale), value, value_font, accent, anchor="ma")


def render_card(
  *,
  player_name: str,
  team: str,
  colors: TeamColors | None = None,
  position: str = "OF",
  number: str = "00",
  stats: dict[str, str] | None = None,
  player_image: Image.Image | str | Path | None = None,
  scale: int = 1,
) -> Image.Image:
  colors = colors or TEAMS.get(team, TEAMS["Padres"])
  stats = stats or {"AVG": "---", "HR": "--", "RBI": "--", "SB": "--", "OPS": "---", "WAR": "--"}

  w, h = CARD_W * scale, CARD_H * scale
  card = Image.new("RGB", (w, h), _hex_to_rgb("#F3EBDD"))
  draw = ImageDraw.Draw(card)

  primary = _hex_to_rgb(colors.primary)
  secondary = _hex_to_rgb(colors.secondary)
  team_accent = _hex_to_rgb(colors.accent)
  bright_accent = _accent_for_dark(primary, secondary, team_accent)
  ink = _hex_to_rgb("#222321")
  white = _hex_to_rgb("#F7F1E4")

  _draw_card_stock(draw, (w, h), primary, bright_accent, scale)

  name_text = _normalize_label(player_name, "PLAYER NAME", MAX_CARD_NAME_CHARS)
  team_text = _normalize_label(team, "TEAM NAME", MAX_CARD_LABEL_CHARS)
  position_text = _normalize_label(position, "BALLPLAYER", 16)

  photo_box = (37 * scale, 84 * scale, w - 37 * scale, 386 * scale)
  photo_img: Image.Image | None = None
  if player_image is not None:
    if isinstance(player_image, (str, Path)):
      photo_img = Image.open(player_image).convert("RGB")
    else:
      photo_img = player_image.convert("RGB")
  _paste_photo(card, photo_img, photo_box, bright_accent, scale)

  banner = (58 * scale, 31 * scale, 262 * scale, 68 * scale)
  _draw_banner(draw, banner, bright_accent, ink, scale, notch="right")
  name_font = _fit_font(
    draw,
    name_text,
    166 * scale,
    19 * scale,
    min_size=12 * scale,
    bold=True,
    condensed=True,
  )
  _draw_text(draw, (160 * scale, 39 * scale), name_text, name_font, _contrast_text(bright_accent), anchor="ma")

  badge_r = 24 * scale
  bx, by = 258 * scale, 104 * scale
  draw.ellipse((bx - badge_r, by - badge_r, bx + badge_r, by + badge_r), fill=ink, outline=bright_accent, width=2 * scale)
  num_font = _fit_font(draw, str(number), 34 * scale, 22 * scale, min_size=13 * scale, bold=True, condensed=True)
  _draw_text(draw, (bx, by - 12 * scale), str(number), num_font, white, anchor="ma")

  med_r = 34 * scale
  mx, my = 160 * scale, 407 * scale
  draw.ellipse((mx - med_r, my - med_r, mx + med_r, my + med_r), fill=white, outline=ink, width=4 * scale)
  _draw_baseball_icon(draw, (mx, my), 24 * scale, scale)

  left_ribbon = (38 * scale, 430 * scale, 142 * scale, 467 * scale)
  right_ribbon = (178 * scale, 430 * scale, 282 * scale, 467 * scale)
  _draw_banner(draw, left_ribbon, bright_accent, ink, scale, notch="both")
  _draw_banner(draw, right_ribbon, bright_accent, ink, scale, notch="both")
  small_font = _fit_font(draw, position_text, 72 * scale, 10 * scale, min_size=7 * scale, bold=True, condensed=True)
  team_font = _fit_font(draw, team_text, 72 * scale, 10 * scale, min_size=7 * scale, bold=True, condensed=True)
  ribbon_ink = _contrast_text(bright_accent)
  _draw_text(draw, (90 * scale, 438 * scale), "POSITION", small_font, ribbon_ink, anchor="ma")
  _draw_text(draw, (90 * scale, 450 * scale), position_text, small_font, ribbon_ink, anchor="ma")
  _draw_text(draw, (230 * scale, 438 * scale), team_text, team_font, ribbon_ink, anchor="ma")
  _draw_text(draw, (230 * scale, 450 * scale), "TEAM", small_font, ribbon_ink, anchor="ma")

  return card


def render_card_back(
  *,
  player_name: str,
  team: str,
  colors: TeamColors | None = None,
  position: str = "OF",
  number: str = "00",
  stats: dict[str, str] | None = None,
  fun_fact: str = "",
  scale: int = 1,
) -> Image.Image:
  colors = colors or TEAMS.get(team, TEAMS["Padres"])
  stats = stats or {"AVG": "---", "HR": "--", "RBI": "--", "SB": "--", "OPS": "---", "WAR": "--"}

  w, h = CARD_W * scale, CARD_H * scale
  card = Image.new("RGB", (w, h), _hex_to_rgb("#F3EBDD"))
  draw = ImageDraw.Draw(card)

  primary = _hex_to_rgb(colors.primary)
  secondary = _hex_to_rgb(colors.secondary)
  team_accent = _hex_to_rgb(colors.accent)
  bright_accent = _accent_for_dark(primary, secondary, team_accent)
  ink = _hex_to_rgb("#222321")
  white = _hex_to_rgb("#F7F1E4")
  paper = _hex_to_rgb("#F3EBDD")

  _draw_card_stock(draw, (w, h), primary, bright_accent, scale)
  name_text = _normalize_label(player_name, "PLAYER NAME", MAX_CARD_NAME_CHARS)
  team_text = _normalize_label(team, "TEAM NAME", MAX_CARD_LABEL_CHARS)
  position_text = _normalize_label(position, "BALLPLAYER", 16)

  _draw_baseball_icon(draw, (80 * scale, 72 * scale), 40 * scale, scale)
  header_box = (126 * scale, 27 * scale, 286 * scale, 77 * scale)
  draw.rounded_rectangle(header_box, radius=9 * scale, fill=bright_accent, outline=ink, width=2 * scale)
  header_font = _fit_font(draw, team_text, 132 * scale, 16 * scale, min_size=10 * scale, bold=True, condensed=True)
  player_font = _fit_font(draw, name_text, 132 * scale, 9 * scale, min_size=7 * scale, bold=True)
  header_ink = _contrast_text(bright_accent)
  _draw_text(draw, (274 * scale, 36 * scale), team_text, header_font, header_ink, anchor="ra")
  _draw_text(draw, (274 * scale, 57 * scale), name_text, player_font, header_ink, anchor="ra")

  bio_box = (36 * scale, 118 * scale, 284 * scale, 177 * scale)
  draw.rounded_rectangle(bio_box, radius=4 * scale, fill=ink, outline=ink, width=2 * scale)
  draw.ellipse((29 * scale, 125 * scale, 83 * scale, 179 * scale), fill=bright_accent, outline=ink, width=3 * scale)
  num_font = _fit_font(draw, str(number), 35 * scale, 25 * scale, min_size=14 * scale, bold=True, condensed=True)
  _draw_text(draw, (56 * scale, 139 * scale), str(number), num_font, _contrast_text(bright_accent), anchor="ma")

  bio_label_font = _load_font(8 * scale, bold=True, condensed=True)
  bio_pos_font = _fit_font(draw, position_text, 88 * scale, 8 * scale, min_size=6 * scale, bold=True)
  bio_team_font = _fit_font(draw, team_text, 88 * scale, 8 * scale, min_size=6 * scale, bold=True)
  bio_value_font = _load_font(8 * scale, bold=True)
  _draw_text(draw, (93 * scale, 128 * scale), "POS", bio_label_font, bright_accent, anchor="la")
  _draw_text(draw, (122 * scale, 128 * scale), position_text, bio_pos_font, white, anchor="la")
  _draw_text(draw, (93 * scale, 146 * scale), "TEAM", bio_label_font, bright_accent, anchor="la")
  _draw_text(draw, (122 * scale, 146 * scale), team_text, bio_team_font, white, anchor="la")
  _draw_text(draw, (221 * scale, 128 * scale), "ROOKIE", bio_label_font, bright_accent, anchor="ma")
  _draw_text(draw, (221 * scale, 146 * scale), "R/R", bio_value_font, white, anchor="ma")

  title_font = _fit_font(draw, "PLAYER STATISTICS", 220 * scale, 20 * scale, min_size=14 * scale, bold=True, condensed=True)
  _draw_text(draw, (160 * scale, 196 * scale), "PLAYER STATISTICS", title_font, ink, anchor="ma")
  draw.line((38 * scale, 222 * scale, 282 * scale, 222 * scale), fill=ink, width=2 * scale)
  _draw_stat_table(draw, stats, (38 * scale, 232 * scale, 282 * scale, 306 * scale), scale, bright_accent)

  note_box = (38 * scale, 330 * scale, 282 * scale, 452 * scale)
  draw.rounded_rectangle(note_box, radius=6 * scale, fill=bright_accent, outline=ink, width=2 * scale)
  note = _normalize_label(fun_fact, f"{name_text} brings big league energy to every swing.", 132, upper=False)
  note_font = _load_font(12 * scale)
  words = note.split()
  lines: list[str] = []
  line = ""
  for word in words:
    candidate = f"{line} {word}".strip()
    if draw.textlength(candidate, font=note_font) <= 210 * scale:
      line = candidate
    else:
      if line:
        lines.append(line)
      line = word
  if line:
    lines.append(line)
  for index, line_text in enumerate(lines[:6]):
    _draw_text(draw, (52 * scale, (349 + index * 16) * scale), line_text, note_font, _contrast_text(bright_accent), anchor="la")

  footer_font = _load_font(7 * scale)
  _draw_text(draw, (282 * scale, 472 * scale), "BASEBALL PHOTOBOOTH SERIES", footer_font, _shade(ink, 1.7), anchor="ra")

  return card


def render_card_pair(
  *,
  player_name: str,
  team: str,
  colors: TeamColors | None = None,
  position: str = "OF",
  number: str = "00",
  stats: dict[str, str] | None = None,
  player_image: Image.Image | str | Path | None = None,
  fun_fact: str = "",
  scale: int = 1,
) -> Image.Image:
  colors = colors or TEAMS.get(team, TEAMS["Padres"])
  front = render_card(
    player_name=player_name,
    team=team,
    colors=colors,
    position=position,
    number=number,
    stats=stats,
    player_image=player_image,
    scale=scale,
  )
  back = render_card_back(
    player_name=player_name,
    team=team,
    colors=colors,
    position=position,
    number=number,
    stats=stats,
    fun_fact=fun_fact,
    scale=scale,
  )

  gap = 28 * scale
  margin = 28 * scale
  canvas_w = front.width + back.width + gap + margin * 2
  canvas_h = front.height + margin * 2
  primary = _hex_to_rgb(colors.primary)
  secondary = _hex_to_rgb(colors.secondary)
  accent = _accent_for_dark(primary, secondary, _hex_to_rgb(colors.accent))
  canvas = Image.new("RGB", (canvas_w, canvas_h), _hex_to_rgb("#EEE4D2"))
  cdraw = ImageDraw.Draw(canvas)
  for y in range(0, canvas_h, 8 * scale):
    cdraw.line((0, y, canvas_w, y), fill=_hex_to_rgb("#E2D6C2"), width=max(1, scale))
  diamond = [
    (canvas_w // 2, 42 * scale),
    (canvas_w - 54 * scale, canvas_h // 2),
    (canvas_w // 2, canvas_h - 42 * scale),
    (54 * scale, canvas_h // 2),
  ]
  cdraw.polygon(diamond, outline=secondary, fill=None)
  cdraw.line((54 * scale, canvas_h // 2, canvas_w - 54 * scale, canvas_h // 2), fill=primary, width=2 * scale)
  cdraw.line((canvas_w // 2, 42 * scale, canvas_w // 2, canvas_h - 42 * scale), fill=accent, width=2 * scale)

  for img, x in ((front, margin), (back, margin + front.width + gap)):
    shadow = Image.new("RGBA", (img.width + 12 * scale, img.height + 12 * scale), (0, 0, 0, 0))
    sdraw = ImageDraw.Draw(shadow)
    sdraw.rounded_rectangle((8 * scale, 8 * scale, shadow.width - 1, shadow.height - 1), radius=10 * scale, fill=(0, 0, 0, 60))
    canvas.paste(shadow, (x - 2 * scale, margin - 2 * scale), shadow)
    canvas.paste(img, (x, margin))

  return canvas


def save_card(path: Path, **kwargs) -> Image.Image:
  img = render_card(**kwargs, scale=2)
  path.parent.mkdir(parents=True, exist_ok=True)
  img.save(path, "PNG")
  return img
