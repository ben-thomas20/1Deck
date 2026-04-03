import { Card } from './Card';
import { CardBack } from './CardBack';
import type { CardData } from '../../hooks/useGameState';
import './HoleCards.css';

interface HoleCardsProps {
  cards: [CardData, CardData] | null;
  size?: 'sm' | 'md' | 'lg';
  folded?: boolean;
}

export function HoleCards({ cards, size = 'md', folded = false }: HoleCardsProps) {
  if (folded) return null;

  if (!cards) {
    return (
      <div className="hole-cards">
        <CardBack size={size} className="hole-card hole-card--left" />
        <CardBack size={size} className="hole-card hole-card--right" />
      </div>
    );
  }

  return (
    <div className="hole-cards">
      <Card
        rank={cards[0].rank}
        suit={cards[0].suit}
        size={size}
        className="hole-card hole-card--left"
      />
      <Card
        rank={cards[1].rank}
        suit={cards[1].suit}
        size={size}
        className="hole-card hole-card--right"
      />
    </div>
  );
}
