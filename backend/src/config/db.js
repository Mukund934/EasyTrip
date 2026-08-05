const { Pool } = require('pg');

/**
 * The single Postgres connection pool for the server process (IMP-044).
 *
 * There were seven. Six connected via `DATABASE_URL` with *inconsistent* TLS settings — and two of
 * them (`authController`, `newsletterController`) had no `ssl` key at all, so against a host that
 * requires TLS they would fail while their neighbours worked. The seventh was this file, which read
 * an entirely different set of `POSTGRES_*` variables that nothing else sets, and was imported only
 * by `adminModel`/`userModel` — both dead code.
 *
 * Why one pool matters: each `new Pool()` maintains its own set of connections (pg defaults to 10).
 * Seven pools meant up to 70 connections from a single instance, against managed Postgres tiers that
 * often cap total connections around 60–100. Under load the app could exhaust its own database
 * before serving meaningful traffic, and the failure looks like unrelated timeouts.
 */

if (!process.env.DATABASE_URL) {
  // Fail loudly at require time. A pool built on `undefined` connects to a default local socket and
  // produces confusing "database does not exist" errors far from the real cause.
  console.error('DATABASE_URL is not set — the server cannot reach Postgres.');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,

  // TLS policy lives here and only here. `rejectUnauthorized: false` still accepts a
  // man-in-the-middle certificate and is tracked as TD-001 / IMP-063; the fix needs the provider's
  // CA bundle, which is a deployment concern rather than a code one. Consolidating the seven copies
  // into this single expression is what makes that later change a one-line edit.
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,

  // Bounded and explicit rather than relying on defaults, now that one pool serves the whole
  // process. 10 is pg's default; stating it makes the ceiling visible next to the reasoning above.
  max: Number(process.env.PG_POOL_MAX) || 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});

// A pooled client can be dropped by the server (idle timeout, failover). Without a listener, that
// arrives as an unhandled 'error' event and takes the process down.
pool.on('error', (error) => {
  console.error('Unexpected error on an idle Postgres client:', error.message);
});

// Export the pool itself and nothing more. An earlier version also assigned
// `module.exports.query = (text, params) => pool.query(text, params)` as a convenience — but since
// `module.exports` *is* `pool`, that overwrote `pool.query` with a function calling itself, and the
// first query blew the stack. The pool already exposes `.query`, so both `pool.query(...)` and the
// legacy `db.query(...)` call style work with no wrapper at all.
module.exports = pool;
