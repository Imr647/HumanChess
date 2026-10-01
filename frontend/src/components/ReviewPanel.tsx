import { useState } from "react";

import {
  CLASS_DESCRIPTIONS,
  CLASS_LABELS,
  CLASS_ORDER,
  CLASS_SYMBOLS,
} from "../lib/chessUtils";
import type { MoveClass, ReviewResult, ReviewSummary } from "../lib/types";

interface ReviewPanelProps {
  review: ReviewResult;
  selectedPly: number | null;
  onSelect: (ply: number) => void;
}

const CHIP_ORDER: MoveClass[] = [...CLASS_ORDER].reverse();

function SummaryColumn({ title, summary }: { title: string; summary: ReviewSummary }) {
  return (
    <div className="review-summary-col">
      <div className="review-acc">
        <strong>{summary.accuracy.toFixed(1)}%</strong>
        <span className="muted">{title}</span>
      </div>
      <div className="review-chips">
        {CHIP_ORDER.map((cls) =>
          summary[cls] > 0 ? (
            <span key={cls} className={`chip ${cls}`} title={CLASS_LABELS[cls]}>
              {CLASS_SYMBOLS[cls]} {summary[cls]}
            </span>
          ) : null,
        )}
      </div>
    </div>
  );
}

function Legend() {
  const [open, setOpen] = useState(true);
  return (
    <div className="legend">
      <button className="legend-toggle" onClick={() => setOpen((v) => !v)}>
        Legenda {open ? "▾" : "▸"}
      </button>
      {open && (
        <div className="legend-list">
          {CLASS_ORDER.map((cls) => (
            <div className="legend-row" key={cls}>
              <span className={`legend-badge ${cls}`}>{CLASS_SYMBOLS[cls]}</span>
              <div className="legend-text">
                <span className="legend-label">{CLASS_LABELS[cls]}</span>
                <span className="muted">{CLASS_DESCRIPTIONS[cls]}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function EvalGraph({
  evals,
  selectedPly,
  onSelect,
}: {
  evals: number[];
  selectedPly: number | null;
  onSelect: (ply: number) => void;
}) {
  const n = Math.max(1, evals.length - 1);
  const W = 100;
  const H = 40;
  const points = evals.map((cp, i) => {
    const x = (i / n) * W;
    const clamped = Math.max(-800, Math.min(800, cp));
    const y = H / 2 - (clamped / 800) * (H / 2 - 2);
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });

  const handleClick = (event: React.MouseEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const fraction = (event.clientX - rect.left) / rect.width;
    const index = Math.round(fraction * n);
    onSelect(Math.max(0, Math.min(n, index)));
  };

  const markerX = selectedPly !== null ? (selectedPly / n) * W : null;

  return (
    <svg
      className="eval-graph"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      onClick={handleClick}
    >
      <rect x="0" y="0" width={W} height={H / 2} fill="#1c2531" />
      <rect x="0" y={H / 2} width={W} height={H / 2} fill="#e6ebf0" opacity="0.85" />
      <line x1="0" y1={H / 2} x2={W} y2={H / 2} stroke="#64748b" strokeWidth="0.4" />
      <polyline
        points={points.join(" ")}
        fill="none"
        stroke="#4f9cf9"
        strokeWidth="1"
        vectorEffect="non-scaling-stroke"
      />
      {markerX !== null && (
        <line x1={markerX} y1="0" x2={markerX} y2={H} stroke="#f59e0b" strokeWidth="0.8" />
      )}
    </svg>
  );
}

export default function ReviewPanel({ review, selectedPly, onSelect }: ReviewPanelProps) {
  const rows: {
    number: number;
    white?: (typeof review.moves)[number];
    black?: (typeof review.moves)[number];
  }[] = [];
  for (const move of review.moves) {
    if (move.color === "white") {
      rows.push({ number: move.number, white: move });
    } else {
      const last = rows[rows.length - 1];
      if (last && last.number === move.number && !last.black) last.black = move;
      else rows.push({ number: move.number, black: move });
    }
  }

  const cell = (move?: (typeof review.moves)[number]) => {
    if (!move) return <span className="move empty" />;
    const active = selectedPly === move.ply + 1;
    return (
      <button
        className={`review-move ${move.classification} ${active ? "active" : ""}`}
        onClick={() => onSelect(move.ply + 1)}
        title={
          move.best_san && move.best_san !== move.san
            ? `${CLASS_LABELS[move.classification]} — beste was ${move.best_san}`
            : CLASS_LABELS[move.classification]
        }
      >
        <span className="review-san">{move.san}</span>
        <span className="review-symbol">{CLASS_SYMBOLS[move.classification]}</span>
      </button>
    );
  };

  return (
    <div className="panel review">
      <h3>Partij-analyse</h3>
      <div className="review-summary">
        <SummaryColumn title="Wit" summary={review.summary.white} />
        <SummaryColumn title="Zwart" summary={review.summary.black} />
      </div>

      <Legend />

      <EvalGraph evals={review.eval} selectedPly={selectedPly} onSelect={onSelect} />

      <div className="review-moves">
        {rows.map((row) => (
          <div className="review-row" key={`${row.number}-${row.white?.ply ?? row.black?.ply}`}>
            <span className="review-num">{row.number}.</span>
            {cell(row.white)}
            {cell(row.black)}
          </div>
        ))}
      </div>
      <p className="muted review-foot">Stockfish, diepte {review.depth}</p>
    </div>
  );
}
