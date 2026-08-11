const request = require('supertest');
const app = require('../app');
const { createSchema, resetData, closeDb, resetRateLimits } = require('./helpers/testDb');
const { authHeader } = require('./helpers/firebaseMock');

/**
 * Rate limiting (IMP-092, covering the buckets added in Phase 1).
 *
 * Worth its own file because it is the only thing bounding the one unauthenticated write in the
 * API, and because a limiter is trivially easy to disable by accident — reordering middleware, or
 * mounting a router above `app.use(globalLimiter)`, silently removes it and nothing else notices.
 */

const ADMIN = { uid: 'seed-admin-uid' };

beforeAll(async () => {
  await createSchema();
});
beforeEach(async () => {
  await resetData();
  resetRateLimits(app);
});
afterAll(async () => {
  await closeDb();
});

/** Fire `n` requests in sequence and return the status codes. */
const fire = async (n, make) => {
  const codes = [];
  for (let i = 0; i < n; i += 1) codes.push((await make(i)).status);
  return codes;
};

describe('the newsletter bucket — 5 per hour', () => {
  test('allows five and rejects the sixth with 429', async () => {
    const codes = await fire(6, (i) =>
      request(app)
        .post('/api/newsletter')
        .send({ email: `reader${i}@example.com` })
    );
    expect(codes.slice(0, 5).every((c) => c < 400)).toBe(true);
    expect(codes[5]).toBe(429);
  });

  test('a rejected request does not reach the database', async () => {
    await fire(6, (i) =>
      request(app)
        .post('/api/newsletter')
        .send({ email: `r${i}@example.com` })
    );
    const { pool } = require('./helpers/testDb');
    const { rows } = await pool.query('SELECT count(*)::int AS n FROM newsletter_subscribers');
    // Five accepted, the sixth rejected before the handler.
    expect(rows[0].n).toBe(5);
  });

  test('the 429 carries a JSON message, not an HTML error page', async () => {
    await fire(5, (i) =>
      request(app)
        .post('/api/newsletter')
        .send({ email: `x${i}@example.com` })
    );
    const res = await request(app).post('/api/newsletter').send({ email: 'over@example.com' });
    expect(res.status).toBe(429);
    expect(res.body.message).toMatch(/too many/i);
  });

  test('standard RateLimit headers are advertised', async () => {
    const res = await request(app).post('/api/newsletter').send({ email: 'headers@example.com' });
    // `standardHeaders: true` — a client can back off politely instead of hammering until 429.
    const names = Object.keys(res.headers).join(',');
    expect(names).toMatch(/ratelimit/i);
    expect(res.headers['x-ratelimit-limit']).toBeUndefined(); // legacyHeaders: false
  });
});

describe('the review bucket — 10 per hour', () => {
  test('the eleventh review write is rejected', async () => {
    const codes = await fire(11, () =>
      request(app)
        .post('/api/places/4/reviews')
        .set({ Authorization: authHeader({ uid: 'seed-user-uid' }) })
        .send({ rating: 5, comment: 'spam' })
    );
    expect(codes[10]).toBe(429);
  });
});

describe('what the limiters deliberately do NOT block', () => {
  test('reads are not bucketed with writes', async () => {
    // The newsletter bucket is exhausted; a GET must still work. A limiter mounted on the wrong
    // path would take the whole API down with one abusive poster.
    await fire(6, (i) =>
      request(app)
        .post('/api/newsletter')
        .send({ email: `y${i}@example.com` })
    );
    expect((await request(app).get('/api/places')).status).toBe(200);
  });

  test('a CORS preflight is never counted as caller intent', async () => {
    const codes = await fire(20, () =>
      request(app).options('/api/newsletter').set({ Origin: 'http://localhost:3000' })
    );
    expect(codes.every((c) => c !== 429)).toBe(true);
  });

  test('the image redirect is exempt from the global bucket', async () => {
    // ⚠️ This asserts current behaviour, and the behaviour is no longer justified — `BUG-049`.
    //
    // The reason used to be: "one browse page load arrives from the Next server as dozens of hits
    // from ONE ip; bucketing them 429s every user behind that proxy." `IMP-037` removed that proxy
    // hop, and Sprint 6.16 deleted the proxy itself as dead code, so nothing in the application
    // requests these routes at all. The exemption now takes two public endpoints out of the global
    // bucket for a condition that cannot occur.
    //
    // The test stays because it pins what the app does today; removing the exemption changes
    // rate-limiting on live routes, which is an operational decision and is left to the owner.
    const codes = await fire(30, () => request(app).get('/api/places/3/image'));
    expect(codes.every((c) => c !== 429)).toBe(true);
  });
});

describe('admin writes are bucketed but admin reads are not', () => {
  const header = { Authorization: authHeader(ADMIN) };

  test('a burst of admin reads is not rate limited', async () => {
    const codes = await fire(15, () => request(app).get('/api/admin/admins').set(header));
    expect(codes.every((c) => c === 200)).toBe(true);
  });
});
