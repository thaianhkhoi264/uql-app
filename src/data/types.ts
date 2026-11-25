// Factor type codes, as derived from the game's raw master data
// (see umamoe-resources/src/generators/factors.rs: factor_type()).
export type FactorType = 0 | 1 | 2 | 3 | 4 | 5;

export const FACTOR_TYPE = {
  BLUE: 0, // stat factors (Speed, Stamina, ...)
  PINK: 1, // aptitude factors (Turf, Mile, ...)
  WHITE_RACE: 2, // race-win white factors
  WHITE_SKILL: 3, // general white skills
  WHITE_SCENARIO: 4, // scenario-completion white factors
  GREEN: 5, // character-unique skills
} as const;

export interface Factor {
  id: number;
  name: string;
  type: FactorType;
}

export interface CharacterEntry {
  id: number;
  name: string;
  releaseDate: string;
}
