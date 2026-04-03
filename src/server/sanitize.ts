import { GameState, PlayerState } from '../engine/types';

/**
 * Sanitized player state sent to clients.
 * Hole cards are hidden unless it's the viewing player or showdown.
 */
export interface SanitizedPlayerState {
  id: string;
  seatIndex: number;
  chips: number;
  holeCards: [{ rank: number; suit: string }, { rank: number; suit: string }] | null;
  currentBet: number;
  hasFolded: boolean;
  isAllIn: boolean;
  isSittingOut: boolean;
  isConnected: boolean;
  hasActed: boolean;
}

export interface SanitizedGameState {
  id: string;
  seats: (SanitizedPlayerState | null)[];
  communityCards: { rank: number; suit: string }[];
  pot: number;
  sidePots: { amount: number; eligiblePlayerIds: string[] }[];
  street: string;
  dealerIndex: number;
  smallBlindIndex: number;
  bigBlindIndex: number;
  currentPlayerIndex: number;
  minRaise: number;
  blinds: { small: number; big: number };
  handNumber: number;
  isHandInProgress: boolean;
}

/**
 * Sanitize game state for a specific player.
 * - Hides other players' hole cards (unless showdown)
 * - Never sends the deck
 */
export function sanitizeGameState(
  state: GameState,
  viewingPlayerId: string
): SanitizedGameState {
  const isShowdown = state.street === 'showdown';

  return {
    id: state.id,
    seats: state.seats.map(seat => {
      if (!seat) return null;
      return sanitizePlayer(seat, viewingPlayerId, isShowdown);
    }),
    communityCards: state.communityCards.map(c => ({ rank: c.rank, suit: c.suit })),
    pot: state.pot,
    sidePots: state.sidePots.map(sp => ({
      amount: sp.amount,
      eligiblePlayerIds: [...sp.eligiblePlayerIds],
    })),
    street: state.street,
    dealerIndex: state.dealerIndex,
    smallBlindIndex: state.smallBlindIndex,
    bigBlindIndex: state.bigBlindIndex,
    currentPlayerIndex: state.currentPlayerIndex,
    minRaise: state.minRaise,
    blinds: { ...state.blinds },
    handNumber: state.handNumber,
    isHandInProgress: state.isHandInProgress,
  };
}

function sanitizePlayer(
  player: PlayerState,
  viewingPlayerId: string,
  isShowdown: boolean
): SanitizedPlayerState {
  const canSeeCards = player.id === viewingPlayerId || (isShowdown && !player.hasFolded);

  return {
    id: player.id,
    seatIndex: player.seatIndex,
    chips: player.chips,
    holeCards: canSeeCards && player.holeCards
      ? [
          { rank: player.holeCards[0].rank, suit: player.holeCards[0].suit },
          { rank: player.holeCards[1].rank, suit: player.holeCards[1].suit },
        ]
      : null,
    currentBet: player.currentBet,
    hasFolded: player.hasFolded,
    isAllIn: player.isAllIn,
    isSittingOut: player.isSittingOut,
    isConnected: player.isConnected,
    hasActed: player.hasActed,
  };
}
