import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiCamera, FiEye, FiX, FiChevronLeft, FiChevronRight } from 'react-icons/fi';

const MagazineGallery = ({ images, placeName }) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  
  if (!images || images.length === 0) {
    return (
      <div className="bg-gray-50 rounded-xl p-8 text-center">
        <FiCamera className="h-12 w-12 text-gray-400 mx-auto mb-3" />
        <p className="text-gray-500">No images available for this destination yet.</p>
      </div>
    );
  }

  return (
    <div>
      {/* Main gallery grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {images.map((image, index) => (
          <motion.div
            key={index}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="relative aspect-square overflow-hidden rounded-xl shadow-md cursor-pointer"
            onClick={() => {
              setActiveIndex(index);
              setLightboxOpen(true);
            }}
          >
            <img
              src={image.image_url}
              alt={`${placeName} - Image ${index + 1}`}
              className="w-full h-full object-cover transition-transform duration-300 hover:scale-110"
              onError={(e) => {
                e.target.src = '/images/placeholder.jpg';
              }}
            />
            <div className="absolute inset-0 bg-black bg-opacity-0 hover:bg-opacity-30 transition-opacity duration-300 flex items-center justify-center">
              <div className="opacity-0 hover:opacity-100 text-white">
                <FiEye className="h-8 w-8" />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Lightbox */}
      <AnimatePresence>
        {lightboxOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black bg-opacity-90 flex items-center justify-center p-4"
            onClick={() => setLightboxOpen(false)}
          >
            <button
              className="absolute top-4 right-4 text-white p-2 rounded-full bg-black bg-opacity-50 hover:bg-opacity-70 z-10"
              onClick={(e) => {
                e.stopPropagation();
                setLightboxOpen(false);
              }}
            >
              <FiX className="h-6 w-6" />
            </button>
            
            {/* Navigation buttons */}
            <button
              className="absolute left-4 text-white p-3 rounded-full bg-black bg-opacity-50 hover:bg-opacity-70 z-10"
              onClick={(e) => {
                e.stopPropagation();
                setActiveIndex((prevIndex) => (prevIndex === 0 ? images.length - 1 : prevIndex - 1));
              }}
            >
              <FiChevronLeft className="h-6 w-6" />
            </button>
            
            <button
              className="absolute right-4 text-white p-3 rounded-full bg-black bg-opacity-50 hover:bg-opacity-70 z-10"
              onClick={(e) => {
                e.stopPropagation();
                setActiveIndex((prevIndex) => (prevIndex === images.length - 1 ? 0 : prevIndex + 1));
              }}
            >
              <FiChevronRight className="h-6 w-6" />
            </button>
            
            {/* Current image */}
            <motion.div
              key={activeIndex}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="relative max-w-4xl max-h-[80vh] mx-auto"
            >
              <img
                src={images[activeIndex].image_url}
                alt={`${placeName} - Image ${activeIndex + 1}`}
                className="max-w-full max-h-[80vh] object-contain"
                onError={(e) => {
                  e.target.src = '/images/placeholder.jpg';
                }}
              />
              
              {/* Image counter */}
              <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 text-white bg-black bg-opacity-50 px-4 py-2 rounded-full text-sm">
                {activeIndex + 1} / {images.length}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default MagazineGallery;
