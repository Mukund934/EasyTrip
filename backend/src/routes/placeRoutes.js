const express = require('express');
const router = express.Router();
const { query } = require('express-validator');
const placeController = require('../controllers/placeController');
const placeFitController = require('../controllers/placeFitController');
const { isAuthenticated, isAdmin, attachUserIfPresent } = require('../utils/authMiddleware');
const { uploadMiddleware } = require('../utils/multerConfig');
const { handleValidationErrors } = require('../utils/errorHandler');
const { getPlaceWeather } = require('../controllers/weatherController');
const { geocodeAddress } = require('../controllers/geocodeController');
const {
  placeIdParam,
  reviewIdParam,
  imageIdParam,
  galleryCaptionRule,
  placeBodyRules,
  searchRules,
  listRules,
  suggestRules,
  reviewRules,
  reportRules,
  fitQueryRules
} = require('./placeValidators');

// Multipart bodies arrive as strings, so collection fields are JSON text here and
// plain values once a client posts JSON. Both shapes are accepted.

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
// `FV-028` stage (d). Public and read-only. The response carries its own working - every factor
// that counted, every one that could not, and the coverage the score was computed over.
router.get(
  '/places/:id/fit',
  placeIdParam,
  fitQueryRules,
  handleValidationErrors,
  placeFitController.getPlaceFit
);
// `FV-028` stage (c). Public and read-only. Returns [] rather than 404 when the place has no curated
// crowd level - "nobody has judged this" is an answer, not a missing resource.
router.get(
  '/places/:id/quieter-nearby',
  placeIdParam,
  handleValidationErrors,
  placeController.getQuieterNearby
);
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
