const userModel = require('../models/userModel');

/**
 * Update user profile
 * @route PUT /api/users/profile
 */
const updateProfile = async (req, res, next) => {
  try {
    const { uid } = req.user;
    const { name, location, dob } = req.body;
    
    // Update user in our database
    const updatedUser = await userModel.updateUser(uid, {
      name,
      location,
      dob,
    });
    
    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        user: updatedUser,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get user profile
 * @route GET /api/users/profile
 */
const getProfile = async (req, res, next) => {
  try {
    const { uid } = req.user;
    
    // Get user from our database
    const user = await userModel.getUserByFirebaseUid(uid);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }
    
    res.status(200).json({
      success: true,
      data: {
        user,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  updateProfile,
  getProfile,
};