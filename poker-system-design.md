# System Design: Online Texas Hold'em Poker

## Project Overview

A browser-based, real-time multiplayer Texas Hold'em poker site with play-money tables, casual username-only auth, and an AI-powered learning assistant. Designed for desktop (not mobile). Deployed on a self-hosted VPS.

**Stack**: Node.js + TypeScript (backend), React + TypeScript (frontend), Socket.IO (real-time), Redis (game state), PostgreSQL (persistence)

**Design Language**: Modern, elegant, classical — think private card room, not Vegas. Muted palette, serif/sans-serif type pairing, felt-green table, no neon or flashing animations.

---

## Phase 1: Core Game Engine (Pure Logic, No Networking)

Build the game engine as a **pure, deterministic state machine** with no side effects. This is the foundation everything else depends on — it must be correct before you write a single line of networking code.

### 1.1 Data Models

```
Card = { rank: 2-14 (14=Ace), suit: 'hearts'|'diamonds'|'clubs'|'spades' }
Deck = Card[] (52 cards, Fisher-Yates shuffle)

PlayerState = {
  id: string
  seatIndex: 0-7
  chips: number
  holeCards: [Card, Card] | null
  currentBet: number        // amount bet THIS STREET
  totalBetThisHand: number  // for side pot calculation
  hasFolded: boolean
  hasActed: boolean         // has acted this betting round
  isAllIn: boolean
  isSittingOut: boolean
  isConnected: boolean
}

GameState = {
  id: string
  seats: (PlayerState | null)[8]    // null = empty seat
  communityCards: Card[]            // 0, 3, 4, or 5 cards
  deck: Deck
  pot: number
  sidePots: SidePot[]
  street: 'preflop' | 'flop' | 'turn' | 'river' | 'showdown'
  dealerIndex: number               // seat index of button
  smallBlindIndex: number
  bigBlindIndex: number
  currentPlayerIndex: number        // whose turn it is
  minRaise: number                  // minimum legal raise amount
  lastRaiseAmount: number           // for calculating min raise
  blinds: { small: number, big: number }
  handNumber: number
}

SidePot = {
  amount: number
  eligiblePlayerIds: string[]
}

PlayerAction =
  | { type: 'fold' }
  | { type: 'check' }
  | { type: 'call' }
  | { type: 'raise', amount: number }  // total bet, NOT raise increment
  | { type: 'all-in' }
```

### 1.2 Game State Machine

The engine is a **pure function**: `(GameState, PlayerAction) => GameState`

Implement each transition carefully:

```
WAITING (< 2 players) -> DEAL (2+ players seated)
  - Assign dealer button (rotate clockwise each hand)
  - Post small blind, big blind (skip empty/sitting-out seats)
  - Deal 2 hole cards to each active player
  - Set currentPlayer to UTG (seat after big blind)

PREFLOP betting round:
  - Action order: UTG -> ... -> SB -> BB
  - BB gets option to raise if no one raised
  - Min raise = size of the big blind (first raise) or previous raise increment
  - Valid actions per player:
    - fold: always valid
    - check: valid ONLY if no outstanding bet (or player is BB and no raise)
    - call: match the current highest bet
    - raise: must be >= current bet + minRaise; cap is player's remaining chips
    - all-in: always valid (bet whatever chips remain)

Street transitions (PREFLOP -> FLOP -> TURN -> RIVER):
  - Trigger: all non-folded, non-all-in players have acted AND bets are equalized
  - Reset: currentBet = 0 for all players, hasActed = false
  - Deal community cards (3 for flop, 1 for turn, 1 for river)
  - Post-flop action starts left of dealer

SHOWDOWN:
  - Evaluate all remaining players' best 5-card hand from 7 cards
  - Award pot (handle split pots for ties)
  - Award side pots to eligible players only
  - Reveal cards (only if contested — players can muck if they lost)

Head-to-head (2 players) special rules:
  - Dealer posts small blind, other player posts big blind
  - Preflop: dealer acts first
  - Post-flop: dealer acts second (normal position rules)
```

### 1.3 Hand Evaluator

Evaluate the best 5-card poker hand from any 7 cards. There are C(7,5) = 21 combinations to check.

Hand rankings (highest to lowest):
1. Royal Flush
2. Straight Flush
3. Four of a Kind
4. Full House
5. Flush
6. Straight
7. Three of a Kind
8. Two Pair
9. One Pair
10. High Card

**Implementation approach**: Assign each hand a numeric rank. For comparison, use a tuple: `(handType, ...tiebreakers)` where tiebreakers are rank values in descending priority. For example:
- Full House: `(7, threeOfAKindRank, pairRank)`
- Two Pair: `(3, higherPairRank, lowerPairRank, kicker)`
- Flush: `(6, card1, card2, card3, card4, card5)` — all five cards matter for ties

**Edge cases to handle**:
- Ace-low straight (A-2-3-4-5, aka "the wheel")
- Split pots when hands are identical (compare all tiebreakers)
- Kicker comparison for one-pair, two-pair, trips, etc.
- Community cards play (all 5 board cards are the best hand — split pot among remaining players)

### 1.4 Side Pot Calculation

This is where most poker implementations break. Handle it correctly:

```
When a player goes all-in for less than the current bet:
1. Create a side pot for the difference
2. Main pot = all-in amount × number of contributors
3. Side pot = excess amounts from players who bet more
4. Multiple all-ins at different levels create multiple side pots

Algorithm:
1. Collect all unique bet amounts from players in the hand
2. Sort ascending
3. For each tier, calculate: (tier_amount - previous_tier) × eligible_players
4. Each tier creates a pot; players are only eligible for pots they contributed to
```

### 1.5 Testing the Engine

Write comprehensive unit tests BEFORE moving to Phase 2. Test:
- Complete hand from deal to showdown (every street)
- Every hand ranking + edge cases (wheel, steel wheel, split pot)
- Side pot scenarios (2-way all-in, 3-way with different stacks)
- Head-to-head blind posting and action order
- Invalid action rejection (raising less than min, checking when facing a bet)
- Dealer button rotation with empty seats
- All players fold to one remaining (no showdown)
- BB walks (everyone folds preflop to big blind)

**Test file structure**: `src/engine/__tests__/`

---

## Phase 2: Multiplayer Server + Lobby

### 2.1 Architecture

```
┌────────────────────────────────────────────────────┐
│                   Client (React)                    │
│  Socket.IO ←→ Game events, lobby state, chat       │
└─────────────────────┬──────────────────────────────┘
                      │ WebSocket
┌─────────────────────▼──────────────────────────────┐
│              Node.js / Express Server               │
│                                                     │
│  ┌──────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  Lobby   │  │ Table Manager │  │   AI Chat    │  │
│  │ Manager  │  │  (per table)  │  │   Service    │  │
│  └──────────┘  └──────────────┘  └──────────────┘  │
│                       │                             │
│            ┌──────────▼──────────┐                  │
│            │    Game Engine      │                   │
│            │  (pure state machine)│                  │
│            └─────────────────────┘                  │
└────────────────┬───────────────────────┬────────────┘
                 │                       │
          ┌──────▼──────┐         ┌──────▼──────┐
          │    Redis     │         │ PostgreSQL  │
          │ (game state, │         │ (users,     │
          │  sessions)   │         │  stats,     │
          └─────────────┘         │  history)   │
                                  └─────────────┘
```

### 2.2 Authentication (Username Only)

No email, no password. Just a username.

```
POST /api/join
Body: { username: string }
Response: { token: string, userId: string }

Rules:
- Username: 3-16 chars, alphanumeric + underscores
- Check uniqueness against active sessions (Redis), not permanent (allow reuse)
- Generate a session token (UUID v4) stored in Redis with TTL of 24h
- Token sent as auth header on Socket.IO connection
- If user disconnects, keep their seat reserved for 60 seconds (reconnect window)
- After 60s, auto-fold their hand and mark seat as empty
```

### 2.3 Lobby System

```
Socket.IO namespace: /lobby

Events (server -> client):
  'tables:list' -> TableInfo[]    // periodic broadcast every 2s
  'tables:update' -> TableInfo    // single table changed

Events (client -> server):
  'tables:create' -> { name, blinds }    // create new table
  'tables:join' -> { tableId, seatIndex } // join specific seat

TableInfo = {
  id: string
  name: string
  blinds: { small: number, big: number }
  playerCount: number
  maxPlayers: 8
  players: { seatIndex: number, username: string, chips: number }[]
  status: 'waiting' | 'playing'
}
```

### 2.4 Table / Game Socket Events

```
Socket.IO namespace: /table:{tableId}

Events (server -> client):
  'game:state'         -> sanitized GameState (hide other players' hole cards)
  'game:action'        -> { playerId, action }  // broadcast each action
  'game:newHand'       -> { dealerIndex, ... }
  'game:street'        -> { street, communityCards }
  'game:showdown'      -> { results, winners, hands }
  'game:potUpdate'     -> { pot, sidePots }
  'player:joined'      -> { seatIndex, username, chips }
  'player:left'        -> { seatIndex }
  'player:disconnected'-> { seatIndex }
  'player:reconnected' -> { seatIndex }
  'turn:start'         -> { seatIndex, validActions, timeRemaining }
  'turn:timeout'       -> { seatIndex }  // auto-fold/check

Events (client -> server):
  'action:fold'
  'action:check'
  'action:call'
  'action:raise'       -> { amount: number }
  'action:allIn'
  'seat:leave'
  'seat:sitOut'
  'seat:sitIn'

CRITICAL: Sanitize game state before sending to clients.
  - Each player only sees their own hole cards
  - Other players' cards are null until showdown
  - Deck is never sent to clients
```

### 2.5 Turn Timer

Each player has **30 seconds** to act. Implement server-side:

```
- Start timer when 'turn:start' is emitted
- Send 'turn:warning' at 10 seconds remaining
- On timeout: auto-check if legal, otherwise auto-fold
- Cancel timer if player acts
- Pause timer on disconnect (resume on reconnect within 60s window)
```

### 2.6 Table Manager Lifecycle

```
1. Table created -> status: 'waiting'
2. 2+ players seated -> deal first hand
3. Hand completes -> if 2+ players, deal next hand (2s delay)
4. Player count drops to 1 -> status: 'waiting'
5. All players leave -> table remains for 5 minutes, then auto-delete
6. Player disconnects mid-hand:
   - Keep seat reserved 60s
   - Auto-fold on their turn if still disconnected
   - After 60s, remove from seat
```

---

## Phase 3: Frontend / UI

### 3.1 Design System

**Aesthetic**: Private poker club. Think dark wood, green felt, warm lighting. Not a casino — a gentleman's card room.

**Color Palette**:
```css
--bg-deep:       #0B1117;      /* main background — near black with blue undertone */
--bg-surface:    #151D27;      /* cards, panels */
--bg-elevated:   #1C2733;      /* hover states, modals */
--felt-green:    #1A5C3A;      /* table felt */
--felt-dark:     #0F3622;      /* table felt shadow/edge */
--gold-accent:   #C9A84C;      /* primary accent — buttons, highlights, pot amount */
--gold-muted:    #8B7A3E;      /* secondary gold */
--text-primary:  #E8E2D6;      /* warm white — not pure white */
--text-secondary:#8A9AAF;      /* muted info text */
--text-dim:      #4A5568;      /* disabled, empty seats */
--red-suit:      #C44040;      /* hearts/diamonds */
--white-suit:    #E8E2D6;      /* spades/clubs */
--chip-red:      #B83030;
--chip-blue:     #2B5F9E;
--chip-green:    #2B7A4B;
--chip-black:    #2D2D2D;
--chip-white:    #D4CFC4;
--danger:        #9B2C2C;      /* fold button */
--success:       #276749;      /* call/check */
```

**Typography**:
- Display / headers: `"Playfair Display", serif` — elegant, editorial
- Body / UI: `"DM Sans", sans-serif` — clean, modern, legible
- Card values: `"JetBrains Mono", monospace` — sharp, readable at small sizes

**Spacing**: 4px base grid. Use multiples of 4 everywhere.

### 3.2 Page Structure

```
App
├── LoginPage          (username entry → join lobby)
├── LobbyPage          (table list, create table)
└── TablePage          (the game)
    ├── TableCanvas    (the oval table + community cards + pot)
    ├── SeatSlots[8]   (player avatars, chips, actions around table)
    ├── PlayerHand     (your hole cards, bottom center)
    ├── ActionBar      (fold/check/call/raise + slider)
    ├── ChatPanel      (collapsible side panel — table chat + AI assistant)
    └── HandHistory    (collapsible, shows last N hands)
```

### 3.3 Table Layout

The table is a **rounded rectangle** (not oval, not circle) centered on screen. Wider than it is tall, roughly 3:2 aspect ratio. Green felt gradient background with subtle inner shadow to create depth.

Seat positions around the rectangle (clockwise from bottom-center):

```
              [Seat 3]    [Seat 4]
        [Seat 2]                [Seat 5]
        [Seat 1]                [Seat 6]
              [Seat 0]    [Seat 7]
                  ▲
            (you sit here by default)
```

Each seat slot shows:
- **Empty**: Dashed border outline, "Sit" button on hover
- **Occupied**: Username, chip count, avatar (generated from initials), dealer/SB/BB chip
- **Current turn**: Subtle gold glow/ring animation, timer arc
- **Folded**: Dimmed, cards face down
- **All-in**: "ALL IN" badge, slightly different styling
- **Disconnected**: Greyed out with disconnected icon

### 3.4 Card Design

Cards should feel premium. Design them with CSS:
- White/off-white card face with very subtle texture
- Rounded corners (8px)
- Soft drop shadow
- Rank + suit top-left and bottom-right (rotated)
- Large center suit pip
- Red suits (#C44040), black suits (#1C2733)
- Card back: Dark pattern with subtle repeating motif (diamonds or similar)
- Deal animation: Cards slide from deck position to player positions with slight rotation

### 3.5 Action Bar (Bottom of Screen)

Only visible when it's your turn. Slides up with a subtle animation.

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  [FOLD]     [CHECK/CALL $XX]     [RAISE]    [ALL IN]   │
│                                                         │
│              ──────●──────────  [$150]                  │
│              min          max   (raise input)           │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

- FOLD: muted red, always available
- CHECK: green, shown when no outstanding bet
- CALL: green, shows amount needed, shown when facing a bet
- RAISE: gold accent, opens a slider + text input for amount
- ALL IN: distinct styling, always available
- Raise slider: min = minRaise, max = your chip stack
- Keyboard shortcuts: F=fold, C=check/call, R=raise, A=all-in
- Timer arc visible on player's own seat

### 3.6 Animations

Keep it refined — no particle effects or screen shakes:
- **Card deal**: Cards slide from a deck position near the dealer to each player seat, staggered 100ms apart, slight rotation
- **Community cards**: Slide to center, flip from back to front
- **Chip movement**: Chips slide from player to pot on bet, pot to winner on award
- **Pot award**: Brief gold shimmer on winner, chips slide from pot center
- **Fold**: Cards slide back to center and fade
- **Turn indicator**: Gold ring pulses gently on current player's seat
- **Timer**: Circular arc depletes around player avatar; turns amber < 10s, red < 5s

### 3.7 Responsive (Desktop Only)

Minimum width: 1024px. Optimized for 1440px+. Show a "this site is designed for desktop" message on viewports < 1024px width. The table scales proportionally within the viewport.

---

## Phase 4: AI Poker Assistant

### 4.1 Overview

A chat-based assistant embedded in the game UI (collapsible side panel). Helps new players learn Texas Hold'em fundamentals: hand rankings, position play, pot odds, betting strategy, terminology.

**Not** a real-time advisor that watches your hand and tells you what to do. It's a learning tool you can ask questions to at any time.

### 4.2 Architecture

```
┌────────────────────────────────────────┐
│        Chat Panel (React)              │
│  User types question → POST /api/chat  │
└──────────────────┬─────────────────────┘
                   │
┌──────────────────▼─────────────────────┐
│          Chat Service (server)          │
│                                         │
│  1. Embed user query                    │
│  2. Vector search against poker guides  │
│  3. Build prompt with retrieved context │
│  4. Call Claude API (Sonnet)            │
│  5. Return response                     │
└──────────────────┬─────────────────────┘
                   │
         ┌─────────┴──────────┐
         │                    │
   ┌─────▼──────┐     ┌──────▼──────┐
   │  Vector DB  │     │ Claude API  │
   │ (pgvector)  │     │  (Sonnet)   │
   └─────────────┘     └─────────────┘
```

### 4.3 RAG Pipeline

**Knowledge Base** (poker guides to chunk and embed):
- Hand rankings and starting hand charts
- Position strategy (early, middle, late, blinds)
- Pot odds and implied odds calculations
- Betting concepts (continuation bet, value bet, bluff, semi-bluff)
- Common beginner mistakes
- Tournament vs. cash game differences
- Poker terminology glossary

**Chunking Strategy**:
- Split guides into ~300-500 token chunks with ~50 token overlap
- Each chunk gets metadata: `{ topic, difficulty, source }`
- Embed with a lightweight model (e.g., `text-embedding-3-small` via OpenAI, or a local model)

**Storage**: PostgreSQL with `pgvector` extension (you already have PG in the stack)

**Retrieval**:
1. Embed the user's question
2. Cosine similarity search, top 5 chunks
3. Filter by relevance threshold (> 0.7 similarity)
4. Inject into Claude's system prompt as context

### 4.4 Prompt Design

```
System prompt:
"You are a friendly poker coach built into an online Texas Hold'em game.
You help new players learn poker fundamentals. You are conversational,
encouraging, and explain concepts clearly with examples.

Use the following reference material to inform your answers.
If the material doesn't cover the question, say so honestly
rather than guessing.

<context>
{retrieved_chunks}
</context>

Rules:
- Never give specific hand advice for an ongoing game
- Use examples with card notation (e.g., A♠ K♥)
- If asked about advanced topics, give a simplified answer
  and note it's a complex topic
- Keep responses concise (2-4 paragraphs max)
- If the user asks something unrelated to poker, politely redirect"
```

### 4.5 MCP Integration (Future Extension Point)

Design the chat service with an MCP-compatible tool interface so it **could** later access game data. For now, stub the tools but don't connect them to live game state:

```typescript
// src/ai/tools.ts — MCP tool definitions (stubs for now)

const pokerTools = {
  get_hand_rankings: {
    description: "Returns the poker hand rankings from highest to lowest",
    // No live data needed — pure reference
  },
  get_pot_odds: {
    description: "Calculate pot odds given pot size and bet to call",
    parameters: { potSize: "number", betToCall: "number" }
    // Pure math — no game state needed
  },
  // FUTURE: These would connect to live game state via MCP
  // get_player_stats: { ... }
  // get_hand_history: { ... }
  // get_current_table_state: { ... }
}
```

This gives you the MCP architecture and tool-use patterns for your portfolio without requiring the AI to access live game data.

### 4.6 Evaluation Framework

Build a test harness to measure the assistant's accuracy:

**Eval Set Structure**:
```json
{
  "id": "eval_001",
  "category": "hand_rankings",
  "question": "Is a flush better than a straight?",
  "expected_answer_contains": ["flush", "beats", "straight", "higher"],
  "expected_answer_not_contains": ["straight beats flush"],
  "difficulty": "beginner",
  "source_chunk_ids": ["hr_003", "hr_004"]
}
```

**Eval Categories**:
1. **Factual accuracy** — hand rankings, rules, terminology (binary correct/incorrect)
2. **Concept explanation** — pot odds, position, betting (graded 1-5 by rubric)
3. **Refusal quality** — does it decline to give live hand advice? (binary)
4. **Retrieval relevance** — did it pull the right chunks? (precision/recall)
5. **Hallucination detection** — does it invent rules or statistics? (binary)

**Eval Runner**:
```typescript
// src/ai/eval/runner.ts
interface EvalResult {
  evalId: string
  passed: boolean
  response: string
  retrievedChunks: string[]
  latencyMs: number
  details: string  // why it passed/failed
}

// Run all evals, output a report:
// Total: 50/60 passed (83.3%)
// By category:
//   hand_rankings: 15/15 (100%)
//   pot_odds: 10/12 (83%)
//   refusal: 8/8 (100%)
//   ...
```

**Eval Set Size Target**: Start with 50-80 eval cases across all categories. Expand as you find failure modes.

---

## Phase 5: Deployment

### 5.1 VPS Setup (DigitalOcean / Railway)

```
Production Stack:
- Node.js app (Express + Socket.IO) — single process is fine to start
- PostgreSQL (managed DB or self-hosted)
- Redis (managed or self-hosted)
- Nginx reverse proxy (WebSocket upgrade support, SSL termination)
- Let's Encrypt for SSL

docker-compose.yml:
  services:
    app:        Node.js server
    postgres:   PostgreSQL 16 + pgvector
    redis:      Redis 7
    nginx:      Reverse proxy + SSL
```

### 5.2 Environment Variables

```
NODE_ENV=production
PORT=3001
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
ANTHROPIC_API_KEY=sk-ant-...   (for AI assistant)
SESSION_SECRET=...
CORS_ORIGIN=https://yourdomain.com
```

---

## Project Structure

```
poker/
├── package.json
├── tsconfig.json
├── docker-compose.yml
├── .env.example
├── nginx/
│   └── default.conf
├── src/
│   ├── server.ts                  # Express + Socket.IO bootstrap
│   ├── engine/                    # Phase 1 — pure game logic
│   │   ├── types.ts               # All data models
│   │   ├── deck.ts                # Shuffle, deal
│   │   ├── hand-evaluator.ts      # 7-card to best 5-card evaluation
│   │   ├── game-state.ts          # State machine transitions
│   │   ├── pot-calculator.ts      # Main pot + side pot math
│   │   ├── action-validator.ts    # Is this action legal?
│   │   └── __tests__/             # Comprehensive unit tests
│   │       ├── hand-evaluator.test.ts
│   │       ├── game-state.test.ts
│   │       ├── pot-calculator.test.ts
│   │       └── integration.test.ts
│   ├── server/                    # Phase 2 — networking
│   │   ├── lobby.ts               # Lobby namespace + table listing
│   │   ├── table-manager.ts       # Per-table Socket.IO room + game loop
│   │   ├── session.ts             # Username-based auth + Redis sessions
│   │   ├── sanitize.ts            # Strip private info from game state
│   │   └── timer.ts               # Turn timer management
│   ├── ai/                        # Phase 4 — AI assistant
│   │   ├── chat-service.ts        # RAG pipeline orchestrator
│   │   ├── embeddings.ts          # Chunk + embed poker guides
│   │   ├── retriever.ts           # pgvector similarity search
│   │   ├── prompt.ts              # System prompt builder
│   │   ├── tools.ts               # MCP tool stubs
│   │   └── eval/
│   │       ├── eval-set.json      # Test cases
│   │       ├── runner.ts          # Eval harness
│   │       └── report.ts          # Results formatting
│   ├── db/
│   │   ├── schema.sql             # PostgreSQL schema
│   │   └── migrations/
│   └── knowledge/                 # Poker guide source files
│       ├── hand-rankings.md
│       ├── position-strategy.md
│       ├── pot-odds.md
│       ├── betting-concepts.md
│       └── glossary.md
├── client/                        # React frontend
│   ├── package.json
│   ├── tsconfig.json
│   ├── src/
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   ├── styles/
│   │   │   └── theme.css          # CSS variables, global styles
│   │   ├── pages/
│   │   │   ├── LoginPage.tsx
│   │   │   ├── LobbyPage.tsx
│   │   │   └── TablePage.tsx
│   │   ├── components/
│   │   │   ├── table/
│   │   │   │   ├── PokerTable.tsx      # The green felt table
│   │   │   │   ├── Seat.tsx            # Player seat component
│   │   │   │   ├── CommunityCards.tsx
│   │   │   │   ├── Pot.tsx
│   │   │   │   └── DealerButton.tsx
│   │   │   ├── cards/
│   │   │   │   ├── Card.tsx            # Single card (CSS-drawn)
│   │   │   │   ├── CardBack.tsx
│   │   │   │   └── HoleCards.tsx       # Your two cards
│   │   │   ├── actions/
│   │   │   │   ├── ActionBar.tsx       # Fold/Check/Call/Raise
│   │   │   │   └── RaiseSlider.tsx
│   │   │   ├── chat/
│   │   │   │   ├── ChatPanel.tsx       # Table chat + AI assistant tabs
│   │   │   │   └── AIChatTab.tsx
│   │   │   ├── lobby/
│   │   │   │   ├── TableList.tsx
│   │   │   │   └── CreateTableModal.tsx
│   │   │   └── common/
│   │   │       ├── ChipStack.tsx
│   │   │       ├── Timer.tsx
│   │   │       └── Avatar.tsx
│   │   ├── hooks/
│   │   │   ├── useSocket.ts
│   │   │   ├── useGameState.ts
│   │   │   └── useTimer.ts
│   │   └── utils/
│   │       ├── card-utils.ts
│   │       └── format.ts
│   └── public/
│       └── index.html
```

---

## Claude Code Implementation Plan

Use this section as your actual prompt/instructions when working in Claude Code. Tackle each phase as a block — don't move to the next phase until the current one passes its acceptance criteria.

### Phase 1 Instructions (Game Engine)

```
Build the poker game engine in src/engine/. This is pure TypeScript with
zero dependencies on networking, UI, or databases.

Start with types.ts — define all data models exactly as specified in the
system design (Card, Deck, PlayerState, GameState, SidePot, PlayerAction).

Then implement in this order:
1. deck.ts — Fisher-Yates shuffle, deal function
2. hand-evaluator.ts — evaluate best 5 from 7 cards, compare hands
3. pot-calculator.ts — main pot + side pot calculation
4. action-validator.ts — given GameState, return valid actions for current player
5. game-state.ts — the state machine: applyAction(state, action) => newState

Write tests alongside each file. The engine is not done until:
- All hand rankings evaluate correctly (including wheel, split pots)
- A full hand can run from deal to showdown programmatically
- Side pots calculate correctly for 3+ player all-in scenarios
- Every invalid action is rejected with a clear error
- Head-to-head special rules work correctly

Do NOT write any networking code, UI code, or database code in this phase.
```

### Phase 2 Instructions (Server + Multiplayer)

```
Build the multiplayer server in src/server/. Use Express for HTTP and
Socket.IO for real-time communication.

1. session.ts — username-based auth with Redis sessions
2. lobby.ts — Socket.IO namespace for table listing and creation
3. table-manager.ts — wraps the game engine, manages per-table game loop
4. sanitize.ts — strip hole cards and deck from state before broadcasting
5. timer.ts — 30-second turn timer with auto-fold

The table manager is the critical piece. It:
- Creates a game engine instance per table
- Listens for player actions via Socket.IO
- Validates actions through the engine
- Broadcasts sanitized state to all players at the table
- Handles disconnect/reconnect (60s grace period)
- Auto-deals next hand after 2-second delay

Test with multiple Socket.IO clients connecting to the same table.
Verify that each client only sees their own hole cards.
```

### Phase 3 Instructions (Frontend)

```
Build the React frontend in client/. Use Vite as the build tool.

Start with the design system — implement theme.css with all CSS variables
from the system design. Import Playfair Display and DM Sans from Google Fonts.

Build in this order:
1. LoginPage — simple username form, connect to server
2. LobbyPage — list of tables, create table button
3. TablePage — the main game view
   a. PokerTable component (the green felt rectangle)
   b. Seat components (8 positions around the table)
   c. Card components (CSS-drawn, no images)
   d. ActionBar (fold/check/call/raise with slider)
   e. Pot display and chip animations
   f. Timer display

Cards should be drawn purely with CSS — no card images. This gives you full
control over styling and animation. Each card is a div with rank and suit
displayed in the corners and a larger suit in the center.

For the table felt: use a radial gradient from --felt-green center to
--felt-dark edges, with a subtle inner box-shadow for depth. Add a thin
gold (--gold-muted) border or rail around the table edge.

Keyboard shortcuts: F=fold, C=check/call, R=open raise slider, A=all-in.
```

### Phase 4 Instructions (AI Assistant)

```
Build the AI poker assistant in src/ai/.

1. Write the poker knowledge base files in src/knowledge/ (markdown format).
   Cover: hand rankings, position, pot odds, betting concepts, terminology.

2. embeddings.ts — chunk the markdown files and store embeddings in PostgreSQL
   with pgvector. Use ~400 token chunks with 50 token overlap.

3. retriever.ts — cosine similarity search, return top 5 relevant chunks.

4. prompt.ts — build the system prompt with retrieved context.

5. chat-service.ts — orchestrate: embed query -> retrieve -> prompt -> Claude API call.

6. Add the chat endpoint: POST /api/chat { message: string } -> { response: string }

7. Build the eval framework in src/ai/eval/:
   - eval-set.json with 50+ test cases across categories
   - runner.ts to execute evals and produce a pass/fail report
   - Categories: factual accuracy, concept explanation, refusal quality,
     retrieval relevance, hallucination detection

8. tools.ts — define MCP-compatible tool stubs (get_hand_rankings, get_pot_odds).
   Wire them into the Claude API call as available tools. They don't need
   to access live game state — they're reference/calculation tools.

The AI assistant should be conversational and encouraging, never condescending.
It should refuse to give advice on live hands.
```

---

## Key Gotchas and Reminders

1. **The game engine must be pure.** No `Date.now()`, no `Math.random()` without seed injection, no side effects. Pass in a random seed or pre-shuffled deck for testability.

2. **Side pots are the hardest part of the engine.** Don't skip edge cases. A 3-way all-in where all three players have different stack sizes creates 3 pots.

3. **Sanitize EVERYTHING going to clients.** Never send the deck, never send other players' hole cards. The server is the single source of truth.

4. **Socket.IO rooms map 1:1 to tables.** When a player joins a table, they join a Socket.IO room. All game events are emitted to the room.

5. **The turn timer is server-authoritative.** Don't trust the client's timer. The server counts down and auto-acts.

6. **Cards are CSS, not images.** This keeps the project self-contained and makes animations trivial.

7. **Start with 1 blind level** (e.g., 10/20) and 1000 starting chips. Don't build blind escalation or buy-in systems until the base game works perfectly.

8. **The AI assistant is isolated.** It doesn't read game state. It's a separate chat service that happens to live in the same UI. This simplifies everything.

9. **Test the engine with scripted games.** Write a test that plays an entire 8-player hand with predetermined actions and verify the final state matches expectations.

10. **Head-to-head rules are different.** The dealer is the small blind and acts first preflop but second post-flop. Many implementations get this wrong.
