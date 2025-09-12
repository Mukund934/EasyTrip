const express = require('express');
const router = express.Router();
const { isAuthenticated, isAdmin } = require('../utils/authMiddleware');

const {
  getProfile,
  updateProfile,
  checkAdmin,
} = require('../controllers/authController');

// Auth routes
router.get('/profile', isAuthenticated, getProfile);
router.put('/profile', isAuthenticated, updateProfile);
router.get('/check-admin', isAuthenticated, checkAdmin);

module.exports = router;