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

// Loads the caller's row from `users`, provisioning it on first sight from the
// verified token claims. Returns null when the row is unavailable — callers must
// never treat a null result as an authorization decision.
const loadDbUser = async (decodedToken) => {
  try {
    const userResult = await pool.query(
      'SELECT * FROM users WHERE firebase_uid = $1',
      [decodedToken.uid]
    );

    if (userResult.rows.length > 0) {
      return userResult.rows[0];
    }

    const newUserResult = await pool.query(
      `INSERT INTO users
       (firebase_uid, email, name, photo_url, created_at)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING *`,
      [
        decodedToken.uid,
        decodedToken.email || null,
        decodedToken.name || decodedToken.email || null,
        decodedToken.picture || null
      ]
    );

    return newUserResult.rows[0];
  } catch (error) {
    console.error('Error loading user record:', error.message);
    return null;
  }
};

// Verifies the `Authorization: Bearer <idToken>` header. On success populates
// req.user (from the decoded token) and req.dbUser, and resolves to the decoded
// token. On any failure it sends a 401 and resolves to null — there is no other
// way to obtain an identity.
const authenticateRequest = async (req, res, { checkRevoked = false } = {}) => {
  const token = extractToken(req);

  if (!token) {
    res.status(401).json({ message: 'Authentication required' });
    return null;
  }

  let decodedToken;
  try {
    decodedToken = await admin.auth().verifyIdToken(token, checkRevoked);
  } catch (error) {
    console.warn('Token verification failed:', error.code || error.message);
    res.status(401).json({ message: 'Invalid or expired token' });
    return null;
  }

  req.user = {
    uid: decodedToken.uid,
    email: decodedToken.email,
    name: decodedToken.name,
    picture: decodedToken.picture
  };
  // The full decoded token, custom claims included. Handlers that need to reason about
  // claims (admin resolution) read this rather than re-verifying the token themselves.
  req.decodedToken = decodedToken;
  req.dbUser = await loadDbUser(decodedToken);

  return decodedToken;
};

// The single definition of "is this caller an admin", shared by the isAdmin gate and by
// GET /auth/check-admin — the endpoint the four /admin/* page gates trust. Two callers,
// one rule, so the page gate and the API gate cannot disagree about who is an admin.
//
// `users.is_admin` is the authority; a Firebase custom `admin` claim is only a cache of
// it. A disagreement means one side is stale, so it resolves to NOT admin and logs.
// Throws on a database failure — callers must treat that as a 500, never as "not admin".
const resolveAdminStatus = async (decodedToken) => {
  const userId = decodedToken.uid;

  const adminResult = await pool.query(
    'SELECT id, is_admin FROM users WHERE firebase_uid = $1',
    [userId]
  );

  const row = adminResult.rows[0] || null;
  const dbIsAdmin = Boolean(row && row.is_admin === true);

  const hasAdminClaim = Object.prototype.hasOwnProperty.call(decodedToken, 'admin');
  const claimIsAdmin = decodedToken.admin === true;

  if (hasAdminClaim && claimIsAdmin !== dbIsAdmin) {
    console.warn(
      `Admin claim/database mismatch for ${userId}: claim=${claimIsAdmin}, is_admin=${dbIsAdmin}`
    );
    return { isAdmin: false, mismatch: true, user: row };
  }

  return { isAdmin: dbIsAdmin, mismatch: false, user: row };
};

// Soft authentication for public routes: verifies an Authorization header when one is
// present and populates req.user, but never rejects and never 401s. Lets a public
// response be personalised (e.g. flagging the caller's own review) without turning the
// endpoint into an authenticated one. Deliberately skips loadDbUser — nothing on these
// routes needs the DB row, and this is a hot read path.
const attachUserIfPresent = async (req, res, next) => {
  const token = extractToken(req);

  if (!token) {
    return next();
  }

  try {
    const decodedToken = await admin.auth().verifyIdToken(token);

    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      name: decodedToken.name,
      picture: decodedToken.picture
    };
  } catch (error) {
    // An unusable token on a public route just means "treat this caller as anonymous".
    console.warn('Optional token verification failed:', error.code || error.message);
  }

  next();
};

const isAuthenticated = async (req, res, next) => {
  try {
    const decodedToken = await authenticateRequest(req, res);

    if (!decodedToken) {
      return;
    }

    next();
  } catch (error) {
    console.error('Authentication error:', error.message);
    return res.status(500).json({ message: 'Authentication error' });
  }
};

// Same as isAuthenticated, but pays for revocation checking. Used by the routes whose
// answer decides whether privileged UI gets served, so a revoked session cannot still
// be told it is an admin.
const isAuthenticatedStrict = async (req, res, next) => {
  try {
    const decodedToken = await authenticateRequest(req, res, { checkRevoked: true });

    if (!decodedToken) {
      return;
    }

    next();
  } catch (error) {
    console.error('Authentication error:', error.message);
    return res.status(500).json({ message: 'Authentication error' });
  }
};

const isAdmin = async (req, res, next) => {
  try {
    // checkRevoked costs one extra Firebase round trip, so it is spent only on
    // the admin gate — disabled or session-revoked admins are rejected here even
    // though their token stays usable on ordinary authenticated routes until it
    // expires.
    const decodedToken = await authenticateRequest(req, res, { checkRevoked: true });

    if (!decodedToken) {
      return;
    }

    let adminStatus;
    try {
      adminStatus = await resolveAdminStatus(decodedToken);
    } catch (adminCheckError) {
      console.error('Admin check error:', adminCheckError.message);
      return res.status(500).json({ message: 'Error checking admin status' });
    }

    if (!adminStatus.isAdmin) {
      return res.status(403).json({ message: 'Admin access required' });
    }

    next();
  } catch (error) {
    console.error('Admin middleware error:', error.message);
    return res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  isAuthenticated,
  isAuthenticatedStrict,
  isAdmin,
  attachUserIfPresent,
  resolveAdminStatus
};
