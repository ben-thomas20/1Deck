import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

export interface Chunk {
  id: string;
  content: string;
  topic: string;
  difficulty: string;
  source: string;
}

const CHUNK_SIZE = 400;   // ~400 tokens target
const CHUNK_OVERLAP = 50; // ~50 tokens overlap

/**
 * Load and chunk all markdown knowledge base files.
 */
export function loadKnowledgeBase(knowledgeDir: string): Chunk[] {
  const files = readdirSync(knowledgeDir).filter(f => f.endsWith('.md'));
  const chunks: Chunk[] = [];

  for (const file of files) {
    const path = join(knowledgeDir, file);
    const content = readFileSync(path, 'utf-8');
    const topic = file.replace('.md', '').replace(/-/g, '_');
    const fileChunks = chunkText(content, topic, file);
    chunks.push(...fileChunks);
  }

  return chunks;
}

/**
 * Split text into overlapping chunks by sections (## headers) first,
 * then by approximate token count.
 */
function chunkText(text: string, topic: string, source: string): Chunk[] {
  const sections = splitBySections(text);
  const chunks: Chunk[] = [];
  let chunkIndex = 0;

  for (const section of sections) {
    const words = section.split(/\s+/);

    // If section is small enough, keep it as one chunk
    if (words.length <= CHUNK_SIZE) {
      chunks.push({
        id: `${topic}_${String(chunkIndex).padStart(3, '0')}`,
        content: section.trim(),
        topic,
        difficulty: inferDifficulty(section),
        source,
      });
      chunkIndex++;
      continue;
    }

    // Split large sections into overlapping chunks
    let start = 0;
    while (start < words.length) {
      const end = Math.min(start + CHUNK_SIZE, words.length);
      const chunkWords = words.slice(start, end);

      chunks.push({
        id: `${topic}_${String(chunkIndex).padStart(3, '0')}`,
        content: chunkWords.join(' ').trim(),
        topic,
        difficulty: inferDifficulty(chunkWords.join(' ')),
        source,
      });

      chunkIndex++;
      start += CHUNK_SIZE - CHUNK_OVERLAP;
    }
  }

  return chunks;
}

/**
 * Split markdown text by ## headers into logical sections.
 */
function splitBySections(text: string): string[] {
  const sections: string[] = [];
  const lines = text.split('\n');
  let current: string[] = [];

  for (const line of lines) {
    if (line.startsWith('## ') && current.length > 0) {
      sections.push(current.join('\n'));
      current = [line];
    } else {
      current.push(line);
    }
  }

  if (current.length > 0) {
    sections.push(current.join('\n'));
  }

  return sections;
}

function inferDifficulty(text: string): string {
  const lower = text.toLowerCase();
  if (lower.includes('advanced') || lower.includes('implied odds') || lower.includes('reverse implied')) {
    return 'intermediate';
  }
  if (lower.includes('GTO') || lower.includes('solver') || lower.includes('mixed strategy')) {
    return 'advanced';
  }
  return 'beginner';
}

/**
 * Store chunks with embeddings in PostgreSQL via pgvector.
 * This is a stub — actual implementation requires an embedding API call.
 */
export async function storeChunksWithEmbeddings(
  chunks: Chunk[],
  _embedFn: (text: string) => Promise<number[]>,
  _dbQuery: (sql: string, params: unknown[]) => Promise<void>
): Promise<void> {
  for (const chunk of chunks) {
    const embedding = await _embedFn(chunk.content);
    await _dbQuery(
      `INSERT INTO knowledge_chunks (id, content, topic, difficulty, source, embedding)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO UPDATE SET content = $2, embedding = $6`,
      [chunk.id, chunk.content, chunk.topic, chunk.difficulty, chunk.source, JSON.stringify(embedding)]
    );
  }
}
