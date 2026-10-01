import { useEffect, useRef, useState } from "react";

import { formatClock } from "../lib/chessUtils";
import type { GameSnapshot } from "../lib/types";

interface ClockProps {
  game: GameSnapshot;
  onTimeout: () => void;
}

export default function Clock({ game, onTimeout }: ClockProps) {
  const [now, setNow] = useState(() => Date.now());
  const firedRef = useRef(false);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    firedRef.current = false;
  }, [game.id, game.moves.length]);

  const driftMs = game.clock.running ? now - game.clock.server_time * 1000 : 0;
  const running = game.clock.running;
  const whiteMs =
    game.clock.white_ms - (running && game.turn === "white" ? driftMs : 0);
  const blackMs =
    game.clock.black_ms - (running && game.turn === "black" ? driftMs : 0);

  useEffect(() => {
    if (!running || firedRef.current) return;
    if (whiteMs <= 0 || blackMs <= 0) {
      firedRef.current = true;
      onTimeout();
    }
  }, [whiteMs, blackMs, running, onTimeout]);

  const topColor = game.player_color === "white" ? "black" : "white";
  const topMs = topColor === "white" ? whiteMs : blackMs;
  const bottomMs = topColor === "white" ? blackMs : whiteMs;
  const topActive = running && game.turn === topColor;
  const bottomActive = running && game.turn !== topColor;

  return (
    <div className="clock">
      <div className={`clock-row ${topActive ? "active" : ""} ${topMs <= 0 ? "low" : ""}`}>
        <span>{game.bot.name}</span>
        <span className="clock-time">{formatClock(topMs)}</span>
      </div>
      <div className={`clock-row ${bottomActive ? "active" : ""} ${bottomMs <= 0 ? "low" : ""}`}>
        <span>Jij</span>
        <span className="clock-time">{formatClock(bottomMs)}</span>
      </div>
    </div>
  );
}
