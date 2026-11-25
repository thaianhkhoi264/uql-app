import { CHARACTERS, FACTORS } from '../data';
import type { Factor } from '../data';
import type { FilterState, SparkGroup } from './state';
import { createEmptyState, nextId } from './state';
import { ANY_FACTOR_ID, CUSTOM_FACTOR_ID, SPARK_FIELD_DEFS, SPARK_FIELD_BY_NAME } from './sparkFields';

// Reverse of compile.ts: parses a UQL string produced by this tool (and,
// where the shape lines up, simple hand-written queries) back into filter
// state. This only understands the subset of UQL this tool generates -
// Main/GP character in(...), overlaps() AND/OR trees for the 8 spark fields
// (lineage-wide + main-parent-scoped), and optional (main) white in(...).
// Anything else is reported as an unparsed leftover rather than silently
// dropped or guessed at.

export interface ParseResult {
  state: FilterState;
  warnings: string[];
}

function normalize(name: string): string {
  return name.trim().toLowerCase();
}

const characterByName = new Map<string, number>(CHARACTERS.map((c) => [normalize(c.name), c.id]));
const factorByName = new Map<string, number>(FACTORS.map((f) => [normalize(f.name), f.id]));

function resolveId(rawName: string, byName: Map<string, number>): number | null {
  const trimmed = rawName.trim();
  if (!trimmed) return null;
  const byLookup = byName.get(normalize(trimmed));
  if (byLookup !== undefined) return byLookup;
  if (/^\d+$/.test(trimmed)) return parseInt(trimmed, 10);
  return null;
}

function isWordBoundaryMatch(lower: string, index: number, word: string): boolean {
  if (lower.slice(index, index + word.length) !== word) return false;
  const before = index === 0 ? ' ' : lower[index - 1];
  const after = lower[index + word.length] ?? ' ';
  return /\s/.test(before) && /\s/.test(after);
}

// Splits `text` on a top-level " and " / " or " (not inside parentheses).
function splitTopLevel(text: string, word: 'and' | 'or'): string[] {
  const parts: string[] = [];
  const lower = text.toLowerCase();
  let depth = 0;
  let start = 0;
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (ch === '(') depth += 1;
    else if (ch === ')') depth -= 1;
    else if (depth === 0 && isWordBoundaryMatch(lower, i, word)) {
      parts.push(text.slice(start, i).trim());
      i += word.length;
      start = i;
      continue;
    }
    i += 1;
  }
  parts.push(text.slice(start).trim());
  return parts;
}

function stripOuterParens(text: string): string {
  let s = text.trim();
  for (;;) {
    if (!(s.startsWith('(') && s.endsWith(')'))) return s;
    let depth = 0;
    let matchesOuter = true;
    for (let i = 0; i < s.length; i += 1) {
      if (s[i] === '(') depth += 1;
      else if (s[i] === ')') {
        depth -= 1;
        if (depth === 0 && i !== s.length - 1) {
          matchesOuter = false;
          break;
        }
      }
    }
    if (!matchesOuter) return s;
    s = s.slice(1, -1).trim();
  }
}

// Matches `prefix` at the very start of `text`, then extracts the
// balanced-parenthesized content immediately following it (the closing paren
// must be the last character of `text`). Unlike a naive [^()]* regex, this
// handles values that themselves contain literal parens, e.g. the factor
// name "Tenno Sho (Autumn)" inside `optional white in (Tenno Sho (Autumn), ...)`.
function matchBalancedCall(text: string, prefix: RegExp): string | null {
  const match = prefix.exec(text);
  if (!match || match.index !== 0) return null;
  let i = match[0].length;
  while (text[i] === ' ') i += 1;
  if (text[i] !== '(') return null;
  let depth = 0;
  for (let j = i; j < text.length; j += 1) {
    if (text[j] === '(') depth += 1;
    else if (text[j] === ')') {
      depth -= 1;
      if (depth === 0) {
        if (j !== text.length - 1) return null;
        return text.slice(i + 1, j);
      }
    }
  }
  return null;
}

// factor_base()/level, inverse of buildSparkId() in compile.ts - the level is
// always the last digit of the encoded spark id.
function decodeSparkId(id: number): { factorId: number; level: number } {
  const s = String(id);
  return { factorId: parseInt(s.slice(0, -1), 10), level: parseInt(s.slice(-1), 10) };
}

const OVERLAPS_RE = /^overlaps\(\s*([A-Za-z_][A-Za-z0-9_]*)\s*,\s*\(([^()]*)\)\s*\)$/i;

function parseOverlapsAtom(text: string): { field: string; ids: number[] } | null {
  const match = OVERLAPS_RE.exec(text.trim());
  if (!match) return null;
  const field = match[1].toLowerCase();
  const ids = match[2]
    .split(',')
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => Number.isFinite(n));
  if (ids.length === 0) return null;
  return { field, ids };
}

// Decodes the ids from one overlaps() call into picks. A single distinct
// factor is the common case (one pick). Multiple distinct factors are only
// safe to represent if every level present has the exact same set of
// factors and the levels are contiguous (our UI always applies one shared
// range to a pick) - anything else can't be represented without silently
// turning an OR (what overlaps() means) into an AND (what separate picks
// mean), so it's reported as unparseable instead of guessed at. When that
// consistent set covers every factor of the color it's "Any"; otherwise
// it's a "Custom" pick over that specific subset.
function idsToPicks(ids: number[], colorFactors: Factor[]): SparkGroup['picks'] | null {
  const byLevel = new Map<number, Set<number>>();
  const byFactor = new Map<number, number[]>();
  for (const id of ids) {
    const { factorId, level } = decodeSparkId(id);
    if (!byLevel.has(level)) byLevel.set(level, new Set());
    byLevel.get(level)!.add(factorId);
    if (!byFactor.has(factorId)) byFactor.set(factorId, []);
    byFactor.get(factorId)!.push(level);
  }

  const distinctFactors = [...byFactor.keys()];
  if (distinctFactors.length === 1) {
    const factorId = distinctFactors[0];
    const levels = byFactor.get(factorId)!;
    return [{ id: nextId(), factorId, customFactorIds: [], min: Math.min(...levels), max: Math.max(...levels) }];
  }

  const levels = [...byLevel.keys()].sort((a, b) => a - b);
  const isContiguous = levels.every((lvl, idx) => idx === 0 || lvl === levels[idx - 1] + 1);
  if (levels.length === 0 || !isContiguous) return null;

  const firstSet = byLevel.get(levels[0])!;
  const isConsistent = levels.every((lvl) => {
    const set = byLevel.get(lvl)!;
    return set.size === firstSet.size && [...set].every((id) => firstSet.has(id));
  });
  if (!isConsistent) return null;

  const min = levels[0];
  const max = levels[levels.length - 1];
  const allFactorIds = new Set(colorFactors.map((f) => f.id));
  const isEveryFactor = firstSet.size === allFactorIds.size && [...firstSet].every((id) => allFactorIds.has(id));

  if (isEveryFactor) {
    return [{ id: nextId(), factorId: ANY_FACTOR_ID, customFactorIds: [], min, max }];
  }
  return [
    { id: nextId(), factorId: CUSTOM_FACTOR_ID, customFactorIds: [...firstSet].sort((a, b) => a - b), min, max },
  ];
}

// "Main {Factor} = N" / ">= N" / "<= N" - the site's readable form for a
// main-parent-scoped single-factor comparison (confirmed against
// umamoe-frontend's buildFriendlyFactorFilterUqlClause, and against the UQL
// reference doc's "Main Right-Handed ○ >= 2" example). Resolved by searching
// every main-scoped field's factor list for a name match, since the text
// alone doesn't say which color the factor belongs to.
const MAIN_NAMED_RE = /^main\s+(.+?)\s*(=|==|>=|<=)\s*(\d+)$/i;
const MAIN_FIELD_DEFS = SPARK_FIELD_DEFS.filter((def) => def.scope === 'main');

function resolveMainNamedFactor(rawName: string): { field: string; factorId: number; maxStars: number } | null {
  const target = normalize(rawName);
  for (const def of MAIN_FIELD_DEFS) {
    const factor = def.factors.find((f) => normalize(f.name) === target);
    if (factor) return { field: def.field, factorId: factor.id, maxStars: def.maxStars };
  }
  return null;
}

function parseNamedFactorAtom(text: string, warnings: string[]): { field: string; pick: SparkGroup['picks'][number] } | null {
  const match = MAIN_NAMED_RE.exec(text.trim());
  if (!match) return null;
  const [, rawName, op, rawValue] = match;
  const resolved = resolveMainNamedFactor(rawName);
  if (!resolved) {
    warnings.push(`Unrecognized main-parent factor: "${rawName.trim()}"`);
    return null;
  }
  const value = parseInt(rawValue, 10);
  let min: number;
  let max: number;
  if (op === '>=') {
    min = value;
    max = resolved.maxStars;
  } else if (op === '<=') {
    min = 1;
    max = value;
  } else {
    // '=' or '=='
    min = value;
    max = value;
  }
  return {
    field: resolved.field,
    pick: { id: nextId(), factorId: resolved.factorId, customFactorIds: [], min, max },
  };
}

// `main_pink_factors in (1102, 3402, ...)` / `main_pink_factors = 1102` - how
// the site writes a raw id match on the scalar main-parent fields
// (blue/pink/green). Only scalar fields are accepted here; array fields use
// overlaps().
const SCALAR_ID_RE = /^([A-Za-z_][A-Za-z0-9_]*)\s*(?:in\s*\(([^()]*)\)|=\s*(\d+))$/i;

function parseScalarIdAtom(text: string): { field: string; ids: number[] } | null {
  const match = SCALAR_ID_RE.exec(text.trim());
  if (!match) return null;
  const field = match[1].toLowerCase();
  const def = SPARK_FIELD_BY_NAME.get(field);
  if (!def || def.isArray) return null;
  const rawIds = match[2] !== undefined ? match[2].split(',') : [match[3]];
  const ids = rawIds.map((s) => parseInt(s.trim(), 10)).filter((n) => Number.isFinite(n));
  if (ids.length === 0) return null;
  return { field, ids };
}

// One AND-part inside a spark expression: a raw overlaps() call, a scalar
// `field in (ids)` / `field = id` match, or a "Main {Factor} = N" comparison.
// All resolve to the same {field, pick} shape so they compose through the
// same AND/OR group logic below. An overlaps() on a scalar field (what older
// builds of this tool emitted) is still accepted, and is rewritten to the
// correct form on the next compile.
function parseSparkAtom(text: string, warnings: string[]): { field: string; pick: SparkGroup['picks'][number] } | null {
  const idAtom = parseOverlapsAtom(text) ?? parseScalarIdAtom(text);
  if (idAtom) {
    const def = SPARK_FIELD_BY_NAME.get(idAtom.field);
    if (!def) return null;
    const picks = idsToPicks(idAtom.ids, def.factors);
    if (!picks || picks.length !== 1) return null;
    return { field: idAtom.field, pick: picks[0] };
  }
  return parseNamedFactorAtom(text, warnings);
}

// Parses a boolean expression of spark atoms for a single spark field
// (possibly wrapped in parens, ANDs within a group, ORs between groups -
// exactly the shape compile.ts produces). Returns null if the expression
// contains anything outside that shape (mixed fields, other functions, an
// unrepresentable multi-factor overlaps(), etc).
function parseSparkExpression(raw: string, warnings: string[]): { field: string; groups: SparkGroup[] } | null {
  const text = stripOuterParens(raw);
  const orParts = splitTopLevel(text, 'or');
  let field: string | null = null;
  const groups: SparkGroup[] = [];

  for (const orPart of orParts) {
    const andParts = splitTopLevel(stripOuterParens(orPart), 'and');
    const picks: SparkGroup['picks'] = [];
    for (const andPart of andParts) {
      const atom = parseSparkAtom(stripOuterParens(andPart), warnings);
      if (!atom) return null;
      if (field === null) field = atom.field;
      else if (field !== atom.field) return null; // mixed fields, unsupported
      picks.push(atom.pick);
    }
    if (picks.length === 0) return null;
    groups.push({ id: nextId(), picks });
  }

  if (!field || groups.length === 0) return null;
  return { field, groups };
}

const MAIN_CHAR_PREFIX = /^main\s+character\s+in\s*/i;
const GP_CHAR_PREFIX = /^gp\s+character\s+in\s*/i;
const OPTIONAL_MAIN_WHITE_PREFIX = /^optional\s+main\s+white\s+in\s*/i;
const OPTIONAL_WHITE_PREFIX = /^optional\s+white\s+in\s*/i;
const PRIORITY_PARAM_RE = /^(priority|priority_group|prio_group|group)\s*=\s*(\d+)$/i;

function parseCharacterList(raw: string, warnings: string[]): number[] {
  const ids: number[] = [];
  for (const rawName of raw.split(',').map((s) => s.trim()).filter(Boolean)) {
    const id = resolveId(rawName, characterByName);
    if (id === null) warnings.push(`Unrecognized character: "${rawName}"`);
    else ids.push(id);
  }
  return ids;
}

function parseOptionalWhite(raw: string, warnings: string[]): { factorIds: number[]; priority: number } {
  const segments = raw.split(',').map((s) => s.trim()).filter(Boolean);
  let priority = 0;
  const factorIds: number[] = [];
  for (const segment of segments) {
    const priorityMatch = PRIORITY_PARAM_RE.exec(segment);
    if (priorityMatch) {
      priority = parseInt(priorityMatch[2], 10);
      continue;
    }
    if (/^[a-z_]+\s*=/.test(segment)) continue; // other scoring params (weight, base, decay, ...) - not surfaced in the UI, safe to drop
    const id = resolveId(segment, factorByName);
    if (id === null) warnings.push(`Unrecognized white factor: "${segment}"`);
    else factorIds.push(id);
  }
  return { factorIds, priority };
}

export function parseUQL(raw: string): ParseResult {
  const state = createEmptyState();
  const warnings: string[] = [];
  const text = raw.replace(/\s+/g, ' ').trim();

  if (!text) return { state, warnings };

  const groupsByField: Record<string, SparkGroup[]> = Object.fromEntries(
    SPARK_FIELD_DEFS.map((def) => [def.field, [] as SparkGroup[]]),
  );

  for (const rawSegment of splitTopLevel(text, 'and')) {
    const segment = stripOuterParens(rawSegment);
    if (!segment) continue;

    const mainCharContent = matchBalancedCall(segment, MAIN_CHAR_PREFIX);
    if (mainCharContent !== null) {
      state.mainCharacterIds.push(...parseCharacterList(mainCharContent, warnings));
      continue;
    }

    const gpCharContent = matchBalancedCall(segment, GP_CHAR_PREFIX);
    if (gpCharContent !== null) {
      state.gpCharacterIds.push(...parseCharacterList(gpCharContent, warnings));
      continue;
    }

    const optionalMainWhiteContent = matchBalancedCall(segment, OPTIONAL_MAIN_WHITE_PREFIX);
    if (optionalMainWhiteContent !== null) {
      const parsed = parseOptionalWhite(optionalMainWhiteContent, warnings);
      if (parsed.factorIds.length > 0) {
        state.optionalMainWhite.push({ id: nextId(), factorIds: parsed.factorIds, priority: parsed.priority });
      }
      continue;
    }

    const optionalWhiteContent = matchBalancedCall(segment, OPTIONAL_WHITE_PREFIX);
    if (optionalWhiteContent !== null) {
      const parsed = parseOptionalWhite(optionalWhiteContent, warnings);
      if (parsed.factorIds.length > 0) {
        state.optionalWhite.push({ id: nextId(), factorIds: parsed.factorIds, priority: parsed.priority });
      }
      continue;
    }

    const sparkExpr = parseSparkExpression(segment, warnings);
    if (sparkExpr) {
      const existing = groupsByField[sparkExpr.field];
      if (existing.length === 0) {
        // First condition seen for this field.
        groupsByField[sparkExpr.field] = sparkExpr.groups;
      } else if (existing.length === 1 && sparkExpr.groups.length === 1) {
        // Two separate top-level "and"-joined conditions on the same field
        // (our own compiler always wraps a field's conditions into one
        // segment, but a hand-written or site-copied query may not) - both
        // are plain requirements with no internal "or", so they combine as
        // additional picks in the one existing group (still AND'd).
        existing[0].picks.push(...sparkExpr.groups[0].picks);
      } else {
        // Combining an existing OR-of-groups with another separate
        // top-level condition on the same field would need distributing
        // AND over OR, which our flat group model can't represent -
        // report it instead of guessing at the wrong structure.
        warnings.push(`Couldn't combine multiple conditions on ${sparkExpr.field}: "${segment}"`);
      }
      continue;
    }

    warnings.push(`Couldn't map to a filter above: "${segment}"`);
  }

  state.blueGroups = groupsByField.blue_sparks;
  state.pinkGroups = groupsByField.pink_sparks;
  state.greenGroups = groupsByField.green_sparks;
  state.whiteGroups = groupsByField.white_sparks;
  state.mainBlueGroups = groupsByField.main_blue_factors;
  state.mainPinkGroups = groupsByField.main_pink_factors;
  state.mainGreenGroups = groupsByField.main_green_factors;
  state.mainWhiteGroups = groupsByField.main_white_factors;

  return { state, warnings };
}
