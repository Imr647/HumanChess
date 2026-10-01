export type Color = "white" | "black";

export interface Bot {
  id: string;
  name: string;
  elo: number;
  description: string;
  temperature: number;
  top_p: number;
  model: string;
}

export interface MoveEntry {
  uci: string;
  san: string;
  color: Color;
  number: number;
  halfmove: number;
}

export interface GameClock {
  base_ms: number;
  increment_ms: number;
  white_ms: number;
  black_ms: number;
  running: boolean;
  server_time: number;
}

export type GameStatus =
  | "ongoing"
  | "checkmate"
  | "stalemate"
  | "draw"
  | "resigned"
  | "timeout";

export interface GameSnapshot {
  id: string;
  bot: { id: string; name: string; elo: number; description: string };
  player_color: Color;
  fen: string;
  turn: Color;
  moves: MoveEntry[];
  player_turn: boolean;
  legal_moves: string[];
  last_move: string | null;
  in_check: boolean;
  status: GameStatus;
  result: string | null;
  result_reason: string | null;
  can_undo: boolean;
  clock: GameClock;
  created_at: number;
  updated_at: number;
}

export interface GameSummary {
  id: string;
  bot_id: string;
  bot_name: string;
  bot_elo: number;
  player_color: Color;
  status: GameStatus;
  result: string | null;
  result_reason: string | null;
  move_count: number;
  created_at: number;
  updated_at: number;
}

export interface EvalLine {
  multipv: number;
  score: { type: "cp" | "mate"; value: number | null };
  move: string | null;
  san: string | null;
  pv: string[];
}

export interface EvalResult {
  fen: string;
  turn: Color;
  depth: number;
  lines: EvalLine[];
  best_move: string | null;
  best_san: string | null;
}

export interface Premove {
  from: string;
  to: string;
  promotion?: string;
}

export interface NewGameConfig {
  bot_id: string;
  player_color: Color;
  base_minutes: number;
  increment_seconds: number;
}
