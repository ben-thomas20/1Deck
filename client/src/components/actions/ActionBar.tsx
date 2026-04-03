import { useState, useEffect, useCallback } from 'react';
import { RaiseSlider } from './RaiseSlider';
import { formatChips } from '../../utils/card-utils';
import type { ValidActionsData } from '../../hooks/useGameState';
import './ActionBar.css';

interface ActionBarProps {
  validActions: ValidActionsData | null;
  isMyTurn: boolean;
  onFold: () => void;
  onCheck: () => void;
  onCall: () => void;
  onRaise: (amount: number) => void;
  onAllIn: () => void;
}

export function ActionBar({
  validActions,
  isMyTurn,
  onFold,
  onCheck,
  onCall,
  onRaise,
  onAllIn,
}: ActionBarProps) {
  const [showRaiseSlider, setShowRaiseSlider] = useState(false);
  const [raiseAmount, setRaiseAmount] = useState(0);

  // Reset raise slider when turn changes
  useEffect(() => {
    if (validActions) {
      setRaiseAmount(validActions.minRaise);
    }
    setShowRaiseSlider(false);
  }, [validActions, isMyTurn]);

  // Keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isMyTurn || !validActions) return;
      // Don't capture if typing in an input
      if ((e.target as HTMLElement).tagName === 'INPUT') return;

      switch (e.key.toLowerCase()) {
        case 'f':
          onFold();
          break;
        case 'c':
          if (validActions.canCheck) onCheck();
          else if (validActions.canCall) onCall();
          break;
        case 'r':
          if (validActions.canRaise) setShowRaiseSlider(prev => !prev);
          break;
        case 'a':
          if (validActions.canAllIn) onAllIn();
          break;
        case 'enter':
          if (showRaiseSlider) {
            onRaise(raiseAmount);
            setShowRaiseSlider(false);
          }
          break;
        case 'escape':
          setShowRaiseSlider(false);
          break;
      }
    },
    [isMyTurn, validActions, onFold, onCheck, onCall, onRaise, onAllIn, showRaiseSlider, raiseAmount]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  if (!isMyTurn || !validActions) return null;

  return (
    <div className="action-bar">
      <div className="action-bar-inner">
        {/* Fold */}
        <button className="action-btn action-btn--fold" onClick={onFold}>
          <span className="action-label">Fold</span>
          <span className="action-shortcut">F</span>
        </button>

        {/* Check / Call */}
        {validActions.canCheck ? (
          <button className="action-btn action-btn--check" onClick={onCheck}>
            <span className="action-label">Check</span>
            <span className="action-shortcut">C</span>
          </button>
        ) : validActions.canCall ? (
          <button className="action-btn action-btn--call" onClick={onCall}>
            <span className="action-label">Call {formatChips(validActions.callAmount)}</span>
            <span className="action-shortcut">C</span>
          </button>
        ) : null}

        {/* Raise */}
        {validActions.canRaise && (
          <button
            className={`action-btn action-btn--raise ${showRaiseSlider ? 'active' : ''}`}
            onClick={() => setShowRaiseSlider(!showRaiseSlider)}
          >
            <span className="action-label">Raise</span>
            <span className="action-shortcut">R</span>
          </button>
        )}

        {/* All In */}
        {validActions.canAllIn && (
          <button className="action-btn action-btn--allin" onClick={onAllIn}>
            <span className="action-label">All In</span>
            <span className="action-shortcut">A</span>
          </button>
        )}
      </div>

      {/* Raise Slider */}
      {showRaiseSlider && validActions.canRaise && (
        <RaiseSlider
          min={validActions.minRaise}
          max={validActions.maxRaise}
          value={raiseAmount}
          onChange={setRaiseAmount}
          onConfirm={() => {
            onRaise(raiseAmount);
            setShowRaiseSlider(false);
          }}
        />
      )}
    </div>
  );
}
