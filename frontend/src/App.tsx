import { useEffect, useMemo, useRef, useState } from "react";
import type { Arrow } from "react-chessboard";

import AnalysisNav from "./components/AnalysisNav";
import Avatar from "./components/Avatar";
import Board from "./components/Board";
import ChatFeed from "./components/ChatFeed";
import Clock from "./components/Clock";
import EvalBar from "./components/EvalBar";
import GameControls from "./components/GameControls";
import MoveList from "./components/MoveList";
import ReviewPanel from "./components/ReviewPanel";
import SetupPanel from "./components/SetupPanel";
import {
  CLASS_LABELS,
  CLASS_SYMBOLS,
  applyFreeMove,
  capturedUpTo,
  fenAtIndex,
  hasLegalMoves,
  resultText,
  statusLabel,
  uciAtPly,
} from "./lib/chessUtils";
import { sounds } from "./lib/sounds";
import { useGame } from "./hooks/useGame";

export default function App() {
  const g = useGame();
  const [previewPly, setPreviewPly] = useState<number | null>(null);
  const [flipped, setFlipped] = useState(false);
  const [showCoords, setShowCoords] = useState(true);
  const [muted, setMuted] = useState(false);
  const [free, setFree] = useState<{ base: string; fen: string; moves: string[] } | null>(null);
  const prevRef = useRef<{ moves: number; status: string }>({ moves: 0, status: "none" });

  useEffect(() => {
    setMuted(sounds.load());
  }, []);

  const gameId = g.game?.id ?? null;
  useEffect(() => {
    setPreviewPly(null);
    setFree(null);
  }, [gameId, g.review]);

  const totalPositions = g.game?.moves.length ?? 0;
  const previewing = previewPly !== null;

  useEffect(() => {
    const game = g.game;
    if (!game) {
      prevRef.current = { moves: 0, status: "none" };
      return;
    }
    const prev = prevRef.current;
    const isNewMove = game.moves.length > prev.moves;
    if (isNewMove) {
      const last = game.moves[game.moves.length - 1];
      if (game.status !== "ongoing") sounds.end();
      else if (game.in_check) sounds.check();
      else if (last?.san.includes("x")) sounds.capture();
      else sounds.move();
    } else if (game.status !== prev.status && game.status !== "ongoing") {
      sounds.end();
    }
    prevRef.current = { moves: game.moves.length, status: game.status };
  }, [g.game]);

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

  const badges = useMemo(() => {
    const map: Record<string, { symbol: string; cls: string; big: boolean }> = {};
    if (!g.review) return map;
    if (previewPly !== null) {
      if (previewPly === 0) return map;
      const move = g.review.moves[previewPly - 1];
      if (move) {
        map[move.uci.slice(2, 4)] = {
          symbol: CLASS_SYMBOLS[move.classification],
          cls: move.classification,
          big: true,
        };
      }
      return map;
    }
    for (const move of g.review.moves) {
      map[move.uci.slice(2, 4)] = {
        symbol: CLASS_SYMBOLS[move.classification],
        cls: move.classification,
        big: false,
      };
    }
    return map;
  }, [g.review, previewPly]);

  const selectedMove =
    g.review && previewPly !== null && previewPly > 0
      ? g.review.moves[previewPly - 1]
      : null;

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
          profile={g.profile}
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
  const orientation: "white" | "black" = flipped
    ? game.player_color === "white"
      ? "black"
      : "white"
    : game.player_color;
  const captured = capturedUpTo(game, previewing ? previewPly ?? 0 : game.moves.length);
  const mode: "move" | "premove" | "locked" = free
    ? "move"
    : previewing
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
      : g.premoves.length > 0
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

  const freeDisplayFen = free ? free.fen : null;

  // Op de classificatie sorteren en niet op cp_loss: bij matstellingen loopt dat
  // verlies op tot tienduizenden centipawns, waardoor een winnende zet als de
  // grootste fout uit de bus kwam.
  const eigenFout = (() => {
    if (!g.review) return null;
    const ernst: Record<string, number> = {
      blunder: 4,
      miss: 3,
      mistake: 2,
      inaccuracy: 1,
    };
    const kandidaten = g.review.moves.filter(
      (m) => m.color === game.player_color && (ernst[m.classification] ?? 0) > 0,
    );
    kandidaten.sort(
      (a, b) =>
        (ernst[b.classification] ?? 0) - (ernst[a.classification] ?? 0) || b.win_drop - a.win_drop,
    );
    return kandidaten[0] ?? null;
  })();

  const startFree = () => {
    let plek = previewing ? previewPly ?? 0 : game.moves.length;
    let fen = fenAtIndex(game, plek);
    while (plek > 0 && !hasLegalMoves(fen)) {
      plek -= 1;
      fen = fenAtIndex(game, plek);
    }
    setFree({ base: fen, fen, moves: [] });
    void g.analyseFen(fen);
  };

  const replayFree = (base: string, moves: string[]) => {
    let fen = base;
    for (const uci of moves) {
      const next = applyFreeMove(fen, uci);
      if (!next) break;
      fen = next.fen;
    }
    return fen;
  };

  const playFree = (uci: string) => {
    if (!free) return;
    const next = applyFreeMove(free.fen, uci);
    if (!next) return;
    setFree({ base: free.base, fen: next.fen, moves: [...free.moves, uci] });
    void g.analyseFen(next.fen);
  };

  const undoFree = () => {
    if (!free || free.moves.length === 0) return;
    const moves = free.moves.slice(0, -1);
    const fen = replayFree(free.base, moves);
    setFree({ base: free.base, fen, moves });
    void g.analyseFen(fen);
  };

  return (
    <div className="app game-layout">
      {errorBanner}
      <header className="game-header">
        <div className="header-players">
          <Avatar name={game.bot.name} color={game.bot.color} size={34} />
          <span className="vs">{game.bot.name} ({game.bot.elo})</span>
          <span className="vs-sep">vs</span>
          <Avatar name="Jij" color="#475569" size={34} />
          <span className="vs">
            Jij ({game.player_color === "white" ? "wit" : "zwart"})
            {g.profile ? ` · ${g.profile.rating}` : ""}
          </span>
        </div>
        <div className={`status-pill ${ongoing ? "" : "done"}`}>{statusMessage}</div>
      </header>
      {game.assisted && (
        <div className="practice-note">Oefenpartij — telt niet mee voor je rating</div>
      )}

      <main className="game-main">
        <div className={g.review ? "board-column heeft-analyse" : "board-column"}>
          <div className="board-toolbar">
            <button onClick={() => setFlipped((v) => !v)}>Draai bord</button>
            {!free && g.premoves.length > 0 && (
              <button className="ghost" onClick={g.undoPremove}>
                Laatste voorzet weg
              </button>
            )}
            {!ongoing && !free && <button onClick={startFree}>Vrij analyseren</button>}
            {free && (
              <button onClick={undoFree} disabled={free.moves.length === 0}>
                Zet terug
              </button>
            )}
            {free && (
              <button className="ghost" onClick={() => setFree(null)}>
                Terug naar partij
              </button>
            )}
            <button className={showCoords ? "" : "ghost"} onClick={() => setShowCoords((v) => !v)}>
              Coördinaten {showCoords ? "aan" : "uit"}
            </button>
            <button
              className={muted ? "ghost" : ""}
              onClick={() => {
                const next = !muted;
                setMuted(next);
                sounds.setMuted(next);
                if (!next) sounds.move();
              }}
            >
              Geluid {muted ? "uit" : "aan"}
            </button>
          </div>

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
            premoves={free ? [] : g.premoves}
            onMove={free ? playFree : (uci) => void g.playerMove(uci)}
            onPremove={g.queuePremove}
            onClearPremove={g.clearPremove}
            arrows={arrows}
            freeMode={!!free}
            fenOverride={
              free ? freeDisplayFen : previewing ? fenAtIndex(game, previewPly ?? 0) : null
            }
            lastMoveOverride={
              free
                ? free.moves[free.moves.length - 1] ?? null
                : previewing
                  ? uciAtPly(game, (previewPly ?? 0) - 1)
                  : null
            }
            badges={free ? undefined : badges}
            orientation={orientation}
            showCoords={showCoords}
          />
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
          {g.review && (
            <AnalysisNav
              review={g.review}
              totalPositions={totalPositions}
              previewPly={previewPly}
              onSelect={setPreviewPly}
              eigenFout={eigenFout}
            />
          )}
          {selectedMove && (
            <div className={`move-comment ${selectedMove.classification}`}>
              <div className="move-comment-head">
                <span className="move-comment-san">
                  {selectedMove.number}
                  {selectedMove.color === "white" ? "." : "..."} {selectedMove.san}
                </span>
                <span className="move-comment-tag">
                  {CLASS_SYMBOLS[selectedMove.classification]}{" "}
                  {CLASS_LABELS[selectedMove.classification]}
                </span>
              </div>
              <p>{selectedMove.comment}</p>
              {selectedMove.best_san && selectedMove.best_san !== selectedMove.san && (
                <p className="muted">Beste zet was {selectedMove.best_san}.</p>
              )}
            </div>
          )}
          {g.busy && !previewing && <div className="thinking">Even denken...</div>}
          {free && (
            <p className="muted premove-tip">
              Vrij analyseren: je mag voor beide partijen zetten; Stockfish beoordeelt de stelling.
            </p>
          )}
          {mode === "premove" && g.premoves.length === 0 && (
            <p className="muted premove-tip">
              Je kunt alvast je volgende zet aangeven (voorzet), en daar meteen nog een
              achteraan zetten.
            </p>
          )}
          {mode === "premove" && g.premoves.length > 0 && (
            <p className="muted premove-tip">
              {g.premoves.length === 1
                ? "1 voorzet gepland. Rechtsklik wist hem."
                : `${g.premoves.length} voorzetten gepland. Rechtsklik wist ze allemaal.`}
            </p>
          )}
          {g.hint?.san && <div className="hint-line">Hint: {g.hint.san}</div>}
          {g.notice && <div className="notice-line">{g.notice}</div>}
        </div>

        <aside className="sidebar">
          <Clock game={game} captured={captured} onTimeout={g.refresh} />

          <div className="panel">
            <div className="panel-bot">
              <Avatar name={game.bot.name} color={game.bot.color} size={44} />
              <div>
                <h3>{game.bot.name}</h3>
                <p className="bot-elo-line">Elo {game.bot.elo}</p>
              </div>
            </div>
            <p className="muted">{game.bot.description}</p>
          </div>

          <ChatFeed messages={game.chat} botName={game.bot.name} botColor={game.bot.color} />

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
            <div className="end-actions">
              <button className="primary" onClick={() => void g.rematch()}>
                Rematch
              </button>
              <button onClick={g.leaveGame}>Andere bot</button>
            </div>
          )}

          {g.stockfishAvailable && (!g.review || free) && (
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
