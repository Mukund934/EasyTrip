const axios = require('axios');
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

// Helper to get current user from auth context or localStorage
const getCurrentUser = () => {
  // In browser environment
  if (typeof window !== 'undefined') {
    // Try to get from localStorage first
    const storedUser = localStorage.getItem('currentUser');
    
    // For development - prioritize AdminX
    if (process.env.NODE_ENV === 'development') {
      return 'AdminX';
    }
    
    return storedUser || 'anonymous_user';
  }
  
  // In server environment
  return 'server_side';
};

// Helper to get current user name
const getCurrentUserName = () => {
  if (typeof window !== 'undefined') {
    const storedUserName = localStorage.getItem('currentUserName');
    
    // For development
    if (process.env.NODE_ENV === 'development') {
      return 'AdminX';
    }
    
    return storedUserName || 'Anonymous User';
  }
  
  return 'Server';
};

/**
 * Get all places
 */
const getAllPlaces = async () => {
  try {
    const timestamp = new Date().toISOString();
    const user = getCurrentUser();
    
    console.log(`Getting all places at ${timestamp} by ${user}`);
    
    const response = await axios.get(`${API_URL}/places`, {
      headers: {
        'X-User': user,
        'X-User-Name': getCurrentUserName(),
        'X-Timestamp': timestamp
      }
    });
    
    console.log(`Places fetched successfully: ${response.data.length} items`);
    if (response.data.length > 0) {
      console.log(`First place preview:`, {
        id: response.data[0].id,
        name: response.data[0].name,
        location: response.data[0].location,
        hasImage: !!response.data[0].primary_image_url,
        tagsCount: response.data[0].tags ? response.data[0].tags.length : 0
      });
    }
    
    return response.data;
  } catch (error) {
    console.error('Error fetching places:', error.response?.data || error.message);
    throw new Error('Failed to fetch places');
  }
};

/**
 * Get place by ID
 */
const getPlaceById = async (id) => {
  try {
    const timestamp = new Date().toISOString();
    const user = getCurrentUser();
    
    console.log(`Getting place ID ${id} at ${timestamp} by ${user}`);
    
    const response = await axios.get(`${API_URL}/places/${id}`, {
      headers: {
        'X-User': user,
        'X-User-Name': getCurrentUserName(),
        'X-Timestamp': timestamp
      }
    });
    
    console.log(`Place ID ${id} fetched successfully: ${response.data.name}`);
    console.log(`Image source: ${response.data.primary_image_url ? 'Cloudinary' : 'API Endpoint'}`);
    
    return response.data;
  } catch (error) {
    console.error(`Error fetching place ${id}:`, error.response?.data || error.message);
    throw {
      message: error.response?.data?.message || 'Place not found',
      status: error.response?.status || 404
    };
  }
};

/**
 * Search places
 */
const searchPlaces = async (criteria) => {
  try {
    const timestamp = new Date().toISOString();
    const user = getCurrentUser();
    
    console.log(`Searching places at ${timestamp} by ${user} with criteria:`, criteria);
    
    // Build query string
    const params = new URLSearchParams();
    Object.entries(criteria).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        if (Array.isArray(value)) {
          params.append(key, JSON.stringify(value));
        } else {
          params.append(key, value);
        }
      }
    });
    
    const response = await axios.get(`${API_URL}/places/search?${params.toString()}`, {
      headers: {
        'X-User': user,
        'X-User-Name': getCurrentUserName(),
        'X-Timestamp': timestamp
      }
    });
    
    console.log(`Search returned ${response.data.length} places`);
    return response.data;
  } catch (error) {
    console.error('Error searching places:', error.response?.data || error.message);
    throw new Error('Failed to search places');
  }
};

/**
 * Get locations
 */
const getLocations = async () => {
  try {
    const timestamp = new Date().toISOString();
    const user = getCurrentUser();
    
    console.log(`Getting locations at ${timestamp} by ${user}`);
    
    const response = await axios.get(`${API_URL}/places/locations`, {
      headers: {
        'X-User': user,
        'X-User-Name': getCurrentUserName(),
        'X-Timestamp': timestamp
      }
    });
    
    console.log(`Locations fetched: ${response.data.length} items`);
    return response.data;
  } catch (error) {
    console.error('Error fetching locations:', error.response?.data || error.message);
    throw new Error('Failed to fetch locations');
  }
};

/**
 * Get districts
 */
const getDistricts = async () => {
  try {
    const timestamp = new Date().toISOString();
    const user = getCurrentUser();
    
    console.log(`Getting districts at ${timestamp} by ${user}`);
    
    const response = await axios.get(`${API_URL}/places/districts`, {
      headers: {
        'X-User': user,
        'X-User-Name': getCurrentUserName(),
        'X-Timestamp': timestamp
      }
    });
    
    console.log(`Districts fetched: ${response.data.length} items`);
    return response.data;
  } catch (error) {
    console.error('Error fetching districts:', error.response?.data || error.message);
    throw new Error('Failed to fetch districts');
  }
};

/**
 * Get states
 */
const getStates = async () => {
  try {
    const timestamp = new Date().toISOString();
    const user = getCurrentUser();
    
    console.log(`Getting states at ${timestamp} by ${user}`);
    
    const response = await axios.get(`${API_URL}/places/states`, {
      headers: {
        'X-User': user,
        'X-User-Name': getCurrentUserName(),
        'X-Timestamp': timestamp
      }
    });
    
    console.log(`States fetched: ${response.data.length} items`);
    return response.data;
  } catch (error) {
    console.error('Error fetching states:', error.response?.data || error.message);
    throw new Error('Failed to fetch states');
  }
};

/**
 * Get tags
 */
const getTags = async () => {
  try {
    const timestamp = new Date().toISOString();
    const user = getCurrentUser();
    
    console.log(`Getting tags at ${timestamp} by ${user}`);
    
    const response = await axios.get(`${API_URL}/places/tags`, {
      headers: {
        'X-User': user,
        'X-User-Name': getCurrentUserName(),
        'X-Timestamp': timestamp
      }
    });
    
    console.log(`Tags fetched: ${response.data.length} items`);
    return response.data;
  } catch (error) {
    console.error('Error fetching tags:', error.response?.data || error.message);
    throw new Error('Failed to fetch tags');
  }
};

/**
 * Create place
 */
const createPlace = async (placeData) => {
  try {
    const timestamp = new Date().toISOString();
    const user = getCurrentUser();
    
    console.log(`Creating place at ${timestamp} by ${user}: ${placeData.name}`);
    
    const formData = new FormData();
    
    // Add image if present
    if (placeData.image) {
      formData.append('image', placeData.image);
      console.log(`Uploading primary image: ${placeData.image.name}, ${placeData.image.type}, ${Math.round(placeData.image.size/1024)} KB`);
    }
    
    // Add all other fields to formData
    Object.entries(placeData).forEach(([key, value]) => {
      if (key !== 'image' && value !== undefined && value !== null) {
        if (typeof value === 'object' && !(value instanceof File)) {
          formData.append(key, JSON.stringify(value));
        } else {
          formData.append(key, value);
        }
        console.log(`Form field - ${key}: ${typeof value === 'object' ? JSON.stringify(value) : value}`);
      }
    });
    
    // Add audit fields
    formData.append('created_by', user);
    formData.append('created_at', timestamp);
    
    // Upload progress tracking
    const onUploadProgress = (progressEvent) => {
      if (placeData.image && progressEvent.total) {
        const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        console.log(`Upload progress: ${percentCompleted}%`);
      }
    };
    
    const response = await axios.post(`${API_URL}/admin/places`, formData, {
      headers: {
        'X-User': 'AdminX', // Hardcode for admin operations
        'X-User-Name': 'AdminX',
        'X-Timestamp': timestamp
      },
      onUploadProgress
    });
    
    console.log(`Place created successfully: ID=${response.data.id}, Name=${response.data.name}`);
    return response.data;
  } catch (error) {
    console.error('Error creating place:', {
      message: error.response?.data?.message || error.message,
      status: error.response?.status,
      responseData: error.response?.data,
      timestamp: new Date().toISOString()
    });
    
    throw {
      message: error.response?.data?.message || 'Server error - please try again. If the problem persists, contact support',
      response: error.response,
      status: error.response?.status
    };
  }
};

/**
 * Update place
 */
const updatePlace = async (id, placeData) => {
  try {
    const timestamp = new Date().toISOString();
    const user = getCurrentUser();
    
    console.log(`Updating place ${id} at ${timestamp} by ${user}`);
    
    const formData = new FormData();
    
    // Add image if present
    if (placeData.image) {
      formData.append('image', placeData.image);
      console.log(`Uploading updated image: ${placeData.image.name}, ${Math.round(placeData.image.size/1024)} KB`);
    }
    
    // Add all other fields to formData
    Object.entries(placeData).forEach(([key, value]) => {
      if (key !== 'image' && value !== undefined && value !== null) {
        if (typeof value === 'object' && !(value instanceof File)) {
          formData.append(key, JSON.stringify(value));
        } else {
          formData.append(key, value);
        }
      }
    });
    
    // Add audit fields
    formData.append('updated_by', user);
    formData.append('updated_at', timestamp);
    
    // Upload progress tracking
    const onUploadProgress = (progressEvent) => {
      if (placeData.image && progressEvent.total) {
        const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        console.log(`Update upload progress: ${percentCompleted}%`);
      }
    };
    
    const response = await axios.put(`${API_URL}/admin/places/${id}`, formData, {
      headers: {
        'X-User': 'AdminX', // Hardcode for admin operations
        'X-User-Name': 'AdminX',
        'X-Timestamp': timestamp
      },
      onUploadProgress
    });
    
    console.log(`Place updated successfully: ID=${response.data.id}, Name=${response.data.name}`);
    return response.data;
  } catch (error) {
    console.error(`Error updating place ${id}:`, {
      message: error.response?.data?.message || error.message,
      status: error.response?.status,
      responseData: error.response?.data
    });
    
    throw {
      message: error.response?.data?.message || 'Error updating place',
      status: error.response?.status,
      responseData: error.response?.data
    };
  }
};

/**
 * Delete place
 */
const deletePlace = async (id) => {
  try {
    const timestamp = new Date().toISOString();
    const user = getCurrentUser();
    
    console.log(`Deleting place ${id} at ${timestamp} by ${user}`);
    
    const response = await axios.delete(`${API_URL}/admin/places/${id}`, {
      headers: {
        'X-User': 'AdminX', // Hardcode for admin operations
        'X-User-Name': 'AdminX',
        'X-Timestamp': timestamp
      }
    });
    
    console.log(`Place deleted successfully: ID=${id}`);
    return response.data;
  } catch (error) {
    console.error(`Error deleting place ${id}:`, error.response?.data || error.message);
    throw {
      message: error.response?.data?.message || 'Error deleting place',
      status: error.response?.status
    };
  }
};

/**
 * Get place reviews
 */
const getPlaceReviews = async (id) => {
  try {
    const timestamp = new Date().toISOString();
    const user = getCurrentUser();
    
    console.log(`Getting reviews for place ${id} at ${timestamp} by ${user}`);
    
    const response = await axios.get(`${API_URL}/places/${id}/reviews`, {
      headers: {
        'X-User': user,
        'X-User-Name': getCurrentUserName(),
        'X-Timestamp': timestamp
      }
    });
    
    console.log(`Reviews fetched: ${response.data.length} items`);
    return response.data;
  } catch (error) {
    console.error(`Error fetching reviews for place ${id}:`, error.response?.data || error.message);
    throw new Error('Failed to fetch reviews');
  }
};

/**
 * Create place review
 */
const createPlaceReview = async (id, reviewData) => {
  try {
    const timestamp = new Date().toISOString();
    const user = getCurrentUser();
    
    console.log(`Creating review for place ${id} at ${timestamp} by ${user}`);
    
    const response = await axios.post(`${API_URL}/places/${id}/reviews`, reviewData, {
      headers: {
        'X-User': user,
        'X-User-Name': getCurrentUserName(),
        'X-Timestamp': timestamp
      }
    });
    
    console.log(`Review created successfully for place ${id}`);
    return response.data;
  } catch (error) {
    console.error(`Error creating review for place ${id}:`, error.response?.data || error.message);
    throw {
      message: error.response?.data?.message || 'Error creating review',
      status: error.response?.status
    };
  }
};

/**
 * Get place images
 */
const getPlaceImages = async (id) => {
  try {
    const timestamp = new Date().toISOString();
    const user = getCurrentUser();
    
    console.log(`Getting images for place ${id} at ${timestamp} by ${user}`);
    
    const response = await axios.get(`${API_URL}/places/${id}/images`, {
      headers: {
        'X-User': user,
        'X-User-Name': getCurrentUserName(),
        'X-Timestamp': timestamp
      }
    });
    
    console.log(`Images fetched: ${response.data.length} items`);
    return response.data;
  } catch (error) {
    console.error(`Error fetching images for place ${id}:`, error.response?.data || error.message);
    throw new Error('Failed to fetch images');
  }
};

// Export all functions
export default {
  getAllPlaces,
  getPlaceById,
  searchPlaces,
  getLocations,
  getDistricts,
  getStates,
  getTags,
  createPlace,
  updatePlace,
  deletePlace,
  getPlaceReviews,
  createPlaceReview,
  getPlaceImages
};

// Named exports for direct imports
export {
  getAllPlaces,
  getPlaceById,
  searchPlaces,
  getLocations,
  getDistricts,
  getStates,
  getTags,
  createPlace,
  updatePlace,
  deletePlace,
  getPlaceReviews,
  createPlaceReview,
  getPlaceImages
};