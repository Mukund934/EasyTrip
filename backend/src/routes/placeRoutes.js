const express = require('express');
const router = express.Router();
const { body, param, query } = require('express-validator');
const placeController = require('../controllers/placeController');
const { isAuthenticated, isAdmin, attachUserIfPresent } = require('../utils/authMiddleware');
const { uploadMiddleware } = require('../utils/multerConfig');
const { handleValidationErrors } = require('../utils/errorHandler');
const { getPlaceWeather } = require('../controllers/weatherController');
const { geocodeAddress } = require('../controllers/geocodeController');
const { SORT_KEYS, SUGGEST_MAX_LIMIT } = require('../models/placeModel');
const { SUPPORTED_GEOCODERS } = require('../controllers/helpers/coordinateSource');
const { THEME_IDS } = require('../constants/themes');
const { PLACE_SETTINGS } = require('../constants/placeSetting');

// Multipart bodies arrive as strings, so collection fields are JSON text here and
// plain values once a client posts JSON. Both shapes are accepted.
const parseJson = (value) => (typeof value === 'string' ? JSON.parse(value) : value);

const isStringArray = (label, maxEntries, maxLength, allowed) => (value) => {
  let parsed;
  try {
    parsed = parseJson(value);
  } catch (error) {
    throw new Error(`${label} must be a JSON array of strings`);
  }
  if (!Array.isArray(parsed)) {
    throw new Error(`${label} must be a JSON array of strings`);
  }
  if (parsed.length > maxEntries) {
    throw new Error(`${label} may contain at most ${maxEntries} entries`);
  }
  if (parsed.some((entry) => typeof entry !== 'string' || entry.length > maxLength)) {
    throw new Error(`${label} entries must be strings of at most ${maxLength} characters`);
  }
  // Membership is opt-in, and only the WRITE paths ask for it. Applying it to a query filter would
  // turn a stale bookmark into a 400; `places.test.js` pins the opposite ("an unmatched filter
  // returns an empty list, not an error"), which is the friendlier contract for a read.
  if (allowed) {
    const unknown = [...new Set(parsed.filter((entry) => !allowed.includes(entry)))];
    if (unknown.length > 0) {
      throw new Error(
        `${label} contains unknown ${label}: ${unknown.join(', ')}. Allowed: ${allowed.join(', ')}`
      );
    }
  }
  return true;
};

const isFlatObject = (value) => {
  let parsed;
  try {
    parsed = parseJson(value);
  } catch (error) {
    throw new Error('custom_keys must be a JSON object');
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('custom_keys must be a JSON object');
  }
  const entries = Object.entries(parsed);
  if (entries.length > 30) {
    throw new Error('custom_keys may contain at most 30 entries');
  }
  if (entries.some(([key, entry]) => key.length > 60 || String(entry).length > 500)) {
    throw new Error('custom_keys entries are too long');
  }
  return true;
};

const placeIdParam = param('id')
  .isInt({ min: 1 })
  .withMessage('Place id must be a positive integer');

const requiredText = (field, label, max) =>
  body(field)
    .trim()
    .notEmpty()
    .withMessage(`${label} is required`)
    .bail()
    .isLength({ max })
    .withMessage(`${label} must be at most ${max} characters`);

// Empty strings count as "not supplied": the admin form posts every field it has,
// blank ones included, and an update patches only what it is actually given.
const optionalText = (field, label, max) =>
  body(field)
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ max })
    .withMessage(`${label} must be at most ${max} characters`);

const optionalUrl = (field) =>
  body(field)
    .optional({ values: 'falsy' })
    .isURL({ protocols: ['http', 'https'], require_protocol: true })
    .withMessage(`${field} must be a valid http(s) URL`);

// Shared across create and update; `required` decides whether name/location may be
// omitted, since update patches only the fields it is given.
const placeBodyRules = (required) => [
  required ? requiredText('name', 'Name', 200) : optionalText('name', 'Name', 200),
  required ? requiredText('location', 'Location', 200) : optionalText('location', 'Location', 200),
  optionalText('description', 'Description', 5000),
  optionalText('district', 'District', 120),
  optionalText('state', 'State', 120),
  optionalText('locality', 'Locality', 120),
  optionalText('pin_code', 'Pin code', 20),
  // Not converted with toFloat(): the controllers treat a falsy value as "no
  // coordinate", and a sanitized 0 would read as absent.
  body('latitude')
    .optional({ values: 'falsy' })
    .isFloat({ min: -90, max: 90 })
    .withMessage('Latitude must be between -90 and 90'),
  body('longitude')
    .optional({ values: 'falsy' })
    .isFloat({ min: -180, max: 180 })
    .withMessage('Longitude must be between -180 and 180'),
  // Which geocoder produced those coordinates, when one did (IMP-127). Rejected rather than
  // silently dropped: this field decides whether an attribution notice appears, so a typo that
  // quietly removed one would be invisible in exactly the way a licence obligation must not be.
  // The allowlist is `SUPPORTED_GEOCODERS`, which the 010 migration's CHECK constraint mirrors.
  body('coordinates_source')
    .optional({ values: 'falsy' })
    .isIn(SUPPORTED_GEOCODERS)
    .withMessage(`coordinates_source must be one of: ${SUPPORTED_GEOCODERS.join(', ')}`),
  optionalUrl('primary_image_url'),
  optionalUrl('image_url'),
  body('themes')
    .optional({ values: 'falsy' })
    .custom(isStringArray('themes', 20, 60, THEME_IDS)),
  // `values: 'falsy'` matches every other optional here: an omitted key and an empty string both
  // mean "leave it alone", and the column default supplies `unknown`.
  body('setting')
    .optional({ values: 'falsy' })
    .isIn(PLACE_SETTINGS)
    .withMessage(`setting must be one of: ${PLACE_SETTINGS.join(', ')}`),
  body('tags')
    .optional({ values: 'falsy' })
    .custom(isStringArray('tags', 50, 60)),
  body('custom_keys').optional({ values: 'falsy' }).custom(isFlatObject)
];

// Search accepts the same collection shapes as the write routes (JSON arrays as query text).
// `date` is a season key, not a calendar date — see SEASON_MONTHS in placeModel.
const searchRules = [
  query('searchTerm')
    .optional({ values: 'falsy' })
    .isString()
    .bail()
    .trim()
    .isLength({ max: 200 })
    .withMessage('searchTerm must be at most 200 characters'),
  query('location')
    .optional({ values: 'falsy' })
    .isString()
    .bail()
    .trim()
    .isLength({ max: 120 })
    .withMessage('location must be at most 120 characters'),
  query('district')
    .optional({ values: 'falsy' })
    .isString()
    .bail()
    .trim()
    .isLength({ max: 120 })
    .withMessage('district must be at most 120 characters'),
  query('state')
    .optional({ values: 'falsy' })
    .isString()
    .bail()
    .trim()
    .isLength({ max: 120 })
    .withMessage('state must be at most 120 characters'),
  query('tags')
    .optional({ values: 'falsy' })
    .custom(isStringArray('tags', 50, 60)),
  query('themes')
    .optional({ values: 'falsy' })
    .custom(isStringArray('themes', 20, 60)),
  query('minRating')
    .optional({ values: 'falsy' })
    .isFloat({ min: 0, max: 5 })
    .withMessage('minRating must be between 0 and 5'),
  query('date')
    .optional({ values: 'falsy' })
    .isIn(['summer', 'monsoon', 'winter'])
    .withMessage('date must be one of: summer, monsoon, winter')
];

// Pagination, sorting and projection (IMP-038). `limit` is capped in the model as well; this
// rule exists so an out-of-range value is a 400 the caller can see rather than a silent clamp.
// `sort` and `projection` are enumerations because both index into server-side SQL fragments —
// rejecting anything unrecognised here keeps that lookup total.
const listRules = [
  query('limit')
    .optional({ values: 'falsy' })
    .isInt({ min: 1, max: 100 })
    .withMessage('limit must be between 1 and 100'),
  query('offset')
    .optional({ values: 'falsy' })
    .isInt({ min: 0 })
    .withMessage('offset must be zero or greater'),
  // Enumerated from the model rather than restated, so adding a sort cannot leave the validator
  // rejecting a value the model supports (or accepting one it does not).
  query('sort')
    .optional({ values: 'falsy' })
    .isIn(SORT_KEYS)
    .withMessage(`sort must be one of: ${SORT_KEYS.join(', ')}`),
  query('projection')
    .optional({ values: 'falsy' })
    .isIn(['list', 'map'])
    .withMessage('projection must be one of: list, map'),
  query('withStats')
    .optional({ values: 'falsy' })
    .isIn(['true', '1', 'false', '0'])
    .withMessage('withStats must be a boolean')
];

// Typeahead (IMP-112). `q` is deliberately NOT `notEmpty()`: the browser sends an empty one the
// instant the box is cleared, and that is an empty result, not a client error. The length cap
// matches `searchTerm`'s so the two search surfaces cannot disagree about what is too long.
const suggestRules = [
  query('q')
    .optional({ values: 'falsy' })
    .isString()
    .bail()
    .trim()
    .isLength({ max: 200 })
    .withMessage('q must be at most 200 characters'),
  query('limit')
    .optional({ values: 'falsy' })
    .isInt({ min: 1, max: SUGGEST_MAX_LIMIT })
    .withMessage(`limit must be between 1 and ${SUGGEST_MAX_LIMIT}`)
];

const reviewRules = [
  placeIdParam,
  body('rating')
    .exists({ values: 'falsy' })
    .withMessage('Rating is required')
    .bail()
    .isInt({ min: 1, max: 5 })
    .withMessage('Rating must be an integer between 1 and 5')
    .toInt(),
  body('comment')
    .optional({ values: 'falsy' })
    .isString()
    .withMessage('Comment must be text')
    .bail()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('Comment must be at most 2000 characters')
];

const reviewIdParam = param('reviewId')
  .isInt({ min: 1 })
  .withMessage('Review id must be a positive integer');

const imageIdParam = param('imageId')
  .isInt({ min: 1 })
  .withMessage('Image id must be a positive integer');

// Caption arrives as multipart alongside the file, so it is optional and length-capped to the
// column width rather than validated as structured input.
const galleryCaptionRule = body('caption')
  .optional({ values: 'falsy' })
  .trim()
  .isLength({ max: 255 })
  .withMessage('Caption must be at most 255 characters');

const reportRules = [
  placeIdParam,
  reviewIdParam,
  // The current UI reports with a single click and sends no reason; the column and this rule
  // exist so a reason box can be added without touching the schema or the route.
  body('reason')
    .optional({ values: 'falsy' })
    .isString()
    .withMessage('Reason must be text')
    .bail()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Reason must be at most 500 characters')
];

// Public routes
// One handler, two names. `/places` had no validation at all before — it took no parameters, so
// there was nothing to validate; now that it accepts the full filter and pagination surface it
// gets the same rules as `/places/search`, which is the point of routing them to one place.
router.get('/places', searchRules, listRules, handleValidationErrors, placeController.listPlaces);
router.get(
  '/places/search',
  searchRules,
  listRules,
  handleValidationErrors,
  placeController.listPlaces
);
// Typeahead (IMP-112). Must be declared before `/places/:id`, like every other literal segment
// here — Express matches in declaration order, so a `:id` route above this would swallow
// `/places/suggest` and hand "suggest" to a handler expecting an integer (`BUG C2`, guarded by
// `routeShadowing.test.js`).
router.get('/places/suggest', suggestRules, handleValidationErrors, placeController.suggestPlaces);
router.get('/places/locations', placeController.getAllLocations);
router.get('/places/districts', placeController.getDistricts);
router.get('/places/states', placeController.getStates);
router.get('/places/tags', placeController.getTags);
router.get('/places/:id', placeController.getPlaceById);
router.get('/places/:id/image', placeController.getPlaceImage);
router.get('/places/:id/images', placeController.getPlaceImages);
// Real weather (`IMP-110`), keyed on the place's own coordinates. Public: the forecast at a
// tourist site is not private, and the page is server-rendered for crawlers. Deliberately NOT
// `?lat=&lon=` — that would be an open proxy to a third party at our rate limit, from our IP.
router.get('/places/:id/weather', placeIdParam, handleValidationErrors, getPlaceWeather);
router.get('/places/:id/images/:imageId', placeController.getPlaceImage);
// Public, but soft-authenticated: the response never exposes a uid, so ownership of a
// review has to be marked server-side (`is_own`) for the edit UI to be able to find it.
router.get('/places/:id/reviews', attachUserIfPresent, placeController.getPlaceReviews);

// Authenticated routes
router.post(
  '/places/:id/reviews',
  isAuthenticated,
  reviewRules,
  handleValidationErrors,
  placeController.createPlaceReview
);

// Ownership is resolved server-side from the verified token, never from the URL or body — the
// client cannot even see author uids, since the review payload carries an opaque digest.
router.delete(
  '/places/:id/reviews/:reviewId',
  isAuthenticated,
  [placeIdParam, reviewIdParam],
  handleValidationErrors,
  placeController.deletePlaceReview
);

router.post(
  '/places/:id/reviews/:reviewId/report',
  isAuthenticated,
  reportRules,
  handleValidationErrors,
  placeController.reportPlaceReview
);

// Forward geocoding for the admin place forms (IMP-116). Admin-gated because it forwards
// caller-supplied text to a third party at our IP and inside a 1 req/s budget — see the
// controller for why that is still not SSRF.
router.get(
  '/admin/geocode',
  isAdmin,
  query('q')
    .optional({ values: 'falsy' })
    .isString()
    .bail()
    .trim()
    .isLength({ max: 200 })
    .withMessage('q must be at most 200 characters'),
  handleValidationErrors,
  geocodeAddress
);

// Admin routes - the only registration for these URLs. `/api` is mounted before
// `/api/admin` in app.js, so these already shadowed the duplicates that used to
// live in adminRoutes.js; those have been removed.
router.post(
  '/admin/places',
  isAdmin,
  uploadMiddleware('image'),
  placeBodyRules(true),
  handleValidationErrors,
  placeController.createPlace
);
router.put(
  '/admin/places/:id',
  isAdmin,
  uploadMiddleware('image'),
  placeIdParam,
  placeBodyRules(false),
  handleValidationErrors,
  placeController.updatePlace
);
router.delete(
  '/admin/places/:id',
  isAdmin,
  placeIdParam,
  handleValidationErrors,
  placeController.deletePlace
);

// Gallery write path (IMP-014). The read endpoint and lightbox already existed; `place_images`
// simply had no writer, so the gallery rendered from a permanently empty table.
router.post(
  '/admin/places/:id/images',
  isAdmin,
  uploadMiddleware('image'),
  [placeIdParam, galleryCaptionRule],
  handleValidationErrors,
  placeController.addPlaceImage
);
router.delete(
  '/admin/places/:id/images/:imageId',
  isAdmin,
  [placeIdParam, imageIdParam],
  handleValidationErrors,
  placeController.deletePlaceImage
);

module.exports = router;
