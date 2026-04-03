import type { Chunk } from './embeddings';

export interface RetrievedChunk extends Chunk {
  similarity: number;
}

/**
 * Retrieve the top-k most relevant chunks using pgvector cosine similarity.
 *
 * SQL query (for reference):
 *   SELECT id, content, topic, difficulty, source,
 *          1 - (embedding <=> $1::vector) as similarity
 *   FROM knowledge_chunks
 *   WHERE 1 - (embedding <=> $1::vector) > $2
 *   ORDER BY similarity DESC
 *   LIMIT $3
 */
export async function retrieveChunks(
  queryEmbedding: number[],
  dbQuery: (sql: string, params: unknown[]) => Promise<RetrievedChunk[]>,
  options: { topK?: number; minSimilarity?: number } = {}
): Promise<RetrievedChunk[]> {
  const { topK = 5, minSimilarity = 0.7 } = options;

  const sql = `
    SELECT id, content, topic, difficulty, source,
           1 - (embedding <=> $1::vector) as similarity
    FROM knowledge_chunks
    WHERE 1 - (embedding <=> $1::vector) > $2
    ORDER BY similarity DESC
    LIMIT $3
  `;

  return dbQuery(sql, [JSON.stringify(queryEmbedding), minSimilarity, topK]);
}

/**
 * Fallback retriever: simple keyword matching against in-memory chunks.
 * Used when pgvector is not available (e.g., development without PostgreSQL).
 */
export function retrieveByKeyword(
  query: string,
  chunks: Chunk[],
  topK = 5
): RetrievedChunk[] {
  const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);

  const scored = chunks.map(chunk => {
    const contentLower = chunk.content.toLowerCase();
    let score = 0;

    for (const word of queryWords) {
      if (contentLower.includes(word)) {
        score += 1;
        // Bonus for title/header matches
        if (contentLower.startsWith(`# ${word}`) || contentLower.includes(`## ${word}`)) {
          score += 2;
        }
      }
    }

    // Boost topic-level matches
    if (queryWords.some(w => chunk.topic.includes(w))) {
      score += 3;
    }

    return { ...chunk, similarity: score / Math.max(queryWords.length, 1) };
  });

  return scored
    .filter(c => c.similarity > 0)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK);
}
