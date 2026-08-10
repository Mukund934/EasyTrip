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
// List reads (IMP-038 / IMP-046)
// ---------------------------------------------------------------------------

// The season filter matches the free-text "Best Time to Visit" entry in custom_keys, which is
// the only seasonal data places actually carry. This used to have a hand-maintained twin in
// browse.jsx's client-side filter; that copy is gone (IMP-046), so this is now the only
// definition of what "summer" means and there is nothing left to keep in sync.
const SEASON_MONTHS = {
  summer: 'april|may|june',
  monsoon: 'july|august|september',
  winter: 'october|november|december|january|february|march'
};

//
// `getAllPlaces` and `searchPlaces` were two copies of the same query — same projection, same
// LATERAL join, same ORDER BY — differing only in whether a WHERE clause was appended. They are
// one function now, because keeping them apart is how the projection drifted out of sync twice
// already, and because pagination has to behave identically on both.

// The list projection is what a card actually renders. `locality`, `pin_code`, `created_by` and
// `updated_by` are read by no list consumer (grep across frontend/src), so they are not shipped;
// `getPlaceById` still returns them for the detail page. `description` and `custom_keys` stay
// because PlaceCard renders a snippet and the detail chips from them.
const LIST_COLUMNS = `
  places.id, places.name, places.location, places.description, places.district, places.state,
  places.latitude, places.longitude, places.primary_image_url, places.themes, places.tags,
  places.custom_keys, places.rating_count, places.rating_sum, places.created_at, places.updated_at`;

// Markers need a pin, a label and a popup — nothing else. Dropping `description`, `tags` and
// `custom_keys` is what makes "every place with coordinates" an affordable request even though
// the grid beside it is paginated.
const MAP_COLUMNS = `
  places.id, places.name, places.location, places.district, places.state,
  places.latitude, places.longitude, places.primary_image_url, places.themes,
  places.rating_count, places.rating_sum`;

const RATING_EXPR = `
  CASE
    WHEN places.rating_count > 0 THEN ROUND(places.rating_sum::NUMERIC / places.rating_count, 1)
    ELSE NULL
  END AS average_rating`;

// Resolving the gallery fallback here rather than in a follow-up request is IMP-037; with an
// index-ordered scan feeding a LIMIT, the lateral only runs for the rows actually returned.
const FIRST_IMAGE_JOIN = `
  LEFT JOIN LATERAL (
    SELECT pi.image_url
    FROM place_images pi
    WHERE pi.place_id = places.id
    ORDER BY pi.display_order, pi.created_at
    LIMIT 1
  ) first_image ON TRUE`;

// Sorting moved to the server with pagination, and had to: a client that holds one page cannot
// sort the catalogue, it can only reorder the page it happens to have — which looks like sorting
// and is not. This whitelist is also the injection boundary; `sort` is never interpolated raw.
//
// Every entry ends in `places.id` so the order is total. Without a tiebreaker, rows sharing a
// sort key can be returned in a different relative order per query, which makes OFFSET pagination
// silently duplicate one row and skip another.
const SORT_ORDERS = {
  newest: 'places.created_at DESC, places.id DESC',
  oldest: 'places.created_at ASC, places.id ASC',
  rating: 'average_rating DESC NULLS LAST, places.rating_count DESC, places.id DESC',
  popular: 'places.rating_count DESC, average_rating DESC NULLS LAST, places.id DESC',
  name: 'places.name ASC, places.id ASC'
};

const DEFAULT_LIMIT = 24;
const MAX_LIMIT = 100;

/**
 * Build the shared WHERE clause. Returns the SQL fragment and its bound parameters so the
 * count query and the page query stay provably in step — they cannot filter differently.
 */
const buildFilters = (criteria = {}) => {
  const { searchTerm, location, district, state, tags, themes, minRating, date } = criteria;
  const params = [];
  let where = ' WHERE 1=1';

  if (searchTerm) {
    params.push(`%${searchTerm}%`);
    where += ` AND (places.name ILIKE $${params.length} OR places.description ILIKE $${params.length})`;
  }

  if (location) {
    params.push(`%${location}%`);
    where += ` AND places.location ILIKE $${params.length}`;
  }

  if (district) {
    params.push(`%${district}%`);
    where += ` AND places.district ILIKE $${params.length}`;
  }

  if (state) {
    params.push(`%${state}%`);
    where += ` AND places.state ILIKE $${params.length}`;
  }

  if (tags && tags.length > 0) {
    params.push(tags);
    where += ` AND places.tags && $${params.length}`;
  }

  if (themes && themes.length > 0) {
    params.push(themes);
    where += ` AND places.themes && $${params.length}`;
  }

  if (minRating > 0) {
    params.push(minRating);
    where +=
      ` AND places.rating_count > 0` +
      ` AND (places.rating_sum::NUMERIC / places.rating_count) >= $${params.length}`;
  }

  const seasonPattern = SEASON_MONTHS[date];
  if (seasonPattern) {
    params.push(seasonPattern);
    // A place with no recorded best time is kept rather than hidden: the filter narrows the
    // list, it does not exclude everything that has not been annotated yet.
    where +=
      ` AND (places.custom_keys->>'Best Time to Visit' IS NULL` +
      ` OR lower(places.custom_keys->>'Best Time to Visit') ~ $${params.length})`;
  }

  return { where, params };
};

const clampLimit = (value) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return DEFAULT_LIMIT;
  return Math.min(parsed, MAX_LIMIT);
};

const clampOffset = (value) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

/**
 * One paginated read for every place list in the product.
 *
 * Returns `{ rows, total }`. The total comes from a second query rather than
 * `COUNT(*) OVER()`, deliberately: a window function is computed over the whole filtered set
 * *before* LIMIT applies, so it would force the LATERAL join and the wide projection to run for
 * every matching row and cancel most of what the LIMIT bought. The count query skips the join and
 * selects no columns at all, and the two run concurrently, so the page costs one round trip of
 * latency rather than two.
 *
 * `projection: 'map'` returns every match with no limit. That is safe only because the map
 * projection is a handful of scalars per row; do not widen it without revisiting this.
 *
 * `withStats` swaps the plain count for one that also returns the aggregates browse displays.
 * Those used to be derived in the browser from the full dataset — which pagination takes away,
 * and averaging the twelve rows of page one under a label reading "Average Rating" would be a
 * wrong number rather than a slower one. It is opt-in because only browse's first request needs
 * it; load-more and the map skip the extra grouping.
 */
const listPlaces = async ({
  filters = {},
  sort = 'newest',
  limit,
  offset,
  projection = 'list',
  withStats = false
} = {}) => {
  const { where, params } = buildFilters(filters);
  const orderBy = SORT_ORDERS[sort] || SORT_ORDERS.newest;
  const isMap = projection === 'map';
  const columns = isMap ? MAP_COLUMNS : LIST_COLUMNS;

  const safeLimit = isMap ? null : clampLimit(limit);
  const safeOffset = isMap ? 0 : clampOffset(offset);

  let pageSql = `SELECT ${columns}, ${RATING_EXPR}, first_image.image_url AS fallback_image_url
     FROM places${FIRST_IMAGE_JOIN}${where}
     ORDER BY ${orderBy}`;

  const pageParams = [...params];
  if (safeLimit !== null) {
    pageParams.push(safeLimit, safeOffset);
    pageSql += ` LIMIT $${pageParams.length - 1} OFFSET $${pageParams.length}`;
  }

  // Catalogue statistics, deliberately *unfiltered*.
  //
  // The browse sidebar shows "Total Places" beside "Filtered Results", and the hero shows
  // headline figures for the site. Both describe the catalogue, not the current query — scoping
  // these to the filter would make the two numbers in that pair identical and turn the headline
  // into a restatement of the result count. `pagination.total` is the filtered number.
  //
  // Aggregates are grouped into one statement so a single scan answers all four. The outer SELECT
  // has no FROM, so each scalar subquery contributes one value and an empty table still returns a
  // row — selecting `FROM top_location` directly would return no rows at all on an empty
  // catalogue, losing the count along with the statistics.
  const statsSql = `
    WITH top_location AS (
      SELECT location, COUNT(*)::int AS place_count
      FROM places
      WHERE location IS NOT NULL
      GROUP BY location
      ORDER BY COUNT(*) DESC, location
      LIMIT 1
    )
    SELECT
      (SELECT COUNT(*)::int FROM places) AS catalogue_total,
      (SELECT ROUND(AVG(rating_sum::NUMERIC / rating_count), 1)
         FROM places WHERE rating_count > 0) AS avg_rating,
      (SELECT location FROM top_location) AS top_location,
      COALESCE((SELECT place_count FROM top_location), 0) AS top_location_count`;

  const queries = [
    pool.query(pageSql, pageParams),
    pool.query(`SELECT COUNT(*)::int AS total FROM places${where}`, params)
  ];
  // Catalogue stats take no parameters, so they cannot share the count query; run them alongside
  // rather than after, and only when a caller asked.
  if (withStats) queries.push(pool.query(statsSql));

  const [page, count, summary] = await Promise.all(queries);
  const stats = summary?.rows[0];

  return {
    rows: page.rows,
    total: count.rows[0]?.total ?? 0,
    limit: safeLimit ?? page.rows.length,
    offset: safeOffset,
    stats: stats
      ? {
          total: stats.catalogue_total ?? 0,
          // NUMERIC arrives from pg as a string; the client renders this value directly.
          avgRating: stats.avg_rating === null ? null : Number(stats.avg_rating),
          topLocation: stats.top_location ?? null,
          topLocationCount: stats.top_location_count ?? 0
        }
      : null
  };
};

const updatePlace = async (id, placeData) => {
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
    updated_by
  } = placeData;

  const result = await pool.query(
    `UPDATE places
    SET
      name = COALESCE($1, name),
      description = COALESCE($2, description),
      location = COALESCE($3, location),
      district = COALESCE($4, district),
      state = COALESCE($5, state),
      locality = COALESCE($6, locality),
      pin_code = COALESCE($7, pin_code),
      latitude = COALESCE($8, latitude),
      longitude = COALESCE($9, longitude),
      primary_image_url = COALESCE($10, primary_image_url),
      themes = COALESCE($11, themes),
      tags = COALESCE($12, tags),
      custom_keys = COALESCE($13, custom_keys),
      updated_by = $14,
      updated_at = NOW()
    WHERE id = $15
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
      themes,
      tags,
      custom_keys,
      updated_by,
      id
    ]
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
  listPlaces,
  DEFAULT_LIMIT,
  MAX_LIMIT,
  SORT_ORDERS,
  updatePlace,
  deletePlace,
  getUniqueLocations,
  getUniqueDistricts,
  getUniqueStates,
  getUniqueTags
};
