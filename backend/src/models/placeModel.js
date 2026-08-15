const pool = require('../config/db');
const createPlace = async (placeData) => {
  const {
    name,
    description,
    location,
    district,
    state,
    locality,
    pin_code,
    latitude,
    longitude,
    primary_image_url,
    themes,
    tags,
    custom_keys,
    created_by,
    updated_by
  } = placeData;

  const result = await pool.query(
    `INSERT INTO places (
      name, description, location, district, state, locality, pin_code,
      latitude, longitude, primary_image_url, themes, tags, custom_keys,
      created_by, updated_by, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW(), NOW())
    RETURNING *`,
    [
      name,
      description,
      location,
      district,
      state,
      locality,
      pin_code,
      latitude,
      longitude,
      primary_image_url,
      themes || '{}',
      tags || '{}',
      custom_keys || '{}',
      created_by,
      updated_by
    ]
  );
  return result.rows[0];
};

const getPlaceById = async (id) => {
  const result = await pool.query(
    // `created_by` and `updated_by` are deliberately NOT selected. They hold raw Firebase UIDs of
    // the admins who curated the place, and this endpoint is public: Next serialises the whole
    // payload into `__NEXT_DATA__`, so every anonymous visitor to a place page received a
    // privileged account's stable identifier. Nothing consumed it — `PlaceCard` and
    // `MagazineDetails` both list these keys in their *exclusion* filters, and the list projection
    // already omitted them — so the exposure bought nothing.
    //
    // This is the same rule `IMP-021` applies to review authors, and it applies at least as
    // strongly to an admin. The columns remain on the table as audit data; they are simply not
    // public. Found by the E2E suite (IMP-094), which asserts against the delivered HTML rather
    // than the JSON and so could see what an API-level assertion could not.
    `SELECT id, name, location, description, district, state, locality, pin_code,
           latitude, longitude, primary_image_url, themes, tags, custom_keys,
           rating_count, rating_sum, created_at, updated_at,
      CASE
        WHEN rating_count > 0 THEN ROUND(rating_sum::NUMERIC / rating_count, 1)
        ELSE NULL
      END AS average_rating,
      first_image.image_url AS fallback_image_url
    FROM places
    LEFT JOIN LATERAL (
      SELECT pi.image_url
      FROM place_images pi
      WHERE pi.place_id = places.id
      ORDER BY pi.display_order, pi.created_at
      LIMIT 1
    ) first_image ON TRUE
    WHERE places.id = $1`,
    [id]
  );
  return result.rows[0] || null;
};

// ---------------------------------------------------------------------------
// List reads live in placeListModel.js (Sprint 7.6)
// ---------------------------------------------------------------------------
// Filtering, sorting, pagination and the typeahead moved out when IMP-112 pushed this file past
// the 500-line criterion. They are re-exported at the bottom, so `placeController` keeps a single
// import and the module's public surface is unchanged.
const listModel = require('./placeListModel');

/**
 * The columns a caller may update, as a hard-coded allowlist.
 *
 * The SET clause below is assembled at runtime, so this list is the only thing that ever becomes a
 * column name. Nothing derived from a request reaches the SQL text — request data is exclusively
 * parameterised — and a key that is not on this list is ignored rather than interpolated.
 */
const UPDATABLE_COLUMNS = [
  'name',
  'description',
  'location',
  'district',
  'state',
  'locality',
  'pin_code',
  'latitude',
  'longitude',
  'primary_image_url',
  'themes',
  'tags',
  'custom_keys',
  'updated_by'
];

/**
 * Update a place, writing exactly the columns the caller provided.
 *
 * **Why presence rather than `COALESCE` (`BUG-048`).** This used to write every column as
 * `COALESCE($n, column)`, which makes `null` mean *keep*. That reads as a sensible sparse-update
 * idiom, and it worked for the one caller that relies on sparseness — `placeController.js:193`
 * updates only `primary_image_url` after a create-with-image. It also made two things impossible:
 *
 * 1. **A coordinate could never be removed.** `updatePlace` in the controller computes `null`
 *    deliberately for a cleared latitude or longitude — the validator even skips `toFloat()` so a
 *    sanitised `0` cannot read as absent — and `COALESCE` discarded it every time. The controller's
 *    clearing branch was unreachable, and an admin who pinned a place wrongly could only overwrite
 *    the coordinates, never remove them.
 * 2. **The sparse caller silently wiped `updated_by`.** It was the one column written
 *    unconditionally (`updated_by = $14`), so a call that omitted it passed `undefined`, which
 *    node-pg sends as NULL. A place created *with* a photo lost its audit attribution immediately
 *    after creation; one created without kept it. `IMP-002` exists to make those columns mean
 *    something.
 *
 * Keying on **presence** (`in`) rather than value separates the two cases the old shape conflated:
 * an absent key means "leave it alone", and an explicit `null` means "clear it". Both callers get
 * what they already meant, and neither had to change.
 */
const updatePlace = async (id, placeData) => {
  const columns = UPDATABLE_COLUMNS.filter((column) => column in placeData);
  const values = columns.map((column) => placeData[column]);

  // `updated_at` is the server's to set, never the caller's, so it is appended rather than bound.
  const assignments = [
    ...columns.map((column, i) => `${column} = $${i + 1}`),
    'updated_at = NOW()'
  ];

  const result = await pool.query(
    `UPDATE places SET ${assignments.join(', ')} WHERE id = $${values.length + 1} RETURNING *`,
    [...values, id]
  );
  return result.rows[0];
};

const deletePlace = async (id) => {
  const result = await pool.query('DELETE FROM places WHERE id = $1 RETURNING id', [id]);
  return result.rows.length > 0;
};

const getUniqueLocations = async () => {
  const result = await pool.query(
    'SELECT DISTINCT location FROM places WHERE location IS NOT NULL ORDER BY location'
  );
  return result.rows.map((row) => row.location).filter(Boolean);
};

const getUniqueDistricts = async () => {
  const result = await pool.query(
    'SELECT DISTINCT district FROM places WHERE district IS NOT NULL ORDER BY district'
  );
  return result.rows.map((row) => row.district).filter(Boolean);
};

const getUniqueStates = async () => {
  const result = await pool.query(
    'SELECT DISTINCT state FROM places WHERE state IS NOT NULL ORDER BY state'
  );
  return result.rows.map((row) => row.state).filter(Boolean);
};

const getUniqueTags = async () => {
  const result = await pool.query(`
    SELECT DISTINCT unnest(tags) AS tag
    FROM places
    WHERE tags IS NOT NULL
    ORDER BY tag
  `);
  return result.rows.map((row) => row.tag).filter(Boolean);
};

module.exports = {
  createPlace,
  getPlaceById,
  updatePlace,
  deletePlace,
  getUniqueLocations,
  getUniqueDistricts,
  getUniqueStates,
  getUniqueTags,
  // Re-exported from placeListModel — see the note above.
  ...listModel
};
