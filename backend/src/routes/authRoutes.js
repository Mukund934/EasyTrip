const express = require('express');
const router = express.Router();
const { body, param, query } = require('express-validator');
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
const tripWorkspaceController = require('../controllers/tripWorkspaceController');
const tripShareController = require('../controllers/tripShareController');
const tripCollaboratorController = require('../controllers/tripCollaboratorController');
const recommendationController = require('../controllers/recommendationController');

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
  // `FV-029` stage (c). `values: 'null'` rather than `'falsy'`, and the distinction is the whole
  // point: `false` is a real answer here — it is how somebody *removes* a stated requirement — and
  // `optional({ values: 'falsy' })` would silently drop it, leaving the requirement set forever.
  ...['requires_step_free', 'requires_accessible_restroom'].map((field) =>
    body(field)
      .optional({ values: 'null' })
      .isBoolean()
      .withMessage(`${field} must be true or false`)
      .toBoolean()
  ),
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
const { idParam, tripBodyRules, itemBodyRules } = require('./validators/tripValidators');

// `FV-019`. Authenticated because the answer is derived entirely from this traveller's saved
// places, which are private - there is no public version of the question. `limit` is capped rather
// than trusted: an unbounded one would let a caller ask for the whole catalogue sorted.
router.get(
  '/recommendations',
  isAuthenticated,
  query('limit')
    .optional({ values: 'falsy' })
    .isInt({ min: 1, max: 24 })
    .withMessage('limit must be between 1 and 24'),
  handleValidationErrors,
  recommendationController.getRecommendations
);

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
/**
 * The people who can open a trip (`FV-007` stage (a)).
 *
 * Nested under the trip id like every other trip route, so the caller's relationship to the trip is
 * proved from the path rather than by a handler remembering to check. The handlers distinguish
 * *owner* from *reader* themselves, because listing needs only read access while adding and removing
 * are the owner's alone.
 */
router.get(
  '/trips/:tripId/collaborators',
  isAuthenticated,
  idParam('tripId'),
  handleValidationErrors,
  tripCollaboratorController.listCollaborators
);
router.post(
  '/trips/:tripId/collaborators',
  isAuthenticated,
  [
    idParam('tripId'),
    // `isEmail` and then `normalizeEmail: false` — the address is a lookup key against
    // `users.email`, and normalisation would rewrite it (stripping Gmail dots, lowercasing) into
    // something that no longer matches what somebody registered with. The model compares with
    // `lower()` on both sides, which is the whole of the case-insensitivity this needs.
    body('email')
      .isEmail()
      .withMessage('A valid email address is required')
      .bail()
      .isLength({ max: 255 })
      .withMessage('That email address is too long'),
    // Optional, because omitting it means `viewer` — the model defends the vocabulary as well, since
    // it is the only path to the table and a CHECK violation would surface as an unactionable 500.
    body('role')
      .optional()
      .isIn(['viewer', 'editor'])
      .withMessage('A collaborator is either a viewer or an editor')
  ],
  handleValidationErrors,
  tripCollaboratorController.addCollaborator
);
router.delete(
  '/trips/:tripId/collaborators/:userId',
  isAuthenticated,
  [
    idParam('tripId'),
    // A Firebase uid, not an integer, so `idParam` does not apply. Bounded and non-empty is the
    // whole contract: it is compared against a stored value, never interpolated.
    param('userId').isString().trim().isLength({ min: 1, max: 255 })
  ],
  handleValidationErrors,
  tripCollaboratorController.removeCollaborator
);

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

// ---------------------------------------------------------------------------
// Notes and checklist (`FV-006` stage b)
// ---------------------------------------------------------------------------
// Nested under `/trips/:tripId` like every other child collection here, and for the same reason:
// ownership is proved by the trip id inside the query rather than by a handler remembering to
// check. Neither table carries a uid of its own, so there is no shape in which one could be read
// without its trip.
//
// The length caps are enforced here **as well as** by the column types, because a `VARCHAR(200)`
// answers an oversized label with a 500 from the driver while a validator answers it with a 400
// naming the field. `body` is TEXT and has no such backstop, so its cap exists only here.

// Trimmed before it is stored, so " " cannot become a note the CHECK constraint would then reject
// with a 500. The validator is where a blank body is a 400.
const noteBodyRule = body('body')
  .isString()
  .withMessage('A note needs a body')
  .bail()
  .trim()
  .isLength({ min: 1, max: 5000 })
  .withMessage('A note must be between 1 and 5000 characters');

const checklistLabelRule = (required) =>
  (required ? body('label') : body('label').optional())
    .isString()
    .withMessage('A checklist item needs a label')
    .bail()
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('A checklist label must be between 1 and 200 characters');

// `FV-006` stage (d). POST because it creates a trip; nested under the source so ownership is proved
// by the same query everything else here uses. The optional title is validated with the same rule a
// new trip's is - a copy is a trip, and a 201-character name must fail the same way.
router.post(
  '/trips/:tripId/duplicate',
  isAuthenticated,
  [
    idParam('tripId'),
    body('title')
      .optional()
      .trim()
      .notEmpty()
      .withMessage('A trip needs a title')
      .bail()
      .isLength({ max: 200 })
  ],
  handleValidationErrors,
  tripWorkspaceController.duplicateTrip
);

// `FV-009` stage (c), the owner's half. The public half is NOT here - it is on the unauthenticated
// router, because the whole point is that the reader is not signed in. POST both creates and
// **rotates**: somebody who thinks a link has spread further than they meant should not have to find
// a separate control while worried about it.
router.get(
  '/trips/:tripId/share',
  isAuthenticated,
  idParam('tripId'),
  handleValidationErrors,
  tripShareController.getShare
);
router.post(
  '/trips/:tripId/share',
  isAuthenticated,
  idParam('tripId'),
  handleValidationErrors,
  tripShareController.createShare
);
router.delete(
  '/trips/:tripId/share',
  isAuthenticated,
  idParam('tripId'),
  handleValidationErrors,
  tripShareController.revokeShare
);

// `FV-009` stage (a). A literal segment, declared before nothing that could shadow it, and GET-only
// because it is a read. Authenticated like the rest: a trip is not public, so neither is its export.
router.get(
  '/trips/:tripId/calendar.ics',
  isAuthenticated,
  idParam('tripId'),
  handleValidationErrors,
  tripWorkspaceController.exportCalendar
);

router.get(
  '/trips/:tripId/notes',
  isAuthenticated,
  idParam('tripId'),
  handleValidationErrors,
  tripWorkspaceController.listNotes
);
router.post(
  '/trips/:tripId/notes',
  isAuthenticated,
  [idParam('tripId'), noteBodyRule],
  handleValidationErrors,
  tripWorkspaceController.createNote
);
router.put(
  '/trips/:tripId/notes/:noteId',
  isAuthenticated,
  [idParam('tripId'), idParam('noteId'), noteBodyRule],
  handleValidationErrors,
  tripWorkspaceController.updateNote
);
router.delete(
  '/trips/:tripId/notes/:noteId',
  isAuthenticated,
  [idParam('tripId'), idParam('noteId')],
  handleValidationErrors,
  tripWorkspaceController.deleteNote
);

router.get(
  '/trips/:tripId/checklist',
  isAuthenticated,
  idParam('tripId'),
  handleValidationErrors,
  tripWorkspaceController.listChecklist
);
router.post(
  '/trips/:tripId/checklist',
  isAuthenticated,
  [idParam('tripId'), checklistLabelRule(true)],
  handleValidationErrors,
  tripWorkspaceController.createChecklistItem
);
// Declared before `/checklist/:itemId`, like every literal segment in this repository - Express
// matches in declaration order, so a `:itemId` route above this would swallow "order" and hand it
// to a handler expecting an integer (`BUG C2`, guarded by `routeShadowing.test.js`).
router.put(
  '/trips/:tripId/checklist/order',
  isAuthenticated,
  [
    idParam('tripId'),
    body('item_ids').isArray({ min: 0 }).withMessage('item_ids must be an array'),
    body('item_ids.*').isInt({ min: 1 }).withMessage('item_ids must contain positive integers')
  ],
  handleValidationErrors,
  tripWorkspaceController.reorderChecklist
);
// PATCH rather than PUT: a tick sends `is_done` alone and must not blank the label beside it.
// `is_done` is validated as a real boolean rather than coerced, so `"maybe"` is a 400 instead of
// quietly becoming `true`.
router.patch(
  '/trips/:tripId/checklist/:itemId',
  isAuthenticated,
  [
    idParam('tripId'),
    idParam('itemId'),
    checklistLabelRule(false),
    body('is_done').optional().isBoolean().withMessage('is_done must be true or false').toBoolean()
  ],
  handleValidationErrors,
  tripWorkspaceController.updateChecklistItem
);
router.delete(
  '/trips/:tripId/checklist/:itemId',
  isAuthenticated,
  [idParam('tripId'), idParam('itemId')],
  handleValidationErrors,
  tripWorkspaceController.deleteChecklistItem
);

module.exports = router;
