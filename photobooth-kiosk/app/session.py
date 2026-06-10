"""Session state and navigation enum."""

from __future__ import annotations

import json
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum, auto
from pathlib import Path
from typing import Any

from app.config import OUTPUT_DIR


class AppState(Enum):
    PAYMENT = auto()
    NAME = auto()
    CONSENT_SELFIE = auto()
    INSTRUCTIONS = auto()
    RECORDING = auto()
    STATS = auto()
    CARD_BUILDER = auto()
    PROCESSING = auto()
    QR = auto()


STATE_ORDER = list(AppState)
TOTAL_STEPS = len(STATE_ORDER)


def step_number(state: AppState) -> int:
    return STATE_ORDER.index(state) + 1


@dataclass
class SessionData:
    session_id: str = field(default_factory=lambda: uuid.uuid4().hex[:12])
    player_name: str = ""
    team: str = "UCSD Padres"
    jersey_number: str = "42"
    selfie_path: Path | None = None
    card_path: Path | None = None
    portrait_stylized_path: Path | None = None
    final_path: Path | None = None
    nickname: str = ""
    position: str = ""
    stats: dict[str, str] = field(default_factory=dict)
    fun_fact: str = ""
    used_ai_stylize: bool = False

    @property
    def session_dir(self) -> Path:
        path = OUTPUT_DIR / self.session_id
        path.mkdir(parents=True, exist_ok=True)
        return path

    def save_metadata(self) -> None:
        meta: dict[str, Any] = {
            "session_id": self.session_id,
            "player_name": self.player_name,
            "team": self.team,
            "jersey_number": self.jersey_number,
            "nickname": self.nickname,
            "position": self.position,
            "stats": self.stats,
            "fun_fact": self.fun_fact,
            "used_ai_stylize": self.used_ai_stylize,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "selfie": str(self.selfie_path) if self.selfie_path else None,
            "card": str(self.card_path) if self.card_path else None,
            "final": str(self.final_path) if self.final_path else None,
        }
        (self.session_dir / "metadata.json").write_text(
            json.dumps(meta, indent=2), encoding="utf-8"
        )

    def reset(self) -> None:
        self.session_id = uuid.uuid4().hex[:12]
        self.player_name = ""
        self.team = "UCSD Padres"
        self.jersey_number = "42"
        self.selfie_path = None
        self.card_path = None
        self.portrait_stylized_path = None
        self.final_path = None
        self.nickname = ""
        self.position = ""
        self.stats = {}
        self.fun_fact = ""
        self.used_ai_stylize = False
