// Regenerates factors.json / characters.json in this directory from uma.moe's
// live public resource feed (https://uma.moe/resources/current/*.json.gz).
// This source is already global-only for characters (confirmed: ~99 entries
// vs 214 in a JP-inclusive snapshot, with isReleased_en present directly) and
// reflects the current live roster. factors.json is NOT global-filtered
// upstream, so green (unique skill) factors are filtered here by
// cross-referencing their owning character's base id against the global
// character roster; blue/pink/white factors are kept as-is (no per-skill
// global-availability signal exists in the source data - see project notes).
//
// factor_icon_mapping.json is rebuilt the way the site's own factor-catalog.ts
// does it: match each factor's name (NFKC, lowercased, trimmed) against the
// live skills resource's icon filenames (last match wins), falling back to the
// site's generic icons for white skills (type 3) and unique skills (type 5).
// Factors with no match (race/scenario sparks) keep whatever the previous
// mapping file had, so their icons don't disappear.
//
// Run with: node src/data/prep.mjs
const RESOURCE_BASE = 'https://uma.moe/resources/current';

function normalizeName(name) {
  return String(name ?? '').normalize('NFKC').toLowerCase().trim();
}

async function fetchJson(name) {
  const res = await fetch(`${RESOURCE_BASE}/${name}.json.gz`);
  if (!res.ok) throw new Error(`Failed to fetch ${name}: ${res.status}`);
  return res.json();
}

function getSkinName(namesRaw, charId) {
  const baseId = Math.floor(charId / 100).toString();
  const skinId = (charId % 100).toString().padStart(2, '0');
  return namesRaw[baseId]?.skins?.[skinId] || '';
}
function getBaseName(namesRaw, charId) {
  const baseId = Math.floor(charId / 100).toString();
  return namesRaw[baseId]?.name;
}

async function main() {
  const [factorsRaw, characterRaw, namesRaw, skillsRaw] = await Promise.all([
    fetchJson('factors'),
    fetchJson('character'),
    fetchJson('character_names'),
    fetchJson('skills'),
  ]);

  const characters = characterRaw.map((c) => {
    const id = parseInt(c.id, 10);
    const baseName = getBaseName(namesRaw, id) || c.name;
    const skin = getSkinName(namesRaw, id);
    const name = skin && skin !== 'Original' ? `${baseName} [${skin}]` : baseName;
    return { id, name, releaseDate: c.release_date };
  }).sort((a, b) => (b.releaseDate || '').localeCompare(a.releaseDate || ''));

  const globalBaseIds = new Set(characters.map((c) => Math.floor(c.id / 100)));

  const factors = factorsRaw
    .filter((f) => f.type !== -1)
    .filter((f) => {
      if (f.type !== 5) return true; // only green (unique skill) factors are character-linked
      const baseId = Math.floor(parseInt(f.id, 10) / 1000);
      return globalBaseIds.has(baseId);
    })
    .map((f) => ({ id: parseInt(f.id, 10), name: f.text, type: f.type }));

  console.log('characters:', characters.length, '(global-only, source: live uma.moe resources)');
  console.log('factors:', factors.length, 'by type:', factors.reduce((acc, f) => { acc[f.type] = (acc[f.type] || 0) + 1; return acc; }, {}));

  const fs = await import('fs');
  const path = await import('path');

  const skillIcons = new Map();
  for (const skill of Array.isArray(skillsRaw) ? skillsRaw : Object.values(skillsRaw)) {
    if (skill.icon) skillIcons.set(normalizeName(skill.name), skill.icon.replace(/\.png$/i, '.webp'));
  }
  const iconPath = path.join(import.meta.dirname, 'factor_icon_mapping.json');
  const previousIcons = fs.existsSync(iconPath) ? JSON.parse(fs.readFileSync(iconPath, 'utf8')) : {};
  const icons = {};
  for (const f of factors) {
    const matched = skillIcons.get(normalizeName(f.name));
    const fallback =
      f.type === 3 ? (f.id === 202160 ? 'utx_ico_skill_10051.webp' : 'utx_ico_skill_10011.webp')
        : f.type === 5 ? 'utx_ico_skill_20011.webp'
          : undefined;
    const icon = matched ?? previousIcons[String(f.id)] ?? fallback;
    if (icon) icons[String(f.id)] = icon;
  }
  const matchedCount = factors.filter((f) => skillIcons.has(normalizeName(f.name))).length;
  console.log(`icons: ${Object.keys(icons).length}/${factors.length} factors mapped (${matchedCount} matched by name)`);

  fs.writeFileSync(path.join(import.meta.dirname, 'factors.json'), JSON.stringify(factors));
  fs.writeFileSync(path.join(import.meta.dirname, 'characters.json'), JSON.stringify(characters));
  fs.writeFileSync(iconPath, JSON.stringify(icons));
  console.log('Wrote factors.json, characters.json and factor_icon_mapping.json');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
