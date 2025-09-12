const admin = require('firebase-admin');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const extractToken = (req) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    return null;
  }
  
  const parts = authHeader.split(' ');
  
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }
  
  return parts[1];
};

const isAuthenticated = async (req, res, next) => {
  try {
    const timestamp = new Date().toISOString();
    const token = extractToken(req);
    
    // For development mode - check headers first
    const userId = req.headers['x-user'] || req.query.user;
    const userName = req.headers['x-user-name'] || req.query.userName;
    
    // Log headers for debugging
    console.log(`[${timestamp}] Auth headers:`, { 
      'x-user': userId, 
      'x-user-name': userName,
      'authorization': req.headers.authorization ? 'Present' : 'Not present'
    });
    
    // Development mode - prioritize dharmendra23101 in headers
    if (process.env.NODE_ENV === 'development') {
      if (userId === 'dharmendra23101' || userId) {
        console.log(`[${timestamp}] Development mode: Using user from headers: ${userId}`);
        req.user = { uid: userId || 'dharmendra23101' };
        req.dbUser = { name: userName || userId || 'Dharmendra' };
        return next();
      }
    }
    
    // Production mode or no headers in development
    if (!token) {
      if (process.env.NODE_ENV === 'development') {
        // Default to dharmendra23101 in development
        console.log(`[${timestamp}] Development mode: Using default user dharmendra23101`);
        req.user = { uid: 'dharmendra23101' };
        req.dbUser = { name: 'Dharmendra' };
        return next();
      }
      
      return res.status(401).json({ 
        message: 'Authentication required',
        timestamp
      });
    }
    
    try {
      // Verify Firebase token
      const decodedToken = await admin.auth().verifyIdToken(token);
      req.user = decodedToken;
      
      // Get user from database
      const userResult = await pool.query(
        'SELECT * FROM users WHERE firebase_uid = $1',
        [decodedToken.uid]
      );
      
      if (userResult.rows.length > 0) {
        req.dbUser = userResult.rows[0];
      } else {
        // Get user profile from Firebase
        try {
          const userRecord = await admin.auth().getUser(decodedToken.uid);
          
          // Store basic user info in our database
          const newUserResult = await pool.query(
            `INSERT INTO users 
             (firebase_uid, email, name, photo_url, created_at) 
             VALUES ($1, $2, $3, $4, NOW()) 
             RETURNING *`,
            [
              userRecord.uid,
              userRecord.email,
              userRecord.displayName || userRecord.email,
              userRecord.photoURL
            ]
          );
          
          req.dbUser = newUserResult.rows[0];
        } catch (err) {
          console.error(`[${timestamp}] Error creating user record:`, err);
          // Continue without db user
        }
      }
      
      next();
    } catch (verifyError) {
      console.error(`[${timestamp}] Token verification error:`, verifyError);
      
      // In development, allow access with default user
      if (process.env.NODE_ENV === 'development') {
        console.log(`[${timestamp}] Development fallback: Using default user dharmendra23101`);
        req.user = { uid: 'dharmendra23101' };
        req.dbUser = { name: 'Dharmendra' };
        return next();
      }
      
      return res.status(401).json({ 
        message: 'Invalid or expired token',
        timestamp
      });
    }
  } catch (error) {
    console.error('Authentication error:', error);
    
    // In development, allow access with default user
    if (process.env.NODE_ENV === 'development') {
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] Error fallback: Using default user dharmendra23101`);
      req.user = { uid: 'dharmendra23101' };
      req.dbUser = { name: 'Dharmendra' };
      return next();
    }
    
    return res.status(500).json({ 
      message: 'Authentication error', 
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
};

const isAdmin = async (req, res, next) => {
  try {
    const timestamp = new Date().toISOString();
    
    // First ensure the user is authenticated
    await isAuthenticated(req, res, async () => {
      const userId = req.user?.uid;
      
      if (!userId) {
        return res.status(401).json({ 
          message: 'Authentication required',
          timestamp
        });
      }
      
      // Development admin whitelist - always prioritize dharmendra23101
      const adminWhitelist = ['dharmendra23101', 'af9GjxDZDeNCT69gLbEkk45md1x1', 'aJJJxZNJXsZgQStO3yL7ahjKZDr1'];
      
      // Auto-approve admin access in development for specific users
      if (process.env.NODE_ENV === 'development' && adminWhitelist.includes(userId)) {
        console.log(`[${timestamp}] Development mode: Granting admin access to ${userId}`);
        return next();
      }
      
      try {
        // Check if user is admin in database
        const adminResult = await pool.query(
          'SELECT is_admin FROM users WHERE firebase_uid = $1',
          [userId]
        );
        
        const isAdmin = adminResult.rows.length > 0 && adminResult.rows[0].is_admin;
        
        if (isAdmin) {
          console.log(`[${timestamp}] Admin access granted for: ${userId}`);
          return next();
        } else {
          // Double-check whitelist for development
          if (process.env.NODE_ENV === 'development' && 
              (userId === 'dharmendra23101' || adminWhitelist.includes(userId))) {
            console.log(`[${timestamp}] Development override: Granting admin access to ${userId}`);
            return next();
          }
          
          console.log(`[${timestamp}] Admin access denied for: ${userId}`);
          return res.status(403).json({ 
            message: 'Admin access required',
            timestamp
          });
        }
      } catch (adminCheckError) {
        console.error(`[${timestamp}] Admin check error:`, adminCheckError);
        
        // Development fallback
        if (process.env.NODE_ENV === 'development' && 
            (userId === 'dharmendra23101' || adminWhitelist.includes(userId))) {
          console.log(`[${timestamp}] Database error fallback: Granting admin access to ${userId}`);
          return next();
        }
        
        return res.status(500).json({ 
          message: 'Error checking admin status',
          timestamp
        });
      }
    });
  } catch (error) {
    console.error('Admin middleware error:', error);
    
    // Final development fallback
    if (process.env.NODE_ENV === 'development') {
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] Critical error fallback: Granting admin access to dharmendra23101`);
      req.user = { uid: 'dharmendra23101' };
      req.dbUser = { name: 'Dharmendra' };
      return next();
    }
    
    return res.status(500).json({ 
      message: 'Server error',
      timestamp: new Date().toISOString()
    });
  }
};

module.exports = { isAuthenticated, isAdmin };