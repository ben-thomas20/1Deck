import { Card, Deck, Suit, RandomFunction } from './types';

const SUITS: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];
const RANKS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]; // 11=J, 12=Q, 13=K, 14=A

export function createDeck(): Deck {
  const deck: Deck = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ rank, suit });
    }
  }
  return deck;
}

/**
 * Fisher-Yates shuffle. Accepts an injectable random function for deterministic testing.
 */
export function shuffleDeck(deck: Deck, random: RandomFunction = Math.random): Deck {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Deal cards from the top of the deck. Returns [dealt cards, remaining deck].
 */
export function dealCards(deck: Deck, count: number): [Card[], Deck] {
  if (count > deck.length) {
    throw new Error(`Cannot deal ${count} cards from deck of ${deck.length}`);
  }
  const dealt = deck.slice(0, count);
  const remaining = deck.slice(count);
  return [dealt, remaining];
}

/**
 * Create a fresh shuffled deck.
 */
export function createShuffledDeck(random: RandomFunction = Math.random): Deck {
  return shuffleDeck(createDeck(), random);
}
