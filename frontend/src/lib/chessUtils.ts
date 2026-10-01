import { Chess } from "chess.js";

import type { EvalLine, GameSnapshot, GameStatus, MoveClass } from "./types";

export const CLASS_LABELS: Record<MoveClass, string> = {
  best: "Beste",
  excellent: "Uitstekend",
  good: "Goed",
  inaccuracy: "Onnauwkeurig",
  mistake: "Fout",
  blunder: "Blunder",
};

export const CLASS_SYMBOLS: Record<MoveClass, string> = {
  best: "★",
  excellent: "!",
  good: "✓",
  inaccuracy: "?!",
  mistake: "?",
  blunder: "??",
};

export function fenAtIndex(game: GameSnapshot, index: number): string {
  const chess = new Chess(game.initial_fen ?? undefined);
  for (let i = 0; i < index && i < game.moves.length; i += 1) {
    chess.move(game.moves[i].uci);
  }
  return chess.fen();
}

export function uciAtPly(game: GameSnapshot, ply: number): string | null {
  return game.moves[ply]?.uci ?? null;
}

export function statusLabel(status: GameStatus): string {
  switch (status) {
    case "ongoing":
      return "Bezig";
    case "checkmate":
      return "Schaakmat";
    case "stalemate":
      return "Pat";
    case "draw":
      return "Remise";
    case "resigned":
      return "Opgegeven";
    case "timeout":
      return "Tijd verstreken";
  }
}

export function resultText(game: GameSnapshot): string | null {
  if (game.status === "ongoing") return null;
  if (game.result === "1-0") return "Wit wint";
  if (game.result === "0-1") return "Zwart wint";
  if (game.result === "1/2-1/2") return "Remise";
  return statusLabel(game.status);
}

export function formatClock(ms: number): string {
  const clamped = Math.max(0, ms);
  const totalSeconds = Math.floor(clamped / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (clamped < 20000) {
    const tenths = Math.floor((clamped % 1000) / 100);
    return `${minutes}:${seconds.toString().padStart(2, "0")}.${tenths}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function evalToText(line: EvalLine | undefined): string {
  if (!line) return "—";
  if (line.score.type === "mate") {
    return `#${line.score.value ?? 0}`;
  }
  const cp = line.score.value ?? 0;
  const pawns = cp / 100;
  return `${pawns >= 0 ? "+" : ""}${pawns.toFixed(2)}`;
}

export function evalToWhiteProbability(line: EvalLine | undefined): number {
  if (!line) return 0.5;
  if (line.score.type === "mate") {
    const v = line.score.value ?? 0;
    return v > 0 ? 1 : v < 0 ? 0 : 0.5;
  }
  const cp = line.score.value ?? 0;
  return 1 / (1 + 10 ** (-cp / 400));
}

export function lastMoveSquares(uci: string | null): string[] {
  if (!uci || uci.length < 4) return [];
  return [uci.slice(0, 2), uci.slice(2, 4)];
}
