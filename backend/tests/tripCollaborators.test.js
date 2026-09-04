const request = require('supertest');
const app = require('../app');
const { createSchema, resetData, closeDb, resetRateLimits, pool } = require('./helpers/testDb');
const { authHeader } = require('./helpers/firebaseMock');

/**
 * A trip somebody else can open (`FV-007` stage (a)).
 *
 * **The feature is an authorization change, so the tests are mostly about what is still refused.**
 * Before this, `trips.user_id` answered every question about a trip; now the read path asks a wider
 * one and every write path asks the old one. Three ways that can go wrong, and each has its own
 * block below:
 *
 *   1. **A viewer becomes an editor by accident.** The schema CHECKs exactly one role, `'viewer'`,
 *      because `viewer` is all the application enforces. If a collaborator can rename a trip, add a
 *      day, delete a stop or share a link, the word in the database is a lie.
 *   2. **The widened read leaks.** `READABLE_BY` is composed into two queries. A stranger must still
 *      get nothing from both, and — the subtler one — a collaborator must get the trip *with its
 *      days and items*, because a half-widened read returns a trip that looks empty rather than one
 *      that is refused.
 *   3. **Managing access becomes a shared power.** Reading who else is on a trip is fine for a
 *      viewer; adding and removing is the owner's alone. Otherwise a viewer can add an accomplice.
 *
 * The fourth thing worth asserting is that **nothing is emailed**, which is not observable from
 * here — so what is asserted instead is the behaviour that decision produces: an address nobody has
 * registered with is a 422 that says so, rather than a pending invitation that never arrives.
 */

const OWNER = { uid: 'seed-user-uid' };
const OTHER = { uid: 'seed-other-uid' };
const STRANGER = { uid: 'seed-admin-uid' };

const asOwner = { Authorization: authHeader(OWNER) };
const asOther = { Authorization: authHeader(OTHER) };
const asStranger = { Authorization: authHeader(STRANGER) };

const OTHER_EMAIL = 'other@easytrip.test';

/** A trip with one day and one stop, so a half-widened read is visible as an empty itinerary. */
const makeTrip = async () => {
  const created = await request(app)
    .post('/api/auth/trips')
    .set(asOwner)
    .send({ title: 'Karnataka in November', start_date: '2026-11-01', end_date: '2026-11-02' });
  expect(created.status).toBe(201);

  // `POST /trips` returns the trip row; the days it created come back from a read. Fetching them
  // rather than assuming the create response carries them.
  const loaded = await request(app).get(`/api/auth/trips/${created.body.trip.id}`).set(asOwner);
  expect(loaded.status).toBe(200);
  const trip = loaded.body.trip;

  const added = await request(app)
    .post(`/api/auth/trips/${trip.id}/days/${trip.days[0].id}/items`)
    .set(asOwner)
    .send({ title: 'Hampi bazaar', item_type: 'activity' });
  expect([200, 201]).toContain(added.status);

  return trip;
};

const share = (tripId, headers = asOwner, email = OTHER_EMAIL) =>
  request(app).post(`/api/auth/trips/${tripId}/collaborators`).set(headers).send({ email });

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

// ---------------------------------------------------------------------------
// Adding somebody, without sending anything
// ---------------------------------------------------------------------------
describe('the email is a lookup key, not an address', () => {
  test('an owner can add somebody who already has an account', async () => {
    const trip = await makeTrip();

    const res = await share(trip.id);

    expect(res.status).toBe(200);
    expect(res.body.collaborator).toMatchObject({ user_id: OTHER.uid, role: 'viewer' });
  });

  test('an address nobody registered with is a 422 that says exactly that', async () => {
    // This is the whole cost of having no mail provider, and it has to be visible. A silent success
    // would leave an owner believing a stranger can see the trip.
    const trip = await makeTrip();

    const res = await share(trip.id, asOwner, 'nobody@example.com');

    expect(res.status).toBe(422);
    expect(res.body.message).toMatch(/EasyTrip account/i);
  });

  test('the address matches regardless of case, because that is how people type it', async () => {
    const trip = await makeTrip();

    const res = await share(trip.id, asOwner, 'OTHER@EasyTrip.TEST');

    expect(res.status).toBe(200);
    expect(res.body.collaborator.user_id).toBe(OTHER.uid);
  });

  test('adding the same person twice is the same fact, not a conflict', async () => {
    const trip = await makeTrip();

    expect((await share(trip.id)).status).toBe(200);
    expect((await share(trip.id)).status).toBe(200);

    const listed = await request(app).get(`/api/auth/trips/${trip.id}/collaborators`).set(asOwner);
    expect(listed.body.collaborators).toHaveLength(1);
  });

  test('the owner cannot be added to their own trip', async () => {
    // Two places answering "who owns this" is how the two answers eventually differ.
    const trip = await makeTrip();

    const res = await share(trip.id, asOwner, 'traveller@easytrip.test');

    expect(res.status).toBe(422);
    expect(res.body.message).toMatch(/already your trip/i);
  });

  test('a malformed address is rejected before anything is looked up', async () => {
    const trip = await makeTrip();

    const res = await share(trip.id, asOwner, 'not-an-email');

    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// What the widened read does and does not open
// ---------------------------------------------------------------------------
describe('a collaborator can read the trip, and a stranger still cannot', () => {
  test('the collaborator gets the trip WITH its days and items', async () => {
    // The half-widened failure: `getTrip` says yes and the items query still says
    // `trips.user_id = $2`, so the trip arrives looking like an empty plan. That is worse than a
    // refusal, because it looks like data loss.
    const trip = await makeTrip();
    await share(trip.id);

    const res = await request(app).get(`/api/auth/trips/${trip.id}`).set(asOther);

    expect(res.status).toBe(200);
    expect(res.body.trip.title).toBe('Karnataka in November');
    expect(res.body.trip.days).toHaveLength(2);
    expect(res.body.trip.days[0].items.map((item) => item.title)).toEqual(['Hampi bazaar']);
  });

  test('somebody who was never added gets a 404, not a 403', async () => {
    // 403 for "exists but not yours" turns the endpoint into an oracle for which trip ids are real.
    const trip = await makeTrip();

    const res = await request(app).get(`/api/auth/trips/${trip.id}`).set(asStranger);

    expect(res.status).toBe(404);
  });

  test('removing somebody ends their access immediately', async () => {
    const trip = await makeTrip();
    await share(trip.id);

    const removed = await request(app)
      .delete(`/api/auth/trips/${trip.id}/collaborators/${OTHER.uid}`)
      .set(asOwner);
    expect(removed.status).toBe(204);

    const after = await request(app).get(`/api/auth/trips/${trip.id}`).set(asOther);
    expect(after.status).toBe(404);
  });

  test('a collaborator row for a deleted trip does not survive it', async () => {
    const trip = await makeTrip();
    await share(trip.id);

    await request(app).delete(`/api/auth/trips/${trip.id}`).set(asOwner).expect(204);

    const rows = await pool.query('SELECT 1 FROM trip_collaborators WHERE trip_id = $1', [trip.id]);
    expect(rows.rowCount).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// `viewer` means viewer
// ---------------------------------------------------------------------------
describe('a viewer cannot write, which is what makes the role name honest', () => {
  const cases = [
    ['rename the trip', (id) => request(app).put(`/api/auth/trips/${id}`).send({ title: 'Mine' })],
    ['add a day', (id) => request(app).post(`/api/auth/trips/${id}/days`).send({})],
    ['delete the trip', (id) => request(app).delete(`/api/auth/trips/${id}`)],
    ['duplicate it', (id) => request(app).post(`/api/auth/trips/${id}/duplicate`).send({})],
    ['start sharing a link', (id) => request(app).post(`/api/auth/trips/${id}/share`).send({})]
  ];

  for (const [what, call] of cases) {
    test(`a viewer cannot ${what}`, async () => {
      const trip = await makeTrip();
      await share(trip.id);

      const res = await call(trip.id).set(asOther);

      // 404 rather than 403, consistently with every other refusal on this surface.
      expect(res.status).toBe(404);
    });
  }

  test('a viewer cannot add an item to a day they can see', async () => {
    // The sharpest one: the day id is legitimately known to them, because they can read it.
    const trip = await makeTrip();
    await share(trip.id);

    const res = await request(app)
      .post(`/api/auth/trips/${trip.id}/days/${trip.days[0].id}/items`)
      .set(asOther)
      .send({ title: 'Not mine to add', item_type: 'activity' });

    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// Who may manage access
// ---------------------------------------------------------------------------
describe('managing access is the owner’s, reading it is not', () => {
  test('a viewer can see who else is on the trip', async () => {
    const trip = await makeTrip();
    await share(trip.id);

    const res = await request(app).get(`/api/auth/trips/${trip.id}/collaborators`).set(asOther);

    expect(res.status).toBe(200);
    expect(res.body.your_role).toBe('viewer');
    expect(res.body.collaborators[0]).toMatchObject({ user_id: OTHER.uid, email: OTHER_EMAIL });
  });

  test('the owner sees their own role, and is not in their own collaborator list', async () => {
    const trip = await makeTrip();
    await share(trip.id);

    const res = await request(app).get(`/api/auth/trips/${trip.id}/collaborators`).set(asOwner);

    expect(res.body.your_role).toBe('owner');
    expect(res.body.collaborators.map((c) => c.user_id)).toEqual([OTHER.uid]);
  });

  test('a viewer cannot add an accomplice', async () => {
    const trip = await makeTrip();
    await share(trip.id);

    const res = await share(trip.id, asOther, 'admin@easytrip.test');

    expect(res.status).toBe(404);
  });

  test('a viewer cannot remove anybody, including themselves', async () => {
    // Leaving a trip is a reasonable thing to want and is deliberately a different action; giving
    // DELETE two meanings depending on the caller is how one of them goes untested.
    const trip = await makeTrip();
    await share(trip.id);

    const res = await request(app)
      .delete(`/api/auth/trips/${trip.id}/collaborators/${OTHER.uid}`)
      .set(asOther);

    expect(res.status).toBe(404);
  });

  test('a stranger learns nothing about a trip they cannot see', async () => {
    const trip = await makeTrip();

    const listed = await request(app)
      .get(`/api/auth/trips/${trip.id}/collaborators`)
      .set(asStranger);
    const added = await share(trip.id, asStranger);

    expect(listed.status).toBe(404);
    expect(added.status).toBe(404);
  });

  test('removing somebody who is not on the trip is a 404, not a silent success', async () => {
    const trip = await makeTrip();

    const res = await request(app)
      .delete(`/api/auth/trips/${trip.id}/collaborators/${OTHER.uid}`)
      .set(asOwner);

    expect(res.status).toBe(404);
  });

  test('all three endpoints require a token', async () => {
    const trip = await makeTrip();

    expect((await request(app).get(`/api/auth/trips/${trip.id}/collaborators`)).status).toBe(401);
    expect(
      (
        await request(app).post(`/api/auth/trips/${trip.id}/collaborators`).send({
          email: OTHER_EMAIL
        })
      ).status
    ).toBe(401);
    expect(
      (await request(app).delete(`/api/auth/trips/${trip.id}/collaborators/${OTHER.uid}`)).status
    ).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// The trip list
// ---------------------------------------------------------------------------
describe('a shared trip does not become one of your own', () => {
  test('"My Trips" still lists only what you own', async () => {
    // Deliberate for stage (a): `listTrips` is unchanged. A shared trip appearing in "My Trips"
    // without a marker saying whose it is would be worse than not appearing at all, and the marker
    // is UI work that belongs with the panel, not with the authorization change.
    const trip = await makeTrip();
    await share(trip.id);

    const mine = await request(app).get('/api/auth/trips').set(asOther);

    expect(mine.status).toBe(200);
    expect(mine.body.trips.map((t) => t.id)).not.toContain(trip.id);
  });
});
