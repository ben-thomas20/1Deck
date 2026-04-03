import { useState, useEffect, useCallback } from 'react';
import { apiGet, apiPost } from '../utils/api';

export interface ShopItem {
  id: string;
  name: string;
  description: string;
  type: 'emote' | 'badge';
  price: number;
  emoji: string;
  rarity: 'common' | 'rare' | 'legendary';
}

export function useShop(userId: string, onBalanceChange?: () => void) {
  const [catalog, setCatalog] = useState<ShopItem[]>([]);
  const [ownedItems, setOwnedItems] = useState<{ emotes: string[]; badges: string[] }>({
    emotes: [],
    badges: [],
  });
  const [loading, setLoading] = useState(true);

  // Fetch catalog and owned items
  useEffect(() => {
    Promise.all([
      apiGet<ShopItem[]>('/api/shop/catalog'),
      apiGet<{ ownedEmotes: string[]; ownedBadges: string[] }>(`/api/profile/${userId}`),
    ])
      .then(([catalogData, profileData]) => {
        setCatalog(catalogData);
        setOwnedItems({
          emotes: profileData.ownedEmotes,
          badges: profileData.ownedBadges,
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [userId]);

  const purchaseItem = useCallback(async (itemId: string) => {
    const result = await apiPost<{ item: ShopItem; profile: { ownedEmotes: string[]; ownedBadges: string[]; chipBalance: number } }>(
      '/api/shop/purchase',
      { userId, itemId }
    );
    setOwnedItems({
      emotes: result.profile.ownedEmotes,
      badges: result.profile.ownedBadges,
    });
    onBalanceChange?.();
    return result;
  }, [userId, onBalanceChange]);

  const isOwned = useCallback((itemId: string) => {
    return ownedItems.emotes.includes(itemId) || ownedItems.badges.includes(itemId);
  }, [ownedItems]);

  return { catalog, ownedItems, purchaseItem, isOwned, loading };
}
