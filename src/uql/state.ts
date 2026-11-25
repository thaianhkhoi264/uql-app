// Filter state model for the UQL builder.
//
// Design note on OR support: the Advanced Filter on uma.moe only ANDs
// conditions together. To express "2-3* Mile + 5-6* Turf OR 2-3* Turf +
// 5-6* Mile" (from the original example query), a spark color holds a list
// of *groups* - each group is a set of star-range picks that are AND'd
// together, and multiple groups for the same color are OR'd together.
// A single group is just a plain AND, matching today's Advanced Filter
// behavior exactly; adding a second group is what introduces OR.
//
// Design note on scope: uma.moe distinguishes lineage-wide sparks (anywhere
// in Main/GP1/GP2 combined) from main-parent-scoped sparks (Main only,
// capped at 3 stars instead of 9). Both use the same group/pick shape, just
// different field names and star caps - see uql/sparkFields.ts.

export interface SparkPick {
  id: string;
  factorId: number;
  // Only used when factorId === CUSTOM_FACTOR_ID: the hand-picked subset of
  // this color's factors that this pick's star range applies to.
  customFactorIds: number[];
  min: number;
  max: number;
}

export interface SparkGroup {
  id: string;
  picks: SparkPick[];
}

export interface OptionalWhiteEntry {
  id: string;
  factorIds: number[];
  priority: number;
}

export interface FilterState {
  mainCharacterIds: number[];
  gpCharacterIds: number[];
  blueGroups: SparkGroup[];
  pinkGroups: SparkGroup[];
  greenGroups: SparkGroup[];
  whiteGroups: SparkGroup[];
  mainBlueGroups: SparkGroup[];
  mainPinkGroups: SparkGroup[];
  mainGreenGroups: SparkGroup[];
  mainWhiteGroups: SparkGroup[];
  optionalWhite: OptionalWhiteEntry[];
  optionalMainWhite: OptionalWhiteEntry[];
}

let idCounter = 0;
export function nextId(): string {
  idCounter += 1;
  return `id-${idCounter}-${Date.now().toString(36)}`;
}

export const MAX_PICKS_PER_GROUP = 3;

export function emptySparkGroup(): SparkGroup {
  return { id: nextId(), picks: [] };
}

export function emptySparkPick(factorId: number, maxStars = 9): SparkPick {
  return { id: nextId(), factorId, customFactorIds: [], min: 1, max: maxStars };
}

export function duplicateSparkGroup(group: SparkGroup): SparkGroup {
  return {
    id: nextId(),
    picks: group.picks.map((pick) => ({ ...pick, id: nextId() })),
  };
}

// Swaps the star ranges between the two picks in a group, keeping each
// pick's spark in place. Only meaningful for exactly two picks.
export function flipSparkGroup(group: SparkGroup): SparkGroup {
  if (group.picks.length !== 2) return group;
  const [a, b] = group.picks;
  return {
    ...group,
    picks: [
      { ...a, min: b.min, max: b.max },
      { ...b, min: a.min, max: a.max },
    ],
  };
}

export function emptyOptionalWhite(priority: number): OptionalWhiteEntry {
  return { id: nextId(), factorIds: [], priority };
}

export function createEmptyState(): FilterState {
  return {
    mainCharacterIds: [],
    gpCharacterIds: [],
    blueGroups: [],
    pinkGroups: [],
    greenGroups: [],
    whiteGroups: [],
    mainBlueGroups: [],
    mainPinkGroups: [],
    mainGreenGroups: [],
    mainWhiteGroups: [],
    optionalWhite: [],
    optionalMainWhite: [],
  };
}
