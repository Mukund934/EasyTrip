const weatherService = require('./weatherService');
const logger = require('../utils/logger');

/**
 * The data half of `FV-031` — where each day's sunrise and sunset come from.
 *
 * `feasibilityService.checkDaylight` is a pure function that reads `day.sunrise` and `day.sunset`
 * and refuses to do anything without them. **This is the only thing that puts them there**, and it
 * lives outside the engine for the reason the engine's own header gives: the moment a network call
 * is inside the validator, the validator stops being something you can prove. So the impure part is
 * here, it is small, and it hands the engine plain data.
 *
 * ---------------------------------------------------------------------------
 * Four decisions, each of which could have gone the lazy way
 * ---------------------------------------------------------------------------
 *
 * **1. A day that cannot produce a finding is never looked up.** The rule only fires for an
 * `outdoor` item with a start time, so a day of museums and meals asks the provider nothing. That
 * is not only politeness toward somebody else's free tier — it means the common case (a catalogue
 * that is almost entirely `unknown`, because nobody has classified it yet) costs zero requests.
 *
 * **2. One coordinate per day: the day's first item that has any.** Sunrise moves about four
 * minutes per degree of longitude, so within a day's realistic travel the error is a few minutes on
 * a warning — recorded in `KNOWN_LIMITATIONS.md` rather than hidden. Deliberately *not* "the first
 * outdoor item": tying the choice to `setting` would mean re-classifying one place could silently
 * change which forecast a different day was judged against, and a finding you cannot reproduce from
 * the plan is a finding nobody can argue with.
 *
 * **3. Seven days is the horizon, and beyond it there is no reading.** Open-Meteo returns seven
 * days from today; a trip in three weeks matches no forecast entry, gets no sunrise, and therefore
 * gets no daylight finding at all. That silence is correct and it is also invisible, which is why
 * it is written down in three places rather than one. Extending it needs a different endpoint —
 * a provider decision (`EXTERNAL_APIS.md` §5), not a code one.
 *
 * **4. Nothing here may break the report.** Feasibility is useful with no weather at all: every
 * other check is arithmetic on the plan. So a provider outage, a timeout, or an outright throw
 * degrades to "no readings" and the caller still gets its overlaps, its travel times and its
 * backtracking. `getWeather` already promises never to throw; the guard is here because a promise
 * in a docstring is not a mechanism.
 */

const MS_PER_DAY = 86_400_000;

/**
 * `('2026-03-01', 2)` -> `'2026-03-03'`. `null` for anything that is not a calendar date.
 *
 * **Strict about the input on purpose.** `trips.start_date` is read as `YYYY-MM-DD` text by
 * `tripModel` precisely so no timezone gets to have an opinion about it (`BUG-050`); accepting a
 * `Date` here too would quietly paper over a regression in that query, and daylight would keep
 * working while every other consumer of the date went back to being a day out.
 */
const addDays = (isoDate, days) => {
  if (typeof isoDate !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(isoDate)) return null;
  const base = Date.parse(`${isoDate.slice(0, 10)}T00:00:00Z`);
  if (!Number.isFinite(base)) return null;
  return new Date(base + days * MS_PER_DAY).toISOString().slice(0, 10);
};

/** Whether any item on this day could possibly produce a daylight finding. */
const couldBeInTheDark = (day) =>
  (day?.items || []).some((item) => item.place_setting === 'outdoor' && item.start_time);

/**
 * The day's first item with coordinates, in the order the plan puts them.
 *
 * The workspace query already returns items ordered by position then id; sorting again here means
 * this does not depend on that, because "which coordinate did we ask about" is exactly the kind of
 * thing that must not change because a different query grew a different `ORDER BY`.
 */
const dayCoordinates = (day) => {
  const item = [...(day?.items || [])]
    .sort((a, b) => a.position - b.position || a.id - b.id)
    .find((candidate) => candidate.place_latitude != null && candidate.place_longitude != null);

  return item ? { latitude: item.place_latitude, longitude: item.place_longitude } : null;
};

/**
 * A copy of the trip whose days carry the sunrise and sunset that apply to them.
 *
 * Never mutates the trip it is given: the workspace object is what every other read returns, and a
 * function that quietly decorates its argument is how a field ends up in a response nobody meant to
 * change.
 *
 * @param {Object} trip - a `tripModel.getTripWorkspace` result
 * @returns {Promise<Object>} the same trip, with `sunrise`/`sunset`/`daylight_source` on any day
 *   that has a reading. A day with no reading is returned exactly as it arrived.
 */
const attachDaylight = async (trip) => {
  const days = trip?.days || [];
  if (!trip?.start_date || days.length === 0) return trip;

  const lookups = days.map(async (day) => {
    if (!couldBeInTheDark(day)) return day;

    const date = addDays(trip.start_date, day.day_number - 1);
    const at = dayCoordinates(day);
    if (!date || !at) return day;

    // Concurrent across days, and cheap: `weatherService` caches on coordinates rounded to ~1 km,
    // so a week in one region is one upstream request rather than seven. Open-Meteo's free tier
    // allows 600 calls/minute (`EXTERNAL_APIS.md` §3), which no single trip can approach.
    const weather = await weatherService.getWeather(at.latitude, at.longitude);
    const entry = weather?.forecast?.find((forecast) => forecast.date === date);
    if (!entry?.sunrise || !entry?.sunset) return day;

    return {
      ...day,
      sunrise: entry.sunrise,
      sunset: entry.sunset,
      // Carried through to the finding so a warning can attribute the data it rests on.
      // Open-Meteo is CC-BY 4.0, and attribution follows the data rather than the page it first
      // appeared on (`EXTERNAL_APIS.md` §3, and `IMP-127` for what skipping it costs).
      daylight_source: weather.source
    };
  });

  try {
    return { ...trip, days: await Promise.all(lookups) };
  } catch (error) {
    // Decision 4. The report is worth more than the enrichment, so this is a warn and a plain trip
    // rather than a 500 on a check that needs no weather to be useful.
    logger.warn({ name: error.name }, 'Daylight lookup failed; reporting without it');
    return trip;
  }
};

// Only `attachDaylight` is exported. The three helpers are deliberately private: they are proved
// through the endpoint, where an off-by-one in the date or the wrong coordinate is observable as a
// wrong finding, and exporting them would invite a unit test that agrees with them in isolation
// while the wiring stays broken — which is exactly the state this sprint found `FV-031` in.
module.exports = { attachDaylight };
