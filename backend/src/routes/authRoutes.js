const express = require('express');
const router = express.Router();
const { body, param } = require('express-validator');
const { isAuthenticated, isAuthenticatedStrict } = require('../utils/authMiddleware');
const { handleValidationErrors } = require('../utils/errorHandler');

const { getProfile, updateProfile, checkAdmin } = require('../controllers/authController');
const {
  listFavorites,
  addFavorite,
  removeFavorite
} = require('../controllers/savedPlaceController');

const profileRules = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Name is required')
    .bail()
    .isLength({ max: 100 })
    .withMessage('Name must be at most 100 characters'),
  body('location')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ max: 120 })
    .withMessage('Location must be at most 120 characters'),
  body('dob')
    .optional({ values: 'falsy' })
    .isISO8601()
    .withMessage('Date of birth must be a valid date')
];

// The wishlist id, wherever it arrives. Bounded to a positive integer so a malformed id is a 400
// the caller can read rather than a 500 from `INT` overflowing or a `NaN` reaching the query.
const savedPlaceIdRule = (source) =>
  source.isInt({ min: 1 }).withMessage('Place id must be a positive integer').bail().toInt();

// Auth routes
router.get('/profile', isAuthenticated, getProfile);
router.put('/profile', isAuthenticated, profileRules, handleValidationErrors, updateProfile);
// Strict (revocation-checking) auth: this answer decides whether the admin pages are
// rendered at all, so it has to cost the same verification the isAdmin API gate pays.
router.get('/check-admin', isAuthenticatedStrict, checkAdmin);

/**
 * The wishlist (`IMP-108`, `ADR-030`).
 *
 * Mounted here rather than at `/api/users/favorites` — which is what `IMP-108`'s text says,
 * inherited from a README claim the README no longer makes. `/api/auth/profile` is already "the
 * caller's own record, keyed by the verified token", these are the same category, and a second
 * mount for one resource would split "my data" across two prefixes. If a third such resource
 * appears, extract `/api/me` and move all three at once.
 *
 * Every route is behind `isAuthenticated`, and no handler accepts a user id from the request.
 * The owner is `req.user.uid` and there is no other way to name one.
 */
router.get('/favorites', isAuthenticated, listFavorites);
router.post(
  '/favorites',
  isAuthenticated,
  savedPlaceIdRule(body('place_id')),
  handleValidationErrors,
  addFavorite
);
router.delete(
  '/favorites/:placeId',
  isAuthenticated,
  savedPlaceIdRule(param('placeId')),
  handleValidationErrors,
  removeFavorite
);

module.exports = router;
