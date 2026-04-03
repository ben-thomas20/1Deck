import type { PlayerProfile } from '../../hooks/useProfile';
import { getInitials, getAvatarColor } from '../../utils/format';
import { formatChips } from '../../utils/card-utils';
import './ProfileTile.css';

interface ProfileTileProps {
  profile: PlayerProfile | null;
  profilePic: string | null;
  onOpenProfile: () => void;
}

export function ProfileTile({ profile, profilePic, onOpenProfile }: ProfileTileProps) {
  if (!profile) {
    return (
      <div className="dashboard-tile profile-tile profile-tile--loading">
        <div className="tile-header">
          <h2 className="tile-title">Profile</h2>
        </div>
        <p className="profile-loading-text">Loading...</p>
      </div>
    );
  }

  const initials = getInitials(profile.username);
  const avatarBg = getAvatarColor(profile.username);

  return (
    <div className="dashboard-tile profile-tile" onClick={onOpenProfile}>
      <div className="tile-header">
        <h2 className="tile-title">Profile</h2>
      </div>

      <div className="profile-summary">
        <div className="profile-avatar-large" style={{ background: avatarBg }}>
          {profilePic ? (
            <img src={profilePic} alt="avatar" className="profile-avatar-img" />
          ) : (
            <span>{initials}</span>
          )}
        </div>

        <div className="profile-details">
          <span className="profile-name">{profile.username}</span>
          <span className="profile-bio">
            {profile.bio || 'No bio yet'}
          </span>
        </div>
      </div>

      <div className="profile-stats-row">
        <div className="profile-stat">
          <span className="profile-stat-value">{formatChips(profile.chipBalance)}</span>
          <span className="profile-stat-label">Chips</span>
        </div>
        <div className="profile-stat">
          <span className="profile-stat-value">{profile.handsPlayed}</span>
          <span className="profile-stat-label">Hands</span>
        </div>
        <div className="profile-stat">
          <span className="profile-stat-value">{profile.handsWon}</span>
          <span className="profile-stat-label">Won</span>
        </div>
      </div>

      <button className="btn-view-profile">Edit Profile</button>
    </div>
  );
}
