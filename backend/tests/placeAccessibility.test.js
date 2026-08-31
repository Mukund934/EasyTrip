const request = require('supertest');

const app = require('../app');
const { createSchema, resetData, closeDb, resetRateLimits, pool } = require('./helpers/testDb');
const { authHeader } = require('./helpers/firebaseMock');
const {
  accessibilityForCreate,
  accessibilityPatch
} = require('../src/controllers/helpers/placeAccessibility');

/**
 * Accessibility on a place (`FV-029` stage a).
 *
 * **This item is the one place in `FUTURE_VISION.md` where being wrong hurts somebody**, and its
 * kill criterion says so:
 *
 * > *"A wrong step-free claim strands somebody at the bottom of a staircase … unverified data must
 * > be labelled unverified or omitted."*
 *
 * So the assertions here are weighted accordingly. The happy path — an admin records a survey and it
 * comes back — gets four; the ways a claim can end up **unattributed, stale, or invented** get most
 * of the rest, and they are asserted against the database's own constraints rather than only against
 * the route, because the route is not the only possible writer.
 *
 * `unknown` is the default for the entire catalogue and it means *do not assert anything*. Several
 * tests exist purely to hold that apart from `'no'`, because collapsing the two is the single change
 * that would turn this feature into the harm it is designed to avoid.
 */

const asAdmin = { Authorization: authHeader({ uid: 'seed-admin-uid' }) };
const asUser = { Authorization: authHeader({ uid: 'seed-user-uid' }) };
const PLACE = 2;

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

const row = async (id = PLACE) =>
  (
    await pool.query(
      // `to_char`, matching what the API returns and for the same reason: node-pg turns a DATE
      // into a JS Date at local midnight, so a naive `.toISOString()` reads the previous day
      // anywhere east of UTC — which is how the payload bug this column has was found.
      `SELECT step_free_access, accessible_restroom, accessibility_notes, accessibility_source,
              to_char(accessibility_checked_on, 'YYYY-MM-DD') AS accessibility_checked_on,
              description
       FROM places WHERE id = $1`,
      [id]
    )
  ).rows[0];

/** A multipart edit, because the route runs through multer whether or not a file is attached. */
const edit = (fields, { headers = asAdmin, id = PLACE } = {}) => {
  const req = request(app).put(`/api/admin/places/${id}`).set(headers);
  Object.entries(fields).forEach(([key, value]) => req.field(key, String(value)));
  return req;
};

const A_SURVEY = {
  step_free_access: 'yes',
  accessible_restroom: 'partial',
  accessibility_source: 'site_visit',
  accessibility_checked_on: '2026-08-01'
};

// ---------------------------------------------------------------------------
// The default, which is most of the catalogue and has to stay meaningless
// ---------------------------------------------------------------------------
describe('an unsurveyed place asserts nothing', () => {
  test('every seeded place starts unknown, with no source and no date', async () => {
    const place = await row();
    expect(place.step_free_access).toBe('unknown');
    expect(place.accessible_restroom).toBe('unknown');
    expect(place.accessibility_source).toBeNull();
    expect(place.accessibility_checked_on).toBeNull();
  });

  test('the API reports it as unknown rather than omitting the field', async () => {
    // Omission would leave a client free to render "no step-free access" from an absent key, which
    // is the same harm by a different route. The field is always present and always says `unknown`.
    const response = await request(app).get(`/api/places/${PLACE}`);
    expect(response.status).toBe(200);
    expect(response.body.step_free_access).toBe('unknown');
    expect(response.body.accessible_restroom).toBe('unknown');
  });

  test('"unknown" is not "no", and the two are distinguishable in the payload', async () => {
    await edit({ ...A_SURVEY, step_free_access: 'no' }).expect(200);
    const response = await request(app).get(`/api/places/${PLACE}`);

    expect(response.body.step_free_access).toBe('no');
    expect(response.body.accessible_restroom).toBe('partial');
    // The point of the assertion: a consumer can tell a surveyed "no" from an unsurveyed row.
    expect(response.body.step_free_access).not.toBe('unknown');
  });
});

// ---------------------------------------------------------------------------
// A claim needs a source and a date — the kill criterion, made structural
// ---------------------------------------------------------------------------
describe('an accessibility claim must say who says so, and when', () => {
  test('a claim with no source or date is rejected with a readable message', async () => {
    const response = await edit({ step_free_access: 'yes' });

    expect(response.status).toBe(400);
    expect(JSON.stringify(response.body)).toMatch(/accessibility_source/);
    expect(await row()).toMatchObject({ step_free_access: 'unknown' });
  });

  test('a claim with a source but no date is rejected too', async () => {
    const response = await edit({ step_free_access: 'yes', accessibility_source: 'operator' });
    expect(response.status).toBe(400);
    expect(await row()).toMatchObject({ step_free_access: 'unknown' });
  });

  test('a claim with a date but no source is rejected too', async () => {
    const response = await edit({
      step_free_access: 'yes',
      accessibility_checked_on: '2026-08-01'
    });
    expect(response.status).toBe(400);
    expect(await row()).toMatchObject({ step_free_access: 'unknown' });
  });

  test('a complete survey is accepted and stored', async () => {
    await edit(A_SURVEY).expect(200);

    const place = await row();
    expect(place.step_free_access).toBe('yes');
    expect(place.accessible_restroom).toBe('partial');
    expect(place.accessibility_source).toBe('site_visit');
    expect(place.accessibility_checked_on).toBe('2026-08-01');
  });

  test('the API returns the check date as the day it was, in every time zone', async () => {
    // **The assertion `to_char` exists for**, and the one a direct SQL read cannot make: node-pg
    // turns a DATE into a JS Date at LOCAL midnight, so `JSON.stringify` serialises the previous day
    // anywhere east of UTC. This suite runs in the machine's zone, so on a UTC+5:30 laptop an
    // unguarded column comes back as 2026-07-31 and CI would never see it.
    //
    // It is the BUG-046 class one tier lower, and it matters more here: the date's entire job is to
    // say how recently somebody checked a ramp.
    await edit(A_SURVEY).expect(200);

    const response = await request(app).get(`/api/places/${PLACE}`);
    expect(response.status).toBe(200);
    expect(response.body.accessibility_checked_on).toBe('2026-08-01');
    // A string, not a serialised Date — the shape a client can compare and render without parsing.
    expect(typeof response.body.accessibility_checked_on).toBe('string');
  });

  test('the database refuses an unattributed claim even when the route is bypassed', async () => {
    // The rule lives in `places_accessibility_is_attributed` and not only in the validator, because
    // a CSV import, a backfill script or a psql session is as capable of stranding somebody as a
    // request is. This is the assertion that the guarantee is a guarantee.
    await expect(
      pool.query('UPDATE places SET step_free_access = $1 WHERE id = $2', ['yes', PLACE])
    ).rejects.toThrow(/places_accessibility_is_attributed/);
  });

  test('notes alone are not a claim, and need no attribution', async () => {
    // "The lift was out of order when we visited" asserts nothing about either axis, so requiring a
    // source for it would push a useful sentence out of the catalogue for no safety gain.
    await edit({ accessibility_notes: 'Lift was out of order in August.' }).expect(200);

    const place = await row();
    expect(place.accessibility_notes).toBe('Lift was out of order in August.');
    expect(place.step_free_access).toBe('unknown');
    expect(place.accessibility_source).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Staleness, which is how a correct claim becomes a wrong one
// ---------------------------------------------------------------------------
describe('the date is a fact about the check, not about the row', () => {
  test('a future check date is refused', async () => {
    const response = await edit({ ...A_SURVEY, accessibility_checked_on: '2099-01-01' });
    expect(response.status).toBe(400);
    expect(JSON.stringify(response.body)).toMatch(/future/i);
  });

  test('an unrelated edit does not refresh the date', async () => {
    // The failure this prevents: a place edited last week looking freshly surveyed because the row
    // was written, when nobody has been near the ramp since 2026-08-01.
    await edit(A_SURVEY).expect(200);
    await edit({ description: 'A new description, nothing to do with access.' }).expect(200);

    const place = await row();
    expect(place.description).toContain('nothing to do with access');
    expect(place.accessibility_checked_on).toBe('2026-08-01');
    expect(place.step_free_access).toBe('yes');
  });

  test('an unrelated edit does not strip the provenance either', async () => {
    // The `BUG-048` shape, one column set over: writing all five unconditionally would send NULL for
    // the keys this request never mentioned, and the constraint would reject an edit to a
    // description with a message about accessibility.
    await edit(A_SURVEY).expect(200);
    const response = await edit({ name: 'Renamed' });

    expect(response.status).toBe(200);
    expect(await row()).toMatchObject({
      accessibility_source: 'site_visit',
      step_free_access: 'yes'
    });
  });
});

// ---------------------------------------------------------------------------
// The vocabularies, which are allowlists in both tiers for a reason
// ---------------------------------------------------------------------------
describe('the vocabularies are closed', () => {
  test.each(['maybe', 'true', 'YES', 'partially', ''])(
    'step_free_access rejects %p',
    async (value) => {
      const response = await edit({ ...A_SURVEY, step_free_access: value });
      // The empty string is `optional({ values: 'falsy' })`, so it means "leave alone" rather than
      // being rejected — and leaving it alone with a source present is a valid no-op edit.
      if (value === '') expect(response.status).toBe(200);
      else expect(response.status).toBe(400);
    }
  );

  test('an unrecognised source is refused', async () => {
    const response = await edit({ ...A_SURVEY, accessibility_source: 'a friend told me' });
    expect(response.status).toBe(400);
    expect(JSON.stringify(response.body)).toMatch(/accessibility_source/);
  });

  test('the database mirrors the source allowlist', async () => {
    await expect(
      pool.query(
        `UPDATE places SET step_free_access = 'yes', accessibility_source = 'hearsay',
         accessibility_checked_on = '2026-08-01' WHERE id = $1`,
        [PLACE]
      )
    ).rejects.toThrow(/places_accessibility_source_known/);
  });
});

// ---------------------------------------------------------------------------
// Who may write it
// ---------------------------------------------------------------------------
describe('only an admin may record a survey', () => {
  test('a signed-in non-admin is refused', async () => {
    const response = await edit(A_SURVEY, { headers: asUser });
    expect(response.status).toBe(403);
    expect(await row()).toMatchObject({ step_free_access: 'unknown' });
  });

  test('an anonymous request is refused', async () => {
    const response = await request(app)
      .put(`/api/admin/places/${PLACE}`)
      .field('step_free_access', 'yes');
    expect(response.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// The helper, which is where "leave the survey alone" is actually expressed
// ---------------------------------------------------------------------------
describe('the write helper', () => {
  test('a create with no accessibility produces an unsurveyed row, not an unattributed one', () => {
    expect(accessibilityForCreate({})).toEqual({
      step_free_access: 'unknown',
      accessible_restroom: 'unknown',
      accessibility_notes: null,
      accessibility_source: null,
      accessibility_checked_on: null
    });
  });

  test('a patch carries only the keys the caller sent', () => {
    // `updatePlace` keys on `column in placeData`, so a key present with `undefined` sends NULL.
    // Absence has to be expressed by the key not being there at all.
    expect(accessibilityPatch({ step_free_access: 'yes', name: 'ignored' })).toEqual({
      step_free_access: 'yes'
    });
    expect(accessibilityPatch({})).toEqual({});
    expect('accessibility_source' in accessibilityPatch({ step_free_access: 'yes' })).toBe(false);
  });

  test('an explicit null is kept, because clearing a survey is a real edit', () => {
    expect(accessibilityPatch({ accessibility_notes: null })).toEqual({
      accessibility_notes: null
    });
  });
});
