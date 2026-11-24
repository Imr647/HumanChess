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
  ReviewProgress,
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

function parseGameHash(): string | null {
  if (typeof window === "undefined") return null;
  const match = window.location.hash.match(/^#game\/([a-f0-9]+)$/i);
  return match ? match[1] : null;
}

function setGameHash(id: string | null) {
  if (typeof window === "undefined") return;
  const target = id ? `#game/${id}` : "";
  if (window.location.hash === target) return;
  if (id) {
    window.history.replaceState(null, "", target);
  } else {
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
  }
}

async function copyToClipboard(text: string): Promise<boolean> {
  if (window.isSecureContext && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      /* fallback */
    }
  }
  const el = document.createElement("textarea");
  el.value = text;
  el.setAttribute("readonly", "");
  el.style.position = "fixed";
  el.style.opacity = "0";
  document.body.appendChild(el);
  el.select();
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  document.body.removeChild(el);
  return ok;
}

const MAX_PREMOVES = 8;

export function useGame() {
  const [bots, setBots] = useState<Bot[]>([]);
  const [game, setGame] = useState<GameSnapshot | null>(null);
  const [history, setHistory] = useState<GameSummary[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<{ move: string | null; san: string | null } | null>(null);
  const [evalResult, setEvalResult] = useState<EvalResult | null>(null);
  const [stockfishAvailable, setStockfishAvailable] = useState(true);
  const [premoves, setPremoves] = useState<Premove[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [review, setReview] = useState<ReviewResult | null>(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewProgress, setReviewProgress] = useState<ReviewProgress | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const gameIdRef = useRef<string | null>(null);
  const gameRef = useRef<GameSnapshot | null>(null);
  const premovesRef = useRef<Premove[]>([]);
  // Eén wijziging tegelijk: zo kunnen een voorzet en een handmatige zet niet naast
  // elkaar naar de server gaan en elkaar overschrijven.
  const inFlightRef = useRef(false);
  const seqRef = useRef(0);
  // Teller die omhoog gaat zodra het slot weer vrij is, zodat een geplande voorzet
  // opnieuw bekeken wordt in plaats van te blijven liggen.
  const [lockTick, setLockTick] = useState(0);
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

  const zetVoorzetten = useCallback((lijst: Premove[]) => {
    premovesRef.current = lijst;
    setPremoves(lijst);
  }, []);

  const clearPremove = useCallback(() => zetVoorzetten([]), [zetVoorzetten]);

  const queuePremove = useCallback(
    (pm: Premove) => {
      const huidig = premovesRef.current;
      const laatste = huidig[huidig.length - 1];
      if (
        laatste &&
        laatste.from === pm.from &&
        laatste.to === pm.to &&
        (laatste.promotion ?? "") === (pm.promotion ?? "")
      ) {
        return; // dezelfde zet nog eens: niet dubbel op de stapel
      }
      zetVoorzetten([...huidig, pm].slice(-MAX_PREMOVES));
    },
    [zetVoorzetten],
  );

  const undoPremove = useCallback(() => {
    zetVoorzetten(premovesRef.current.slice(0, -1));
  }, [zetVoorzetten]);

  const showNotice = useCallback((message: string) => {
    setNotice(message);
    if (noticeTimerRef.current !== null) window.clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = window.setTimeout(() => setNotice(null), 3500);
  }, []);

  const apply = useCallback(async (promise: Promise<GameSnapshot>) => {
    const seq = ++seqRef.current;
    setBusy(true);
    setError(null);
    try {
      const snap = await promise;
      // Er is inmiddels een nieuwer verzoek onderweg: dit antwoord is achterhaald en
      // mag het bord niet meer terugzetten.
      if (seq !== seqRef.current) return null;
      gameIdRef.current = snap.id;
      gameRef.current = snap;
      setGameHash(snap.id);
      setGame(snap);
      setHint(null);
      setEvalResult(null);
      setReview(null);
      setReviewProgress(null);
      if (snap.status !== "ongoing") {
        zetVoorzetten([]);
        void loadProfile();
        void loadHistory();
      }
      return snap;
    } catch (e) {
      if (seq === seqRef.current) setError(e instanceof Error ? e.message : String(e));
      return null;
    } finally {
      if (seq === seqRef.current) setBusy(false);
    }
  }, [loadHistory, loadProfile, zetVoorzetten]);

  const metSlot = useCallback(async <T>(werk: () => Promise<T>): Promise<T | null> => {
    if (inFlightRef.current) return null;
    inFlightRef.current = true;
    try {
      return await werk();
    } finally {
      inFlightRef.current = false;
      setLockTick((n) => n + 1);
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
    const current = gameRef.current;
    const saved = lastConfigRef.current;
    const baseConfig: NewGameConfig | null = current
      ? {
          bot_id: current.bot.id,
          player_color: current.player_color === "white" ? "black" : "white",
          base_minutes: Math.max(0.1, current.clock.base_ms / 60000),
          increment_seconds: Math.max(0, current.clock.increment_ms / 1000),
        }
      : saved
        ? {
            ...saved,
            player_color: saved.player_color === "white" ? "black" : "white",
          }
        : null;
    if (!baseConfig) return Promise.resolve(null);
    return startGame(baseConfig);
  }, [startGame]);

  const openGame = useCallback(
    async (id: string) => {
      clearPremove();
      const snap = await apply(api.getGame(id));
      if (snap && snap.status === "ongoing" && !snap.player_turn) {
        return metSlot(() => apply(api.botMove(snap.id)));
      }
      return snap;
    },
    [apply, clearPremove, metSlot],
  );

  useEffect(() => {
    const initialId = parseGameHash();
    if (initialId) {
      void openGame(initialId).then((snap) => {
        if (!snap) setGameHash(null);
      });
    }
    const onHashChange = () => {
      const id = parseGameHash();
      if (!id && gameIdRef.current) {
        gameIdRef.current = null;
        gameRef.current = null;
        setGame(null);
        setReview(null);
        setHint(null);
        setEvalResult(null);
        clearPremove();
      } else if (id && id !== gameIdRef.current) {
        void openGame(id);
      }
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, [openGame, clearPremove]);

  const playerMove = useCallback(
    async (uci: string, alsVoorzet = false) => {
      const id = gameIdRef.current;
      if (!id) return null;
      if (inFlightRef.current) {
        if (!alsVoorzet) {
          showNotice("Even wachten: de vorige zet is nog bezig.");
          return null;
        }
        // Een voorzet mag even wachten tot het slot vrij is; hij mag niet vervallen
        // alleen omdat er net iets anders liep.
        const grens = Date.now() + 5000;
        while (inFlightRef.current && Date.now() < grens) {
          await new Promise((r) => window.setTimeout(r, 25));
        }
        if (inFlightRef.current) return null;
      }
      return metSlot(async () => {
        const snap = await apply(api.move(id, uci));
        if (snap && snap.status === "ongoing" && !snap.player_turn) {
          return apply(api.botMove(id));
        }
        return snap;
      });
    },
    [apply, metSlot, showNotice],
  );

  // Speel de voorzetten af zodra de speler weer aan zet is: één per beurt, en de
  // rest blijft staan voor de volgende keer. De kop wordt eerst van de stapel gehaald
  // (in de ref, niet pas in de state), zodat een tweede ronde dezelfde zet niet nog
  // eens speelt.
  const speelVoorzet = useCallback(() => {
    if (busy || !game) return;
    if (game.status !== "ongoing" || !game.player_turn) return;
    if (inFlightRef.current) return;
    const wachtrij = premovesRef.current;
    if (wachtrij.length === 0) return;
    const volgende = wachtrij[0];
    if (!premoveIsLegal(game.fen, volgende)) {
      zetVoorzetten([]);
      showNotice("Voorzet verviel: die zet kon niet meer.");
      return;
    }
    // Eerst van de stapel halen (in de ref, dus meteen), dan pas zetten: zo kan
    // dezelfde voorzet nooit twee keer gespeeld worden.
    zetVoorzetten(wachtrij.slice(1));
    void playerMove(premoveToUci(volgende), true);
  }, [busy, game, playerMove, showNotice, zetVoorzetten]);

  useEffect(() => {
    speelVoorzet();
  }, [speelVoorzet, lockTick]);

  // Vangnet voor het geval een ronde gemist wordt (traag toestel, scherm uit
  // geweest, net een zet van de bot tegelijk): elke twee seconden opnieuw kijken.
  useEffect(() => {
    const id = window.setInterval(speelVoorzet, 2000);
    return () => window.clearInterval(id);
  }, [speelVoorzet]);

  // Terug uit de achtergrond: meteen weer kijken.
  useEffect(() => {
    const bijZicht = () => {
      if (document.visibilityState === "visible") setLockTick((n) => n + 1);
    };
    document.addEventListener("visibilitychange", bijZicht);
    return () => document.removeEventListener("visibilitychange", bijZicht);
  }, []);

  const undo = useCallback(() => {
    const id = gameIdRef.current;
    if (!id) return;
    clearPremove();
    void metSlot(async () => {
      const snap = await apply(api.undo(id));
      await loadHistory();
      return snap;
    });
  }, [apply, clearPremove, loadHistory, metSlot]);

  const resign = useCallback(() => {
    const id = gameIdRef.current;
    if (!id) return;
    clearPremove();
    void metSlot(async () => {
      const snap = await apply(api.resign(id));
      await loadHistory();
      return snap;
    });
  }, [apply, clearPremove, loadHistory, metSlot]);

  const offerDraw = useCallback(async () => {
    const id = gameIdRef.current;
    if (!id) return;
    clearPremove();
    await metSlot(async () => {
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
      return null;
    });
  }, [apply, clearPremove, showNotice, loadHistory, metSlot]);

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
    setReviewProgress(null);
    setError(null);
    try {
      const data = await api.reviewStream(id, (done, total) => {
        setReviewProgress({ done, total });
      });
      setReview(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setReviewLoading(false);
      setReviewProgress(null);
    }
  }, []);

  const clearReview = useCallback(() => setReview(null), []);

  const triggerDownload = (text: string, id: string) => {
    const botName = gameRef.current?.bot.id ?? "partij";
    const naam = `humanchess-${botName}-${id.slice(0, 6)}.pgn`;
    const blob = new Blob([text], { type: "application/x-chess-pgn;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = naam;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    return naam;
  };

  const exportPgn = useCallback(async () => {
    const id = gameIdRef.current;
    if (!id) return;
    try {
      const text = await api.pgn(id);
      if (await copyToClipboard(text)) {
        showNotice("PGN gekopieerd naar klembord.");
        return;
      }
      const naam = triggerDownload(text, id);
      showNotice(`PGN bewaard als ${naam}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [showNotice]);

  const downloadPgn = useCallback(async () => {
    const id = gameIdRef.current;
    if (!id) return;
    try {
      const text = await api.pgn(id);
      const naam = triggerDownload(text, id);
      showNotice(`PGN bewaard als ${naam}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [showNotice]);

  const importPgn = useCallback(
    async (pgn: string, botId: string, playerColor: "white" | "black") => {
      clearPremove();
      const snap = await apply(api.importPgn(pgn, botId, playerColor));
      if (snap && snap.status === "ongoing" && !snap.player_turn) {
        return metSlot(() => apply(api.botMove(snap.id)));
      }
      return snap;
    },
    [apply, clearPremove, metSlot],
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

  // Alleen verversen als er niets onderweg is: een oudere lezing mag een zet die net
  // gedaan is niet overschrijven (dat gaf het bord een terugspringend beeld).
  const refresh = useCallback(() => {
    const id = gameIdRef.current;
    if (!id || inFlightRef.current) return;
    void api
      .getGame(id)
      .then((snap) => {
        if (inFlightRef.current || snap.id !== gameIdRef.current) return;
        gameRef.current = snap;
        setGame(snap);
        if (snap.status !== "ongoing") {
          clearPremove();
          void loadProfile();
          void loadHistory();
        }
      })
      .catch(() => undefined);
  }, [clearPremove, loadHistory, loadProfile]);

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
    gameRef.current = null;
    setGameHash(null);
    setGame(null);
    setHint(null);
    setEvalResult(null);
    setError(null);
    setNotice(null);
    setReview(null);
    setReviewProgress(null);
    clearPremove();
    void loadHistory();
    void loadProfile();
  }, [clearPremove, loadHistory, loadProfile]);

  return {
    bots,
    game,
    history,
    busy,
    error,
    hint,
    evalResult,
    stockfishAvailable,
    premoves,
    notice,
    profile,
    review,
    reviewLoading,
    reviewProgress,
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
    downloadPgn,
    importPgn,
    removeGame,
    refresh,
    leaveGame,
    queuePremove,
    undoPremove,
    clearPremove,
    clearError: () => setError(null),
    loadHistory,
  };
}
