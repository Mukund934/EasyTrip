# API test suite

Jest + supertest against **a real Postgres**, driving the real Express app (`IMP-092`).

## Running them

The suite needs a database and refuses to start without one — it will not fall back to a default,
because a default is how a test run ends up truncating somebody's development data.

```bash
# Point DATABASE_URL at a throwaway database, then:
cd backend && npm test
```

CI provides one as a service container (`.github/workflows/ci.yml`, job `api-tests`). Locally, the
docker-compose Postgres works:

```bash
docker compose up -d postgres
DATABASE_URL=postgresql://easytrip:easytrip@localhost:5432/easytrip npm test
```

> **The suite truncates every table in `beforeEach`.** Never point `DATABASE_URL` at a database
> whose contents you want to keep.

## How it is put together

| File                      | Role                                                                                    |
| ------------------------- | --------------------------------------------------------------------------------------- |
| `setup/env.js`            | Runs before any module loads: fills the environment gate and swaps in the Firebase mock |
| `helpers/firebaseMock.js` | Stands in for `firebase-admin`; a token is a base64 JSON payload                        |
| `helpers/testDb.js`       | Builds the schema, re-seeds between tests, resets the rate limiters                     |
| `../src/config/seed.js`   | The deterministic fixtures (`IMP-095`), shared with `npm run seed`                      |

**Why the database is real.** Every interesting property in this API is a property of SQL: the
rating trigger that keeps `places.rating_sum` in step with `place_reviews`, the
`UNIQUE (place_id, user_id)` that turns a second review into an edit, the foreign key that makes a
review of a nonexistent place impossible. A mocked `pool` would assert that the code sends the
query it was written to send — which is the one thing already obvious from reading it.

**Why Firebase is mocked.** The middleware asks Firebase exactly one question: decode this token.
Everything after that — is this caller an admin, does the token's claim agree with the database, is
the admin flag still true — is EasyTrip's own logic, and that is what is worth testing. A test
token is `authHeader({ uid: 'seed-admin-uid' })`; `INVALID` and `EXPIRED` simulate the two failures
the real SDK signals by throwing.

**Why `maxWorkers: 1`.** Every suite truncates and re-seeds the same database, so two workers would
wipe each other's fixtures mid-test. Parallelism here needs one database per worker; a fast suite
that lies is worse than a slow one that does not.

**Why the rate limiters are reset between tests.** The stores are in-memory and per-process, so
they accumulate across a file. The newsletter bucket is 5 per hour by design, which is fewer
requests than its own test file makes — without a reset, every assertion after the fifth depends on
how many requests the earlier ones happened to send.

## What is covered

| Suite                     | Locks in                                                                                                                                   |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `auth.test.js`            | `IMP-001/002/003` — no client-supplied identity, no forged admin claim, DB is the authority                                                |
| `places.test.js`          | CRUD, pagination, filters (`IMP-011`), the validation boundary (`IMP-057`)                                                                 |
| `reviews.test.js`         | `IMP-019/021/023` — author privacy, upsert-not-duplicate, real reports, trigger-maintained aggregates, and the deliberate 403-vs-404 split |
| `platform.test.js`        | health, profile scoping, newsletter, helmet headers, JSON error shapes                                                                     |
| `rateLimit.test.js`       | the buckets, **and** what they deliberately do not block                                                                                   |
| `env.test.js`             | the boot refusal — the server must not start on a half-configured environment                                                              |
| `imageUpload.test.js`     | `IMP-014` — the multipart path with multer running for real; only the network call is stubbed                                              |
| `routeShadowing.test.js`  | `BUG C2` — no `(method, path)` declared by two routers, and every rate limiter attached to a route that exists                             |
| `adminManagement.test.js` | Granting and revoking admin — the column and the Firebase claim move together, and unrelated claims survive                                |
| `publicIdFromUrl.test.js` | The Cloudinary id recovered from a stored URL is the one that was uploaded — the input to an irreversible remote delete                    |

`routeShadowing.test.js` is the odd one out and says so in its own header: it asserts the **shape of
the mounted route table** rather than the behaviour of a request. That is deliberate, because the
failure it guards is invisible to a request — when two routers declare the same pair, the first one
answers correctly and the second is simply never reached. It is also the only suite that depends on
private Express internals (`app._router.stack`), and `tests/helpers/routeTable.js` throws by name
rather than enumerating an empty table if a future Express removes them.

## What it does not cover

- The frontend. Component tests are `IMP-093`, end-to-end is `IMP-094`.
- Cloudinary upload and destroy. Both are mocked at the config layer; exercising them needs either
  a real account or a fake, and neither belongs in this suite.
- Concurrency. Every assertion is sequential, so nothing here would catch a race between two
  simultaneous review submissions.
- Driver-fault paths in the review controller — the `42P10` missing-constraint and `42P01`
  missing-table mappings, and the generic `catch` arms. Reaching them means dropping a table or a
  constraint against the database every other test shares. Tracked as `TD-017`, with the measured
  numbers and the reasoning in `docs/VERIFICATION_LEDGER.md` §6.
- Controller-level `401` guards that sit behind `isAuthenticated`. They are unreachable through the
  routed stack; testing them by calling the controller with a mock `req` would assert that a
  backstop exists, not that the app is safe.

## What is deliberately not a test

`scripts/check-module-size.mjs` enforces Phase 5's 500-line criterion in CI. It is an **architecture
guard** — it asserts nothing about behaviour, and it is named that way on purpose.
`docs/VERIFICATION_LEDGER.md` explains why the distinction is worth keeping: the suites it replaced
looked like coverage long after they had stopped proving anything.
