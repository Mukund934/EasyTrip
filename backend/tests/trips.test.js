const request = require('supertest');
const app = require('../app');
const { createSchema, resetData, closeDb, resetRateLimits, pool } = require('./helpers/testDb');
const { authHeader } = require('./helpers/firebaseMock');

/**
 * The trip workspace — `/api/auth/trips/*` (`IMP-109` / `FV-006`, `ADR-031`).
 *
 * This is the keystone the roadmap's whole forward half rests on, and it is the first entity in
 * EasyTrip with **two levels of children**. That changes what is worth testing: the wishlist's
 * privacy is one `WHERE user_id = $1`, but a trip day and a trip item carry no uid at all — they
 * are owned *transitively*, through a join up to `trips`. Every one of the eleven endpoints has to
 * make that join, and forgetting it in exactly one of them is the realistic failure.
 *
 * So the suite is organised around the boundary rather than around the CRUD: for every operation
 * that touches a day or an item, there is an assertion that a second user cannot perform it.
 *
 * The other theme is `ADR-031`'s deliberate asymmetry: `trip_items.place_id` is `ON DELETE SET
 * NULL`, the opposite of `user_saved_places.place_id`. Deleting a place must **not** delete the
 * line a user wrote in their own itinerary.
 */

const USER = { uid: 'seed-user-uid' };
const OTHER = { uid: 'seed-other-uid' };
const ADMIN = { uid: 'seed-admin-uid' };

const asUser = { Authorization: authHeader(USER) };
const asOther = { Authorization: authHeader(OTHER) };
const asAdmin = { Authorization: authHeader(ADMIN) };

const PLACE = 1;
const OTHER_PLACE = 2;

/** Create a trip for a caller and return its body. */
const makeTrip = async (headers, body = {}) => {
  const res = await request(app)
    .post('/api/auth/trips')
    .set(headers)
    .send({ title: 'Karnataka in March', ...body });
  expect(res.status).toBe(201);
  return res.body.trip;
};

const workspace = async (headers, tripId) => {
  const res = await request(app).get(`/api/auth/trips/${tripId}`).set(headers);
  return res;
};

/** Add an item to the first day of a trip. */
const addItem = async (headers, trip, item = {}) => {
  const ws = await workspace(headers, trip.id);
  const dayId = ws.body.trip.days[0].id;
  const res = await request(app)
    .post(`/api/auth/trips/${trip.id}/days/${dayId}/items`)
    .set(headers)
    .send({ place_id: PLACE, ...item });
  return { res, dayId };
};

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

describe('a trip requires an identity', () => {
  test.each([
    ['get', '/api/auth/trips'],
    ['post', '/api/auth/trips'],
    ['get', '/api/auth/trips/1'],
    ['put', '/api/auth/trips/1'],
    ['delete', '/api/auth/trips/1'],
    ['post', '/api/auth/trips/1/days'],
    ['delete', '/api/auth/trips/1/days/1'],
    ['post', '/api/auth/trips/1/days/1/items'],
    ['put', '/api/auth/trips/1/items/1'],
    ['delete', '/api/auth/trips/1/items/1'],
    ['put', '/api/auth/trips/1/days/1/items/order']
  ])('%s %s is 401 without a token', async (method, path) => {
    // Every endpoint, enumerated. A new route added without `isAuthenticated` is the single
    // cheapest way to expose this data, and it would pass every other test in this file.
    const res = await request(app)[method](path).send({});
    expect(res.status).toBe(401);
  });
});

describe('one user cannot reach another user’s trip', () => {
  test('it is not in their list', async () => {
    await makeTrip(asUser);

    const theirs = await request(app).get('/api/auth/trips').set(asOther);
    expect(theirs.body.trips).toEqual([]);
  });

  test('reading it is a 404, not a 403 — the id must not be confirmed', async () => {
    const trip = await makeTrip(asUser);

    const res = await workspace(asOther, trip.id);

    // 403 would confirm the id exists, turning sequential ids into an enumeration oracle for how
    // many trips the site holds. A trip is private, so "not yours" and "not there" answer alike.
    expect(res.status).toBe(404);
    expect(JSON.stringify(res.body)).not.toContain('Karnataka');
  });

  test('updating it does not change it', async () => {
    const trip = await makeTrip(asUser);

    const res = await request(app)
      .put(`/api/auth/trips/${trip.id}`)
      .set(asOther)
      .send({ title: 'Stolen' });

    expect(res.status).toBe(404);
    const mine = await workspace(asUser, trip.id);
    expect(mine.body.trip.title).toBe('Karnataka in March');
  });

  test('deleting it does not delete it', async () => {
    const trip = await makeTrip(asUser);

    const res = await request(app).delete(`/api/auth/trips/${trip.id}`).set(asOther);

    expect(res.status).toBe(404);
    expect((await workspace(asUser, trip.id)).status).toBe(200);
  });

  test('an admin token is no more entitled than any other stranger', async () => {
    // Elevated privilege elsewhere in the app must not imply access to somebody's personal plan.
    const trip = await makeTrip(asUser);

    expect((await workspace(asAdmin, trip.id)).status).toBe(404);
    expect((await request(app).delete(`/api/auth/trips/${trip.id}`).set(asAdmin)).status).toBe(404);
  });

  test('they cannot add a day to it', async () => {
    const trip = await makeTrip(asUser);

    const res = await request(app).post(`/api/auth/trips/${trip.id}/days`).set(asOther);

    expect(res.status).toBe(404);
    const mine = await workspace(asUser, trip.id);
    expect(mine.body.trip.days).toHaveLength(1);
  });

  test('they cannot delete its day', async () => {
    const trip = await makeTrip(asUser);
    const ws = await workspace(asUser, trip.id);
    const dayId = ws.body.trip.days[0].id;

    const res = await request(app).delete(`/api/auth/trips/${trip.id}/days/${dayId}`).set(asOther);

    expect(res.status).toBe(404);
    expect((await workspace(asUser, trip.id)).body.trip.days).toHaveLength(1);
  });

  test('they cannot add an item to its day', async () => {
    const trip = await makeTrip(asUser);
    const ws = await workspace(asUser, trip.id);
    const dayId = ws.body.trip.days[0].id;

    const res = await request(app)
      .post(`/api/auth/trips/${trip.id}/days/${dayId}/items`)
      .set(asOther)
      .send({ place_id: PLACE });

    expect(res.status).toBe(404);
    expect((await workspace(asUser, trip.id)).body.trip.days[0].items).toHaveLength(0);
  });

  test('they cannot edit or delete its items', async () => {
    const trip = await makeTrip(asUser);
    const { res: created } = await addItem(asUser, trip);
    const itemId = created.body.item.id;

    const edited = await request(app)
      .put(`/api/auth/trips/${trip.id}/items/${itemId}`)
      .set(asOther)
      .send({ title: 'Stolen' });
    const deleted = await request(app)
      .delete(`/api/auth/trips/${trip.id}/items/${itemId}`)
      .set(asOther);

    expect(edited.status).toBe(404);
    expect(deleted.status).toBe(404);

    const mine = await workspace(asUser, trip.id);
    expect(mine.body.trip.days[0].items).toHaveLength(1);
    expect(mine.body.trip.days[0].items[0].title).not.toBe('Stolen');
  });

  test('naming somebody else’s trip id in the path does not reach their item', async () => {
    // The subtle one: the attacker owns a trip, and tries to address the victim's item through
    // *their own* trip id. Every write joins item -> day -> trip and filters on both, so the row
    // does not match — but a handler that trusted the item id alone would delete it.
    const victimTrip = await makeTrip(asUser);
    const { res: victimItem } = await addItem(asUser, victimTrip);
    const attackerTrip = await makeTrip(asOther, { title: 'Mine' });

    const res = await request(app)
      .delete(`/api/auth/trips/${attackerTrip.id}/items/${victimItem.body.item.id}`)
      .set(asOther);

    expect(res.status).toBe(404);
    expect((await workspace(asUser, victimTrip.id)).body.trip.days[0].items).toHaveLength(1);
  });
});

describe('creating a trip', () => {
  test('a dateless trip still gets one day, so there is somewhere to put the first item', async () => {
    const trip = await makeTrip(asUser);

    const ws = await workspace(asUser, trip.id);
    expect(ws.body.trip.days).toHaveLength(1);
    expect(ws.body.trip.days[0].day_number).toBe(1);
    expect(ws.body.trip.status).toBe('draft');
  });

  test('a dated trip gets one day per calendar day, inclusive of both ends', async () => {
    const trip = await makeTrip(asUser, { start_date: '2026-03-01', end_date: '2026-03-05' });

    const ws = await workspace(asUser, trip.id);
    // 1st to 5th is five days, not four. The off-by-one here would silently lose the last day of
    // every trip anybody plans.
    expect(ws.body.trip.days.map((d) => d.day_number)).toEqual([1, 2, 3, 4, 5]);
  });

  test('a trip that ends before it starts is refused', async () => {
    const res = await request(app)
      .post('/api/auth/trips')
      .set(asUser)
      .send({ title: 'Backwards', start_date: '2026-03-10', end_date: '2026-03-01' });

    expect(res.status).toBe(400);
  });

  test('a trip with no title is refused', async () => {
    const res = await request(app).post('/api/auth/trips').set(asUser).send({ description: 'x' });
    expect(res.status).toBe(400);
  });
});

describe('the trip list', () => {
  test('an empty list is an empty list, not an error', async () => {
    const res = await request(app).get('/api/auth/trips').set(asUser);
    expect(res.status).toBe(200);
    expect(res.body.trips).toEqual([]);
  });

  test('a trip with days but no items still appears, and reports zero', async () => {
    // The regression an inner join would cause: a brand-new empty trip vanishing from "My Trips",
    // which is exactly the trip a first-time user has.
    const trip = await makeTrip(asUser);

    const res = await request(app).get('/api/auth/trips').set(asUser);

    expect(res.body.trips).toHaveLength(1);
    expect(res.body.trips[0]).toMatchObject({ id: trip.id, day_count: 1, item_count: 0 });
  });

  test('counts reflect the days and items actually there', async () => {
    const trip = await makeTrip(asUser);
    await request(app).post(`/api/auth/trips/${trip.id}/days`).set(asUser);
    await addItem(asUser, trip);
    await addItem(asUser, trip, { place_id: OTHER_PLACE });

    const res = await request(app).get('/api/auth/trips').set(asUser);
    expect(res.body.trips[0]).toMatchObject({ day_count: 2, item_count: 2 });
  });

  test('most recently updated first, and the order is total', async () => {
    const first = await makeTrip(asUser, { title: 'First' });
    const second = await makeTrip(asUser, { title: 'Second' });

    const before = await request(app).get('/api/auth/trips').set(asUser);
    expect(before.body.trips.map((t) => t.id)).toEqual([second.id, first.id]);

    // Touching the older one moves it up — the `updated_at` trigger does this, not the API.
    await request(app)
      .put(`/api/auth/trips/${first.id}`)
      .set(asUser)
      .send({ title: 'First again' });

    const after = await request(app).get('/api/auth/trips').set(asUser);
    expect(after.body.trips.map((t) => t.id)).toEqual([first.id, second.id]);
  });
});

describe('days', () => {
  test('adding a day appends the next number', async () => {
    const trip = await makeTrip(asUser);

    const res = await request(app).post(`/api/auth/trips/${trip.id}/days`).set(asUser);

    expect(res.status).toBe(201);
    expect(res.body.day.day_number).toBe(2);
  });

  test('deleting a middle day closes the gap it left', async () => {
    // `day_number` is the label the UI shows *and* what the calendar date is computed from, so a
    // hole would render "Day 1, Day 2, Day 4" and put every later day on the wrong date.
    const trip = await makeTrip(asUser, { start_date: '2026-03-01', end_date: '2026-03-03' });
    const ws = await workspace(asUser, trip.id);
    const middle = ws.body.trip.days[1];

    await request(app).delete(`/api/auth/trips/${trip.id}/days/${middle.id}`).set(asUser);

    const after = await workspace(asUser, trip.id);
    expect(after.body.trip.days.map((d) => d.day_number)).toEqual([1, 2]);
  });

  test('deleting a day takes its items with it', async () => {
    const trip = await makeTrip(asUser);
    const { dayId } = await addItem(asUser, trip);

    await request(app).delete(`/api/auth/trips/${trip.id}/days/${dayId}`).set(asUser);

    const orphans = await pool.query(
      'SELECT 1 FROM trip_items LEFT JOIN trip_days ON trip_days.id = trip_items.trip_day_id WHERE trip_days.id IS NULL'
    );
    expect(orphans.rowCount).toBe(0);
  });
});

describe('items', () => {
  test('an item created from a place takes the place’s name as its title', async () => {
    const trip = await makeTrip(asUser);

    const { res } = await addItem(asUser, trip);

    expect(res.status).toBe(201);
    expect(res.body.item.place_id).toBe(PLACE);
    expect(res.body.item.title).toEqual(expect.any(String));
    expect(res.body.item.title.length).toBeGreaterThan(0);
  });

  test('an item with no place is allowed, if it has a title', async () => {
    const trip = await makeTrip(asUser);

    const { res } = await addItem(asUser, trip, {
      place_id: null,
      item_type: 'meal',
      title: 'Lunch at the dhaba'
    });

    expect(res.status).toBe(201);
    expect(res.body.item.place_id).toBeNull();
    expect(res.body.item.item_type).toBe('meal');
  });

  test('an item with neither a place nor a title is refused', async () => {
    const trip = await makeTrip(asUser);
    const ws = await workspace(asUser, trip.id);

    const res = await request(app)
      .post(`/api/auth/trips/${trip.id}/days/${ws.body.trip.days[0].id}/items`)
      .set(asUser)
      .send({ item_type: 'note' });

    expect(res.status).toBe(400);
  });

  test('a nonexistent place is a 404 and creates nothing', async () => {
    const trip = await makeTrip(asUser);
    const ws = await workspace(asUser, trip.id);

    const res = await request(app)
      .post(`/api/auth/trips/${trip.id}/days/${ws.body.trip.days[0].id}/items`)
      .set(asUser)
      .send({ place_id: 999999, title: 'Nowhere' });

    expect(res.status).toBe(404);
    expect((await workspace(asUser, trip.id)).body.trip.days[0].items).toHaveLength(0);
  });

  test('an unknown item_type is refused rather than stored', async () => {
    const trip = await makeTrip(asUser);
    const ws = await workspace(asUser, trip.id);

    const res = await request(app)
      .post(`/api/auth/trips/${trip.id}/days/${ws.body.trip.days[0].id}/items`)
      .set(asUser)
      .send({ title: 'Something', item_type: 'seance' });

    expect(res.status).toBe(400);
  });

  test('an item that ends before it starts is refused', async () => {
    const trip = await makeTrip(asUser);
    const ws = await workspace(asUser, trip.id);

    const res = await request(app)
      .post(`/api/auth/trips/${trip.id}/days/${ws.body.trip.days[0].id}/items`)
      .set(asUser)
      .send({ title: 'Backwards', start_time: '14:00', end_time: '09:00' });

    expect([400, 500]).toContain(res.status);
    expect((await workspace(asUser, trip.id)).body.trip.days[0].items).toHaveLength(0);
  });

  test('editing an item persists what it was sent', async () => {
    const trip = await makeTrip(asUser);
    const { res: created } = await addItem(asUser, trip);

    const res = await request(app)
      .put(`/api/auth/trips/${trip.id}/items/${created.body.item.id}`)
      .set(asUser)
      .send({ title: 'Sunrise at Matanga Hill', notes: 'Leave by 05:30', start_time: '05:30' });

    expect(res.status).toBe(200);
    const ws = await workspace(asUser, trip.id);
    expect(ws.body.trip.days[0].items[0]).toMatchObject({
      title: 'Sunrise at Matanga Hill',
      notes: 'Leave by 05:30'
    });
  });

  test('the workspace carries the place context an item needs to render', async () => {
    const trip = await makeTrip(asUser);
    await addItem(asUser, trip);

    const ws = await workspace(asUser, trip.id);
    const [item] = ws.body.trip.days[0].items;

    expect(item.place_name).toEqual(expect.any(String));
    expect(item).toHaveProperty('place_location');
    expect(item).toHaveProperty('place_image_url');
    // `FV-026` will need coordinates to order a day geographically; shipping them now costs one
    // column each and saves a payload change later.
    expect(item).toHaveProperty('place_latitude');
    expect(item).toHaveProperty('place_longitude');
  });

  test('no Firebase uid appears in a workspace payload', async () => {
    const trip = await makeTrip(asUser);
    await addItem(asUser, trip);

    const ws = await workspace(asUser, trip.id);
    expect(JSON.stringify(ws.body)).not.toContain(USER.uid);
  });
});

describe('ADR-031’s deliberate asymmetry: deleting a place must not delete the plan', () => {
  test('the item survives, keeps its title, and loses only its link', async () => {
    // `user_saved_places.place_id` is ON DELETE CASCADE — a saved place pointing at nothing is a
    // broken card. `trip_items.place_id` is ON DELETE SET NULL, because the item is the user's own
    // plan. Deleting their line because an admin removed a place would destroy their writing.
    const trip = await makeTrip(asUser);
    const { res: created } = await addItem(asUser, trip);
    const title = created.body.item.title;

    const removed = await request(app).delete(`/api/admin/places/${PLACE}`).set(asAdmin);
    expect(removed.status).toBe(200);

    const ws = await workspace(asUser, trip.id);
    const [item] = ws.body.trip.days[0].items;

    expect(item).toBeDefined();
    expect(item.place_id).toBeNull();
    expect(item.title).toBe(title);
    expect(item.place_name).toBeNull();
  });

  test('and the same place vanishes from the wishlist, which is the contrast', async () => {
    // Both behaviours in one test, because the asymmetry is the design and a future refactor that
    // "unified" the two cascades would pass either assertion alone.
    await request(app).post('/api/auth/favorites').set(asUser).send({ place_id: PLACE });
    const trip = await makeTrip(asUser);
    await addItem(asUser, trip);

    await request(app).delete(`/api/admin/places/${PLACE}`).set(asAdmin);

    const saved = await request(app).get('/api/auth/favorites').set(asUser);
    const ws = await workspace(asUser, trip.id);

    expect(saved.body.placeIds).toEqual([]); // cascaded away
    expect(ws.body.trip.days[0].items).toHaveLength(1); // survived
  });
});

describe('reordering — the drag-and-drop write', () => {
  const threeItems = async (trip) => {
    const ws = await workspace(asUser, trip.id);
    const dayId = ws.body.trip.days[0].id;
    for (const title of ['A', 'B', 'C']) {
      await request(app)
        .post(`/api/auth/trips/${trip.id}/days/${dayId}/items`)
        .set(asUser)
        .send({ title, item_type: 'activity' });
    }
    const after = await workspace(asUser, trip.id);
    return { dayId, items: after.body.trip.days[0].items };
  };

  test('items come back in insertion order until they are moved', async () => {
    const trip = await makeTrip(asUser);
    const { items } = await threeItems(trip);
    expect(items.map((i) => i.title)).toEqual(['A', 'B', 'C']);
  });

  test('a full reorder rewrites every position', async () => {
    const trip = await makeTrip(asUser);
    const { dayId, items } = await threeItems(trip);
    const reversed = [items[2].id, items[1].id, items[0].id];

    const res = await request(app)
      .put(`/api/auth/trips/${trip.id}/days/${dayId}/items/order`)
      .set(asUser)
      .send({ item_ids: reversed });

    expect(res.status).toBe(200);
    const ws = await workspace(asUser, trip.id);
    expect(ws.body.trip.days[0].items.map((i) => i.title)).toEqual(['C', 'B', 'A']);
  });

  test('a partial list is refused, not partially applied', async () => {
    // The dangerous shape: omitting an item leaves it at a stale position, silently interleaved
    // with the new order. That looks like it worked, which is worse than an error.
    const trip = await makeTrip(asUser);
    const { dayId, items } = await threeItems(trip);

    const res = await request(app)
      .put(`/api/auth/trips/${trip.id}/days/${dayId}/items/order`)
      .set(asUser)
      .send({ item_ids: [items[1].id, items[0].id] });

    expect(res.status).toBe(400);
    const ws = await workspace(asUser, trip.id);
    expect(ws.body.trip.days[0].items.map((i) => i.title)).toEqual(['A', 'B', 'C']);
  });

  test('a duplicated id is refused', async () => {
    const trip = await makeTrip(asUser);
    const { dayId, items } = await threeItems(trip);

    const res = await request(app)
      .put(`/api/auth/trips/${trip.id}/days/${dayId}/items/order`)
      .set(asUser)
      .send({ item_ids: [items[0].id, items[0].id, items[1].id] });

    expect(res.status).toBe(400);
  });

  test('an id from another user’s day cannot be dragged into this ordering', async () => {
    const trip = await makeTrip(asUser);
    const { dayId, items } = await threeItems(trip);

    const foreignTrip = await makeTrip(asOther, { title: 'Theirs' });
    const { res: foreignItem } = await addItem(asOther, foreignTrip, { title: 'Foreign' });

    const res = await request(app)
      .put(`/api/auth/trips/${trip.id}/days/${dayId}/items/order`)
      .set(asUser)
      .send({ item_ids: [items[0].id, items[1].id, foreignItem.body.item.id] });

    expect(res.status).toBe(400);
    // And theirs is untouched.
    const theirs = await workspace(asOther, foreignTrip.id);
    expect(theirs.body.trip.days[0].items[0].title).toBe('Foreign');
  });
});
