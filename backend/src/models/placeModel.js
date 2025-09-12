const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const createPlace = async (placeData) => {
  const {
    name, description, location, district, state, locality, pin_code,
    latitude, longitude, primary_image_url, themes, tags, custom_keys,
    created_by, updated_by
  } = placeData;

  const result = await pool.query(
    `INSERT INTO places (
      name, description, location, district, state, locality, pin_code,
      latitude, longitude, primary_image_url, themes, tags, custom_keys,
      created_by, updated_by, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW(), NOW())
    RETURNING *`,
    [
      name, description, location, district, state, locality, pin_code,
      latitude, longitude, primary_image_url, themes || '{}', tags || '{}', 
      custom_keys || '{}', created_by, updated_by
    ]
  );
  return result.rows[0];
};

const getPlaceById = async (id) => {
  const result = await pool.query(
    `SELECT *,
      CASE
        WHEN rating_count > 0 THEN ROUND(rating_sum::NUMERIC / rating_count, 1)
        ELSE NULL
      END AS average_rating
    FROM places WHERE id = $1`,
    [id]
  );
  return result.rows[0] || null;
};

const getAllPlaces = async () => {
  const result = await pool.query(
    `SELECT id, name, location, description, district, state, locality, pin_code,
           latitude, longitude, primary_image_url, themes, tags, custom_keys,
           rating_count, rating_sum, created_at, updated_at, created_by, updated_by,
           CASE
             WHEN rating_count > 0 THEN ROUND(rating_sum::NUMERIC / rating_count, 1)
             ELSE NULL
           END AS average_rating
    FROM places
    ORDER BY created_at DESC`
  );
  return result.rows;
};

const updatePlace = async (id, placeData) => {
  const {
    name, description, location, district, state, locality, pin_code,
    latitude, longitude, primary_image_url, themes, tags, custom_keys, updated_by
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
      name, description, location, district, state, locality, pin_code,
      latitude, longitude, primary_image_url, themes, tags, custom_keys,
      updated_by, id
    ]
  );
  return result.rows[0];
};

const deletePlace = async (id) => {
  const result = await pool.query('DELETE FROM places WHERE id = $1 RETURNING id', [id]);
  return result.rows.length > 0;
};

const searchPlaces = async (criteria) => {
  const { searchTerm, location, district, state, tags } = criteria;
  let query = `
    SELECT *,
      CASE
        WHEN rating_count > 0 THEN ROUND(rating_sum::NUMERIC / rating_count, 1)
        ELSE NULL
      END AS average_rating
    FROM places WHERE 1=1
  `;
  const params = [];

  if (searchTerm) {
    params.push(`%${searchTerm}%`);
    query += ` AND (name ILIKE $${params.length} OR description ILIKE $${params.length})`;
  }

  if (location) {
    params.push(`%${location}%`);
    query += ` AND location ILIKE $${params.length}`;
  }

  if (district) {
    params.push(`%${district}%`);
    query += ` AND district ILIKE $${params.length}`;
  }

  if (state) {
    params.push(`%${state}%`);
    query += ` AND state ILIKE $${params.length}`;
  }

  if (tags && tags.length > 0) {
    params.push(tags);
    query += ` AND tags && $${params.length}`;
  }

  query += ' ORDER BY created_at DESC';

  const result = await pool.query(query, params);
  return result.rows;
};

const getUniqueLocations = async () => {
  const result = await pool.query('SELECT DISTINCT location FROM places WHERE location IS NOT NULL ORDER BY location');
  return result.rows.map(row => row.location).filter(Boolean);
};

const getUniqueDistricts = async () => {
  const result = await pool.query('SELECT DISTINCT district FROM places WHERE district IS NOT NULL ORDER BY district');
  return result.rows.map(row => row.district).filter(Boolean);
};

const getUniqueStates = async () => {
  const result = await pool.query('SELECT DISTINCT state FROM places WHERE state IS NOT NULL ORDER BY state');
  return result.rows.map(row => row.state).filter(Boolean);
};

const getUniqueTags = async () => {
  const result = await pool.query(`
    SELECT DISTINCT unnest(tags) AS tag
    FROM places
    WHERE tags IS NOT NULL
    ORDER BY tag
  `);
  return result.rows.map(row => row.tag).filter(Boolean);
};

module.exports = {
  createPlace,
  getPlaceById,
  getAllPlaces,
  updatePlace,
  deletePlace,
  searchPlaces,
  getUniqueLocations,
  getUniqueDistricts,
  getUniqueStates,
  getUniqueTags
};