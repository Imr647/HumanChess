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
    color: str = "#4f9cf9"
    model: str = DEFAULT_MODEL

    @property
    def tone(self) -> str:
        if self.elo < 1300:
            return "vrolijk"
        if self.elo < 1900:
            return "rustig"
        return "serieus"


BOTS: list[BotPersona] = [
    BotPersona(
        id="timo",
        name="Timo",
        elo=700,
        description="Absolute beginner. Ziet vaak simpele dreigingen over het hoofd.",
        temperature=0.95,
        top_p=0.95,
        think_ms=2000,
        color="#7dd3fc",
    ),
    BotPersona(
        id="pip",
        name="Pip",
        elo=900,
        description="Rustige beginner. Maakt veel fouten en pakt materiaal niet altijd terug.",
        temperature=0.9,
        top_p=0.95,
        think_ms=1800,
        color="#38bdf8",
    ),
    BotPersona(
        id="lotte",
        name="Lotte",
        elo=1100,
        description="Leergierige speelster. Kent de basis maar mist nog tactiek.",
        temperature=0.88,
        top_p=0.95,
        think_ms=1700,
        color="#60a5fa",
    ),
    BotPersona(
        id="sanne",
        name="Sanne",
        elo=1300,
        description="Gezellige clubspeler. Solide openingen, wisselt soms af.",
        temperature=0.85,
        top_p=0.95,
        think_ms=1500,
        color="#818cf8",
    ),
    BotPersona(
        id="bram",
        name="Bram",
        elo=1450,
        description="Aanvallende clubspeler. Zoekt graag de koningsaanval.",
        temperature=0.82,
        top_p=0.96,
        think_ms=1400,
        color="#a78bfa",
    ),
    BotPersona(
        id="mo",
        name="Mo",
        elo=1600,
        description="Degelijke clubspeler. Straft blunders meestal af.",
        temperature=0.8,
        top_p=0.97,
        think_ms=1300,
        color="#c084fc",
        model="maia3-23m",
    ),
    BotPersona(
        id="noor",
        name="Noor",
        elo=1750,
        description="Positioneel sterk. Bouwt rustig een overwicht op.",
        temperature=0.75,
        top_p=0.97,
        think_ms=1200,
        color="#e879f9",
        model="maia3-23m",
    ),
    BotPersona(
        id="yara",
        name="Yara",
        elo=1900,
        description="Sterke speelster. Scherp in tactiek en eindspel.",
        temperature=0.7,
        top_p=0.98,
        think_ms=1100,
        color="#f472b6",
        model="maia3-23m",
    ),
    BotPersona(
        id="daan",
        name="Daan",
        elo=2050,
        description="Ervaren toernooispeler. Kent de openingen goed.",
        temperature=0.68,
        top_p=0.98,
        think_ms=1050,
        color="#fb7185",
        model="maia3-23m",
    ),
    BotPersona(
        id="viktor",
        name="Viktor",
        elo=2200,
        description="Expert. Speelt nauwkeurig maar blijft menselijk.",
        temperature=0.6,
        top_p=0.99,
        think_ms=1000,
        color="#f97316",
        model="maia3-23m",
    ),
    BotPersona(
        id="elin",
        name="Elin",
        elo=2350,
        description="Meesteres. Nauwelijks fouten, sterke tactiek.",
        temperature=0.55,
        top_p=0.99,
        think_ms=950,
        color="#facc15",
        model="maia3-23m",
    ),
    BotPersona(
        id="max",
        name="Max",
        elo=2500,
        description="Topspeler. Speelt vrijwel foutloos.",
        temperature=0.5,
        top_p=1.0,
        think_ms=900,
        color="#22c55e",
        model="maia3-23m",
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
