import { useEffect, useState } from "react";

import { statusLabel } from "../lib/chessUtils";
import type {
  Bot,
  ColorChoice,
  GameSummary,
  NewGameConfig,
  Profile,
  RatingPoint,
} from "../lib/types";
import Avatar from "./Avatar";

interface SetupPanelProps {
  bots: Bot[];
  history: GameSummary[];
  profile: Profile | null;
  busy: boolean;
  stockfishAvailable: boolean;
  onStart: (config: NewGameConfig) => void;
  onOpen: (id: string) => void;
  onImport: (pgn: string, botId: string, playerColor: "white" | "black") => void;
  onDelete: (id: string) => void;
}

const PRESETS: { label: string; minutes: number; increment: number }[] = [
  { label: "1 + 0 (bullet)", minutes: 1, increment: 0 },
  { label: "2 + 1 (bullet)", minutes: 2, increment: 1 },
  { label: "3 + 0 (blitz)", minutes: 3, increment: 0 },
  { label: "3 + 2 (blitz)", minutes: 3, increment: 2 },
  { label: "5 + 0 (blitz)", minutes: 5, increment: 0 },
  { label: "5 + 3 (blitz)", minutes: 5, increment: 3 },
  { label: "10 + 0 (rapid)", minutes: 10, increment: 0 },
  { label: "10 + 5 (rapid)", minutes: 10, increment: 5 },
  { label: "15 + 10 (rapid)", minutes: 15, increment: 10 },
  { label: "30 + 0 (klassiek)", minutes: 30, increment: 0 },
  { label: "Aangepast...", minutes: -1, increment: -1 },
];

const CUSTOM_INDEX = PRESETS.length - 1;

function RatingChart({ history }: { history: RatingPoint[] }) {
  if (history.length < 2) return null;
  const ratings = history.map((p) => p.rating);
  const minVal = Math.min(...ratings);
  const maxVal = Math.max(...ratings);
  const pad = Math.max(20, Math.round((maxVal - minVal) * 0.15));
  const lo = minVal - pad;
  const hi = maxVal + pad;
  const span = Math.max(1, hi - lo);
  const W = 280;
  const H = 64;
  const pts = history.map((p, i) => {
    const x = (i / (history.length - 1)) * (W - 8) + 4;
    const y = H - 6 - ((p.rating - lo) / span) * (H - 12);
    return { x, y, point: p };
  });
  const polyline = pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const last = history[history.length - 1];
  const deltaText = last.delta >= 0 ? `+${last.delta}` : `${last.delta}`;

  return (
    <div className="rating-chart">
      <div className="rating-chart-head">
        <span className="muted">Ratingverloop ({history.length} partijen)</span>
        <span className={`rating-delta ${last.delta >= 0 ? "up" : "down"}`}>
          Laatste: {deltaText} ({last.bot_name})
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="rating-svg" preserveAspectRatio="none">
        <polyline
          points={polyline}
          fill="none"
          stroke="#4f9cf9"
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
        />
        {pts.map((p, i) => (
          <circle
            key={`${p.point.at}-${i}`}
            cx={p.x}
            cy={p.y}
            r="2.4"
            fill={p.point.score === 1 ? "#22c55e" : p.point.score === 0 ? "#ef4444" : "#f59e0b"}
          >
            <title>
              {`${p.point.rating} (${p.point.delta >= 0 ? "+" : ""}${p.point.delta}) vs ${p.point.bot_name}`}
            </title>
          </circle>
        ))}
      </svg>
      <div className="rating-chart-foot muted">
        <span>Laagst: {minVal}</span>
        <span>Hoogst: {maxVal}</span>
      </div>
    </div>
  );
}

export default function SetupPanel({
  bots,
  history,
  profile,
  busy,
  stockfishAvailable,
  onStart,
  onOpen,
  onImport,
  onDelete,
}: SetupPanelProps) {
  const [botId, setBotId] = useState(bots[4]?.id ?? bots[0]?.id ?? "mo");
  const [color, setColor] = useState<ColorChoice>("white");
  const [importColor, setImportColor] = useState<"white" | "black">("white");
  const [presetIndex, setPresetIndex] = useState(6);
  const [customMinutes, setCustomMinutes] = useState("10");
  const [customIncrement, setCustomIncrement] = useState("0");
  const [pgn, setPgn] = useState("");
  const [tab, setTab] = useState<"new" | "import" | "history">("new");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (!confirmDeleteId) return;
    const t = window.setTimeout(() => setConfirmDeleteId(null), 3000);
    return () => window.clearTimeout(t);
  }, [confirmDeleteId]);

  const isCustom = presetIndex === CUSTOM_INDEX;

  const start = () => {
    const preset = PRESETS[presetIndex];
    const parsedMin = Number.parseFloat(customMinutes);
    const parsedInc = Number.parseFloat(customIncrement);
    onStart({
      bot_id: botId,
      player_color: color,
      base_minutes: isCustom ? Math.max(0.1, Number.isFinite(parsedMin) ? parsedMin : 10) : preset.minutes,
      increment_seconds: isCustom ? Math.max(0, Number.isFinite(parsedInc) ? parsedInc : 0) : preset.increment,
    });
  };

  const botStats = profile?.bot_stats ?? {};
  const defeatedCount = bots.filter((b) => (botStats[b.id]?.wins ?? 0) > 0).length;

  return (
    <div className="setup">
      <header className="setup-header">
        <h1>HumanChess</h1>
        <p>Schaken tegen menselijke bots, getraind op miljoenen echte partijen.</p>
        {profile && (
          <p className="setup-rating">
            Jouw rating: <strong>{profile.rating}</strong>
            <span className="muted">
              {" "}
              · {profile.wins}W / {profile.losses}L / {profile.draws}R ({profile.games} partijen)
              {bots.length > 0 ? ` · ${defeatedCount}/${bots.length} bots verslagen` : ""}
            </span>
          </p>
        )}
        {profile && <RatingChart history={profile.history} />}
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
            {bots.map((bot) => {
              const stat = botStats[bot.id];
              const defeated = (stat?.wins ?? 0) > 0;
              const played = stat ? stat.wins + stat.losses + stat.draws : 0;
              return (
                <button
                  key={bot.id}
                  className={`bot-card ${bot.id === botId ? "selected" : ""} ${defeated ? "defeated" : ""}`}
                  onClick={() => setBotId(bot.id)}
                >
                  <span className="bot-card-head">
                    <Avatar name={bot.name} color={bot.color} size={38} />
                    <span className="bot-card-meta">
                      <span className="bot-name-row">
                        <span className="bot-name">{bot.name}</span>
                        {defeated && (
                          <span className="bot-crown" title="Bot verslagen">
                            ✓
                          </span>
                        )}
                      </span>
                      <span className="bot-elo">Elo {bot.elo}</span>
                    </span>
                  </span>
                  <span className="bot-desc">{bot.description}</span>
                  {played > 0 && stat && (
                    <span className="bot-record">
                      {stat.wins}W · {stat.draws}R · {stat.losses}V
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="setup-row">
            <label>
              Speel als
              <select value={color} onChange={(e) => setColor(e.target.value as ColorChoice)}>
                <option value="white">Wit</option>
                <option value="black">Zwart</option>
                <option value="random">Willekeurig</option>
              </select>
            </label>
            <label>
              Tijd
              <select value={presetIndex} onChange={(e) => setPresetIndex(Number(e.target.value))}>
                {PRESETS.map((preset, index) => (
                  <option key={preset.label} value={index}>
                    {preset.label}
                  </option>
                ))}
              </select>
            </label>
            {isCustom && (
              <>
                <label>
                  Minuten
                  <input
                    type="number"
                    min={0.1}
                    max={180}
                    step={1}
                    value={customMinutes}
                    onChange={(e) => setCustomMinutes(e.target.value)}
                  />
                </label>
                <label>
                  Increment (sec)
                  <input
                    type="number"
                    min={0}
                    max={60}
                    step={1}
                    value={customIncrement}
                    onChange={(e) => setCustomIncrement(e.target.value)}
                  />
                </label>
              </>
            )}
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
              <select
                value={importColor}
                onChange={(e) => setImportColor(e.target.value as "white" | "black")}
              >
                <option value="white">Wit</option>
                <option value="black">Zwart</option>
              </select>
            </label>
          </div>
          <button
            className="primary"
            onClick={() => {
              if (pgn.trim()) onImport(pgn, botId, importColor);
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
            {history.map((item) => {
              const confirming = confirmDeleteId === item.id;
              return (
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
                  <button
                    className={confirming ? "danger confirm" : "icon"}
                    onClick={() => {
                      if (!confirming) {
                        setConfirmDeleteId(item.id);
                      } else {
                        setConfirmDeleteId(null);
                        onDelete(item.id);
                      }
                    }}
                    title="Verwijderen"
                  >
                    {confirming ? "Wis?" : "×"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
