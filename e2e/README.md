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

## Authentication — real Firebase tokens, no bypass

The suite authenticates with the **Firebase Auth Emulator** (`ADR-028`). Tokens it mints are
verified by the **real** `firebase-admin` `verifyIdToken()` — the same call, on the same code path,
that production makes. **No production code is modified and no production file knows the emulator
exists**; the Admin SDK simply honours `FIREBASE_AUTH_EMULATOR_HOST`.

Three deny options were rejected in `ADR-028`: an env-gated test verifier, accepting unsigned JWTs
outside production, and committing a throwaway service account. The first two are a signature check
with an off switch — the `x-user: AdminX` bypass Phase 1 existed to delete.

Three identities are provisioned per run, each proving one thing:

| Identity    | Token                        | `users.is_admin` | Proves                                                |
| ----------- | ---------------------------- | ---------------- | ----------------------------------------------------- |
| `admin`     | real                         | `true`           | The allow path                                        |
| `nonAdmin`  | real                         | `false`          | A valid token is still not an admin (`HOME_REDIRECT`) |
| `claimOnly` | real, carrying `admin: true` | `false`          | **`IMP-002`** — the database beats the claim          |

`e2e/global-setup.js` starts the emulator before the API, so the API inherits
`FIREBASE_AUTH_EMULATOR_HOST` and verifies for real. **No JVM is needed** — that prerequisite
applies to Firestore, Realtime Database and Pub/Sub; the Auth emulator is Node. If `firebase-tools`
is missing, the authenticated specs **skip with the reason printed**, because a skipped security
test must not look like a passing one.

### What this layer cannot prove

Emulator mode **disables signature verification** — that is what lets the emulator issue usable
tokens. So a payload tampered with while keeping a valid `aud`/`iss`/`exp` is accepted here and
would be rejected in production. Discovered by writing that test and watching it pass; the assertion
was replaced rather than the code weakened. Full breakdown in `SECURITY_AUDIT` §12.2.

Still open: driving the browser UI as a signed-in user (the review form calls `getIdToken` on the
_client_ SDK) needs `connectAuthEmulator` in `frontend/src/config/firebase.js`. Tracked in `TD-020`.

### Assert the gate, not the final URL

The admin pages carry client-side `useEffect` guards as defence in depth. That means a `page.goto`
plus a final-URL assertion **cannot tell "the server denied you" from "the server let you in and the
page bounced you afterwards"** — and the second means admin HTML was already sent. A mutation test
proved it: reintroducing `IMP-002` left the URL assertion green.

Authenticated specs therefore ask the gate directly with `maxRedirects: 0` and assert its status and
`location`. Same mutation now fails 2 tests.

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
