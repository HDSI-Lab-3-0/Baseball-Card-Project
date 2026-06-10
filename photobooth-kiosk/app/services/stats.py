"""Random player stats generation — mirrors generate-card.ts."""

from __future__ import annotations

import random
from typing import TypedDict


class GeneratedStats(TypedDict):
    nickname: str
    position: str
    stats: dict[str, str]
    fun_fact: str


NICKNAMES = ["The Heater", "Moonshot", "Snack King", "Laser Arm", "Midnight Train"]
POSITIONS = ["Designated Vibes", "Utility Firecracker", "Ace of Snacks", "Hype Captain"]
FUN_FACTS = [
    "Carries sunflower seeds in a gold pouch.",
    "Once stole home for fun.",
    "Can juggle three bats mid-dugout.",
]


def _random_in_range(lo: int, hi: int) -> int:
    return random.randint(lo, hi)


def generate_random_stats() -> GeneratedStats:
    avg_val = 0.24 + random.random() * 0.12
    avg = f"{avg_val:.3f}".lstrip("0") or ".000"
    ops = f"{0.68 + random.random() * 0.3:.3f}"

    return {
        "nickname": random.choice(NICKNAMES),
        "position": random.choice(POSITIONS),
        "stats": {
            "AVG": avg,
            "HR": str(_random_in_range(8, 52)),
            "RBI": str(_random_in_range(20, 130)),
            "SB": str(_random_in_range(2, 60)),
            "OPS": ops,
            "WAR": f"{random.random() * 8:.1f}",
        },
        "fun_fact": random.choice(FUN_FACTS),
    }


def random_jersey_number() -> str:
    return str(_random_in_range(1, 99)).zfill(2)
