import { Avatar } from '../common/Avatar';
import { HoleCards } from '../cards/HoleCards';
import { ChipStack } from '../common/ChipStack';
import { formatChips } from '../../utils/card-utils';
import { useTimer } from '../../hooks/useTimer';
import type { PlayerData } from '../../hooks/useGameState';
import './Seat.css';

interface SeatProps {
  player: PlayerData | null;
  username?: string;
  seatIndex: number;
  isDealer: boolean;
  isSmallBlind: boolean;
  isBigBlind: boolean;
  isCurrentTurn: boolean;
  isMyself: boolean;
  onSit?: () => void;
}

export function Seat({
  player,
  username,
  seatIndex,
  isDealer,
  isSmallBlind,
  isBigBlind,
  isCurrentTurn,
  isMyself,
  onSit,
}: SeatProps) {
  // Hooks must be called unconditionally (before early return)
  const { remaining, fraction } = useTimer(30, isCurrentTurn);

  // Empty seat
  if (!player) {
    return (
      <div
        className={`seat seat--empty seat--pos-${seatIndex}`}
        onClick={onSit}
      >
        <div className="seat-empty-content">
          <span className="seat-empty-label">Sit</span>
        </div>
      </div>
    );
  }

  const displayName = username ?? player.id.slice(0, 8);
  const dimmed = player.hasFolded || !player.isConnected;

  // Timer ring dimensions
  const ringSize = 56;
  const radius = (ringSize - 4) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - fraction);
  const ringColor = remaining <= 5
    ? 'var(--danger)'
    : remaining <= 10
    ? 'var(--gold-muted)'
    : 'var(--gold-accent)';

  return (
    <div
      className={`seat seat--pos-${seatIndex} ${dimmed ? 'seat--dimmed' : ''} ${isMyself ? 'seat--myself' : ''} ${isCurrentTurn ? 'seat--active' : ''}`}
    >
      {/* Position badges */}
      <div className="seat-badges">
        {isDealer && <span className="badge badge--dealer">D</span>}
        {isSmallBlind && <span className="badge badge--sb">SB</span>}
        {isBigBlind && <span className="badge badge--bb">BB</span>}
      </div>

      {/* Avatar with optional timer ring */}
      <div className="seat-avatar-wrapper">
        {isCurrentTurn && (
          <svg
            className="seat-timer-ring"
            width={ringSize}
            height={ringSize}
            style={{ position: 'absolute', inset: 0, transform: 'rotate(-90deg)' }}
          >
            <circle
              cx={ringSize / 2} cy={ringSize / 2} r={radius}
              fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="3"
            />
            <circle
              cx={ringSize / 2} cy={ringSize / 2} r={radius}
              fill="none" stroke={ringColor} strokeWidth="3"
              strokeDasharray={circumference} strokeDashoffset={offset}
              strokeLinecap="round"
              style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.3s' }}
            />
          </svg>
        )}
        <Avatar
          username={displayName}
          size={44}
          isActive={isCurrentTurn}
          isDisconnected={!player.isConnected}
        />
      </div>

      {/* Player info */}
      <div className="seat-info">
        <span className="seat-username">{displayName}</span>
        <span className="seat-chips">{formatChips(player.chips)}</span>
        {isCurrentTurn && (
          <span className="seat-timer-count" style={{ color: ringColor }}>
            {remaining}s
          </span>
        )}
      </div>

      {/* Hole cards (small, beside the seat) */}
      {!isMyself && (
        <div className="seat-cards">
          <HoleCards
            cards={player.holeCards}
            size="sm"
            folded={player.hasFolded}
          />
        </div>
      )}

      {/* Current bet */}
      {player.currentBet > 0 && (
        <div className="seat-bet">
          <ChipStack amount={player.currentBet} size="sm" />
        </div>
      )}

      {/* All-in badge */}
      {player.isAllIn && (
        <span className="badge badge--allin">ALL IN</span>
      )}
    </div>
  );
}
