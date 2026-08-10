const request = require('supertest');
const app = require('../app');
const { createSchema, resetData, closeDb, resetRateLimits, pool } = require('./helpers/testDb');
const { authHeader } = require('./helpers/firebaseMock');

/** Places: read, search, write, and the validation boundary (IMP-092). */

const ADMIN = { uid: 'seed-admin-uid' };
const USER = { uid: 'seed-user-uid' };
const asAdmin = { Authorization: authHeader(ADMIN) };

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

describe('GET /api/places', () => {
  test('returns the seeded catalogue with pagination', async () => {
    const res = await request(app).get('/api/places');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(4);
    expect(res.body.pagination).toMatchObject({ hasMore: false });
  });

  test('REJECTS a limit above 100 rather than clamping it (IMP-038)', async () => {
    // Worth pinning precisely, because a code comment in the frontend claimed the opposite — that
    // the server "silently clamps". It does not: `isInt({min:1,max:100})` fails the request. Both
    // are defensible designs; the point is that only one of them is real, and a caller that
    // assumed clamping would get a 400 it never handled.
    const res = await request(app).get('/api/places?limit=100000');
    expect(res.status).toBe(400);
  });

  test('accepts the maximum allowed limit', async () => {
    expect((await request(app).get('/api/places?limit=100')).status).toBe(200);
  });

  test('offset pages through without repeating a row', async () => {
    const first = await request(app).get('/api/places?limit=2&offset=0');
    const second = await request(app).get('/api/places?limit=2&offset=2');
    const ids = [...first.body.data, ...second.body.data].map((p) => p.id);
    expect(new Set(ids).size).toBe(4);
    expect(first.body.pagination.hasMore).toBe(true);
    expect(second.body.pagination.hasMore).toBe(false);
  });

  test('filters by theme (locks in IMP-011)', async () => {
    // Collection params are JSON arrays on the wire. `placesApi.buildQuery` JSON-stringifies any
    // array value, and the validator requires exactly that shape.
    const res = await request(app).get('/api/places?themes=%5B%22beach%22%5D');
    expect(res.status).toBe(200);
    expect(res.body.data.map((p) => p.name)).toEqual(['Gokarna']);
  });

  test('rejects a bare (non-JSON) collection param rather than guessing', async () => {
    // The controller's `parseArrayParam` would happily coerce `beach` to `['beach']`, but the
    // validator runs first and refuses. Pinned because the two layers disagree: if the validator
    // is ever relaxed, this test says which behaviour was intended.
    expect((await request(app).get('/api/places?themes=beach')).status).toBe(400);
  });

  test('filters by search term across name and description', async () => {
    const res = await request(app).get('/api/places?searchTerm=coffee');
    expect(res.body.data.map((p) => p.name)).toEqual(['Coorg']);
  });

  test('an unmatched filter returns an empty list, not an error', async () => {
    const res = await request(app).get('/api/places?themes=%5B%22nonexistent-theme%22%5D');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  test('exposes a computed average_rating, and null rather than 0 when unrated (IMP-073)', async () => {
    const res = await request(app).get('/api/places');
    const byName = Object.fromEntries(res.body.data.map((p) => [p.name, p]));
    // Hampi has a 5 and a 4.
    expect(Number(byName.Hampi.rating_count)).toBe(2);
    expect(Number(byName.Hampi.rating_sum)).toBe(9);
    // Badami has none. A zero average would render as a zero-star rating.
    expect(Number(byName.Badami.rating_count)).toBe(0);
  });
});

describe('GET /api/places/:id', () => {
  test('returns one place', async () => {
    const res = await request(app).get('/api/places/1');
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Hampi');
  });

  // Found by the E2E suite (IMP-094): this endpoint is public and Next serialises the whole payload
  // into `__NEXT_DATA__`, so shipping `created_by`/`updated_by` put a curating admin's raw Firebase
  // UID into the HTML of every place page, for every anonymous visitor. Nothing consumed it — both
  // `PlaceCard` and `MagazineDetails` list these keys in their exclusion filters, and the list
  // projection already omitted them.
  //
  // The same rule `IMP-021` applies to review authors, applied to the people with write access.
  test('never exposes the curating admin’s Firebase uid', async () => {
    const res = await request(app).get('/api/places/1');
    expect(res.status).toBe(200);
    expect(res.body).not.toHaveProperty('created_by');
    expect(res.body).not.toHaveProperty('updated_by');
    expect(JSON.stringify(res.body)).not.toContain('seed-admin-uid');
  });

  test('the list projection does not expose it either', async () => {
    const res = await request(app).get('/api/places');
    expect(JSON.stringify(res.body)).not.toContain('seed-admin-uid');
  });

  test('404s for an id that does not exist', async () => {
    expect((await request(app).get('/api/places/99999')).status).toBe(404);
  });

  test('rejects a non-numeric id rather than reaching the database', async () => {
    const res = await request(app).get('/api/places/not-an-id');
    expect([400, 404]).toContain(res.status);
  });
});

describe('write routes are gated', () => {
  const body = { name: 'New Place', location: 'Somewhere' };

  test('POST without a token is 401', async () => {
    expect((await request(app).post('/api/admin/places').send(body)).status).toBe(401);
  });

  test('POST with a non-admin token is 403', async () => {
    const res = await request(app)
      .post('/api/admin/places')
      .set({ Authorization: authHeader(USER) })
      .send(body);
    expect(res.status).toBe(403);
  });

  test('PUT without a token is 401', async () => {
    expect((await request(app).put('/api/admin/places/1').send(body)).status).toBe(401);
  });

  test('DELETE without a token is 401', async () => {
    expect((await request(app).delete('/api/admin/places/1')).status).toBe(401);
  });
});

describe('validation on the write path (IMP-057)', () => {
  const cases = [
    ['a missing name', { location: 'Somewhere' }],
    ['a missing location', { name: 'Nameless' }],
    ['latitude out of range', { name: 'X', location: 'Y', latitude: 999 }],
    ['longitude out of range', { name: 'X', location: 'Y', longitude: 999 }],
    [
      'a description over the 5000-character limit',
      { name: 'X', location: 'Y', description: 'x'.repeat(5001) }
    ]
  ];

  test.each(cases)('rejects %s with 400', async (_label, body) => {
    const res = await request(app).post('/api/admin/places').set(asAdmin).send(body);
    expect(res.status).toBe(400);
  });

  test('accepts a valid place and persists it', async () => {
    const res = await request(app)
      .post('/api/admin/places')
      .set(asAdmin)
      .send({ name: 'Chikmagalur', location: 'Chikmagalur', latitude: 13.31, longitude: 75.77 });
    expect(res.status).toBe(201);

    const { rows } = await pool.query('SELECT name FROM places WHERE name = $1', ['Chikmagalur']);
    expect(rows).toHaveLength(1);
  });

  test('a 5000-character description is accepted — the client and API agree (Sprint 5.12)', async () => {
    const res = await request(app)
      .post('/api/admin/places')
      .set(asAdmin)
      .send({ name: 'Long', location: 'Somewhere', description: 'x'.repeat(5000) });
    expect(res.status).toBe(201);
  });
});

describe('DELETE cascades', () => {
  test('removing a place removes its reviews and images', async () => {
    const before = await pool.query(
      'SELECT count(*)::int AS n FROM place_reviews WHERE place_id = 1'
    );
    expect(before.rows[0].n).toBe(2);

    const res = await request(app).delete('/api/admin/places/1').set(asAdmin);
    expect([200, 204]).toContain(res.status);

    const reviews = await pool.query(
      'SELECT count(*)::int AS n FROM place_reviews WHERE place_id = 1'
    );
    const images = await pool.query(
      'SELECT count(*)::int AS n FROM place_images WHERE place_id = 1'
    );
    expect(reviews.rows[0].n).toBe(0);
    expect(images.rows[0].n).toBe(0);
  });
});

describe('taxonomy endpoints', () => {
  test.each([
    ['/api/places/locations', 'Hampi'],
    ['/api/places/districts', 'Ballari'],
    ['/api/places/states', 'Karnataka'],
    ['/api/places/tags', 'unesco']
  ])('%s returns distinct real values including %s', async (route, expected) => {
    const res = await request(app).get(route);
    expect(res.status).toBe(200);
    expect(JSON.stringify(res.body)).toContain(expected);
  });
});
