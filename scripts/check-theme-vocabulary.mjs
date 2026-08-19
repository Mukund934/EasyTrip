#!/usr/bin/env node
/**
 * Assert the frontend and backend theme vocabularies are the same list.
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

const frontend = frontendIds();
const backend = backendIds();

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
  console.log(`  OK  both tiers declare the same ${frontend.length} theme ids, in the same order`);
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
