import { useCallback, useEffect, useRef, useState } from "react";

import { api } from "../lib/api";
import type {
  Bot,
  EvalResult,
  GameSnapshot,
  GameSummary,
  NewGameConfig,
} from "../lib/types";

export function useGame() {
  const [bots, setBots] = useState<Bot[]>([]);
  const [game, setGame] = useState<GameSnapshot | null>(null);
  const [history, setHistory] = useState<GameSummary[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<{ move: string | null; san: string | null } | null>(null);
  const [evalResult, setEvalResult] = useState<EvalResult | null>(null);
  const [stockfishAvailable, setStockfishAvailable] = useState(true);
  const gameIdRef = useRef<string | null>(null);

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

  const apply = useCallback(async (promise: Promise<GameSnapshot>) => {
    setBusy(true);
    setError(null);
    try {
      const snap = await promise;
      gameIdRef.current = snap.id;
      setGame(snap);
      setHint(null);
      setEvalResult(null);
      return snap;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return null;
    } finally {
      setBusy(false);
    }
  }, []);

  const startGame = useCallback(
    (config: NewGameConfig) => apply(api.createGame(config)),
    [apply],
  );

  const openGame = useCallback(
    (id: string) => apply(api.getGame(id)),
    [apply],
  );

  const playerMove = useCallback(
    (uci: string) => {
      const id = gameIdRef.current;
      if (!id) return Promise.resolve(null);
      return apply(api.move(id, uci));
    },
    [apply],
  );

  const undo = useCallback(() => {
    const id = gameIdRef.current;
    if (!id) return;
    void apply(api.undo(id)).then(loadHistory);
  }, [apply, loadHistory]);

  const resign = useCallback(() => {
    const id = gameIdRef.current;
    if (!id) return;
    void apply(api.resign(id)).then(loadHistory);
  }, [apply, loadHistory]);

  const offerDraw = useCallback(() => {
    const id = gameIdRef.current;
    if (!id) return;
    void apply(api.draw(id)).then(loadHistory);
  }, [apply, loadHistory]);

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
    (pgn: string, botId: string, playerColor: "white" | "black") =>
      apply(api.importPgn(pgn, botId, playerColor)),
    [apply],
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
    void loadHistory();
  }, [loadHistory]);

  return {
    bots,
    game,
    history,
    busy,
    error,
    hint,
    evalResult,
    stockfishAvailable,
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
    clearError: () => setError(null),
    loadHistory,
  };
}
