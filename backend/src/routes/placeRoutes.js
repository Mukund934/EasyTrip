const express = require('express');
const router = express.Router();
const { body, param, query } = require('express-validator');
const placeController = require('../controllers/placeController');
const { isAuthenticated, isAdmin, attachUserIfPresent } = require('../utils/authMiddleware');
const { uploadMiddleware } = require('../utils/multerConfig');
const { handleValidationErrors } = require('../utils/errorHandler');

// Multipart bodies arrive as strings, so collection fields are JSON text here and
// plain values once a client posts JSON. Both shapes are accepted.
const parseJson = (value) => (typeof value === 'string' ? JSON.parse(value) : value);

const isStringArray = (label, maxEntries, maxLength) => (value) => {
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
  required
    ? requiredText('location', 'Location', 200)
    : optionalText('location', 'Location', 200),
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
  optionalUrl('primary_image_url'),
  optionalUrl('image_url'),
  body('themes').optional({ values: 'falsy' }).custom(isStringArray('themes', 20, 60)),
  body('tags').optional({ values: 'falsy' }).custom(isStringArray('tags', 50, 60)),
  body('custom_keys').optional({ values: 'falsy' }).custom(isFlatObject)
];

// Search accepts the same collection shapes as the write routes (JSON arrays as query text).
// `date` is a season key, not a calendar date — see SEASON_MONTHS in placeModel.
const searchRules = [
  query('searchTerm').optional({ values: 'falsy' }).isString().bail().trim().isLength({ max: 200 })
    .withMessage('searchTerm must be at most 200 characters'),
  query('location').optional({ values: 'falsy' }).isString().bail().trim().isLength({ max: 120 })
    .withMessage('location must be at most 120 characters'),
  query('district').optional({ values: 'falsy' }).isString().bail().trim().isLength({ max: 120 })
    .withMessage('district must be at most 120 characters'),
  query('state').optional({ values: 'falsy' }).isString().bail().trim().isLength({ max: 120 })
    .withMessage('state must be at most 120 characters'),
  query('tags').optional({ values: 'falsy' }).custom(isStringArray('tags', 50, 60)),
  query('themes').optional({ values: 'falsy' }).custom(isStringArray('themes', 20, 60)),
  query('minRating').optional({ values: 'falsy' }).isFloat({ min: 0, max: 5 })
    .withMessage('minRating must be between 0 and 5'),
  query('date').optional({ values: 'falsy' }).isIn(['summer', 'monsoon', 'winter'])
    .withMessage('date must be one of: summer, monsoon, winter')
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

// Public routes
router.get('/places', placeController.getAllPlaces);
router.get('/places/search', searchRules, handleValidationErrors, placeController.searchPlaces);
router.get('/places/locations', placeController.getAllLocations);
router.get('/places/districts', placeController.getDistricts);
router.get('/places/states', placeController.getStates);
router.get('/places/tags', placeController.getTags);
router.get('/places/:id', placeController.getPlaceById);
router.get('/places/:id/image', placeController.getPlaceImage);
router.get('/places/:id/images', placeController.getPlaceImages);
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

module.exports = router;
