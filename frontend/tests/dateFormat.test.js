import {
  formatDate,
  formatDateShort,
  formatDateTime,
  formatRelativeOrShort
} from '../src/utils/dateFormat';

/**
 * Date formatting (IMP-122, closing the first item of TD-018).
 *
 * These three functions were consolidated from five disagreeing copies. What makes them worth
 * testing is not the happy path — it is that they differ *deliberately* in three ways at once
 * (precision, month width, and what they return for missing input), and every one of those
 * differences is load-bearing for some caller. A "simplifying" refactor that unified them behind an
 * options bag would silently change what an admin table renders for a null date.
 *
 * The suite runs in `America/Los_Angeles` (see `jest.env.js`), not UTC, on purpose.
 */

// 2026-01-01T00:00:00Z is 2025-12-31 16:00 in Los Angeles — a different day, a different month, and
// a different YEAR. Any formatter that forgets `timeZone: 'UTC'` gets all three wrong at once.
const UTC_MIDNIGHT_NEW_YEAR = '2026-01-01T00:00:00Z';
const MIDMORNING = '2026-01-01T10:30:00Z';

describe('the test environment itself', () => {
  // Guarding the guard. If the suite runs in UTC, every zone assertion below still passes while
  // proving nothing — the exact failure mode `VERIFICATION_LEDGER.md` exists to prevent.
  //
  // This asserts the EFFECTIVE zone, not `process.env.TZ`. Node caches the zone at startup, so
  // setting the variable from a setup file leaves `process.env.TZ` looking correct while `Date`
  // keeps using the machine's zone — which is how this very suite first passed for the wrong
  // reason. The zone is therefore set by `cross-env` in `npm test`; if that prefix is ever dropped,
  // this test fails loudly instead of the suite going quietly green.
  test('does NOT run in UTC, or the timezone assertions prove nothing', () => {
    expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe('America/Los_Angeles');
    expect(new Date(UTC_MIDNIGHT_NEW_YEAR).getFullYear()).toBe(2025);
  });
});

describe('all three formatters pin the time zone (BUG-046)', () => {
  test('a UTC-midnight value never slips to the previous day', () => {
    expect(formatDate(UTC_MIDNIGHT_NEW_YEAR)).toBe('January 1, 2026');
    expect(formatDateShort(UTC_MIDNIGHT_NEW_YEAR)).toBe('Jan 1, 2026');
    expect(formatDateTime(UTC_MIDNIGHT_NEW_YEAR)).toContain('January 1, 2026');
  });

  test('the local clock says otherwise, which is the whole point', () => {
    // Proves the input really is a boundary case rather than a date that happens to be safe.
    expect(new Date(UTC_MIDNIGHT_NEW_YEAR).toLocaleDateString('en-US')).toBe('12/31/2025');
  });
});

describe('the three are genuinely different, and must stay that way', () => {
  test('same input, three distinct renderings', () => {
    const outputs = [
      formatDate(MIDMORNING),
      formatDateShort(MIDMORNING),
      formatDateTime(MIDMORNING)
    ];
    expect(new Set(outputs).size).toBe(3);
  });

  test('formatDate is long-month, date only', () => {
    expect(formatDate(MIDMORNING)).toBe('January 1, 2026');
  });

  test('formatDateShort is short-month, date only — dense tables depend on the width', () => {
    expect(formatDateShort(MIDMORNING)).toBe('Jan 1, 2026');
  });

  test('formatDateTime carries the time AND names its zone', () => {
    // The zone is in the output because an admin comparing a row against a server log has to know
    // which clock it is. Asserted loosely on the separator, strictly on the parts that matter.
    const out = formatDateTime(MIDMORNING);
    expect(out).toMatch(/January 1, 2026/);
    expect(out).toMatch(/10:30\s?AM/);
    expect(out).toMatch(/UTC$/);
  });
});

describe('the empty and invalid cases, which is where the five copies disagreed', () => {
  // Each of these is a different contract chosen for a different caller. Collapsing them is the
  // regression: `formatDate` returning 'N/A' would print "N/A" into an article byline that renders
  // inside `{x && …}`, and `formatDateShort` returning null would leave a table cell that reads as
  // a real empty value.
  test('formatDate returns null for missing input', () => {
    expect(formatDate('')).toBeNull();
    expect(formatDate(null)).toBeNull();
    expect(formatDate(undefined)).toBeNull();
  });

  test('formatDate returns null for junk rather than the string "Invalid Date"', () => {
    expect(formatDate('not-a-date')).toBeNull();
  });

  test("formatDateShort returns 'N/A' for missing input", () => {
    expect(formatDateShort('')).toBe('N/A');
    expect(formatDateShort(null)).toBe('N/A');
  });

  test("formatDateShort returns 'Invalid Date' for junk — distinct from 'N/A'", () => {
    // Two different facts: "there is no date" vs "there is a value and it is broken".
    expect(formatDateShort('not-a-date')).toBe('Invalid Date');
    expect(formatDateShort('not-a-date')).not.toBe(formatDateShort(null));
  });

  test("formatDateTime returns 'N/A' for missing and 'Invalid Date' for junk", () => {
    expect(formatDateTime(null)).toBe('N/A');
    expect(formatDateTime('not-a-date')).toBe('Invalid Date');
  });

  test('a broken value never renders as "Invalid Date UTC"', () => {
    // This one actually happened: the zone suffix was appended unconditionally, so unparseable
    // input produced "Invalid Date UTC" in an audit column.
    expect(formatDateTime('not-a-date')).not.toMatch(/UTC/);
  });
});

describe('accepts what the API actually sends', () => {
  test('a Postgres timestamptz string', () => {
    // `pg` serialises timestamptz like this; the formatters must not require a Date instance.
    expect(formatDateShort('2026-01-01 00:00:00+00')).toBe('Jan 1, 2026');
  });

  test('a Date instance', () => {
    expect(formatDate(new Date(UTC_MIDNIGHT_NEW_YEAR))).toBe('January 1, 2026');
  });
});

// ---------------------------------------------------------------------------
// The relative label, and the reason it takes a clock instead of reading one
// ---------------------------------------------------------------------------
describe('formatRelativeOrShort is pure, which is the fix for BUG-059', () => {
  /**
   * This logic used to sit in `PlaceCard.jsx` and call `Date.now()` **during render**, so a
   * server-rendered card's output depended on *when* it rendered. On an ISR page cached for five
   * minutes, that is a hydration mismatch waiting for a day boundary.
   *
   * A test that pinned one fixture to one expected string would have passed against the old code
   * too, as long as the fixture was nowhere near a boundary. So these assert the property instead:
   * **the same input under two different clocks either agrees, or disagrees for a stated reason.**
   */
  const AUG_30 = '2026-08-30T12:00:00.000Z';
  const at = (iso) => new Date(iso).getTime();

  test('with no clock it is the absolute date — the server and first-render answer', () => {
    expect(formatRelativeOrShort(AUG_30, null)).toBe('Aug 30, 2026');
    expect(formatRelativeOrShort(AUG_30, undefined)).toBe('Aug 30, 2026');
    expect(formatRelativeOrShort(AUG_30, NaN)).toBe('Aug 30, 2026');
  });

  test('two clocks two minutes apart across midnight UTC give the same answer', () => {
    // The exact window the old code could disagree with itself in: the server renders at 23:59 and
    // the browser hydrates at 00:01. Both are 2 days after the 30th by the day-count this uses.
    const before = formatRelativeOrShort(AUG_30, at('2026-09-01T23:59:00.000Z'));
    const after = formatRelativeOrShort(AUG_30, at('2026-09-02T00:01:00.000Z'));
    expect(after).toBe(before);
  });

  test('the labels themselves, at each boundary', () => {
    expect(formatRelativeOrShort(AUG_30, at('2026-08-31T12:00:00.000Z'))).toBe('Yesterday');
    expect(formatRelativeOrShort(AUG_30, at('2026-09-01T12:00:00.000Z'))).toBe('2 days ago');
    expect(formatRelativeOrShort(AUG_30, at('2026-09-05T12:00:00.000Z'))).toBe('6 days ago');
  });

  test('the rounding is `ceil`, so a few hours old already reads "Yesterday" (BUG-060)', () => {
    // **Asserting a defect, on purpose.** `Math.ceil` over a millisecond difference means any
    // non-zero elapsed time rounds up to a whole day, so a row created six hours ago is labelled
    // "Yesterday" and the `'Today'` branch is unreachable except at the exact same millisecond.
    //
    // Preserved rather than fixed here: this commit moves the logic and removes its clock read
    // (`BUG-059`), and changing what a card *says* at the same time would hide a product change
    // inside a refactor. Filed as `BUG-060`. This test is what makes the current behaviour a
    // stated position instead of an accident, and it will fail loudly when that item is taken.
    expect(formatRelativeOrShort(AUG_30, at('2026-08-30T18:00:00.000Z'))).toBe('Yesterday');
    expect(formatRelativeOrShort(AUG_30, at('2026-08-30T12:00:00.001Z'))).toBe('Yesterday');
    // The only input that reaches 'Today' is the timestamp itself.
    expect(formatRelativeOrShort(AUG_30, at(AUG_30))).toBe('Today');
  });

  test('at exactly a week it hands over to the absolute date, and stays there', () => {
    // The handover is the one place a fencepost error hides: `>= 7` rather than `> 7`, or the
    // reverse, changes what a seven-day-old row says without changing anything else.
    expect(formatRelativeOrShort(AUG_30, at('2026-09-06T12:00:00.000Z'))).toBe('Aug 30, 2026');
    expect(formatRelativeOrShort(AUG_30, at('2027-09-06T12:00:00.000Z'))).toBe('Aug 30, 2026');
  });

  test('missing and invalid input give the shared answers, not a relative one', () => {
    // `new Date(null)` is the epoch, so a careless version reports "20000 days ago" for a row that
    // simply has no timestamp — which is the defect `formatDateShort`'s 'N/A' exists to avoid.
    const now = at('2026-09-01T12:00:00.000Z');
    expect(formatRelativeOrShort(null, now)).toBe('N/A');
    expect(formatRelativeOrShort('', now)).toBe('N/A');
    expect(formatRelativeOrShort('not-a-date', now)).toBe('Invalid Date');
  });

  test('it never reads the clock itself', () => {
    // The property, asserted directly: if the function consults `Date.now`, this fails. That is
    // what `PlaceCard` depends on for its server and client renders to agree.
    const spy = jest.spyOn(Date, 'now');
    try {
      formatRelativeOrShort(AUG_30, at('2026-09-01T12:00:00.000Z'));
      formatRelativeOrShort(AUG_30, null);
      expect(spy).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });
});
