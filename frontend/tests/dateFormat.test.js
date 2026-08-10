import { formatDate, formatDateShort, formatDateTime } from '../src/utils/dateFormat';

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
