const { test, expect } = require('@playwright/test');

/**
 * The browse journey (IMP-094, IMP-011).
 *
 * The API suite already proves the filter *endpoints*, and `browseFilters.test.js` proves the
 * filter *rules*. Neither can prove the thing in between: that a filter typed into a real input
 * reaches those endpoints, that the address bar ends up describing what is on screen, and that a
 * link pasted from that address bar server-renders the same view.
 *
 * That round trip is the contract. It has two independent halves — `buildQueryString` writing the
 * URL client-side, and `getServerSideProps` reading it back — and each passes its own unit test
 * while still being able to disagree with the other.
 */

const cards = (page) => page.locator('a[href^="/places/"]');

test.describe('the server-rendered filter contract', () => {
  test('an unfiltered browse shows every seeded place', async ({ page }) => {
    await page.goto('/browse');
    await expect(cards(page).first()).toBeVisible();
    await expect(cards(page)).toHaveCount(4);
  });

  test('a pasted search link server-renders the filtered view', async ({ page }) => {
    // The half of the round trip that runs before any JavaScript: this is what a shared link does.
    await page.goto('/browse?q=Hampi');
    await expect(cards(page)).toHaveCount(1);
    // Scoped to the card, not `getByText`: the filter panel's <select> carries a hidden
    // <option value="Hampi">, so a bare text match would pass even with zero results rendered.
    await expect(cards(page).first()).toContainText('Hampi');
  });

  test('a pasted rating link filters too', async ({ page }) => {
    // Seed: Hampi 9/2 (4.5) and Gokarna 3/1 (3.0) are rated; Coorg and Badami are not. An unrated
    // place must not satisfy a minimum-rating filter — the `null`-not-`0` contract from BUG M-2,
    // now asserted through the whole stack rather than on the helper alone.
    await page.goto('/browse?rating=4');
    await expect(cards(page)).toHaveCount(1);
    await expect(cards(page).first()).toContainText('Hampi');
  });

  test('a filter matching nothing renders an empty state, not a crash', async ({ page }) => {
    await page.goto('/browse?q=zzzznotaplace');
    await expect(cards(page)).toHaveCount(0);
    await expect(page.locator('body')).not.toContainText('Application error');
  });
});

test.describe('filtering in the browser', () => {
  test('typing a search filters the results and rewrites the URL', async ({ page }) => {
    await page.goto('/browse');
    await expect(cards(page)).toHaveCount(4);

    await page.getByLabel('Search destinations').fill('Hampi');

    // The client rewrites the address bar with `replaceState` so the view is shareable. This is the
    // client half of the round trip; the server half is asserted above.
    await expect(page).toHaveURL(/[?&]q=Hampi/);
    await expect(cards(page)).toHaveCount(1);
  });

  test('the rewritten URL is itself a working shared link', async ({ page }) => {
    // Closes the loop: take what the client wrote into the address bar, load it cold, and require
    // the same result set. A divergence between the two conventions — repeated `?theme=a&theme=b`
    // here versus the JSON encoding the API validator wants — would show up exactly here.
    await page.goto('/browse');
    await page.getByLabel('Search destinations').fill('Gokarna');
    await expect(cards(page)).toHaveCount(1);

    const shared = page.url();
    await page.goto('about:blank');
    await page.goto(shared);

    await expect(cards(page)).toHaveCount(1);
    await expect(cards(page).first()).toContainText('Gokarna');
  });

  test('clearing the search restores the full catalogue', async ({ page }) => {
    await page.goto('/browse?q=Hampi');
    await expect(cards(page)).toHaveCount(1);

    await page.getByLabel('Search destinations').fill('');

    await expect(cards(page)).toHaveCount(4);
    // An empty filter must leave no `q=` behind — `location=''` reads to the server as "filter by
    // the empty string" rather than "do not filter".
    await expect(page).not.toHaveURL(/[?&]q=/);
  });
});

test.describe('browse to detail', () => {
  test('clicking a place opens its detail page', async ({ page }) => {
    await page.goto('/browse?q=Hampi');
    await cards(page).first().click();

    await expect(page).toHaveURL(/\/places\/\d+$/);
    await expect(page.getByRole('heading', { name: /Hampi/i }).first()).toBeVisible();
  });

  test('the journey leaves no hydration mismatch behind', async ({ page }) => {
    // Two hydration bugs shipped from these pages (BUG-046 and the 5.9 map bug). Both rendered
    // fine and reported themselves only in the console, so this is the only place they are visible.
    const errors = [];
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    page.on('pageerror', (e) => errors.push(String(e)));

    await page.goto('/browse');
    await expect(cards(page).first()).toBeVisible();
    await cards(page).first().click();
    await expect(page).toHaveURL(/\/places\/\d+$/);

    expect(
      errors.filter((text) => /hydrat|did not match|Minified React error/i.test(text))
    ).toEqual([]);
  });
});
