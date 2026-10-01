import { useState } from "react";

import { statusLabel } from "../lib/chessUtils";
import type { Bot, GameSummary, NewGameConfig } from "../lib/types";

interface SetupPanelProps {
  bots: Bot[];
  history: GameSummary[];
  busy: boolean;
  stockfishAvailable: boolean;
  onStart: (config: NewGameConfig) => void;
  onOpen: (id: string) => void;
  onImport: (pgn: string, botId: string, playerColor: "white" | "black") => void;
  onDelete: (id: string) => void;
}

const PRESETS: { label: string; minutes: number; increment: number }[] = [
  { label: "3 + 2", minutes: 3, increment: 2 },
  { label: "5 + 0", minutes: 5, increment: 0 },
  { label: "10 + 0", minutes: 10, increment: 0 },
  { label: "10 + 5", minutes: 10, increment: 5 },
  { label: "15 + 10", minutes: 15, increment: 10 },
];

export default function SetupPanel({
  bots,
  history,
  busy,
  stockfishAvailable,
  onStart,
  onOpen,
  onImport,
  onDelete,
}: SetupPanelProps) {
  const [botId, setBotId] = useState(bots[1]?.id ?? bots[0]?.id ?? "mo");
  const [color, setColor] = useState<"white" | "black">("white");
  const [presetIndex, setPresetIndex] = useState(2);
  const [pgn, setPgn] = useState("");
  const [tab, setTab] = useState<"new" | "import" | "history">("new");

  const start = () => {
    const preset = PRESETS[presetIndex];
    onStart({
      bot_id: botId,
      player_color: color,
      base_minutes: preset.minutes,
      increment_seconds: preset.increment,
    });
  };

  return (
    <div className="setup">
      <header className="setup-header">
        <h1>HumanChess</h1>
        <p>Schaken tegen menselijke bots, getraind op miljoenen echte partijen.</p>
        {!stockfishAvailable && (
          <p className="warn">Stockfish niet gevonden: hints en analyse zijn uit.</p>
        )}
      </header>

      <div className="tabs">
        <button className={tab === "new" ? "active" : ""} onClick={() => setTab("new")}>
          Nieuwe partij
        </button>
        <button className={tab === "import" ? "active" : ""} onClick={() => setTab("import")}>
          PGN importeren
        </button>
        <button className={tab === "history" ? "active" : ""} onClick={() => setTab("history")}>
          Geschiedenis ({history.length})
        </button>
      </div>

      {tab === "new" && (
        <div className="setup-body">
          <h2>Kies je tegenstander</h2>
          <div className="bot-grid">
            {bots.map((bot) => (
              <button
                key={bot.id}
                className={`bot-card ${bot.id === botId ? "selected" : ""}`}
                onClick={() => setBotId(bot.id)}
              >
                <span className="bot-name">{bot.name}</span>
                <span className="bot-elo">Elo {bot.elo}</span>
                <span className="bot-desc">{bot.description}</span>
              </button>
            ))}
          </div>

          <div className="setup-row">
            <label>
              Speel als
              <select value={color} onChange={(e) => setColor(e.target.value as "white" | "black")}>
                <option value="white">Wit</option>
                <option value="black">Zwart</option>
              </select>
            </label>
            <label>
              Tijd
              <select value={presetIndex} onChange={(e) => setPresetIndex(Number(e.target.value))}>
                {PRESETS.map((preset, index) => (
                  <option key={preset.label} value={index}>
                    {preset.label} min
                  </option>
                ))}
              </select>
            </label>
          </div>

          <button className="primary big" onClick={start} disabled={busy || bots.length === 0}>
            {busy ? "Bezig..." : "Start partij"}
          </button>
        </div>
      )}

      {tab === "import" && (
        <div className="setup-body">
          <h2>PGN importeren</h2>
          <p className="muted">Plak een PGN. Je speelt verder tegen de gekozen bot.</p>
          <textarea
            rows={8}
            value={pgn}
            onChange={(e) => setPgn(e.target.value)}
            placeholder="[Event ...]&#10;1. e4 e5 2. Nf3 ..."
          />
          <div className="setup-row">
            <label>
              Tegenstander
              <select value={botId} onChange={(e) => setBotId(e.target.value)}>
                {bots.map((bot) => (
                  <option key={bot.id} value={bot.id}>
                    {bot.name} ({bot.elo})
                  </option>
                ))}
              </select>
            </label>
            <label>
              Jouw kleur
              <select value={color} onChange={(e) => setColor(e.target.value as "white" | "black")}>
                <option value="white">Wit</option>
                <option value="black">Zwart</option>
              </select>
            </label>
          </div>
          <button
            className="primary"
            onClick={() => {
              if (pgn.trim()) onImport(pgn, botId, color);
            }}
            disabled={busy || !pgn.trim()}
          >
            Importeren en verder spelen
          </button>
        </div>
      )}

      {tab === "history" && (
        <div className="setup-body">
          <h2>Eerdere partijen</h2>
          {history.length === 0 && <p className="muted">Nog geen partijen gespeeld.</p>}
          <div className="history">
            {history.map((item) => (
              <div className="history-row" key={item.id}>
                <button className="history-open" onClick={() => onOpen(item.id)}>
                  <span>
                    vs {item.bot_name} ({item.bot_elo})
                  </span>
                  <span className="muted">
                    {item.player_color === "white" ? "wit" : "zwart"} · {item.move_count} zetten
                  </span>
                  <span className="history-status">
                    {statusLabel(item.status)}
                    {item.result ? ` ${item.result}` : ""}
                  </span>
                </button>
                <button className="icon" onClick={() => onDelete(item.id)} title="Verwijderen">
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
