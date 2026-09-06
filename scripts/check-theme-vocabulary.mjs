#!/usr/bin/env node
/**
 * Assert the frontend and backend **controlled vocabularies** are the same lists.
 *
 * Four of them now: `themes` (14 ids), `places.setting` (4), and `FV-029`'s two accessibility
 * lists — the answer levels and the sources. The filename still says "theme" because renaming it
 * would churn `package.json`, the CI workflow and four documents to rename a check that already
 * does the job — the header is the accurate description.
 *
 * **Why this exists.** A theme id is stored in `places.themes` and is what the browse filter offers,
 * so it is a contract both tiers have to agree on. They cannot share a module — the frontend is ESM
 * in one package, the backend CommonJS in another — so the list is duplicated, and a duplicate
 * without a check is exactly how the seed came to carry `heritage` and `spiritual`, neither of which
 * is a theme.
 *
 * Same class of guard as `check-api-docs.mjs`: it asserts a property no test covers and no build
 * breaks on. The parse is deliberately dumb — a regex over each file beats importing an ESM module
 * from a CommonJS script to answer a question about a list of strings.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** `{ id: 'beach', ... }` from the frontend's THEMES array, in order. */
const frontendIds = () => {
  const source = readFileSync(join(ROOT, 'frontend/src/constants/themes.js'), 'utf8');
  const block = /export const THEMES = \[([\s\S]*?)\];/.exec(source);
  if (!block) throw new Error('frontend themes.js: could not find the THEMES array');
  return [...block[1].matchAll(/id:\s*'([^']+)'/g)].map((m) => m[1]);
};

/** The backend's flat THEME_IDS array, in order. */
const backendIds = () => {
  const source = readFileSync(join(ROOT, 'backend/src/constants/themes.js'), 'utf8');
  const block = /const THEME_IDS = \[([\s\S]*?)\];/.exec(source);
  if (!block) throw new Error('backend themes.js: could not find the THEME_IDS array');
  return [...block[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
};

/** The frontend's `PLACE_SETTINGS`, in order (`TD-023`). */
const frontendSettings = () => {
  const source = readFileSync(join(ROOT, 'frontend/src/constants/placeSetting.js'), 'utf8');
  const block = /export const PLACE_SETTINGS = \[([\s\S]*?)\];/.exec(source);
  if (!block) throw new Error('frontend placeSetting.js: could not find PLACE_SETTINGS');
  return [...block[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
};

/** The backend's `PLACE_SETTINGS` — the authority, and what the column's CHECK constraint mirrors. */
const backendSettings = () => {
  const source = readFileSync(join(ROOT, 'backend/src/constants/placeSetting.js'), 'utf8');
  const block = /const PLACE_SETTINGS = \[([\s\S]*?)\];/.exec(source);
  if (!block) throw new Error('backend placeSetting.js: could not find PLACE_SETTINGS');
  return [...block[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
};

/** A named `export const NAME = [...]` / `const NAME = [...]` list of quoted strings, in order. */
const listFrom = (file, name) => {
  const source = readFileSync(join(ROOT, file), 'utf8');
  const block = new RegExp(`${name} = \\[([\\s\\S]*?)\\];`).exec(source);
  if (!block) throw new Error(`${file}: could not find ${name}`);
  return [...block[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
};

/**
 * The two `FV-029` vocabularies, which have the same third reader the settings do.
 *
 * Both back `CHECK` constraints, so a value only the frontend knows is a **500 from the database**
 * rather than a rejected request — and on this feature the column is a safety claim, which is why
 * they are guarded rather than trusted to stay in step.
 */
const ACCESSIBILITY_LISTS = [
  { name: 'ACCESS_LEVELS', label: 'accessibility answers' },
  { name: 'ACCESSIBILITY_SOURCES', label: 'accessibility sources' }
];

/**
 * The two `FV-028` vocabularies, held to the same rule for the same reason.
 *
 * `crowd_level` backs `places_crowd_level_known` and `seasonality_source` backs
 * `places_seasonality_source_known`, so a value only the frontend knows is a 500 from the database
 * rather than a rejected request. The stakes are lower than `FV-029`'s — a wrong crowd level is a
 * disappointing afternoon, not a wasted journey — but the failure mode is identical, and two
 * adjacent vocabularies with different guarantees is worse than one rule applied four times.
 */
const SEASONALITY_LISTS = [
  { name: 'CROWD_LEVELS', label: 'crowd levels' },
  { name: 'SEASONALITY_SOURCES', label: 'seasonality sources' }
];

const PAIRED_LISTS = [
  ...ACCESSIBILITY_LISTS.map((list) => ({ ...list, module: 'placeAccessibility' })),
  ...SEASONALITY_LISTS.map((list) => ({ ...list, module: 'placeSeasonality' }))
];

/**
 * `FV-020`'s four preference vocabularies — and the first ones here with a **third** tier to check.
 *
 * `TravelPreferences.jsx` says in its own header that *"two copies of a vocabulary is exactly the
 * shape `check:themes` exists to police"*, and then shipped four more copies without adding them
 * here. This is that sentence honoured.
 *
 * **Why the frontend list is parsed differently.** These are `{ id, label }` objects, not flat
 * strings, because a label is a product decision the database has no opinion about — `mid` renders
 * as "Mid-range". So the generic `listFrom` would collect the labels too and compare
 * `['budget', 'Budget', ...]` against `['budget', ...]`: a guard that fails constantly and gets
 * disabled. Ids only, by key.
 *
 * **Why three of them also read the migration.** `021_travel_preferences.sql` CHECKs the three
 * scalars in the database, so they inherit the `places.setting` hazard exactly: a value only the
 * application knows is not a rejected request, it is a **500 from Postgres**. `dietary_needs` and
 * `interests` are deliberately uncheck'd in SQL (the migration argues why), so `dietary_needs` is
 * two-tier and `interests` is not here at all — it *reuses* the theme ids, which the block below
 * already guards.
 */
const PREFERENCE_LISTS = [
  { name: 'BUDGET_BANDS', label: 'budget bands', column: 'budget_band' },
  { name: 'TRAVEL_PACES', label: 'travel paces', column: 'travel_pace' },
  { name: 'PARTY_TYPES', label: 'party types', column: 'party_type' },
  { name: 'DIETARY_NEEDS', label: 'dietary needs', column: null }
];

/** Ids only from a `[{ id: 'x', label: 'X' }]` list — see `PREFERENCE_LISTS`. */
const idsFrom = (file, name) => {
  const source = readFileSync(join(ROOT, file), 'utf8');
  const block = new RegExp(`${name} = \\[([\\s\\S]*?)\\];`).exec(source);
  if (!block) throw new Error(`${file}: could not find ${name}`);
  return [...block[1].matchAll(/id:\s*'([^']+)'/g)].map((m) => m[1]);
};

/**
 * The values inside a column's `CHECK (... IN (...))` in a migration.
 *
 * Anchored on the column name rather than on a line, and it **throws** when the constraint is not
 * found rather than returning `[]` — an empty list would compare unequal and read as a drift that
 * is really a moved constraint, which sends the next reader to the wrong file.
 */
const checkConstraintValues = (file, column) => {
  const source = readFileSync(join(ROOT, file), 'utf8');
  const block = new RegExp(`${column}\\s+IN\\s*\\(([^)]*)\\)`).exec(source);
  if (!block) throw new Error(`${file}: no CHECK ... ${column} IN (...) constraint found`);
  return [...block[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
};

const MIGRATION_021 = 'backend/src/config/migrations/021_travel_preferences.sql';

for (const { name, label, column } of PREFERENCE_LISTS) {
  const fe = idsFrom('frontend/src/constants/preferences.js', name);
  const be = listFrom('backend/src/constants/travelPreferences.js', name);

  if (fe.length === 0 || be.length === 0) {
    console.error(`  EMPTY  ${label} parsed to nothing — the guard would pass vacuously`);
    process.exit(1);
  }
  if (fe.join(',') !== be.join(',')) {
    console.error(`  ${label.toUpperCase()} MISMATCH`);
    console.error(`         frontend: [${fe.join(', ')}]`);
    console.error(`         backend:  [${be.join(', ')}]`);
    console.error('         A preference only the form offers is one the API rejects.');
    process.exit(1);
  }

  if (!column) continue;

  // Set comparison, not order: SQL lists an unordered membership set, and requiring the migration
  // to be re-edited because the form reordered two options would be a guard nobody could satisfy.
  const sql = checkConstraintValues(MIGRATION_021, column);
  const missingInSql = be.filter((id) => !sql.includes(id));
  const extraInSql = sql.filter((id) => !be.includes(id));

  if (missingInSql.length > 0 || extraInSql.length > 0) {
    console.error(`  ${label.toUpperCase()} vs THE DATABASE`);
    console.error(`         application: [${be.join(', ')}]`);
    console.error(`         ${column} CHECK: [${sql.join(', ')}]`);
    for (const id of missingInSql)
      console.error(`         '${id}' is offered and validated but the CHECK rejects it — a 500`);
    for (const id of extraInSql)
      console.error(`         '${id}' is allowed by the CHECK but nothing can ever set it`);
    process.exit(1);
  }
}

for (const { name, label, module } of PAIRED_LISTS) {
  const fe = listFrom(`frontend/src/constants/${module}.js`, name);
  const be = listFrom(`backend/src/constants/${module}.js`, name);

  if (fe.length === 0 || be.length === 0) {
    console.error(`  EMPTY  ${label} parsed to nothing — the guard would pass vacuously`);
    process.exit(1);
  }
  if (fe.join(',') !== be.join(',')) {
    console.error(`  ${label.toUpperCase()} MISMATCH`);
    console.error(`         frontend: [${fe.join(', ')}]`);
    console.error(`         backend:  [${be.join(', ')}]`);
    console.error(
      '         A value only the frontend knows reaches the CHECK constraint as a 500.'
    );
    process.exit(1);
  }
}

const frontend = frontendIds();
const backend = backendIds();

/**
 * The setting vocabulary is checked first and exits on its own failure.
 *
 * It has a third reader the themes do not: a `CHECK` constraint on the column. So a frontend value
 * the backend does not know is not a rejected request, it is a **500 from the database** — the UI
 * offers "outside", the validator has no opinion because the list it checks against is the one that
 * drifted, and Postgres refuses the row.
 */
const feSettings = frontendSettings();
const beSettings = backendSettings();

if (feSettings.length === 0 || beSettings.length === 0) {
  console.error('  EMPTY  a setting vocabulary parsed to nothing — the guard would pass vacuously');
  process.exit(1);
}

if (feSettings.join(',') !== beSettings.join(',')) {
  console.error('  SETTING VOCABULARY MISMATCH');
  console.error(`         frontend: [${feSettings.join(', ')}]`);
  console.error(`         backend:  [${beSettings.join(', ')}]`);
  console.error('         A value only the frontend knows reaches the CHECK constraint as a 500.');
  process.exit(1);
}

if (frontend.length === 0) {
  console.error(
    '  EMPTY  the frontend vocabulary parsed to nothing — the guard would pass vacuously'
  );
  process.exit(1);
}

const missing = frontend.filter((id) => !backend.includes(id));
const extra = backend.filter((id) => !frontend.includes(id));
const sameOrder = frontend.join(',') === backend.join(',');

if (missing.length === 0 && extra.length === 0 && sameOrder) {
  console.log(
    `  OK  both tiers declare the same ${frontend.length} theme ids, the same ` +
      // Counted from `PAIRED_LISTS` rather than typed, so adding a vocabulary cannot leave this
      // line claiming a number it no longer checks.
      `${feSettings.length} place settings and the same ${PAIRED_LISTS.length} paired vocabularies, ` +
      `in the same order; ${PREFERENCE_LISTS.length} preference vocabularies agree across both ` +
      // Counted, not typed, for the same reason as the line above.
      `tiers and ${PREFERENCE_LISTS.filter((list) => list.column).length} of them agree with the ` +
      `CHECK constraints in 021`
  );
  process.exit(0);
}

for (const id of missing)
  console.error(`  MISSING IN BACKEND   ${id} — the API would reject a theme the UI offers`);
for (const id of extra)
  console.error(`  MISSING IN FRONTEND  ${id} — the API would accept a theme no filter shows`);
if (missing.length === 0 && extra.length === 0 && !sameOrder) {
  console.error(
    '  ORDER  the same ids in a different order — harmless today, but the lists are meant to be copies'
  );
}
process.exit(1);
