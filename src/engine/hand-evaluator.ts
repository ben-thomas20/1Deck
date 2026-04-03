import { Card, HandEvaluation, HandRank } from './types';

/**
 * Generate all C(n, k) combinations of an array.
 */
function combinations<T>(arr: T[], k: number): T[][] {
  if (k === 0) return [[]];
  if (arr.length < k) return [];
  const results: T[][] = [];
  const [first, ...rest] = arr;
  // Include first element
  for (const combo of combinations(rest, k - 1)) {
    results.push([first, ...combo]);
  }
  // Exclude first element
  for (const combo of combinations(rest, k)) {
    results.push(combo);
  }
  return results;
}

const RANK_NAMES: Record<number, string> = {
  2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8',
  9: '9', 10: '10', 11: 'Jack', 12: 'Queen', 13: 'King', 14: 'Ace',
};

function rankName(rank: number): string {
  return RANK_NAMES[rank] ?? String(rank);
}

/**
 * Evaluate exactly 5 cards and return the hand ranking.
 */
function evaluate5(cards: Card[]): HandEvaluation {
  const sorted = [...cards].sort((a, b) => b.rank - a.rank);
  const ranks = sorted.map(c => c.rank);

  // Check flush
  const isFlush = sorted.every(c => c.suit === sorted[0].suit);

  // Check straight
  let isStraight = false;
  let straightHighCard = 0;

  // Normal straight check
  if (ranks[0] - ranks[4] === 4 && new Set(ranks).size === 5) {
    isStraight = true;
    straightHighCard = ranks[0];
  }
  // Ace-low straight (wheel): A-2-3-4-5
  if (ranks[0] === 14 && ranks[1] === 5 && ranks[2] === 4 && ranks[3] === 3 && ranks[4] === 2) {
    isStraight = true;
    straightHighCard = 5; // 5-high straight
  }

  // Count rank frequencies
  const freqMap = new Map<number, number>();
  for (const r of ranks) {
    freqMap.set(r, (freqMap.get(r) ?? 0) + 1);
  }
  const freqs = [...freqMap.entries()]
    .sort((a, b) => b[1] - a[1] || b[0] - a[0]); // sort by freq desc, then rank desc

  // Straight flush / Royal flush
  if (isFlush && isStraight) {
    if (straightHighCard === 14) {
      return { rank: HandRank.RoyalFlush, tiebreakers: [14], cards: sorted, name: 'Royal Flush' };
    }
    return {
      rank: HandRank.StraightFlush,
      tiebreakers: [straightHighCard],
      cards: sorted,
      name: `Straight Flush, ${rankName(straightHighCard)} high`,
    };
  }

  // Four of a kind
  if (freqs[0][1] === 4) {
    const quadRank = freqs[0][0];
    const kicker = freqs[1][0];
    return {
      rank: HandRank.FourOfAKind,
      tiebreakers: [quadRank, kicker],
      cards: sorted,
      name: `Four of a Kind, ${rankName(quadRank)}s`,
    };
  }

  // Full house
  if (freqs[0][1] === 3 && freqs[1][1] === 2) {
    return {
      rank: HandRank.FullHouse,
      tiebreakers: [freqs[0][0], freqs[1][0]],
      cards: sorted,
      name: `Full House, ${rankName(freqs[0][0])}s full of ${rankName(freqs[1][0])}s`,
    };
  }

  // Flush
  if (isFlush) {
    return {
      rank: HandRank.Flush,
      tiebreakers: ranks,
      cards: sorted,
      name: `Flush, ${rankName(ranks[0])} high`,
    };
  }

  // Straight
  if (isStraight) {
    return {
      rank: HandRank.Straight,
      tiebreakers: [straightHighCard],
      cards: sorted,
      name: `Straight, ${rankName(straightHighCard)} high`,
    };
  }

  // Three of a kind
  if (freqs[0][1] === 3) {
    const tripRank = freqs[0][0];
    const kickers = freqs.slice(1).map(f => f[0]).sort((a, b) => b - a);
    return {
      rank: HandRank.ThreeOfAKind,
      tiebreakers: [tripRank, ...kickers],
      cards: sorted,
      name: `Three of a Kind, ${rankName(tripRank)}s`,
    };
  }

  // Two pair
  if (freqs[0][1] === 2 && freqs[1][1] === 2) {
    const highPair = Math.max(freqs[0][0], freqs[1][0]);
    const lowPair = Math.min(freqs[0][0], freqs[1][0]);
    const kicker = freqs[2][0];
    return {
      rank: HandRank.TwoPair,
      tiebreakers: [highPair, lowPair, kicker],
      cards: sorted,
      name: `Two Pair, ${rankName(highPair)}s and ${rankName(lowPair)}s`,
    };
  }

  // One pair
  if (freqs[0][1] === 2) {
    const pairRank = freqs[0][0];
    const kickers = freqs.slice(1).map(f => f[0]).sort((a, b) => b - a);
    return {
      rank: HandRank.OnePair,
      tiebreakers: [pairRank, ...kickers],
      cards: sorted,
      name: `Pair of ${rankName(pairRank)}s`,
    };
  }

  // High card
  return {
    rank: HandRank.HighCard,
    tiebreakers: ranks,
    cards: sorted,
    name: `${rankName(ranks[0])} High`,
  };
}

/**
 * Evaluate the best 5-card hand from 7 cards (or fewer).
 * Checks all C(n, 5) = 21 combinations for 7 cards.
 */
export function evaluateHand(cards: Card[]): HandEvaluation {
  if (cards.length < 5) {
    throw new Error(`Need at least 5 cards to evaluate, got ${cards.length}`);
  }

  const allCombos = combinations(cards, 5);
  let best: HandEvaluation | null = null;

  for (const combo of allCombos) {
    const evaluation = evaluate5(combo);
    if (!best || compareHands(evaluation, best) > 0) {
      best = evaluation;
    }
  }

  return best!;
}

/**
 * Compare two hand evaluations. Returns:
 *   > 0 if hand a wins
 *   < 0 if hand b wins
 *   0 if tie
 */
export function compareHands(a: HandEvaluation, b: HandEvaluation): number {
  if (a.rank !== b.rank) {
    return a.rank - b.rank;
  }

  // Same hand rank — compare tiebreakers
  const len = Math.max(a.tiebreakers.length, b.tiebreakers.length);
  for (let i = 0; i < len; i++) {
    const av = a.tiebreakers[i] ?? 0;
    const bv = b.tiebreakers[i] ?? 0;
    if (av !== bv) {
      return av - bv;
    }
  }

  return 0; // exact tie
}

/**
 * Convenience: create a Card from shorthand notation like "Ah", "Td", "2c".
 * Rank: 2-9, T=10, J=11, Q=12, K=13, A=14
 * Suit: h=hearts, d=diamonds, c=clubs, s=spades
 */
export function card(notation: string): Card {
  const rankChar = notation.slice(0, -1);
  const suitChar = notation.slice(-1);

  const rankMap: Record<string, number> = {
    '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
    'T': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14,
  };
  const suitMap: Record<string, string> = {
    'h': 'hearts', 'd': 'diamonds', 'c': 'clubs', 's': 'spades',
  };

  const rank = rankMap[rankChar];
  const suit = suitMap[suitChar];

  if (rank === undefined || suit === undefined) {
    throw new Error(`Invalid card notation: ${notation}`);
  }

  return { rank, suit: suit as Card['suit'] };
}

/**
 * Convenience: parse multiple cards from space-separated notation.
 */
export function cards(notation: string): Card[] {
  return notation.trim().split(/\s+/).map(card);
}
