/**
 * Phase 5 exit criterion, enforced.
 *
 * Phase 5 spent seven sprints pulling 7,805 lines of page components down to 1,134 and splitting a
 * 958-line controller into four (`IMP-070`, `IMP-126`). The criterion it was measured against —
 * *no source module over 500 lines* — was checked by hand each sprint with a throwaway script, so
 * nothing stopped a page from quietly growing back the week after the phase closed.
 *
 * This is that check, made permanent and wired into CI. It is an **architecture guard, not a
 * behaviour test**: it catches a module re-absorbing responsibilities its extraction removed, which
 * is the specific regression Phase 5 exists to prevent. It asserts nothing about what the code
 * does — that is what `backend/tests` is for.
 *
 * Exceptions are listed here with the id that justifies them, never suppressed silently. An
 * exception whose file has shrunk back under the limit is reported too: a stale waiver is how a
 * limit stops meaning anything.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LIMIT = 500;
const TREES = ['frontend/src', 'backend/src'];

/**
 * The one accepted overrun, and why.
 *
 * `mapStyles.js` is a single exported template literal of Leaflet CSS. `IMP-121` recorded that it
 * cannot be split without changing what renders, and `IMP-124` is the open question of whether a
 * stylesheet should count against a criterion written for code. Until that is decided it is a
 * waiver with a name on it rather than an unexplained red build.
 */
const WAIVERS = [
  {
    file: 'frontend/src/components/map/mapStyles.js',
    reason: 'one exported CSS template literal; unsplittable without changing render output',
    ref: 'IMP-121, open question in IMP-124'
  }
];

const walk = (dir, found = []) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, found);
    else if (/\.(js|jsx)$/.test(entry.name)) found.push(full);
  }
  return found;
};

const rel = (p) => path.relative(ROOT, p).split(path.sep).join('/');

// A trailing newline is not a line of code. Counting it would make the limit off by one and the
// numbers here disagree with the ones the roadmap quotes.
const lineCount = (p) => {
  const text = fs.readFileSync(p, 'utf8');
  const lines = text.split('\n');
  if (lines[lines.length - 1] === '') lines.pop();
  return lines.length;
};

const waived = new Map(WAIVERS.map((w) => [w.file, w]));
const violations = [];
const waiversHit = new Set();

for (const tree of TREES) {
  const abs = path.join(ROOT, tree);
  if (!fs.existsSync(abs)) {
    console.error(
      `  MISSING TREE  ${tree} does not exist — this script is looking at the wrong repo`
    );
    process.exit(2);
  }
  for (const file of walk(abs)) {
    const name = rel(file);
    const lines = lineCount(file);
    if (lines <= LIMIT) continue;
    if (waived.has(name)) {
      waiversHit.add(name);
      console.log(`  WAIVED  ${name} (${lines} lines) — ${waived.get(name).ref}`);
      continue;
    }
    violations.push([name, lines]);
  }
}

const staleWaivers = WAIVERS.filter((w) => !waiversHit.has(w.file));

violations.sort((a, b) => b[1] - a[1]);
for (const [name, lines] of violations) {
  console.error(`  OVER LIMIT  ${name} — ${lines} lines (limit ${LIMIT})`);
}

for (const w of staleWaivers) {
  const exists = fs.existsSync(path.join(ROOT, w.file));
  console.error(
    exists
      ? `  STALE WAIVER  ${w.file} is now under ${LIMIT} — remove it from WAIVERS`
      : `  STALE WAIVER  ${w.file} no longer exists — remove it from WAIVERS`
  );
}

if (violations.length === 0 && staleWaivers.length === 0) {
  console.log(
    `  OK  no module over ${LIMIT} lines outside the ${WAIVERS.length} recorded waiver(s)`
  );
  process.exit(0);
}

process.exit(1);
