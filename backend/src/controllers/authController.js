const { Pool } = require('pg');
const admin = require('firebase-admin');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

/**
 * Get current user profile
 */
const getProfile = async (req, res) => {
  try {
    const { uid } = req.user;
    const currentTime = '2025-08-23 20:09:05';
    const currentUser = req.headers['x-user'] || 'dharmendra23101';
    
    console.log(`Profile requested by ${currentUser} at ${currentTime} for UID: ${uid}`);
    
    // Get user from database
    const result = await pool.query(
      'SELECT id, firebase_uid, email, name, is_admin, created_at, updated_at FROM users WHERE firebase_uid = $1',
      [uid]
    );
    
    if (result.rows.length === 0) {
      // User not in database yet, get from Firebase
      const userRecord = await admin.auth().getUser(uid);
      
      // Create user in database
      const newUser = await pool.query(
        'INSERT INTO users (firebase_uid, email, name, is_admin, created_at, updated_at) VALUES ($1, $2, $3, false, $4, $4) RETURNING id, firebase_uid, email, name, is_admin, created_at, updated_at',
        [userRecord.uid, userRecord.email, userRecord.displayName || '', currentTime]
      );
      
      // Add last login time and requesting user for audit purposes
      const userData = {
        ...newUser.rows[0],
        last_login: currentTime,
        accessed_by: currentUser
      };
      
      console.log(`New user created in database: ${userRecord.email}`);
      return res.status(200).json(userData);
    }
    
    // Add last login time and requesting user for audit purposes
    const userData = {
      ...result.rows[0],
      last_login: currentTime,
      accessed_by: currentUser
    };
    
    // Log access to user profile
    await pool.query(
      'INSERT INTO audit_logs (user_id, action, details, performed_by, timestamp) VALUES ($1, $2, $3, $4, $5)',
      [result.rows[0].id, 'profile_access', `Profile accessed by ${currentUser}`, currentUser, currentTime]
    ).catch(err => console.error('Error logging audit:', err));
    
    res.status(200).json(userData);
  } catch (error) {
    console.error('Error getting profile:', error);
    res.status(500).json({ message: 'Error getting profile' });
  }
};

/**
 * Update user profile
 */
const updateProfile = async (req, res) => {
  try {
    const { uid } = req.user;
    const { name } = req.body;
    const currentTime = '2025-08-23 20:09:05';
    const currentUser = req.headers['x-user'] || 'dharmendra23101';
    
    console.log(`Profile update requested by ${currentUser} at ${currentTime} for UID: ${uid}`);
    
    // Update in database
    const result = await pool.query(
      'UPDATE users SET name = $1, updated_at = $2 WHERE firebase_uid = $3 RETURNING id, firebase_uid, email, name, is_admin, created_at, updated_at',
      [name, currentTime, uid]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Add audit data
    const userData = {
      ...result.rows[0],
      last_updated: currentTime,
      updated_by: currentUser
    };
    
    // Log profile update
    await pool.query(
      'INSERT INTO audit_logs (user_id, action, details, performed_by, timestamp) VALUES ($1, $2, $3, $4, $5)',
      [result.rows[0].id, 'profile_update', `Profile updated by ${currentUser}`, currentUser, currentTime]
    ).catch(err => console.error('Error logging audit:', err));
    
    console.log(`Profile updated successfully for ${result.rows[0].email}`);
    res.status(200).json(userData);
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ message: 'Error updating profile' });
  }
};

/**
 * Check if current user is an admin
 */
const checkAdmin = async (req, res) => {
  try {
    const { uid } = req.user;
    const currentTime = '2025-08-23 20:09:05';
    const currentUser = req.headers['x-user'] || 'dharmendra23101';
    
    console.log(`Admin check requested by ${currentUser} at ${currentTime} for UID: ${uid}`);
    
    // Check database
    const result = await pool.query(
      'SELECT id, is_admin FROM users WHERE firebase_uid = $1',
      [uid]
    );
    
    if (result.rows.length === 0) {
      console.log(`User with UID ${uid} not found in database, returning non-admin status`);
      return res.status(200).json({ isAdmin: false });
    }
    
    const isAdmin = result.rows[0].is_admin;
    
    // Log admin check for audit purposes
    await pool.query(
      'INSERT INTO audit_logs (user_id, action, details, performed_by, timestamp) VALUES ($1, $2, $3, $4, $5)',
      [result.rows[0].id, 'admin_check', `Admin status checked (result: ${isAdmin})`, currentUser, currentTime]
    ).catch(err => console.error('Error logging audit:', err));
    
    console.log(`Admin check for ${uid}: ${isAdmin ? 'Is admin' : 'Not admin'}`);
    res.status(200).json({ 
      isAdmin: isAdmin,
      checked_at: currentTime,
      checked_by: currentUser 
    });
  } catch (error) {
    console.error('Error checking admin status:', error);
    res.status(500).json({ message: 'Error checking admin status' });
  }
};

/**
 * Admin activity log
 */
const logAdminActivity = async (req, res) => {
  try {
    const { uid } = req.user;
    const { action, details } = req.body;
    const currentTime = '2025-08-23 20:09:05';
    const currentUser = req.headers['x-user'] || 'dharmendra23101';
    
    // Verify user is admin
    const userResult = await pool.query(
      'SELECT id, is_admin FROM users WHERE firebase_uid = $1',
      [uid]
    );
    
    if (userResult.rows.length === 0 || !userResult.rows[0].is_admin) {
      return res.status(403).json({ message: 'Unauthorized: Admin access required' });
    }
    
    // Log admin activity
    await pool.query(
      'INSERT INTO admin_logs (user_id, action, details, timestamp) VALUES ($1, $2, $3, $4)',
      [userResult.rows[0].id, action, details, currentTime]
    );
    
    console.log(`Admin activity logged for ${currentUser}: ${action}`);
    res.status(200).json({ 
      success: true,
      logged_at: currentTime,
      action: action
    });
  } catch (error) {
    console.error('Error logging admin activity:', error);
    res.status(500).json({ message: 'Error logging admin activity' });
  }
};

module.exports = {
  getProfile,
  updateProfile,
  checkAdmin,
  logAdminActivity
};