/**
 * Runs before each test file (`setupFilesAfterEnv`).
 *
 * The DOM matchers only. The time zone is set earlier, in `jest.env.js` — see the note there for
 * why it cannot live here.
 */
import '@testing-library/jest-dom';

/**
 * jsdom implements no `IntersectionObserver`, and several components gate their content on one —
 * `PlaceCard` defers rendering until the card scrolls into view, `browse` uses `useInView` for its
 * infinite-scroll sentinel.
 *
 * This stand-in reports the element as intersecting **immediately**, which is the state a test
 * cares about: "given the card is on screen, what does it render". Anything asserting the *deferral*
 * itself would need to drive this deliberately, and should build its own observer rather than
 * loosen this one.
 */
class ImmediateIntersectionObserver {
  constructor(callback) {
    this.callback = callback;
  }

  observe(target) {
    this.callback([{ isIntersecting: true, intersectionRatio: 1, target }], this);
  }

  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}

global.IntersectionObserver = ImmediateIntersectionObserver;
window.IntersectionObserver = ImmediateIntersectionObserver;
