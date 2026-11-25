import { BLUE_FACTORS, PINK_FACTORS, GREEN_FACTORS, WHITE_FACTORS, type Factor } from '../data';

// Single source of truth for the 8 spark fields UQL supports: 4 lineage-wide
// (blue_sparks/pink_sparks/green_sparks/white_sparks, 1-9 stars) and 4
// main-parent-scoped (main_blue_factors/main_pink_factors/main_green_factors/
// main_white_factors, 1-3 stars - a main parent can only carry up to 3-star
// sparks). Confirmed against umamoe-frontend's database-filter.component.ts
// (appendFactorFilterUqlClauses call sites + generateSparkIdGroups maxCap).
export type SparkColor = 'blue' | 'pink' | 'green' | 'white';
export type SparkScope = 'lineage' | 'main';

export interface SparkFieldDef {
  field: string;
  color: SparkColor;
  scope: SparkScope;
  factors: Factor[];
  maxStars: number;
  // Array fields hold a list of spark ids and are matched with overlaps().
  // Scalar fields hold a single id (a parent has exactly one blue/pink/green
  // spark) and are matched with `= id` / `in (ids)`. Same rule the site's own
  // compiler uses: array iff the name ends in `_sparks` or `_white_factors`
  // (umamoe-frontend uql-compiler.ts isArrayField / old buildSparkGroupUqlClause).
  isArray: boolean;
}

function isArrayFieldName(field: string): boolean {
  return field.endsWith('_sparks') || field.endsWith('_white_factors');
}

function def(
  field: string,
  color: SparkColor,
  scope: SparkScope,
  factors: Factor[],
  maxStars: number,
): SparkFieldDef {
  return { field, color, scope, factors, maxStars, isArray: isArrayFieldName(field) };
}

export const SPARK_FIELD_DEFS: SparkFieldDef[] = [
  def('blue_sparks', 'blue', 'lineage', BLUE_FACTORS, 9),
  def('pink_sparks', 'pink', 'lineage', PINK_FACTORS, 9),
  def('green_sparks', 'green', 'lineage', GREEN_FACTORS, 9),
  def('white_sparks', 'white', 'lineage', WHITE_FACTORS, 9),
  def('main_blue_factors', 'blue', 'main', BLUE_FACTORS, 3),
  def('main_pink_factors', 'pink', 'main', PINK_FACTORS, 3),
  def('main_green_factors', 'green', 'main', GREEN_FACTORS, 3),
  def('main_white_factors', 'white', 'main', WHITE_FACTORS, 3),
];

export const SPARK_FIELD_BY_NAME = new Map(SPARK_FIELD_DEFS.map((d) => [d.field, d]));

// Sentinel factorId meaning "any spark of this color" - expands at compile
// time to every factor in that color's list. Never collides with a real
// factor id (those are always positive).
export const ANY_FACTOR_ID = -1;
export const ANY_FACTOR_LABEL = 'Any';

// Sentinel factorId meaning "a specific hand-picked subset of this color's
// sparks" (e.g. Stamina OR Wit), stored in SparkPick.customFactorIds.
// Expands the same way "Any" does, just over the chosen subset instead of
// every factor - one pick, one shared star range, OR'd across the subset.
export const CUSTOM_FACTOR_ID = -2;
export const CUSTOM_FACTOR_LABEL = 'Custom…';
