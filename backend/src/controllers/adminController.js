const { Pool } = require('pg');
const admin = require('firebase-admin');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

/**
 * Get all admins
 */
const getAllAdmins = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, firebase_uid, email, name, created_at, updated_at FROM users WHERE is_admin = true ORDER BY name'
    );
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error getting admins:', error);
    res.status(500).json({ message: 'Error getting admins' });
  }
};

/**
 * Add an admin
 */
const addAdmin = async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }
    
    // Check if user exists in Firebase
    let userRecord;
    try {
      userRecord = await admin.auth().getUserByEmail(email);
    } catch (error) {
      return res.status(404).json({ message: 'User not found in Firebase' });
    }
    
    // Check if user exists in our database
    const userResult = await pool.query(
      'SELECT * FROM users WHERE firebase_uid = $1',
      [userRecord.uid]
    );
    
    if (userResult.rows.length > 0) {
      // User exists, update admin status
      await pool.query(
        'UPDATE users SET is_admin = true, updated_at = NOW() WHERE firebase_uid = $1',
        [userRecord.uid]
      );
    } else {
      // User doesn't exist, add to database
      await pool.query(
        'INSERT INTO users (firebase_uid, email, name, is_admin, created_at, updated_at) VALUES ($1, $2, $3, true, NOW(), NOW())',
        [userRecord.uid, userRecord.email, userRecord.displayName || '']
      );
    }
    
    res.status(200).json({ message: `${email} is now an admin` });
  } catch (error) {
    console.error('Error adding admin:', error);
    res.status(500).json({ message: 'Error adding admin' });
  }
};

/**
 * Remove admin privileges
 */
const removeAdmin = async (req, res) => {
  try {
    const { email } = req.params;
    
    // Check if user exists in Firebase
    let userRecord;
    try {
      userRecord = await admin.auth().getUserByEmail(email);
    } catch (error) {
      return res.status(404).json({ message: 'User not found in Firebase' });
    }
    
    // Update user in database
    const result = await pool.query(
      'UPDATE users SET is_admin = false, updated_at = NOW() WHERE firebase_uid = $1 RETURNING id',
      [userRecord.uid]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found in database' });
    }
    
    res.status(200).json({ message: `${email} is no longer an admin` });
  } catch (error) {
    console.error('Error removing admin:', error);
    res.status(500).json({ message: 'Error removing admin' });
  }
};

module.exports = {
  getAllAdmins,
  addAdmin,
  removeAdmin,
};