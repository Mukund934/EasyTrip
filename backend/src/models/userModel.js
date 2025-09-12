const db = require('../config/db');

/**
 * Create a new user in the database
 * @param {Object} userData - User data
 * @returns {Promise<Object>} - Newly created user
 */
const createUser = async (userData) => {
  const { firebase_uid, email, name } = userData;
  
  const result = await db.query(
    `INSERT INTO users (firebase_uid, email, name) 
     VALUES ($1, $2, $3) 
     RETURNING id, firebase_uid, email, name, created_at`,
    [firebase_uid, email, name]
  );
  
  return result.rows[0];
};

/**
 * Get user by Firebase UID
 * @param {String} firebase_uid - Firebase UID
 * @returns {Promise<Object>} - User object
 */
const getUserByFirebaseUid = async (firebase_uid) => {
  const result = await db.query(
    'SELECT id, firebase_uid, email, name, location, dob, created_at FROM users WHERE firebase_uid = $1',
    [firebase_uid]
  );
  
  return result.rows[0] || null;
};

/**
 * Update user profile
 * @param {String} firebase_uid - Firebase UID
 * @param {Object} userData - User data to update
 * @returns {Promise<Object>} - Updated user
 */
const updateUser = async (firebase_uid, userData) => {
  const { name, location, dob } = userData;
  
  const result = await db.query(
    `UPDATE users 
     SET name = COALESCE($1, name), 
         location = COALESCE($2, location), 
         dob = COALESCE($3, dob),
         updated_at = NOW() 
     WHERE firebase_uid = $4 
     RETURNING id, firebase_uid, email, name, location, dob, created_at, updated_at`,
    [name, location, dob, firebase_uid]
  );
  
  return result.rows[0];
};

module.exports = {
  createUser,
  getUserByFirebaseUid,
  updateUser,
};