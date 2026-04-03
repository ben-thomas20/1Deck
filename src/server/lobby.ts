import { Server, Socket } from 'socket.io';
import { TableManager, TableInfo } from './table-manager';
import { SessionManager, Session } from './session';

const TABLE_LIST_INTERVAL = 2000; // broadcast table list every 2 seconds

export class LobbyManager {
  private io: Server;
  private sessionManager: SessionManager;
  private tables: Map<string, TableManager> = new Map();
  private broadcastInterval: NodeJS.Timeout | null = null;

  constructor(io: Server, sessionManager: SessionManager) {
    this.io = io;
    this.sessionManager = sessionManager;
  }

  /**
   * Start the lobby — set up Socket.IO event handlers and periodic broadcasts.
   */
  start(): void {
    this.io.on('connection', (socket: Socket) => {
      this.handleConnection(socket);
    });

    // Periodic table list broadcast
    this.broadcastInterval = setInterval(() => {
      this.broadcastTableList();
    }, TABLE_LIST_INTERVAL);
  }

  private async handleConnection(socket: Socket): Promise<void> {
    // Authenticate via token in handshake
    const token = socket.handshake.auth?.token as string;
    if (!token) {
      socket.emit('error', { message: 'Authentication required' });
      socket.disconnect();
      return;
    }

    const session = await this.sessionManager.getSessionByToken(token);
    if (!session) {
      socket.emit('error', { message: 'Invalid or expired session' });
      socket.disconnect();
      return;
    }

    // Attach session to socket data
    socket.data.session = session;
    socket.data.userId = session.userId;

    // Check for reconnect — player was at a table
    if (session.tableId) {
      const table = this.tables.get(session.tableId);
      if (table && table.isPlayerConnected(session.userId)) {
        table.handleReconnect(session.userId, socket);
        this.setupTableEventHandlers(socket, table, session);
        return;
      }
    }

    // Send current table list
    socket.emit('tables:list', this.getTableList());

    // Lobby events
    socket.on('tables:create', (data: { name: string; blinds?: { small: number; big: number } }) => {
      this.handleCreateTable(socket, session, data);
    });

    socket.on('tables:join', (data: { tableId: string; seatIndex: number }) => {
      this.handleJoinTable(socket, session, data);
    });

    socket.on('disconnect', () => {
      this.handleDisconnect(socket, session);
    });
  }

  private handleCreateTable(
    socket: Socket,
    session: Session,
    data: { name: string; blinds?: { small: number; big: number } }
  ): void {
    const name = data.name?.trim();
    if (!name || name.length < 1 || name.length > 30) {
      socket.emit('error', { message: 'Table name must be 1-30 characters' });
      return;
    }

    const blinds = data.blinds ?? { small: 10, big: 20 };

    const table = new TableManager(this.io, name, blinds, (tableId) => {
      this.tables.delete(tableId);
    });

    this.tables.set(table.id, table);

    socket.emit('tables:created', { tableId: table.id });
    this.broadcastTableList();
  }

  private async handleJoinTable(
    socket: Socket,
    session: Session,
    data: { tableId: string; seatIndex: number }
  ): Promise<void> {
    const table = this.tables.get(data.tableId);
    if (!table) {
      socket.emit('error', { message: 'Table not found' });
      return;
    }

    // Update session
    session.tableId = table.id;
    session.seatIndex = data.seatIndex;
    await this.sessionManager.updateSession(session);

    // Join the table
    table.joinTable(session, data.seatIndex, socket);

    // Set up table-specific event handlers
    this.setupTableEventHandlers(socket, table, session);

    this.broadcastTableList();
  }

  private setupTableEventHandlers(
    socket: Socket,
    table: TableManager,
    session: Session
  ): void {
    socket.on('action:fold', () => {
      table.handleAction(session.userId, { type: 'fold' });
    });

    socket.on('action:check', () => {
      table.handleAction(session.userId, { type: 'check' });
    });

    socket.on('action:call', () => {
      table.handleAction(session.userId, { type: 'call' });
    });

    socket.on('action:raise', (data: { amount: number }) => {
      table.handleAction(session.userId, { type: 'raise', amount: data.amount });
    });

    socket.on('action:allIn', () => {
      table.handleAction(session.userId, { type: 'all-in' });
    });

    socket.on('seat:leave', async () => {
      table.leaveTable(session.userId);
      session.tableId = null;
      session.seatIndex = null;
      await this.sessionManager.updateSession(session);
      socket.leave(table.id);
      this.broadcastTableList();
    });

    // Override the disconnect handler for table context
    socket.removeAllListeners('disconnect');
    socket.on('disconnect', () => {
      table.handleDisconnect(session.userId);
    });
  }

  private handleDisconnect(socket: Socket, session: Session): void {
    // If player is at a table, the table handles the disconnect
    if (session.tableId) {
      const table = this.tables.get(session.tableId);
      if (table) {
        table.handleDisconnect(session.userId);
      }
    }
  }

  // ─── Table List ─────────────────────────────────────────────

  private getTableList(): TableInfo[] {
    return Array.from(this.tables.values()).map(t => t.getTableInfo());
  }

  private broadcastTableList(): void {
    this.io.emit('tables:list', this.getTableList());
  }

  // ─── Cleanup ────────────────────────────────────────────────

  getTable(tableId: string): TableManager | undefined {
    return this.tables.get(tableId);
  }

  getTableCount(): number {
    return this.tables.size;
  }

  destroy(): void {
    if (this.broadcastInterval) clearInterval(this.broadcastInterval);
    for (const table of this.tables.values()) {
      table.destroy();
    }
    this.tables.clear();
  }
}
