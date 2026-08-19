/**
 * The itinerary feasibility engine (`FV-025`) — stages (a) and (b).
 *
 * One question, answered deterministically: **can this plan actually be completed?**
 *
 * An itinerary that reads beautifully and cannot be executed is worse than no itinerary, because it
 * fails at 2pm on day two in a place with no signal. *"Four hours in Hampi, then sunset at a point
 * 190 km away"* is a sentence that is easy to write and impossible to do.
 *
 * ---------------------------------------------------------------------------
 * Why this file contains no model call, and never will
 * ---------------------------------------------------------------------------
 * `FUTURE_VISION.md` commits to this being **deliberately not AI**, and the reason is not
 * squeamishness about models. The moment a model is inside the validator, the validator stops being
 * something you can prove — and the entire value of this component is that its output is provable.
 * It is also, by design, the scoring oracle for the evaluation suite (`AI-006`): constraint
 * satisfaction becomes a number rather than a judgement. A number produced by a model is a
 * judgement wearing a number's clothes.
 *
 * Everything here is a pure function of the trip object. No database, no clock, no network — so it
 * is exhaustively testable, and so a finding can always be reproduced from the data that produced
 * it.
 *
 * ---------------------------------------------------------------------------
 * The honesty problem, and how it is handled
 * ---------------------------------------------------------------------------
 * Travel time is the check with real teeth, and EasyTrip has **no routing provider** (`FV-026`
 * proposes one; `EXTERNAL_APIS.md` §4 records OpenRouteService as the approved candidate). What
 * exists today is coordinates, which give a straight line.
 *
 * So the estimate is straight-line distance inflated by a road factor, divided by an average speed
 * — and **every consumer is told that**, because a travel-time warning that looks like a
 * measurement is fabricated data with a validator's authority (`PROJECT_CONSTITUTION.md` Article
 * III). `ASSUMPTIONS` is returned with the result for exactly this reason, and every finding it
 * produces carries `estimated: true`.
 *
 * The direction of the error is chosen deliberately too: the road factor makes the estimate
 * *pessimistic* about distance and the speed is a regional average rather than a highway one, so
 * the engine errs toward "this is tight" rather than toward silence. A validator that misses a real
 * problem has failed; one that flags a marginal case has merely been cautious in public.
 */

/**
 * The two numbers this engine assumes, stated rather than buried.
 *
 * Returned to the caller with every result so a UI can say "estimated" truthfully, and so the
 * moment a real routing provider lands (`FV-026`) the difference is visible rather than silent.
 */
const ASSUMPTIONS = {
  // Straight line -> road distance. Real road networks are not straight; 1.3 is the conventional
  // detour index for mixed regional roads and is deliberately conservative.
  road_factor: 1.3,
  // km/h, averaged over Indian state highways and town traffic. Not a motorway figure: this
  // catalogue is regional, and a 90 km/h assumption would silently approve impossible days.
  average_speed_kmh: 40,
  // Below this, "travel time" is not a meaningful concept — two items in the same town.
  negligible_distance_km: 1,
  // A day that travels this much further than a sensible ordering of the same stops is
  // ping-ponging rather than clustering. Both thresholds must trip, so a short day with a slightly
  // odd order is not reported as a problem.
  backtracking_ratio: 1.3,
  backtracking_excess_km: 20
};

const EARTH_RADIUS_KM = 6371;
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

/** Estimated minutes to travel a straight-line distance, rounded up to the minute. */
const travelMinutesForKm = (straightLineKm) =>
  Math.ceil(((straightLineKm * ASSUMPTIONS.road_factor) / ASSUMPTIONS.average_speed_kmh) * 60);

/**
 * `'14:30:00'` -> `870`. `null` for anything unparseable.
 *
 * node-pg returns `TIME` as a string, and an item with no time is the normal case rather than an
 * error — most of these checks simply do not apply to it.
 */
const minutesOfDay = (time) => {
  if (typeof time !== 'string') return null;
  const match = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(time.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
};

const coordinatesOf = (item) =>
  item?.place_latitude != null && item?.place_longitude != null
    ? { latitude: item.place_latitude, longitude: item.place_longitude }
    : null;

/** Whole days between two `YYYY-MM-DD` dates, inclusive of both. `null` if either is missing. */
const inclusiveDayCount = (startDate, endDate) => {
  if (!startDate || !endDate) return null;
  const start = Date.parse(`${String(startDate).slice(0, 10)}T00:00:00Z`);
  const end = Date.parse(`${String(endDate).slice(0, 10)}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  return Math.floor((end - start) / 86_400_000) + 1;
};

const finding = (code, severity, message, extra = {}) => ({ code, severity, message, ...extra });

// ---------------------------------------------------------------------------
// The checks
// ---------------------------------------------------------------------------

/**
 * Stage (a) — a day that exists outside the trip's own dates.
 *
 * The workspace creates day slots from the date range, so this fires when the range was later
 * shortened and the days were not: the plan then contains a day the trip does not have.
 */
const checkDayBounds = (trip) => {
  const dayCount = inclusiveDayCount(trip.start_date, trip.end_date);
  if (dayCount === null) return [];

  return (trip.days || [])
    .filter((day) => day.day_number > dayCount)
    .map((day) =>
      finding(
        'day_outside_trip_dates',
        'error',
        `Day ${day.day_number} falls outside the trip's dates, which cover ${dayCount} day${dayCount === 1 ? '' : 's'}.`,
        { day_number: day.day_number, trip_day_count: dayCount }
      )
    );
};

/** Stage (a) — two items on one day claiming the same minutes. */
const checkOverlaps = (day, timedItems) => {
  const findings = [];
  for (let i = 1; i < timedItems.length; i++) {
    const previous = timedItems[i - 1];
    const current = timedItems[i];
    // An item with no end time occupies an instant, not a span — it cannot overlap what follows.
    if (previous.end === null) continue;
    if (current.start < previous.end) {
      findings.push(
        finding(
          'items_overlap',
          'error',
          `"${previous.item.title}" runs until ${previous.item.end_time?.slice(0, 5)} but "${current.item.title}" starts at ${current.item.start_time?.slice(0, 5)}.`,
          {
            day_number: day.day_number,
            item_ids: [previous.item.id, current.item.id],
            overlap_minutes: previous.end - current.start
          }
        )
      );
    }
  }
  return findings;
};

/**
 * Stage (a) — the plan's order and the clock disagree.
 *
 * Separate from an overlap, and worth its own code: the items may not overlap at all and still be
 * listed in an order nobody can follow, which is what a drag-and-drop workspace makes easy.
 */
const checkOrdering = (day, timedItems) => {
  const inPlanOrder = [...timedItems].sort((a, b) => a.position - b.position);
  for (let i = 1; i < inPlanOrder.length; i++) {
    if (inPlanOrder[i].start < inPlanOrder[i - 1].start) {
      return [
        finding(
          'order_disagrees_with_times',
          'warning',
          `Day ${day.day_number} is listed in an order its times do not follow — "${inPlanOrder[i].item.title}" is scheduled before the item above it.`,
          {
            day_number: day.day_number,
            item_ids: [inPlanOrder[i - 1].item.id, inPlanOrder[i].item.id]
          }
        )
      ];
    }
  }
  return [];
};

/**
 * Stage (b) — the gap between two stops is smaller than the journey between them.
 *
 * The check `FV-025` exists for. Every finding it emits is explicitly an estimate.
 */
const checkTravelTime = (day, timedItems) => {
  const findings = [];
  for (let i = 1; i < timedItems.length; i++) {
    const from = timedItems[i - 1];
    const to = timedItems[i];

    const distanceKm = haversineKm(coordinatesOf(from.item), coordinatesOf(to.item));
    if (distanceKm === null || distanceKm < ASSUMPTIONS.negligible_distance_km) continue;

    // Leaving time is the end of the previous item where one is given, its start otherwise.
    const departure = from.end ?? from.start;
    const gapMinutes = to.start - departure;
    const neededMinutes = travelMinutesForKm(distanceKm);
    if (gapMinutes >= neededMinutes) continue;

    findings.push(
      finding(
        'insufficient_travel_time',
        'error',
        `"${from.item.title}" to "${to.item.title}" is about ${Math.round(distanceKm * ASSUMPTIONS.road_factor)} km — roughly ${neededMinutes} minutes — but the plan allows ${gapMinutes}.`,
        {
          day_number: day.day_number,
          item_ids: [from.item.id, to.item.id],
          straight_line_km: Number(distanceKm.toFixed(1)),
          estimated_travel_minutes: neededMinutes,
          available_minutes: gapMinutes,
          estimated: true
        }
      )
    );
  }
  return findings;
};

/**
 * Stage (b) — the day ping-pongs instead of clustering.
 *
 * Measured, not guessed at: the planned route's length against the length of the same stops in
 * nearest-neighbour order. Nearest-neighbour is not the optimal tour and is not meant to be — this
 * is a *smell* detector, and the honest claim is "a sensible ordering of these same stops is much
 * shorter", which nearest-neighbour supports and optimality is not needed for.
 *
 * Both thresholds must trip. A ratio alone would flag a 6 km day that happened to zigzag.
 */
const checkClustering = (day, orderedItems) => {
  const points = orderedItems.map(coordinatesOf).filter(Boolean);
  if (points.length < 3) return [];

  let planned = 0;
  for (let i = 1; i < points.length; i++) {
    const leg = haversineKm(points[i - 1], points[i]);
    if (leg === null) return [];
    planned += leg;
  }

  const remaining = points.slice(1);
  let cursor = points[0];
  let greedy = 0;
  while (remaining.length) {
    let bestIndex = 0;
    let bestDistance = Infinity;
    remaining.forEach((point, index) => {
      const distance = haversineKm(cursor, point);
      if (distance !== null && distance < bestDistance) {
        bestDistance = distance;
        bestIndex = index;
      }
    });
    greedy += bestDistance;
    cursor = remaining.splice(bestIndex, 1)[0];
  }

  const excess = planned - greedy;
  if (greedy <= 0 || planned / greedy < ASSUMPTIONS.backtracking_ratio) return [];
  if (excess < ASSUMPTIONS.backtracking_excess_km) return [];

  return [
    finding(
      'day_backtracks',
      'warning',
      `Day ${day.day_number} covers about ${Math.round(planned)} km in this order; visiting the same stops in a sensible order is about ${Math.round(greedy)} km.`,
      {
        day_number: day.day_number,
        planned_km: Number(planned.toFixed(1)),
        clustered_km: Number(greedy.toFixed(1)),
        excess_km: Number(excess.toFixed(1)),
        estimated: true
      }
    )
  ];
};

/** Stage (a) — the same place twice in one day. */
const checkDuplicates = (day, orderedItems) => {
  const seen = new Map();
  const findings = [];
  for (const item of orderedItems) {
    if (item.place_id == null) continue;
    if (seen.has(item.place_id)) {
      findings.push(
        finding(
          'place_repeated_in_day',
          'warning',
          `"${item.title}" visits the same place as "${seen.get(item.place_id).title}" on day ${day.day_number}.`,
          { day_number: day.day_number, item_ids: [seen.get(item.place_id).id, item.id] }
        )
      );
      continue;
    }
    seen.set(item.place_id, item);
  }
  return findings;
};

/**
 * Run every check against a trip as `tripModel.getTrip` returns it.
 *
 * @param {Object} trip - `{ start_date, end_date, days: [{ day_number, items: [...] }] }`
 * @returns {Object} `{ feasible, counts, assumptions, findings }`
 *
 * **`feasible` is decided by errors alone.** Warnings describe a plan that is awkward — a day that
 * doubles back, a place visited twice — and a traveller is allowed to want those. Errors describe a
 * plan that cannot be executed. Collapsing the two would make the engine an opinion about taste,
 * and it would stop being usable as `AI-006`'s scorer.
 */
const checkTrip = (trip) => {
  const findings = [...checkDayBounds(trip)];

  for (const day of trip?.days || []) {
    const orderedItems = [...(day.items || [])].sort(
      (a, b) => a.position - b.position || a.id - b.id
    );

    const timedItems = orderedItems
      .map((item) => ({
        item,
        position: item.position,
        start: minutesOfDay(item.start_time),
        end: minutesOfDay(item.end_time)
      }))
      .filter((entry) => entry.start !== null)
      .sort((a, b) => a.start - b.start);

    findings.push(
      ...checkOverlaps(day, timedItems),
      ...checkOrdering(day, timedItems),
      ...checkTravelTime(day, timedItems),
      ...checkClustering(day, orderedItems),
      ...checkDuplicates(day, orderedItems)
    );
  }

  const errors = findings.filter((f) => f.severity === 'error');
  const warnings = findings.filter((f) => f.severity === 'warning');

  return {
    feasible: errors.length === 0,
    counts: { errors: errors.length, warnings: warnings.length },
    assumptions: ASSUMPTIONS,
    findings
  };
};

module.exports = {
  checkTrip,
  // Exported for tests and for `FV-026`, which will replace `travelMinutesForKm` with a real
  // routing call and must be able to compare the two.
  haversineKm,
  travelMinutesForKm,
  minutesOfDay,
  inclusiveDayCount,
  ASSUMPTIONS
};
