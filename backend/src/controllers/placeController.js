const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const placeModel = require('../models/placeModel');
const { uploadImage } = require('../config/cloudinary');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

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

/**
 * Get all places
 */
const getAllPlaces = async (req, res) => {
  try {
    const timestamp = new Date().toISOString();
    const user = getCurrentUser(req);
    
    console.log(`[${timestamp}] Getting all places - Requested by: ${user}`);
    
    const places = await placeModel.getAllPlaces();
    
    const formattedPlaces = places.map(place => ({
      ...place,
      image_url: place.primary_image_url || `/api/places/${place.id}/image`,
      fetched_at: timestamp,
      fetched_by: user
    }));
    
    console.log(`[${timestamp}] Found ${places.length} places`);
    
    res.status(200).json(formattedPlaces);
  } catch (error) {
    console.error('[ERROR] Error getting places:', error);
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

    const formattedPlace = {
      ...place,
      image_url: place.primary_image_url || `/api/places/${id}/image`,
      fetched_at: timestamp,
      fetched_by: user
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
          return res.redirect(image.rows[0].image_url);
        }
      } catch (err) {
        console.warn(`[${timestamp}] Error getting specific image:`, err.message);
      }
    }
    
    // Use primary image URL if available
    if (place.primary_image_url) {
      console.log(`[${timestamp}] Redirecting to primary image: ${place.primary_image_url}`);
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
      image_url: newPlace.primary_image_url || `/api/places/${newPlace.id}/image`,
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
        
        imageUrl = result.url;
        console.log(`[${timestamp}] Updated image uploaded successfully, URL: ${imageUrl}`);
        
        // Explicitly log and verify URL is properly set
        console.log(`[${timestamp}] Setting primary_image_url to: ${imageUrl}`);
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
      image_url: updatedPlace.primary_image_url || `/api/places/${id}/image`
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

// Search and metadata functions
const searchPlaces = async (req, res) => {
  try {
    const { searchTerm, location, tags, themes, district, state, minRating, date } = req.query;
    const timestamp = new Date().toISOString();
    const user = getCurrentUser(req);

    // themes/minRating/date were accepted by the route and silently dropped here before
    // Phase 2, so every one of those filters was a no-op for the user (IMP-011).
    const parsedMinRating = Number.parseFloat(minRating);

    const criteria = {
      searchTerm: searchTerm?.trim(),
      location: location?.trim(),
      district: district?.trim(),
      state: state?.trim(),
      tags: tags ? (Array.isArray(tags) ? tags : JSON.parse(tags)) : undefined,
      themes: themes ? (Array.isArray(themes) ? themes : JSON.parse(themes)) : undefined,
      minRating: Number.isFinite(parsedMinRating) ? parsedMinRating : undefined,
      date: date?.trim()
    };
    
    const places = await placeModel.searchPlaces(criteria);
    
    const formattedPlaces = places.map(place => ({
      ...place,
      image_url: place.primary_image_url || `/api/places/${place.id}/image`,
      fetched_at: timestamp,
      fetched_by: user
    }));
    
    res.status(200).json(formattedPlaces);
  } catch (error) {
    console.error('[ERROR] Error searching places:', error);
    res.status(500).json({ 
      message: 'Error searching places',
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

module.exports = {
  getAllPlaces,
  getPlaceById,
  getPlaceImage,
  getPlaceImages,
  createPlace,
  updatePlace,
  deletePlace,
  searchPlaces,
  getAllLocations,
  getDistricts,
  getStates,
  getTags,
  getPlaceReviews,
  createPlaceReview
};