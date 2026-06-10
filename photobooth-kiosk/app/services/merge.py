"""Composite stylized portrait onto baseball card and export final image."""

from __future__ import annotations

from pathlib import Path

from PIL import Image

from app.data.teams import TEAMS
from app.services.card_renderer import render_card, render_card_back, render_card_pair


def render_card_with_photo(
  *,
  player_name: str,
  team: str,
  position: str,
  number: str,
  stats: dict[str, str],
  portrait_path: Path | None,
  card_path: Path,
) -> Image.Image:
  colors = TEAMS.get(team, TEAMS["Padres"])
  portrait = Image.open(portrait_path).convert("RGB") if portrait_path and portrait_path.exists() else None
  img = render_card(
    player_name=player_name,
    team=team,
    colors=colors,
    position=position,
    number=number,
    stats=stats,
    player_image=portrait,
    scale=2,
  )
  card_path.parent.mkdir(parents=True, exist_ok=True)
  img.save(card_path, "PNG")
  return img


def composite_final(
  stylized_portrait: Path,
  card_path: Path,
  final_path: Path,
  *,
  player_name: str,
  team: str,
  position: str,
  number: str,
  stats: dict[str, str],
  fun_fact: str = "",
) -> Path:
  """Render a front/back baseball-card download image."""
  card = render_card_with_photo(
    player_name=player_name,
    team=team,
    position=position,
    number=number,
    stats=stats,
    portrait_path=stylized_portrait,
    card_path=card_path,
  )

  colors = TEAMS.get(team, TEAMS["Padres"])
  back = render_card_back(
    player_name=player_name,
    team=team,
    colors=colors,
    position=position,
    number=number,
    stats=stats,
    fun_fact=fun_fact,
    scale=2,
  )
  back_path = card_path.with_name("card_back.png")
  back.save(back_path, "PNG")

  canvas = render_card_pair(
    player_name=player_name,
    team=team,
    colors=colors,
    position=position,
    number=number,
    stats=stats,
    player_image=Image.open(stylized_portrait).convert("RGB"),
    fun_fact=fun_fact,
    scale=2,
  )

  final_path.parent.mkdir(parents=True, exist_ok=True)
  canvas.save(final_path, "JPEG", quality=94)

  card.save(card_path, "PNG")
  return final_path
