const pool = require('../config/db');

/**
 * The trip workspace (`IMP-109` / `FV-006`, `ADR-031`).
 *
 * **Every function takes the caller's uid first, and none has a variant that does not.** Ownership
 * lives on `trips.user_id`; `trip_days` and `trip_items` carry no uid of their own and are reached
 * by joining up to the trip. That join *is* the authorization boundary — a handler-side check can
 * be forgotten by the next caller, a `WHERE trips.user_id = $1` cannot.
 *
 * The consequence worth stating: **there is no `getDay(id)` or `getItem(id)`.** Addressing a child
 * row by its own primary key without the trip in the query is one refactor away from reading
 * somebody else's itinerary, so the shape is never offered.
 */

/**
 * What a trip card in "My Trips" renders.
 *
 * **The dates are read as text on purpose, and this is a fix rather than a preference.** node-pg
 * parses a `DATE` into a JavaScript `Date` at the *server's* local midnight, so a trip starting
 * `2026-03-01` left this query as `Sun Mar 01 2026 00:00:00 GMT+0530` and reached the client, via
 * `JSON.stringify`, as `"2026-02-28T18:30:00.000Z"` — **the day before**. It is the *server's* zone
 * that decides this: east of UTC the local midnight lands on the previous UTC day, and both
 * consumers then read it back in UTC, so once it happens it is wrong for **every** viewer, not only
 * the ones sharing the server's zone. Two live defects came out of that one conversion
 * (`BUG-050`, `BUG-051`), and
 * both are the same mistake: a calendar date is not an instant, and giving it a time of day invents
 * a timezone question that the column never had an answer to.
 *
 * `to_char` rather than `::text` so the format does not depend on the session's `DateStyle`.
 */
const TRIP_COLUMNS = `
  trips.id, trips.title, trips.description,
  to_char(trips.start_date, 'YYYY-MM-DD') AS start_date,
  to_char(trips.end_date, 'YYYY-MM-DD') AS end_date,
  trips.status, trips.created_at, trips.updated_at`;

/**
 * Every trip this user owns, most recently touched first, with a cheap item count.
 *
 * The count comes from a correlated subquery rather than a `GROUP BY` over a two-level join: a trip
 * with three days and no items must report 0, and an inner join would drop it from the list
 * entirely. That is the classic "my empty trip disappeared" bug, and it is invisible until somebody
 * makes a trip and does not fill it in — which is exactly what a new user does.
 */
const listTrips = async (userId) => {
  const result = await pool.query(
    `SELECT ${TRIP_COLUMNS},
            (SELECT COUNT(*)::INT FROM trip_days WHERE trip_days.trip_id = trips.id) AS day_count,
            (SELECT COUNT(*)::INT
               FROM trip_items
               JOIN trip_days ON trip_days.id = trip_items.trip_day_id
              WHERE trip_days.trip_id = trips.id) AS item_count
     FROM trips
     WHERE trips.user_id = $1
     ORDER BY trips.updated_at DESC, trips.id DESC`,
    [userId]
  );

  return result.rows;
};

/** One trip, scoped to its owner. Returns null when it does not exist *or* is not theirs. */
const getTrip = async (userId, tripId) => {
  const result = await pool.query(
    `SELECT ${TRIP_COLUMNS} FROM trips WHERE trips.id = $1 AND trips.user_id = $2`,
    [tripId, userId]
  );

  return result.rows[0] || null;
};

/**
 * The whole workspace: the trip, its days in order, and each day's items in order.
 *
 * Two queries rather than one join, deliberately. A single join returns the trip's columns once per
 * item and needs regrouping in JavaScript; with days and items both variable-length, the regrouping
 * is where an off-by-one silently drops the last item of each day. Two ordered reads and an
 * index-by-day is boring and correct.
 */
const getTripWorkspace = async (userId, tripId) => {
  const trip = await getTrip(userId, tripId);
  if (!trip) return null;

  const days = await pool.query(
    `SELECT id, day_number, notes, created_at, updated_at
     FROM trip_days WHERE trip_id = $1 ORDER BY day_number`,
    [tripId]
  );

  // The items query joins back up to `trips` and re-checks the uid. Redundant, since `getTrip`
  // already proved ownership two lines up — and kept, because this is the query that would be
  // copied into a future endpoint where nothing had proved it.
  const items = await pool.query(
    `SELECT trip_items.id, trip_items.trip_day_id, trip_items.place_id, trip_items.item_type,
            trip_items.title, trip_items.notes, trip_items.start_time, trip_items.end_time,
            trip_items.position,
            places.name AS place_name, places.location AS place_location,
            places.primary_image_url AS place_image_url,
            places.latitude AS place_latitude, places.longitude AS place_longitude,
            places.setting AS place_setting
     FROM trip_items
     JOIN trip_days ON trip_days.id = trip_items.trip_day_id
     JOIN trips ON trips.id = trip_days.trip_id
     LEFT JOIN places ON places.id = trip_items.place_id
     WHERE trips.id = $1 AND trips.user_id = $2
     ORDER BY trip_days.day_number, trip_items.position, trip_items.id`,
    [tripId, userId]
  );

  // LEFT JOIN on places, because `place_id` is nullable by design (`ADR-031`): a meal or a note
  // never had a place, and an item whose place was deleted keeps its own title.
  const byDay = new Map(days.rows.map((day) => [day.id, { ...day, items: [] }]));
  for (const item of items.rows) {
    byDay.get(item.trip_day_id)?.items.push(item);
  }

  return { ...trip, days: [...byDay.values()] };
};

/**
 * Create a trip, and its days, in one transaction (`PE-011`).
 *
 * A trip whose days failed to insert is a trip the user has to delete and redo — so either the
 * whole thing lands or none of it does. `dayCount` is derived from the dates when both are given,
 * because a five-day trip with three day-slots is a workspace that lies about itself.
 */
const createTrip = async (userId, { title, description, start_date, end_date, status }) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const trip = await client.query(
      `INSERT INTO trips (user_id, title, description, start_date, end_date, status)
       VALUES ($1, $2, $3, $4, $5, COALESCE($6, 'draft'))
       RETURNING ${TRIP_COLUMNS.replace(/trips\./g, '')}`,
      [userId, title, description || null, start_date || null, end_date || null, status || null]
    );

    const created = trip.rows[0];
    const dayCount = spanInDays(created.start_date, created.end_date);

    for (let dayNumber = 1; dayNumber <= dayCount; dayNumber += 1) {
      await client.query('INSERT INTO trip_days (trip_id, day_number) VALUES ($1, $2)', [
        created.id,
        dayNumber
      ]);
    }

    await client.query('COMMIT');
    return created;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

/**
 * How many days a trip spans, inclusive of both ends.
 *
 * Computed from the parsed `DATE` values rather than by string arithmetic. A dateless trip gets one
 * day, so the workspace always has somewhere to put the first thing the user adds — an empty trip
 * with zero days has no drop target and reads as broken.
 */
const spanInDays = (startDate, endDate) => {
  if (!startDate || !endDate) return 1;
  const start = new Date(startDate);
  const end = new Date(endDate);
  const days = Math.round((end - start) / 86_400_000) + 1;
  return Math.min(Math.max(days, 1), 60); // 60 is the API's own ceiling, mirrored here
};

/** Columns a trip update may touch. Hard-coded, so a caller cannot name one that is not here. */
const UPDATABLE_TRIP_COLUMNS = ['title', 'description', 'start_date', 'end_date', 'status'];

/**
 * Patch a trip. Only the keys actually present are written.
 *
 * The same `in` test `placeModel.updatePlace` uses since `BUG-048`: `COALESCE($n, col)` cannot tell
 * "not provided" from "explicitly cleared", so clearing a description would silently do nothing.
 */
const updateTrip = async (userId, tripId, patch) => {
  const columns = UPDATABLE_TRIP_COLUMNS.filter((column) => column in patch);
  if (columns.length === 0) return getTrip(userId, tripId);

  const values = columns.map((column) => patch[column]);
  const assignments = columns.map((column, i) => `${column} = $${i + 1}`);

  const result = await pool.query(
    `UPDATE trips SET ${assignments.join(', ')}
     WHERE id = $${values.length + 1} AND user_id = $${values.length + 2}
     RETURNING ${TRIP_COLUMNS.replace(/trips\./g, '')}`,
    [...values, tripId, userId]
  );

  return result.rows[0] || null;
};

/** Delete a trip. The cascade takes its days and their items. */
const deleteTrip = async (userId, tripId) => {
  const result = await pool.query('DELETE FROM trips WHERE id = $1 AND user_id = $2', [
    tripId,
    userId
  ]);

  return result.rowCount > 0;
};

/** Append a day. `day_number` is derived, so two concurrent adds cannot both claim the same one. */
const addDay = async (userId, tripId) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // `FOR UPDATE` on the trip row serialises concurrent day-adds for this trip. Without it, two
    // requests both read max(day_number) = 3 and both try to insert 4; the UNIQUE constraint turns
    // the loser into a 500 rather than a second day.
    const owned = await client.query(
      'SELECT id FROM trips WHERE id = $1 AND user_id = $2 FOR UPDATE',
      [tripId, userId]
    );
    if (owned.rowCount === 0) {
      await client.query('ROLLBACK');
      return null;
    }

    const next = await client.query(
      'SELECT COALESCE(MAX(day_number), 0) + 1 AS day_number FROM trip_days WHERE trip_id = $1',
      [tripId]
    );

    const day = await client.query(
      `INSERT INTO trip_days (trip_id, day_number) VALUES ($1, $2)
       RETURNING id, day_number, notes, created_at, updated_at`,
      [tripId, next.rows[0].day_number]
    );

    await client.query('COMMIT');
    return day.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Remove a day, then close the gap it left.
 *
 * Renumbering is not cosmetic: `day_number` is the ordinal the UI labels ("Day 3") and the value
 * the calendar date is computed from. Leaving a hole would show a trip running Day 1, Day 2, Day 4
 * and put every later day on the wrong date.
 */
const deleteDay = async (userId, tripId, dayId) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const removed = await client.query(
      `DELETE FROM trip_days
       USING trips
       WHERE trip_days.id = $1
         AND trip_days.trip_id = trips.id
         AND trips.id = $2
         AND trips.user_id = $3
       RETURNING trip_days.day_number`,
      [dayId, tripId, userId]
    );

    if (removed.rowCount === 0) {
      await client.query('ROLLBACK');
      return false;
    }

    await client.query(
      'UPDATE trip_days SET day_number = day_number - 1 WHERE trip_id = $1 AND day_number > $2',
      [tripId, removed.rows[0].day_number]
    );

    await client.query('COMMIT');
    return true;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Add an item to a day.
 *
 * `title` is resolved from the place when one is given and no title was supplied — the item has to
 * carry its own label, because `ON DELETE SET NULL` will one day take the place away and leave the
 * row behind (`ADR-031`).
 */
const addItem = async (userId, tripId, dayId, item) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const day = await client.query(
      `SELECT trip_days.id FROM trip_days
       JOIN trips ON trips.id = trip_days.trip_id
       WHERE trip_days.id = $1 AND trips.id = $2 AND trips.user_id = $3`,
      [dayId, tripId, userId]
    );

    if (day.rowCount === 0) {
      await client.query('ROLLBACK');
      return null;
    }

    let title = item.title;
    if (!title && item.place_id) {
      const place = await client.query('SELECT name FROM places WHERE id = $1', [item.place_id]);
      // No row means the place does not exist; let the foreign key say so rather than inventing a
      // title for something that is about to fail.
      title = place.rows[0]?.name;
    }

    const position = await client.query(
      'SELECT COALESCE(MAX(position), -1) + 1 AS position FROM trip_items WHERE trip_day_id = $1',
      [dayId]
    );

    const created = await client.query(
      `INSERT INTO trip_items
         (trip_day_id, place_id, item_type, title, notes, start_time, end_time, position)
       VALUES ($1, $2, COALESCE($3, 'place'), $4, $5, $6, $7, $8)
       RETURNING id, trip_day_id, place_id, item_type, title, notes, start_time, end_time, position`,
      [
        dayId,
        item.place_id || null,
        item.item_type || null,
        title,
        item.notes || null,
        item.start_time || null,
        item.end_time || null,
        position.rows[0].position
      ]
    );

    await client.query('COMMIT');
    return created.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

const UPDATABLE_ITEM_COLUMNS = ['title', 'notes', 'start_time', 'end_time', 'item_type'];

/**
 * Patch an item, scoped through its day to its trip to its owner.
 *
 * **`trip_day_id` is handled separately from the other columns, and the reason is a security one.**
 * Every column in `UPDATABLE_ITEM_COLUMNS` is inert data — a title, a note, a time. `trip_day_id` is
 * a *reference*, and the `WHERE` clause below proves that the item's **current** day belongs to this
 * trip, which says nothing whatever about the day it is being moved to. Listing it alongside the
 * others would have let a caller move their own item into a stranger's trip by naming that trip's
 * day id: authorised on the way out, unauthorised on the way in.
 *
 * So the destination is joined and constrained — `destination.trip_id = trips.id` — against the trip
 * this caller has already been proven to own. A day id from anywhere else matches nothing, zero rows
 * update, and the caller gets the same 404 they would get for an item that does not exist.
 *
 * **Position is recomputed, not carried.** An item keeps its own position number when its day
 * changes, which would drop it into the middle of the destination day's order at whatever rank it
 * happened to hold. It is appended instead — the only placement that cannot displace something the
 * user put where they wanted it, and the same placement `replanService` *simulates* when it asks
 * `checkTrip` whether a proposed move is feasible. If the two disagreed, the validation would have
 * been answering a question about a different plan.
 *
 * Added Sprint 8.26. Before it, **nothing could move an item between days** — not the workspace UI,
 * not the API — which made `FV-027`'s proposals unappliable and this file's own claim that they went
 * through "the endpoint that already exists" untrue.
 */
const updateItem = async (userId, tripId, itemId, patch) => {
  const movingDay = 'trip_day_id' in patch;
  const columns = UPDATABLE_ITEM_COLUMNS.filter((column) => column in patch);
  if (columns.length === 0 && !movingDay) return null;

  const values = columns.map((column) => patch[column]);
  const assignments = columns.map((column, i) => `${column} = $${i + 1}`);

  if (movingDay) {
    assignments.push(
      'trip_day_id = destination.id',
      // The pre-update snapshot, so the item being moved is still counted on its old day and
      // cannot inflate the destination's maximum by one.
      `position = (SELECT COALESCE(MAX(existing.position), -1) + 1
                     FROM trip_items AS existing
                    WHERE existing.trip_day_id = destination.id)`
    );
  }

  const result = await pool.query(
    `UPDATE trip_items SET ${assignments.join(', ')}
     FROM trip_days, trips${movingDay ? ', trip_days AS destination' : ''}
     WHERE trip_items.id = $${values.length + 1}
       AND trip_items.trip_day_id = trip_days.id
       AND trip_days.trip_id = trips.id
       AND trips.id = $${values.length + 2}
       AND trips.user_id = $${values.length + 3}
       ${
         movingDay
           ? `AND destination.id = $${values.length + 4}
       AND destination.trip_id = trips.id`
           : ''
       }
     RETURNING trip_items.id, trip_items.trip_day_id, trip_items.place_id, trip_items.item_type,
               trip_items.title, trip_items.notes, trip_items.start_time, trip_items.end_time,
               trip_items.position`,
    movingDay
      ? [...values, itemId, tripId, userId, patch.trip_day_id]
      : [...values, itemId, tripId, userId]
  );

  return result.rows[0] || null;
};

/** Remove an item. */
const deleteItem = async (userId, tripId, itemId) => {
  const result = await pool.query(
    `DELETE FROM trip_items
     USING trip_days, trips
     WHERE trip_items.id = $1
       AND trip_items.trip_day_id = trip_days.id
       AND trip_days.trip_id = trips.id
       AND trips.id = $2
       AND trips.user_id = $3`,
    [itemId, tripId, userId]
  );

  return result.rowCount > 0;
};

/**
 * Move items into an explicit order within a day — the operation a drag-and-drop performs.
 *
 * Takes the **full** ordered list of item ids for that day and rewrites every position from it, in
 * one transaction. A "move item X to index 3" API would need the server to reconstruct the rest of
 * the order, which is the same information arriving less reliably.
 *
 * Every id is verified to belong to that day before anything is written: without it, including one
 * foreign id in the array would drag another user's item into this trip's ordering.
 */
const reorderItems = async (userId, tripId, dayId, orderedItemIds) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const owned = await client.query(
      `SELECT trip_items.id FROM trip_items
       JOIN trip_days ON trip_days.id = trip_items.trip_day_id
       JOIN trips ON trips.id = trip_days.trip_id
       WHERE trip_days.id = $1 AND trips.id = $2 AND trips.user_id = $3`,
      [dayId, tripId, userId]
    );

    const ownedIds = new Set(owned.rows.map((row) => row.id));

    // Every id must be one of this day's, and every one of this day's must be present. A partial
    // list would leave the omitted items at stale positions, silently interleaved with the new
    // order — worse than a rejection, because it looks like it worked.
    const requested = orderedItemIds.map(Number);
    const sameSize = requested.length === ownedIds.size;
    const allOwned = requested.every((id) => ownedIds.has(id));
    if (!sameSize || !allOwned || new Set(requested).size !== requested.length) {
      await client.query('ROLLBACK');
      return false;
    }

    for (const [position, itemId] of requested.entries()) {
      await client.query('UPDATE trip_items SET position = $1 WHERE id = $2', [position, itemId]);
    }

    await client.query('COMMIT');
    return true;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

module.exports = {
  listTrips,
  getTrip,
  getTripWorkspace,
  createTrip,
  updateTrip,
  deleteTrip,
  addDay,
  deleteDay,
  addItem,
  updateItem,
  deleteItem,
  reorderItems,
  spanInDays
};
