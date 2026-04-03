import { useState, useCallback } from 'react';
import { LoginPage } from './pages/LoginPage';
import { LobbyPage } from './pages/LobbyPage';
import { TablePage } from './pages/TablePage';
import { useSocket } from './hooks/useSocket';
import './styles/theme.css';

type View = 'login' | 'lobby' | 'table';

interface UserInfo {
  username: string;
  token: string;
  userId: string;
}

export default function App() {
  const [view, setView] = useState<View>('login');
  const [user, setUser] = useState<UserInfo | null>(null);
  const [currentTableId, setCurrentTableId] = useState<string | null>(null);
  const { socket } = useSocket(user?.token ?? null);

  const handleLogin = useCallback((username: string, token: string, userId: string) => {
    setUser({ username, token, userId });
    setView('lobby');
  }, []);

  const handleJoinTable = useCallback((tableId: string, seatIndex: number) => {
    if (!socket) return;
    socket.emit('tables:join', { tableId, seatIndex });
    setCurrentTableId(tableId);
    setView('table');
  }, [socket]);

  const handleLeaveTable = useCallback(() => {
    setCurrentTableId(null);
    setView('lobby');
  }, []);

  switch (view) {
    case 'login':
      return <LoginPage onLogin={handleLogin} />;

    case 'lobby':
      if (!socket || !user) return null;
      return (
        <LobbyPage
          socket={socket}
          username={user.username}
          userId={user.userId}
          token={user.token}
          onJoinTable={handleJoinTable}
        />
      );

    case 'table':
      if (!socket || !user || !currentTableId) return null;
      return (
        <TablePage
          socket={socket}
          userId={user.userId}
          username={user.username}
          tableId={currentTableId}
          onLeave={handleLeaveTable}
        />
      );
  }
}
