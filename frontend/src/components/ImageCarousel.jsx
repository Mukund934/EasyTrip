import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiChevronLeft, FiChevronRight, FiImage } from 'react-icons/fi';

const ImageCarousel = ({ images = [], primaryImage, className = '', autoPlay = true, interval = 5000 }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  
  // Combine primary image with additional images
  const allImages = [
    { id: 'primary', image_url: primaryImage },
    ...images
  ].filter(img => img.image_url); // Filter out any undefined images
  
  // Auto-advance slides if autoPlay is enabled
  useEffect(() => {
    if (!autoPlay || allImages.length <= 1) return;
    
    const timer = setInterval(() => {
      setCurrentIndex((prevIndex) => (prevIndex + 1) % allImages.length);
    }, interval);
    
    return () => clearInterval(timer);
  }, [autoPlay, interval, allImages.length]);
  
  // Reset loading state when image changes
  useEffect(() => {
    setIsLoading(true);
    setHasError(false);
  }, [currentIndex]);
  
  const handlePrev = () => {
    setCurrentIndex((prevIndex) => 
      prevIndex === 0 ? allImages.length - 1 : prevIndex - 1
    );
  };
  
  const handleNext = () => {
    setCurrentIndex((prevIndex) => 
      (prevIndex + 1) % allImages.length
    );
  };
  
  const handleImageLoad = () => {
    setIsLoading(false);
  };
  
  const handleImageError = () => {
    setIsLoading(false);
    setHasError(true);
  };
  
  // If no images are available
  if (allImages.length === 0) {
    return (
      <div className={`bg-gray-200 flex items-center justify-center ${className}`}>
        <div className="text-center text-gray-500 p-8">
          <FiImage className="h-12 w-12 mx-auto mb-4" />
          <p>No images available</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className={`relative ${className}`}>
      {/* Image slides */}
      <div className="relative overflow-hidden h-full w-full">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="h-full w-full"
          >
            {/* Loading spinner */}
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-100 z-10">
                <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
            )}
            
            {/* Actual image */}
            <img 
              src={allImages[currentIndex].image_url} 
              alt={`Image ${currentIndex + 1}`}
              className="h-full w-full object-cover"
              onLoad={handleImageLoad}
              onError={handleImageError}
            />
            
            {/* Error fallback */}
            {hasError && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
                <div className="text-center text-gray-500">
                  <FiImage className="h-12 w-12 mx-auto mb-2" />
                  <p>Failed to load image</p>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
      
      {/* Navigation arrows */}
      {allImages.length > 1 && (
        <>
          <button 
            onClick={handlePrev}
            className="absolute left-4 top-1/2 transform -translate-y-1/2 bg-black/50 text-white rounded-full p-2 hover:bg-black/70 z-20"
            aria-label="Previous image"
          >
            <FiChevronLeft className="w-6 h-6" />
          </button>
          <button 
            onClick={handleNext}
            className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-black/50 text-white rounded-full p-2 hover:bg-black/70 z-20"
            aria-label="Next image"
          >
            <FiChevronRight className="w-6 h-6" />
          </button>
        </>
      )}
      
      {/* Indicators */}
      {allImages.length > 1 && (
        <div className="absolute bottom-4 left-0 right-0 flex justify-center space-x-2 z-20">
          {allImages.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentIndex(index)}
              className={`w-3 h-3 rounded-full ${
                currentIndex === index ? 'bg-white' : 'bg-white/50'
              }`}
              aria-label={`Go to image ${index + 1}`}
            />
          ))}
        </div>
      )}
      
      {/* Image counter */}
      <div className="absolute top-4 right-4 bg-black/50 text-white text-xs px-2 py-1 rounded z-20">
        {currentIndex + 1} / {allImages.length}
      </div>
    </div>
  );
};

export default ImageCarousel;