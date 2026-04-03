import type { RetrievedChunk } from './retriever';

const SYSTEM_PROMPT_BASE = `You are a friendly poker coach built into an online Texas Hold'em game.
You help new players learn poker fundamentals. You are conversational,
encouraging, and explain concepts clearly with examples.

Use the following reference material to inform your answers.
If the material doesn't cover the question, say so honestly
rather than guessing.

<context>
{CONTEXT}
</context>

Rules:
- Never give specific hand advice for an ongoing game
- Use examples with card notation (e.g., A♠ K♥)
- If asked about advanced topics, give a simplified answer and note it's a complex topic
- Keep responses concise (2-4 paragraphs max)
- If the user asks something unrelated to poker, politely redirect
- Be encouraging to beginners — poker has a learning curve and that's okay`;

/**
 * Build the system prompt with retrieved context chunks.
 */
export function buildSystemPrompt(chunks: RetrievedChunk[]): string {
  if (chunks.length === 0) {
    return SYSTEM_PROMPT_BASE.replace('{CONTEXT}', 'No specific reference material available for this question.');
  }

  const contextBlocks = chunks.map((chunk, i) => {
    return `[Source: ${chunk.source} | Topic: ${chunk.topic}]\n${chunk.content}`;
  });

  const context = contextBlocks.join('\n\n---\n\n');
  return SYSTEM_PROMPT_BASE.replace('{CONTEXT}', context);
}

/**
 * Build a message array for the Claude API call.
 */
export function buildMessages(
  systemPrompt: string,
  userMessage: string,
  conversationHistory: { role: 'user' | 'assistant'; content: string }[] = []
): { system: string; messages: { role: 'user' | 'assistant'; content: string }[] } {
  const messages = [
    ...conversationHistory.slice(-6), // keep last 3 exchanges for context
    { role: 'user' as const, content: userMessage },
  ];

  return { system: systemPrompt, messages };
}
