const express = require('express');
const router = express.Router();
const { upload } = require('../utils/multerConfig');
const { isAdmin } = require('../utils/authMiddleware');
const {
  createPlace,
  updatePlace,
  deletePlace
} = require('../controllers/placeController');
const {
  getAllAdmins,
  addAdmin,
  removeAdmin,
} = require('../controllers/adminController');

// Place routes (Admin only)
router.post('/places', isAdmin, upload.single('image'), createPlace);
router.put('/places/:id', isAdmin, upload.single('image'), updatePlace);
router.delete('/places/:id', isAdmin, deletePlace);

// Admin management routes
router.get('/admins', isAdmin, getAllAdmins);
router.post('/admins', isAdmin, addAdmin);
router.delete('/admins/:email', isAdmin, removeAdmin);

module.exports = router;