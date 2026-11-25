import { CHARACTERS, FACTOR_BY_ID } from '../data';
import type { FilterState, SparkGroup, SparkPick, OptionalWhiteEntry } from './state';
import { ANY_FACTOR_ID, CUSTOM_FACTOR_ID, SPARK_FIELD_DEFS, type SparkFieldDef } from './sparkFields';

// Maps each of the 8 spark field names to its slice of FilterState.
function sparkGroupsByField(state: FilterState): Record<string, SparkGroup[]> {
  return {
    blue_sparks: state.blueGroups,
    pink_sparks: state.pinkGroups,
    green_sparks: state.greenGroups,
    white_sparks: state.whiteGroups,
    main_blue_factors: state.mainBlueGroups,
    main_pink_factors: state.mainPinkGroups,
    main_green_factors: state.mainGreenGroups,
    main_white_factors: state.mainWhiteGroups,
  };
}

// Spark ID encoding, verified against umamoe-resources/src/generators/factors.rs
// (factor_base/factor_type) and umamoe-frontend's buildSparkId(): the game's raw
// master data already encodes level as the last digit of the factor id, so a
// spark id is just the base factor id with the star level appended.
function buildSparkId(factorId: number, level: number): number {
  return parseInt(`${factorId}${level}`, 10);
}

function characterName(id: number): string {
  return CHARACTERS.find((c) => c.id === id)?.name ?? String(id);
}

function factorName(id: number): string {
  return FACTOR_BY_ID.get(id)?.name ?? String(id);
}

// "Any"/"Custom" expand to every factor in the relevant list at each level in
// [min, max], level-major then factor-minor - matching the order
// umamoe-frontend's own generateSparkIdGroups() produces for its "Any" case
// (confirmed from source: `for (level) { for (factor of availableFactors) {
// push(factor.id+level) } }`).
function pickIds(pick: SparkPick, colorFactors: SparkFieldDef['factors']): number[] {
  if (pick.min < 1 || pick.max < pick.min) return [];
  const ids: number[] = [];
  for (let level = pick.min; level <= pick.max; level += 1) {
    if (pick.factorId === ANY_FACTOR_ID) {
      for (const factor of colorFactors) ids.push(buildSparkId(factor.id, level));
    } else if (pick.factorId === CUSTOM_FACTOR_ID) {
      for (const factorId of pick.customFactorIds) ids.push(buildSparkId(factorId, level));
    } else if (pick.factorId) {
      ids.push(buildSparkId(pick.factorId, level));
    }
  }
  return ids;
}

// Main-parent-scoped picks on a single named factor use the site's own
// readable form ("Main {Factor} = N" / ">= N" / "<= N") instead of a raw
// overlaps() call. Confirmed against umamoe-frontend's
// buildFriendlyFactorFilterUqlClause: since a main parent caps at 3 stars,
// every valid [min, max] range touches a boundary (1 or maxStars) or is a
// single value, so this always applies - never needs to fall back for a
// single named factor in main scope. "Any"/"Custom" picks have no such
// friendly form on the site, so they keep using overlaps() as usual.
function namedFactorClause(def: SparkFieldDef, factorId: number, min: number, max: number): string | null {
  const factor = def.factors.find((f) => f.id === factorId);
  if (!factor) return null;
  const label = `Main ${factor.name}`;
  if (min === max) return `${label} = ${min}`;
  if (min <= 1 && max >= def.maxStars) return `${label} >= 1`;
  if (min <= 1) return `${label} <= ${max}`;
  if (max >= def.maxStars) return `${label} >= ${min}`;
  return null;
}

function pickClause(def: SparkFieldDef, pick: SparkPick): string | null {
  if (def.scope === 'main' && pick.factorId !== ANY_FACTOR_ID && pick.factorId !== CUSTOM_FACTOR_ID && pick.factorId) {
    const friendly = namedFactorClause(def, pick.factorId, pick.min, pick.max);
    if (friendly) return friendly;
  }
  const ids = pickIds(pick, def.factors);
  if (ids.length === 0) return null;
  if (!def.isArray) {
    // Scalar field (main blue/pink/green): one id per parent, so match with
    // `= id` / `in (ids)` like the site's own compiler - overlaps() is for
    // array fields only.
    return ids.length === 1 ? `${def.field} = ${ids[0]}` : `${def.field} in (${ids.join(', ')})`;
  }
  return `overlaps(${def.field}, (${ids.join(', ')}))`;
}

function groupClause(def: SparkFieldDef, group: SparkGroup): string | null {
  const clauses = group.picks
    .map((pick) => pickClause(def, pick))
    .filter((clause): clause is string => clause !== null);
  if (clauses.length === 0) return null;
  if (clauses.length === 1) return clauses[0];
  return `(${clauses.join(' and ')})`;
}

// Multiple groups for one color are OR alternatives; the whole color clause
// is always wrapped once more so it composes safely with the top-level ANDs.
// This mirrors the nesting seen in the reference example query exactly
// (double-wrapped single AND-group; outer-wrapped OR-of-AND-groups).
function colorClause(def: SparkFieldDef, groups: SparkGroup[]): string | null {
  const clauses = groups
    .map((group) => groupClause(def, group))
    .filter((clause): clause is string => clause !== null);
  if (clauses.length === 0) return null;
  const inner = clauses.length === 1 ? clauses[0] : clauses.join(' or ');
  return `(${inner})`;
}

function characterClause(label: string, ids: number[]): string | null {
  if (ids.length === 0) return null;
  const names = ids.map(characterName);
  return `${label} in (${names.join(', ')})`;
}

function optionalWhiteClauses(entries: OptionalWhiteEntry[], keyword: string): string[] {
  return entries
    .filter((entry) => entry.factorIds.length > 0)
    .map((entry) => {
      const names = entry.factorIds.map(factorName);
      return `${keyword} in (${names.join(', ')}, priority = ${entry.priority})`;
    });
}

export function compileToUQL(state: FilterState): string {
  const clauses: string[] = [];

  const mainClause = characterClause('Main character', state.mainCharacterIds);
  if (mainClause) clauses.push(mainClause);

  const gpClause = characterClause('GP character', state.gpCharacterIds);
  if (gpClause) clauses.push(gpClause);

  const groupsByField = sparkGroupsByField(state);
  for (const def of SPARK_FIELD_DEFS) {
    const clause = colorClause(def, groupsByField[def.field]);
    if (clause) clauses.push(clause);
  }

  clauses.push(...optionalWhiteClauses(state.optionalWhite, 'optional white'));
  clauses.push(...optionalWhiteClauses(state.optionalMainWhite, 'optional main white'));

  return clauses.join(' and ');
}
