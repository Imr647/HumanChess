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
  Profile,
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
  const [profile, setProfile] = useState<Profile | null>(null);
  const gameIdRef = useRef<string | null>(null);
  const premoveRef = useRef<Premove | null>(null);
  const noticeTimerRef = useRef<number | null>(null);
  const lastConfigRef = useRef<NewGameConfig | null>(null);

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

  const loadProfile = useCallback(async () => {
    try {
      setProfile(await api.profile());
    } catch {
      /* stil */
    }
  }, []);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

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
        void loadProfile();
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
      lastConfigRef.current = config;
      return apply(api.createGame(config));
    },
    [apply, clearPremove],
  );

  const rematch = useCallback(() => {
    const config = lastConfigRef.current;
    if (!config) return Promise.resolve(null);
    return startGame({
      ...config,
      player_color: config.player_color === "white" ? "black" : "white",
    });
  }, [startGame]);

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
      const snap = await apply(api.move(id, uci));
      if (snap && snap.status === "ongoing" && !snap.player_turn) {
        return apply(api.botMove(id));
      }
      return snap;
    },
    [apply],
  );

  // Verwerk een geplande voorzet zodra de speler weer aan zet is. Dit los van de
  // move-lus, zodat een voorzet die tijdens het nadenken van de bot wordt gegeven
  // niet gemist wordt of blijft hangen.
  useEffect(() => {
    if (busy || !game) return;
    if (game.status !== "ongoing" || !game.player_turn) return;
    const pm = premoveRef.current;
    if (!pm) return;
    premoveRef.current = null;
    setPremove(null);
    if (!premoveIsLegal(game.fen, pm)) {
      showNotice("Voorzet verviel: die zet is niet mogelijk na de zet van de bot.");
      return;
    }
    void playerMove(premoveToUci(pm));
  }, [game, busy, playerMove, showNotice]);

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

  const offerDraw = useCallback(async () => {
    const id = gameIdRef.current;
    if (!id) return;
    clearPremove();
    try {
      const result = await api.draw(id);
      await apply(Promise.resolve(result.game));
      if (!result.accepted) {
        showNotice("De bot slaat je remiseaanbod af.");
      } else {
        showNotice("Remise aangenomen.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
    await loadHistory();
  }, [apply, clearPremove, showNotice, loadHistory]);

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
      const naam = `humanchess-${id.slice(0, 8)}.pgn`;
      if (navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(text);
          setHint({ move: null, san: "PGN gekopieerd naar klembord" });
          return;
        } catch {
          /* kopiëren geweigerd: dan maar als bestand */
        }
      }
      const blob = new Blob([text], { type: "application/x-chess-pgn" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = naam;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setHint({ move: null, san: `PGN bewaard als ${naam}` });
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

  const analyseFen = useCallback(
    async (fen: string) => {
      if (!stockfishAvailable) return;
      try {
        setEvalResult(await api.analyse(fen, 3));
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [stockfishAvailable],
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
    profile,
    review,
    reviewLoading,
    runReview,
    analyseFen,
    clearReview,
    startGame,
    rematch,
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
