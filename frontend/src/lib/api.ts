import type {
  Bot,
  DrawResponse,
  EvalResult,
  GameSnapshot,
  GameSummary,
  NewGameConfig,
  ReviewResult,
} from "./types";

const BASE = "/api";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
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
    request<EvalResult>(`/games/${id}/eval?multipv=${multipv}`),
  review: (id: string, depth = 0) =>
    request<ReviewResult>(`/games/${id}/review?depth=${depth}`),
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
