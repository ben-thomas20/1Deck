import { } from 'react';
import { AIChatTab } from './AIChatTab';
import './ChatPanel.css';

interface ChatPanelProps {
  isOpen: boolean;
  onToggle: () => void;
}

export function ChatPanel({ isOpen, onToggle }: ChatPanelProps) {
  return (
    <>
      <button className="chat-toggle" onClick={onToggle}>
        {isOpen ? '✕' : 'AI Coach'}
      </button>
      {isOpen && (
        <div className="chat-panel">
          <div className="chat-panel-header">
            <h3>AI Poker Coach</h3>
            <button className="chat-close" onClick={onToggle}>✕</button>
          </div>
          <AIChatTab />
        </div>
      )}
    </>
  );
}
