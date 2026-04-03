import { formatChips } from '../../utils/card-utils';
import './ChipStack.css';

interface ChipStackProps {
  amount: number;
  size?: 'sm' | 'md';
}

export function ChipStack({ amount, size = 'md' }: ChipStackProps) {
  if (amount <= 0) return null;

  return (
    <div className={`chip-stack chip-stack--${size}`}>
      <div className="chip-icon" />
      <span className="chip-amount">{formatChips(amount)}</span>
    </div>
  );
}
