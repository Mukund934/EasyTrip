const { Pool } = require('pg');
const admin = require('firebase-admin');
const { resolveAdminStatus } = require('../utils/authMiddleware');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

/**
 * Get current user profile
 */
const getProfile = async (req, res) => {
  try {
    const { uid } = req.user;

    console.log(`Profile requested for UID: ${uid}`);

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
        'INSERT INTO users (firebase_uid, email, name, is_admin, created_at, updated_at) VALUES ($1, $2, $3, false, NOW(), NOW()) RETURNING id, firebase_uid, email, name, is_admin, created_at, updated_at',
        [userRecord.uid, userRecord.email, userRecord.displayName || '']
      );

      // Add last login time and requesting user for audit purposes
      const userData = {
        ...newUser.rows[0],
        last_login: new Date().toISOString(),
        accessed_by: uid
      };
      
      console.log(`New user created in database: ${userRecord.email}`);
      return res.status(200).json(userData);
    }
    
    // Add last login time and requesting user for audit purposes
    const userData = {
      ...result.rows[0],
      last_login: new Date().toISOString(),
      accessed_by: uid
    };

    // Log access to user profile
    await pool.query(
      'INSERT INTO audit_logs (user_id, action, details, performed_by, timestamp) VALUES ($1, $2, $3, $4, NOW())',
      [result.rows[0].id, 'profile_access', `Profile accessed by ${uid}`, uid]
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

    console.log(`Profile update requested for UID: ${uid}`);

    // Update in database
    const result = await pool.query(
      'UPDATE users SET name = $1, updated_at = NOW() WHERE firebase_uid = $2 RETURNING id, firebase_uid, email, name, is_admin, created_at, updated_at',
      [name, uid]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Add audit data
    const userData = {
      ...result.rows[0],
      last_updated: result.rows[0].updated_at,
      updated_by: uid
    };

    // Log profile update
    await pool.query(
      'INSERT INTO audit_logs (user_id, action, details, performed_by, timestamp) VALUES ($1, $2, $3, $4, NOW())',
      [result.rows[0].id, 'profile_update', `Profile updated by ${uid}`, uid]
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

    console.log(`Admin check requested for UID: ${uid}`);

    // This endpoint is the sole authority behind the four /admin/* server-side page
    // gates, so it must answer exactly as the isAdmin API gate would — same DB column,
    // same claim cross-check. resolveAdminStatus is that shared rule; the route is
    // mounted behind isAuthenticatedStrict so revocation is checked here too.
    // Without both, a revoked or de-admined user is served admin HTML and then 403s on
    // every call the page makes.
    const { isAdmin, user } = await resolveAdminStatus(req.decodedToken);

    if (!user) {
      console.log(`User with UID ${uid} not found in database, returning non-admin status`);
      return res.status(200).json({ isAdmin: false });
    }

    // Log admin check for audit purposes
    await pool.query(
      'INSERT INTO audit_logs (user_id, action, details, performed_by, timestamp) VALUES ($1, $2, $3, $4, NOW())',
      [user.id, 'admin_check', `Admin status checked (result: ${isAdmin})`, uid]
    ).catch(err => console.error('Error logging audit:', err));

    console.log(`Admin check for ${uid}: ${isAdmin ? 'Is admin' : 'Not admin'}`);
    res.status(200).json({
      isAdmin: isAdmin,
      checked_at: new Date().toISOString(),
      checked_by: uid
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
      'INSERT INTO admin_logs (user_id, action, details, timestamp) VALUES ($1, $2, $3, NOW())',
      [userResult.rows[0].id, action, details]
    );

    console.log(`Admin activity logged for ${uid}: ${action}`);
    res.status(200).json({
      success: true,
      logged_at: new Date().toISOString(),
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