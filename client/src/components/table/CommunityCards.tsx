import { Card } from '../cards/Card';
import type { CardData } from '../../hooks/useGameState';
import './CommunityCards.css';

interface CommunityCardsProps {
  cards: CardData[];
}

export function CommunityCards({ cards }: CommunityCardsProps) {
  if (cards.length === 0) return null;

  return (
    <div className="community-cards">
      {cards.map((card, i) => (
        <Card
          key={`${card.rank}-${card.suit}-${i}`}
          rank={card.rank}
          suit={card.suit}
          size="md"
          className="community-card"
        />
      ))}
    </div>
  );
}
