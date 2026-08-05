require('dotenv').config();

// Initialize configurations first. Firebase Admin must be initialized before any
// route is mounted, otherwise admin.auth() throws on every authenticated request.
require('./src/config/firebase-admin');
const { testCloudinary } = require('./src/config/cloudinary');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const { Pool } = require('pg');
const { errorHandler } = require('./src/utils/errorHandler');

// Import routes
const placeRoutes = require('./src/routes/placeRoutes');
const authRoutes = require('./src/routes/authRoutes');
const adminRoutes = require('./src/routes/adminRoutes');
const newsletterRoutes = require('./src/routes/newsletterRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// Behind a hosting proxy the client IP arrives in X-Forwarded-For; rate limiting
// buckets by IP, so this must be set there and only there (trusting the header
// without a proxy in front lets any caller spoof its own IP).
const trustProxyHops = Number.parseInt(process.env.TRUST_PROXY_HOPS || '', 10);
if (Number.isInteger(trustProxyHops) && trustProxyHops > 0) {
  app.set('trust proxy', trustProxyHops);
}

// Security headers
app.disable('x-powered-by');
app.use(helmet({
  // This API serves place images cross-origin to the frontend, so the default
  // same-origin resource policy would block them.
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

// Middleware
const allowedOrigins = String(process.env.CORS_ALLOWED_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

if (allowedOrigins.length === 0) {
  if (process.env.NODE_ENV === 'production') {
    // An empty allowlist in production 403s every browser request. Refusing to boot
    // surfaces that as one obvious error instead of a site-wide CORS mystery.
    console.error(
      'FATAL: CORS_ALLOWED_ORIGINS is not set. In production every browser origin ' +
      'would be rejected. Set it to a comma-separated origin list, e.g. ' +
      'CORS_ALLOWED_ORIGINS=https://easytrip-psi.vercel.app'
    );
    process.exit(1);
  }
  allowedOrigins.push('http://localhost:3000');
}

// Requests with no Origin header (curl, server-to-server, same-origin) are not subject
// to CORS and pass through.
const isAllowedOrigin = (origin) => !origin || allowedOrigins.includes(origin);

app.use(cors({
  origin: (origin, callback) => callback(null, isAllowedOrigin(origin)),
  credentials: true
}));

// A disallowed origin gets a clean 403 rather than a thrown error surfacing as a 500.
// Registered AFTER cors() on purpose: Express runs middleware in registration order, so
// rejecting first would send a response with no Access-Control-Allow-Origin header and
// the calling page would see an opaque CORS failure instead of this message.
app.use((req, res, next) => {
  if (!isAllowedOrigin(req.headers.origin)) {
    return res.status(403).json({ message: 'Origin not allowed' });
  }
  next();
});

// Rate limiting: a global ceiling plus tighter buckets on the abuse-prone writes
// (review spam, uploads against the Cloudinary quota, admin mutations). Mounted
// ahead of the body parsers and the routers so a flood is rejected before a
// 10 MB payload is parsed, and so the buckets also cover the /api/admin/places
// handlers that placeRoutes serves.
const limiterOptions = (windowMs, limit, message, extraSkip) => ({
  windowMs,
  limit,
  standardHeaders: true,
  legacyHeaders: false,
  // CORS preflights are browser overhead, not caller intent.
  skip: (req) => req.method === 'OPTIONS' || Boolean(extraSkip && extraSkip(req)),
  message: { message }
});

// The card-image fallback is fetched once per place with no stored primary_image_url, and
// the frontend proxies it server-side (frontend/src/pages/api/places/[id]/image.js), so a
// single visitor loading /browse arrives at Express as dozens of hits from ONE ip — the
// Next server's. These reads are cheap redirects; keeping them out of the shared IP bucket
// stops one busy page load from 429-ing every user behind that proxy.
// Only the two redirect routes; /places/:id/images (the JSON list) is fetched by the
// browser directly, so it is already keyed by the real end-user IP.
const isImageRead = (req) =>
  req.method === 'GET' && /^\/api\/places\/\d+\/(image|images\/\d+)$/.test(req.path);

const globalLimiter = rateLimit(
  limiterOptions(15 * 60 * 1000, 1000, 'Too many requests, please try again later', isImageRead)
);
const reviewWriteLimiter = rateLimit(limiterOptions(60 * 60 * 1000, 10, 'Too many reviews submitted, please try again later'));
const uploadLimiter = rateLimit(limiterOptions(60 * 60 * 1000, 30, 'Too many uploads, please try again later'));
const adminWriteLimiter = rateLimit(limiterOptions(15 * 60 * 1000, 60, 'Too many admin requests, please try again later'));
// The newsletter endpoint is the only unauthenticated write in the API, so the rate limit is the
// only thing bounding it. Deliberately tighter than the review limiter: a person subscribes once,
// not ten times an hour.
const newsletterLimiter = rateLimit(limiterOptions(60 * 60 * 1000, 5, 'Too many subscription attempts, please try again later'));
// Reporting is authenticated and idempotent per review, but one account can still report many
// different reviews; this bounds that without getting in a genuine user's way.
const reportLimiter = rateLimit(limiterOptions(60 * 60 * 1000, 20, 'Too many reports submitted, please try again later'));

const writeMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const onWrites = (limiter) => (req, res, next) => (
  writeMethods.has(req.method) ? limiter(req, res, next) : next()
);

app.use(globalLimiter);
app.post('/api/places/:id/reviews', reviewWriteLimiter);
app.post('/api/places/:id/reviews/:reviewId/report', reportLimiter);
app.post('/api/newsletter', newsletterLimiter);
app.post('/api/admin/places', uploadLimiter);
app.put('/api/admin/places/:id', uploadLimiter);
app.use('/api/admin', onWrites(adminWriteLimiter));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Check database schema compatibility
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function ensureDatabaseSchema() {
  try {
    console.log('Checking database schema compatibility...');
    
    // Add primary_image_url column to places table if it doesn't exist
    await pool.query(`
      ALTER TABLE places 
      ADD COLUMN IF NOT EXISTS primary_image_url TEXT;
    `);
    
    // Add image_url column to place_images table if it doesn't exist
    await pool.query(`
      ALTER TABLE place_images
      ADD COLUMN IF NOT EXISTS image_url TEXT;
    `);

    console.log('✅ Database schema is compatible');
  } catch (error) {
    console.error('❌ Database schema check failed:', error.message);
  }

  await ensureReviewUniqueConstraint();
}

// The review upsert in placeController targets `place_reviews_place_id_user_id_key` by
// name. schema.sql declares it, but only inside CREATE TABLE IF NOT EXISTS, so a database
// that predates Phase 1 never gets it — and there is no migration runner, which would make
// every review POST fail with 42P10 until someone remembered to run the SQL by hand.
//
// Adding the constraint is safe and idempotent. De-duplicating the rows it requires is NOT,
// so that stays in the reviewed migration (src/config/migrations/001_phase1.sql): boot must
// never silently delete a user's reviews.
async function ensureReviewUniqueConstraint() {
  try {
    await pool.query(`
      DO $$
      BEGIN
        IF to_regclass('public.place_reviews') IS NOT NULL THEN
          IF NOT EXISTS (
            SELECT 1
            FROM pg_constraint
            WHERE conrelid = to_regclass('public.place_reviews')::oid
              AND conname = 'place_reviews_place_id_user_id_key'
          ) THEN
            ALTER TABLE place_reviews
              ADD CONSTRAINT place_reviews_place_id_user_id_key UNIQUE (place_id, user_id);
          END IF;
        END IF;
      END
      $$;
    `);

    console.log('✅ Review uniqueness constraint is present');
  } catch (error) {
    console.error(
      '❌ Could not add UNIQUE (place_id, user_id) to place_reviews:',
      error.message
    );
    console.error(
      '   Reviews will fail to save until this is resolved. Duplicate rows are the ' +
      'usual cause — back up the table, then run: ' +
      'psql "$DATABASE_URL" -f backend/src/config/migrations/001_phase1.sql'
    );
  }
}

// Run schema check
ensureDatabaseSchema();

// Health check endpoint — deliberately minimal: environment name, driver error
// text, and provider configuration are all reconnaissance material.
app.get('/api/health', async (req, res) => {
  const database = await pool.query('SELECT 1')
    .then(() => true)
    .catch(() => false);

  res.status(database ? 200 : 503).json({
    status: database ? 'ok' : 'degraded',
    database
  });
});



// Routes
app.use('/api', placeRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/newsletter', newsletterRoutes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// Error handler. Shared with the routers so a thrown error carrying an explicit
// status (multer's 400s, for instance) is not flattened into a 500.
app.use(errorHandler);

// Test database connection
pool.query('SELECT NOW() as current_time')
  .then(result => {
    console.log('Database connected successfully at', result.rows[0].current_time);
    console.log('✅ PostgreSQL connected successfully');
  })
  .catch(err => {
    console.error('❌ Database connection error:', err.message);
  });

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📍 API base URL: http://localhost:${PORT}/api`);
  console.log(`🏥 Health check: http://localhost:${PORT}/api/health`);
  console.log(`📍 Places: http://localhost:${PORT}/api/places`);
  console.log(`🔐 Auth: http://localhost:${PORT}/api/auth`);
  console.log(`⚙️  Admin: http://localhost:${PORT}/api/admin`);
});


module.exports = app;

