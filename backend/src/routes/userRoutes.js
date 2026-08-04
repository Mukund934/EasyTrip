const express = require('express');
const { body } = require('express-validator');
const { updateProfile, getProfile } = require('../controllers/userController');
// authMiddleware exports the gate as `isAuthenticated`; the old `verifyToken`
// import resolved to undefined and would have thrown on router setup.
const { isAuthenticated } = require('../utils/authMiddleware');
const { handleValidationErrors } = require('../utils/errorHandler');

const router = express.Router();

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

// Get user profile
router.get('/profile', isAuthenticated, getProfile);

// Update user profile
router.put('/profile', isAuthenticated, profileRules, handleValidationErrors, updateProfile);

module.exports = router;
