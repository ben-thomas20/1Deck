import { v4 as uuidv4 } from 'uuid';

const SESSION_TTL = 60 * 60 * 24; // 24 hours
const RECONNECT_WINDOW = 60;       // 60 seconds

export interface Session {
  userId: string;
  username: string;
  token: string;
  tableId: string | null;
  seatIndex: number | null;
}

/**
 * Simple key-value store interface — allows Redis or in-memory backends.
 */
export interface KVStore {
  get(key: string): Promise<string | null>;
  setex(key: string, ttl: number, value: string): Promise<unknown>;
  del(key: string): Promise<unknown>;
}

/**
 * In-memory KV store for local development (no Redis needed).
 */
export class MemoryKVStore implements KVStore {
  private data = new Map<string, { value: string; expiresAt: number }>();

  async get(key: string): Promise<string | null> {
    const entry = this.data.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.data.delete(key);
      return null;
    }
    return entry.value;
  }

  async setex(key: string, ttl: number, value: string): Promise<void> {
    this.data.set(key, { value, expiresAt: Date.now() + ttl * 1000 });
  }

  async del(key: string): Promise<void> {
    this.data.delete(key);
  }
}

export class SessionManager {
  private store: KVStore;

  constructor(store: KVStore) {
    this.store = store;
  }

  async createSession(username: string): Promise<Session> {
    if (!this.isValidUsername(username)) {
      throw new Error('Username must be 3-16 chars, alphanumeric + underscores only');
    }

    const existingUserId = await this.store.get(`username:${username.toLowerCase()}`);
    if (existingUserId) {
      throw new Error('Username is already taken');
    }

    const userId = uuidv4();
    const token = uuidv4();

    const session: Session = {
      userId,
      username,
      token,
      tableId: null,
      seatIndex: null,
    };

    await this.store.setex(`session:${token}`, SESSION_TTL, JSON.stringify(session));
    await this.store.setex(`user:${userId}`, SESSION_TTL, JSON.stringify(session));
    await this.store.setex(`username:${username.toLowerCase()}`, SESSION_TTL, userId);

    return session;
  }

  async getSessionByToken(token: string): Promise<Session | null> {
    const data = await this.store.get(`session:${token}`);
    return data ? JSON.parse(data) : null;
  }

  async getSessionByUserId(userId: string): Promise<Session | null> {
    const data = await this.store.get(`user:${userId}`);
    return data ? JSON.parse(data) : null;
  }

  async updateSession(session: Session): Promise<void> {
    await this.store.setex(`session:${session.token}`, SESSION_TTL, JSON.stringify(session));
    await this.store.setex(`user:${session.userId}`, SESSION_TTL, JSON.stringify(session));
  }

  async destroySession(session: Session): Promise<void> {
    await this.store.del(`session:${session.token}`);
    await this.store.del(`user:${session.userId}`);
    await this.store.del(`username:${session.username.toLowerCase()}`);
  }

  markDisconnected(_session: Session, onExpire: () => void): NodeJS.Timeout {
    return setTimeout(onExpire, RECONNECT_WINDOW * 1000);
  }

  private isValidUsername(username: string): boolean {
    return /^[a-zA-Z0-9_]{3,16}$/.test(username);
  }
}
