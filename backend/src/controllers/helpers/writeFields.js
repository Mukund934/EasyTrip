/**
 * How a place write decides that a caller actually supplied a field (`BUG-055`).
 *
 * **The two halves of the API disagreed about what "absent" means**, and the disagreement was a
 * 500 rather than a wrong value, which is why it stayed hidden.
 *
 * Every optional rule in `placeRoutes` is `optional({ values: 'falsy' })`, so an empty string is
 * *not validated* — it is treated as "the caller said nothing". The controller then decided the same
 * question with `field === undefined`, under which an empty string **is** a value, and passed `''`
 * to `updatePlace`. For a free-text column that writes an empty string; for a column with a `CHECK`
 * — `setting`, and both accessibility axes — the database rejects it and the whole edit 500s.
 *
 * It is reachable from an ordinary browser: an HTML `<select>` whose empty option is selected
 * submits `name=""`, and a multipart form submits every field it renders whether or not anybody
 * touched it. So "edit a place without choosing a classification" was a server error.
 *
 * One predicate, used by both, so they cannot drift again.
 */

/**
 * Did the caller supply this field?
 *
 * `undefined` (absent from the body) and `''` (present and empty, which multipart and HTML forms
 * produce constantly) both mean **no**.
 *
 * `null` deliberately means **yes**. A JSON caller sending `null` is asking to clear the column, and
 * that is a real edit — the database decides whether the result is still valid, which for an
 * accessibility claim is exactly the check that must not be bypassed.
 */
const isProvided = (value) => value !== undefined && value !== '';

/** `{ key: value }` when the caller supplied it, `{}` when they did not — for spreading into a patch. */
const provided = (key, value) => (isProvided(value) ? { [key]: value } : {});

module.exports = { isProvided, provided };
