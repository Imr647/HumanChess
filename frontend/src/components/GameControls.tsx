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
  onNew,
}: GameControlsProps) {
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
      <button className="danger" onClick={onResign} disabled={!canAct}>
        Opgeven
      </button>
      <button onClick={onDraw} disabled={!canAct}>
        Remise
      </button>
      <button onClick={onExport}>PGN kopiëren</button>
      <button className="ghost" onClick={onNew}>
        Nieuwe partij
      </button>
    </div>
  );
}
