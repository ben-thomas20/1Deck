import { describe, it, expect } from 'vitest';
import { calculateSidePots, calculateTotalPot, mergeSidePots } from '../pot-calculator';
import { PlayerState } from '../types';

function makePlayer(id: string, totalBet: number, folded = false): PlayerState {
  return {
    id,
    seatIndex: 0,
    chips: 1000,
    holeCards: null,
    currentBet: totalBet,
    totalBetThisHand: totalBet,
    hasFolded: folded,
    hasActed: true,
    isAllIn: false,
    isSittingOut: false,
    isConnected: true,
  };
}

describe('Pot Calculator', () => {
  describe('calculateSidePots', () => {
    it('single pot when all bets are equal', () => {
      const players = [
        makePlayer('p1', 100),
        makePlayer('p2', 100),
        makePlayer('p3', 100),
      ];
      const pots = calculateSidePots(players);
      expect(pots).toHaveLength(1);
      expect(pots[0].amount).toBe(300);
      expect(pots[0].eligiblePlayerIds).toEqual(['p1', 'p2', 'p3']);
    });

    it('2-way all-in with different stacks', () => {
      const players = [
        makePlayer('p1', 50),  // all-in for 50
        makePlayer('p2', 100), // bet 100
      ];
      const pots = calculateSidePots(players);
      expect(pots).toHaveLength(2);
      // Main pot: 50 × 2 = 100
      expect(pots[0].amount).toBe(100);
      expect(pots[0].eligiblePlayerIds).toEqual(['p1', 'p2']);
      // Side pot: 50 × 1 = 50 (only p2 eligible)
      expect(pots[1].amount).toBe(50);
      expect(pots[1].eligiblePlayerIds).toEqual(['p2']);
    });

    it('3-way all-in with all different stacks', () => {
      const players = [
        makePlayer('p1', 30),  // shortest stack
        makePlayer('p2', 70),  // medium stack
        makePlayer('p3', 100), // biggest stack
      ];
      const pots = calculateSidePots(players);
      expect(pots).toHaveLength(3);
      // Main pot: 30 × 3 = 90
      expect(pots[0].amount).toBe(90);
      expect(pots[0].eligiblePlayerIds).toEqual(['p1', 'p2', 'p3']);
      // Side pot 1: (70-30) × 2 = 80
      expect(pots[1].amount).toBe(80);
      expect(pots[1].eligiblePlayerIds).toEqual(['p2', 'p3']);
      // Side pot 2: (100-70) × 1 = 30
      expect(pots[2].amount).toBe(30);
      expect(pots[2].eligiblePlayerIds).toEqual(['p3']);
    });

    it('folded players contribute to pots but are not eligible', () => {
      const players = [
        makePlayer('p1', 50, true), // folded after betting 50
        makePlayer('p2', 100),
        makePlayer('p3', 100),
      ];
      const pots = calculateSidePots(players);
      expect(pots).toHaveLength(2);
      // Main pot: 50 × 3 = 150 (p1 contributed but not eligible)
      expect(pots[0].amount).toBe(150);
      expect(pots[0].eligiblePlayerIds).toEqual(['p2', 'p3']);
      // Side pot: (100-50) × 2 = 100
      expect(pots[1].amount).toBe(100);
      expect(pots[1].eligiblePlayerIds).toEqual(['p2', 'p3']);
    });

    it('no bets returns empty pots', () => {
      const players = [makePlayer('p1', 0), makePlayer('p2', 0)];
      const pots = calculateSidePots(players);
      expect(pots).toHaveLength(0);
    });
  });

  describe('calculateTotalPot', () => {
    it('sums all bets', () => {
      const players = [
        makePlayer('p1', 30),
        makePlayer('p2', 70),
        makePlayer('p3', 100),
      ];
      expect(calculateTotalPot(players)).toBe(200);
    });
  });

  describe('mergeSidePots', () => {
    it('merges pots with same eligible players', () => {
      const pots = [
        { amount: 100, eligiblePlayerIds: ['p1', 'p2'] },
        { amount: 50, eligiblePlayerIds: ['p1', 'p2'] },
      ];
      const merged = mergeSidePots(pots);
      expect(merged).toHaveLength(1);
      expect(merged[0].amount).toBe(150);
    });

    it('does not merge pots with different eligible players', () => {
      const pots = [
        { amount: 100, eligiblePlayerIds: ['p1', 'p2', 'p3'] },
        { amount: 50, eligiblePlayerIds: ['p2', 'p3'] },
      ];
      const merged = mergeSidePots(pots);
      expect(merged).toHaveLength(2);
    });
  });
});
