/**
 * A stand-in for `firebase-admin`, so the API suite can exercise real auth paths (IMP-092).
 *
 * The middleware's only question of Firebase is "decode this bearer token". Everything that
 * follows — is this user an admin, does the claim agree with the database, is the token revoked —
 * is EasyTrip's own logic, and that is the logic worth testing. Mocking the SDK is what makes
 * those paths reachable without a real Firebase project.
 *
 * A test token is just a JSON payload: `token('{"uid":"seed-admin-uid"}')`. Two magic values
 * simulate failure, because those are the cases the real SDK expresses by throwing:
 *   - `INVALID`  -> auth/argument-error, i.e. a malformed or forged token
 *   - `EXPIRED`  -> auth/id-token-expired
 */

const INVALID = 'INVALID';
const EXPIRED = 'EXPIRED';

/** Build a bearer token carrying an arbitrary decoded payload. */
const tokenFor = (payload) => Buffer.from(JSON.stringify(payload)).toString('base64');

/** `Authorization` header value for a payload. */
const authHeader = (payload) => `Bearer ${tokenFor(payload)}`;

const makeError = (code, message) => {
  const err = new Error(message);
  err.code = code;
  return err;
};

const verifyIdToken = jest.fn(async (token) => {
  if (token === INVALID)
    throw makeError('auth/argument-error', 'Decoding Firebase ID token failed');
  if (token === EXPIRED) throw makeError('auth/id-token-expired', 'Firebase ID token has expired');

  let decoded;
  try {
    decoded = JSON.parse(Buffer.from(token, 'base64').toString('utf8'));
  } catch {
    throw makeError('auth/argument-error', 'Decoding Firebase ID token failed');
  }
  if (!decoded || typeof decoded.uid !== 'string') {
    throw makeError('auth/argument-error', 'Token carries no uid');
  }
  return decoded;
});

const getUser = jest.fn(async (uid) => ({ uid, email: `${uid}@easytrip.test`, displayName: uid }));
const revokeRefreshTokens = jest.fn(async () => undefined);
const setCustomUserClaims = jest.fn(async () => undefined);

const auth = () => ({ verifyIdToken, getUser, revokeRefreshTokens, setCustomUserClaims });

/**
 * A non-empty `apps` plus a working `app()` is what makes `initializeFirebaseAdmin` short-circuit:
 * it returns the existing app rather than reading the three service-account variables and calling
 * `process.exit(1)` when they are absent.
 */
const fakeApp = { name: '[DEFAULT]', options: {} };

module.exports = {
  auth,
  apps: [fakeApp],
  app: jest.fn(() => fakeApp),
  initializeApp: jest.fn(() => fakeApp),
  credential: { cert: jest.fn(() => ({})) },
  // Test-only exports
  __mock: { verifyIdToken, getUser, revokeRefreshTokens, setCustomUserClaims },
  INVALID,
  EXPIRED,
  tokenFor,
  authHeader
};
