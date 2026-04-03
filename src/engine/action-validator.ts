import { GameState, PlayerAction, PlayerState } from './types';

export interface ValidActions {
  canFold: boolean;
  canCheck: boolean;
  canCall: boolean;
  callAmount: number;
  canRaise: boolean;
  minRaise: number; // minimum total bet for a raise
  maxRaise: number; // maximum total bet (all-in)
  canAllIn: boolean;
  allInAmount: number;
}

/**
 * Determine valid actions for the current player given game state.
 */
export function getValidActions(state: GameState): ValidActions {
  const player = state.seats[state.currentPlayerIndex];
  if (!player) {
    throw new Error(`No player at seat ${state.currentPlayerIndex}`);
  }

  const highestBet = getHighestBet(state);
  const toCall = highestBet - player.currentBet;
  const playerChips = player.chips;

  // Fold: always valid (even if check is available)
  const canFold = true;

  // Check: valid only if no outstanding bet
  const canCheck = toCall === 0;

  // Call: valid when facing a bet and player has enough chips (or will go all-in)
  const canCall = toCall > 0 && playerChips > 0;
  const callAmount = Math.min(toCall, playerChips);

  // Raise: valid if player has enough chips to make a raise above the call amount
  const minRaiseTotal = highestBet + state.minRaise;
  const canRaise = playerChips > toCall && playerChips + player.currentBet >= minRaiseTotal;
  const minRaise = Math.min(minRaiseTotal, player.currentBet + playerChips);
  const maxRaise = player.currentBet + playerChips; // all-in is the max

  // All-in: always valid if player has chips
  const canAllIn = playerChips > 0;
  const allInAmount = playerChips;

  return {
    canFold,
    canCheck,
    canCall,
    callAmount,
    canRaise,
    minRaise,
    maxRaise,
    canAllIn,
    allInAmount,
  };
}

/**
 * Validate a specific player action against the current game state.
 * Returns null if valid, or an error message if invalid.
 */
export function validateAction(state: GameState, action: PlayerAction): string | null {
  const valid = getValidActions(state);

  switch (action.type) {
    case 'fold':
      return null; // always valid

    case 'check':
      if (!valid.canCheck) {
        return 'Cannot check when facing a bet. Must call, raise, or fold.';
      }
      return null;

    case 'call':
      if (!valid.canCall) {
        return 'Cannot call — no outstanding bet or no chips.';
      }
      return null;

    case 'raise': {
      if (!valid.canRaise) {
        return 'Cannot raise — not enough chips.';
      }
      if (action.amount < valid.minRaise) {
        return `Raise must be at least ${valid.minRaise}. Got ${action.amount}.`;
      }
      if (action.amount > valid.maxRaise) {
        return `Raise cannot exceed ${valid.maxRaise} (your total chips). Got ${action.amount}.`;
      }
      return null;
    }

    case 'all-in':
      if (!valid.canAllIn) {
        return 'Cannot go all-in with 0 chips.';
      }
      return null;

    default:
      return `Unknown action type: ${(action as PlayerAction).type}`;
  }
}

/**
 * Get the highest current bet at the table.
 */
export function getHighestBet(state: GameState): number {
  let highest = 0;
  for (const seat of state.seats) {
    if (seat && !seat.hasFolded) {
      highest = Math.max(highest, seat.currentBet);
    }
  }
  return highest;
}

/**
 * Get active players (not folded, not sitting out, have a seat).
 */
export function getActivePlayers(state: GameState): PlayerState[] {
  return state.seats.filter(
    (s): s is PlayerState => s !== null && !s.hasFolded && !s.isSittingOut
  );
}

/**
 * Get players who can still act (not folded, not all-in, not sitting out).
 */
export function getActingPlayers(state: GameState): PlayerState[] {
  return state.seats.filter(
    (s): s is PlayerState => s !== null && !s.hasFolded && !s.isAllIn && !s.isSittingOut
  );
}
