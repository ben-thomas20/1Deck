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
  lastChipRequest: number; // timestamp
}

export class ProfileStore {
  private profiles = new Map<string, PlayerProfile>();

  getOrCreate(userId: string, username: string): PlayerProfile {
    let profile = this.profiles.get(userId);
    if (!profile) {
      profile = {
        userId,
        username,
        bio: '',
        chipBalance: 10000,
        ownedEmotes: [],
        ownedBadges: [],
        equippedBadge: null,
        handsPlayed: 0,
        handsWon: 0,
        lastChipRequest: 0,
      };
      this.profiles.set(userId, profile);
    }
    return profile;
  }

  getProfile(userId: string): PlayerProfile | null {
    return this.profiles.get(userId) ?? null;
  }

  updateBio(userId: string, bio: string): PlayerProfile | null {
    const profile = this.profiles.get(userId);
    if (!profile) return null;
    profile.bio = bio.slice(0, 200);
    return profile;
  }

  requestChips(userId: string): { profile: PlayerProfile; error?: string } | null {
    const profile = this.profiles.get(userId);
    if (!profile) return null;

    const now = Date.now();
    const cooldown = 60_000; // 60 seconds
    if (now - profile.lastChipRequest < cooldown) {
      const remaining = Math.ceil((cooldown - (now - profile.lastChipRequest)) / 1000);
      return { profile, error: `Wait ${remaining}s before requesting more chips` };
    }

    profile.chipBalance += 1000;
    profile.lastChipRequest = now;
    return { profile };
  }

  purchaseItem(
    userId: string,
    itemId: string,
    itemType: 'emote' | 'badge',
    price: number
  ): { profile: PlayerProfile; error?: string } | null {
    const profile = this.profiles.get(userId);
    if (!profile) return null;

    const owned = itemType === 'emote' ? profile.ownedEmotes : profile.ownedBadges;
    if (owned.includes(itemId)) {
      return { profile, error: 'Already owned' };
    }

    if (profile.chipBalance < price) {
      return { profile, error: 'Not enough chips' };
    }

    profile.chipBalance -= price;
    owned.push(itemId);
    return { profile };
  }

  equipBadge(userId: string, badgeId: string | null): PlayerProfile | null {
    const profile = this.profiles.get(userId);
    if (!profile) return null;

    if (badgeId && !profile.ownedBadges.includes(badgeId)) return null;
    profile.equippedBadge = badgeId;
    return profile;
  }
}
