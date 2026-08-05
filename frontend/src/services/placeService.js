import axios from 'axios';
import { auth } from '../config/firebase';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

/**
 * Build the Authorization header for an authenticated request.
 * An explicit token from the caller wins; otherwise ask the Firebase SDK for a
 * fresh one, so a long-lived tab never sends a stale token.
 */
const authHeaders = async (token) => {
  let idToken = token;

  if (!idToken && auth.currentUser) {
    idToken = await auth.currentUser.getIdToken();
  }

  if (!idToken) {
    throw {
      message: 'You must be signed in to perform this action.',
      status: 401
    };
  }

  return { Authorization: `Bearer ${idToken}` };
};

/**
 * Get all places
 */
const getAllPlaces = async () => {
  try {
    console.log('Getting all places');

    const response = await axios.get(`${API_URL}/places`);

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
    console.log(`Getting place ID ${id}`);

    const response = await axios.get(`${API_URL}/places/${id}`);

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
    console.log('Searching places with criteria:', criteria);

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

    const response = await axios.get(`${API_URL}/places/search?${params.toString()}`);

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
    console.log('Getting locations');

    const response = await axios.get(`${API_URL}/places/locations`);

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
    console.log('Getting districts');

    const response = await axios.get(`${API_URL}/places/districts`);

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
    console.log('Getting states');

    const response = await axios.get(`${API_URL}/places/states`);

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
    console.log('Getting tags');

    const response = await axios.get(`${API_URL}/places/tags`);

    console.log(`Tags fetched: ${response.data.length} items`);
    return response.data;
  } catch (error) {
    console.error('Error fetching tags:', error.response?.data || error.message);
    throw new Error('Failed to fetch tags');
  }
};

/**
 * Create place (admin)
 * @param {Object} placeData - Place data
 * @param {String} [token] - Firebase ID token; resolved from the SDK when omitted
 */
const createPlace = async (placeData, token) => {
  const headers = await authHeaders(token);

  try {
    console.log(`Creating place: ${placeData.name}`);

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

    // Upload progress tracking
    const onUploadProgress = (progressEvent) => {
      if (placeData.image && progressEvent.total) {
        const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        console.log(`Upload progress: ${percentCompleted}%`);
      }
    };

    const response = await axios.post(`${API_URL}/admin/places`, formData, {
      headers,
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
 * Update place (admin)
 * @param {Number|String} id - Place ID
 * @param {Object} placeData - Place data
 * @param {String} [token] - Firebase ID token; resolved from the SDK when omitted
 */
const updatePlace = async (id, placeData, token) => {
  const headers = await authHeaders(token);

  try {
    console.log(`Updating place ${id}`);

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

    // Upload progress tracking
    const onUploadProgress = (progressEvent) => {
      if (placeData.image && progressEvent.total) {
        const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        console.log(`Update upload progress: ${percentCompleted}%`);
      }
    };

    const response = await axios.put(`${API_URL}/admin/places/${id}`, formData, {
      headers,
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
 * Delete place (admin)
 * @param {Number|String} id - Place ID
 * @param {String} [token] - Firebase ID token; resolved from the SDK when omitted
 */
const deletePlace = async (id, token) => {
  const headers = await authHeaders(token);

  try {
    console.log(`Deleting place ${id}`);

    const response = await axios.delete(`${API_URL}/admin/places/${id}`, { headers });

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
 * Get place reviews.
 *
 * The endpoint is public, so this never requires a token — but when one is available
 * the server soft-authenticates the request and flags the caller's own review with
 * `is_own`. That flag is the only way the client can recognise its own review, since
 * the payload's `user_id` is an opaque per-place digest rather than a Firebase uid.
 *
 * @param {Number|String} id - Place ID
 * @param {String} [token] - Firebase ID token; resolved from the SDK when omitted
 */
const getPlaceReviews = async (id, token) => {
  try {
    console.log(`Getting reviews for place ${id}`);

    let idToken = token;
    if (!idToken && auth.currentUser) {
      idToken = await auth.currentUser.getIdToken().catch(() => null);
    }

    const response = await axios.get(
      `${API_URL}/places/${id}/reviews`,
      idToken ? { headers: { Authorization: `Bearer ${idToken}` } } : undefined
    );

    console.log(`Reviews fetched: ${response.data.length} items`);
    return response.data;
  } catch (error) {
    console.error(`Error fetching reviews for place ${id}:`, error.response?.data || error.message);
    throw new Error('Failed to fetch reviews');
  }
};

/**
 * Create place review
 * @param {Number|String} id - Place ID
 * @param {Object} reviewData - { rating, comment }
 * @param {String} [token] - Firebase ID token; resolved from the SDK when omitted
 */
const createPlaceReview = async (id, reviewData, token) => {
  const headers = await authHeaders(token);

  try {
    console.log(`Creating review for place ${id}`);

    // Only the review itself travels on the wire; the author is derived from the
    // verified token server-side, so any client-supplied identity is dropped here.
    const payload = {
      rating: reviewData.rating,
      comment: reviewData.comment
    };

    const response = await axios.post(`${API_URL}/places/${id}/reviews`, payload, { headers });

    console.log(`Review created successfully for place ${id}`);
    return response.data;
  } catch (error) {
    console.error(`Error creating review for place ${id}:`, error.response?.data || error.message);
    // A 400 from the validator arrives as { message: 'Validation failed', errors: [...] };
    // the field message is the one worth showing the reviewer.
    throw {
      message:
        error.response?.data?.errors?.[0]?.message ||
        error.response?.data?.message ||
        'Error creating review',
      status: error.response?.status
    };
  }
};

/**
 * Delete the caller's own review.
 *
 * There is no `PUT` counterpart by design: re-submitting through `createPlaceReview` upserts,
 * so editing already has exactly one path. Ownership is enforced server-side from the token —
 * the client cannot pass an author, and a review belonging to someone else returns 403.
 *
 * @param {Number|String} id - Place ID
 * @param {Number|String} reviewId - Review ID (the `id` field of the review payload)
 * @param {String} [token] - Firebase ID token; resolved from the SDK when omitted
 */
const deletePlaceReview = async (id, reviewId, token) => {
  const headers = await authHeaders(token);

  try {
    console.log(`Deleting review ${reviewId} for place ${id}`);

    await axios.delete(`${API_URL}/places/${id}/reviews/${reviewId}`, { headers });

    console.log(`Review ${reviewId} deleted`);
    return true;
  } catch (error) {
    console.error(`Error deleting review ${reviewId}:`, error.response?.data || error.message);
    throw {
      message: error.response?.data?.message || 'Error deleting review',
      status: error.response?.status
    };
  }
};

/**
 * Report a review for moderation.
 *
 * Reporting the same review twice is a no-op server-side rather than an error, so the caller
 * does not need to track whether it has already been reported.
 *
 * @param {Number|String} id - Place ID
 * @param {Number|String} reviewId - Review ID
 * @param {String} [reason] - Optional free-text reason; no UI sends one yet
 * @param {String} [token] - Firebase ID token; resolved from the SDK when omitted
 */
const reportPlaceReview = async (id, reviewId, reason, token) => {
  const headers = await authHeaders(token);

  try {
    console.log(`Reporting review ${reviewId} for place ${id}`);

    const response = await axios.post(
      `${API_URL}/places/${id}/reviews/${reviewId}/report`,
      reason ? { reason } : {},
      { headers }
    );

    return response.data;
  } catch (error) {
    console.error(`Error reporting review ${reviewId}:`, error.response?.data || error.message);
    throw {
      message:
        error.response?.data?.errors?.[0]?.message ||
        error.response?.data?.message ||
        'Error reporting review',
      status: error.response?.status
    };
  }
};

/**
 * Add a gallery image to a place (admin).
 *
 * @param {Number|String} id - Place ID
 * @param {File} file - Image file
 * @param {String} [caption] - Optional caption
 * @param {String} [token] - Firebase ID token; resolved from the SDK when omitted
 */
const addPlaceImage = async (id, file, caption, token) => {
  const headers = await authHeaders(token);

  try {
    const formData = new FormData();
    formData.append('image', file);
    if (caption) formData.append('caption', caption);

    const response = await axios.post(`${API_URL}/admin/places/${id}/images`, formData, { headers });

    console.log(`Gallery image added to place ${id}`);
    return response.data;
  } catch (error) {
    console.error(`Error adding gallery image to place ${id}:`, error.response?.data || error.message);
    throw {
      message:
        error.response?.data?.errors?.[0]?.message ||
        error.response?.data?.message ||
        'Error adding gallery image',
      status: error.response?.status
    };
  }
};

/**
 * Remove a gallery image from a place (admin).
 *
 * @param {Number|String} id - Place ID
 * @param {Number|String} imageId - Image ID
 * @param {String} [token] - Firebase ID token; resolved from the SDK when omitted
 */
const deletePlaceImage = async (id, imageId, token) => {
  const headers = await authHeaders(token);

  try {
    await axios.delete(`${API_URL}/admin/places/${id}/images/${imageId}`, { headers });
    console.log(`Gallery image ${imageId} removed from place ${id}`);
    return true;
  } catch (error) {
    console.error(`Error deleting gallery image ${imageId}:`, error.response?.data || error.message);
    throw {
      message: error.response?.data?.message || 'Error deleting gallery image',
      status: error.response?.status
    };
  }
};

/**
 * Get place images
 */
const getPlaceImages = async (id) => {
  try {
    console.log(`Getting images for place ${id}`);

    const response = await axios.get(`${API_URL}/places/${id}/images`);

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
  deletePlaceReview,
  reportPlaceReview,
  getPlaceImages,
  addPlaceImage,
  deletePlaceImage
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
  deletePlaceReview,
  reportPlaceReview,
  getPlaceImages,
  addPlaceImage,
  deletePlaceImage
};
