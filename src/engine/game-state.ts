import {
  GameState,
  PlayerAction,
  PlayerState,
  RandomFunction,
  Card,
  HandEvaluation,
  SidePot,
} from './types';
import { createShuffledDeck, dealCards } from './deck';
import { evaluateHand, compareHands } from './hand-evaluator';
import { calculateSidePots, calculateTotalPot } from './pot-calculator';
import { validateAction, getHighestBet, getActivePlayers, getActingPlayers } from './action-validator';

// ─── Factory ───────────────────────────────────────────────────

export function createInitialGameState(
  id: string,
  blinds: { small: number; big: number } = { small: 10, big: 20 }
): GameState {
  return {
    id,
    seats: new Array(8).fill(null),
    communityCards: [],
    deck: [],
    pot: 0,
    sidePots: [],
    street: 'preflop',
    dealerIndex: -1,
    smallBlindIndex: -1,
    bigBlindIndex: -1,
    currentPlayerIndex: -1,
    minRaise: blinds.big,
    lastRaiseAmount: blinds.big,
    blinds,
    handNumber: 0,
    isHandInProgress: false,
  };
}

// ─── Seat Management ───────────────────────────────────────────

export function seatPlayer(state: GameState, player: PlayerState): GameState {
  if (state.seats[player.seatIndex] !== null) {
    throw new Error(`Seat ${player.seatIndex} is occupied`);
  }
  if (player.seatIndex < 0 || player.seatIndex >= 8) {
    throw new Error(`Invalid seat index: ${player.seatIndex}`);
  }
  const newState = cloneState(state);
  newState.seats[player.seatIndex] = { ...player };
  return newState;
}

export function removePlayer(state: GameState, seatIndex: number): GameState {
  const newState = cloneState(state);
  newState.seats[seatIndex] = null;
  return newState;
}

export function createPlayer(
  id: string,
  seatIndex: number,
  chips: number
): PlayerState {
  return {
    id,
    seatIndex,
    chips,
    holeCards: null,
    currentBet: 0,
    totalBetThisHand: 0,
    hasFolded: false,
    hasActed: false,
    isAllIn: false,
    isSittingOut: false,
    isConnected: true,
  };
}

// ─── Deal a New Hand ───────────────────────────────────────────

export function dealNewHand(
  state: GameState,
  random: RandomFunction = Math.random
): GameState {
  const newState = cloneState(state);
  const seatedPlayers = getSeatedActivePlayers(newState);

  if (seatedPlayers.length < 2) {
    throw new Error('Need at least 2 players to deal');
  }

  // Reset player state
  for (const seat of newState.seats) {
    if (seat && !seat.isSittingOut) {
      seat.holeCards = null;
      seat.currentBet = 0;
      seat.totalBetThisHand = 0;
      seat.hasFolded = false;
      seat.hasActed = false;
      seat.isAllIn = false;
    }
  }

  // Reset game state
  newState.communityCards = [];
  newState.pot = 0;
  newState.sidePots = [];
  newState.street = 'preflop';
  newState.handNumber++;
  newState.isHandInProgress = true;

  // Advance dealer button
  newState.dealerIndex = findNextActiveSeat(newState, newState.dealerIndex);

  // Post blinds
  const isHeadsUp = seatedPlayers.length === 2;

  if (isHeadsUp) {
    // Head-to-head: dealer is SB, other player is BB
    newState.smallBlindIndex = newState.dealerIndex;
    newState.bigBlindIndex = findNextActiveSeat(newState, newState.dealerIndex);
  } else {
    newState.smallBlindIndex = findNextActiveSeat(newState, newState.dealerIndex);
    newState.bigBlindIndex = findNextActiveSeat(newState, newState.smallBlindIndex);
  }

  // Post small blind
  const sbPlayer = newState.seats[newState.smallBlindIndex]!;
  const sbAmount = Math.min(newState.blinds.small, sbPlayer.chips);
  sbPlayer.chips -= sbAmount;
  sbPlayer.currentBet = sbAmount;
  sbPlayer.totalBetThisHand = sbAmount;
  if (sbPlayer.chips === 0) sbPlayer.isAllIn = true;

  // Post big blind
  const bbPlayer = newState.seats[newState.bigBlindIndex]!;
  const bbAmount = Math.min(newState.blinds.big, bbPlayer.chips);
  bbPlayer.chips -= bbAmount;
  bbPlayer.currentBet = bbAmount;
  bbPlayer.totalBetThisHand = bbAmount;
  if (bbPlayer.chips === 0) bbPlayer.isAllIn = true;

  newState.pot = sbAmount + bbAmount;
  newState.minRaise = newState.blinds.big;
  newState.lastRaiseAmount = newState.blinds.big;

  // Shuffle and deal
  newState.deck = createShuffledDeck(random);

  // Deal 2 hole cards to each active player, starting left of dealer
  let dealSeat = findNextActiveSeat(newState, newState.dealerIndex);
  for (let i = 0; i < seatedPlayers.length; i++) {
    const player = newState.seats[dealSeat]!;
    const [dealtCards, remainingDeck] = dealCards(newState.deck, 2);
    player.holeCards = [dealtCards[0], dealtCards[1]];
    newState.deck = remainingDeck;
    dealSeat = findNextActiveSeat(newState, dealSeat);
  }

  // Set first player to act
  if (isHeadsUp) {
    // Preflop: dealer/SB acts first in heads-up
    newState.currentPlayerIndex = newState.dealerIndex;
  } else {
    // UTG: player after big blind
    newState.currentPlayerIndex = findNextActiveSeat(newState, newState.bigBlindIndex);
  }

  // Skip players who are all-in (can happen if blinds exceed stack)
  newState.currentPlayerIndex = findNextActingPlayer(newState, newState.currentPlayerIndex, true);

  // Check if all players are all-in after blinds — go straight to showdown
  if (shouldSkipToShowdown(newState)) {
    return runToShowdown(newState);
  }

  return newState;
}

// ─── Apply Action ──────────────────────────────────────────────

export function applyAction(
  state: GameState,
  action: PlayerAction
): GameState {
  if (!state.isHandInProgress) {
    throw new Error('No hand in progress');
  }
  if (state.street === 'showdown') {
    throw new Error('Hand is at showdown, cannot take action');
  }

  const error = validateAction(state, action);
  if (error) {
    throw new Error(error);
  }

  const newState = cloneState(state);
  const player = newState.seats[newState.currentPlayerIndex]!;
  const highestBet = getHighestBet(newState);

  switch (action.type) {
    case 'fold': {
      player.hasFolded = true;
      player.hasActed = true;
      break;
    }

    case 'check': {
      player.hasActed = true;
      break;
    }

    case 'call': {
      const toCall = Math.min(highestBet - player.currentBet, player.chips);
      player.chips -= toCall;
      player.currentBet += toCall;
      player.totalBetThisHand += toCall;
      newState.pot += toCall;
      player.hasActed = true;
      if (player.chips === 0) player.isAllIn = true;
      break;
    }

    case 'raise': {
      const raiseTotal = action.amount; // total bet for this street
      const additional = raiseTotal - player.currentBet;
      const raiseIncrement = raiseTotal - highestBet;

      player.chips -= additional;
      player.currentBet = raiseTotal;
      player.totalBetThisHand += additional;
      newState.pot += additional;
      player.hasActed = true;

      // Update min raise for next raiser
      newState.lastRaiseAmount = raiseIncrement;
      newState.minRaise = raiseIncrement;

      if (player.chips === 0) player.isAllIn = true;

      // Reset hasActed for all other non-folded, non-all-in players
      for (const seat of newState.seats) {
        if (seat && seat !== player && !seat.hasFolded && !seat.isAllIn) {
          seat.hasActed = false;
        }
      }
      break;
    }

    case 'all-in': {
      const allInAmount = player.chips;
      const newBet = player.currentBet + allInAmount;

      // If this is effectively a raise (new bet > highest bet)
      if (newBet > highestBet) {
        const raiseIncrement = newBet - highestBet;
        // Only update min raise if this is a full raise
        if (raiseIncrement >= newState.minRaise) {
          newState.lastRaiseAmount = raiseIncrement;
          newState.minRaise = raiseIncrement;
        }
        // Reset hasActed for other players
        for (const seat of newState.seats) {
          if (seat && seat !== player && !seat.hasFolded && !seat.isAllIn) {
            seat.hasActed = false;
          }
        }
      }

      player.chips = 0;
      player.currentBet = newBet;
      player.totalBetThisHand += allInAmount;
      newState.pot += allInAmount;
      player.isAllIn = true;
      player.hasActed = true;
      break;
    }
  }

  // Check if hand is over (all but one folded)
  const activePlayers = getActivePlayers(newState);
  if (activePlayers.length === 1) {
    return awardPotToLastPlayer(newState, activePlayers[0]);
  }

  // Check if betting round is complete
  if (isBettingRoundComplete(newState)) {
    return advanceStreet(newState);
  }

  // Move to next player
  newState.currentPlayerIndex = findNextActingPlayer(
    newState,
    newState.currentPlayerIndex,
    false
  );

  return newState;
}

// ─── Street Transitions ───────────────────────────────────────

function advanceStreet(state: GameState): GameState {
  const newState = cloneState(state);

  // Check if we should skip to showdown (all active players all-in)
  if (shouldSkipToShowdown(newState)) {
    return runToShowdown(newState);
  }

  switch (newState.street) {
    case 'preflop':
      newState.street = 'flop';
      dealCommunityCards(newState, 3);
      break;
    case 'flop':
      newState.street = 'turn';
      dealCommunityCards(newState, 1);
      break;
    case 'turn':
      newState.street = 'river';
      dealCommunityCards(newState, 1);
      break;
    case 'river':
      return resolveShowdown(newState);
  }

  // Reset betting state for new street
  for (const seat of newState.seats) {
    if (seat && !seat.hasFolded) {
      seat.currentBet = 0;
      seat.hasActed = false;
    }
  }
  newState.minRaise = newState.blinds.big;
  newState.lastRaiseAmount = newState.blinds.big;

  // Post-flop: action starts left of dealer
  const firstToAct = findNextActingPlayerFromDealer(newState);
  if (firstToAct === -1) {
    // Everyone is all-in, run to showdown
    return runToShowdown(newState);
  }
  newState.currentPlayerIndex = firstToAct;

  return newState;
}

function dealCommunityCards(state: GameState, count: number): void {
  const [dealt, remaining] = dealCards(state.deck, count);
  state.communityCards.push(...dealt);
  state.deck = remaining;
}

// ─── Showdown ──────────────────────────────────────────────────

function resolveShowdown(state: GameState): GameState {
  const newState = cloneState(state);
  newState.street = 'showdown';
  newState.isHandInProgress = false;

  const activePlayers = getActivePlayers(newState);
  const sidePots = calculateSidePots(
    newState.seats.filter((s): s is PlayerState => s !== null)
  );

  // Evaluate each active player's hand
  const handResults: { player: PlayerState; evaluation: HandEvaluation }[] = [];
  for (const player of activePlayers) {
    if (player.holeCards) {
      const allCards = [...player.holeCards, ...newState.communityCards];
      const evaluation = evaluateHand(allCards);
      handResults.push({ player, evaluation });
    }
  }

  // Award each pot to the winner(s)
  for (const pot of sidePots) {
    const eligible = handResults.filter(hr =>
      pot.eligiblePlayerIds.includes(hr.player.id)
    );

    if (eligible.length === 0) continue;

    // Find the best hand(s)
    eligible.sort((a, b) => compareHands(b.evaluation, a.evaluation));
    const bestHand = eligible[0].evaluation;

    const winners = eligible.filter(
      hr => compareHands(hr.evaluation, bestHand) === 0
    );

    // Split pot among winners
    const share = Math.floor(pot.amount / winners.length);
    const remainder = pot.amount - share * winners.length;

    for (let i = 0; i < winners.length; i++) {
      const winner = newState.seats[winners[i].player.seatIndex]!;
      winner.chips += share;
      // Give remainder to first winner (closest to dealer's left)
      if (i === 0) winner.chips += remainder;
    }
  }

  newState.sidePots = sidePots;
  return newState;
}

function runToShowdown(state: GameState): GameState {
  const newState = cloneState(state);

  // Deal remaining community cards
  while (newState.communityCards.length < 5) {
    const count = newState.communityCards.length === 0 ? 3 : 1;
    dealCommunityCards(newState, count);
  }

  return resolveShowdown(newState);
}

function awardPotToLastPlayer(state: GameState, winner: PlayerState): GameState {
  const newState = cloneState(state);
  newState.street = 'showdown';
  newState.isHandInProgress = false;

  const winnerSeat = newState.seats[winner.seatIndex]!;
  winnerSeat.chips += newState.pot;

  newState.sidePots = [{
    amount: newState.pot,
    eligiblePlayerIds: [winner.id],
  }];

  return newState;
}

// ─── Betting Round Logic ───────────────────────────────────────

function isBettingRoundComplete(state: GameState): boolean {
  const activePlayers = state.seats.filter(
    (s): s is PlayerState => s !== null && !s.hasFolded && !s.isSittingOut
  );

  // All active players who can act have acted, and bets are equalized
  const highestBet = getHighestBet(state);

  for (const player of activePlayers) {
    if (player.isAllIn) continue; // all-in players don't need to act
    if (!player.hasActed) return false;
    if (player.currentBet !== highestBet) return false;
  }

  return true;
}

function shouldSkipToShowdown(state: GameState): boolean {
  const actingPlayers = getActingPlayers(state);
  const activePlayers = getActivePlayers(state);

  // If only 0 or 1 players can still act, and betting is equalized, skip
  if (actingPlayers.length <= 1 && activePlayers.length > 1) {
    // Check bets are equalized for non-all-in players
    if (actingPlayers.length === 0) return true;
    const highestBet = getHighestBet(state);
    return actingPlayers.every(p => p.currentBet === highestBet || p.isAllIn);
  }

  return false;
}

// ─── Seat Navigation ──────────────────────────────────────────

/**
 * Find next occupied, non-sitting-out seat clockwise from the given index.
 */
function findNextActiveSeat(state: GameState, fromIndex: number): number {
  for (let i = 1; i <= 8; i++) {
    const idx = (fromIndex + i) % 8;
    const seat = state.seats[idx];
    if (seat && !seat.isSittingOut) {
      return idx;
    }
  }
  return fromIndex; // shouldn't happen with 2+ players
}

/**
 * Find next player who can act (not folded, not all-in, not sitting out).
 * If includeCurrent is true, the fromIndex itself is considered.
 */
function findNextActingPlayer(
  state: GameState,
  fromIndex: number,
  includeCurrent: boolean
): number {
  const start = includeCurrent ? 0 : 1;
  for (let i = start; i <= 8; i++) {
    const idx = (fromIndex + i) % 8;
    const seat = state.seats[idx];
    if (seat && !seat.hasFolded && !seat.isAllIn && !seat.isSittingOut) {
      return idx;
    }
  }
  return fromIndex; // shouldn't happen
}

/**
 * Find first acting player left of dealer (for post-flop streets).
 * Returns -1 if no acting players.
 */
function findNextActingPlayerFromDealer(state: GameState): number {
  for (let i = 1; i <= 8; i++) {
    const idx = (state.dealerIndex + i) % 8;
    const seat = state.seats[idx];
    if (seat && !seat.hasFolded && !seat.isAllIn && !seat.isSittingOut) {
      return idx;
    }
  }
  return -1;
}

function getSeatedActivePlayers(state: GameState): PlayerState[] {
  return state.seats.filter(
    (s): s is PlayerState => s !== null && !s.isSittingOut
  );
}

// ─── Utility ───────────────────────────────────────────────────

function cloneState(state: GameState): GameState {
  return {
    ...state,
    seats: state.seats.map(s => (s ? { ...s, holeCards: s.holeCards ? [...s.holeCards] : null } : null)),
    communityCards: [...state.communityCards],
    deck: [...state.deck],
    sidePots: state.sidePots.map(sp => ({ ...sp, eligiblePlayerIds: [...sp.eligiblePlayerIds] })),
    blinds: { ...state.blinds },
  };
}

export {
  getSeatedActivePlayers,
  findNextActiveSeat,
  findNextActingPlayer,
  isBettingRoundComplete,
  resolveShowdown,
};
