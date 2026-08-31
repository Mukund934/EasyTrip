const { test, expect } = require('@playwright/test');
const authEmulator = require('../auth-emulator');
const { PORTS } = require('../../playwright.config');

/**
 * Recording accessibility and then browsing by it (`FV-029` stage a, `BL-137`).
 *
 * **Its own file rather than an addition to `browse.spec.js`.** That file has no emulator
 * dependency, and surveying a place needs an admin token — folding this in would make thirteen
 * existing browse journeys skip on a machine without `firebase-tools`, which is a coverage
 * regression paid for a convenience.
 *
 * What only this layer can prove: `/browse` reads `?access=` in **`getServerSideProps`**, and the
 * client reads it from the same `filtersFromInitial`. Those are two halves of one contract that each
 * pass their own tests while disagreeing — the exact failure `browse.spec.js`'s header names, and
 * the reason `getServerSideProps` was changed in this sprint to call `buildCriteria` instead of
 * spelling the conversions out a second time.
 *
 * The seeded catalogue is entirely unsurveyed, which is also the state the real catalogue is in. So
 * the fixture surveys through the **real admin endpoint** rather than writing SQL: the point is that
 * a value an admin recorded is the value a traveller filters on.
 */

const state = authEmulator.readState();

test.skip(
  !state.enabled,
  `Firebase Auth Emulator unavailable — ${state.reason || 'reason not recorded'}`
);

const asAdmin = { Authorization: `Bearer ${state.tokens?.admin?.idToken}` };
const HAMPI = 1;

/** Record a survey the way the admin form does — multipart, through the real route. */
const survey = async (request, id, fields) => {
  const response = await request.put(`${PORTS.API_URL}/admin/places/${id}`, {
    headers: asAdmin,
    multipart: fields
  });
  expect(response.status(), await response.text()).toBe(200);
};

/**
 * Put Hampi back the way the seed left it.
 *
 * The two enumerated axes go back to `unknown`, which is a real value and therefore settable. **The
 * notes cannot be cleared this way and are deliberately not attempted**: every optional rule is
 * `optional({ values: 'falsy' })`, so an empty string means "the caller said nothing" — which is what
 * lets an ordinary edit leave a survey alone, and also means a multipart form has no way to erase a
 * note it once saved. Recorded as `BL-140`; the assertions below are written not to need it.
 */
const resetSurvey = async (request, id) => {
  await request.put(`${PORTS.API_URL}/admin/places/${id}`, {
    headers: asAdmin,
    multipart: { step_free_access: 'unknown', accessible_restroom: 'unknown' }
  });
};

test.afterAll(async ({ request }) => resetSurvey(request, HAMPI));

const cards = (page) => page.locator('a[href^="/places/"]');

test.describe('a survey an admin records is what a traveller filters on', () => {
  test.beforeEach(async ({ request }) => {
    await survey(request, HAMPI, {
      step_free_access: 'yes',
      accessible_restroom: 'partial',
      accessibility_notes: 'Step-free to the courtyard; the sanctum is up eleven steps.',
      accessibility_source: 'site_visit',
      accessibility_checked_on: '2026-08-01'
    });
  });

  test('a pasted ?access= link server-renders the filtered view', async ({ page }) => {
    // Server-rendered, before any JavaScript: this is what a shared link does, and it is the half
    // that used to be spelled out separately from `buildCriteria`.
    await page.goto('/browse?access=verified');

    await expect(cards(page)).toHaveCount(1);
    await expect(cards(page).first()).toContainText('Hampi');
  });

  test('the card carries the answer and the date it was checked', async ({ page }) => {
    await page.goto('/browse?access=verified');

    const card = cards(page).first();
    await expect(card.getByText('Step-free')).toBeVisible();
    // The date is the whole reason the badge is trustworthy, and it must be visible rather than
    // hidden in a title attribute.
    await expect(card.getByText(/Aug 1, 2026/)).toBeVisible();
  });

  test('an unsurveyed place is excluded, which is the point of the filter', async ({ page }) => {
    // Three of the four seeded places are untouched. A filter that returned them would look
    // filtered while answering a different question.
    await page.goto('/browse?access=verified');
    await expect(cards(page)).toHaveCount(1);

    await page.goto('/browse');
    await expect(cards(page)).toHaveCount(4);
  });

  test('the detail page spells the claim out, with who said so', async ({ page }) => {
    await page.goto(`/places/${HAMPI}`);

    await expect(page.getByRole('heading', { name: 'Getting in' })).toBeVisible();
    await expect(page.getByText(/the sanctum is up eleven steps/)).toBeVisible();
    await expect(page.getByText(/checked in person/)).toBeVisible();
    await expect(page.getByText(/last checked Aug 1, 2026/)).toBeVisible();
  });

  test('choosing the filter in the browser reaches the same result set', async ({ page }) => {
    // The client half. It writes `?access=` into the address bar, and that URL is the one the test
    // above pastes — so the two halves are proven against the same string.
    await page.goto('/browse');
    await expect(cards(page)).toHaveCount(4);

    await page.getByRole('button', { name: 'Step-free access', exact: true }).click();

    await expect(cards(page)).toHaveCount(1);
    await expect(page).toHaveURL(/access=verified/);
  });
});

test.describe('a place nobody has surveyed', () => {
  // Badami is seeded and left untouched by every test in this file, so these need no cleanup and
  // cannot be affected by the ordering of the block above.
  const BADAMI = 4;

  test('gets no badge, while a surveyed place beside it does', async ({ request, page }) => {
    await survey(request, HAMPI, {
      step_free_access: 'yes',
      accessibility_source: 'operator',
      accessibility_checked_on: '2026-08-01'
    });
    await page.goto('/browse');

    // Scoped to the cards. An unscoped `getByText('Step-free')` also matches the filter control's
    // own two buttons, which is a locator finding its own label rather than any data — the class of
    // mistake `e2e/README.md` records under "assert against the card, not the page".
    await expect(cards(page)).toHaveCount(4);
    await expect(cards(page).filter({ hasText: 'Hampi' }).getByText('Step-free')).toBeVisible();

    // An absent badge cannot be misread as "not accessible". A greyed-out one would look like a
    // verdict on a place nobody has been to.
    await expect(
      cards(page)
        .filter({ hasText: 'Badami' })
        .getByText(/Step-free/)
    ).toHaveCount(0);
  });

  test('renders no accessibility panel on its detail page', async ({ page }) => {
    await page.goto(`/places/${BADAMI}`);

    // The page still works; there is simply nothing to say, and a heading with nothing under it
    // would promise information that does not exist.
    await expect(page.getByRole('heading', { name: /Badami/ }).first()).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Getting in' })).toHaveCount(0);
  });
});
