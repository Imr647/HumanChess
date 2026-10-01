import { Chess, type Square } from "chess.js";
import { useEffect, useMemo, useState } from "react";
import { Chessboard, type Arrow } from "react-chessboard";

import { lastMoveSquares, premoveChain } from "../lib/chessUtils";
import type { GameSnapshot, Premove } from "../lib/types";

type BoardMode = "move" | "premove" | "locked";

interface BoardProps {
  game: GameSnapshot;
  mode: BoardMode;
  premoves: Premove[];
  onMove: (uci: string) => void;
  onPremove: (pm: Premove) => void;
  onClearPremove?: () => void;
  arrows?: Arrow[];
  fenOverride?: string | null;
  lastMoveOverride?: string | null;
  badges?: Record<string, { symbol: string; cls: string; big: boolean }>;
  orientation?: "white" | "black";
  showCoords?: boolean;
  freeMode?: boolean;
}

const PROMOTION_PIECES = [
  { code: "q", label: "Dame" },
  { code: "r", label: "Toren" },
  { code: "b", label: "Loper" },
  { code: "n", label: "Paard" },
];

const PREMOVE_COLOR = "rgba(186, 104, 255, 0.55)";

export default function Board({
  game,
  mode,
  premoves,
  onMove,
  onPremove,
  onClearPremove,
  arrows = [],
  fenOverride = null,
  lastMoveOverride = null,
  badges,
  orientation,
  showCoords = true,
  freeMode = false,
}: BoardProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [promotion, setPromotion] = useState<
    { from: string; to: string; kind: "move" | "premove" } | null
  >(null);
  const [resetKey, setResetKey] = useState(0);

  const position = fenOverride ?? game.fen;
  const lastMove = lastMoveOverride ?? game.last_move;
  // Met geplande voorzetten laat het bord de stelling alvast zien zoals hij wordt.
  const shown = useMemo(
    () => (premoves.length ? premoveChain(position, premoves) : position),
    [position, premoves],
  );
  const board = useMemo(() => new Chess(shown), [shown]);
  const playerChar = game.player_color === "white" ? "w" : "b";

  useEffect(() => {
    setSelected(null);
  }, [shown, mode]);

  const needsPromotion = (from: string, to: string) => {
    const piece = board.get(from as Square);
    if (!piece || piece.type !== "p") return false;
    return (piece.color === "w" && to[1] === "8") || (piece.color === "b" && to[1] === "1");
  };

  const kingSquare = useMemo(() => {
    if (!board.isCheck()) return null;
    const turn = board.turn();
    for (const row of board.board()) {
      for (const cell of row) {
        if (cell && cell.type === "k" && cell.color === turn) return cell.square;
      }
    }
    return null;
  }, [board]);

  const squareStyles = useMemo(() => {
    const styles: Record<string, React.CSSProperties> = {};
    for (const square of lastMoveSquares(lastMove)) {
      styles[square] = { background: "rgba(155, 199, 0, 0.45)" };
    }
    if (kingSquare) {
      styles[kingSquare] = {
        background: "radial-gradient(circle, rgba(255,0,0,0.55) 30%, transparent 72%)",
      };
    }
    const laatsteVoorzet = premoves[premoves.length - 1];
    if (laatsteVoorzet) {
      styles[laatsteVoorzet.from] = { background: PREMOVE_COLOR };
      styles[laatsteVoorzet.to] = { background: PREMOVE_COLOR };
    }
    if (selected) {
      styles[selected] = { background: "rgba(255, 235, 59, 0.45)" };
      const moves = board.moves({ square: selected as Square, verbose: true });
      for (const move of moves) {
        styles[move.to] = {
          background: "radial-gradient(circle, rgba(20,20,20,0.35) 20%, transparent 22%)",
        };
      }
    }
    return styles;
  }, [board, lastMove, kingSquare, premoves, selected]);

  const squareRenderer = useMemo(() => {
    if (!badges || Object.keys(badges).length === 0) return undefined;
    return ({ square, children }: { square: string; children?: React.ReactNode }) => {
      const badge = badges[square];
      return (
        <div
          style={{
            width: "100%",
            height: "100%",
            position: "relative",
            ...squareStyles[square],
          }}
        >
          {children}
          {badge && (
            <span className={`move-badge ${badge.cls} ${badge.big ? "big" : "small"}`}>
              {badge.big ? badge.symbol : ""}
            </span>
          )}
        </div>
      );
    };
  }, [badges, squareStyles]);

  const boardArrows = useMemo(() => {
    if (premoves.length === 0) return arrows;
    const gepland: Arrow[] = premoves.map((pm, i) => ({
      startSquare: pm.from,
      endSquare: pm.to,
      color: i === premoves.length - 1 ? "#b466ff" : "#c9a2ff",
    }));
    return [...arrows, ...gepland];
  }, [arrows, premoves]);

  const queuePremove = (from: string, to: string) => {
    if (needsPromotion(from, to)) {
      setPromotion({ from, to, kind: "premove" });
    } else {
      onPremove({ from, to });
      setSelected(null);
    }
  };

  const handleDrop = ({
    sourceSquare,
    targetSquare,
  }: {
    sourceSquare: string;
    targetSquare: string | null;
  }) => {
    if (mode === "locked" || !targetSquare) return false;

    if (mode === "premove") {
      // Terug op hetzelfde vak: voorzet wissen. Verder mag een voorzet ook naar
      // een eigen stuk (recapture) — de legaliteit wordt pas na de botzet bepaald.
      if (sourceSquare === targetSquare) {
        onClearPremove?.();
      } else {
        queuePremove(sourceSquare, targetSquare);
      }
      return false;
    }

    const moves = board.moves({ square: sourceSquare as Square, verbose: true });
    const matches = moves.filter((m) => m.to === targetSquare);
    if (matches.length === 0) return false;
    if (matches.some((m) => m.promotion)) {
      setPromotion({ from: sourceSquare, to: targetSquare, kind: "move" });
      return false;
    }
    onMove(`${sourceSquare}${targetSquare}`);
    setSelected(null);
    return true;
  };

  const handleSquareClick = ({
    square,
    piece,
  }: {
    square: string;
    piece: { pieceType: string } | null;
  }) => {
    if (mode === "locked") return;
    if (selected) {
      if (square === selected) {
        setSelected(null);
        return;
      }
      if (mode === "premove") {
        if (piece && piece.pieceType[0] === playerChar) {
          setSelected(square);
          return;
        }
        queuePremove(selected, square);
        return;
      }
      const moves = board.moves({ square: selected as Square, verbose: true });
      const matches = moves.filter((m) => m.to === square);
      if (matches.length > 0) {
        if (matches.some((m) => m.promotion)) {
          setPromotion({ from: selected, to: square, kind: "move" });
          return;
        }
        onMove(`${selected}${square}`);
        setSelected(null);
        return;
      }
    }
    if (piece && (freeMode || piece.pieceType[0] === playerChar)) {
      setSelected(square);
    } else {
      setSelected(null);
    }
  };

  const pickPromotion = (code: string) => {
    if (!promotion) return;
    if (promotion.kind === "premove") {
      onPremove({ from: promotion.from, to: promotion.to, promotion: code });
    } else {
      onMove(`${promotion.from}${promotion.to}${code}`);
    }
    setPromotion(null);
    setSelected(null);
  };

  return (
    <div className="board-wrap">
      <Chessboard
        key={resetKey}
        options={{
          id: "humanchess-board",
          position: shown,
          boardOrientation: orientation ?? game.player_color,
          allowDragging: mode !== "locked",
          canDragPiece: ({ piece }) => mode !== "locked" && (freeMode || piece.pieceType[0] === playerChar),
          onPieceDrop: handleDrop,
          onSquareClick: handleSquareClick,
          onSquareRightClick: () => {
            if (premoves.length) onClearPremove?.();
          },
          squareStyles,
          squareRenderer,
          arrows: boardArrows,
          darkSquareStyle: { backgroundColor: "#6d8fae" },
          lightSquareStyle: { backgroundColor: "#e6ebf0" },
          animationDurationInMs: 200,
          showNotation: showCoords,
        }}
      />
      {promotion && (
        <div className="promotion-overlay">
          <div className="promotion-dialog">
            <p>Promoveer naar</p>
            <div className="promotion-buttons">
              {PROMOTION_PIECES.map((p) => (
                <button key={p.code} onClick={() => pickPromotion(p.code)}>
                  {p.label}
                </button>
              ))}
            </div>
            <button
              className="ghost"
              onClick={() => {
                setPromotion(null);
                setResetKey((k) => k + 1);
              }}
            >
              Annuleren
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
