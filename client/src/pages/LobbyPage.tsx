import { useState, useCallback } from 'react';
import { Socket } from 'socket.io-client';
import { TablesTile } from '../components/lobby/TablesTile';
import { ProfileTile } from '../components/lobby/ProfileTile';
import { ProfilePanel } from '../components/lobby/ProfilePanel';
import { ShopTile } from '../components/lobby/ShopTile';
import { ShopPanel } from '../components/lobby/ShopPanel';
import { useProfile } from '../hooks/useProfile';
import { useShop } from '../hooks/useShop';
import './LobbyPage.css';

interface LobbyPageProps {
  socket: Socket;
  username: string;
  userId: string;
  token: string;
  onJoinTable: (tableId: string, seatIndex: number) => void;
}

export function LobbyPage({ socket, username, userId, onJoinTable }: LobbyPageProps) {
  const [activePanel, setActivePanel] = useState<'profile' | 'shop' | null>(null);

  const {
    profile,
    profilePic,
    setProfilePic,
    updateBio,
    requestChips,
    refreshProfile,
  } = useProfile(userId);

  const {
    catalog,
    purchaseItem,
    isOwned,
  } = useShop(userId, refreshProfile);

  const handleOpenProfile = useCallback(() => setActivePanel('profile'), []);
  const handleOpenShop = useCallback(() => setActivePanel('shop'), []);
  const handleClosePanel = useCallback(() => {
    setActivePanel(null);
    refreshProfile();
  }, [refreshProfile]);

  return (
    <div className="lobby-page">
      <header className="lobby-header">
        <h1 className="lobby-title">1Deck</h1>
        <span className="lobby-user">Playing as <strong>{username}</strong></span>
      </header>

      <div className="lobby-dashboard">
        <TablesTile
          socket={socket}
          username={username}
          onJoinTable={onJoinTable}
        />

        <ProfileTile
          profile={profile}
          profilePic={profilePic}
          onOpenProfile={handleOpenProfile}
        />

        <ShopTile
          catalog={catalog}
          chipBalance={profile?.chipBalance ?? 0}
          onOpenShop={handleOpenShop}
        />
      </div>

      {/* Panels */}
      {activePanel === 'profile' && profile && (
        <ProfilePanel
          profile={profile}
          profilePic={profilePic}
          onClose={handleClosePanel}
          onUpdateBio={updateBio}
          onRequestChips={requestChips}
          onSetProfilePic={setProfilePic}
        />
      )}

      {activePanel === 'shop' && (
        <ShopPanel
          catalog={catalog}
          isOwned={isOwned}
          chipBalance={profile?.chipBalance ?? 0}
          onPurchase={purchaseItem}
          onClose={handleClosePanel}
        />
      )}
    </div>
  );
}
