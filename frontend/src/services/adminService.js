import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

/**
 * Add a new place
 * @param {String} token - Firebase ID token
 * @param {Object} placeData - Place data
 * @returns {Promise<Object>} - API response
 */
const addPlace = async (token, placeData) => {
  try {
    // Create form data for file upload
    const formData = new FormData();
    
    // Add text fields
    formData.append('name', placeData.name);
    formData.append('location', placeData.location);
    if (placeData.description) formData.append('description', placeData.description);
    if (placeData.tags) formData.append('tags', JSON.stringify(placeData.tags));
    if (placeData.custom_keys) formData.append('custom_keys', JSON.stringify(placeData.custom_keys));
    
    // Add image if exists
    if (placeData.image) formData.append('image', placeData.image);
    
    const response = await axios.post(`${API_URL}/admin/places`, formData, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'multipart/form-data',
      },
    });
    
    return response.data;
  } catch (error) {
    throw error.response?.data || { success: false, message: error.message };
  }
};

/**
 * Update a place
 * @param {String} token - Firebase ID token
 * @param {Number} id - Place ID
 * @param {Object} placeData - Place data
 * @returns {Promise<Object>} - API response
 */
const updatePlace = async (token, id, placeData) => {
  try {
    // Create form data for file upload
    const formData = new FormData();
    
    // Add text fields
    if (placeData.name) formData.append('name', placeData.name);
    if (placeData.location) formData.append('location', placeData.location);
    if (placeData.description) formData.append('description', placeData.description);
    if (placeData.tags) formData.append('tags', JSON.stringify(placeData.tags));
    if (placeData.custom_keys) formData.append('custom_keys', JSON.stringify(placeData.custom_keys));
    
    // Add image if exists
    if (placeData.image) formData.append('image', placeData.image);
    
    const response = await axios.put(`${API_URL}/admin/places/${id}`, formData, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'multipart/form-data',
      },
    });
    
    return response.data;
  } catch (error) {
    throw error.response?.data || { success: false, message: error.message };
  }
};

/**
 * Delete a place
 * @param {String} token - Firebase ID token
 * @param {Number} id - Place ID
 * @returns {Promise<Object>} - API response
 */
const deletePlace = async (token, id) => {
  try {
    const response = await axios.delete(`${API_URL}/admin/places/${id}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    
    return response.data;
  } catch (error) {
    throw error.response?.data || { success: false, message: error.message };
  }
};

/**
 * Add a new admin
 * @param {String} token - Firebase ID token
 * @param {String} email - Admin email
 * @returns {Promise<Object>} - API response
 */
const addAdmin = async (token, email) => {
  try {
    const response = await axios.post(
      `${API_URL}/admin/admins`,
      { email },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      }
    );
    
    return response.data;
  } catch (error) {
    throw error.response?.data || { success: false, message: error.message };
  }
};

/**
 * Remove an admin
 * @param {String} token - Firebase ID token
 * @param {String} email - Admin email
 * @returns {Promise<Object>} - API response
 */
const removeAdmin = async (token, email) => {
  try {
    const response = await axios.delete(`${API_URL}/admin/admins/${email}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    
    return response.data;
  } catch (error) {
    throw error.response?.data || { success: false, message: error.message };
  }
};

/**
 * Get all admins
 * @param {String} token - Firebase ID token
 * @returns {Promise<Object>} - API response
 */
const getAllAdmins = async (token) => {
  try {
    const response = await axios.get(`${API_URL}/admin/admins`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    
    return response.data;
  } catch (error) {
    throw error.response?.data || { success: false, message: error.message };
  }
};

export const adminService = {
  addPlace,
  updatePlace,
  deletePlace,
  addAdmin,
  removeAdmin,
  getAllAdmins,
};