import { describe, it, expect } from 'vitest';
import { evaluateHand, compareHands, cards, card } from '../hand-evaluator';
import { HandRank } from '../types';

describe('Hand Evaluator', () => {
  describe('5-card hand rankings', () => {
    it('detects royal flush', () => {
      const hand = evaluateHand(cards('As Ks Qs Js Ts 2h 3d'));
      expect(hand.rank).toBe(HandRank.RoyalFlush);
    });

    it('detects straight flush', () => {
      const hand = evaluateHand(cards('9h 8h 7h 6h 5h 2c 3d'));
      expect(hand.rank).toBe(HandRank.StraightFlush);
      expect(hand.tiebreakers[0]).toBe(9);
    });

    it('detects steel wheel (A-5 straight flush)', () => {
      const hand = evaluateHand(cards('Ah 2h 3h 4h 5h Kc Qd'));
      expect(hand.rank).toBe(HandRank.StraightFlush);
      expect(hand.tiebreakers[0]).toBe(5);
    });

    it('detects four of a kind', () => {
      const hand = evaluateHand(cards('Ks Kh Kd Kc 7s 3h 2d'));
      expect(hand.rank).toBe(HandRank.FourOfAKind);
      expect(hand.tiebreakers[0]).toBe(13);
    });

    it('detects full house', () => {
      const hand = evaluateHand(cards('Qs Qh Qd 8c 8s 3h 2d'));
      expect(hand.rank).toBe(HandRank.FullHouse);
      expect(hand.tiebreakers).toEqual([12, 8]);
    });

    it('picks best full house from 7 cards', () => {
      // Two possible trips — should pick higher
      const hand = evaluateHand(cards('As Ah Ad Ks Kh Kd 2c'));
      expect(hand.rank).toBe(HandRank.FullHouse);
      expect(hand.tiebreakers[0]).toBe(14); // Aces full
    });

    it('detects flush', () => {
      const hand = evaluateHand(cards('As Ks 9s 7s 4s 3h 2d'));
      expect(hand.rank).toBe(HandRank.Flush);
      expect(hand.tiebreakers[0]).toBe(14);
    });

    it('detects straight', () => {
      const hand = evaluateHand(cards('9s 8h 7d 6c 5s 2h 3d'));
      expect(hand.rank).toBe(HandRank.Straight);
      expect(hand.tiebreakers[0]).toBe(9);
    });

    it('detects wheel (A-2-3-4-5)', () => {
      const hand = evaluateHand(cards('Ah 2c 3d 4s 5h Kc Qd'));
      expect(hand.rank).toBe(HandRank.Straight);
      expect(hand.tiebreakers[0]).toBe(5);
    });

    it('detects three of a kind', () => {
      const hand = evaluateHand(cards('Js Jh Jd 9c 7s 3h 2d'));
      expect(hand.rank).toBe(HandRank.ThreeOfAKind);
      expect(hand.tiebreakers[0]).toBe(11);
    });

    it('detects two pair', () => {
      const hand = evaluateHand(cards('Ks Kh 9d 9c 7s 3h 2d'));
      expect(hand.rank).toBe(HandRank.TwoPair);
      expect(hand.tiebreakers).toEqual([13, 9, 7]);
    });

    it('detects one pair', () => {
      const hand = evaluateHand(cards('Ts Th 9d 7c 5s 3h 2d'));
      expect(hand.rank).toBe(HandRank.OnePair);
      expect(hand.tiebreakers[0]).toBe(10);
    });

    it('detects high card', () => {
      const hand = evaluateHand(cards('As Kh 9d 7c 5s 3h 2d'));
      expect(hand.rank).toBe(HandRank.HighCard);
      expect(hand.tiebreakers[0]).toBe(14);
    });
  });

  describe('hand comparisons', () => {
    it('flush beats straight', () => {
      const flush = evaluateHand(cards('As Ks 9s 7s 4s 3h 2d'));
      const straight = evaluateHand(cards('9s 8h 7d 6c 5s 2h 3d'));
      expect(compareHands(flush, straight)).toBeGreaterThan(0);
    });

    it('higher pair beats lower pair', () => {
      const pairA = evaluateHand(cards('As Ah 9d 7c 5s 3h 2d'));
      const pairK = evaluateHand(cards('Ks Kh 9d 7c 5s 3h 2d'));
      expect(compareHands(pairA, pairK)).toBeGreaterThan(0);
    });

    it('kicker breaks pair tie', () => {
      const pairAK = evaluateHand(cards('As Ah Kd 7c 5s 3h 2d'));
      const pairAQ = evaluateHand(cards('As Ah Qd 7c 5s 3h 2d'));
      expect(compareHands(pairAK, pairAQ)).toBeGreaterThan(0);
    });

    it('identical hands tie', () => {
      const hand1 = evaluateHand(cards('As Kh Qd Js 9c 3h 2d'));
      const hand2 = evaluateHand(cards('Ac Kd Qs Jh 9s 3c 2h'));
      expect(compareHands(hand1, hand2)).toBe(0);
    });

    it('wheel loses to 6-high straight', () => {
      const wheel = evaluateHand(cards('Ah 2c 3d 4s 5h 9c 8d'));
      const sixHigh = evaluateHand(cards('6h 2c 3d 4s 5h 9c 8d'));
      expect(compareHands(sixHigh, wheel)).toBeGreaterThan(0);
    });

    it('two pair beats one pair', () => {
      const twoPair = evaluateHand(cards('Ks Kh 9d 9c 7s 3h 2d'));
      const onePair = evaluateHand(cards('As Ah 9d 7c 5s 3h 2d'));
      expect(compareHands(twoPair, onePair)).toBeGreaterThan(0);
    });

    it('full house beats flush', () => {
      const fullHouse = evaluateHand(cards('Qs Qh Qd 8c 8s 3h 2d'));
      const flush = evaluateHand(cards('As Ks 9s 7s 4s 3h 2d'));
      expect(compareHands(fullHouse, flush)).toBeGreaterThan(0);
    });

    it('community cards play results in tie', () => {
      // When all 5 community cards form the best hand
      const community = cards('As Ks Qs Js 9s');
      const hand1 = evaluateHand([...community, card('2h'), card('3d')]);
      const hand2 = evaluateHand([...community, card('4h'), card('5d')]);
      expect(compareHands(hand1, hand2)).toBe(0);
    });
  });

  describe('card notation helper', () => {
    it('parses card notation correctly', () => {
      expect(card('As')).toEqual({ rank: 14, suit: 'spades' });
      expect(card('Th')).toEqual({ rank: 10, suit: 'hearts' });
      expect(card('2c')).toEqual({ rank: 2, suit: 'clubs' });
      expect(card('Kd')).toEqual({ rank: 13, suit: 'diamonds' });
    });

    it('throws on invalid notation', () => {
      expect(() => card('Xx')).toThrow();
    });
  });
});
