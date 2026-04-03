import { formatChips } from '../../utils/card-utils';
import './Pot.css';

interface PotProps {
  amount: number;
}

export function Pot({ amount }: PotProps) {
  if (amount <= 0) return null;

  return (
    <div className="pot">
      <span className="pot-label">Pot</span>
      <span className="pot-amount">{formatChips(amount)}</span>
    </div>
  );
}
