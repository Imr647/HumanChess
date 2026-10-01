import { Chess } from "chess.js";
import { useCallback, useEffect, useRef, useState } from "react";

import { api } from "../lib/api";
import type {
  Bot,
  EvalResult,
  GameSnapshot,
  GameSummary,
  NewGameConfig,
  Premove,
  ReviewResult,
} from "../lib/types";

function premoveToUci(pm: Premove): string {
  return `${pm.from}${pm.to}${pm.promotion ?? ""}`;
}

function premoveIsLegal(fen: string, pm: Premove): boolean {
  try {
    const chess = new Chess(fen);
    chess.move({ from: pm.from, to: pm.to, promotion: pm.promotion });
    return true;
  } catch {
    return false;
  }
}

export function useGame() {
  const [bots, setBots] = useState<Bot[]>([]);
  const [game, setGame] = useState<GameSnapshot | null>(null);
  const [history, setHistory] = useState<GameSummary[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<{ move: string | null; san: string | null } | null>(null);
  const [evalResult, setEvalResult] = useState<EvalResult | null>(null);
  const [stockfishAvailable, setStockfishAvailable] = useState(true);
  const [premove, setPremove] = useState<Premove | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [review, setReview] = useState<ReviewResult | null>(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const gameIdRef = useRef<string | null>(null);
  const premoveRef = useRef<Premove | null>(null);
  const noticeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    api.bots().then(setBots).catch((e) => setError(String(e.message ?? e)));
    api
      .health()
      .then((h) => setStockfishAvailable(h.stockfish_available))
      .catch(() => setStockfishAvailable(false));
  }, []);

  const loadHistory = useCallback(async () => {
    try {
      setHistory(await api.games());
    } catch {
      /* stil */
    }
  }, []);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const clearPremove = useCallback(() => {
    premoveRef.current = null;
    setPremove(null);
  }, []);

  const queuePremove = useCallback((pm: Premove) => {
    premoveRef.current = pm;
    setPremove(pm);
  }, []);

  const showNotice = useCallback((message: string) => {
    setNotice(message);
    if (noticeTimerRef.current !== null) window.clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = window.setTimeout(() => setNotice(null), 3500);
  }, []);

  const apply = useCallback(async (promise: Promise<GameSnapshot>) => {
    setBusy(true);
    setError(null);
    try {
      const snap = await promise;
      gameIdRef.current = snap.id;
      setGame(snap);
      setHint(null);
      setEvalResult(null);
      setReview(null);
      if (snap.status !== "ongoing") {
        premoveRef.current = null;
        setPremove(null);
      }
      return snap;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return null;
    } finally {
      setBusy(false);
    }
  }, []);

  const startGame = useCallback(
    (config: NewGameConfig) => {
      clearPremove();
      return apply(api.createGame(config));
    },
    [apply, clearPremove],
  );

  const openGame = useCallback(
    (id: string) => {
      clearPremove();
      return apply(api.getGame(id));
    },
    [apply, clearPremove],
  );

  const playerMove = useCallback(
    async (uci: string) => {
      const id = gameIdRef.current;
      if (!id) return null;
      let snap = await apply(api.move(id, uci));
      let guard = 0;
      while (snap && snap.status === "ongoing" && guard < 100) {
        guard += 1;
        if (!snap.player_turn) {
          snap = await apply(api.botMove(id));
          continue;
        }
        const pm = premoveRef.current;
        if (!pm) break;
        premoveRef.current = null;
        setPremove(null);
        if (!premoveIsLegal(snap.fen, pm)) {
          showNotice("Voorzet verviel: die zet is onwettig na de zet van de bot.");
          break;
        }
        snap = await apply(api.move(id, premoveToUci(pm)));
      }
      return snap;
    },
    [apply, showNotice],
  );

  const undo = useCallback(() => {
    const id = gameIdRef.current;
    if (!id) return;
    clearPremove();
    void apply(api.undo(id)).then(loadHistory);
  }, [apply, clearPremove, loadHistory]);

  const resign = useCallback(() => {
    const id = gameIdRef.current;
    if (!id) return;
    clearPremove();
    void apply(api.resign(id)).then(loadHistory);
  }, [apply, clearPremove, loadHistory]);

  const offerDraw = useCallback(() => {
    const id = gameIdRef.current;
    if (!id) return;
    clearPremove();
    void apply(api.draw(id)).then(loadHistory);
  }, [apply, clearPremove, loadHistory]);

  const getHint = useCallback(async () => {
    const id = gameIdRef.current;
    if (!id) return;
    try {
      const result = await api.hint(id);
      setHint({ move: result.best_move, san: result.best_san });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const analyse = useCallback(async () => {
    const id = gameIdRef.current;
    if (!id) return;
    setBusy(true);
    try {
      setEvalResult(await api.evaluate(id, 3));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, []);

  const runReview = useCallback(async () => {
    const id = gameIdRef.current;
    if (!id) return;
    setReviewLoading(true);
    setError(null);
    try {
      setReview(await api.review(id));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setReviewLoading(false);
    }
  }, []);

  const clearReview = useCallback(() => setReview(null), []);

  const exportPgn = useCallback(async () => {
    const id = gameIdRef.current;
    if (!id) return;
    try {
      const text = await api.pgn(id);
      await navigator.clipboard.writeText(text);
      setHint({ move: null, san: "PGN gekopieerd naar klembord" });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const importPgn = useCallback(
    (pgn: string, botId: string, playerColor: "white" | "black") => {
      clearPremove();
      return apply(api.importPgn(pgn, botId, playerColor));
    },
    [apply, clearPremove],
  );

  const refresh = useCallback(() => {
    const id = gameIdRef.current;
    if (!id) return;
    void api.getGame(id).then(setGame).catch(() => undefined);
  }, []);

  const removeGame = useCallback(
    async (id: string) => {
      try {
        await api.deleteGame(id);
      } catch {
        /* stil */
      }
      await loadHistory();
    },
    [loadHistory],
  );

  const leaveGame = useCallback(() => {
    gameIdRef.current = null;
    setGame(null);
    setHint(null);
    setEvalResult(null);
    setError(null);
    setNotice(null);
    setReview(null);
    clearPremove();
    void loadHistory();
  }, [clearPremove, loadHistory]);

  return {
    bots,
    game,
    history,
    busy,
    error,
    hint,
    evalResult,
    stockfishAvailable,
    premove,
    notice,
    review,
    reviewLoading,
    runReview,
    clearReview,
    startGame,
    openGame,
    playerMove,
    undo,
    resign,
    offerDraw,
    getHint,
    analyse,
    exportPgn,
    importPgn,
    removeGame,
    refresh,
    leaveGame,
    queuePremove,
    clearPremove,
    clearError: () => setError(null),
    loadHistory,
  };
}
