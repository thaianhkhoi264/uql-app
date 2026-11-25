import factorsJson from './factors.json';
import charactersJson from './characters.json';
import { FACTOR_TYPE, type Factor, type CharacterEntry } from './types';

export { FACTOR_TYPE };
export type { Factor, CharacterEntry, FactorType } from './types';
export { characterImageUrl, factorIconUrl } from './images';

export const FACTORS = factorsJson as Factor[];
export const CHARACTERS = charactersJson as CharacterEntry[];

export const BLUE_FACTORS = FACTORS.filter((f) => f.type === FACTOR_TYPE.BLUE);
export const PINK_FACTORS = FACTORS.filter((f) => f.type === FACTOR_TYPE.PINK);
export const GREEN_FACTORS = FACTORS.filter((f) => f.type === FACTOR_TYPE.GREEN);
export const WHITE_FACTORS = FACTORS.filter(
  (f) => f.type === FACTOR_TYPE.WHITE_RACE || f.type === FACTOR_TYPE.WHITE_SKILL || f.type === FACTOR_TYPE.WHITE_SCENARIO,
);

export const FACTOR_BY_ID = new Map<number, Factor>(FACTORS.map((f) => [f.id, f]));
