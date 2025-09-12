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
    
    // Clean up the temporary file
    try {
      fs.unlinkSync(filePath);
    } catch (cleanupError) {
      console.warn('Error cleaning up temporary file:', cleanupError);
    }
    
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
  testCloudinary
};