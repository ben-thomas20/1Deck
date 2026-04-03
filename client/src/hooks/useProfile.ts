import { useState, useEffect, useCallback } from 'react';
import { apiGet, apiPost } from '../utils/api';

export interface PlayerProfile {
  userId: string;
  username: string;
  bio: string;
  chipBalance: number;
  ownedEmotes: string[];
  ownedBadges: string[];
  equippedBadge: string | null;
  handsPlayed: number;
  handsWon: number;
}

export function useProfile(userId: string) {
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profilePic, setProfilePicState] = useState<string | null>(null);

  // Load profile pic from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(`1deck_profile_pic_${userId}`);
    if (stored) setProfilePicState(stored);
  }, [userId]);

  // Fetch profile from server
  useEffect(() => {
    apiGet<PlayerProfile>(`/api/profile/${userId}`)
      .then(setProfile)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [userId]);

  const updateBio = useCallback(async (bio: string) => {
    const updated = await apiPost<PlayerProfile>('/api/profile', { userId, bio });
    setProfile(updated);
  }, [userId]);

  const requestChips = useCallback(async () => {
    const updated = await apiPost<PlayerProfile>('/api/profile/chips', { userId });
    setProfile(updated);
  }, [userId]);

  const setProfilePic = useCallback((dataUrl: string | null) => {
    if (dataUrl) {
      localStorage.setItem(`1deck_profile_pic_${userId}`, dataUrl);
    } else {
      localStorage.removeItem(`1deck_profile_pic_${userId}`);
    }
    setProfilePicState(dataUrl);
  }, [userId]);

  const refreshProfile = useCallback(async () => {
    const updated = await apiGet<PlayerProfile>(`/api/profile/${userId}`);
    setProfile(updated);
  }, [userId]);

  return { profile, loading, profilePic, setProfilePic, updateBio, requestChips, refreshProfile };
}
