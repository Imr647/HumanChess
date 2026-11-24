import { useEffect, useState } from "react";

interface GameControlsProps {
  canUndo: boolean;
  canHint: boolean;
  canAct: boolean;
  stockfishAvailable: boolean;
  busy: boolean;
  onUndo: () => void;
  onHint: () => void;
  onAnalyse: () => void;
  onResign: () => void;
  onDraw: () => void;
  onExport: () => void;
  onDownload: () => void;
  onNew: () => void;
}

export default function GameControls({
  canUndo,
  canHint,
  canAct,
  stockfishAvailable,
  busy,
  onUndo,
  onHint,
  onAnalyse,
  onResign,
  onDraw,
  onExport,
  onDownload,
  onNew,
}: GameControlsProps) {
  const [confirmResign, setConfirmResign] = useState(false);

  useEffect(() => {
    if (!confirmResign) return;
    const t = window.setTimeout(() => setConfirmResign(false), 3000);
    return () => window.clearTimeout(t);
  }, [confirmResign]);

  const handleResign = () => {
    if (!confirmResign) {
      setConfirmResign(true);
      return;
    }
    setConfirmResign(false);
    onResign();
  };

  return (
    <div className="controls">
      <button onClick={onUndo} disabled={!canUndo || busy}>
        Terug
      </button>
      <button onClick={onHint} disabled={!canHint || busy || !stockfishAvailable}>
        Hint
      </button>
      <button onClick={onAnalyse} disabled={busy || !stockfishAvailable}>
        Analyse
      </button>
      <button
        className={`danger ${confirmResign ? "confirm" : ""}`}
        onClick={handleResign}
        disabled={!canAct}
      >
        {confirmResign ? "Zeker opgeven?" : "Opgeven"}
      </button>
      <button onClick={onDraw} disabled={!canAct || busy}>
        Remise
      </button>
      <button onClick={onExport}>PGN kopiëren</button>
      <button onClick={onDownload}>Download PGN</button>
      <button className="ghost" onClick={onNew}>
        Nieuwe partij
      </button>
    </div>
  );
}
