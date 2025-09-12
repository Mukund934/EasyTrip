import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FiImage } from 'react-icons/fi';

const ImageGallery = ({ primaryImage, images = [], placeName }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [allImages, setAllImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const defaultImage = '/images/placeholder.jpg';
  
  useEffect(() => {
    // Create a combined array with primary image and additional images
    let imageArray = [];
    
    // Add primary image if available
    if (primaryImage) {
      imageArray.push({ id: 'primary', image_url: primaryImage });
    }
    
    // Add additional images if available and valid
    if (Array.isArray(images) && images.length > 0) {
      imageArray = [...imageArray, ...images.filter(img => img && img.image_url)];
    }
    
    // If no images are available, use a placeholder
    if (imageArray.length === 0) {
      imageArray.push({ id: 'placeholder', image_url: defaultImage });
      setError(true);
    }
    
    setAllImages(imageArray);
    setLoading(false);
  }, [primaryImage, images]);
  
  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-100">
        <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }
  
  // Fallback for no images
  if (allImages.length === 0) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-gray-100">
        <FiImage className="h-16 w-16 text-gray-400 mb-4" />
        <p className="text-gray-500">No images available</p>
      </div>
    );
  }
  
  return (
    <div className="relative w-full h-full">
      {/* Display current image */}
      <img
        src={allImages[currentIndex]?.image_url || defaultImage}
        alt={`${placeName} - Image ${currentIndex + 1}`}
        className="w-full h-full object-cover"
        onError={(e) => {
          e.target.src = defaultImage;
        }}
      />
      
      {/* Image navigation if multiple images */}
      {allImages.length > 1 && (
        <div className="absolute bottom-4 left-0 right-0 flex justify-center">
          <div className="flex space-x-2 bg-black/30 rounded-full px-3 py-2">
            {allImages.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentIndex(idx)}
                className={`w-2 h-2 rounded-full ${
                  idx === currentIndex ? 'bg-white' : 'bg-white/50'
                }`}
                aria-label={`View image ${idx + 1}`}
              />
            ))}
          </div>
        </div>
      )}
      
      {error && (
        <div className="absolute bottom-4 left-4 bg-yellow-500/80 text-white text-xs px-2 py-1 rounded">
          Some images failed to load
        </div>
      )}
    </div>
  );
};

export default ImageGallery;