import type {
  Bot,
  DrawResponse,
  EvalResult,
  GameSnapshot,
  GameSummary,
  NewGameConfig,
  Profile,
  ReviewResult,
} from "./types";

const BASE = "/api";

const STANDAARD_TIMEOUT = 30_000;

async function request<T>(
  path: string,
  init?: RequestInit,
  timeoutMs = STANDAARD_TIMEOUT,
): Promise<T> {
  const controller = new AbortController();
  const timer = timeoutMs > 0 ? window.setTimeout(() => controller.abort(), timeoutMs) : null;
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      ...init,
    });
  } catch (e) {
    if (timer !== null) window.clearTimeout(timer);
    if (e instanceof DOMException && e.name === "AbortError") {
      throw new Error("De schaakdienst reageert niet. Probeer het nog eens.");
    }
    throw e instanceof Error ? e : new Error(String(e));
  }
  if (timer !== null) window.clearTimeout(timer);
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail ?? detail;
    } catch {
      /* geen json */
    }
    throw new Error(detail);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  health: () => request<{ status: string; maia_device: string; stockfish_available: boolean }>("/health"),
  bots: () => request<Bot[]>("/bots"),
  profile: () => request<Profile>("/profile"),
  games: () => request<GameSummary[]>("/games"),
  createGame: (config: NewGameConfig) =>
    request<GameSnapshot>("/games", { method: "POST", body: JSON.stringify(config) }),
  getGame: (id: string) => request<GameSnapshot>(`/games/${id}`),
  move: (id: string, uci: string) =>
    request<GameSnapshot>(`/games/${id}/move`, {
      method: "POST",
      body: JSON.stringify({ uci }),
    }),
  botMove: (id: string) =>
    request<GameSnapshot>(`/games/${id}/bot-move`, { method: "POST" }),
  undo: (id: string) =>
    request<GameSnapshot>(`/games/${id}/undo`, { method: "POST" }),
  resign: (id: string) =>
    request<GameSnapshot>(`/games/${id}/resign`, { method: "POST" }),
  draw: (id: string) =>
    request<DrawResponse>(`/games/${id}/draw`, { method: "POST" }),
  hint: (id: string) =>
    request<{ best_move: string | null; best_san: string | null }>(
      `/games/${id}/hint`,
      { method: "POST" },
    ),
  evaluate: (id: string, multipv = 3) =>
    request<EvalResult>(`/games/${id}/eval?multipv=${multipv}`, undefined, 90_000),
  analyse: (fen: string, multipv = 3, depth = 0) =>
    request<EvalResult>("/analyse", {
      method: "POST",
      body: JSON.stringify({ fen, multipv, depth }),
    }),
  // De beoordeling van een lange partij mag lang duren: geen tijdslimiet.
  review: (id: string, depth = 0) =>
    request<ReviewResult>(`/games/${id}/review?depth=${depth}`, undefined, 0),
  reviewStream: (
    id: string,
    onProgress: (done: number, total: number) => void,
    depth = 0,
  ): Promise<ReviewResult> =>
    new Promise((resolve, reject) => {
      if (typeof EventSource === "undefined") {
        request<ReviewResult>(`/games/${id}/review?depth=${depth}`, undefined, 0).then(
          resolve,
          reject,
        );
        return;
      }
      const es = new EventSource(`${BASE}/games/${id}/review/stream?depth=${depth}`);
      let settled = false;
      const finish = (fn: () => void) => {
        if (settled) return;
        settled = true;
        es.close();
        fn();
      };
      es.addEventListener("progress", (ev) => {
        try {
          const data = JSON.parse((ev as MessageEvent).data) as { done: number; total: number };
          onProgress(data.done, data.total);
        } catch {
          /* stil */
        }
      });
      es.addEventListener("result", (ev) => {
        try {
          const data = JSON.parse((ev as MessageEvent).data) as ReviewResult;
          finish(() => resolve(data));
        } catch (err) {
          finish(() => reject(err));
        }
      });
      es.addEventListener("error", (ev) => {
        const msgEvent = ev as MessageEvent;
        if (msgEvent.data) {
          try {
            const body = JSON.parse(msgEvent.data) as { detail?: string };
            finish(() => reject(new Error(body.detail ?? "Analyse mislukt")));
            return;
          } catch {
            /* val terug */
          }
        }
        finish(() => reject(new Error("Verbinding met analyse-stream verbroken")));
      });
    }),
  pgn: async (id: string): Promise<string> => {
    const res = await fetch(`${BASE}/games/${id}/pgn`);
    if (!res.ok) throw new Error("Kon PGN niet ophalen");
    return res.text();
  },
  importPgn: (pgn: string, botId: string, playerColor: "white" | "black") =>
    request<GameSnapshot>("/games/import", {
      method: "POST",
      body: JSON.stringify({ pgn, bot_id: botId, player_color: playerColor }),
    }),
  deleteGame: (id: string) =>
    request<{ ok: boolean }>(`/games/${id}`, { method: "DELETE" }),
};
