import { useEffect, useMemo, useState } from "react";
import type { Arrow } from "react-chessboard";

import Board from "./components/Board";
import Clock from "./components/Clock";
import EvalBar from "./components/EvalBar";
import GameControls from "./components/GameControls";
import MoveList from "./components/MoveList";
import ReviewPanel from "./components/ReviewPanel";
import SetupPanel from "./components/SetupPanel";
import { fenAtIndex, resultText, statusLabel, uciAtPly } from "./lib/chessUtils";
import { useGame } from "./hooks/useGame";

export default function App() {
  const g = useGame();
  const [previewPly, setPreviewPly] = useState<number | null>(null);

  const gameId = g.game?.id ?? null;
  useEffect(() => {
    setPreviewPly(null);
  }, [gameId, g.review]);

  const totalPositions = g.game?.moves.length ?? 0;
  const previewing = previewPly !== null;

  useEffect(() => {
    if (!previewing) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        setPreviewPly((p) => Math.max(0, (p ?? 0) - 1));
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        setPreviewPly((p) => Math.min(totalPositions, (p ?? 0) + 1));
      } else if (event.key === "Escape") {
        setPreviewPly(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [previewing, totalPositions]);

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
    if (previewing && g.review && previewPly > 0) {
      const move = g.review.moves[previewPly - 1];
      if (
        move?.best_uci &&
        move.classification !== "best" &&
        move.classification !== "excellent"
      ) {
        list.push({
          startSquare: move.best_uci.slice(0, 2),
          endSquare: move.best_uci.slice(2, 4),
          color: "#f59e0b",
        });
      }
    }
    return list;
  }, [g.hint, g.evalResult, g.review, previewing, previewPly]);

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
  const mode: "move" | "premove" | "locked" = previewing
    ? "locked"
    : !ongoing
      ? "locked"
      : game.player_turn
        ? g.busy
          ? "locked"
          : "move"
        : "premove";
  const statusMessage = ongoing
    ? game.player_turn
      ? "Jouw zet"
      : g.premove
        ? "Voorzet gepland — wacht op de bot"
        : `${game.bot.name} denkt...`
    : `${statusLabel(game.status)} — ${resultText(game) ?? ""}`;

  const navLabel =
    previewPly === null
      ? ""
      : previewPly === 0
        ? "Beginstelling"
        : (() => {
            const move = game.moves[previewPly - 1];
            return `${move.number}${move.color === "white" ? "." : "..."} ${move.san}`;
          })();

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
          {previewing && g.review && (
            <div className="review-nav">
              <button onClick={() => setPreviewPly(0)} disabled={previewPly === 0}>
                &lt;|
              </button>
              <button
                onClick={() => setPreviewPly(Math.max(0, (previewPly ?? 0) - 1))}
                disabled={previewPly === 0}
              >
                &lt;
              </button>
              <span className="review-nav-label">{navLabel}</span>
              <button
                onClick={() => setPreviewPly(Math.min(totalPositions, (previewPly ?? 0) + 1))}
                disabled={previewPly === totalPositions}
              >
                &gt;
              </button>
              <button
                onClick={() => setPreviewPly(totalPositions)}
                disabled={previewPly === totalPositions}
              >
                |&gt;
              </button>
              <button className="ghost" onClick={() => setPreviewPly(null)}>
                Terug naar partij
              </button>
            </div>
          )}

          <Board
            game={game}
            mode={mode}
            premove={g.premove}
            onMove={(uci) => void g.playerMove(uci)}
            onPremove={g.queuePremove}
            arrows={arrows}
            fenOverride={previewing ? fenAtIndex(game, previewPly ?? 0) : null}
            lastMoveOverride={previewing ? uciAtPly(game, (previewPly ?? 0) - 1) : null}
          />
          {g.busy && !previewing && <div className="thinking">Even denken...</div>}
          {mode === "premove" && !g.premove && (
            <p className="muted premove-tip">
              Je kunt alvast je volgende zet aangeven (voorzet).
            </p>
          )}
          {g.hint?.san && <div className="hint-line">Hint: {g.hint.san}</div>}
          {g.notice && <div className="notice-line">{g.notice}</div>}
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

          {g.stockfishAvailable && game.moves.length > 0 && (
            <button
              className={g.review ? "ghost" : ""}
              disabled={g.reviewLoading}
              onClick={() => {
                if (g.review) {
                  g.clearReview();
                  setPreviewPly(null);
                } else {
                  void g.runReview();
                }
              }}
            >
              {g.reviewLoading
                ? "Partij doornemen..."
                : g.review
                  ? "Verberg analyse"
                  : "Partij doornemen"}
            </button>
          )}

          {g.stockfishAvailable && !g.review && (
            <EvalBar result={g.evalResult} loading={g.busy} />
          )}

          {g.review ? (
            <ReviewPanel
              review={g.review}
              selectedPly={previewPly}
              onSelect={(ply) => setPreviewPly(ply)}
            />
          ) : (
            <div className="panel grow">
              <h3>Zetten</h3>
              <MoveList moves={game.moves} />
            </div>
          )}
        </aside>
      </main>
    </div>
  );
}
