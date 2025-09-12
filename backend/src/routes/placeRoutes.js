const express = require('express');
const router = express.Router();
const placeController = require('../controllers/placeController');
const { isAuthenticated, isAdmin } = require('../utils/authMiddleware');
const { uploadMiddleware } = require('../config/cloudinary');

// Public routes
router.get('/places', placeController.getAllPlaces);
router.get('/places/search', placeController.searchPlaces);
router.get('/places/locations', placeController.getAllLocations);
router.get('/places/districts', placeController.getDistricts);
router.get('/places/states', placeController.getStates);
router.get('/places/tags', placeController.getTags);
router.get('/places/:id', placeController.getPlaceById);
router.get('/places/:id/image', placeController.getPlaceImage);
router.get('/places/:id/images', placeController.getPlaceImages);
router.get('/places/:id/images/:imageId', placeController.getPlaceImage);
router.get('/places/:id/reviews', placeController.getPlaceReviews);

// Authenticated routes
router.post('/places/:id/reviews', isAuthenticated, placeController.createPlaceReview);

// Admin routes - using Cloudinary's upload middleware
router.post('/admin/places', isAdmin, uploadMiddleware.single('image'), placeController.createPlace);
router.put('/admin/places/:id', isAdmin, uploadMiddleware.single('image'), placeController.updatePlace);
router.delete('/admin/places/:id', isAdmin, placeController.deletePlace);

module.exports = router;