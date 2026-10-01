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
  const [profile, setProfile] = useState<Profile | null>(null);
  const gameIdRef = useRef<string | null>(null);
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
      setGame(snap);
      setHint(null);
      setEvalResult(null);
      setReview(null);
      if (snap.status !== "ongoing") {
        zetVoorzetten([]);
        void loadProfile();
      }
      return snap;
    } catch (e) {
      if (seq === seqRef.current) setError(e instanceof Error ? e.message : String(e));
      return null;
    } finally {
      if (seq === seqRef.current) setBusy(false);
    }
  }, [loadProfile, zetVoorzetten]);

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

  // Alleen verversen als er niets onderweg is: een oudere lezing mag een zet die net
  // gedaan is niet overschrijven (dat gaf het bord een terugspringend beeld).
  const refresh = useCallback(() => {
    const id = gameIdRef.current;
    if (!id || inFlightRef.current) return;
    void api
      .getGame(id)
      .then((snap) => {
        if (inFlightRef.current || snap.id !== gameIdRef.current) return;
        setGame(snap);
      })
      .catch(() => undefined);
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
    premoves,
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
    undoPremove,
    clearPremove,
    clearError: () => setError(null),
    loadHistory,
  };
}
