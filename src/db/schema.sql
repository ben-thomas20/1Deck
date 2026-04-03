-- 1Deck Poker - PostgreSQL Schema

-- Enable pgvector extension (for AI assistant in Phase 4)
CREATE EXTENSION IF NOT EXISTS vector;

-- ─── Users ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY,
  username VARCHAR(16) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_username ON users (LOWER(username));

-- ─── Player Stats ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS player_stats (
  user_id UUID PRIMARY KEY REFERENCES users(id),
  hands_played INTEGER DEFAULT 0,
  hands_won INTEGER DEFAULT 0,
  total_winnings BIGINT DEFAULT 0,
  total_losses BIGINT DEFAULT 0,
  biggest_pot_won BIGINT DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Hand History ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS hand_history (
  id UUID PRIMARY KEY,
  table_id UUID NOT NULL,
  hand_number INTEGER NOT NULL,
  blinds_small INTEGER NOT NULL,
  blinds_big INTEGER NOT NULL,
  community_cards JSONB,  -- array of cards
  pot_total INTEGER NOT NULL,
  played_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_hand_history_table ON hand_history (table_id, hand_number);
CREATE INDEX idx_hand_history_played ON hand_history (played_at);

-- ─── Hand Players (who was in each hand) ──────────────────────

CREATE TABLE IF NOT EXISTS hand_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hand_id UUID NOT NULL REFERENCES hand_history(id),
  user_id UUID NOT NULL REFERENCES users(id),
  seat_index INTEGER NOT NULL,
  hole_cards JSONB,         -- [card, card]
  final_hand JSONB,         -- best 5-card hand at showdown
  hand_rank VARCHAR(20),    -- 'royal_flush', 'pair', etc.
  chips_start INTEGER NOT NULL,
  chips_end INTEGER NOT NULL,
  chips_won INTEGER DEFAULT 0,
  action_summary JSONB,     -- [{street, action, amount}]
  is_winner BOOLEAN DEFAULT FALSE
);

CREATE INDEX idx_hand_players_hand ON hand_players (hand_id);
CREATE INDEX idx_hand_players_user ON hand_players (user_id);

-- ─── AI Knowledge Embeddings (Phase 4) ────────────────────────

CREATE TABLE IF NOT EXISTS knowledge_chunks (
  id VARCHAR(50) PRIMARY KEY,
  content TEXT NOT NULL,
  topic VARCHAR(50) NOT NULL,
  difficulty VARCHAR(20) DEFAULT 'beginner',
  source VARCHAR(100),
  embedding vector(1536),   -- OpenAI text-embedding-3-small dimension
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_knowledge_embedding ON knowledge_chunks
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 10);
