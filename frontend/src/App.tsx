import { useMemo } from "react";
import type { Arrow } from "react-chessboard";

import Board from "./components/Board";
import Clock from "./components/Clock";
import EvalBar from "./components/EvalBar";
import GameControls from "./components/GameControls";
import MoveList from "./components/MoveList";
import SetupPanel from "./components/SetupPanel";
import { resultText, statusLabel } from "./lib/chessUtils";
import { useGame } from "./hooks/useGame";

export default function App() {
  const g = useGame();

  const arrows: Arrow[] = useMemo(() => {
    const list: Arrow[] = [];
    if (g.hint?.move) {
      list.push({
        startSquare: g.hint.move.slice(0, 2),
        endSquare: g.hint.move.slice(2, 4),
        color: "#22c55e",
      });
    }
    if (g.evalResult?.best_move) {
      list.push({
        startSquare: g.evalResult.best_move.slice(0, 2),
        endSquare: g.evalResult.best_move.slice(2, 4),
        color: "#3b82f6",
      });
    }
    return list;
  }, [g.hint, g.evalResult]);

  const errorBanner = g.error && (
    <div className="error-banner">
      <span>{g.error}</span>
      <button onClick={g.clearError}>×</button>
    </div>
  );

  if (!g.game) {
    return (
      <div className="app">
        {errorBanner}
        <SetupPanel
          bots={g.bots}
          history={g.history}
          busy={g.busy}
          stockfishAvailable={g.stockfishAvailable}
          onStart={(config) => void g.startGame(config)}
          onOpen={(id) => void g.openGame(id)}
          onImport={(pgn, botId, color) => void g.importPgn(pgn, botId, color)}
          onDelete={(id) => void g.removeGame(id)}
        />
      </div>
    );
  }

  const game = g.game;
  const ongoing = game.status === "ongoing";
  const disabled = g.busy || !game.player_turn || !ongoing;
  const statusMessage = ongoing
    ? game.player_turn
      ? "Jouw zet"
      : `${game.bot.name} denkt...`
    : `${statusLabel(game.status)} — ${resultText(game) ?? ""}`;

  return (
    <div className="app game-layout">
      {errorBanner}
      <header className="game-header">
        <div>
          <span className="vs">Jij</span>
          <span className="vs-sep">
            {game.player_color === "white" ? "(wit)" : "(zwart)"} vs
          </span>
          <span className="vs">
            {game.bot.name} ({game.bot.elo})
          </span>
        </div>
        <div className={`status-pill ${ongoing ? "" : "done"}`}>{statusMessage}</div>
      </header>

      <main className="game-main">
        <div className="board-column">
          <Board
            game={game}
            disabled={disabled}
            onMove={(uci) => void g.playerMove(uci)}
            arrows={arrows}
          />
          {g.busy && <div className="thinking">Even denken...</div>}
          {g.hint?.san && <div className="hint-line">Hint: {g.hint.san}</div>}
        </div>

        <aside className="sidebar">
          <div className="panel">
            <h3>{game.bot.name}</h3>
            <p className="muted">{game.bot.description}</p>
            <p className="bot-elo-line">Elo {game.bot.elo}</p>
          </div>

          <Clock game={game} onTimeout={g.refresh} />

          {ongoing && (
            <GameControls
              canUndo={game.can_undo}
              canHint={game.player_turn && ongoing}
              canAct={ongoing}
              stockfishAvailable={g.stockfishAvailable}
              busy={g.busy}
              onUndo={g.undo}
              onHint={() => void g.getHint()}
              onAnalyse={() => void g.analyse()}
              onResign={g.resign}
              onDraw={g.offerDraw}
              onExport={() => void g.exportPgn()}
              onNew={g.leaveGame}
            />
          )}
          {!ongoing && (
            <button className="primary" onClick={g.leaveGame}>
              Nieuwe partij
            </button>
          )}

          {g.stockfishAvailable && <EvalBar result={g.evalResult} loading={g.busy} />}

          <div className="panel grow">
            <h3>Zetten</h3>
            <MoveList moves={game.moves} />
          </div>
        </aside>
      </main>
    </div>
  );
}
