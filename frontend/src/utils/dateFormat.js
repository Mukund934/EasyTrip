/**
 * Date formatting, in one place (IMP-122, partial).
 *
 * Five copies of a `formatDate` existed across the frontend, and no two agreed. Three are
 * consolidated here, as three named functions rather than one with an options bag: they differ in
 * precision, in month width, AND in what they return for missing input, and each of those is a
 * property of the caller rather than a preference. `PlaceCard.jsx` and `admin/users.jsx` still
 * carry their own — the rest of `IMP-122`.
 *
 * **All three name their locale and their time zone.** Anything left to the runtime differs
 * between Node and the browser, which is how `BUG-044` (locale) and `BUG-046` (zone) happened.
 */

/** UTC, deliberately: a rendered date must not depend on who is looking at it. */
const ZONE = 'UTC';

/**
 * A date as editorial prose — "January 1, 2026" — or `null`.
 *
 * `null` rather than a placeholder string, because every caller renders it inside `{x && …}`.
 */
export const formatDate = (dateString) => {
  if (!dateString) return null;
  // Same reason as `formatDateTime`: bad input yields the literal string "Invalid Date" rather
  // than an exception, and rendering that in an article byline would be worse than rendering
  // nothing. (Pre-existing behaviour — this guard is new, the callers all use `{x && …}`.)
  const parsed = new Date(dateString);
  if (Number.isNaN(parsed.getTime())) return null;
  try {
    return parsed.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: ZONE
    });
  } catch {
    return null;
  }
};

/**
 * The short weekday of a calendar date — "Mon" — or `null`.
 *
 * Added for the weather forecast strip (`IMP-110`), which labels seven columns and has no room for
 * a full date. Noon is substituted for the missing time before parsing: a bare `YYYY-MM-DD` is
 * interpreted as UTC midnight, which lands on the previous day for anyone behind UTC and would
 * label Tuesday's forecast "Mon" — `BUG-046` in a new place. Midday is far enough from both
 * boundaries that no zone can move it.
 */
export const formatWeekdayShort = (dateString) => {
  if (!dateString) return null;
  const parsed = new Date(`${dateString}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  try {
    return parsed.toLocaleDateString('en-US', { weekday: 'short', timeZone: ZONE });
  } catch {
    return null;
  }
};

/**
 * A compact date — "Jan 1, 2026" — or `'N/A'`.
 *
 * For dense tables, where a long month name pushes the column wide and the reader is scanning
 * rather than reading. `'N/A'` rather than `null` for the same reason `formatDateTime` uses it:
 * a blank table cell is indistinguishable from a real empty value.
 */
export const formatDateShort = (dateString) => {
  if (!dateString) return 'N/A';
  const parsed = new Date(dateString);
  if (Number.isNaN(parsed.getTime())) return 'Invalid Date';
  try {
    return parsed.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      timeZone: ZONE
    });
  } catch {
    return 'Invalid Date';
  }
};

/**
 * A timestamp with its time — "January 1, 2026 at 10:30 AM UTC".
 *
 * Separate from `formatDate` rather than an option, because the two differ in what they return
 * for missing input as well as in precision. This one is for audit trails (created/updated by
 * whom, when), where dropping the time loses the thing the row is for, and where a blank cell
 * would be indistinguishable from a real empty value — hence `'N/A'`.
 *
 * The zone is named in the output because an admin comparing this against a server log needs to
 * know which clock it is.
 */
export const formatDateTime = (dateString) => {
  if (!dateString) return 'N/A';
  // An unparseable string does NOT throw: `new Date('x').toLocaleString(...)` returns the string
  // "Invalid Date". So the catch below never fires for bad input, and appending " UTC"
  // unconditionally produced "Invalid Date UTC". Check the date itself instead.
  const parsed = new Date(dateString);
  if (Number.isNaN(parsed.getTime())) return 'Invalid Date';
  try {
    return `${parsed.toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      hour12: true,
      timeZone: ZONE
    })} UTC`;
  } catch {
    return 'Invalid Date';
  }
};
