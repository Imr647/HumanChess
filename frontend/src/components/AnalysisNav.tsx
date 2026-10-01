import { CLASS_LABELS, CLASS_SYMBOLS } from "../lib/chessUtils";
import type { ReviewMove, ReviewResult } from "../lib/types";

const ZWARTE_DRIEHOEK = "\u25C0";
const DRIEHOEK = "\u25B6";
const NAAR_BEGIN = "\u23EE";
const NAAR_EIND = "\u23ED";

interface AnalysisNavProps {
  review: ReviewResult;
  totalPositions: number;
  previewPly: number | null;
  onSelect: (ply: number | null) => void;
  eigenFout: ReviewMove | null;
}

export default function AnalysisNav({
  review,
  totalPositions,
  previewPly,
  onSelect,
  eigenFout,
}: AnalysisNavProps) {
  const plek = previewPly ?? totalPositions;
  const zet = plek > 0 ? review.moves[plek - 1] : null;
  const omschrijving =
    plek === 0 ? "Beginstelling" : zet ? `${zet.number}${zet.color === "white" ? "." : "..."} ${zet.san}` : "—";

  return (
    <div className="analysis-nav">
      <div className="analysis-nav-knoppen">
        <button onClick={() => onSelect(0)} disabled={plek === 0} title="Naar het begin">
          {NAAR_BEGIN}
        </button>
        <button
          onClick={() => onSelect(Math.max(0, plek - 1))}
          disabled={plek === 0}
          title="Een zet terug"
        >
          {ZWARTE_DRIEHOEK}
        </button>
        <button
          onClick={() => onSelect(Math.min(totalPositions, plek + 1))}
          disabled={plek >= totalPositions}
          title="Een zet verder"
        >
          {DRIEHOEK}
        </button>
        <button
          onClick={() => onSelect(null)}
          disabled={previewPly === null}
          title="Naar de eindstelling"
        >
          {NAAR_EIND}
        </button>
      </div>

      <div className="analysis-nav-info">
        <span className="analysis-nav-zet">{omschrijving}</span>
        {zet && (
          <span className={`analysis-nav-oordeel ${zet.classification}`}>
            {CLASS_SYMBOLS[zet.classification]} {CLASS_LABELS[zet.classification]}
          </span>
        )}
      </div>

      <div className="analysis-nav-acties">
        {eigenFout && (
          <button
            className="ghost"
            disabled={plek === eigenFout.ply + 1}
            title="Spring naar deze zet"
            onClick={() => onSelect(eigenFout.ply + 1)}
          >
            Grootste fout: {eigenFout.number}
            {eigenFout.color === "white" ? "." : "..."}
            {eigenFout.san}
          </button>
        )}
        <button className="ghost" disabled={previewPly === null} onClick={() => onSelect(null)}>
          Terug naar partij
        </button>
      </div>
    </div>
  );
}
