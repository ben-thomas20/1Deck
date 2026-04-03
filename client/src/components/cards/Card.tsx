import { SUIT_SYMBOLS, RANK_DISPLAY, isRedSuit } from '../../utils/card-utils';
import './Card.css';

interface CardProps {
  rank: number;
  suit: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function Card({ rank, suit, size = 'md', className = '' }: CardProps) {
  const suitSymbol = SUIT_SYMBOLS[suit] ?? '?';
  const rankDisplay = RANK_DISPLAY[rank] ?? '?';
  const colorClass = isRedSuit(suit) ? 'card--red' : 'card--black';

  return (
    <div className={`card card--${size} ${colorClass} ${className}`}>
      <div className="card-corner card-corner--top">
        <span className="card-rank">{rankDisplay}</span>
        <span className="card-suit">{suitSymbol}</span>
      </div>
      <div className="card-center">
        <span className="card-pip">{suitSymbol}</span>
      </div>
      <div className="card-corner card-corner--bottom">
        <span className="card-rank">{rankDisplay}</span>
        <span className="card-suit">{suitSymbol}</span>
      </div>
    </div>
  );
}
