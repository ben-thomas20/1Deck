import { formatChips } from '../../utils/card-utils';
import './RaiseSlider.css';

interface RaiseSliderProps {
  min: number;
  max: number;
  value: number;
  onChange: (value: number) => void;
  onConfirm: () => void;
}

export function RaiseSlider({ min, max, value, onChange, onConfirm }: RaiseSliderProps) {
  return (
    <div className="raise-slider">
      <div className="raise-slider-track">
        <span className="raise-label">Min</span>
        <input
          type="range"
          min={min}
          max={max}
          value={value}
          onChange={e => onChange(Number(e.target.value))}
          className="raise-range"
        />
        <span className="raise-label">Max</span>
      </div>
      <div className="raise-slider-value">
        <input
          type="number"
          min={min}
          max={max}
          value={value}
          onChange={e => {
            const v = Number(e.target.value);
            if (v >= min && v <= max) onChange(v);
          }}
          className="raise-input"
        />
        <button className="raise-confirm" onClick={onConfirm}>
          Raise to {formatChips(value)}
        </button>
      </div>
    </div>
  );
}
