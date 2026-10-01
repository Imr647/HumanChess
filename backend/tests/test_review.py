import chess

from app.review import INFINITY_CP, _comment, _terminal_score


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
