import { useState, FormEvent } from 'react';
import AnimatedGradientBackground from '../components/ui/AnimatedGradientBackground';
import './LoginPage.css';

interface LoginPageProps {
  onLogin: (username: string, token: string, userId: string) => void;
}

const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? 'http://localhost:3001';

export function LoginPage({ onLogin }: LoginPageProps) {
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    const trimmed = username.trim();
    if (!trimmed) return;

    setLoading(true);
    try {
      const res = await fetch(`${SERVER_URL}/api/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: trimmed }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to join');
        return;
      }

      onLogin(data.username, data.token, data.userId);
    } catch {
      setError('Cannot connect to server');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <AnimatedGradientBackground breathing={true} />

      <div className="login-content">
        <div className="login-card">
          <h1 className="login-title">1Deck</h1>
          <p className="login-subtitle">Texas Hold'em Poker</p>

          <form onSubmit={handleSubmit} className="login-form">
            <input
              type="text"
              className="login-input"
              placeholder="Choose a username"
              value={username}
              onChange={e => setUsername(e.target.value)}
              maxLength={16}
              autoFocus
              disabled={loading}
            />
            {error && <p className="login-error">{error}</p>}
            <button
              type="submit"
              className="login-button"
              disabled={loading || !username.trim()}
            >
              {loading ? 'Joining...' : 'Take a Seat'}
            </button>
          </form>

          <p className="login-hint">3-16 characters, letters, numbers, underscores</p>
        </div>
      </div>
    </div>
  );
}
