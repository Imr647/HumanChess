# HumanChess

Schaken tegen **menselijke** bots. De bots worden aangedreven door
[Maia-3](https://github.com/CSSLab/maia3), een transformer die is getraind op
miljoenen menselijke partijen van Lichess en daardoor zetten speelt die op elk
niveau op die van mensen lijken. Voor analyse en hints wordt
[Stockfish](https://stockfishchess.org/) gebruikt.

## Features

- Speel tegen benoemde bots op verschillende Elo-niveaus
- Kies je kleur en tijdsinstelling
- Zettenlijst, undo, opgeven, remise aanbieden
- Voorzetten (premove): plan je volgende zet terwijl de bot nadenkt
- Klok
- PGN importeren en exporteren
- Hint en eval-balk (Stockfish)
- CPU of AMD ROCm-GPU (experimenteel)

## Installatie

```bash
./scripts/setup.sh
```

Dit maakt een Python 3.12-venv met `uv`, installeert de backend-dependencies,
downloadt Stockfish, haalt de Maia-3 modellen op en installeert de frontend.

## Draaien

```bash
./scripts/dev.sh
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:8000/docs

## Bots

| Naam | Elo | Karakter |
|------|-----|----------|
| Pip | ~800 | rustig, maakt fouten |
| Sanne | ~1200 | clubspeler |
| Mo | ~1600 | degelijk |
| Yara | ~1900 | sterk |
| Viktor | ~2200 | expert |

## Licentie

De Maia-3 code is AGPL-3.0. Zie de respectievelijke upstream-projecten.
