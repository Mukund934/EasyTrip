const express = require('express');
const { updateProfile, getProfile } = require('../controllers/userController');
const { verifyToken } = require('../utils/authMiddleware');

const router = express.Router();

// Get user profile
router.get('/profile', verifyToken, getProfile);

// Update user profile
router.put('/profile', verifyToken, updateProfile);

module.exports = router;