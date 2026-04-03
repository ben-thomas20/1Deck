import { useTimer } from '../../hooks/useTimer';
import './Timer.css';

interface TimerProps {
  active: boolean;
  totalSeconds?: number;
  size?: number;
}

export function Timer({ active, totalSeconds = 30, size = 48 }: TimerProps) {
  const { remaining, fraction } = useTimer(totalSeconds, active);

  if (!active) return null;

  const radius = (size - 4) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - fraction);

  let strokeColor = 'var(--gold-accent)';
  if (remaining <= 5) strokeColor = 'var(--danger)';
  else if (remaining <= 10) strokeColor = 'var(--gold-muted)';

  return (
    <div className="timer" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="timer-svg">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth="3"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={strokeColor}
          strokeWidth="3"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="timer-arc"
        />
      </svg>
      <span className="timer-text" style={{ color: strokeColor }}>
        {remaining}
      </span>
    </div>
  );
}
