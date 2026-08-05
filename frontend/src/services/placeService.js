import axios from 'axios';
import { auth } from '../config/firebase';
import {
  fetchPlaceById,
  fetchPlaceImages,
  fetchLocations,
  fetchDistricts,
  fetchStates,
  fetchTags
} from './placesApi';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

/**
 * This module now holds only what needs a Firebase ID token. The public reads moved to
 * `placesApi.js` so the server-rendering paths can call them without importing
 * `../config/firebase`, which this file initialises at module scope (IMP-040).
 *
 * The read names below are re-exported rather than reimplemented: one implementation, one place
 * for a bug to live, and no import churn in the admin pages that already call them.
 *
 * `getAllPlaces` and `searchPlaces` are deliberately *not* here any more. Both returned a bare
 * array; the endpoint now returns `{ data, pagination }`, and a function that quietly discarded
 * the pagination half would hand callers a page while letting them believe it was the catalogue.
 * Callers use `fetchPlaces` from `placesApi` instead.
 */
const getPlaceById = fetchPlaceById;
const getPlaceImages = fetchPlaceImages;
const getLocations = fetchLocations;
const getDistricts = fetchDistricts;
const getStates = fetchStates;
const getTags = fetchTags;

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

// Export all functions
export default {
  getPlaceById,
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
  getPlaceById,
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
