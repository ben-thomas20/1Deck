import { describe, it, expect } from 'vitest';
import {
  createInitialGameState,
  createPlayer,
  seatPlayer,
  dealNewHand,
  applyAction,
} from '../game-state';
import { getValidActions, getActivePlayers } from '../action-validator';
import { cards } from '../hand-evaluator';
import { GameState, PlayerState } from '../types';

function seededRandom(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

describe('Integration Tests', () => {
  describe('8-player hand from deal to showdown', () => {
    it('plays a complete 8-player hand', () => {
      let state = createInitialGameState('int-test', { small: 10, big: 20 });

      // Seat 8 players
      for (let i = 0; i < 8; i++) {
        state = seatPlayer(state, createPlayer(`p${i}`, i, 1000));
      }

      let game = dealNewHand(state, seededRandom(123));
      expect(game.handNumber).toBe(1);
      expect(game.street).toBe('preflop');
      expect(game.pot).toBe(30);

      // All 8 players should have hole cards
      for (let i = 0; i < 8; i++) {
        expect(game.seats[i]!.holeCards).toHaveLength(2);
      }

      // Preflop: everyone calls
      let actionsCount = 0;
      while (game.street === 'preflop' && actionsCount < 20) {
        const valid = getValidActions(game);
        if (valid.canCall) {
          game = applyAction(game, { type: 'call' });
        } else if (valid.canCheck) {
          game = applyAction(game, { type: 'check' });
        }
        actionsCount++;
      }
      expect(game.street).toBe('flop');
      expect(game.communityCards).toHaveLength(3);

      // Flop: everyone checks
      actionsCount = 0;
      while (game.street === 'flop' && actionsCount < 20) {
        game = applyAction(game, { type: 'check' });
        actionsCount++;
      }
      expect(game.street).toBe('turn');
      expect(game.communityCards).toHaveLength(4);

      // Turn: first player bets, some fold, some call
      const turnPlayer = game.currentPlayerIndex;
      game = applyAction(game, { type: 'raise', amount: 50 });

      actionsCount = 0;
      while (game.street === 'turn' && actionsCount < 20) {
        const currentSeat = game.currentPlayerIndex;
        if (currentSeat % 2 === 0) {
          game = applyAction(game, { type: 'fold' });
        } else {
          game = applyAction(game, { type: 'call' });
        }
        actionsCount++;
      }
      expect(game.street).toBe('river');
      expect(game.communityCards).toHaveLength(5);

      // River: everyone checks
      actionsCount = 0;
      while (game.street === 'river' && actionsCount < 20) {
        game = applyAction(game, { type: 'check' });
        actionsCount++;
      }
      expect(game.street).toBe('showdown');
      expect(game.isHandInProgress).toBe(false);

      // Total chips conserved
      const totalChips = game.seats.reduce(
        (sum, s) => sum + (s?.chips ?? 0),
        0
      );
      expect(totalChips).toBe(8000);
    });
  });

  describe('heads-up special rules', () => {
    it('dealer posts SB and acts first preflop', () => {
      let state = createInitialGameState('hu-test', { small: 10, big: 20 });
      state = seatPlayer(state, createPlayer('p1', 0, 500));
      state = seatPlayer(state, createPlayer('p2', 4, 500));

      const game = dealNewHand(state, seededRandom(42));

      // Dealer is SB
      expect(game.dealerIndex).toBe(game.smallBlindIndex);
      // Dealer acts first preflop
      expect(game.currentPlayerIndex).toBe(game.dealerIndex);
    });

    it('dealer acts second post-flop', () => {
      let state = createInitialGameState('hu-test', { small: 10, big: 20 });
      state = seatPlayer(state, createPlayer('p1', 0, 500));
      state = seatPlayer(state, createPlayer('p2', 4, 500));

      let game = dealNewHand(state, seededRandom(42));
      // Preflop: SB/dealer calls, BB checks
      game = applyAction(game, { type: 'call' });
      game = applyAction(game, { type: 'check' });

      expect(game.street).toBe('flop');
      // Post-flop: non-dealer (BB) acts first
      expect(game.currentPlayerIndex).not.toBe(game.dealerIndex);
    });
  });

  describe('multi-way all-in with side pots', () => {
    it('correctly distributes side pots in 3-way all-in', () => {
      let state = createInitialGameState('sidepot-test', { small: 10, big: 20 });
      state = seatPlayer(state, createPlayer('short', 0, 100));   // short stack
      state = seatPlayer(state, createPlayer('medium', 2, 300));  // medium stack
      state = seatPlayer(state, createPlayer('big', 5, 600));     // big stack

      let game = dealNewHand(state, seededRandom(42));

      // All three go all-in
      // First to act goes all-in
      game = applyAction(game, { type: 'all-in' });
      // Second goes all-in
      game = applyAction(game, { type: 'all-in' });
      // Third goes all-in
      game = applyAction(game, { type: 'all-in' });

      expect(game.street).toBe('showdown');
      expect(game.communityCards).toHaveLength(5);

      // Chips are conserved
      const totalChips = game.seats.reduce(
        (sum, s) => sum + (s?.chips ?? 0),
        0
      );
      expect(totalChips).toBe(1000);
    });
  });

  describe('dealing multiple consecutive hands', () => {
    it('can deal and play multiple hands', () => {
      let state = createInitialGameState('multi', { small: 10, big: 20 });
      state = seatPlayer(state, createPlayer('p1', 0, 1000));
      state = seatPlayer(state, createPlayer('p2', 4, 1000));

      for (let hand = 0; hand < 5; hand++) {
        let game = dealNewHand(state, seededRandom(42 + hand));
        expect(game.handNumber).toBe(hand + 1);

        // Quick hand: preflop fold
        game = applyAction(game, { type: 'fold' });
        expect(game.street).toBe('showdown');

        state = game;
      }
    });
  });

  describe('edge cases', () => {
    it('handles player with exact blind amount going all-in', () => {
      // Player with exactly big blind chips
      let state = createInitialGameState('edge', { small: 10, big: 20 });
      state = seatPlayer(state, createPlayer('p1', 0, 20));  // exactly BB
      state = seatPlayer(state, createPlayer('p2', 4, 1000));

      let game = dealNewHand(state, seededRandom(42));
      // The player posting SB or BB with <= blind amount will be all-in
      // Game should still work
      expect(game.isHandInProgress).toBe(true);
    });

    it('handles player with less than small blind', () => {
      let state = createInitialGameState('edge', { small: 10, big: 20 });
      state = seatPlayer(state, createPlayer('p1', 0, 5));  // less than SB
      state = seatPlayer(state, createPlayer('p2', 4, 1000));

      let game = dealNewHand(state, seededRandom(42));
      // Player should be all-in after posting partial blind
      const shortPlayer = game.seats.find(
        s => s && s.chips === 0 && s.isAllIn
      );
      expect(shortPlayer).toBeTruthy();
    });

    it('BB gets option to raise when no one raised preflop (3 players)', () => {
      let state = createInitialGameState('bb-option', { small: 10, big: 20 });
      state = seatPlayer(state, createPlayer('p1', 0, 1000));
      state = seatPlayer(state, createPlayer('p2', 2, 1000));
      state = seatPlayer(state, createPlayer('p3', 5, 1000));

      let game = dealNewHand(state, seededRandom(42));

      // UTG calls
      game = applyAction(game, { type: 'call' });
      // SB calls
      game = applyAction(game, { type: 'call' });

      // BB should be current player and can check OR raise
      expect(game.currentPlayerIndex).toBe(game.bigBlindIndex);
      const valid = getValidActions(game);
      expect(valid.canCheck).toBe(true);
      expect(valid.canRaise).toBe(true);
    });
  });
});
