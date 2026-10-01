import { pieceGlyph } from "../lib/chessUtils";

interface CapturedPiecesProps {
  pieces: string[];
  color: "white" | "black";
  advantage: number;
}

export default function CapturedPieces({ pieces, color, advantage }: CapturedPiecesProps) {
  if (pieces.length === 0 && advantage <= 0) return null;
  return (
    <span className="captured">
      {pieces.map((piece, index) => (
        <span className="captured-piece" key={`${piece}-${index}`}>
          {pieceGlyph(piece, color)}
        </span>
      ))}
      {advantage > 0 && <span className="material-adv">+{advantage}</span>}
    </span>
  );
}
