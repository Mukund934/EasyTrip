# Migrations

Every schema change lives here as a numbered `.sql` file. The runner is `backend/script/migrate.js`;
what has been applied is recorded in the `schema_migrations` table.

```bash
npm run migrate            # apply everything pending
npm run migrate:status     # what is applied, what is pending — changes nothing
npm run migrate:dry-run    # what WOULD be applied — changes nothing
```

Run from `backend/`, or use the root-level `npm run migrate` which does the `cd` for you.

---

## The rules

**1. Filenames are `NNN_short_description.sql`, zero-padded to three digits.**
Lexical order is the applied order. `10_x.sql` would sort before `2_x.sql`; `010_x.sql` does not.

**2. Every migration must be re-runnable.**
This is a hard requirement, not a nicety. `migrate.js` records a migration _after_ it commits, so a
crash in that window leaves it applied but unrecorded and it will run again. Re-runnability is what
makes that harmless. In practice this means `IF NOT EXISTS`, `ON CONFLICT DO NOTHING`, and
`DO $$ ... IF NOT EXISTS (SELECT 1 FROM pg_constraint ...) ... $$` guards around anything that would
otherwise error on a second run.

It is also what let this runner be adopted with no baselining step: on the existing database, where
001–004 had already been applied by hand, the first run re-applied them as no-ops and recorded them.

**3. Each file owns its own transaction.**
Write `BEGIN;` / `COMMIT;` inside the file. The runner deliberately does _not_ wrap files, because
a `COMMIT` inside an outer transaction commits the outer one — and because `004` needs to stay
outside a transaction so it can move to `CREATE INDEX CONCURRENTLY` later. This also keeps every
file directly runnable by hand:

```bash
psql "$DATABASE_URL" -f backend/src/config/migrations/001_phase1.sql
```

Omit the transaction only when you have a reason, and write the reason in the file — `004` does.

**4. An applied migration is immutable.**
The runner checksums each file and refuses to run if one changed after it was applied. The database
has the old version and your working tree has the new one; re-running cannot reconcile them. Put the
change in a new migration.

**5. Destructive steps go in a migration, never anywhere else.**
`001` deletes duplicate review rows. That is correct in a reviewed, transactional file that an
operator runs deliberately, and it is exactly what must never happen at server boot.

---

## Why not node-pg-migrate

It was the obvious choice and the roadmap named it. It wants its own migration format and filename
convention, which would have meant rewriting four hand-written files whose comments are the best
documentation this schema has, and breaking the `psql -f` path each of them advertises. The runner
is about a hundred lines of bookkeeping — `CREATE TABLE IF NOT EXISTS`, a `SELECT`, an advisory
lock, an `INSERT`. The files were worth more than the hundred lines. Recorded as `ADR-025`.

---

## The files

| File                            | What it does                                                                                                                                              |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `001_phase1.sql`                | One review per user per place (`IMP-062`). De-duplicates first — the only destructive step in the set. Re-syncs `rating_sum`/`rating_count`.              |
| `002_profile_fields.sql`        | `users.location`, `users.dob` — collected by the profile form since forever, never stored (`IMP-008`).                                                    |
| `003_sprint23.sql`              | `review_reports` and `newsletter_subscribers`, behind Sprint 2.3's replacements for mocked UI (`IMP-019`, `IMP-023`).                                     |
| `004_performance_indexes.sql`   | Phase 4 indexes (`IMP-043`). No transaction, deliberately — see the file header.                                                                          |
| `005_retire_boot_ddl.sql`       | Absorbs the `ALTER TABLE`s that `app.js` used to run on every boot (`IMP-069`).                                                                           |
| `006_reconcile_triggers.sql`    | Reconciles the rating triggers so `rating_sum`/`rating_count` cannot drift from `place_reviews`.                                                          |
| `007_saved_places.sql`          | `user_saved_places` — the wishlist (`IMP-108`, `ADR-030`). Apply before deploying the backend; the endpoints 500 until it lands.                          |
| `008_trips.sql`                 | `trips` / `trip_days` / `trip_items` — the trip workspace (`IMP-109`, `ADR-031`). Note the SET NULL cascade, which differs from 007 on purpose.           |
| `009_search.sql`                | `places.search_vector` (weighted, generated) + its GIN index and the prefix-query function (`IMP-112`, `ADR-032`).                                        |
| `010_coordinate_provenance.sql` | `places.coordinates_source` + two CHECKs — which geocoder produced a pin, so the ODbL notice credits exactly the rows that owe it (`IMP-127`, `ADR-039`). |

`schema.sql` is the fresh-database path: it creates the tables from nothing, and it is what
`docker-compose.yml` runs on first start. The migrations are the upgrade path for a database that
already exists — **and also the second half of the fresh path.** Every route to a working database
runs `schema.sql` and then `npm run migrate`: CI does it explicitly (`.github/workflows/ci.yml`,
job `migrations`), the API suite's `createSchema()` does it, and the quickstart tells a contributor
to. Neither half is optional.

That is why **table** creations are mirrored in `schema.sql` while **column** additions are not.
`009` and `010` add columns with constraints attached; declaring the column in `schema.sql` and
constraining it in the migration would leave a fresh database holding an unconstrained column for
the length of the migration run, which is a real state a bug can be written against. One file owns
each column.

_(This paragraph replaced an instruction to "update `schema.sql` to match" every migration —
written when the fresh path was `schema.sql` alone, and already contradicted by `009`, which
correctly did not. Corrected 2026-08-16 in the Sprint 8.2 integrity pass.)_
