import chess

from app.review import (
    INFINITY_CP,
    _brilliant,
    _cheapest_attacker,
    _comment,
    _only_move_to_keep,
    _terminal_score,
)


def _naar_mat() -> chess.Board:
    bord = chess.Board()
    for zet in ("f3", "e5", "g4", "Qh4#"):
        bord.push_san(zet)
    return bord


def test_beginstelling_heeft_geen_eindscore():
    assert _terminal_score(chess.Board()) is None


def test_schaakmat_is_oneindig_en_niet_nul():
    bord = _naar_mat()
    assert bord.is_checkmate()
    # wit staat mat, dus wit staat verloren
    assert _terminal_score(bord) == -INFINITY_CP


def test_pat_is_remise():
    bord = chess.Board("7k/5Q2/6K1/8/8/8/8/8 b - - 0 1")
    assert bord.is_stalemate()
    assert _terminal_score(bord) == 0


def test_schaakmat_zet_levert_geen_gemiste_mat_op():
    tekst = _comment("best", "Qa8#", INFINITY_CP, INFINITY_CP, 0, is_best=True)
    assert "mat liggen" not in tekst
    assert tekst == "Beste zet volgens Stockfish."


def test_beste_zet_meldt_geen_gemiste_mat_ook_als_de_mat_verzakt():
    # komt voor door dieptebeperking: Stockfish' eigen beste zet laat de mat los
    tekst = _comment("best", "Rxc4", INFINITY_CP, 1920, 0, is_best=True)
    assert "mat liggen" not in tekst
    assert tekst == "Beste zet volgens Stockfish."


def test_gewone_zet_met_gemiste_mat_meldt_het_wel():
    tekst = _comment("good", "Qd6", INFINITY_CP, 589, 0, is_best=False)
    assert "mat liggen" in tekst


def test_zet_die_de_tegenstander_mat_geeft_blijft_gemeld():
    tekst = _comment("best", "f5", 1920, -INFINITY_CP, 0, is_best=True)
    assert "tegenstander een geforceerde mat" in tekst


def test_goedkoopste_aanvaller_op_een_veld():
    bord = chess.Board("8/8/2p5/3R4/8/8/8/K6k b - - 0 1")
    assert _cheapest_attacker(bord, chess.D5) == 100  # pion c6 slaat op d5


def test_geen_aanvaller_op_een_veld():
    bord = chess.Board("8/8/2p5/3R4/8/8/8/K6k b - - 0 1")
    assert _cheapest_attacker(bord, chess.D3) is None


def test_toren_tegen_toren_is_geen_offer():
    # gelijkwaardig ruilen is geen offer
    assert not _brilliant(True, 500, 500, 0.60, 0.60)


def test_pion_weggeven_is_geen_briljante_zet():
    assert not _brilliant(True, 100, 100, 0.60, 0.60)


def test_offer_in_al_gewonnen_stelling_is_niet_briljant():
    # koningin naar een leeg veld waar een pion haar kan slaan, terwijl je al wint
    assert not _brilliant(True, 900, 100, 0.95, 0.95)


def test_offer_in_onduidelijke_stelling_is_briljant():
    assert _brilliant(True, 500, 100, 0.60, 0.55)


def test_offer_dat_de_stelling_verpest_is_niet_briljant():
    assert not _brilliant(True, 500, 100, 0.60, 0.20)


def test_niet_de_beste_zet_kan_niet_briljant_zijn():
    assert not _brilliant(False, 500, 100, 0.60, 0.55)


def test_geweldig_alleen_met_duidelijk_verval():
    assert _only_move_to_keep(True, 23.0, 0.55, False)
    assert not _only_move_to_keep(True, 4.0, 0.55, False)


def test_geweldig_niet_in_een_al_besliste_stelling():
    # 28.Kxd2 in een partij die al met 8 punten gewonnen staat
    assert not _only_move_to_keep(True, 23.0, 0.99, False)


def test_terugslaan_is_nooit_geweldig():
    assert not _only_move_to_keep(True, 30.0, 0.55, True)
