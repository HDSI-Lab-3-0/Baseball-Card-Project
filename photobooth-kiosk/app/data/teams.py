"""Team color definitions — ported from src/data/teams.ts plus UCSD."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class TeamColors:
    primary: str
    secondary: str
    accent: str


TEAMS: dict[str, TeamColors] = {
    "UCSD Padres": TeamColors(primary="#182B49", secondary="#FFCD00", accent="#FFFFFF"),
    "UCSD Tritons": TeamColors(primary="#182B49", secondary="#FFCD00", accent="#C0C0C0"),
    "Dodgers": TeamColors(primary="#005A9C", secondary="#EF3E42", accent="#FFFFFF"),
    "Yankees": TeamColors(primary="#003087", secondary="#132448", accent="#C4CED4"),
    "Red Sox": TeamColors(primary="#BD3039", secondary="#0C2340", accent="#FFFFFF"),
    "Cubs": TeamColors(primary="#0E3386", secondary="#CC3433", accent="#FFFFFF"),
    "Giants": TeamColors(primary="#FD5A1E", secondary="#27251F", accent="#FFFFFF"),
    "Cardinals": TeamColors(primary="#C41E3A", secondary="#0C2340", accent="#FEDB00"),
    "Mets": TeamColors(primary="#002D72", secondary="#FF5910", accent="#FFFFFF"),
    "Braves": TeamColors(primary="#CE1141", secondary="#13274F", accent="#EAAA00"),
    "Astros": TeamColors(primary="#002D62", secondary="#EB6E1F", accent="#FFFFFF"),
    "Phillies": TeamColors(primary="#E81828", secondary="#002D72", accent="#FFFFFF"),
    "Padres": TeamColors(primary="#2F241D", secondary="#FFC425", accent="#FFFFFF"),
    "Mariners": TeamColors(primary="#0C2C56", secondary="#005C5C", accent="#C4CED4"),
    "Angels": TeamColors(primary="#BA0021", secondary="#003263", accent="#FFFFFF"),
    "White Sox": TeamColors(primary="#27251F", secondary="#C4CED4", accent="#FFFFFF"),
    "Rays": TeamColors(primary="#092C5C", secondary="#8FBCE6", accent="#F5D130"),
    "Blue Jays": TeamColors(primary="#134A8E", secondary="#1D2D5C", accent="#E8291C"),
    "Twins": TeamColors(primary="#002B5C", secondary="#D31145", accent="#FFFFFF"),
    "Tigers": TeamColors(primary="#0C2340", secondary="#FA4616", accent="#FFFFFF"),
    "Guardians": TeamColors(primary="#00385D", secondary="#E50022", accent="#FFFFFF"),
    "Royals": TeamColors(primary="#004687", secondary="#BD9B60", accent="#FFFFFF"),
    "Athletics": TeamColors(primary="#003831", secondary="#EFB21E", accent="#FFFFFF"),
    "Rangers": TeamColors(primary="#003278", secondary="#C0111F", accent="#FFFFFF"),
    "Orioles": TeamColors(primary="#DF4601", secondary="#27251F", accent="#FFFFFF"),
    "Nationals": TeamColors(primary="#AB0003", secondary="#14225A", accent="#FFFFFF"),
    "Marlins": TeamColors(primary="#00A3E0", secondary="#EF3340", accent="#000000"),
    "Brewers": TeamColors(primary="#12284B", secondary="#B6922E", accent="#FFFFFF"),
    "Reds": TeamColors(primary="#C6011F", secondary="#000000", accent="#FFFFFF"),
    "Pirates": TeamColors(primary="#27251F", secondary="#FDB827", accent="#FFFFFF"),
    "Rockies": TeamColors(primary="#33006F", secondary="#C4CED4", accent="#000000"),
    "Diamondbacks": TeamColors(primary="#A71930", secondary="#E3D4AD", accent="#000000"),
}

TEAM_NAMES = list(TEAMS.keys())
