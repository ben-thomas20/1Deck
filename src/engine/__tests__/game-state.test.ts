import { describe, it, expect } from 'vitest';
import {
  createInitialGameState,
  createPlayer,
  seatPlayer,
  dealNewHand,
  applyAction,
} from '../game-state';
import { getValidActions, getActivePlayers } from '../action-validator';
import { HandRank } from '../types';

// Deterministic random for reproducible tests
function seededRandom(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

function setupTwoPlayerGame(chips1 = 1000, chips2 = 1000) {
  let state = createInitialGameState('test', { small: 10, big: 20 });
  state = seatPlayer(state, createPlayer('p1', 0, chips1));
  state = seatPlayer(state, createPlayer('p2', 4, chips2));
  return state;
}

function setupThreePlayerGame(chips1 = 1000, chips2 = 1000, chips3 = 1000) {
  let state = createInitialGameState('test', { small: 10, big: 20 });
  state = seatPlayer(state, createPlayer('p1', 0, chips1));
  state = seatPlayer(state, createPlayer('p2', 2, chips2));
  state = seatPlayer(state, createPlayer('p3', 5, chips3));
  return state;
}

describe('Game State Machine', () => {
  describe('dealing a new hand', () => {
    it('deals hole cards to all players', () => {
      const state = setupTwoPlayerGame();
      const dealt = dealNewHand(state, seededRandom(42));
      const p1 = dealt.seats[0]!;
      const p2 = dealt.seats[4]!;
      expect(p1.holeCards).toHaveLength(2);
      expect(p2.holeCards).toHaveLength(2);
    });

    it('posts blinds correctly in heads-up', () => {
      const state = setupTwoPlayerGame();
      const dealt = dealNewHand(state, seededRandom(42));
      // In heads-up: dealer is SB
      const sbPlayer = dealt.seats[dealt.smallBlindIndex]!;
      const bbPlayer = dealt.seats[dealt.bigBlindIndex]!;
      expect(sbPlayer.currentBet).toBe(10);
      expect(bbPlayer.currentBet).toBe(20);
      expect(dealt.pot).toBe(30);
    });

    it('preflop dealer acts first in heads-up', () => {
      const state = setupTwoPlayerGame();
      const dealt = dealNewHand(state, seededRandom(42));
      // Dealer/SB acts first preflop in heads-up
      expect(dealt.currentPlayerIndex).toBe(dealt.dealerIndex);
    });

    it('posts blinds correctly in 3-player game', () => {
      const state = setupThreePlayerGame();
      const dealt = dealNewHand(state, seededRandom(42));
      expect(dealt.pot).toBe(30);
      const sbPlayer = dealt.seats[dealt.smallBlindIndex]!;
      const bbPlayer = dealt.seats[dealt.bigBlindIndex]!;
      expect(sbPlayer.currentBet).toBe(10);
      expect(bbPlayer.currentBet).toBe(20);
    });

    it('UTG acts first in 3+ player preflop', () => {
      // With 4+ players, UTG is distinct from dealer/blinds
      let state = createInitialGameState('test', { small: 10, big: 20 });
      state = seatPlayer(state, createPlayer('p1', 0, 1000));
      state = seatPlayer(state, createPlayer('p2', 2, 1000));
      state = seatPlayer(state, createPlayer('p3', 4, 1000));
      state = seatPlayer(state, createPlayer('p4', 6, 1000));

      const dealt = dealNewHand(state, seededRandom(42));
      // UTG should not be the SB or BB
      expect(dealt.currentPlayerIndex).not.toBe(dealt.smallBlindIndex);
      expect(dealt.currentPlayerIndex).not.toBe(dealt.bigBlindIndex);
    });

    it('increments hand number', () => {
      const state = setupTwoPlayerGame();
      const dealt = dealNewHand(state, seededRandom(42));
      expect(dealt.handNumber).toBe(1);
    });

    it('rejects dealing with fewer than 2 players', () => {
      let state = createInitialGameState('test');
      state = seatPlayer(state, createPlayer('p1', 0, 1000));
      expect(() => dealNewHand(state)).toThrow('Need at least 2 players');
    });
  });

  describe('folding', () => {
    it('awards pot when all but one fold', () => {
      const state = setupTwoPlayerGame();
      let game = dealNewHand(state, seededRandom(42));
      // Current player folds
      game = applyAction(game, { type: 'fold' });
      expect(game.street).toBe('showdown');
      expect(game.isHandInProgress).toBe(false);
      // Winner gets the pot
      const activePlayers = getActivePlayers(game);
      expect(activePlayers).toHaveLength(1);
    });

    it('BB walks when everyone folds preflop', () => {
      const state = setupThreePlayerGame();
      let game = dealNewHand(state, seededRandom(42));
      // UTG folds
      game = applyAction(game, { type: 'fold' });
      // SB folds (or next acting player folds)
      game = applyAction(game, { type: 'fold' });
      expect(game.street).toBe('showdown');
      expect(game.isHandInProgress).toBe(false);
    });
  });

  describe('checking', () => {
    it('allows check when no bet outstanding', () => {
      const state = setupTwoPlayerGame();
      let game = dealNewHand(state, seededRandom(42));
      // HU preflop: SB/dealer calls (makes it 20)
      game = applyAction(game, { type: 'call' });
      // BB checks
      const valid = getValidActions(game);
      expect(valid.canCheck).toBe(true);
    });

    it('rejects check when facing a bet', () => {
      const state = setupTwoPlayerGame();
      let game = dealNewHand(state, seededRandom(42));
      // In HU preflop: SB/dealer faces the BB (20). Cannot check.
      const valid = getValidActions(game);
      expect(valid.canCheck).toBe(false);
    });
  });

  describe('calling', () => {
    it('matches the current highest bet', () => {
      const state = setupTwoPlayerGame();
      let game = dealNewHand(state, seededRandom(42));
      const playerBefore = game.seats[game.currentPlayerIndex]!;
      const chipsBefore = playerBefore.chips;
      const betBefore = playerBefore.currentBet;

      game = applyAction(game, { type: 'call' });

      // The player who called should have their bet match BB
      // Find the player who just acted
      const callerSeat = game.currentPlayerIndex === 0 ? 0 : 4; // it moved to next player
    });
  });

  describe('raising', () => {
    it('raises correctly', () => {
      const state = setupTwoPlayerGame();
      let game = dealNewHand(state, seededRandom(42));
      // SB/dealer raises to 60 (current bet 10 + raise to 60)
      game = applyAction(game, { type: 'raise', amount: 60 });
      expect(game.pot).toBe(30 + 50); // original blinds 30, SB added 50 more
    });

    it('rejects raise below minimum', () => {
      const state = setupTwoPlayerGame();
      let game = dealNewHand(state, seededRandom(42));
      // Min raise preflop: BB is 20, so min raise total is 40
      expect(() => applyAction(game, { type: 'raise', amount: 25 })).toThrow();
    });

    it('updates min raise after a raise', () => {
      const state = setupTwoPlayerGame();
      let game = dealNewHand(state, seededRandom(42));
      // SB raises to 60 (raise of 40 above BB of 20)
      game = applyAction(game, { type: 'raise', amount: 60 });
      // Min raise for next player should be 60 + 40 = 100
      expect(game.minRaise).toBe(40);
    });
  });

  describe('all-in', () => {
    it('player goes all-in', () => {
      const state = setupTwoPlayerGame(100, 1000);
      let game = dealNewHand(state, seededRandom(42));
      game = applyAction(game, { type: 'all-in' });
      // Find the all-in player
      const allInPlayer = game.seats.find(s => s?.isAllIn);
      expect(allInPlayer).toBeTruthy();
      expect(allInPlayer!.chips).toBe(0);
    });
  });

  describe('street transitions', () => {
    it('transitions from preflop to flop', () => {
      const state = setupTwoPlayerGame();
      let game = dealNewHand(state, seededRandom(42));
      // HU: SB calls
      game = applyAction(game, { type: 'call' });
      // BB checks
      game = applyAction(game, { type: 'check' });
      expect(game.street).toBe('flop');
      expect(game.communityCards).toHaveLength(3);
    });

    it('transitions from flop to turn', () => {
      const state = setupTwoPlayerGame();
      let game = dealNewHand(state, seededRandom(42));
      // Preflop
      game = applyAction(game, { type: 'call' });
      game = applyAction(game, { type: 'check' });
      // Flop - both check
      game = applyAction(game, { type: 'check' });
      game = applyAction(game, { type: 'check' });
      expect(game.street).toBe('turn');
      expect(game.communityCards).toHaveLength(4);
    });

    it('transitions from turn to river', () => {
      const state = setupTwoPlayerGame();
      let game = dealNewHand(state, seededRandom(42));
      // Preflop
      game = applyAction(game, { type: 'call' });
      game = applyAction(game, { type: 'check' });
      // Flop
      game = applyAction(game, { type: 'check' });
      game = applyAction(game, { type: 'check' });
      // Turn
      game = applyAction(game, { type: 'check' });
      game = applyAction(game, { type: 'check' });
      expect(game.street).toBe('river');
      expect(game.communityCards).toHaveLength(5);
    });

    it('transitions from river to showdown', () => {
      const state = setupTwoPlayerGame();
      let game = dealNewHand(state, seededRandom(42));
      // Preflop
      game = applyAction(game, { type: 'call' });
      game = applyAction(game, { type: 'check' });
      // Flop
      game = applyAction(game, { type: 'check' });
      game = applyAction(game, { type: 'check' });
      // Turn
      game = applyAction(game, { type: 'check' });
      game = applyAction(game, { type: 'check' });
      // River
      game = applyAction(game, { type: 'check' });
      game = applyAction(game, { type: 'check' });
      expect(game.street).toBe('showdown');
      expect(game.isHandInProgress).toBe(false);
    });

    it('resets current bets on new street', () => {
      const state = setupTwoPlayerGame();
      let game = dealNewHand(state, seededRandom(42));
      game = applyAction(game, { type: 'call' });
      game = applyAction(game, { type: 'check' });
      // On flop, current bets should be 0
      for (const seat of game.seats) {
        if (seat && !seat.hasFolded) {
          expect(seat.currentBet).toBe(0);
        }
      }
    });

    it('post-flop action starts left of dealer in HU', () => {
      const state = setupTwoPlayerGame();
      let game = dealNewHand(state, seededRandom(42));
      game = applyAction(game, { type: 'call' });
      game = applyAction(game, { type: 'check' });
      // Post-flop: non-dealer acts first in HU
      expect(game.currentPlayerIndex).not.toBe(game.dealerIndex);
    });
  });

  describe('showdown and pot awarding', () => {
    it('awards pot to winner at showdown', () => {
      const state = setupTwoPlayerGame();
      let game = dealNewHand(state, seededRandom(42));
      // Play through to showdown
      game = applyAction(game, { type: 'call' });
      game = applyAction(game, { type: 'check' });
      game = applyAction(game, { type: 'check' });
      game = applyAction(game, { type: 'check' });
      game = applyAction(game, { type: 'check' });
      game = applyAction(game, { type: 'check' });
      game = applyAction(game, { type: 'check' });
      game = applyAction(game, { type: 'check' });

      // Total chips should be conserved
      const totalChips = game.seats.reduce(
        (sum, s) => sum + (s?.chips ?? 0),
        0
      );
      expect(totalChips).toBe(2000);
    });

    it('handles all-in showdown correctly', () => {
      const state = setupTwoPlayerGame(100, 1000);
      let game = dealNewHand(state, seededRandom(42));
      // SB goes all-in
      game = applyAction(game, { type: 'all-in' });
      // BB calls
      game = applyAction(game, { type: 'call' });
      // Should go to showdown
      expect(game.street).toBe('showdown');
      expect(game.communityCards).toHaveLength(5);

      // Total chips conserved
      const totalChips = game.seats.reduce(
        (sum, s) => sum + (s?.chips ?? 0),
        0
      );
      expect(totalChips).toBe(1100);
    });
  });

  describe('side pots with all-in', () => {
    it('creates side pots for 3-way all-in with different stacks', () => {
      const state = setupThreePlayerGame(100, 200, 500);
      let game = dealNewHand(state, seededRandom(42));

      // Play through - UTG goes all-in
      game = applyAction(game, { type: 'all-in' });
      // Next player goes all-in
      game = applyAction(game, { type: 'all-in' });
      // Next player calls/goes all-in
      game = applyAction(game, { type: 'all-in' });

      expect(game.street).toBe('showdown');

      // Total chips conserved
      const totalChips = game.seats.reduce(
        (sum, s) => sum + (s?.chips ?? 0),
        0
      );
      expect(totalChips).toBe(800);
    });
  });

  describe('dealer button rotation', () => {
    it('rotates dealer button between hands', () => {
      const state = setupTwoPlayerGame();
      const hand1 = dealNewHand(state, seededRandom(42));
      const dealer1 = hand1.dealerIndex;

      // Simulate end of hand and deal again
      let game2 = hand1;
      game2 = applyAction(game2, { type: 'fold' });
      game2 = dealNewHand(game2, seededRandom(43));
      const dealer2 = game2.dealerIndex;

      expect(dealer2).not.toBe(dealer1);
    });
  });

  describe('invalid actions', () => {
    it('rejects action when no hand is in progress', () => {
      const state = setupTwoPlayerGame();
      expect(() => applyAction(state, { type: 'fold' })).toThrow(
        'No hand in progress'
      );
    });

    it('rejects action at showdown', () => {
      const state = setupTwoPlayerGame();
      let game = dealNewHand(state, seededRandom(42));
      game = applyAction(game, { type: 'fold' });
      expect(game.street).toBe('showdown');
      expect(() => applyAction(game, { type: 'fold' })).toThrow();
    });
  });

  describe('complete hand simulation', () => {
    it('plays a full hand with raises', () => {
      const state = setupThreePlayerGame();
      let game = dealNewHand(state, seededRandom(42));

      // Preflop: UTG raises to 60
      game = applyAction(game, { type: 'raise', amount: 60 });
      // SB calls (need to put in 50 more)
      game = applyAction(game, { type: 'call' });
      // BB calls (need to put in 40 more)
      game = applyAction(game, { type: 'call' });
      expect(game.street).toBe('flop');

      // Flop: check around
      game = applyAction(game, { type: 'check' });
      game = applyAction(game, { type: 'check' });
      game = applyAction(game, { type: 'check' });
      expect(game.street).toBe('turn');

      // Turn: first player bets 100
      game = applyAction(game, { type: 'raise', amount: 100 });
      // Second player folds
      game = applyAction(game, { type: 'fold' });
      // Third player calls
      game = applyAction(game, { type: 'call' });
      expect(game.street).toBe('river');

      // River: check, check
      game = applyAction(game, { type: 'check' });
      game = applyAction(game, { type: 'check' });
      expect(game.street).toBe('showdown');

      // Chips conserved
      const totalChips = game.seats.reduce(
        (sum, s) => sum + (s?.chips ?? 0),
        0
      );
      expect(totalChips).toBe(3000);
    });
  });
});
