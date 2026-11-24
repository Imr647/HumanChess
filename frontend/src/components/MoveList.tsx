import { useEffect, useRef } from "react";

import type { MoveEntry } from "../lib/types";

interface MoveListProps {
  moves: MoveEntry[];
  selectedPly: number | null;
  onSelect: (ply: number | null) => void;
}

export default function MoveList({ moves, selectedPly, onSelect }: MoveListProps) {
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (selectedPly === null && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [moves.length, selectedPly]);

  const rows: { number: number; white?: MoveEntry; black?: MoveEntry }[] = [];
  for (const move of moves) {
    if (move.color === "white") {
      rows.push({ number: move.number, white: move });
    } else {
      const last = rows[rows.length - 1];
      if (last && last.number === move.number && !last.black) {
        last.black = move;
      } else {
        rows.push({ number: move.number, black: move });
      }
    }
  }

  const activePly = selectedPly ?? moves.length;

  const cell = (move?: MoveEntry) => {
    if (!move) return <span className="move empty" />;
    const ply = move.halfmove + 1;
    const isActive = activePly === ply;
    return (
      <button
        type="button"
        className={`move move-btn ${isActive ? "active" : ""}`}
        onClick={() => onSelect(ply === moves.length ? null : ply)}
      >
        {move.san}
      </button>
    );
  };

  return (
    <div className="movelist" ref={listRef}>
      {rows.length === 0 && <p className="muted">Nog geen zetten.</p>}
      {rows.map((row) => (
        <div className="movelist-row" key={`${row.number}-${row.white?.halfmove ?? row.black?.halfmove}`}>
          <span className="movelist-num">{row.number}.</span>
          {cell(row.white)}
          {cell(row.black)}
        </div>
      ))}
    </div>
  );
}
