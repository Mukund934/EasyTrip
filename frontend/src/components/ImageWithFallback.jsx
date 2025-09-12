import { useState, useEffect } from 'react';
import Image from 'next/image';

const ImageWithFallback = ({ src, alt, width, height, className, objectFit, priority, showTimestamp }) => {
  const [imgSrc, setImgSrc] = useState('');
  const [error, setError] = useState(false);
  const [loaded, setLoaded] = useState(false);
  
  useEffect(() => {
    // Reset state when source changes
    setImgSrc(src);
    setError(false);
    setLoaded(false);
    
    // Log the image source for debugging
    console.log(`Image source updated for ${alt}:`, src);
  }, [src, alt]);
  
  // Add cache busting for development
  const finalSrc = process.env.NODE_ENV === 'development' 
    ? `${imgSrc || '/images/placeholder.jpg'}${imgSrc && imgSrc.includes('?') ? '&' : '?'}t=${Date.now()}` 
    : (imgSrc || '/images/placeholder.jpg');
  
  return (
    <div className={`relative ${className || ''}`}>
      {!loaded && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-200 animate-pulse">
          <span className="text-gray-500 text-sm">Loading...</span>
        </div>
      )}
      
      <Image
        src={error ? '/images/placeholder.jpg' : finalSrc}
        alt={alt || 'Image'}
        width={width || 500}
        height={height || 300}
        className={`${objectFit || 'object-cover'} w-full h-full rounded-lg ${loaded ? 'opacity-100' : 'opacity-0'} transition-opacity duration-300`}
        priority={priority}
        onError={(e) => {
          console.error(`Image load error for: ${imgSrc}`, alt);
          setError(true);
          setLoaded(true);
        }}
        onLoad={() => {
          console.log(`Image loaded successfully: ${alt}`);
          setLoaded(true);
        }}
      />
      
      {showTimestamp && (
        <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs p-1">
          {new Date().toISOString()}
        </div>
      )}
    </div>
  );
};

export default ImageWithFallback;