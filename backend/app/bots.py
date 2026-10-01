from __future__ import annotations

from dataclasses import asdict, dataclass

from .config import DEFAULT_MODEL


@dataclass(frozen=True)
class BotPersona:
    id: str
    name: str
    elo: int
    description: str
    temperature: float
    top_p: float
    think_ms: int = 1200
    model: str = DEFAULT_MODEL


BOTS: list[BotPersona] = [
    BotPersona(
        id="pip",
        name="Pip",
        elo=800,
        description="Rustige beginner. Maakt vaak fouten en pakt materiaal niet altijd terug.",
        temperature=0.9,
        top_p=0.95,
        think_ms=1800,
    ),
    BotPersona(
        id="sanne",
        name="Sanne",
        elo=1200,
        description="Gezellige clubspeler. Solide openingen, wisselt soms af.",
        temperature=0.85,
        top_p=0.95,
        think_ms=1500,
    ),
    BotPersona(
        id="mo",
        name="Mo",
        elo=1600,
        description="Degelijke clubspeler. Straft blunders meestal af.",
        temperature=0.8,
        top_p=0.97,
        think_ms=1300,
    ),
    BotPersona(
        id="yara",
        name="Yara",
        elo=1900,
        description="Sterke speelster. Positioneel sterk en scherp in tactiek.",
        temperature=0.7,
        top_p=0.98,
        think_ms=1100,
    ),
    BotPersona(
        id="viktor",
        name="Viktor",
        elo=2200,
        description="Ervaren expert. Speelt nauwkeurig maar blijft menselijk.",
        temperature=0.6,
        top_p=0.99,
        think_ms=1000,
    ),
]

BOTS_BY_ID: dict[str, BotPersona] = {b.id: b for b in BOTS}


def get_bot(bot_id: str) -> BotPersona:
    try:
        return BOTS_BY_ID[bot_id]
    except KeyError:
        raise KeyError(f"Onbekende bot: {bot_id}") from None


def list_bots() -> list[dict]:
    return [asdict(b) for b in BOTS]
