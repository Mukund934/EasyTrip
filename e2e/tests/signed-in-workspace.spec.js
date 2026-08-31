const { test, expect } = require('@playwright/test');
const authEmulator = require('../auth-emulator');
const { PORTS } = require('../../playwright.config');

/**
 * A real browser, really signed in, on a client-rendered page (`TD-024`).
 *
 * **What was missing, and why it was a hole rather than a gap.** `admin-authenticated.spec.js` puts
 * a real emulator token into the `et_id_token` cookie and asks the SSR gate for its verdict. That
 * proves the gate. It proves nothing on the other side of it, because the browser was never signed
 * in — `frontend/src/config/firebase.js` had no way to reach the emulator, so `useAuth()` saw no
 * user and every page behind it bounced to `/login`.
 *
 * So the trip workspace, the wishlist, the profile and the admin place form were covered by
 * component tests against mocked services and by API tests against real HTTP, **and by nothing in
 * between** — the layer where a form actually submits, a token is actually attached, and a value
 * actually comes back after a reload. `TD-023` shipped a defect exactly there: the classification
 * radio had 13 component assertions and 2 API ones, and `getPlaceById` still did not select the
 * column, because no test had ever set the value in a browser and read it back.
 *
 * Every token below is minted by the emulator from a **sign-in the browser performed itself**,
 * through the same `signInWithEmailAndPassword` call production runs, and verified by the real
 * `firebase-admin` on the server. Nothing is stubbed on either side.
 */

const state = authEmulator.readState();

// Stated, not silent — the same rule the other authenticated specs follow. An unavailable emulator
// must look unavailable in the report rather than looking like coverage.
test.skip(
  !state.enabled,
  `Firebase Auth Emulator unavailable — ${state.reason || 'reason not recorded'}`
);

// The `nonAdmin` identity from `auth-emulator.js`: a real account, provisioned in the emulator and
// in `users`, with no admin rights. Everything here is an ordinary signed-in traveller.
const IDENTITY = { email: 'e2e-user@easytrip.test', password: 'e2e-password' };

/**
 * Sign in the way a person does: the real form, the real SDK, the real emulator.
 *
 * Deliberately not `addCookies`. The cookie is a *mirror* that `onIdTokenChanged` writes for the SSR
 * gate (`AuthContext`), and setting it by hand produces a page the server treats as authenticated
 * and the client does not — the exact half-signed-in state that makes a client-rendered page
 * untestable, and the reason this file exists.
 */
const signIn = async (page) => {
  await page.goto('/login');
  await page.locator('#email').fill(IDENTITY.email);
  await page.locator('#password').fill(IDENTITY.password);
  await page.getByRole('button', { name: /^sign in$/i }).click();

  // Sign-in redirects to `/`. Waiting for that navigation means a failed sign-in fails *here*, with
  // the login page still on screen and its error message readable, rather than three assertions
  // later somewhere that looks unrelated.
  await page.waitForURL(`${PORTS.BASE_URL}/`, { timeout: 20_000 });
};

test.describe('a browser that has actually signed in', () => {
  test('reaches the trip workspace instead of being bounced to /login', async ({ page }) => {
    await signIn(page);
    await page.goto('/trips');

    // `/trips` renders nothing until `useAuth()` resolves, then either the page or a redirect. This
    // heading is the client-side branch going the way no cookie-only journey could make it go.
    await expect(page.getByRole('heading', { name: 'My trips', level: 1 })).toBeVisible();
    expect(new URL(page.url()).pathname).toBe('/trips');
  });

  test('the wishlist too, so this is a property of signing in and not of one page', async ({
    page
  }) => {
    await signIn(page);
    await page.goto('/saved');

    await expect(page.getByRole('heading', { name: 'Saved places', level: 1 })).toBeVisible();
    expect(new URL(page.url()).pathname).toBe('/saved');
  });

  test('the identity the API sees is the one the browser signed in as', async ({
    page,
    context,
    request
  }) => {
    await signIn(page);

    // The token the SDK itself obtained, read from the mirror `AuthContext` writes — not one minted
    // by the harness. This is the assertion that fails if the emulator were wired to a different
    // project: the token would carry the wrong audience and `verifyIdToken` would reject it.
    const cookie = (await context.cookies()).find((entry) => entry.name === 'et_id_token');
    expect(cookie, 'signing in should mirror the ID token into et_id_token').toBeTruthy();

    const response = await request.get(`${PORTS.API_URL}/auth/profile`, {
      headers: { Authorization: `Bearer ${cookie.value}` }
    });

    expect(response.status()).toBe(200);
    expect(JSON.stringify(await response.json())).toContain(IDENTITY.email);
  });

  test('a trip created through the form survives a reload', async ({ page }) => {
    await signIn(page);
    await page.goto('/trips');

    // Unique to this run: the suite shares one database and `trips.spec.js` writes to it too.
    const title = `Browser trip ${Date.now()}`;

    await page.getByRole('button', { name: /new trip/i }).click();
    await page.locator('#trip-title').fill(title);
    await page.getByRole('button', { name: 'Create trip' }).click();

    // Creating navigates into the trip, and that URL is the first evidence the POST carried a token
    // the server accepted — an unauthenticated write would have surfaced an error and stayed put.
    await page.waitForURL(/\/trips\/\d+$/, { timeout: 20_000 });
    const workspaceUrl = page.url();
    await expect(page.getByText(title)).toBeVisible();

    // The round trip `TD-024` was opened for. A value that renders once could have come from the
    // form's own state; a value still there after the page is thrown away and rebuilt from the API
    // came from the database.
    await page.reload();
    await expect(page.getByText(title)).toBeVisible();
    expect(page.url()).toBe(workspaceUrl);
  });
});
