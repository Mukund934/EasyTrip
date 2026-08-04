const express = require('express');
const router = express.Router();
const { body, param } = require('express-validator');
const { isAdmin } = require('../utils/authMiddleware');
const { handleValidationErrors } = require('../utils/errorHandler');
const {
  getAllAdmins,
  addAdmin,
  removeAdmin,
} = require('../controllers/adminController');

// Place CRUD is registered once, in placeRoutes.js. It used to be declared here as
// well, with a different multer storage engine, and only the `/api` mount order in
// app.js decided which one ran.

// Admin management routes
router.get('/admins', isAdmin, getAllAdmins);
router.post(
  '/admins',
  isAdmin,
  body('email')
    .trim()
    .isEmail()
    .withMessage('A valid email address is required')
    .bail()
    .isLength({ max: 254 })
    .withMessage('Email must be at most 254 characters'),
  handleValidationErrors,
  addAdmin
);
router.delete(
  '/admins/:email',
  isAdmin,
  param('email')
    .trim()
    .isEmail()
    .withMessage('A valid email address is required'),
  handleValidationErrors,
  removeAdmin
);

module.exports = router;
