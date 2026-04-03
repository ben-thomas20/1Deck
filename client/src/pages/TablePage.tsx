import { useEffect, useState, useCallback } from 'react';
import { Socket } from 'socket.io-client';
import { PokerTable } from '../components/table/PokerTable';
import { ActionBar } from '../components/actions/ActionBar';
import { HoleCards } from '../components/cards/HoleCards';
import { ChatPanel } from '../components/chat/ChatPanel';
import { useGameState, type ValidActionsData } from '../hooks/useGameState';
import './TablePage.css';

interface TablePageProps {
  socket: Socket;
  userId: string;
  username: string;
  tableId: string;
  onLeave: () => void;
}

export function TablePage({ socket, userId, username, tableId, onLeave }: TablePageProps) {
  const { gameState, turnData, showdown } = useGameState(socket);
  const [playerNames, setPlayerNames] = useState<Map<string, string>>(new Map());
  const [chatOpen, setChatOpen] = useState(false);

  // Track player names from join events
  useEffect(() => {
    const handler = (data: { seatIndex: number; username: string }) => {
      setPlayerNames(prev => {
        const seat = gameState?.seats[data.seatIndex];
        if (seat) {
          const next = new Map(prev);
          next.set(seat.id, data.username);
          return next;
        }
        return prev;
      });
    };

    socket.on('player:joined', handler);
    return () => { socket.off('player:joined', handler); };
  }, [socket, gameState]);

  // Add our own name
  useEffect(() => {
    setPlayerNames(prev => {
      const next = new Map(prev);
      next.set(userId, username);
      return next;
    });
  }, [userId, username]);

  // Find my seat and determine if it's my turn
  const mySeat = gameState?.seats.find(s => s?.id === userId) ?? null;
  const isMyTurn =
    gameState?.isHandInProgress === true &&
    mySeat !== null &&
    gameState.currentPlayerIndex === mySeat.seatIndex;

  const validActions: ValidActionsData | null = isMyTurn ? turnData?.validActions ?? null : null;

  // Action handlers
  const handleFold = useCallback(() => socket.emit('action:fold'), [socket]);
  const handleCheck = useCallback(() => socket.emit('action:check'), [socket]);
  const handleCall = useCallback(() => socket.emit('action:call'), [socket]);
  const handleRaise = useCallback((amount: number) => socket.emit('action:raise', { amount }), [socket]);
  const handleAllIn = useCallback(() => socket.emit('action:allIn'), [socket]);

  const handleSit = useCallback(
    (seatIndex: number) => {
      socket.emit('tables:join', { tableId, seatIndex });
    },
    [socket, tableId]
  );

  const handleLeave = useCallback(() => {
    socket.emit('seat:leave');
    onLeave();
  }, [socket, onLeave]);

  return (
    <div className="table-page">
      {/* Header */}
      <header className="table-header">
        <button className="btn-back" onClick={handleLeave}>
          &larr; Leave Table
        </button>
        <div className="table-info-bar">
          {gameState && (
            <>
              <span className="info-item">
                Blinds: {gameState.blinds.small}/{gameState.blinds.big}
              </span>
              <span className="info-item">
                Hand #{gameState.handNumber}
              </span>
              <span className="info-item info-street">
                {gameState.isHandInProgress ? gameState.street.toUpperCase() : 'WAITING'}
              </span>
            </>
          )}
        </div>
        <span className="table-username">{username}</span>
      </header>

      {/* Table */}
      <PokerTable
        gameState={gameState}
        myUserId={userId}
        playerNames={playerNames}
        onSit={handleSit}
      />

      {/* Winner overlay */}
      {showdown && showdown.winners.length > 0 && (
        <div className="winner-overlay">
          {showdown.winners.map((w, i) => (
            <div key={i} className="winner-banner">
              <span className="winner-name">{w.odName}</span>
              <span className="winner-details">
                wins {w.chipsWon} chips
                {w.handName && <> with <strong>{w.handName}</strong></>}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* My hole cards (large, bottom center) */}
      {mySeat && !mySeat.hasFolded && (
        <div className="my-hole-cards">
          <HoleCards cards={mySeat.holeCards} size="lg" />
        </div>
      )}

      {/* Action bar */}
      <ActionBar
        validActions={validActions}
        isMyTurn={isMyTurn}
        onFold={handleFold}
        onCheck={handleCheck}
        onCall={handleCall}
        onRaise={handleRaise}
        onAllIn={handleAllIn}
      />

      {/* AI Chat Panel */}
      <ChatPanel isOpen={chatOpen} onToggle={() => setChatOpen(prev => !prev)} />
    </div>
  );
}
