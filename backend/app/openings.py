from __future__ import annotations

import chess
import chess.polyglot

BOOK_MAX_PLY = 24

ECO_LINES: list[tuple[str, str, str]] = [
    ("C20", "Koningspionopening", "e4 e5"),
    ("C23", "Loperspel", "e4 e5 Bc4"),
    ("C24", "Loperspel: Berlijnse verdediging", "e4 e5 Bc4 Nf6 d3 c6 Nf3 d5"),
    ("C25", "Weense partij", "e4 e5 Nc3"),
    ("C29", "Weens gambiet", "e4 e5 Nc3 Nf6 f4 d5 fxe5 Nxe4"),
    ("C30", "Koningsgambiet", "e4 e5 f4"),
    ("C33", "Aangenomen koningsgambiet", "e4 e5 f4 exf4"),
    ("C37", "Koningsgambiet: Muzio/Kieseritzky", "e4 e5 f4 exf4 Nf3 g5 h4 g4 Ne5"),
    ("C40", "Koningspaardopening", "e4 e5 Nf3"),
    ("C41", "Philidorverdediging", "e4 e5 Nf3 d6 d4 Nf6 Nc3 Nbd7"),
    ("C42", "Russische partij (Petrov)", "e4 e5 Nf3 Nf6 Nxe5 d6 Nf3 Nxe4 d4 d5"),
    ("C44", "Schotse partij", "e4 e5 Nf3 Nc6 d4 exd4 Nxd4"),
    ("C45", "Schotse partij: Klassiek", "e4 e5 Nf3 Nc6 d4 exd4 Nxd4 Nf6 Nxc6 bxc6"),
    ("C46", "Driespaardenspel", "e4 e5 Nf3 Nc6 Nc3"),
    ("C47", "Vierpaardenspel", "e4 e5 Nf3 Nc6 Nc3 Nf6"),
    ("C48", "Spaans vierpaardenspel", "e4 e5 Nf3 Nc6 Nc3 Nf6 Bb5"),
    ("C50", "Italiaanse partij", "e4 e5 Nf3 Nc6 Bc4"),
    ("C53", "Italiaans: Giuoco Piano", "e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d4 exd4 cxd4 Bb4+"),
    ("C54", "Italiaans: Giuoco Pianissimo", "e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d3 d6 O-O"),
    ("C55", "Tweepaardenspel in de nahand", "e4 e5 Nf3 Nc6 Bc4 Nf6"),
    ("C57", "Tweepaardenspel: Fried Liver-aanval", "e4 e5 Nf3 Nc6 Bc4 Nf6 Ng5 d5 exd5 Nxd5"),
    ("C60", "Spaanse partij (Ruy Lopez)", "e4 e5 Nf3 Nc6 Bb5"),
    ("C65", "Spaans: Berlijnse verdediging", "e4 e5 Nf3 Nc6 Bb5 Nf6 O-O Nxe4"),
    ("C68", "Spaans: Ruilvariant", "e4 e5 Nf3 Nc6 Bb5 a6 Bxc6 dxc6"),
    ("C78", "Spaans: Morphy-verdediging", "e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O"),
    (
        "C84",
        "Spaans: Gesloten verdediging",
        "e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5 Bb3 d6 c3 O-O",
    ),
    ("B20", "Siciliaanse verdediging", "e4 c5"),
    ("B21", "Siciliaans: Smith-Morra-gambiet", "e4 c5 d4 cxd4 c3 dxc3 Nxc3"),
    ("B22", "Siciliaans: Alapin", "e4 c5 c3 Nf6 e5 Nd5 d4 cxd4 Nf3 Nc6"),
    ("B23", "Gesloten Siciliaans", "e4 c5 Nc3 Nc6 g3 g6 Bg2 Bg7 d3 d6"),
    ("B30", "Siciliaans: Rossolimo", "e4 c5 Nf3 Nc6 Bb5"),
    ("B32", "Siciliaans: Open", "e4 c5 Nf3 Nc6 d4 cxd4 Nxd4"),
    ("B33", "Siciliaans: Svesjnikov", "e4 c5 Nf3 Nc6 d4 cxd4 Nxd4 Nf6 Nc3 e5"),
    ("B35", "Siciliaans: Versnelde Draak", "e4 c5 Nf3 Nc6 d4 cxd4 Nxd4 g6"),
    ("B40", "Siciliaans: Kan / Taimanov", "e4 c5 Nf3 e6 d4 cxd4 Nxd4 Nc6"),
    ("B45", "Siciliaans: Vierpaarden", "e4 c5 Nf3 e6 d4 cxd4 Nxd4 Nf6 Nc3 Nc6"),
    ("B50", "Siciliaans: Moderne variant", "e4 c5 Nf3 d6"),
    ("B52", "Siciliaans: Moskou-variant", "e4 c5 Nf3 d6 Bb5+ Bd7 Bxd7+ Qxd7 O-O Nc6"),
    ("B70", "Siciliaans: Drakenvariant", "e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 g6"),
    ("B90", "Siciliaans: Najdorf", "e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6"),
    ("C00", "Franse verdediging", "e4 e6"),
    ("C01", "Frans: Ruilvariant", "e4 e6 d4 d5 exd5 exd5"),
    ("C02", "Frans: Doorschuifvariant", "e4 e6 d4 d5 e5 c5 c3 Nc6 Nf3"),
    ("C03", "Frans: Tarrasch", "e4 e6 d4 d5 Nd2 Nf6 e5 Nfd7 Bd3 c5"),
    ("C11", "Frans: Klassiek", "e4 e6 d4 d5 Nc3 Nf6 e5 Nfd7 f4 c5"),
    ("C15", "Frans: Winawer", "e4 e6 d4 d5 Nc3 Bb4 e5 c5 a3 Bxc3+ bxc3"),
    ("B10", "Caro-Kann", "e4 c6"),
    ("B12", "Caro-Kann: Doorschuifvariant", "e4 c6 d4 d5 e5 Bf5 Nf3 e6 Be2"),
    ("B13", "Caro-Kann: Ruilvariant", "e4 c6 d4 d5 exd5 cxd5"),
    ("B18", "Caro-Kann: Klassiek", "e4 c6 d4 d5 Nc3 dxe4 Nxe4 Bf5 Ng3 Bg6"),
    ("B01", "Scandinavische verdediging", "e4 d5 exd5 Qxd5 Nc3 Qa5 d4 Nf6 Nf3 c6"),
    ("B02", "Aljechinverdediging", "e4 Nf6 e5 Nd5 d4 d6 Nf3 dxe5 Nxe5"),
    ("B06", "Moderne verdediging", "e4 g6 d4 Bg7 Nc3 d6 Nf3 Nf6 Be2 O-O"),
    ("B07", "Pircverdediging", "e4 d6 d4 Nf6 Nc3 g6 Nf3 Bg7 Be2 O-O"),
    ("D00", "Damepionopening", "d4 d5"),
    ("D02", "Londen-systeem", "d4 d5 Nf3 Nf6 Bf4"),
    ("D00", "Londen-systeem", "d4 d5 Bf4 Nf6 e3 c5 c3 Nc6"),
    ("D06", "Damegambiet", "d4 d5 c4"),
    ("D10", "Slavische verdediging", "d4 d5 c4 c6"),
    ("D15", "Slavisch: Hoofdvariant", "d4 d5 c4 c6 Nf3 Nf6 Nc3 dxc4 a4 Bf5 e3 e6"),
    ("D20", "Aangenomen damegambiet", "d4 d5 c4 dxc4 Nf3 Nf6 e3 e6 Bxc4 c5 O-O a6"),
    ("D30", "Geweigerd damegambiet", "d4 d5 c4 e6"),
    ("D35", "Geweigerd damegambiet: Ruilvariant", "d4 d5 c4 e6 Nc3 Nf6 cxd5 exd5 Bg5 Be7"),
    ("D37", "Geweigerd damegambiet: Klassiek", "d4 d5 c4 e6 Nc3 Nf6 Nf3 Be7 Bg5 O-O e3"),
    ("D43", "Semi-Slavisch", "d4 d5 c4 c6 Nf3 Nf6 Nc3 e6 Bg5 h6"),
    ("D45", "Semi-Slavisch: Meraner", "d4 d5 c4 c6 Nf3 Nf6 Nc3 e6 e3 Nbd7 Bd3 dxc4"),
    ("A45", "Indische verdediging", "d4 Nf6"),
    ("A45", "Trompowsky-aanval", "d4 Nf6 Bg5"),
    ("A46", "Torre-aanval", "d4 Nf6 Nf3 e6 Bg5"),
    ("A57", "Benko-gambiet", "d4 Nf6 c4 c5 d5 b5 cxb5 a6 bxa6 Bxa6"),
    ("A60", "Moderne Benoni", "d4 Nf6 c4 c5 d5 e6 Nc3 exd5 cxd5 d6"),
    ("E00", "Catalaanse opening", "d4 Nf6 c4 e6 g3 d5 Bg2"),
    ("E12", "Dame-Indisch", "d4 Nf6 c4 e6 Nf3 b6 g3 Bb7 Bg2 Be7 O-O O-O"),
    ("E15", "Dame-Indisch: Ba6", "d4 Nf6 Nf3 e6 c4 b6 g3 Ba6 b3 Bb4+"),
    ("E20", "Nimzo-Indisch", "d4 Nf6 c4 e6 Nc3 Bb4"),
    ("E32", "Nimzo-Indisch: Klassiek", "d4 Nf6 c4 e6 Nc3 Bb4 Qc2 O-O"),
    ("E46", "Nimzo-Indisch: Rubinstein", "d4 Nf6 c4 e6 Nc3 Bb4 e3 O-O Bd3 d5 Nf3 c5"),
    ("E60", "Konings-Indisch", "d4 Nf6 c4 g6"),
    ("E61", "Konings-Indisch: Klassiek", "d4 Nf6 c4 g6 Nc3 Bg7 e4 d6 Nf3 O-O Be2 e5"),
    ("D85", "Grünfeld-Indisch", "d4 Nf6 c4 g6 Nc3 d5 cxd5 Nxd5 e4 Nxc3 bxc3"),
    ("A80", "Hollandse verdediging", "d4 f5 g3 Nf6 Bg2 g6 Nf3 Bg7 O-O O-O"),
    ("A04", "Réti-opening", "Nf3 d5 g3 Nf6 Bg2 e6 O-O Be7 d3 O-O"),
    ("A10", "Engelse opening", "c4"),
    ("A20", "Engels: Omgekeerd Siciliaans", "c4 e5 Nc3 Nf6 Nf3 Nc6 g3 d5 cxd5 Nxd5"),
    ("A30", "Symmetrisch Engels", "c4 c5 Nc3 Nc6 g3 g6 Bg2 Bg7"),
    ("A15", "Engels: Anglo-Indisch", "c4 Nf6 Nc3 e6 Nf3 d5 d4 Be7 Bg5 O-O"),
    ("A02", "Bird-opening", "f4 d5 Nf3 Nf6 e3 g6"),
    ("A00", "Poolse opening (Sokolsky)", "b4"),
    ("A01", "Larsen-opening", "b3 e5 Bb2 Nc6 e3"),
]


def _build_tables() -> tuple[set[int], dict[int, tuple[str, str]]]:
    hashes: set[int] = set()
    by_hash: dict[int, tuple[int, str, str]] = {}
    for eco, name, line in ECO_LINES:
        board = chess.Board()
        tokens = line.split()
        for token in tokens:
            try:
                board.push_san(token)
            except ValueError:
                break
            h = chess.polyglot.zobrist_hash(board)
            hashes.add(h)
        final_hash = chess.polyglot.zobrist_hash(board)
        depth = len(tokens)
        existing = by_hash.get(final_hash)
        if existing is None or depth >= existing[0]:
            by_hash[final_hash] = (depth, eco, name)
    exact: dict[int, tuple[str, str]] = {h: (eco, name) for h, (_, eco, name) in by_hash.items()}
    return hashes, exact


BOOK_HASHES, OPENING_BY_HASH = _build_tables()


def detect_opening(moves: list[str], initial_fen: str | None = None) -> dict[str, str] | None:
    if initial_fen is not None or not moves:
        return None
    board = chess.Board()
    matched: tuple[str, str] | None = None
    for uci in moves[:BOOK_MAX_PLY]:
        try:
            board.push(chess.Move.from_uci(uci))
        except ValueError:
            break
        hit = OPENING_BY_HASH.get(chess.polyglot.zobrist_hash(board))
        if hit is not None:
            matched = hit
    if matched is None:
        return None
    return {"eco": matched[0], "name": matched[1]}
