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
const { getMyReviews } = require('../controllers/myReviewController');
const tripController = require('../controllers/tripController');

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

/**
 * The caller's own review history (`IMP-117`).
 *
 * Deliberately separate from `GET /places/:id/reviews`, which anonymises authors so a stranger
 * cannot correlate one person's reviews across the site. This read *is* that correlation, for the
 * one person entitled to it — see `myReviewController` for why they are not one endpoint with a
 * flag. Writes reuse `IMP-019`'s owner-gated place routes; there is nothing new to guard.
 */
router.get('/reviews', isAuthenticated, getMyReviews);

/**
 * The trip workspace (`IMP-109` / `FV-006`, `ADR-031`).
 *
 * Nested under the trip on purpose: a day and an item are only ever addressable *through* the trip
 * that owns them, and the URL says so. `/api/auth/items/:id` would be a shape where forgetting the
 * ownership join is one careless handler away — this one cannot be written without the trip id.
 */
const idParam = (name) =>
  param(name).isInt({ min: 1 }).withMessage(`${name} must be a positive integer`).bail().toInt();

const tripBodyRules = (required) => [
  required
    ? body('title')
        .trim()
        .notEmpty()
        .withMessage('A trip needs a title')
        .bail()
        .isLength({ max: 200 })
    : body('title')
        .optional()
        .trim()
        .notEmpty()
        .withMessage('A trip needs a title')
        .bail()
        .isLength({ max: 200 }),
  body('description').optional({ values: 'null' }).isLength({ max: 5000 }),
  body('start_date')
    .optional({ values: 'falsy' })
    .isISO8601()
    .withMessage('start_date must be a date'),
  body('end_date').optional({ values: 'falsy' }).isISO8601().withMessage('end_date must be a date'),
  body('status')
    .optional({ values: 'falsy' })
    .isIn(['draft', 'upcoming', 'completed'])
    .withMessage('status must be draft, upcoming or completed'),
  // The database has the same CHECK; this exists so a typo is a readable 400 rather than a 500
  // carrying a constraint name the user cannot act on.
  body().custom((value) => {
    if (value.start_date && value.end_date && value.end_date < value.start_date) {
      throw new Error('A trip cannot end before it starts');
    }
    return true;
  })
];

/**
 * Validation for a trip item.
 *
 * **Takes `required` for the same reason `tripBodyRules` does, and it is a fix rather than
 * symmetry** (`BUG-052`). The last rule — *an item needs a title, or a place to take one from* — is
 * true when an item is **created** and false when one is **patched**: an item that already has a
 * title does not have to resend it to change its start time. Shared as a flat array, it made
 * `PUT /items/:id` with `{ start_time: '10:00' }` a 400 complaining about a title the item already
 * had.
 *
 * Nothing caught it because every existing update test happens to send a title. It surfaced when
 * `FV-027`'s proposals needed to move an item by day alone.
 */
const itemBodyRules = (required) => [
  body('place_id').optional({ values: 'falsy' }).isInt({ min: 1 }).toInt(),
  // Moving an item to another day of the same trip (Sprint 8.26). Shape only — that the day belongs
  // to this trip is enforced in the query, because a validator cannot know and a check here would
  // be a second source of truth about authorisation.
  body('trip_day_id').optional({ values: 'falsy' }).isInt({ min: 1 }).toInt(),
  body('item_type')
    .optional({ values: 'falsy' })
    .isIn(['place', 'transport', 'meal', 'activity', 'note'])
    .withMessage('item_type must be place, transport, meal, activity or note'),
  body('title').optional().trim().isLength({ max: 200 }),
  body('notes').optional({ values: 'null' }).isLength({ max: 2000 }),
  // HH:MM or HH:MM:SS. A TIME column would reject anything else anyway; this makes it a 400.
  body('start_time')
    .optional({ values: 'falsy' })
    .matches(/^\d{2}:\d{2}(:\d{2})?$/),
  body('end_time')
    .optional({ values: 'falsy' })
    .matches(/^\d{2}:\d{2}(:\d{2})?$/),
  // An item with neither a place nor a title has nothing to render — on creation. A patch is
  // allowed to touch one field and leave the rest of the row alone.
  ...(required
    ? [
        body().custom((value) => {
          if (!value.place_id && !String(value.title || '').trim()) {
            throw new Error('An item needs a title, or a place to take one from');
          }
          return true;
        })
      ]
    : [])
];

router.get('/trips', isAuthenticated, tripController.listTrips);
router.post(
  '/trips',
  isAuthenticated,
  tripBodyRules(true),
  handleValidationErrors,
  tripController.createTrip
);
router.get(
  '/trips/:tripId',
  isAuthenticated,
  idParam('tripId'),
  handleValidationErrors,
  tripController.getTrip
);
// Read-only, and nested like every other trip route so ownership is proved by the trip id rather
// than by a handler remembering to check (`FV-025`).
router.get(
  '/trips/:tripId/feasibility',
  isAuthenticated,
  idParam('tripId'),
  handleValidationErrors,
  tripController.getTripFeasibility
);
router.get(
  '/trips/:tripId/replan-suggestion',
  isAuthenticated,
  idParam('tripId'),
  handleValidationErrors,
  tripController.getTripReplanSuggestion
);
router.get(
  '/trips/:tripId/days/:dayId/route-suggestion',
  isAuthenticated,
  [idParam('tripId'), idParam('dayId')],
  handleValidationErrors,
  tripController.getDayRouteSuggestion
);
// The day as it would be drawn (`FV-026` stage c). Nested identically, so a day that is not
// yours is a 404 by the same query rather than by a second check that has to remember.
router.get(
  '/trips/:tripId/days/:dayId/route',
  isAuthenticated,
  [idParam('tripId'), idParam('dayId')],
  handleValidationErrors,
  tripController.getDayRoute
);
router.put(
  '/trips/:tripId',
  isAuthenticated,
  [idParam('tripId'), ...tripBodyRules(false)],
  handleValidationErrors,
  tripController.updateTrip
);
router.delete(
  '/trips/:tripId',
  isAuthenticated,
  idParam('tripId'),
  handleValidationErrors,
  tripController.deleteTrip
);

router.post(
  '/trips/:tripId/days',
  isAuthenticated,
  idParam('tripId'),
  handleValidationErrors,
  tripController.addDay
);
router.delete(
  '/trips/:tripId/days/:dayId',
  isAuthenticated,
  [idParam('tripId'), idParam('dayId')],
  handleValidationErrors,
  tripController.deleteDay
);

router.post(
  '/trips/:tripId/days/:dayId/items',
  isAuthenticated,
  [idParam('tripId'), idParam('dayId'), ...itemBodyRules(true)],
  handleValidationErrors,
  tripController.addItem
);
router.put(
  '/trips/:tripId/days/:dayId/items/order',
  isAuthenticated,
  [
    idParam('tripId'),
    idParam('dayId'),
    body('item_ids').isArray({ min: 0 }).withMessage('item_ids must be an array'),
    body('item_ids.*').isInt({ min: 1 }).withMessage('item_ids must contain positive integers')
  ],
  handleValidationErrors,
  tripController.reorderItems
);
router.put(
  '/trips/:tripId/items/:itemId',
  isAuthenticated,
  [idParam('tripId'), idParam('itemId'), ...itemBodyRules(false)],
  handleValidationErrors,
  tripController.updateItem
);
router.delete(
  '/trips/:tripId/items/:itemId',
  isAuthenticated,
  [idParam('tripId'), idParam('itemId')],
  handleValidationErrors,
  tripController.deleteItem
);

module.exports = router;
