import { useState, useEffect } from 'react';
import { Socket } from 'socket.io-client';
import './TablesTile.css';

interface TableInfo {
  id: string;
  name: string;
  blinds: { small: number; big: number };
  playerCount: number;
  maxPlayers: number;
  players: { seatIndex: number; username: string; chips: number }[];
  status: 'waiting' | 'playing';
}

interface TablesTileProps {
  socket: Socket;
  username: string;
  onJoinTable: (tableId: string, seatIndex: number) => void;
}

export function TablesTile({ socket, username, onJoinTable }: TablesTileProps) {
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newTableName, setNewTableName] = useState('');

  useEffect(() => {
    const handler = (data: TableInfo[]) => setTables(data);
    socket.on('tables:list', handler);
    return () => { socket.off('tables:list', handler); };
  }, [socket]);

  useEffect(() => {
    const handler = (data: { tableId: string }) => {
      onJoinTable(data.tableId, 0);
    };
    socket.on('tables:created', handler);
    return () => { socket.off('tables:created', handler); };
  }, [socket, onJoinTable]);

  const handleCreate = () => {
    const name = newTableName.trim() || `${username}'s Table`;
    socket.emit('tables:create', { name });
    setShowCreate(false);
    setNewTableName('');
  };

  const findOpenSeat = (table: TableInfo): number => {
    const occupied = new Set(table.players.map(p => p.seatIndex));
    for (let i = 0; i < 8; i++) {
      if (!occupied.has(i)) return i;
    }
    return -1;
  };

  return (
    <div className="dashboard-tile tables-tile">
      <div className="tile-header">
        <h2 className="tile-title">Tables</h2>
        <button className="btn-create" onClick={() => setShowCreate(true)}>
          + New Table
        </button>
      </div>

      {showCreate && (
        <div className="create-modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="create-modal" onClick={e => e.stopPropagation()}>
            <h3>Create Table</h3>
            <input
              type="text"
              placeholder="Table name"
              value={newTableName}
              onChange={e => setNewTableName(e.target.value)}
              maxLength={30}
              autoFocus
            />
            <div className="create-modal-actions">
              <button className="btn-cancel" onClick={() => setShowCreate(false)}>
                Cancel
              </button>
              <button className="btn-confirm" onClick={handleCreate}>
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {tables.length === 0 ? (
        <div className="tables-empty">
          <p>No tables yet. Create one to get started.</p>
        </div>
      ) : (
        <div className="table-list">
          {tables.map(table => (
            <div key={table.id} className="table-card">
              <div className="table-card-header">
                <h3>{table.name}</h3>
                <span className={`table-status ${table.status}`}>
                  {table.status}
                </span>
              </div>
              <div className="table-card-info">
                <span>Blinds: {table.blinds.small}/{table.blinds.big}</span>
                <span>{table.playerCount}/{table.maxPlayers} players</span>
              </div>
              <div className="table-card-players">
                {table.players.map(p => (
                  <span key={p.seatIndex} className="player-chip">
                    {p.username}
                  </span>
                ))}
              </div>
              <button
                className="btn-join"
                onClick={() => {
                  const seat = findOpenSeat(table);
                  if (seat >= 0) onJoinTable(table.id, seat);
                }}
                disabled={table.playerCount >= table.maxPlayers}
              >
                {table.playerCount >= table.maxPlayers ? 'Full' : 'Join'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
