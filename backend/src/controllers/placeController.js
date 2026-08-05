const pool = require('../config/db');
const fs = require('fs');
const crypto = require('crypto');
const placeModel = require('../models/placeModel');
const { uploadImage, destroyImage, destroyPlaceAssets, publicIdFromUrl } = require('../config/cloudinary');


// Get current user from request.
// Identity comes only from the token the auth middleware verified: the former x-user /
// x-user-name header fallbacks were client-supplied, so any caller could attribute a write
// to any identity they liked (SECURITY_AUDIT M6).
const getCurrentUser = (req) => {
  return req.user?.uid || 'anonymous_user';
};

const getCurrentUserName = (req) => {
  return req.user?.name || 'Anonymous User';
};

// Public review payloads must not carry Firebase uids or email addresses (SECURITY_AUDIT M7).
// The author id is a stable digest scoped to one place, so a user's reviews can still be
// correlated within that place without publishing the identifier auth accepts.
const publicAuthorId = (placeId, userId) => {
  return crypto
    .createHash('sha256')
    .update(`${placeId}:${userId || ''}`)
    .digest('hex')
    .slice(0, 16);
};

// Legacy rows stored the account email in user_name; never render one publicly.
const publicAuthorName = (userName) => {
  const name = (userName || '').trim();
  return !name || name.includes('@') ? 'Traveler' : name;
};

// `viewerUid` is the uid of the caller, when there is one (soft auth on the public GET,
// the verified author on POST). Ownership has to be resolved here: the client cannot
// compare against `user_id` any more, because that field is now the opaque digest.
const toPublicReview = (row, viewerUid) => {
  const authorId = publicAuthorId(row.place_id, row.user_id);
  const authorName = publicAuthorName(row.user_name);

  return {
    id: row.id,
    place_id: row.place_id,
    author_id: authorId,
    author_name: authorName,
    rating: row.rating,
    comment: row.comment,
    created_at: row.created_at,
    updated_at: row.updated_at,
    is_own: Boolean(viewerUid) && row.user_id === viewerUid,
    // Aliases the current UI still reads; they carry the opaque values, never the raw uid.
    user_id: authorId,
    user_name: authorName
  };
};

// ---------------------------------------------------------------------------
// Place lists (IMP-038)
// ---------------------------------------------------------------------------
//
// `/api/places` and `/api/places/search` are the same read behind two names — the second one is
// the first one with filters bound. They share this handler so pagination, sorting, projection
// and the image fallback cannot behave differently depending on which URL the caller picked.
//
// Response contract, on both routes:
//
//   { data: [...], pagination: { total, limit, offset, hasMore, sort } }
//
// This replaced a bare array. Every consumer in this repo was migrated in the same change; the
// envelope is not optional and there is no legacy shape to fall back to, because a list endpoint
// that sometimes reports a total and sometimes does not is worse than either alternative.

// Query arrays arrive either repeated (`?tags=a&tags=b`) or JSON-encoded, depending on the caller.
const parseArrayParam = (value) => {
  if (value === undefined || value === null || value === '') return undefined;
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [value];
  } catch {
    return [value];
  }
};

const criteriaFromQuery = (query) => {
  const parsedMinRating = Number.parseFloat(query.minRating);
  return {
    searchTerm: query.searchTerm?.trim() || undefined,
    location: query.location?.trim() || undefined,
    district: query.district?.trim() || undefined,
    state: query.state?.trim() || undefined,
    tags: parseArrayParam(query.tags),
    themes: parseArrayParam(query.themes),
    minRating: Number.isFinite(parsedMinRating) ? parsedMinRating : undefined,
    date: query.date?.trim() || undefined
  };
};

const listPlacesHandler = async (req, res) => {
  try {
    const { sort, limit, offset, projection, withStats } = req.query;
    const filters = criteriaFromQuery(req.query);

    const result = await placeModel.listPlaces({
      filters,
      sort,
      limit,
      offset,
      projection: projection === 'map' ? 'map' : 'list',
      withStats: withStats === 'true' || withStats === '1'
    });

    const data = result.rows.map(({ fallback_image_url, ...place }) => ({
      ...place,
      image_url: place.primary_image_url || fallback_image_url || null
    }));

    const body = {
      data,
      pagination: {
        total: result.total,
        limit: result.limit,
        offset: result.offset,
        hasMore: result.offset + data.length < result.total,
        sort: placeModel.SORT_ORDERS[sort] ? sort : 'newest'
      }
    };

    // Present only when asked for, so a caller cannot mistake its absence for zeroes.
    if (result.stats) body.stats = result.stats;

    res.status(200).json(body);
  } catch (error) {
    console.error('[ERROR] Error listing places:', error);
    res.status(500).json({
      message: 'Error getting places',
      // Safe by default: only an explicit NODE_ENV=development exposes driver text.
      // The old `=== 'production' ? safe : leak` test leaked whenever NODE_ENV was
      // unset, which is exactly what `npm start` does (SECURITY_AUDIT 10.4).
      error: process.env.NODE_ENV === 'development' ? error.message : 'Server error',
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Get place by ID
 */
const getPlaceById = async (req, res) => {
  try {
    const { id } = req.params;
    const timestamp = new Date().toISOString();
    const user = getCurrentUser(req);
    
    console.log(`[${timestamp}] Getting place by ID: ${id} - Requested by: ${user}`);
    
    if (isNaN(parseInt(id))) {
      return res.status(400).json({ message: 'Invalid place ID format' });
    }
    
    const place = await placeModel.getPlaceById(id);

    if (!place) {
      return res.status(404).json({ 
        message: 'Place not found',
        timestamp,
        requested_by: user
      });
    }

    const { fallback_image_url, ...placeFields } = place;
    const formattedPlace = {
      ...placeFields,
      image_url: place.primary_image_url || fallback_image_url || null
    };
    
    console.log(`[${timestamp}] Found place: ID=${place.id}, Name=${place.name}`);
    
    res.status(200).json(formattedPlace);
  } catch (error) {
    console.error('[ERROR] Error getting place:', error);
    res.status(500).json({ 
      message: 'Error getting place',
      // Safe by default: only an explicit NODE_ENV=development exposes driver text.
      // The old `=== 'production' ? safe : leak` test leaked whenever NODE_ENV was
      // unset, which is exactly what `npm start` does (SECURITY_AUDIT 10.4).
      error: process.env.NODE_ENV === 'development' ? error.message : 'Server error',
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Get image for a place
 */
const getPlaceImage = async (req, res) => {
  try {
    const { id, imageId } = req.params;
    const timestamp = new Date().toISOString();
    const user = getCurrentUser(req);
    
    console.log(`[${timestamp}] Image request - Place ID: ${id}, Image ID: ${imageId || 'primary'} - By: ${user}`);
    
    if (isNaN(parseInt(id))) {
      return sendDefaultImage(res, timestamp, id);
    }
    
    // Get place data
    const place = await placeModel.getPlaceById(id);
    
    if (!place) {
      return sendDefaultImage(res, timestamp, id);
    }
    
    // If specific image ID requested
    if (imageId) {
      try {
        const image = await pool.query(
          'SELECT image_url FROM place_images WHERE id = $1 AND place_id = $2',
          [imageId, id]
        );
        
        if (image.rows.length > 0 && image.rows[0].image_url) {
          console.log(`[${timestamp}] Redirecting to specific image: ${image.rows[0].image_url}`);
        // A 302 with no cache policy is re-requested every time. The destination for a given
        // place/image id is stable, so let the browser remember it.
        res.set('Cache-Control', 'public, max-age=3600');
          return res.redirect(image.rows[0].image_url);
        }
      } catch (err) {
        console.warn(`[${timestamp}] Error getting specific image:`, err.message);
      }
    }
    
    // Use primary image URL if available
    if (place.primary_image_url) {
      console.log(`[${timestamp}] Redirecting to primary image: ${place.primary_image_url}`);
        // A 302 with no cache policy is re-requested every time. The destination for a given
        // place/image id is stable, so let the browser remember it.
        res.set('Cache-Control', 'public, max-age=3600');
      return res.redirect(place.primary_image_url);
    }
    
    // Try to get first available image
    try {
      const fallbackImage = await pool.query(
        'SELECT image_url FROM place_images WHERE place_id = $1 ORDER BY display_order, created_at LIMIT 1',
        [id]
      );
      
      if (fallbackImage.rows.length > 0 && fallbackImage.rows[0].image_url) {
        console.log(`[${timestamp}] Redirecting to fallback image: ${fallbackImage.rows[0].image_url}`);
        // A 302 with no cache policy is re-requested every time. The destination for a given
        // place/image id is stable, so let the browser remember it.
        res.set('Cache-Control', 'public, max-age=3600');
        return res.redirect(fallbackImage.rows[0].image_url);
      }
    } catch (err) {
      console.warn(`[${timestamp}] Error getting fallback image:`, err.message);
    }
    
    // No image found, return default
    return sendDefaultImage(res, timestamp, id);
  } catch (error) {
    console.error('[ERROR] Error getting place image:', error);
    return sendDefaultImage(res, new Date().toISOString(), req.params.id);
  }
};

// This response is served as image/svg+xml, which browsers execute scripts inside when it is
// opened directly, so request input must never reach the document body (SECURITY_AUDIT M1).
// Anything that is not a positive integer id gets this constant document verbatim.
const GENERIC_PLACEHOLDER_SVG = `
      <svg width="400" height="300" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="#f5f5f5" stroke="#e0e0e0" stroke-width="2"/>
        <text x="50%" y="50%" font-family="Arial, sans-serif" font-size="16" text-anchor="middle" fill="#666">
          No Image Available
        </text>
      </svg>
    `;

const buildPlaceholderSvg = (placeId) => {
  const numericId = Number.parseInt(placeId, 10);

  if (!Number.isInteger(numericId) || numericId <= 0) {
    return GENERIC_PLACEHOLDER_SVG;
  }

  // numericId is a parsed integer here, not the raw path param
  return `
      <svg width="400" height="300" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="#f5f5f5" stroke="#e0e0e0" stroke-width="2"/>
        <text x="50%" y="45%" font-family="Arial, sans-serif" font-size="16" text-anchor="middle" fill="#666">
          No Image Available
        </text>
        <text x="50%" y="60%" font-family="Arial, sans-serif" font-size="12" text-anchor="middle" fill="#999">
          Place ID: ${numericId}
        </text>
      </svg>
    `;
};

/**
 * Send default placeholder image
 */
const sendDefaultImage = (res, timestamp, placeId) => {
  try {
    const svgPlaceholder = buildPlaceholderSvg(placeId);

    console.log(`[${timestamp}] Serving SVG placeholder for place: ${placeId}`);
    res.set({
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=3600',
      'Content-Length': Buffer.byteLength(svgPlaceholder)
    });
    return res.send(svgPlaceholder);
  } catch (err) {
    console.error(`[${timestamp}] Error serving placeholder:`, err);
    return res.status(404).json({
      message: 'Image not found',
      place_id: Number.parseInt(placeId, 10) || null,
      timestamp
    });
  }
};

/**
 * Create a new place with Cloudinary
 */
const createPlace = async (req, res) => {
  try {
    const timestamp = new Date().toISOString();
    const user = getCurrentUser(req);
    const userName = getCurrentUserName(req);
    
    console.log(`[${timestamp}] Creating new place - User: ${userName} (${user})`);
    console.log(`[${timestamp}] Request body:`, {
      name: req.body.name,
      location: req.body.location,
      district: req.body.district,
      state: req.body.state,
      hasImage: !!req.file,
      imageSize: req.file ? `${Math.round(req.file.size/1024)}KB` : 'none'
    });
    
    const { 
      name, description, location, district, state, locality, pin_code,
      latitude, longitude, themes, tags, custom_keys 
    } = req.body;
    
    // Validate required fields
    if (!name || !location) {
      console.warn(`[${timestamp}] Missing required fields`);
      return res.status(400).json({ 
        message: 'Name and location are required',
        timestamp
      });
    }
    
    // Create place data without image initially
    const placeData = {
      name: name.trim(),
      description: description?.trim() || null,
      location: location.trim(),
      district: district?.trim() || null,
      state: state?.trim() || null,
      locality: locality?.trim() || null,
      pin_code: pin_code?.trim() || null,
      latitude: latitude ? parseFloat(latitude) : null,
      longitude: longitude ? parseFloat(longitude) : null,
      primary_image_url: null, // Will be updated after upload
      themes: parseJsonField(themes, []),
      tags: parseJsonField(tags, []),
      custom_keys: parseJsonField(custom_keys, {}),
      created_by: user,
      updated_by: user
    };
    
    console.log(`[${timestamp}] Creating place with data:`, {
      name: placeData.name,
      location: placeData.location,
      hasImage: !!req.file,
      themesCount: Array.isArray(placeData.themes) ? placeData.themes.length : 0,
      tagsCount: Array.isArray(placeData.tags) ? placeData.tags.length : 0
    });
    
    // Insert place into database first
    const newPlace = await placeModel.createPlace(placeData);
    console.log(`[${timestamp}] Place created in database: ID=${newPlace.id}, Name=${newPlace.name}`);
    
    // Process image upload if present
    let imageUrl = null;
    if (req.file) {
      try {
        console.log(`[${timestamp}] Uploading image to Cloudinary...`);
        console.log(`[${timestamp}] File details:`, {
          path: req.file.path,
          size: req.file.size,
          mimetype: req.file.mimetype
        });
        
        // Check if file exists and has size
        if (!req.file.path || !fs.existsSync(req.file.path)) {
          throw new Error(`File not found at path: ${req.file.path}`);
        }
        
        // Upload to Cloudinary
        const result = await uploadImage(req.file.path, {
          folder: `easytrip/places/${newPlace.id}`,
          public_id: `place_${newPlace.id}_primary_${Date.now()}`,
          tags: ['place', `id_${newPlace.id}`, 'primary'],
          context: `place_id=${newPlace.id}|user=${user}|name=${encodeURIComponent(newPlace.name)}`
        });
        
        imageUrl = result.url;
        console.log(`[${timestamp}] Image uploaded successfully: ${imageUrl}`);
        
        // Update the place record with the image URL
        await placeModel.updatePlace(newPlace.id, { primary_image_url: imageUrl });
        console.log(`[${timestamp}] Place record updated with image URL`);
        
        // Update the newPlace object with the image URL
        newPlace.primary_image_url = imageUrl;
      } catch (uploadError) {
        console.error(`[${timestamp}] Cloudinary upload error:`, uploadError);
        // Don't fail the request, just log the error
        console.log(`[${timestamp}] Continuing without image due to upload error`);
      }
    }
    
    const response = {
      ...newPlace,
      image_url: newPlace.primary_image_url || null,
      success: true
    };
    
    res.status(201).json(response);
    
  } catch (error) {
    console.error(`[ERROR] Error creating place:`, error);
    res.status(500).json({ 
      message: 'Error creating place',
      // Safe by default: only an explicit NODE_ENV=development exposes driver text.
      // The old `=== 'production' ? safe : leak` test leaked whenever NODE_ENV was
      // unset, which is exactly what `npm start` does (SECURITY_AUDIT 10.4).
      error: process.env.NODE_ENV === 'development' ? error.message : 'Server error',
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Update a place with Cloudinary
 */
const updatePlace = async (req, res) => {
  try {
    const { id } = req.params;
    const timestamp = new Date().toISOString();
    const user = getCurrentUser(req);
    const userName = getCurrentUserName(req);
    
    console.log(`[${timestamp}] Updating place ID: ${id} - User: ${userName} (${user})`);
    
    if (isNaN(parseInt(id))) {
      return res.status(400).json({ message: 'Invalid place ID format' });
    }
    
    const currentPlace = await placeModel.getPlaceById(id);
    if (!currentPlace) {
      return res.status(404).json({ message: 'Place not found' });
    }
    
    const { 
      name, description, location, district, state, locality, pin_code,
      latitude, longitude, themes, tags, custom_keys 
    } = req.body;
    
    // Process image upload if present
    let imageUrl = currentPlace.primary_image_url;
    if (req.file) {
      try {
        console.log(`[${timestamp}] Uploading updated image to Cloudinary...`);
        console.log(`[${timestamp}] File details:`, {
          path: req.file.path,
          size: req.file.size,
          mimetype: req.file.mimetype
        });
        
        // Check if file exists and has size
        if (!req.file.path || !fs.existsSync(req.file.path)) {
          throw new Error(`File not found at path: ${req.file.path}`);
        }
        
        // Upload to Cloudinary
        const result = await uploadImage(req.file.path, {
          folder: `easytrip/places/${id}`,
          public_id: `place_${id}_primary_${Date.now()}`,
          tags: ['place', `id_${id}`, 'primary', 'updated'],
          context: `place_id=${id}|user=${user}|updated=true|name=${encodeURIComponent(currentPlace.name)}`
        });
        
        const previousImageUrl = imageUrl;
        imageUrl = result.url;
        console.log(`[${timestamp}] Updated image uploaded successfully, URL: ${imageUrl}`);

        // Replacing the primary image orphans the old asset. Every upload uses a fresh
        // timestamped public_id, so the replacement never overwrites its predecessor — without
        // this, editing a place's photo N times left N-1 assets paid for and unreachable.
        // Only after the new upload succeeded, so a failed replace keeps the existing image.
        const previousPublicId = publicIdFromUrl(previousImageUrl);
        if (previousPublicId && previousPublicId !== result.public_id) {
          const wasRemoved = await destroyImage(previousPublicId);
          console.log(
            `[${timestamp}] Previous image ${previousPublicId}: ${wasRemoved ? 'removed' : 'left in place'}`
          );
        }
      } catch (uploadError) {
        console.error(`[${timestamp}] Cloudinary upload error:`, uploadError);
        console.error('Error details:', uploadError);
        // Keep the old image URL
        console.log(`[${timestamp}] Keeping old image URL: ${imageUrl}`);
      }
    }
    
    const placeData = {
      name: name || currentPlace.name,
      description: description !== undefined ? description : currentPlace.description,
      location: location || currentPlace.location,
      district: district !== undefined ? district : currentPlace.district,
      state: state !== undefined ? state : currentPlace.state,
      locality: locality !== undefined ? locality : currentPlace.locality,
      pin_code: pin_code !== undefined ? pin_code : currentPlace.pin_code,
      latitude: latitude !== undefined ? (latitude ? parseFloat(latitude) : null) : currentPlace.latitude,
      longitude: longitude !== undefined ? (longitude ? parseFloat(longitude) : null) : currentPlace.longitude,
      primary_image_url: imageUrl,
      themes: parseJsonField(themes, currentPlace.themes || []),
      tags: parseJsonField(tags, currentPlace.tags || []),
      custom_keys: parseJsonField(custom_keys, currentPlace.custom_keys || {}),
      updated_by: user
    };
    
    console.log(`[${timestamp}] Final update data:`, {
      name: placeData.name,
      imageUrl: placeData.primary_image_url 
    });

    const updatedPlace = await placeModel.updatePlace(id, placeData);
    console.log(`[${timestamp}] Place updated successfully: ID=${updatedPlace.id}`);
    
    const response = {
      ...updatedPlace,
      image_url: updatedPlace.primary_image_url || null
    };
    
    res.status(200).json(response);
  } catch (error) {
    console.error('[ERROR] Error updating place:', error);
    res.status(500).json({ 
      message: 'Error updating place',
      // Safe by default: only an explicit NODE_ENV=development exposes driver text.
      // The old `=== 'production' ? safe : leak` test leaked whenever NODE_ENV was
      // unset, which is exactly what `npm start` does (SECURITY_AUDIT 10.4).
      error: process.env.NODE_ENV === 'development' ? error.message : 'Server error',
      timestamp: new Date().toISOString()
    });
  }
};

// Helper function to parse JSON fields
function parseJsonField(field, defaultValue) {
  if (!field) return defaultValue;
  
  try {
    return typeof field === 'string' ? JSON.parse(field) : field;
  } catch (e) {
    console.warn(`Error parsing JSON field:`, e.message);
    return defaultValue;
  }
}

/**
 * Delete a place
 */
const deletePlace = async (req, res) => {
  try {
    const { id } = req.params;
    const timestamp = new Date().toISOString();
    const user = getCurrentUser(req);
    const userName = getCurrentUserName(req);
    
    console.log(`[${timestamp}] Deleting place ID: ${id} - User: ${userName} (${user})`);
    
    if (isNaN(parseInt(id))) {
      return res.status(400).json({ message: 'Invalid place ID format' });
    }
    
    const place = await placeModel.getPlaceById(id);
    if (!place) {
      return res.status(404).json({ message: 'Place not found' });
    }
    
    const success = await placeModel.deletePlace(id);
    if (!success) {
      throw new Error('Failed to delete place');
    }

    // Remote media is cleaned up only AFTER the row is gone. Doing it first would risk destroying
    // the images of a place that then fails to delete. The call never throws — an orphaned asset
    // costs storage, whereas failing the request after the row is already deleted would leave the
    // caller believing the delete failed when it succeeded (IMP-024).
    const removed = await destroyPlaceAssets(id);
    console.log(`[${timestamp}] Cloudinary cleanup for place ${id}: ${removed} asset(s) removed`);

    console.log(`[${timestamp}] Place deleted successfully: ID=${id}`);
    
    res.status(200).json({ 
      message: 'Place deleted successfully',
      id,
      name: place.name,
      deleted_by: user,
      deleted_at: timestamp 
    });
  } catch (error) {
    console.error('[ERROR] Error deleting place:', error);
    res.status(500).json({ 
      message: 'Error deleting place',
      // Safe by default: only an explicit NODE_ENV=development exposes driver text.
      // The old `=== 'production' ? safe : leak` test leaked whenever NODE_ENV was
      // unset, which is exactly what `npm start` does (SECURITY_AUDIT 10.4).
      error: process.env.NODE_ENV === 'development' ? error.message : 'Server error',
      timestamp: new Date().toISOString()
    });
  }
};

const getPlaceImages = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (isNaN(parseInt(id))) {
      return res.status(400).json({ message: 'Invalid place ID format' });
    }
    
    const images = await pool.query(
      'SELECT id, place_id, image_url, caption, display_order, created_at FROM place_images WHERE place_id = $1 ORDER BY display_order, created_at',
      [id]
    );
    
    res.status(200).json(images.rows);
  } catch (error) {
    console.error('[ERROR] Error getting place images:', error);
    res.status(500).json({ 
      message: 'Error getting place images',
      // Safe by default: only an explicit NODE_ENV=development exposes driver text.
      // The old `=== 'production' ? safe : leak` test leaked whenever NODE_ENV was
      // unset, which is exactly what `npm start` does (SECURITY_AUDIT 10.4).
      error: process.env.NODE_ENV === 'development' ? error.message : 'Server error',
      timestamp: new Date().toISOString()
    });
  }
};

const getAllLocations = async (req, res) => {
  try {
    const locations = await placeModel.getUniqueLocations();
    res.status(200).json(locations);
  } catch (error) {
    console.error('[ERROR] Error getting locations:', error);
    res.status(500).json({ message: 'Error getting locations' });
  }
};

const getDistricts = async (req, res) => {
  try {
    const districts = await placeModel.getUniqueDistricts();
    res.status(200).json(districts);
  } catch (error) {
    console.error('[ERROR] Error getting districts:', error);
    res.status(500).json({ message: 'Error getting districts' });
  }
};

const getStates = async (req, res) => {
  try {
    const states = await placeModel.getUniqueStates();
    res.status(200).json(states);
  } catch (error) {
    console.error('[ERROR] Error getting states:', error);
    res.status(500).json({ message: 'Error getting states' });
  }
};

const getTags = async (req, res) => {
  try {
    const tags = await placeModel.getUniqueTags();
    res.status(200).json(tags);
  } catch (error) {
    console.error('[ERROR] Error getting tags:', error);
    res.status(500).json({ message: 'Error getting tags' });
  }
};

// Review functions
const getPlaceReviews = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (isNaN(parseInt(id))) {
      return res.status(400).json({ message: 'Invalid place ID format' });
    }
    
    const result = await pool.query(
      'SELECT id, place_id, user_id, user_name, rating, comment, created_at, updated_at FROM place_reviews WHERE place_id = $1 ORDER BY created_at DESC',
      [id]
    );

    const viewerUid = req.user?.uid;

    res.status(200).json(result.rows.map((row) => toPublicReview(row, viewerUid)));
  } catch (error) {
    console.error('[ERROR] Error getting reviews:', error);
    res.status(500).json({ message: 'Error getting reviews' });
  }
};

const createPlaceReview = async (req, res) => {
  try {
    const { id } = req.params;
    const { rating, comment } = req.body;

    // The author is whoever the token says it is - never a body field or a header
    const userId = req.user?.uid;
    if (!userId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const userName = getCurrentUserName(req);

    if (isNaN(parseInt(id))) {
      return res.status(400).json({ message: 'Invalid place ID format' });
    }

    const parsedRating = Number.parseInt(rating, 10);
    if (!Number.isInteger(parsedRating) || parsedRating < 1 || parsedRating > 5) {
      return res.status(400).json({ message: 'Rating must be an integer between 1 and 5' });
    }

    // One review per user per place, enforced by UNIQUE (place_id, user_id): reviewing again
    // edits the existing row instead of stacking another vote onto the place's rating.
    // `xmax = 0` distinguishes the inserted row from the updated one.
    const result = await pool.query(
      `INSERT INTO place_reviews (place_id, user_id, user_name, rating, comment, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
       ON CONFLICT (place_id, user_id) DO UPDATE
       SET rating = EXCLUDED.rating,
           comment = EXCLUDED.comment,
           user_name = EXCLUDED.user_name,
           updated_at = NOW()
       RETURNING id, place_id, user_id, user_name, rating, comment, created_at, updated_at, (xmax = 0) AS inserted`,
      [id, userId, userName, parsedRating, comment || null]
    );

    const review = result.rows[0];

    res.status(review.inserted ? 201 : 200).json(toPublicReview(review, userId));
  } catch (error) {
    console.error('[ERROR] Error creating review:', error);

    // 42P10: "no unique or exclusion constraint matching the ON CONFLICT specification".
    // The upsert needs UNIQUE (place_id, user_id); app.js adds it at boot, but that fails
    // when the table still holds duplicate rows. Say so instead of returning a bare 500.
    if (error.code === '42P10') {
      console.error(
        '   place_reviews is missing UNIQUE (place_id, user_id). Back up the table, then ' +
        'run: psql "$DATABASE_URL" -f backend/src/config/migrations/001_phase1.sql'
      );
      return res.status(500).json({
        message: 'Reviews are temporarily unavailable — the server is missing a required database constraint'
      });
    }

    res.status(500).json({ message: 'Error creating review' });
  }
};

// Editing a review is the POST upsert above - re-submitting replaces the existing row. There is
// deliberately no PUT: a second edit path would be one more way to do the same thing, and this
// codebase has spent two phases deleting exactly that.
const deletePlaceReview = async (req, res) => {
  try {
    const { id, reviewId } = req.params;

    const userId = req.user?.uid;
    if (!userId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    // The security boundary is this single statement: the DELETE is scoped to the caller's uid,
    // so a non-owner cannot remove a row no matter what happens concurrently. Checking ownership
    // in a separate query first and then deleting would leave a window between the two.
    const deleted = await pool.query(
      'DELETE FROM place_reviews WHERE id = $1 AND place_id = $2 AND user_id = $3 RETURNING id',
      [reviewId, id, userId]
    );

    if (deleted.rowCount === 0) {
      // Nothing was removed. Reviews are public, so their ids are not a secret - there is no
      // reason to blur 404 into 403, and an accurate answer is far easier to debug.
      const existing = await pool.query(
        'SELECT user_id FROM place_reviews WHERE id = $1 AND place_id = $2',
        [reviewId, id]
      );

      if (existing.rowCount === 0) {
        return res.status(404).json({ message: 'Review not found' });
      }
      return res.status(403).json({ message: 'You can only delete your own review' });
    }

    // update_place_rating_trigger fires AFTER DELETE and recomputes rating_sum/rating_count from
    // the remaining rows, so the place aggregate needs no work here.
    res.status(204).send();
  } catch (error) {
    console.error('[ERROR] Error deleting review:', error);
    res.status(500).json({ message: 'Error deleting review' });
  }
};

const reportPlaceReview = async (req, res) => {
  try {
    const { id, reviewId } = req.params;
    const { reason } = req.body;

    const reporterUid = req.user?.uid;
    if (!reporterUid) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const existing = await pool.query(
      'SELECT user_id FROM place_reviews WHERE id = $1 AND place_id = $2',
      [reviewId, id]
    );

    if (existing.rowCount === 0) {
      return res.status(404).json({ message: 'Review not found' });
    }

    if (existing.rows[0].user_id === reporterUid) {
      return res.status(400).json({ message: 'You cannot report your own review' });
    }

    // UNIQUE (review_id, reporter_uid) makes a repeat report a no-op rather than a duplicate row,
    // so one person cannot inflate a future moderation queue by clicking twice.
    await pool.query(
      `INSERT INTO review_reports (review_id, reporter_uid, reason)
       VALUES ($1, $2, $3)
       ON CONFLICT (review_id, reporter_uid) DO NOTHING`,
      [reviewId, reporterUid, reason || null]
    );

    // Same response whether the row was new or already there. Whether they had reported it before
    // is not information the reporter needs, and reporting twice should feel identical.
    res.status(200).json({ message: 'Thanks - this review has been reported for moderation.' });
  } catch (error) {
    console.error('[ERROR] Error reporting review:', error);

    // 42P01: undefined_table. The endpoint is useless until 003 is applied, so say why rather
    // than returning a bare 500 - this is the same failure mode 001 had with place_reviews.
    if (error.code === '42P01') {
      console.error(
        '   review_reports does not exist. Run: ' +
        'psql "$DATABASE_URL" -f backend/src/config/migrations/003_sprint23.sql'
      );
      return res.status(500).json({
        message: 'Reporting is temporarily unavailable - the server is missing a required table'
      });
    }

    res.status(500).json({ message: 'Error reporting review' });
  }
};

/**
 * Add a gallery image to a place (admin).
 *
 * `place_images` has existed since the original schema, along with its read endpoint and the
 * lightbox that renders it — but nothing ever wrote to it, so the gallery has always been an
 * empty table behind working UI (IMP-014).
 */
const addPlaceImage = async (req, res) => {
  const timestamp = new Date().toISOString();

  try {
    const { id } = req.params;
    const { caption } = req.body;

    if (!req.file) {
      return res.status(400).json({ message: 'An image file is required' });
    }

    const place = await placeModel.getPlaceById(id);
    if (!place) {
      return res.status(404).json({ message: 'Place not found' });
    }

    if (!req.file.path || !fs.existsSync(req.file.path)) {
      return res.status(400).json({ message: 'Uploaded file could not be read' });
    }

    // Same folder convention as the primary image, which is what lets destroyPlaceAssets clean up
    // an entire place by prefix without tracking individual ids.
    const result = await uploadImage(req.file.path, {
      folder: `easytrip/places/${id}`,
      public_id: `place_${id}_gallery_${Date.now()}`,
      tags: ['place', `id_${id}`, 'gallery'],
      context: `place_id=${id}|user=${getCurrentUser(req)}`
    });

    // New images go last. COALESCE handles the first image, where MAX over no rows is NULL.
    const inserted = await pool.query(
      `INSERT INTO place_images (place_id, image_url, caption, display_order, created_at)
       VALUES ($1, $2, $3,
               (SELECT COALESCE(MAX(display_order), -1) + 1 FROM place_images WHERE place_id = $1),
               NOW())
       RETURNING id, place_id, image_url, caption, display_order, created_at`,
      [id, result.url, caption?.trim() || null]
    );

    console.log(`[${timestamp}] Gallery image added to place ${id}: ${result.public_id}`);
    res.status(201).json(inserted.rows[0]);
  } catch (error) {
    console.error('[ERROR] Error adding gallery image:', error);
    res.status(500).json({ message: 'Error adding gallery image' });
  }
};

/**
 * Remove a gallery image from a place (admin).
 *
 * Deletes the row first, then the remote asset — the row is the source of truth, and an orphaned
 * asset is a storage cost rather than a broken gallery. The reverse order risks destroying an
 * image that is still referenced.
 */
const deletePlaceImage = async (req, res) => {
  const timestamp = new Date().toISOString();

  try {
    const { id, imageId } = req.params;

    const deleted = await pool.query(
      'DELETE FROM place_images WHERE id = $1 AND place_id = $2 RETURNING image_url',
      [imageId, id]
    );

    if (deleted.rowCount === 0) {
      return res.status(404).json({ message: 'Image not found for this place' });
    }

    const publicId = publicIdFromUrl(deleted.rows[0].image_url);
    if (publicId) {
      const wasRemoved = await destroyImage(publicId);
      console.log(`[${timestamp}] Gallery asset ${publicId}: ${wasRemoved ? 'removed' : 'left in place'}`);
    }

    res.status(204).send();
  } catch (error) {
    console.error('[ERROR] Error deleting gallery image:', error);
    res.status(500).json({ message: 'Error deleting gallery image' });
  }
};

module.exports = {
  listPlaces: listPlacesHandler,
  getPlaceById,
  getPlaceImage,
  getPlaceImages,
  addPlaceImage,
  deletePlaceImage,
  createPlace,
  updatePlace,
  deletePlace,
  getAllLocations,
  getDistricts,
  getStates,
  getTags,
  getPlaceReviews,
  createPlaceReview,
  deletePlaceReview,
  reportPlaceReview
};