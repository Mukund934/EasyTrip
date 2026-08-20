const routingService = require('./routingService');
const logger = require('../utils/logger');

/**
 * Road distances for a trip's days (`FV-026` stage b).
 *
 * The same division of labour `tripForecastService` uses, for the same reason: `feasibilityService`
 * commits to being a pure function of the trip object, so the network call lives out here and hands
 * the engine plain data.
 *
 * ---------------------------------------------------------------------------
 * One request per day, not one per leg
 * ---------------------------------------------------------------------------
 * A day's timed stops go into a single matrix call, and only the consecutive pairs are read back
 * off the diagonal. Asking leg by leg would be N-1 requests for the same answer, against a quota
 * whose Matrix figure the provider does not publish.
 *
 * The unused cells are not waste — `FV-027` stage b will want the full matrix to answer *"what if
 * these two swapped?"*, and it will find it already cached.
 *
 * ---------------------------------------------------------------------------
 * The coordinate order is the bug this file exists to not have
 * ---------------------------------------------------------------------------
 * **OpenRouteService takes `[longitude, latitude]`.** Everything else in this codebase — Leaflet,
 * the database columns, `haversineKm`, the weather service — is latitude first. Swapping them does
 * not error; it returns a confident distance to somewhere in the Indian Ocean. It is converted in
 * exactly one place, here, and asserted by a test that pins the transmitted order.
 */

/** A day's timed stops that have coordinates, in the order the clock puts them. */
const routableStops = (day) =>
  (day?.items || [])
    .filter(
      (item) => item.start_time && item.place_latitude != null && item.place_longitude != null
    )
    .map((item) => ({
      id: item.id,
      minutes:
        Number(String(item.start_time).slice(0, 2)) * 60 +
        Number(String(item.start_time).slice(3, 5)),
      // The one conversion. Numbers, not strings: node-pg hands `DECIMAL` over as a string, and
      // JSON.stringify would then transmit `"76.46"`, which the provider rejects.
      point: [Number(item.place_longitude), Number(item.place_latitude)]
    }))
    .sort((a, b) => a.minutes - b.minutes);

/**
 * A copy of the trip whose days carry the road distance between consecutive stops.
 *
 * Never mutates its argument. A day with no reading is returned exactly as it arrived, and the
 * engine then falls back to the straight-line estimate it has always used.
 *
 * @param {Object} trip - a `tripModel.getTripWorkspace` result
 * @returns {Promise<Object>} the trip, with `road_legs` (`"fromId->toId"` -> `{ km, minutes }`) and
 *   `routing_source` on any day the provider answered for.
 */
const attachRoadLegs = async (trip) => {
  const days = trip?.days || [];
  // Asked before any work: with no key configured this is the entire cost of the feature.
  if (!routingService.isConfigured() || days.length === 0) return trip;

  const lookups = days.map(async (day) => {
    const stops = routableStops(day);
    if (stops.length < 2) return day;

    const matrix = await routingService.getMatrix(stops.map((stop) => stop.point));
    if (!matrix) return day;

    const road_legs = {};
    for (let i = 1; i < stops.length; i += 1) {
      const km = matrix.distances?.[i - 1]?.[i];
      const seconds = matrix.durations?.[i - 1]?.[i];
      // A provider can return `null` for a pair it cannot route — an island, a gap in the network.
      // That leg keeps the estimate rather than borrowing a number from a different pair.
      if (typeof km !== 'number' || typeof seconds !== 'number') continue;

      road_legs[`${stops[i - 1].id}->${stops[i].id}`] = {
        km,
        minutes: Math.ceil(seconds / 60)
      };
    }

    if (Object.keys(road_legs).length === 0) return day;
    return { ...day, road_legs, routing_source: matrix.source };
  });

  try {
    return { ...trip, days: await Promise.all(lookups) };
  } catch (error) {
    // The report is worth more than the upgrade. `getMatrix` promises never to throw; this is here
    // because a promise in a docstring is not a mechanism.
    logger.warn({ name: error.name }, 'Road-leg lookup failed; reporting with estimates');
    return trip;
  }
};

module.exports = { attachRoadLegs };
