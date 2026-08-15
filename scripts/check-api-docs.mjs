#!/usr/bin/env node
/**
 * Assert that README's API reference matches the routes the backend actually registers.
 *
 * **Why this exists.** The README's endpoint table opens with the sentence *"The table below is the
 * complete set of Express routes the backend actually registers."* That is a falsifiable claim, and
 * on 2026-08-15 it was false by 23 routes — trips, the wishlist, weather, typeahead, moderation,
 * analytics and geocoding had all shipped without it. Nothing failed, because nothing was checking.
 *
 * This is the same class of guard as `check-module-size.mjs`: it asserts a property no test covers
 * and no build breaks on. It is **not** a test — it makes no claim about behaviour — so it lives in
 * `scripts/` and runs as `npm run check:api-docs`.
 *
 * The parse is deliberately dumb. A regex over the route files and a regex over the markdown table
 * beats importing the Express app, which would need a database, Firebase credentials and the whole
 * environment gate to answer a question about text.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ROUTES_DIR = join(ROOT, 'backend/src/routes');
const README = join(ROOT, 'README.md');

/** Where each router file is mounted, from `app.js`. */
const MOUNTS = {
  'adminRoutes.js': '/admin',
  'authRoutes.js': '/auth',
  'newsletterRoutes.js': '/newsletter',
  'placeRoutes.js': ''
};

/**
 * Routes that exist but are deliberately undocumented.
 *
 * Empty, and that is the point: an entry here needs a reason next to it, so "we forgot" cannot
 * masquerade as "we decided".
 */
const UNDOCUMENTED_BY_DESIGN = new Set([]);

/** `/health` is registered directly in `app.js`, not in a router file. */
const EXTRA_ROUTES = new Set(['GET /health']);

const realRoutes = () => {
  const found = new Set(EXTRA_ROUTES);

  for (const file of readdirSync(ROUTES_DIR).filter((f) => f.endsWith('.js'))) {
    const mount = MOUNTS[file];
    if (mount === undefined) {
      throw new Error(
        `${file} has no mount recorded in check-api-docs.mjs. Add it (and its mount path from app.js).`
      );
    }

    const source = readFileSync(join(ROUTES_DIR, file), 'utf8');
    // Multi-line declarations are the norm here — the verb and path are on the first line, the
    // middleware on the ones after — so this matches only up to the path and ignores the rest.
    for (const [, verb, path] of source.matchAll(
      /router\.(get|post|put|patch|delete)\(\s*['"`]([^'"`]+)['"`]/g
    )) {
      const full = `${mount}${path}`.replace(/\/$/, '') || '/';
      found.add(`${verb.toUpperCase()} ${full}`);
    }
  }

  return found;
};

/** Every `| VERB | \`/path\` |` row in the README's tables. */
const documentedRoutes = () => {
  const source = readFileSync(README, 'utf8');
  const found = new Set();

  for (const [, verb, path] of source.matchAll(
    /^\|\s*(GET|POST|PUT|PATCH|DELETE)\s*\|\s*`([^`]+)`/gm
  )) {
    found.add(`${verb} ${path.replace(/\/$/, '') || '/'}`);
  }

  return found;
};

const real = realRoutes();
const documented = documentedRoutes();

const missing = [...real].filter((r) => !documented.has(r) && !UNDOCUMENTED_BY_DESIGN.has(r));
const phantom = [...documented].filter((r) => !real.has(r));

if (missing.length === 0 && phantom.length === 0) {
  console.log(`  OK  README documents all ${real.size} registered routes, and no others`);
  process.exit(0);
}

// Both directions matter, and for different reasons. A missing route is a README that undersells
// the API; a phantom one is a README that promises an endpoint returning 404 — which is worse,
// because somebody will write a client against it.
for (const route of missing) {
  console.error(`  UNDOCUMENTED  ${route} — registered by the backend, absent from README`);
}
for (const route of phantom) {
  console.error(`  PHANTOM       ${route} — documented in README, registered nowhere`);
}

console.error(
  `\n  ${missing.length} undocumented, ${phantom.length} phantom (${real.size} routes registered)`
);
process.exit(1);
