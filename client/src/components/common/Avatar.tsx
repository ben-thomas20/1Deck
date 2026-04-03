import { getInitials, getAvatarColor } from '../../utils/format';
import './Avatar.css';

interface AvatarProps {
  username: string;
  size?: number;
  isActive?: boolean;
  isDisconnected?: boolean;
}

export function Avatar({
  username,
  size = 40,
  isActive = false,
  isDisconnected = false,
}: AvatarProps) {
  const bg = getAvatarColor(username);
  const initials = getInitials(username);

  return (
    <div
      className={`avatar ${isActive ? 'avatar--active' : ''} ${isDisconnected ? 'avatar--disconnected' : ''}`}
      style={{ width: size, height: size, background: bg, fontSize: size * 0.35 }}
    >
      {initials}
    </div>
  );
}
