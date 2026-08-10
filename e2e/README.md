# End-to-end suite

Playwright driving a real Chromium against the real stack — a real Next server, the real Express
API, and a real Postgres with the same deterministic fixtures the API suite uses (`IMP-094`).

The other two suites are `backend/tests` (API contracts) and `frontend/tests` (components and
helpers).

## Running them

```bash
npm run test:e2e
```

Nothing needs to be running first. `global-setup.js` provisions a throwaway Postgres, applies the
schema and every migration, seeds the fixtures and starts the API; Playwright starts the Next
server; `global-teardown.js` destroys all of it. A developer's own `npm run dev` and their own
Postgres can keep running throughout — the suite uses ports 3100, 5100 and 55470 precisely so it
never needs the machine to itself.

If `DATABASE_URL` is already set it is used as-is instead of booting a cluster. That is the only
difference between a laptop and CI, and it is why the setup has no `if (CI)` branch.

```bash
npm run test:e2e -- --ui        # pick and watch individual journeys
npx playwright show-trace test-results/<...>/trace.zip
```

## What this layer is for

Deliberately **not** a second copy of the API assertions. It exists for the failures the other two
suites structurally cannot see:

| Failure class                   | Why only a browser sees it                                                                                   |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Hydration mismatch              | The page still renders. It reports itself in the console and nowhere else — `BUG-046` shipped twice this way |
| Routing and redirects           | `getServerSideProps` returning `{ redirect }` is a server decision no unit test executes                     |
| A real 404 vs a soft one        | The status code matters for crawlers, and only a real request has one                                        |
| Client state across navigation  | Filters written to the address bar with `replaceState`, then re-read on a cold load                          |
| Frontend ↔ backend disagreement | Each side passes its own tests while disagreeing about the contract between them                             |
| What actually reaches the HTML  | A field can be excluded from _display_ and still be serialised into `__NEXT_DATA__`                          |

That last row is not hypothetical. It is how this suite found, on its first full run, that every
public place page carried a curating admin's raw Firebase UID in `__NEXT_DATA__` — a field both
`PlaceCard` and `MagazineDetails` already excluded from display, so no rendering test could see it,
and one the API suite could not flag because it was only asserting review-author privacy. Fixed in
`placeModel.getPlaceById`, with regression tests in both this suite and `backend/tests/places.test.js`.

## Why `next dev` rather than a production build

`next build && next start` is more faithful, and it already has its own CI job that fails on a
broken import or component. What this suite needs is SSR, hydration, routing and client state —
all of which `next dev` runs for real — at a cost that keeps it runnable. A two-minute build before
every E2E run is how a suite stops being run.

The tradeoff, stated plainly: this suite would not catch a defect that appears **only** in a
production build (a minification-only bug, or a difference in how `getStaticProps` caches). Those
belong to the `lint-and-build` job and to `IMP-113`'s SEO work.

## Authentication, and what is deliberately not covered

**The suite never authenticates through Firebase.** The admin journeys drive the `et_id_token`
cookie directly, because that cookie _is_ what the server-side gate reads — a Firebase ID token
lives in browser JS memory and is never sent with a document request, so `AuthContext` mirrors it
into that cookie for exactly this reason. Going through the real SDK would be a slower way of
setting the same value.

Every token used here is deliberately unverifiable, so the admin specs assert the **deny** paths:
no cookie, a malformed cookie, and a well-shaped but unsigned JWT carrying `admin: true` — the last
one specifically because a claim is not the authority, `users.is_admin` is (`IMP-002`/`IMP-003`).

**The allow path is not covered yet**, and this is the honest gap in the sprint. It needs a token
`firebase-admin` will accept, which means the **Firebase Auth Emulator**:

- the API needs `FIREBASE_AUTH_EMULATOR_HOST` — an official, env-only switch, no code change;
- the browser needs `connectAuthEmulator` in `src/config/firebase.js`, gated on a
  `NEXT_PUBLIC_*` variable — a small but real production-code change;
- the emulator needs `firebase-tools` and a JVM in CI.

Until that lands, the authenticated journeys the roadmap names — submitting a review, and admin
create/edit/delete — are covered at the API layer only. Tracked as `TD-020`. **No test-only
bypass was added to the production auth path to work around this**, because a verifier that can be
switched off by an environment variable is a worse outcome than a smaller suite.

## Conventions

- **One worker, no retries.** The journeys share one seeded database and several write to it, so
  parallelism would let a delete race a read. Retries would hide a flake rather than fix it, and a
  flaky E2E suite is how a team learns to re-run red builds.
- **Assert against the card, not the page.** `getByText('Hampi')` also matches a hidden
  `<option value="Hampi">` in the filter panel — it passed with zero results rendered until the
  locator was scoped. Prefer a scoped locator over a global text match.
- **Watch the console.** Hydration failures are console-only. Specs that navigate assert that no
  hydration error was logged.
- **Name the seed.** Fixtures are deterministic (`IMP-095`): Hampi is place 1 with 9/2 ratings,
  Badami is place 4 and unrated. `smoke.spec.js` asserts that, so a seed change fails there rather
  than as a confusing selector timeout elsewhere.
