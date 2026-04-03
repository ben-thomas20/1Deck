import { Server, Socket } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import {
  GameState,
  PlayerAction,
  PlayerState,
} from '../engine/types';
import {
  createInitialGameState,
  createPlayer,
  seatPlayer,
  removePlayer,
  dealNewHand,
  applyAction,
} from '../engine/game-state';
import { getValidActions, getActivePlayers } from '../engine/action-validator';
import { evaluateHand } from '../engine/hand-evaluator';
import { sanitizeGameState } from './sanitize';
import { TurnTimer } from './timer';
import { Session } from './session';

const DEAL_DELAY = 2000;        // 2 seconds between hands
const SHOWDOWN_DELAY = 5000;    // 5 seconds to show winner before next hand
const EMPTY_TABLE_TTL = 300_000; // 5 minutes before auto-delete

export interface TableInfo {
  id: string;
  name: string;
  blinds: { small: number; big: number };
  playerCount: number;
  maxPlayers: number;
  players: { seatIndex: number; username: string; chips: number }[];
  status: 'waiting' | 'playing';
}

interface ConnectedPlayer {
  session: Session;
  socket: Socket;
  seatIndex: number;
  disconnectTimer: NodeJS.Timeout | null;
}

export class TableManager {
  readonly id: string;
  readonly name: string;
  private io: Server;
  private gameState: GameState;
  private connectedPlayers: Map<string, ConnectedPlayer> = new Map(); // userId -> player
  private turnTimer: TurnTimer;
  private dealTimeout: NodeJS.Timeout | null = null;
  private emptyTableTimeout: NodeJS.Timeout | null = null;
  private onTableEmpty: ((tableId: string) => void) | null = null;
  private startingChips = 1000;

  constructor(
    io: Server,
    name: string,
    blinds: { small: number; big: number },
    onTableEmpty?: (tableId: string) => void
  ) {
    this.id = uuidv4();
    this.name = name;
    this.io = io;
    this.onTableEmpty = onTableEmpty ?? null;
    this.gameState = createInitialGameState(this.id, blinds);

    this.turnTimer = new TurnTimer({
      onWarning: (seatIndex, secondsRemaining) => {
        this.emitToTable('turn:warning', { seatIndex, secondsRemaining });
      },
      onTimeout: (seatIndex) => {
        this.handleTimeout(seatIndex);
      },
    });

    this.startEmptyTableTimer();
  }

  // ─── Player Management ─────────────────────────────────────

  joinTable(session: Session, seatIndex: number, socket: Socket): void {
    if (seatIndex < 0 || seatIndex >= 8) {
      socket.emit('error', { message: 'Invalid seat index' });
      return;
    }
    if (this.gameState.seats[seatIndex] !== null) {
      socket.emit('error', { message: 'Seat is occupied' });
      return;
    }

    // Check if player already at table
    if (this.connectedPlayers.has(session.userId)) {
      socket.emit('error', { message: 'Already seated at this table' });
      return;
    }

    // Seat the player in the engine
    const player = createPlayer(session.userId, seatIndex, this.startingChips);
    this.gameState = seatPlayer(this.gameState, player);

    // Track the connected player
    this.connectedPlayers.set(session.userId, {
      session,
      socket,
      seatIndex,
      disconnectTimer: null,
    });

    // Join Socket.IO room
    socket.join(this.id);

    // Cancel empty table timer
    if (this.emptyTableTimeout) {
      clearTimeout(this.emptyTableTimeout);
      this.emptyTableTimeout = null;
    }

    // Broadcast player joined
    this.emitToTable('player:joined', {
      seatIndex,
      username: session.username,
      chips: this.startingChips,
    });

    // Send current state to the joining player
    socket.emit('game:state', sanitizeGameState(this.gameState, session.userId));

    // Start game if enough players and no hand in progress
    if (!this.gameState.isHandInProgress) {
      this.tryStartHand();
    }
  }

  leaveTable(userId: string): void {
    const connected = this.connectedPlayers.get(userId);
    if (!connected) return;

    const seatIndex = connected.seatIndex;

    // If hand is in progress and it's their turn, auto-fold
    if (
      this.gameState.isHandInProgress &&
      this.gameState.currentPlayerIndex === seatIndex &&
      !this.gameState.seats[seatIndex]?.hasFolded
    ) {
      this.handleAction(userId, { type: 'fold' });
    }

    // Mark player as folded if hand in progress (they forfeit)
    if (this.gameState.isHandInProgress) {
      const seat = this.gameState.seats[seatIndex];
      if (seat && !seat.hasFolded) {
        seat.hasFolded = true;
      }
    }

    // Remove from engine
    this.gameState = removePlayer(this.gameState, seatIndex);

    // Clean up connection
    connected.socket.leave(this.id);
    if (connected.disconnectTimer) clearTimeout(connected.disconnectTimer);
    this.connectedPlayers.delete(userId);

    this.emitToTable('player:left', { seatIndex });

    // Delete table immediately when all players leave
    if (this.connectedPlayers.size === 0) {
      if (this.dealTimeout) clearTimeout(this.dealTimeout);
      if (this.onTableEmpty) {
        this.onTableEmpty(this.id);
      }
      return;
    }

    // Check active players — if hand in progress with 1 left, engine will handle it
    if (this.gameState.isHandInProgress) {
      const active = getActivePlayers(this.gameState);
      if (active.length <= 1) {
        // Force a fold action cycle to resolve
        this.broadcastState();
      }
    }
  }

  // ─── Player Actions ─────────────────────────────────────────

  handleAction(userId: string, action: PlayerAction): void {
    const connected = this.connectedPlayers.get(userId);
    if (!connected) return;

    const seatIndex = connected.seatIndex;

    // Verify it's this player's turn
    if (this.gameState.currentPlayerIndex !== seatIndex) {
      connected.socket.emit('error', { message: 'Not your turn' });
      return;
    }

    try {
      this.gameState = applyAction(this.gameState, action);
      this.turnTimer.clear();

      // Broadcast the action to all players
      this.emitToTable('game:action', {
        playerId: userId,
        seatIndex,
        action: action.type,
        amount: 'amount' in action ? action.amount : undefined,
      });

      // Broadcast updated state
      this.broadcastState();

      // Handle post-action state
      if (!this.gameState.isHandInProgress) {
        // Hand is over
        this.handleHandComplete();
      } else if (this.gameState.street !== 'showdown') {
        // Start timer for next player
        this.startTurnTimer();
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Invalid action';
      connected.socket.emit('error', { message });
    }
  }

  // ─── Disconnect / Reconnect ─────────────────────────────────

  handleDisconnect(userId: string): void {
    const connected = this.connectedPlayers.get(userId);
    if (!connected) return;

    const seatIndex = connected.seatIndex;
    const seat = this.gameState.seats[seatIndex];
    if (seat) seat.isConnected = false;

    // Pause timer if it's their turn
    if (this.gameState.currentPlayerIndex === seatIndex) {
      this.turnTimer.pause();
    }

    this.emitToTable('player:disconnected', { seatIndex });

    // Start 60-second reconnect window
    connected.disconnectTimer = setTimeout(() => {
      // Reconnect window expired — remove from table
      this.leaveTable(userId);
    }, 60_000);
  }

  handleReconnect(userId: string, newSocket: Socket): void {
    const connected = this.connectedPlayers.get(userId);
    if (!connected) return;

    // Cancel disconnect timer
    if (connected.disconnectTimer) {
      clearTimeout(connected.disconnectTimer);
      connected.disconnectTimer = null;
    }

    // Update socket
    connected.socket = newSocket;
    newSocket.join(this.id);

    const seatIndex = connected.seatIndex;
    const seat = this.gameState.seats[seatIndex];
    if (seat) seat.isConnected = true;

    // Resume timer if it's their turn
    if (this.gameState.currentPlayerIndex === seatIndex) {
      this.turnTimer.resume();
    }

    this.emitToTable('player:reconnected', { seatIndex });

    // Send full state to reconnecting player
    newSocket.emit('game:state', sanitizeGameState(this.gameState, userId));
  }

  // ─── Game Flow ──────────────────────────────────────────────

  private tryStartHand(): void {
    const seatedCount = this.gameState.seats.filter(
      s => s !== null && !s.isSittingOut
    ).length;

    if (seatedCount >= 2 && !this.gameState.isHandInProgress) {
      this.dealTimeout = setTimeout(() => {
        this.startNewHand();
      }, DEAL_DELAY);
    }
  }

  private startNewHand(): void {
    try {
      this.gameState = dealNewHand(this.gameState);

      this.emitToTable('game:newHand', {
        dealerIndex: this.gameState.dealerIndex,
        smallBlindIndex: this.gameState.smallBlindIndex,
        bigBlindIndex: this.gameState.bigBlindIndex,
        handNumber: this.gameState.handNumber,
      });

      this.broadcastState();

      if (this.gameState.isHandInProgress && this.gameState.street !== 'showdown') {
        this.startTurnTimer();
      } else {
        // Hand ended immediately (e.g., all-in blinds)
        this.handleHandComplete();
      }
    } catch (err) {
      // Not enough players or other issue — wait
      console.error('Failed to deal:', err);
    }
  }

  private handleHandComplete(): void {
    // Compute winner info for the showdown broadcast
    const winners: { seatIndex: number; odName: string; chipsWon: number; handName: string | null }[] = [];
    const activePlayers = getActivePlayers(this.gameState);

    for (const pot of this.gameState.sidePots) {
      for (const playerId of pot.eligiblePlayerIds) {
        const seat = this.gameState.seats.find(s => s?.id === playerId);
        if (!seat) continue;

        // Only show hand name if there was a contested showdown
        let handName: string | null = null;
        if (activePlayers.length > 1 && seat.holeCards && this.gameState.communityCards.length >= 5) {
          try {
            const allCards = [...seat.holeCards, ...this.gameState.communityCards];
            const evaluation = evaluateHand(allCards);
            handName = evaluation.name;
          } catch {}
        }

        const connected = this.connectedPlayers.get(playerId);
        const username = connected?.session.username ?? playerId.slice(0, 8);

        // Avoid duplicate entries
        if (!winners.some(w => w.seatIndex === seat.seatIndex)) {
          winners.push({
            seatIndex: seat.seatIndex,
            odName: username,
            chipsWon: pot.amount,
            handName,
          });
        }
      }
    }

    // Broadcast showdown with winner info
    this.emitToTable('game:showdown', {
      sidePots: this.gameState.sidePots,
      communityCards: this.gameState.communityCards,
      winners,
    });

    // Broadcast final state (reveals cards at showdown)
    this.broadcastState();

    // Wait for players to see the result, then clean up and deal
    this.dealTimeout = setTimeout(() => {
      // Remove busted players (0 chips)
      for (const seat of this.gameState.seats) {
        if (seat && seat.chips === 0 && !seat.isSittingOut) {
          const connected = this.connectedPlayers.get(seat.id);
          if (connected) {
            connected.socket.emit('game:busted', { message: 'You ran out of chips' });
            this.leaveTable(seat.id);
          }
        }
      }

      // Deal next hand
      this.tryStartHand();
    }, SHOWDOWN_DELAY);
  }

  private startTurnTimer(): void {
    const seatIndex = this.gameState.currentPlayerIndex;
    const seat = this.gameState.seats[seatIndex];
    if (!seat) return;

    // If player is disconnected, don't pause — they'll auto-fold on timeout
    if (!seat.isConnected) {
      // Still start the timer — they get the full 30s (or reconnect window)
    }

    this.turnTimer.start(seatIndex);

    // Get valid actions for this player
    const validActions = getValidActions(this.gameState);

    this.emitToTable('turn:start', {
      seatIndex,
      validActions: {
        canFold: validActions.canFold,
        canCheck: validActions.canCheck,
        canCall: validActions.canCall,
        callAmount: validActions.callAmount,
        canRaise: validActions.canRaise,
        minRaise: validActions.minRaise,
        maxRaise: validActions.maxRaise,
        canAllIn: validActions.canAllIn,
      },
      timeRemaining: 30,
    });
  }

  private handleTimeout(seatIndex: number): void {
    // Auto-check if legal, otherwise auto-fold
    const validActions = getValidActions(this.gameState);
    const seat = this.gameState.seats[seatIndex];
    if (!seat) return;

    this.emitToTable('turn:timeout', { seatIndex });

    if (validActions.canCheck) {
      this.handleAction(seat.id, { type: 'check' });
    } else {
      this.handleAction(seat.id, { type: 'fold' });
    }
  }

  // ─── Broadcasting ───────────────────────────────────────────

  private broadcastState(): void {
    for (const [userId, connected] of this.connectedPlayers) {
      const sanitized = sanitizeGameState(this.gameState, userId);
      connected.socket.emit('game:state', sanitized);
    }
  }

  private emitToTable(event: string, data: unknown): void {
    this.io.to(this.id).emit(event, data);
  }

  // ─── Table Info ─────────────────────────────────────────────

  getTableInfo(): TableInfo {
    const players: TableInfo['players'] = [];
    for (const [, connected] of this.connectedPlayers) {
      const seat = this.gameState.seats[connected.seatIndex];
      if (seat) {
        players.push({
          seatIndex: connected.seatIndex,
          username: connected.session.username,
          chips: seat.chips,
        });
      }
    }

    return {
      id: this.id,
      name: this.name,
      blinds: this.gameState.blinds,
      playerCount: this.connectedPlayers.size,
      maxPlayers: 8,
      players,
      status: this.gameState.isHandInProgress ? 'playing' : 'waiting',
    };
  }

  isPlayerConnected(userId: string): boolean {
    return this.connectedPlayers.has(userId);
  }

  getPlayerCount(): number {
    return this.connectedPlayers.size;
  }

  // ─── Cleanup ────────────────────────────────────────────────

  private startEmptyTableTimer(): void {
    this.emptyTableTimeout = setTimeout(() => {
      if (this.connectedPlayers.size === 0 && this.onTableEmpty) {
        this.onTableEmpty(this.id);
      }
    }, EMPTY_TABLE_TTL);
  }

  destroy(): void {
    this.turnTimer.clear();
    if (this.dealTimeout) clearTimeout(this.dealTimeout);
    if (this.emptyTableTimeout) clearTimeout(this.emptyTableTimeout);
    for (const [, connected] of this.connectedPlayers) {
      if (connected.disconnectTimer) clearTimeout(connected.disconnectTimer);
    }
  }
}
