export interface ShopItem {
  id: string;
  name: string;
  description: string;
  type: 'emote' | 'badge';
  price: number;
  emoji: string;
  rarity: 'common' | 'rare' | 'legendary';
}

export const SHOP_CATALOG: ShopItem[] = [
  // Emotes
  {
    id: 'emote_gg',
    name: 'GG',
    description: 'Good game!',
    type: 'emote',
    price: 100,
    emoji: '🤝',
    rarity: 'common',
  },
  {
    id: 'emote_nice_hand',
    name: 'Nice Hand!',
    description: 'Compliment a great play',
    type: 'emote',
    price: 200,
    emoji: '👏',
    rarity: 'common',
  },
  {
    id: 'emote_bluff',
    name: 'Bluff!',
    description: 'Call out a suspected bluff',
    type: 'emote',
    price: 300,
    emoji: '🎭',
    rarity: 'rare',
  },
  {
    id: 'emote_fire',
    name: 'On Fire',
    description: "You're on a hot streak",
    type: 'emote',
    price: 150,
    emoji: '🔥',
    rarity: 'common',
  },
  {
    id: 'emote_allin',
    name: 'All In!',
    description: 'The ultimate power move',
    type: 'emote',
    price: 500,
    emoji: '💎',
    rarity: 'rare',
  },
  {
    id: 'emote_think',
    name: 'Thinking...',
    description: 'Tough decision',
    type: 'emote',
    price: 150,
    emoji: '🤔',
    rarity: 'common',
  },

  // Badges
  {
    id: 'badge_shark',
    name: 'Shark',
    description: 'A feared opponent at the table',
    type: 'badge',
    price: 1000,
    emoji: '🦈',
    rarity: 'rare',
  },
  {
    id: 'badge_high_roller',
    name: 'High Roller',
    description: 'Plays for the biggest stakes',
    type: 'badge',
    price: 2000,
    emoji: '🎰',
    rarity: 'legendary',
  },
  {
    id: 'badge_lucky',
    name: 'Lucky',
    description: 'Fortune favors the bold',
    type: 'badge',
    price: 500,
    emoji: '🍀',
    rarity: 'common',
  },
  {
    id: 'badge_veteran',
    name: 'Veteran',
    description: 'Hundreds of hands played',
    type: 'badge',
    price: 1500,
    emoji: '⭐',
    rarity: 'rare',
  },
  {
    id: 'badge_whale',
    name: 'Whale',
    description: 'The biggest fish in the sea',
    type: 'badge',
    price: 5000,
    emoji: '🐋',
    rarity: 'legendary',
  },
];
