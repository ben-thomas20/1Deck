import { Seat } from './Seat';
import { CommunityCards } from './CommunityCards';
import { Pot } from './Pot';
import type { GameStateData } from '../../hooks/useGameState';
import './PokerTable.css';

interface PokerTableProps {
  gameState: GameStateData | null;
  myUserId: string;
  playerNames: Map<string, string>;
  onSit: (seatIndex: number) => void;
}

export function PokerTable({ gameState, myUserId, playerNames, onSit }: PokerTableProps) {
  return (
    <div className="poker-table-container">
      <div className="poker-table">
        <div className="poker-table-felt">
          {/* Community cards */}
          <div className="table-center">
            {gameState && gameState.communityCards.length > 0 && (
              <CommunityCards cards={gameState.communityCards} />
            )}
            {gameState && gameState.pot > 0 && (
              <Pot amount={gameState.pot} />
            )}
          </div>
        </div>

        {/* Seats */}
        {Array.from({ length: 8 }, (_, i) => {
          const player = gameState?.seats[i] ?? null;
          const username = player ? (playerNames.get(player.id) ?? player.id.slice(0, 8)) : undefined;

          return (
            <Seat
              key={i}
              seatIndex={i}
              player={player}
              username={username}
              isDealer={gameState?.dealerIndex === i}
              isSmallBlind={gameState?.smallBlindIndex === i}
              isBigBlind={gameState?.bigBlindIndex === i}
              isCurrentTurn={gameState?.currentPlayerIndex === i && gameState?.isHandInProgress}
              isMyself={player?.id === myUserId}
              onSit={() => onSit(i)}
            />
          );
        })}
      </div>
    </div>
  );
}
