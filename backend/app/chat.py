from __future__ import annotations

import random

CHAT: dict[str, dict[str, list[str]]] = {
    "vrolijk": {
        "greeting": [
            "Hoi! Veel plezier!",
            "Leuk, laten we spelen!",
            "Klaar voor een potje?",
            "Ik heb er zin in!",
            "Hoi! Zet je beste beentje voor.",
        ],
        "capture": [
            "Hap! Die is van mij.",
            "Bedankt voor het stuk!",
            "Die pak ik!",
            "Materiaal, lekker.",
            "Oei, die stond in de weg.",
        ],
        "capture_pawn": ["Een pionnetje meegepikt!", "Hap! Die pion is van mij."],
        "capture_minor": ["Lekker, een stuk gewonnen!", "Die pak ik graag mee!"],
        "capture_major": ["Oeh, die toren neem ik graag!", "Grote vangst!"],
        "capture_queen": ["Wauw, je dame! Die laat ik niet liggen!", "Oeps, daar gaat je dame!"],
        "draw_declined": [
            "Nee hoor, ik wil nog even doorspelen!",
            "Nog niet! Het is net spannend.",
        ],
        "check": [
            "Schaak!",
            "Schaak! Let op je koning.",
            "Schaakje!",
            "Ho, je koning staat in de weg.",
            "Schaak, even iets oplossen.",
        ],
        "win": [
            "Yes, gewonnen! Goed gespeeld!",
            "Ik win! Rematch?",
            "Gewonnen, maar jij speelde goed!",
            "Deze is voor mij. Nog een keer?",
            "Punt voor mij! Sterk gespeeld hoor.",
        ],
        "loss": [
            "Sterk gespeeld, jij wint! Gefeliciteerd.",
            "Goed gedaan, ik heb verloren.",
            "Jij was te sterk!",
            "Verloren, en terecht. Knap gespeeld.",
            "Jij wint! Ik ga oefenen.",
        ],
        "draw": [
            "Remise! Spannend.",
            "Gelijkspel, goed gespeeld!",
            "Gelijk op. Prima partij!",
            "Eerlijk verdeeld, toch?",
            "Remise. Volgende keer beslis ik het.",
        ],
    },
    "rustig": {
        "greeting": [
            "Hallo, veel succes.",
            "Laten we een mooie partij spelen.",
            "Succes, ik ben benieuwd.",
            "Goedemiddag. Begin maar.",
            "Daar gaan we.",
        ],
        "capture": [
            "Materiaal gewonnen.",
            "Dat stuk is voor mij.",
            "Ik neem hem mee.",
            "Dank u.",
        ],
        "capture_pawn": ["Die pion pak ik terug.", "Een pionnetje erbij."],
        "capture_minor": ["Dat stuk pak ik graag.", "Materiaal gewonnen."],
        "capture_major": ["Een zwaar stuk minder voor jou.", "Die toren neem ik."],
        "capture_queen": ["De dame gaat van het bord.", "Die dame kon ik niet laten staan."],
        "draw_declined": ["Ik speel liever nog even door.", "Ik zie nog kansen, geen remise."],
        "check": [
            "Schaak.",
            "Schaak, even opletten.",
            "Schaak. Je moet iets verzinnen.",
            "Schaak, helaas voor jou.",
            "Daar zit schaak in.",
        ],
        "win": [
            "Partij gewonnen, goed gespeeld.",
            "Ik win dit keer.",
            "Deze ging mijn kant op.",
            "Winst. Tot de volgende keer.",
            "Het viel mijn kant op.",
        ],
        "loss": [
            "Netjes gespeeld, jij wint.",
            "Goed gedaan, gefeliciteerd.",
            "Jij was de betere vandaag.",
            "Terechte zege, knap hoor.",
            "Ik leg het je nog een keer uit met de stukken.",
        ],
        "draw": [
            "Remise, prima partij.",
            "Gelijkspel.",
            "Geen winnaar vandaag.",
            "Remise, en dat klopt wel.",
            "Gelijkwaardig. Goed gespeeld.",
        ],
    },
    "serieus": {
        "greeting": [
            "Succes.",
            "Laten we beginnen.",
            "Ik ben er klaar voor.",
            "Begin maar.",
            "Veel succes.",
        ],
        "capture": [
            "Materiaal.",
            "Dat stuk neem ik.",
            "Opgeruimd.",
            "Genomen.",
            "Ik houd het simpel.",
        ],
        "capture_pawn": ["Pion gewonnen.", "Opgeruimd."],
        "capture_minor": ["Stuk minder voor jou.", "Materiaal."],
        "capture_major": ["Kwaliteit telt.", "Toren van het bord."],
        "capture_queen": ["Dame gewonnen. Dit wordt lastig.", "Beslissend materiaal."],
        "draw_declined": ["Geen remise. Ik sta beter.", "We spelen door."],
        "check": [
            "Schaak.",
            "Schaak, oplossen.",
            "Let op de koning.",
            "Schaak.",
            "Je koning staat krap.",
        ],
        "win": [
            "Gewonnen. Goed gespeeld.",
            "Winst.",
            "Partij is binnen.",
            "Dat was genoeg.",
            "Winst. Volgende keer beter.",
        ],
        "loss": [
            "Jij wint. Sterk gespeeld.",
            "Gefeliciteerd, goed gespeeld.",
            "Terecht verloren.",
            "Jij was nauwkeuriger.",
            "Ik heb het weggegeven. Knap van jou.",
        ],
        "draw": [
            "Remise.",
            "Gelijkwaardig.",
            "Geen beslissing vandaag.",
            "Remise is terecht.",
            "Onbeslist.",
        ],
    },
}


def line(tone: str, event: str) -> str:
    palette = CHAT.get(tone, CHAT["rustig"])
    options = palette.get(event)
    if not options and event.startswith("capture_"):
        options = palette.get("capture")
    if not options:
        options = CHAT["rustig"]["greeting"]
    return random.choice(options)
