const db = require('../config/db');

/**
 * Add a new admin to the database
 * @param {String} email - Admin email
 * @returns {Promise<Object>} - Newly added admin
 */
const addAdmin = async (email) => {
  // Check if admin already exists
  const existingAdmin = await db.query(
    'SELECT * FROM admins WHERE email = $1',
    [email]
  );
  
  if (existingAdmin.rows.length > 0) {
    throw new Error('Admin already exists');
  }
  
  const result = await db.query(
    'INSERT INTO admins (email) VALUES ($1) RETURNING id, email, created_at',
    [email]
  );
  
  return result.rows[0];
};

/**
 * Get admin by email
 * @param {String} email - Admin email
 * @returns {Promise<Object>} - Admin object
 */
const getAdminByEmail = async (email) => {
  const result = await db.query(
    'SELECT id, email, created_at FROM admins WHERE email = $1',
    [email]
  );
  
  return result.rows[0] || null;
};

/**
 * Remove admin from the database
 * @param {String} email - Admin email
 * @returns {Promise<Boolean>} - Success status
 */
const removeAdmin = async (email) => {
  const result = await db.query(
    'DELETE FROM admins WHERE email = $1 RETURNING id',
    [email]
  );
  
  return result.rows.length > 0;
};

/**
 * Get all admins
 * @returns {Promise<Array>} - List of all admins
 */
const getAllAdmins = async () => {
  const result = await db.query(
    'SELECT id, email, created_at FROM admins ORDER BY created_at DESC'
  );
  
  return result.rows;
};

module.exports = {
  addAdmin,
  getAdminByEmail,
  removeAdmin,
  getAllAdmins,
};