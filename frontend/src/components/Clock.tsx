import { useEffect, useRef, useState } from "react";

import { formatClock, type CapturedSummary } from "../lib/chessUtils";
import type { GameSnapshot } from "../lib/types";
import Avatar from "./Avatar";
import CapturedPieces from "./CapturedPieces";

interface ClockProps {
  game: GameSnapshot;
  captured: CapturedSummary;
  onTimeout: () => void;
}

const LOW_TIME_MS = 20_000;

export default function Clock({ game, captured, onTimeout }: ClockProps) {
  const [now, setNow] = useState(() => Date.now());
  const receivedAtRef = useRef<number>(Date.now());
  const firedRef = useRef(false);

  useEffect(() => {
    receivedAtRef.current = Date.now();
    setNow(receivedAtRef.current);
  }, [game.id, game.moves.length, game.clock.server_time, game.clock.running]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    firedRef.current = false;
  }, [game.id, game.moves.length]);

  const running = game.clock.running;
  const driftMs = running ? Math.max(0, now - receivedAtRef.current) : 0;
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

  const playerIsWhite = game.player_color === "white";
  const topColor = playerIsWhite ? "black" : "white";
  const topMs = topColor === "white" ? whiteMs : blackMs;
  const bottomMs = playerIsWhite ? whiteMs : blackMs;
  const topActive = running && game.turn === topColor;
  const bottomActive = running && game.turn !== topColor;
  const topLow = topMs <= 0 || (running && topMs <= LOW_TIME_MS);
  const bottomLow = bottomMs <= 0 || (running && bottomMs <= LOW_TIME_MS);

  const botCaptured = playerIsWhite ? captured.byBlack : captured.byWhite;
  const playerCaptured = playerIsWhite ? captured.byWhite : captured.byBlack;
  const botCapturedColor: "white" | "black" = playerIsWhite ? "white" : "black";
  const playerCapturedColor: "white" | "black" = playerIsWhite ? "black" : "white";
  const botAdvantage = playerIsWhite
    ? captured.blackValue - captured.whiteValue
    : captured.whiteValue - captured.blackValue;
  const playerAdvantage = -botAdvantage;

  return (
    <div className="clock">
      <div className={`clock-row ${topActive ? "active" : ""} ${topLow ? "low" : ""}`}>
        <Avatar name={game.bot.name} color={game.bot.color} size={32} />
        <span className="clock-name">{game.bot.name}</span>
        <CapturedPieces pieces={botCaptured} color={botCapturedColor} advantage={botAdvantage} />
        <span className="clock-time">{formatClock(topMs)}</span>
      </div>
      <div className={`clock-row ${bottomActive ? "active" : ""} ${bottomLow ? "low" : ""}`}>
        <Avatar name="Jij" color="#475569" size={32} />
        <span className="clock-name">Jij</span>
        <CapturedPieces
          pieces={playerCaptured}
          color={playerCapturedColor}
          advantage={playerAdvantage}
        />
        <span className="clock-time">{formatClock(bottomMs)}</span>
      </div>
    </div>
  );
}
