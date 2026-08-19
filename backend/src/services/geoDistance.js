const EARTH_RADIUS_KM = 6371;

/**
 * Great-circle distance, on its own.
 *
 * Extracted from `feasibilityService` in Sprint 8.19, and the line count is what forced the
 * question rather than what answered it. The real reason is that `routeOrderService` was already
 * importing `haversineKm` **through the feasibility engine** — a module reaching into a validator to
 * borrow a geometry function, which makes the validator look like a dependency of route ordering
 * when it is not.
 *
 * Nothing here knows what a trip is. `travelMinutesForKm` deliberately stayed behind: it divides by
 * `ASSUMPTIONS.average_speed_kmh`, and those thresholds are feasibility *policy*, not geometry.
 */

const toRadians = (degrees) => (degrees * Math.PI) / 180;

/**
 * Great-circle distance in kilometres, or `null` when either point is unknown.
 *
 * `null` rather than 0 on missing coordinates, and the difference matters: 0 would mean "these are
 * in the same place", which would silently approve a day whose stops we simply know nothing about.
 * A check that cannot run must say so, not pass.
 */
const haversineKm = (a, b) => {
  // `Number(null)` is 0, and 0 is a finite number — so coercing first and checking `isFinite`
  // afterwards reads a missing longitude as the Greenwich meridian and returns a confident,
  // nonsensical 8,000 km. Caught by the test that asserts this returns null; the emptiness check
  // has to come before the coercion, not after it.
  const present = (value) => value !== null && value !== undefined && value !== '';
  if (![a?.latitude, a?.longitude, b?.latitude, b?.longitude].every(present)) return null;

  const lat1 = Number(a.latitude);
  const lon1 = Number(a.longitude);
  const lat2 = Number(b.latitude);
  const lon2 = Number(b.longitude);
  if (![lat1, lon1, lat2, lon2].every(Number.isFinite)) return null;

  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
};

module.exports = { haversineKm };
