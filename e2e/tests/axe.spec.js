const fs = require('node:fs');
const path = require('node:path');
const { test, expect } = require('@playwright/test');

/**
 * The accessibility gate (`PE-022`).
 *
 * **Why this exists, and why now.** Sprint 6.17 ran `axe-core` across seven routes once, by hand,
 * with a throwaway spec that was deleted afterwards. Four routes came back clean. Twenty sprints
 * later, re-measuring found **one** clean route: three landmark violations and a heading skip had
 * accumulated on `/places/1`, and two sign-in pages had lost their `h1`.
 *
 * Nothing regressed loudly. Every one of those arrived in a change that looked right, passed 131
 * browser journeys, and was reviewed. **A one-off audit measures a day; a gate measures every day**,
 * and the gap between those two is exactly what this file closes. The defects it found on its first
 * run are fixed in the same sprint.
 *
 * ---------------------------------------------------------------------------
 * No new dependency
 * ---------------------------------------------------------------------------
 * `axe-core` is already in the frontend tree — `eslint-plugin-jsx-a11y` depends on it — so this
 * reads the bundle off disk and injects it. `@axe-core/playwright` would be a nicer API and a new
 * direct dependency for a wrapper around `axe.run()`, which `SESSION_PROTOCOL` §11.4b asks us not to
 * take without a reason.
 *
 * ---------------------------------------------------------------------------
 * What it gates on, and what it deliberately does not
 * ---------------------------------------------------------------------------
 * Everything `axe` reports, at **zero**, except the entries in `ACCEPTED` — each of which carries a
 * reason and a node count. That is the same shape as `check-secrets`' and `check-module-size`'s
 * waiver lists, and it is chosen over the easier alternatives on purpose:
 *
 *   - **Gating on `critical` only** passes today and would have caught none of the four defects
 *     above, all of which are `moderate` or `serious`.
 *   - **Disabling the `color-contrast` rule** would hide every future contrast regression to
 *     tolerate the present ones. The allowlist is per route *and* per rule, so a new contrast
 *     failure on a route that has none still fails.
 *
 * `FV-029`'s kill criterion applies to this file as much as to the feature it grew out of: *"it
 * becomes a compliance checkbox rather than a usable filter"*. A frozen allowlist that only ever
 * grows is that checkbox. The counts below are ceilings, and a route that improves should have its
 * ceiling lowered rather than left generous.
 */

const AXE = fs.readFileSync(
  path.join(__dirname, '../../frontend/node_modules/axe-core/axe.min.js'),
  'utf8'
);

/**
 * The public routes. **`/saved`, `/profile` and the admin pages are deliberately absent**, and not
 * because they matter less — they redirect an anonymous browser to `/login`, so scanning them here
 * measures the login page twice and reports it as coverage. The first draft of this file did exactly
 * that and the URL in the probe output is what gave it away. Signed-in routes need a signed-in scan;
 * `BL-144` records it.
 */
const ROUTES = ['/', '/browse', '/places/1', '/login', '/signup', '/about'];

/**
 * Violations this project has looked at and is living with, per route.
 *
 * **Only contrast, and only because it is a design decision rather than a defect.** The palette is
 * the product's, the failures are muted secondary text against tinted panels, and changing them is a
 * visual choice the owner makes — not something a test should force at 2am. Sprint 6.17 reached the
 * same conclusion and recorded it; this makes the conclusion enforceable instead of remembered.
 *
 * The number is a **ceiling, not a target**. Lower it when a route improves.
 */
const ACCEPTED = {
  '/': { 'color-contrast': 1 },
  '/browse': { 'color-contrast': 2 },
  '/places/1': { 'color-contrast': 9 }
};

// `/login`, `/signup` and `/about` are **absent because they are clean**, not because they are
// unchecked — they are in `ROUTES` and gated at zero. `/login` had one contrast violation in the
// first measurement and none once the fonts were allowed to settle, which is the artefact described
// in `scan`.

const scan = async (page, route) => {
  // **Reduced motion, and it is what makes this suite deterministic rather than a nicety.** `/`
  // reported 1, 8, 4 and 8 contrast violations across four identical scans, because the hero
  // carousel advances every five seconds and each run measured whichever slide was up. Asking for
  // reduced motion stops it — once `useHomeCarousel` was taught to honour the request, which it did
  // not do until this sprint.
  //
  // It is also the right thing to measure. A reader who has asked the platform to stop moving
  // things is the reader most likely to be using assistive technology on this page.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(route);
  // `domcontentloaded` is already done by `goto`; this waits for the client render that adds most of
  // the DOM axe cares about. Best-effort: a page with a long-poll would never reach `networkidle`.
  await page.waitForLoadState('networkidle').catch(() => {});

  // **Wait for the fonts, or the contrast results are noise.** `color-contrast` compares computed
  // colours against rendered text, and a node still showing a fallback face measures differently
  // from the same node once the webfont lands. Before this line `/` reported 1, 8, 4 and 8
  // violations across four identical scans; after it, 1, 1, 1 and 1.
  //
  // That also settles something the project had written down and never re-derived. Sprint 6.17
  // recorded a contrast finding that *"appeared once, absent on re-run with no change — reported as
  // unstable, not real"*. **The page was never unstable; the measurement was**, and it stayed
  // recorded as a property of the UI for twenty sprints. §45 of `NOTES` warns about exactly this —
  // a number attached to a claim makes it read as settled.
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);

  await page.addScriptTag({ content: AXE });

  return page.evaluate(async () => {
    const result = await window.axe.run(document, { resultTypes: ['violations'] });
    return result.violations.map((violation) => ({
      id: violation.id,
      impact: violation.impact,
      count: violation.nodes.length,
      // The first offending element, so a failure names something findable rather than a rule id.
      example: violation.nodes[0]?.html?.slice(0, 160) ?? ''
    }));
  });
};

test.describe('every public route passes axe, except what we have written down', () => {
  for (const route of ROUTES) {
    test(`${route} has no unaccepted violations`, async ({ page }) => {
      const violations = await scan(page, route);
      const accepted = ACCEPTED[route] || {};

      const unexpected = violations.filter((v) => !(v.id in accepted));
      expect(
        unexpected,
        `Unaccepted accessibility violations on ${route}:\n` +
          unexpected.map((v) => `  ${v.id} (${v.impact}, ${v.count}) — ${v.example}`).join('\n')
      ).toEqual([]);

      // An accepted rule may not get worse. Without this the allowlist would tolerate a route going
      // from two contrast failures to two hundred, which is not what "we looked at this" meant.
      for (const violation of violations) {
        expect(
          violation.count,
          `${route}: ${violation.id} grew past its accepted ceiling`
        ).toBeLessThanOrEqual(accepted[violation.id]);
      }
    });
  }

  test('the allowlist does not name routes or rules that are already clean', async ({ page }) => {
    // A waiver for something that no longer fails is a lie about the codebase, and it is the way a
    // list like this rots: every entry stays forever because nobody re-checks. `check-module-size`
    // reported its own stale waiver in Sprint 8.9, which is where this assertion comes from.
    const stale = [];

    for (const route of Object.keys(ACCEPTED)) {
      const violations = await scan(page, route);
      for (const rule of Object.keys(ACCEPTED[route])) {
        if (!violations.some((v) => v.id === rule)) stale.push(`${route} → ${rule}`);
      }
    }

    expect(stale, `Accepted violations that no longer occur:\n  ${stale.join('\n  ')}`).toEqual([]);
  });
});
