const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { isAuthenticated, isAuthenticatedStrict } = require('../utils/authMiddleware');
const { handleValidationErrors } = require('../utils/errorHandler');

const {
  getProfile,
  updateProfile,
  checkAdmin,
} = require('../controllers/authController');

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

// Auth routes
router.get('/profile', isAuthenticated, getProfile);
router.put('/profile', isAuthenticated, profileRules, handleValidationErrors, updateProfile);
// Strict (revocation-checking) auth: this answer decides whether the admin pages are
// rendered at all, so it has to cost the same verification the isAdmin API gate pays.
router.get('/check-admin', isAuthenticatedStrict, checkAdmin);

module.exports = router;
