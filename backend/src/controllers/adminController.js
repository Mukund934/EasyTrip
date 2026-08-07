const pool = require('../config/db');
const admin = require('firebase-admin');
const logger = require('../utils/logger');

/**
 * Keep the Firebase custom `admin` claim in step with users.is_admin.
 *
 * authMiddleware treats a claim that disagrees with the DB column as "one side is
 * stale" and denies the request. script/make-admin.js has always written this claim,
 * so leaving it untouched here means every promotion or demotion made through the API
 * drifts out of sync and eventually locks somebody out of a role they legitimately hold.
 *
 * setCustomUserClaims REPLACES the whole claim set, so existing claims are merged back in.
 * Throws on failure — the caller must surface it, because a half-applied change is
 * exactly the mismatch state that produces 403s.
 */
const syncAdminClaim = async (userRecord, isAdmin) => {
  const existingClaims = userRecord.customClaims || {};

  await admin.auth().setCustomUserClaims(userRecord.uid, {
    ...existingClaims,
    admin: isAdmin
  });
};

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
    logger.error({ err: error }, 'Error getting admins');
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
    const userResult = await pool.query('SELECT * FROM users WHERE firebase_uid = $1', [
      userRecord.uid
    ]);

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

    try {
      await syncAdminClaim(userRecord, true);
    } catch (claimError) {
      logger.error({ err: claimError }, 'Error setting admin custom claim');
      return res.status(500).json({
        message: `${email} was granted admin in the database, but the Firebase admin claim could not be set. They will be denied admin access until this call succeeds — please retry.`
      });
    }

    res.status(200).json({ message: `${email} is now an admin` });
  } catch (error) {
    logger.error({ err: error }, 'Error adding admin');
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

    // Demotion already took effect: is_admin is false, and a leftover `admin: true`
    // claim disagrees with it, which authMiddleware denies. Clearing it is still
    // required so a later re-promotion does not read as a mismatch.
    try {
      await syncAdminClaim(userRecord, false);
    } catch (claimError) {
      logger.error({ err: claimError }, 'Error clearing admin custom claim');
      return res.status(500).json({
        message: `${email} was removed as an admin in the database, but the stale Firebase admin claim could not be cleared. Admin access is already denied; please retry to clear the claim.`
      });
    }

    res.status(200).json({ message: `${email} is no longer an admin` });
  } catch (error) {
    logger.error({ err: error }, 'Error removing admin');
    res.status(500).json({ message: 'Error removing admin' });
  }
};

module.exports = {
  getAllAdmins,
  addAdmin,
  removeAdmin
};
