import iconMapping from './factor_icon_mapping.json';
import type { Factor } from './types';

const ASSET_BASE = 'https://uma.moe/assets/images';

// Character portrait, hotlinked from uma.moe's own asset CDN (public, no auth).
export function characterImageUrl(characterId: number): string {
  return `${ASSET_BASE}/character_stand/chara_stand_${characterId}.webp`;
}

// Factor icon lookup. Source: umamoe-frontend/src/data/factor_icon_mapping.json,
// a bundled snapshot (not on the live resource feed - see prep.mjs notes), so
// coverage may lag slightly for very recently added factors. Blue/pink
// factors have no per-factor icon on the live site itself (verified against
// the Advanced Filter UI), so this intentionally returns null for those.
const iconMap = iconMapping as Record<string, string>;

export function factorIconUrl(factor: Factor): string | null {
  const filename = iconMap[String(factor.id)];
  return filename ? `${ASSET_BASE}/skills/${filename}` : null;
}
