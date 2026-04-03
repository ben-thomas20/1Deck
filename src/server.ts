import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { SessionManager, MemoryKVStore, type KVStore } from './server/session';
import { LobbyManager } from './server/lobby';
import { ChatService } from './ai/chat-service';
import { ProfileStore } from './server/profile-store';
import { SHOP_CATALOG } from './server/shop-catalog';

const PORT = parseInt(process.env.PORT ?? '3001', 10);
const REDIS_URL = process.env.REDIS_URL;
const CORS_ORIGIN = process.env.CORS_ORIGIN ?? 'http://localhost:5173';
const __dirname = dirname(fileURLToPath(import.meta.url));

// ─── Express App ───────────────────────────────────────────────

const app = express();
app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json());

const httpServer = createServer(app);

// ─── Socket.IO ─────────────────────────────────────────────────

const io = new Server(httpServer, {
  cors: {
    origin: CORS_ORIGIN,
    methods: ['GET', 'POST'],
  },
});

// ─── Session Store (Redis if available, otherwise in-memory) ───

async function createStore(): Promise<KVStore> {
  if (REDIS_URL) {
    try {
      const Redis = (await import('ioredis')).default;
      const redis = new Redis(REDIS_URL, {
        maxRetriesPerRequest: 3,
        retryStrategy(times) {
          if (times > 3) return null;
          return Math.min(times * 200, 2000);
        },
        lazyConnect: true,
      });
      await redis.connect();
      console.log('Connected to Redis');
      return {
        get: (key) => redis.get(key),
        setex: (key, ttl, value) => redis.setex(key, ttl, value),
        del: (key) => redis.del(key),
      };
    } catch (err) {
      console.warn('Redis unavailable, falling back to in-memory store');
    }
  }
  console.log('Using in-memory session store (no Redis)');
  return new MemoryKVStore();
}

// ─── Boot ──────────────────────────────────────────────────────

async function main() {
  const store = await createStore();
  const sessionManager = new SessionManager(store);
  const lobbyManager = new LobbyManager(io, sessionManager);
  const profileStore = new ProfileStore();

  // AI Chat (only initialize if API key is set)
  let chatService: ChatService | null = null;
  if (process.env.ANTHROPIC_API_KEY) {
    chatService = new ChatService();
  }

  // ─── HTTP Routes ─────────────────────────────────────────────

  app.post('/api/join', async (req, res) => {
    try {
      const { username } = req.body;
      if (!username) {
        res.status(400).json({ error: 'Username is required' });
        return;
      }

      const session = await sessionManager.createSession(username);

      // Auto-create profile
      profileStore.getOrCreate(session.userId, session.username);

      res.json({
        token: session.token,
        userId: session.userId,
        username: session.username,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to join';
      res.status(400).json({ error: message });
    }
  });

  app.post('/api/chat', async (req, res) => {
    if (!chatService) {
      res.status(503).json({ error: 'AI assistant not configured (missing ANTHROPIC_API_KEY)' });
      return;
    }

    try {
      const { message, history } = req.body;
      if (!message || typeof message !== 'string') {
        res.status(400).json({ error: 'Message is required' });
        return;
      }

      const result = await chatService.chat(message, history ?? []);
      res.json({ response: result.response });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Chat failed';
      res.status(500).json({ error: msg });
    }
  });

  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      tables: lobbyManager.getTableCount(),
      uptime: process.uptime(),
    });
  });

  // ─── Profile Routes ──────────────────────────────────────────

  app.get('/api/profile/:userId', (req, res) => {
    const profile = profileStore.getProfile(req.params.userId);
    if (!profile) {
      res.status(404).json({ error: 'Profile not found' });
      return;
    }
    res.json(profile);
  });

  app.post('/api/profile', (req, res) => {
    const { userId, bio } = req.body;
    if (!userId || typeof bio !== 'string') {
      res.status(400).json({ error: 'userId and bio are required' });
      return;
    }
    const profile = profileStore.updateBio(userId, bio);
    if (!profile) {
      res.status(404).json({ error: 'Profile not found' });
      return;
    }
    res.json(profile);
  });

  app.post('/api/profile/chips', (req, res) => {
    const { userId } = req.body;
    if (!userId) {
      res.status(400).json({ error: 'userId is required' });
      return;
    }
    const result = profileStore.requestChips(userId);
    if (!result) {
      res.status(404).json({ error: 'Profile not found' });
      return;
    }
    if (result.error) {
      res.status(429).json({ error: result.error, profile: result.profile });
      return;
    }
    res.json(result.profile);
  });

  // ─── Shop Routes ─────────────────────────────────────────────

  app.get('/api/shop/catalog', (_req, res) => {
    res.json(SHOP_CATALOG);
  });

  app.post('/api/shop/purchase', (req, res) => {
    const { userId, itemId } = req.body;
    if (!userId || !itemId) {
      res.status(400).json({ error: 'userId and itemId are required' });
      return;
    }

    const item = SHOP_CATALOG.find(i => i.id === itemId);
    if (!item) {
      res.status(404).json({ error: 'Item not found' });
      return;
    }

    const result = profileStore.purchaseItem(userId, itemId, item.type, item.price);
    if (!result) {
      res.status(404).json({ error: 'Profile not found' });
      return;
    }
    if (result.error) {
      res.status(400).json({ error: result.error, profile: result.profile });
      return;
    }
    res.json({ item, profile: result.profile });
  });

  // ─── Serve Client (production) ────────────────────────────────

  const clientDist = join(__dirname, '..', 'client', 'dist');
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => {
    res.sendFile(join(clientDist, 'index.html'));
  });

  // ─── Start ───────────────────────────────────────────────────

  lobbyManager.start();

  httpServer.listen(PORT, () => {
    console.log(`1Deck poker server running on port ${PORT}`);
  });
}

main().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

export { app, io, httpServer };
