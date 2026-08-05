const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

console.log('Cloudinary configured with cloud name:', process.env.CLOUDINARY_CLOUD_NAME);

// Create temporary directory for file uploads if it doesn't exist
const tmpDir = path.join(__dirname, '../../tmp');
if (!fs.existsSync(tmpDir)) {
  fs.mkdirSync(tmpDir, { recursive: true });
}

// Create multer storage with disk storage first, then upload to Cloudinary
const diskStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, tmpDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// Create multer upload middleware
const uploadMiddleware = multer({
  storage: diskStorage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

// Direct upload function for programmatic use
const uploadImage = async (filePath, options = {}) => {
  try {
    console.log(`Uploading image to Cloudinary from path: ${filePath}`);
    
    if (!fs.existsSync(filePath)) {
      throw new Error(`File does not exist at path: ${filePath}`);
    }
    
    const fileStats = fs.statSync(filePath);
    console.log(`File size: ${fileStats.size} bytes`);
    
    if (fileStats.size === 0) {
      throw new Error('File is empty');
    }
    
    const result = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload(
        filePath,
        {
          folder: options.folder || 'easytrip',
          public_id: options.public_id,
          tags: options.tags || ['place'],
          context: options.context || '',
          resource_type: 'image',
          transformation: [{ width: 1200, height: 800, crop: 'limit', quality: 'auto' }]
        },
        (error, result) => {
          if (error) {
            console.error('Cloudinary upload error:', error);
            reject(error);
          } else {
            console.log('Cloudinary upload success:', result.secure_url);
            resolve(result);
          }
        }
      );
    });
    
    return {
      url: result.secure_url,
      public_id: result.public_id,
      width: result.width,
      height: result.height,
      format: result.format
    };
  } catch (error) {
    console.error('Cloudinary upload error:', error);
    throw error;
  } finally {
    // In a `finally`, because the cleanup used to sit after the upload resolved: a rejected upload
    // skipped it and left the file in backend/tmp/ forever. Since every failed upload leaked, the
    // directory grew without bound on exactly the path that gets retried (IMP-024).
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (cleanupError) {
      console.warn('Error cleaning up temporary file:', cleanupError);
    }
  }
};

/**
 * Recover a Cloudinary public_id from a delivery URL.
 *
 * Only for rows written before `public_id` was stored — new uploads persist it directly, which is
 * exact. A Cloudinary URL looks like:
 *
 *   https://res.cloudinary.com/<cloud>/image/upload/v1712345678/easytrip/places/9/place_9_x.jpg
 *                                                  ^version(optional)  ^-------- public_id -------^
 *
 * so the id is everything after `/upload/` (minus an optional `v<digits>/` segment) with the file
 * extension removed. Transformation segments would also appear there, but this project never puts
 * them in stored URLs — transformations are applied at read time.
 *
 * @returns {String|null} the public_id, or null if the URL is not a recognisable Cloudinary upload
 */
const publicIdFromUrl = (url) => {
  if (typeof url !== 'string') return null;

  const marker = '/upload/';
  const start = url.indexOf(marker);
  if (start === -1) return null;

  let rest = url.slice(start + marker.length);
  if (!rest) return null;

  // Drop the version segment when present.
  rest = rest.replace(/^v\d+\//, '');

  // Drop the extension from the last path segment only — folder names may contain dots.
  const lastSlash = rest.lastIndexOf('/');
  const dir = lastSlash === -1 ? '' : rest.slice(0, lastSlash + 1);
  const file = lastSlash === -1 ? rest : rest.slice(lastSlash + 1);
  const withoutExt = file.replace(/\.[^./]+$/, '');

  const publicId = `${dir}${withoutExt}`;
  return publicId || null;
};

/**
 * Delete a single Cloudinary asset.
 *
 * Never throws: the database row is the source of truth, and an orphaned remote asset is a storage
 * cost, not a correctness problem. Failing a user's delete because a third-party cleanup call
 * failed would trade a cheap problem for an expensive one.
 *
 * @returns {Boolean} whether Cloudinary reported the asset as removed
 */
const destroyImage = async (publicId) => {
  if (!publicId) return false;

  try {
    const result = await cloudinary.uploader.destroy(publicId, { invalidate: true });
    // 'not found' is a success for our purposes — the goal is "this asset is gone".
    const ok = result?.result === 'ok' || result?.result === 'not found';
    if (!ok) {
      console.warn(`Cloudinary destroy returned '${result?.result}' for ${publicId}`);
    }
    return ok;
  } catch (error) {
    console.error(`Cloudinary destroy failed for ${publicId}:`, error.message);
    return false;
  }
};

/**
 * Delete every asset belonging to a place.
 *
 * Uses prefix deletion rather than a list of stored ids, because every upload has always gone to
 * `easytrip/places/<id>/` — so this also collects assets uploaded before `public_id` was recorded,
 * which a column-driven cleanup would miss entirely.
 *
 * The trailing slash matters: without it the prefix for place 1 would also match place 10.
 *
 * Never throws, for the same reason as destroyImage.
 */
const destroyPlaceAssets = async (placeId) => {
  const prefix = `easytrip/places/${placeId}/`;

  try {
    const result = await cloudinary.api.delete_resources_by_prefix(prefix);
    const deleted = Object.keys(result?.deleted || {});
    console.log(`Cloudinary: removed ${deleted.length} asset(s) under ${prefix}`);

    // Tidy the now-empty folder. Cloudinary 404s when the folder never existed (a place with no
    // uploads), which is not an error worth surfacing.
    try {
      await cloudinary.api.delete_folder(prefix);
    } catch (folderError) {
      if (folderError?.error?.http_code !== 404 && folderError?.http_code !== 404) {
        console.warn(`Could not remove Cloudinary folder ${prefix}:`, folderError.message);
      }
    }

    return deleted.length;
  } catch (error) {
    console.error(`Cloudinary prefix delete failed for ${prefix}:`, error.message);
    return 0;
  }
};

// Test Cloudinary connection
const testCloudinary = async () => {
  try {
    console.log('Testing Cloudinary connection...');
    
    // Create a test file
    const testFilePath = path.join(tmpDir, `test_${Date.now()}.png`);
    
    // Create a simple 1x1 pixel transparent PNG image
    const base64Image = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
    fs.writeFileSync(testFilePath, Buffer.from(base64Image, 'base64'));
    
    console.log(`Test file created at: ${testFilePath}`);
    
    const result = await uploadImage(testFilePath, {
      folder: 'easytrip/test',
      public_id: `test_${Date.now()}`
    });
    
    console.log('✅ Cloudinary is working!');
    console.log('Image URL:', result.url);
    return { success: true, url: result.url };
  } catch (error) {
    console.error('❌ Cloudinary test failed:', error);
    return { success: false, error: error.message || error };
  }
};

module.exports = {
  cloudinary,
  uploadMiddleware,
  uploadImage,
  destroyImage,
  destroyPlaceAssets,
  publicIdFromUrl,
  testCloudinary
};