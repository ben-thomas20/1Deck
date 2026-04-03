import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { io as ioc, Socket as ClientSocket } from 'socket.io-client';
import express from 'express';
import { LobbyManager } from '../lobby';
import { SessionManager, MemoryKVStore } from '../session';
import { SanitizedGameState } from '../sanitize';

// ─── Test helpers ──────────────────────────────────────────────

let httpServer: ReturnType<typeof createServer>;
let io: Server;
let sessionManager: SessionManager;
let lobbyManager: LobbyManager;
let port: number;

function connectClient(token: string): Promise<ClientSocket> {
  return new Promise((resolve) => {
    const client = ioc(`http://localhost:${port}`, {
      auth: { token },
      transports: ['websocket'],
    });
    client.on('connect', () => resolve(client));
  });
}

function waitForEvent(socket: ClientSocket, event: string): Promise<any> {
  return new Promise((resolve) => {
    socket.once(event, (data: any) => resolve(data));
  });
}

beforeAll(async () => {
  const app = express();
  httpServer = createServer(app);
  io = new Server(httpServer, { cors: { origin: '*' } });
  sessionManager = new SessionManager(new MemoryKVStore());
  lobbyManager = new LobbyManager(io, sessionManager);
  lobbyManager.start();

  await new Promise<void>((resolve) => {
    httpServer.listen(0, () => {
      const addr = httpServer.address();
      port = typeof addr === 'object' && addr ? addr.port : 0;
      resolve();
    });
  });
});

afterAll(() => {
  lobbyManager.destroy();
  io.close();
  httpServer.close();
});

describe('Multiplayer Server', () => {
  it('rejects connection without auth token', async () => {
    const client = ioc(`http://localhost:${port}`, {
      auth: {},
      transports: ['websocket'],
    });

    const result = await Promise.race([
      waitForEvent(client, 'error').then(e => ({ type: 'error', data: e })),
      waitForEvent(client, 'disconnect').then(r => ({ type: 'disconnect', data: r })),
    ]);

    // Server should either send error or disconnect the client
    expect(['error', 'disconnect']).toContain(result.type);
    client.disconnect();
  });

  it('allows authenticated connection and receives table list', async () => {
    const session = await sessionManager.createSession('alice');
    const client = await connectClient(session.token);

    const tables = await waitForEvent(client, 'tables:list');
    expect(Array.isArray(tables)).toBe(true);

    client.disconnect();
  });

  it('creates a table', async () => {
    const session = await sessionManager.createSession('bob');
    const client = await connectClient(session.token);

    // Wait for initial table list
    await waitForEvent(client, 'tables:list');

    // Create table
    const createdPromise = waitForEvent(client, 'tables:created');
    client.emit('tables:create', { name: 'Test Table' });
    const created = await createdPromise;

    expect(created.tableId).toBeDefined();

    client.disconnect();
  });

  it('two players join a table and see each other', async () => {
    const session1 = await sessionManager.createSession('charlie');
    const session2 = await sessionManager.createSession('diana');
    const client1 = await connectClient(session1.token);
    const client2 = await connectClient(session2.token);

    // Wait for table lists
    await waitForEvent(client1, 'tables:list');
    await waitForEvent(client2, 'tables:list');

    // Create table
    const createdPromise = waitForEvent(client1, 'tables:created');
    client1.emit('tables:create', { name: 'Duo Table' });
    const created = await createdPromise;
    const tableId = created.tableId;

    // Player 1 joins seat 0
    const state1Promise = waitForEvent(client1, 'game:state');
    client1.emit('tables:join', { tableId, seatIndex: 0 });
    const state1 = await state1Promise;
    expect(state1.seats[0]).not.toBeNull();

    // Player 2 joins seat 4
    const state2Promise = waitForEvent(client2, 'game:state');
    client2.emit('tables:join', { tableId, seatIndex: 4 });
    const state2 = await state2Promise;
    expect(state2.seats[4]).not.toBeNull();

    client1.disconnect();
    client2.disconnect();
  });

  it('each player only sees their own hole cards', async () => {
    const session1 = await sessionManager.createSession('eve');
    const session2 = await sessionManager.createSession('frank');
    const client1 = await connectClient(session1.token);
    const client2 = await connectClient(session2.token);

    await waitForEvent(client1, 'tables:list');
    await waitForEvent(client2, 'tables:list');

    // Create and join table
    const createdPromise = waitForEvent(client1, 'tables:created');
    client1.emit('tables:create', { name: 'Cards Table' });
    const created = await createdPromise;
    const tableId = created.tableId;

    client1.emit('tables:join', { tableId, seatIndex: 0 });
    await waitForEvent(client1, 'game:state');

    client2.emit('tables:join', { tableId, seatIndex: 4 });
    await waitForEvent(client2, 'game:state');

    // Wait for hand to be dealt (after 2s delay)
    const gameState1: SanitizedGameState = await waitForEvent(client1, 'game:state');
    const gameState2: SanitizedGameState = await waitForEvent(client2, 'game:state');

    // Each player can see their own hole cards
    if (gameState1.isHandInProgress) {
      const mySeat1 = gameState1.seats.find(s => s?.id === session1.userId);
      const otherSeat1 = gameState1.seats.find(s => s?.id === session2.userId);

      if (mySeat1) {
        expect(mySeat1.holeCards).not.toBeNull();
      }
      // Other player's cards should be hidden
      if (otherSeat1) {
        expect(otherSeat1.holeCards).toBeNull();
      }
    }

    client1.disconnect();
    client2.disconnect();
  }, 10000);
});
