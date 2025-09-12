const multer = require('multer');

// Configure memory storage for multer
const storage = multer.memoryStorage();

// File filter - only accept image files
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  }
});

// Create a configurable middleware function that supports both single and multiple file uploads
const uploadMiddleware = (fieldName, multiple = false) => {
  if (multiple) {
    return upload.array(fieldName, 10); // Max 10 files
  } else {
    return upload.single(fieldName);
  }
};

// Export both the base upload instance and the configurable middleware
module.exports = {
  upload,
  uploadMiddleware
};