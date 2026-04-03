import { PlayerState, SidePot } from './types';

/**
 * Calculate main pot and side pots from all players' bets in a hand.
 *
 * Algorithm:
 * 1. Collect all unique bet amounts from non-folded players
 * 2. Sort ascending
 * 3. For each tier, calculate: (tier_amount - previous_tier) × eligible_players
 * 4. Each tier creates a pot; players are only eligible for pots they contributed to
 *
 * Players who folded still contribute their bets to the pots but are not eligible to win.
 */
export function calculateSidePots(players: PlayerState[]): SidePot[] {
  // Get all players who put money in (including folded players)
  const contributors = players.filter(p => p.totalBetThisHand > 0);

  if (contributors.length === 0) return [];

  // Get unique bet amounts, sorted ascending
  const uniqueBets = [...new Set(contributors.map(p => p.totalBetThisHand))].sort((a, b) => a - b);

  const pots: SidePot[] = [];
  let previousTier = 0;

  for (const tierAmount of uniqueBets) {
    const tierDiff = tierAmount - previousTier;
    if (tierDiff <= 0) continue;

    // Players who contributed at this tier level (bet >= tierAmount)
    const contributorsAtTier = contributors.filter(p => p.totalBetThisHand >= tierAmount);
    const potAmount = tierDiff * contributorsAtTier.length;

    // Only non-folded players are eligible to win
    const eligiblePlayerIds = contributorsAtTier
      .filter(p => !p.hasFolded)
      .map(p => p.id);

    pots.push({
      amount: potAmount,
      eligiblePlayerIds,
    });

    previousTier = tierAmount;
  }

  return pots;
}

/**
 * Calculate total pot from all bets.
 */
export function calculateTotalPot(players: PlayerState[]): number {
  return players.reduce((sum, p) => sum + p.totalBetThisHand, 0);
}

/**
 * Merge side pots that have the same set of eligible players.
 */
export function mergeSidePots(pots: SidePot[]): SidePot[] {
  if (pots.length <= 1) return pots;

  const merged: SidePot[] = [];

  for (const pot of pots) {
    const key = [...pot.eligiblePlayerIds].sort().join(',');
    const existing = merged.find(m => [...m.eligiblePlayerIds].sort().join(',') === key);
    if (existing) {
      existing.amount += pot.amount;
    } else {
      merged.push({ ...pot });
    }
  }

  return merged;
}
