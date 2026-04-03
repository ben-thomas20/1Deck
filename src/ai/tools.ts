/**
 * MCP-compatible tool definitions for the poker AI assistant.
 *
 * These tools are available to Claude during chat responses.
 * They provide reference data and calculations — no live game state access.
 */

export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, { type: string; description: string }>;
    required: string[];
  };
}

export const pokerTools: ToolDefinition[] = [
  {
    name: 'get_hand_rankings',
    description: 'Returns the poker hand rankings from highest to lowest with brief descriptions.',
    input_schema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'get_pot_odds',
    description: 'Calculate pot odds given pot size and bet to call. Returns the pot odds ratio and the minimum equity needed to call profitably.',
    input_schema: {
      type: 'object',
      properties: {
        potSize: { type: 'number', description: 'Current pot size in chips' },
        betToCall: { type: 'number', description: 'Amount needed to call' },
      },
      required: ['potSize', 'betToCall'],
    },
  },
];

/**
 * Execute a tool call and return the result.
 */
export function executeTool(name: string, input: Record<string, unknown>): string {
  switch (name) {
    case 'get_hand_rankings':
      return JSON.stringify({
        rankings: [
          { rank: 1, name: 'Royal Flush', description: 'A, K, Q, J, 10 all same suit' },
          { rank: 2, name: 'Straight Flush', description: 'Five consecutive cards, same suit' },
          { rank: 3, name: 'Four of a Kind', description: 'Four cards of the same rank' },
          { rank: 4, name: 'Full House', description: 'Three of a kind plus a pair' },
          { rank: 5, name: 'Flush', description: 'Five cards of the same suit' },
          { rank: 6, name: 'Straight', description: 'Five consecutive cards, mixed suits' },
          { rank: 7, name: 'Three of a Kind', description: 'Three cards of the same rank' },
          { rank: 8, name: 'Two Pair', description: 'Two different pairs' },
          { rank: 9, name: 'One Pair', description: 'Two cards of the same rank' },
          { rank: 10, name: 'High Card', description: 'No combination, highest card plays' },
        ],
      });

    case 'get_pot_odds': {
      const potSize = input.potSize as number;
      const betToCall = input.betToCall as number;

      if (betToCall <= 0) return JSON.stringify({ error: 'Bet to call must be positive' });

      const totalPot = potSize + betToCall;
      const potOddsRatio = totalPot / betToCall;
      const equityNeeded = (betToCall / totalPot) * 100;

      return JSON.stringify({
        potSize,
        betToCall,
        totalPotAfterCall: totalPot,
        potOddsRatio: `${potOddsRatio.toFixed(1)}:1`,
        equityNeeded: `${equityNeeded.toFixed(1)}%`,
        explanation: `You need to win more than ${equityNeeded.toFixed(1)}% of the time for this call to be profitable.`,
      });
    }

    default:
      return JSON.stringify({ error: `Unknown tool: ${name}` });
  }
}
