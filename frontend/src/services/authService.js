import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

/**
 * Register a new user
 * @param {String} token - Firebase ID token
 * @param {Object} userData - User data
 * @returns {Promise<Object>} - API response
 */
const registerUser = async (token, userData) => {
  try {
    const response = await axios.post(`${API_URL}/auth/register`, userData, {
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
 * Get current user data
 * @param {String} token - Firebase ID token
 * @returns {Promise<Object>} - API response
 */
const getCurrentUser = async (token) => {
  try {
    const response = await axios.get(`${API_URL}/auth/me`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    
    return response.data;
  } catch (error) {
    throw error.response?.data || { success: false, message: error.message };
  }
};

export const authService = {
  registerUser,
  getCurrentUser,
};