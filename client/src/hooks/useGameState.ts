import { useState, useEffect, useCallback } from 'react';

export interface CardData {
  rank: number;
  suit: string;
}

export interface PlayerData {
  id: string;
  seatIndex: number;
  chips: number;
  holeCards: [CardData, CardData] | null;
  currentBet: number;
  hasFolded: boolean;
  isAllIn: boolean;
  isSittingOut: boolean;
  isConnected: boolean;
  hasActed: boolean;
}

export interface GameStateData {
  id: string;
  seats: (PlayerData | null)[];
  communityCards: CardData[];
  pot: number;
  sidePots: { amount: number; eligiblePlayerIds: string[] }[];
  street: string;
  dealerIndex: number;
  smallBlindIndex: number;
  bigBlindIndex: number;
  currentPlayerIndex: number;
  minRaise: number;
  blinds: { small: number; big: number };
  handNumber: number;
  isHandInProgress: boolean;
}

export interface ValidActionsData {
  canFold: boolean;
  canCheck: boolean;
  canCall: boolean;
  callAmount: number;
  canRaise: boolean;
  minRaise: number;
  maxRaise: number;
  canAllIn: boolean;
}

export interface TurnData {
  seatIndex: number;
  validActions: ValidActionsData;
  timeRemaining: number;
}

export interface WinnerData {
  seatIndex: number;
  odName: string;
  chipsWon: number;
  handName: string | null;
}

export interface ShowdownData {
  winners: WinnerData[];
}

export function useGameState(socket: any) {
  const [gameState, setGameState] = useState<GameStateData | null>(null);
  const [turnData, setTurnData] = useState<TurnData | null>(null);
  const [showdown, setShowdown] = useState<ShowdownData | null>(null);

  useEffect(() => {
    if (!socket) return;

    const handleState = (state: GameStateData) => {
      setGameState(state);
      // Clear showdown when a new hand starts
      if (state.isHandInProgress) {
        setShowdown(null);
      }
    };
    const handleTurn = (data: TurnData) => setTurnData(data);
    const handleShowdown = (data: ShowdownData) => {
      setTurnData(null);
      setShowdown(data);
    };

    socket.on('game:state', handleState);
    socket.on('turn:start', handleTurn);
    socket.on('game:showdown', handleShowdown);

    return () => {
      socket.off('game:state', handleState);
      socket.off('turn:start', handleTurn);
      socket.off('game:showdown', handleShowdown);
    };
  }, [socket]);

  return { gameState, turnData, showdown };
}
