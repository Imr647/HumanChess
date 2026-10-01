import type { MoveEntry } from "../lib/types";

interface MoveListProps {
  moves: MoveEntry[];
}

export default function MoveList({ moves }: MoveListProps) {
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

  return (
    <div className="movelist">
      {rows.length === 0 && <p className="muted">Nog geen zetten.</p>}
      {rows.map((row) => (
        <div className="movelist-row" key={`${row.number}-${row.white?.uci ?? row.black?.uci}`}>
          <span className="movelist-num">{row.number}.</span>
          <span className={row.white ? "move" : "move empty"}>
            {row.white?.san ?? ""}
          </span>
          <span className={row.black ? "move" : "move empty"}>
            {row.black?.san ?? ""}
          </span>
        </div>
      ))}
    </div>
  );
}
