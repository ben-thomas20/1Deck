import { useState, useRef, useCallback } from 'react';
import type { PlayerProfile } from '../../hooks/useProfile';
import { getInitials, getAvatarColor } from '../../utils/format';
import { formatChips } from '../../utils/card-utils';
import './ProfilePanel.css';

interface ProfilePanelProps {
  profile: PlayerProfile;
  profilePic: string | null;
  onClose: () => void;
  onUpdateBio: (bio: string) => Promise<void>;
  onRequestChips: () => Promise<void>;
  onSetProfilePic: (dataUrl: string | null) => void;
}

export function ProfilePanel({
  profile,
  profilePic,
  onClose,
  onUpdateBio,
  onRequestChips,
  onSetProfilePic,
}: ProfilePanelProps) {
  const [bio, setBio] = useState(profile.bio);
  const [saving, setSaving] = useState(false);
  const [chipMsg, setChipMsg] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const initials = getInitials(profile.username);
  const avatarBg = getAvatarColor(profile.username);

  const handleSaveBio = async () => {
    setSaving(true);
    try {
      await onUpdateBio(bio);
    } catch { /* ignore */ }
    setSaving(false);
  };

  const handleRequestChips = async () => {
    setChipMsg('');
    try {
      await onRequestChips();
      setChipMsg('+1,000 chips added!');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed';
      setChipMsg(msg);
    }
  };

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 128;
        const ctx = canvas.getContext('2d')!;
        // Draw centered crop
        const size = Math.min(img.width, img.height);
        const sx = (img.width - size) / 2;
        const sy = (img.height - size) / 2;
        ctx.drawImage(img, sx, sy, size, size, 0, 0, 128, 128);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        onSetProfilePic(dataUrl);
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  }, [onSetProfilePic]);

  return (
    <div className="panel-overlay" onClick={onClose}>
      <div className="panel-content profile-panel" onClick={e => e.stopPropagation()}>
        <div className="panel-header">
          <h2>Player Profile</h2>
          <button className="panel-close" onClick={onClose}>&times;</button>
        </div>

        {/* Avatar section */}
        <div className="profile-panel-avatar-section">
          <div
            className="profile-panel-avatar"
            style={{ background: avatarBg }}
            onClick={() => fileInputRef.current?.click()}
          >
            {profilePic ? (
              <img src={profilePic} alt="avatar" className="profile-panel-avatar-img" />
            ) : (
              <span>{initials}</span>
            )}
            <div className="profile-panel-avatar-overlay">Upload</div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />
          <div className="profile-panel-name-section">
            <h3 className="profile-panel-username">{profile.username}</h3>
            {profile.equippedBadge && (
              <span className="profile-panel-badge">{profile.equippedBadge}</span>
            )}
          </div>
        </div>

        {/* Bio */}
        <div className="profile-panel-field">
          <label>Bio</label>
          <textarea
            value={bio}
            onChange={e => setBio(e.target.value)}
            maxLength={200}
            rows={3}
            placeholder="Tell others about yourself..."
          />
          <div className="profile-panel-field-footer">
            <span className="char-count">{bio.length}/200</span>
            <button
              className="btn-save-bio"
              onClick={handleSaveBio}
              disabled={saving || bio === profile.bio}
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>

        {/* Chips */}
        <div className="profile-panel-chips">
          <div className="profile-panel-chip-balance">
            <span className="chip-balance-label">Chip Balance</span>
            <span className="chip-balance-value">{formatChips(profile.chipBalance)}</span>
          </div>
          <button className="btn-request-chips" onClick={handleRequestChips}>
            + Request 1,000 Chips
          </button>
          {chipMsg && <p className="chip-msg">{chipMsg}</p>}
        </div>

        {/* Game History placeholder */}
        <div className="profile-panel-history">
          <h3>Game History</h3>
          <p className="history-empty">No game history yet. Start playing to build your record!</p>
        </div>
      </div>
    </div>
  );
}
