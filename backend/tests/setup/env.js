/**
 * Runs before any test module is loaded (jest `setupFiles`).
 *
 * Two jobs, both of which must happen before `app.js` is required:
 *
 *  1. Satisfy the environment gate. `app.js` validates its environment at import time and calls
 *     `process.exit(1)` when something required is missing — correct behaviour for a server, fatal
 *     for a test run, and it would abort the whole worker rather than fail a test.
 *  2. Replace `firebase-admin`. `src/config/firebase-admin.js` exits the process when its three
 *     service-account variables are absent, and `admin.auth()` throws unless a real app was
 *     initialised. The mock short-circuits both by reporting an already-initialised app.
 */

process.env.NODE_ENV = process.env.NODE_ENV || 'test';

// A test run must never reach a real database by accident. The suite refuses to start without an
// explicit DATABASE_URL rather than defaulting to something that might be a developer's own.
if (!process.env.DATABASE_URL) {
  throw new Error(
    'DATABASE_URL is not set. The API suite needs a throwaway Postgres.\n' +
      '  CI provides one as a service container. Locally:\n' +
      '    docker compose up -d postgres\n' +
      '    DATABASE_URL=postgresql://easytrip:easytrip@localhost:5432/easytrip npm test\n' +
      '  See backend/tests/README.md.'
  );
}

// PORT is deliberately left alone. `app.js` only listens when it is the process entry point, so a
// test run never binds one — and setting it to '0' to "avoid binding" made `validateEnv` warn
// about a port outside 1-65535 on every single suite, which is noise that trains people to skim
// warnings.
process.env.FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'test-project';
process.env.FIREBASE_CLIENT_EMAIL =
  process.env.FIREBASE_CLIENT_EMAIL || 'test@test-project.iam.gserviceaccount.com';
process.env.FIREBASE_PRIVATE_KEY =
  process.env.FIREBASE_PRIVATE_KEY ||
  '-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----\n';
process.env.CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || 'test-cloud';
process.env.CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY || 'test-key';
process.env.CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET || 'test-secret';
process.env.CORS_ALLOWED_ORIGINS = process.env.CORS_ALLOWED_ORIGINS || 'http://localhost:3000';

jest.mock('firebase-admin', () => require('../helpers/firebaseMock'));
