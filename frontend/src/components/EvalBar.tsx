import { evalToText, evalToWhiteProbability } from "../lib/chessUtils";
import type { EvalResult } from "../lib/types";

interface EvalBarProps {
  result: EvalResult | null;
  loading: boolean;
}

export default function EvalBar({ result, loading }: EvalBarProps) {
  const first = result?.lines[0];
  const whiteP = evalToWhiteProbability(first);
  const percent = Math.round(whiteP * 100);

  return (
    <div className="eval">
      <div className="eval-bar" title="Wit voordeel onderaan">
        <div className="eval-white" style={{ height: `${percent}%` }} />
        <div className="eval-mid" />
      </div>
      <div className="eval-lines">
        <div className="eval-head">
          <span>Analyse</span>
          <strong>{loading ? "..." : evalToText(first)}</strong>
        </div>
        {result?.lines.map((line) => (
          <div className="eval-line" key={line.multipv}>
            <span className="eval-san">{line.san ?? "—"}</span>
            <span className="eval-pv">{line.pv[0]?.split(" ").slice(0, 6).join(" ")}</span>
          </div>
        ))}
        {!result && !loading && <p className="muted">Nog niet geanalyseerd.</p>}
      </div>
    </div>
  );
}
