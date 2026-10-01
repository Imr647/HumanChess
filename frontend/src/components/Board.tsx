import { Chess, type Square } from "chess.js";
import { useEffect, useMemo, useState } from "react";
import { Chessboard, type Arrow } from "react-chessboard";

import { lastMoveSquares } from "../lib/chessUtils";
import type { GameSnapshot } from "../lib/types";

interface BoardProps {
  game: GameSnapshot;
  disabled: boolean;
  onMove: (uci: string) => void;
  arrows?: Arrow[];
}

const PROMOTION_PIECES = [
  { code: "q", label: "Dame" },
  { code: "r", label: "Toren" },
  { code: "b", label: "Loper" },
  { code: "n", label: "Paard" },
];

export default function Board({ game, disabled, onMove, arrows = [] }: BoardProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [promotion, setPromotion] = useState<{ from: string; to: string } | null>(null);
  const [resetKey, setResetKey] = useState(0);

  const board = useMemo(() => new Chess(game.fen), [game.fen]);
  const playerChar = game.player_color === "white" ? "w" : "b";

  useEffect(() => {
    setSelected(null);
  }, [game.fen]);

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
    for (const square of lastMoveSquares(game.last_move)) {
      styles[square] = { background: "rgba(155, 199, 0, 0.45)" };
    }
    if (kingSquare) {
      styles[kingSquare] = {
        background: "radial-gradient(circle, rgba(255,0,0,0.55) 30%, transparent 72%)",
      };
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
  }, [board, game.last_move, kingSquare, selected]);

  const tryMove = (from: string, to: string) => {
    const moves = board.moves({ square: from as Square, verbose: true });
    const matches = moves.filter((m) => m.to === to);
    if (matches.length === 0) return false;
    if (matches.some((m) => m.promotion)) {
      setPromotion({ from, to });
      return true;
    }
    onMove(`${from}${to}`);
    setSelected(null);
    return true;
  };

  const handleDrop = ({
    sourceSquare,
    targetSquare,
  }: {
    sourceSquare: string;
    targetSquare: string | null;
  }) => {
    if (disabled || !targetSquare) {
      if (promotion) {
        setPromotion(null);
        setResetKey((k) => k + 1);
      }
      return false;
    }
    return tryMove(sourceSquare, targetSquare);
  };

  const handleSquareClick = ({ square, piece }: { square: string; piece: { pieceType: string } | null }) => {
    if (disabled) return;
    if (selected) {
      if (square === selected) {
        setSelected(null);
        return;
      }
      if (tryMove(selected, square)) return;
    }
    if (piece && piece.pieceType[0] === playerChar) {
      setSelected(square);
    } else {
      setSelected(null);
    }
  };

  const pickPromotion = (code: string) => {
    if (!promotion) return;
    onMove(`${promotion.from}${promotion.to}${code}`);
    setPromotion(null);
    setSelected(null);
  };

  return (
    <div className="board-wrap">
      <Chessboard
        key={resetKey}
        options={{
          id: "humanchess-board",
          position: game.fen,
          boardOrientation: game.player_color,
          allowDragging: !disabled,
          canDragPiece: ({ piece }) => !disabled && piece.pieceType[0] === playerChar,
          onPieceDrop: handleDrop,
          onSquareClick: handleSquareClick,
          squareStyles,
          arrows,
          darkSquareStyle: { backgroundColor: "#6d8fae" },
          lightSquareStyle: { backgroundColor: "#e6ebf0" },
          animationDurationInMs: 200,
          showNotation: true,
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
