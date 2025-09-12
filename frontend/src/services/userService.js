import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

/**
 * Update user profile
 * @param {String} token - Firebase ID token
 * @param {Object} userData - User data
 * @returns {Promise<Object>} - API response
 */
const updateProfile = async (token, userData) => {
  try {
    const response = await axios.put(`${API_URL}/users/profile`, userData, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });
    
    return response.data;
  } catch (error) {
    throw error.response?.data || { success: false, message: error.message };
  }
};

/**
 * Get user profile
 * @param {String} token - Firebase ID token
 * @returns {Promise<Object>} - API response
 */
const getProfile = async (token) => {
  try {
    const response = await axios.get(`${API_URL}/users/profile`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    
    return response.data;
  } catch (error) {
    throw error.response?.data || { success: false, message: error.message };
  }
};

export const userService = {
  updateProfile,
  getProfile,
};