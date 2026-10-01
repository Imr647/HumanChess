from __future__ import annotations

import random

CHAT: dict[str, dict[str, list[str]]] = {
    "vrolijk": {
        "greeting": ["Hoi! Veel plezier!", "Leuk, laten we spelen!", "Klaar voor een potje?"],
        "capture": ["Hap! Die is van mij.", "Bedankt voor het stuk!", "Die pak ik!"],
        "check": ["Schaak!", "Schaak! Let op je koning.", "Schaakje!"],
        "win": [
            "Yes, gewonnen! Goed gespeeld!",
            "Ik win! Rematch?",
            "Gewonnen, maar jij speelde goed!",
        ],
        "loss": [
            "Sterk gespeeld, jij wint! Gefeliciteerd.",
            "Goed gedaan, ik heb verloren.",
            "Jij was te sterk!",
        ],
        "draw": ["Remise! Spannend.", "Gelijkspel, goed gespeeld!"],
    },
    "rustig": {
        "greeting": ["Hallo, veel succes.", "Laten we een mooie partij spelen."],
        "capture": ["Die pion pak ik terug.", "Materiaal gewonnen.", "Dat stuk is voor mij."],
        "check": ["Schaak.", "Schaak, even opletten."],
        "win": ["Partij gewonnen, goed gespeeld.", "Ik win dit keer."],
        "loss": ["Netjes gespeeld, jij wint.", "Goed gedaan, gefeliciteerd."],
        "draw": ["Remise, prima partij.", "Gelijkspel."],
    },
    "serieus": {
        "greeting": ["Succes.", "Laten we beginnen."],
        "capture": ["Materiaal.", "Dat stuk neem ik.", "Opgeruimd."],
        "check": ["Schaak.", "Schaak."],
        "win": ["Gewonnen. Goed gespeeld.", "Winst."],
        "loss": ["Jij wint. Sterk gespeeld.", "Gefeliciteerd, goed gespeeld."],
        "draw": ["Remise.", "Gelijkwaardig."],
    },
}


def line(tone: str, event: str) -> str:
    options = CHAT.get(tone, CHAT["rustig"]).get(event)
    if not options:
        options = CHAT["rustig"]["greeting"]
    return random.choice(options)
