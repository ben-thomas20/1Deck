// ─── Card Types ────────────────────────────────────────────────

export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';

export interface Card {
  rank: number; // 2-14 (14 = Ace)
  suit: Suit;
}

export type Deck = Card[];

// ─── Player Types ──────────────────────────────────────────────

export interface PlayerState {
  id: string;
  seatIndex: number; // 0-7
  chips: number;
  holeCards: [Card, Card] | null;
  currentBet: number;       // amount bet THIS STREET
  totalBetThisHand: number; // for side pot calculation
  hasFolded: boolean;
  hasActed: boolean;         // has acted this betting round
  isAllIn: boolean;
  isSittingOut: boolean;
  isConnected: boolean;
}

// ─── Pot Types ─────────────────────────────────────────────────

export interface SidePot {
  amount: number;
  eligiblePlayerIds: string[];
}

// ─── Game State ────────────────────────────────────────────────

export type Street = 'preflop' | 'flop' | 'turn' | 'river' | 'showdown';

export interface GameState {
  id: string;
  seats: (PlayerState | null)[]; // 8 seats, null = empty
  communityCards: Card[];        // 0, 3, 4, or 5 cards
  deck: Deck;
  pot: number;
  sidePots: SidePot[];
  street: Street;
  dealerIndex: number;           // seat index of button
  smallBlindIndex: number;
  bigBlindIndex: number;
  currentPlayerIndex: number;    // whose turn it is
  minRaise: number;              // minimum legal raise amount
  lastRaiseAmount: number;       // for calculating min raise
  blinds: { small: number; big: number };
  handNumber: number;
  isHandInProgress: boolean;
}

// ─── Player Actions ────────────────────────────────────────────

export type PlayerAction =
  | { type: 'fold' }
  | { type: 'check' }
  | { type: 'call' }
  | { type: 'raise'; amount: number } // total bet, NOT raise increment
  | { type: 'all-in' };

// ─── Hand Evaluation ───────────────────────────────────────────

export enum HandRank {
  HighCard = 1,
  OnePair = 2,
  TwoPair = 3,
  ThreeOfAKind = 4,
  Straight = 5,
  Flush = 6,
  FullHouse = 7,
  FourOfAKind = 8,
  StraightFlush = 9,
  RoyalFlush = 10,
}

export interface HandEvaluation {
  rank: HandRank;
  tiebreakers: number[]; // descending priority for comparison
  cards: Card[];         // the best 5 cards
  name: string;          // human-readable name
}

// ─── Random Seed (for deterministic testing) ───────────────────

export type RandomFunction = () => number; // returns 0..1, like Math.random
