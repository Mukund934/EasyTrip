import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import NextImage from 'next/image'; 
import {
  FiArrowLeft, FiMapPin, FiStar, FiTag, FiMap, FiShare2, FiHeart,
  FiMessageSquare, FiInfo, FiCalendar, FiChevronDown, FiGlobe, FiCloud,
  FiThermometer, FiDroplet, FiWind, FiCamera, FiNavigation,
  FiExternalLink, FiClock, FiUser, FiEdit3, FiEye, FiX, FiLoader,
  FiAlertCircle, FiRefreshCw, FiCheckCircle, FiBookmark, FiLink,
  FiChevronRight, FiChevronUp, FiList, FiMenu, FiArrowDown, FiArrowUp,
  FiFeather, FiCoffee, FiShield, FiThumbsUp, FiGrid, FiCompass,
  FiChevronLeft, FiFlag, FiTrash2
} from 'react-icons/fi';
import { toast } from 'react-toastify';
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion';
import { getPlaceById, getPlaceImages, getPlaceReviews, createPlaceReview, deletePlaceReview, reportPlaceReview } from '../../services/placeService';
// Server-side reads come from placesApi, which carries no Firebase import — see its header.
import { fetchPlaces, fetchPlaceById, fetchPlaceImages, fetchPlaceReviews } from '../../services/placesApi';
import ImageGallery from '../../components/ImageGallery';
import MagazineGallery from '../../components/MagazineGallery';
import ReviewForm from '../../components/ReviewForm';
import ReviewList from '../../components/ReviewList';
import RelatedPlaces from '../../components/RelatedPlaces';
import { useAuth } from '../../context/AuthContext';
import { useDismissable } from '../../hooks/useDismissable';
import LoadingSpinner from '../../components/LoadingSpinner';
import { getCloudinaryThumbnail, getCloudinaryLargeImage } from '../../utils/cloudinaryHelper';

const FALLBACK_IMAGE = '/images/placeholder.jpg';

// Hero section with cinematic magazine styling
const PlaceMagazineHero = ({ place, onBack, onShare, onToggleFavorite, isFavorite, avgRating, onShareSocial }) => {
  const [shareOpen, setShareOpen] = useState(false);
  const shareRef = useDismissable(shareOpen, () => setShareOpen(false));
  const heroRef = useRef(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [heroHeight, setHeroHeight] = useState('100vh');
  const { scrollY } = useScroll();
  const opacity = useTransform(scrollY, [0, 300], [1, 0]);
  const scale = useTransform(scrollY, [0, 300], [1, 1.1]);
  const titleY = useTransform(scrollY, [0, 300], [0, 100]);
  const parallaxY = useTransform(scrollY, [0, 300], [0, -150]);
  
  // Load hero image with JavaScript
  useEffect(() => {
    if (!place || !heroRef.current) return;
    
    const img = new window.Image();
    const imageUrl = getCloudinaryLargeImage(
      place.primary_image_url || place.image_url || FALLBACK_IMAGE,
      1600
    );
    
    img.onload = () => {
      setImageLoaded(true);
      heroRef.current.style.backgroundImage = `url(${imageUrl})`;
    };
    
    img.onerror = () => {
      heroRef.current.style.backgroundImage = 'linear-gradient(to right, #4b6cb7, #182848)';
      setImageLoaded(true);
    };
    
    img.src = imageUrl;
    
    // Adjust hero height based on screen size
    const handleResize = () => {
      if (window.innerWidth < 640) {
        setHeroHeight('85vh');
      } else {
        setHeroHeight('100vh');
      }
    };
    
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [place]);

  return (
    <motion.div 
      ref={heroRef}
      className="relative overflow-hidden"
      style={{
        height: heroHeight,
        backgroundPosition: 'center',
        backgroundSize: 'cover',
        backgroundRepeat: 'no-repeat',
        scale: scale
      }}
    >
      {/* Loading indicator */}
      <AnimatePresence>
        {!imageLoaded && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center bg-gray-900 z-10"
          >
            <div className="text-center">
              <LoadingSpinner size="large" color="white" />
              <p className="mt-4 text-white text-lg font-serif italic">Loading visuals...</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hero overlay with gradient */}
      <motion.div style={{ opacity }} className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/60 to-black/30 z-10" />
      
      {/* Top navigation bar */}
      <div className="absolute top-0 left-0 right-0 px-6 md:px-12 pt-8 md:pt-10 z-30 flex justify-between items-start">
        <motion.button
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          onClick={onBack}
          className="bg-white/90 backdrop-blur-md text-gray-900 p-3 rounded-full hover:bg-white shadow-2xl transition-all duration-300 hover:scale-110 border border-white/20"
          aria-label="Go back"
        >
          <FiArrowLeft className="h-6 w-6" />
        </motion.button>
        
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="flex space-x-3"
        >
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="relative"
            ref={shareRef}
          >
            {/* Was a CSS `group-hover` disclosure, which does not exist on touch — every mobile
                user and every keyboard user was locked out of sharing entirely (IMP-079). The
                trigger also called onShare() directly, so clicking it copied the link while the
                menu it revealed offered a different set of actions. */}
            <button
              onClick={() => setShareOpen((open) => !open)}
              className="bg-white/90 backdrop-blur-md text-gray-900 p-3 rounded-full hover:bg-white shadow-2xl transition-all duration-300 hover:scale-110 border border-white/20"
              aria-label="Share this place"
              aria-haspopup="menu"
              aria-expanded={shareOpen}
            >
              <FiShare2 className="h-6 w-6 transition-colors" />
            </button>

            {shareOpen && (
              <div className="absolute right-0 mt-2 w-56 z-40 origin-top-right" role="menu" aria-label="Share options">
                <div className="bg-white rounded-xl shadow-2xl border border-gray-100 overflow-hidden">
                  <div className="p-4 border-b border-gray-100">
                    <h3 className="font-serif font-semibold text-gray-900">Share this place</h3>
                  </div>
                  <div className="p-2">
                    {/* Static classes: these were `hover:bg-${color}-50` template literals, which
                        the Tailwind JIT scanner cannot see, so none of those styles were ever
                        generated. */}
                    {[
                      { platform: 'copy', label: 'Copy Link', icon: FiLink, hover: 'hover:bg-gray-50 hover:text-gray-900' },
                      { platform: 'twitter', label: 'Twitter', icon: FiExternalLink, hover: 'hover:bg-sky-50 hover:text-sky-700' },
                      { platform: 'facebook', label: 'Facebook', icon: FiExternalLink, hover: 'hover:bg-primary-50 hover:text-primary-700' },
                      { platform: 'whatsapp', label: 'WhatsApp', icon: FiExternalLink, hover: 'hover:bg-green-50 hover:text-green-700' }
                    ].map(({ platform, label, icon: Icon, hover }) => (
                      <button
                        key={platform}
                        role="menuitem"
                        onClick={() => {
                          setShareOpen(false);
                          return platform === 'copy' ? onShare() : onShareSocial(platform);
                        }}
                        className={`flex items-center w-full text-left px-4 py-3 text-sm text-gray-700 rounded-lg transition-all duration-200 ${hover}`}
                      >
                        <Icon className="mr-3 h-4 w-4" />
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </motion.div>
          
          <motion.button
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            onClick={onToggleFavorite}
            className={`bg-white/90 backdrop-blur-md p-3 rounded-full hover:bg-white shadow-2xl transition-all duration-300 hover:scale-110 border border-white/20 ${
              isFavorite ? 'text-red-500' : 'text-gray-900 hover:text-red-500'
            }`}
            aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          >
            <motion.div
              animate={{ scale: isFavorite ? [1, 1.2, 1] : 1 }}
              transition={{ duration: 0.3 }}
            >
              <FiHeart className={`h-6 w-6 ${isFavorite ? 'fill-current' : ''}`} />
            </motion.div>
          </motion.button>
        </motion.div>
      </div>
      
      {/* Magazine-style title overlay - positioned at center */}
      <motion.div 
        style={{ y: titleY }}
        className="absolute inset-x-0 bottom-0 top-0 flex flex-col items-center justify-center z-20 text-white px-6 md:px-12"
      >
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: "easeOut" }}
          className="max-w-4xl mx-auto text-center"
        >
          {/* Magazine-style category label */}
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mb-4"
          >
            <span className="inline-block px-3 py-1 border-b-2 border-white/70 text-white/90 text-sm font-semibold tracking-widest uppercase">
              {place.themes?.[0] || 'Featured Destination'}
            </span>
          </motion.div>
          
          {/* Large title with serif font */}
          <h1 className="font-serif text-5xl md:text-7xl lg:text-8xl font-black mb-6 leading-none tracking-tight text-shadow-2xl">
            {place.name}
          </h1>
          
          {/* Magazine-style subtitle/deck */}
          <p className="text-xl md:text-2xl font-serif italic text-white/90 max-w-3xl mx-auto mb-8 leading-relaxed">
            {place.description ? (
              place.description.length > 120 ? 
                place.description.substring(0, 120) + '...' : 
                place.description
            ) : (
              `Discover the hidden treasures and unique charm of this captivating destination`
            )}
          </p>
          
          {/* Location and ratings line */}
          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4 text-lg">
            <motion.div 
              className="flex items-center bg-black/40 backdrop-blur-sm px-4 py-2 rounded-full border border-white/20"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
            >
              <FiMapPin className="mr-2 h-5 w-5" />
              <span className="font-medium">
                {place.location}{place.district && `, ${place.district}`}{place.state && `, ${place.state}`}
              </span>
            </motion.div>
            
            {avgRating > 0 && (
              <motion.div 
                className="flex items-center bg-black/40 backdrop-blur-sm px-4 py-2 rounded-full border border-white/20"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 }}
              >
                <FiStar className="mr-2 h-5 w-5 text-yellow-400 fill-current" />
                <span className="font-medium">
                  {avgRating} ({place.rating_count} {place.rating_count === 1 ? 'review' : 'reviews'})
                </span>
              </motion.div>
            )}
          </div>
          
          {/* Scroll down indicator */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7, duration: 0.5 }}
            className="absolute bottom-16 left-1/2 transform -translate-x-1/2"
          >
            <motion.div 
              animate={{ y: [0, 10, 0] }}
              transition={{ repeat: Infinity, duration: 1.5 }}
              className="flex flex-col items-center"
            >
              <span className="text-sm font-medium mb-2 text-white/80">Discover More</span>
              <FiArrowDown className="h-6 w-6 text-white/80" />
            </motion.div>
          </motion.div>
        </motion.div>
      </motion.div>
      
      {/* Editorial information line */}
      <div className="absolute bottom-0 left-0 right-0 py-4 px-6 z-20 text-white/60 flex justify-between text-xs bg-gradient-to-t from-black to-transparent">
        <div className="flex items-center">
          <FiCalendar className="mr-1 h-3 w-3" />
          <span>Published: {formatDate(place.created_at) || 'September 2025'}</span>
        </div>
        {place.updated_at && (
          <div className="hidden md:flex items-center">
            <FiClock className="mr-1 h-3 w-3" />
            <span>Updated: {formatDate(place.updated_at)}</span>
          </div>
        )}
      </div>
    </motion.div>
  );
};

// Table of Contents component
const TableOfContents = ({ sections }) => {
  const [isOpen, setIsOpen] = useState(false);
  
  return (
    <div className="bg-white rounded-2xl shadow-xl p-6 mb-8 border border-gray-100 hover:shadow-2xl transition-shadow duration-300">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full"
      >
        <div className="flex items-center">
          <div className="p-2 bg-primary-100 rounded-lg mr-3">
            <FiList className="text-primary-600 h-5 w-5" />
          </div>
          <h3 className="font-serif text-xl font-bold text-gray-900">In This Article</h3>
        </div>
        <FiChevronDown className={`h-5 w-5 text-gray-500 transform transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <ul className="mt-4 space-y-2 border-l-2 border-primary-100 pl-4">
              {sections.map((section, index) => (
                <li key={index} className="py-1">
                  <a 
                    href={`#${section.id}`}
                    className="flex items-center text-gray-700 hover:text-primary-600 transition-colors"
                  >
                    <span className="text-primary-600 font-serif font-bold mr-2">{index + 1}</span>
                    <span className="font-medium">{section.title}</span>
                  </a>
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// Fact Box component
const FactBox = ({ title, facts }) => {
  return (
    <div className="my-8 bg-gray-50 border border-gray-200 rounded-2xl overflow-hidden">
      <div className="bg-gradient-to-r from-gray-800 to-gray-900 text-white py-3 px-6">
        <h3 className="font-medium flex items-center">
          <FiInfo className="mr-2" />
          {title || "Quick Facts"}
        </h3>
      </div>
      <div className="p-5">
        <ul className="space-y-3">
          {facts.map((fact, index) => (
            <li key={index} className="flex">
              <span className="font-serif font-bold text-2xl text-primary-500 mr-3">•</span>
              <span className="text-gray-700">{fact}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

// Enhanced Image Component with magazine styling
const MagazineImage = ({ src, alt, caption, credit, className, fullWidth = false }) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  
  return (
    <figure className={`my-8 ${fullWidth ? 'w-full' : 'max-w-3xl mx-auto'} ${className || ''}`}>
      <div className="relative overflow-hidden bg-gray-100 rounded-xl shadow-lg">
        {!isLoaded && !hasError && (
          <div className="absolute inset-0 flex items-center justify-center">
            <LoadingSpinner color="primary" />
          </div>
        )}
        
        {hasError ? (
          <div className="flex items-center justify-center h-64 bg-gray-100 text-gray-500">
            <FiAlertCircle className="mr-2 h-5 w-5" />
            <span>Image unavailable</span>
          </div>
        ) : (
          <img
            src={src}
            alt={alt}
            className={`w-full transition-opacity duration-500 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
            onLoad={() => setIsLoaded(true)}
            onError={() => {
              setIsLoaded(true);
              setHasError(true);
            }}
          />
        )}
      </div>
      
      {(caption || credit) && (
        <figcaption className="mt-2 text-gray-600 text-sm italic flex justify-between border-b border-gray-200 pb-2">
          {caption && <span>{caption}</span>}
          {credit && <span className="text-gray-400 text-xs">Credit: {credit}</span>}
        </figcaption>
      )}
    </figure>
  );
};

// Magazine-style Sidebar with progressive loading
const MagazineSidebar = ({ place, reviews = [], isLoading = false }) => (
  <aside className="lg:sticky lg:top-24 space-y-8">
    {/* Editor's Note */}
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="bg-gradient-to-br from-gray-900 to-gray-800 text-white rounded-2xl shadow-xl p-6 border border-gray-700"
    >
      <h3 className="text-xl font-serif font-bold mb-4 flex items-center">
        <div className="p-2 bg-yellow-500/20 rounded-lg mr-3">
          <FiFeather className="text-yellow-500 h-5 w-5" />
        </div>
        Editor's Note
      </h3>
      
      <p className="text-gray-300 italic font-serif mb-4 leading-relaxed">
        {place.description ? 
          `"${place.description.substring(0, 150)}${place.description.length > 150 ? '...' : ''}"` : 
          `"${place.name} represents one of those rare finds that manages to capture the imagination and transport visitors to another world. Our editorial team was particularly impressed with the authentic cultural experiences available here."`
        }
      </p>
      
      <div className="flex items-center mt-4 pt-4 border-t border-gray-700/50">
        <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center text-white font-medium mr-3">
          ET
        </div>
        <div>
          <p className="font-medium">Editorial Team</p>
          <p className="text-gray-400 text-sm">EasyTrip Magazine</p>
        </div>
      </div>
    </motion.div>
    
    {/* Location Details Card */}
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.1 }}
      className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100"
    >
      <h3 className="text-xl font-serif font-bold text-gray-900 mb-5 flex items-center">
        <div className="p-2 bg-primary-100 rounded-lg mr-3">
          <FiMapPin className="text-primary-600 h-5 w-5" />
        </div>
        Location Details
      </h3>
      
      {isLoading ? (
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex justify-between py-2">
              <div className="h-4 bg-gray-200 rounded w-20 animate-pulse" />
              <div className="h-4 bg-gray-200 rounded w-32 animate-pulse" />
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {[
            { label: 'Location', value: place.location, icon: FiMapPin },
            { label: 'District', value: place.district, icon: FiMap },
            { label: 'State', value: place.state, icon: FiGlobe },
            { label: 'Locality', value: place.locality, icon: FiNavigation },
            { label: 'PIN Code', value: place.pin_code, icon: FiTag }
          ].filter(item => item.value).map((item, index) => (
            <motion.div 
              key={index} 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0"
            >
              <div className="flex items-center">
                <item.icon className="h-4 w-4 text-gray-500 mr-2" />
                <span className="font-medium text-gray-700">{item.label}:</span>
              </div>
              <span className="text-gray-900 font-semibold">{item.value}</span>
            </motion.div>
          ))}
        </div>
      )}
      
      {/* Ratings Breakdown */}
      {reviews.length > 0 && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mt-6 pt-6 border-t border-gray-100"
        >
          <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
            <FiStar className="mr-2 h-4 w-4 text-yellow-500" />
            Ratings Breakdown
          </h4>
          
          {/* Was four invented sub-scores (4.7 Overall / 4.2 Value / 3.9 Accessibility / 4.5
              Facilities) with a comment admitting it was a mockup. Those dimensions do not exist in
              the data model — a review carries one 1-5 rating — so they could never be computed.
              This is the distribution that CAN be computed, from the reviews actually loaded. */}
          <div className="space-y-2">
            {[5, 4, 3, 2, 1].map((star) => {
              const count = reviews.filter((review) => review.rating === star).length;
              const share = reviews.length > 0 ? (count / reviews.length) * 100 : 0;
              return (
                <div key={star} className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">{star} star{star === 1 ? '' : 's'}</span>
                  <div className="flex items-center">
                    <div className="w-24 h-2 bg-gray-200 rounded-full mr-2 overflow-hidden">
                      <div
                        className="h-full bg-yellow-500 rounded-full"
                        style={{ width: `${share}%` }}
                      ></div>
                    </div>
                    <span className="text-sm font-medium w-6 text-right">{count}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}
      
    </motion.div>

    {/* Map Card with Magazine Styling */}
    {place.latitude && place.longitude ? (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
        className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100"
      >
        <h3 className="text-xl font-serif font-bold text-gray-900 mb-5 flex items-center">
          <div className="p-2 bg-green-100 rounded-lg mr-3">
            <FiMap className="text-green-600 h-5 w-5" />
          </div>
          On The Map
        </h3>
        
        <div className="relative rounded-xl overflow-hidden border-2 border-gray-200 mb-4">
          {isLoading ? (
            <div className="w-full h-64 bg-gray-200 animate-pulse flex items-center justify-center">
              <FiLoader className="h-8 w-8 text-gray-400 animate-spin" />
            </div>
          ) : (
            <div className="w-full h-64 bg-gray-100 relative">
              <iframe
                title={`Map of ${place.name}`}
                src={`https://maps.google.com/maps?q=${place.latitude},${place.longitude}&z=15&output=embed`}
                className="w-full h-full border-0"
                allowFullScreen
                loading="lazy"
              />
              {/* Decorative compass */}
              <div className="absolute top-3 right-3 bg-white/80 backdrop-blur-sm rounded-full p-2 shadow">
                <FiNavigation className="h-5 w-5 text-primary-600" />
              </div>
            </div>
          )}
        </div>
        
        <div className="grid grid-cols-2 gap-3">
          <motion.a
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            href={`https://www.google.com/maps/search/?api=1&query=${place.latitude},${place.longitude}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center bg-primary-600 text-white px-4 py-3 rounded-lg text-sm font-semibold hover:bg-primary-700 transition-colors"
          >
            <FiNavigation className="mr-2 h-4 w-4" />
            Directions
          </motion.a>
          <motion.a
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            href={`https://www.google.com/maps/@${place.latitude},${place.longitude},15z`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center bg-gray-100 text-gray-700 px-4 py-3 rounded-lg text-sm font-semibold hover:bg-gray-200 transition-colors"
          >
            <FiEye className="mr-2 h-4 w-4" />
            Explore Area
          </motion.a>
        </div>
      </motion.div>
    ) : null}
    
    
  </aside>
);

// Magazine-style Review Section
const MagazineReviews = ({ reviews, onReportReview, onDeleteReview, isDeletingReview = false, currentUserId, isLoading = false }) => {
  const [viewMode, setViewMode] = useState('curated');
  
  // Filter out some of the most positive reviews for "curated" view
  const curatedReviews = useMemo(() => {
    if (!reviews.length) return [];
    
    // In a real app, you'd use more sophisticated curation logic
    return reviews
      .filter(review => review.rating >= 4)
      .sort((a, b) => b.rating - a.rating)
      .slice(0, 3);
  }, [reviews]);
  
  if (isLoading) {
    return (
      <div className="space-y-6">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bg-white rounded-xl p-6 shadow-md border border-gray-100 animate-pulse">
            <div className="flex items-center mb-4">
              <div className="w-12 h-12 bg-gray-200 rounded-full mr-4"></div>
              <div className="space-y-2">
                <div className="h-4 bg-gray-200 rounded w-32"></div>
                <div className="h-3 bg-gray-200 rounded w-24"></div>
              </div>
            </div>
            <div className="space-y-2">
              <div className="h-4 bg-gray-200 rounded w-full"></div>
              <div className="h-4 bg-gray-200 rounded w-5/6"></div>
              <div className="h-4 bg-gray-200 rounded w-4/6"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }
  
  if (!reviews.length) {
    return (
      <div className="text-center py-8 bg-gray-50 rounded-xl border border-gray-100">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
          <FiMessageSquare className="h-8 w-8 text-gray-400" />
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">No Reviews Yet</h3>
        <p className="text-gray-600 max-w-md mx-auto">
          Be the first to share your experience at this destination.
        </p>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      {/* View toggle */}
      <div className="flex justify-center mb-6">
        <div className="inline-flex bg-gray-100 rounded-full p-1">
          <button
            onClick={() => setViewMode('curated')}
            className={`px-4 py-2 rounded-full text-sm font-medium ${
              viewMode === 'curated' 
                ? 'bg-white shadow text-primary-600' 
                : 'text-gray-700 hover:text-gray-900'
            }`}
          >
            Editor's Picks
          </button>
          <button
            onClick={() => setViewMode('all')}
            className={`px-4 py-2 rounded-full text-sm font-medium ${
              viewMode === 'all' 
                ? 'bg-white shadow text-primary-600' 
                : 'text-gray-700 hover:text-gray-900'
            }`}
          >
            All Reviews ({reviews.length})
          </button>
        </div>
      </div>
      
      {/* Reviews grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {(viewMode === 'curated' ? curatedReviews : reviews).map((review, index) => (
          <motion.div
            key={review.id || index}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className={`bg-white rounded-xl p-6 shadow-md border border-gray-100 ${
              review.rating >= 4 
                ? 'border-l-4 border-l-green-500' 
                : review.rating <= 2 
                  ? 'border-l-4 border-l-red-500' 
                  : ''
            }`}
          >
            <div className="flex items-center mb-4">
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mr-4 text-gray-500">
                {review.user_avatar
                  ? <img src={getCloudinaryThumbnail(review.user_avatar, 400, 400)} alt={review.user_name} className="w-full h-full rounded-full object-cover" />
                  : <FiUser className="w-6 h-6" />
                }
              </div>
              <div>
                <h4 className="font-medium text-gray-900">{review.user_name || 'Anonymous Traveler'}</h4>
                <div className="flex items-center text-sm text-gray-500">
                  <div className="flex mr-2">
                    {[...Array(5)].map((_, i) => (
                      <FiStar 
                        key={i}
                        className={`w-4 h-4 ${i < review.rating ? 'text-yellow-500 fill-current' : 'text-gray-300'}`}
                      />
                    ))}
                  </div>
                  <span className="text-xs">
                    {formatDate(review.created_at) || 'Recent visit'}
                  </span>
                </div>
              </div>
            </div>
            
            <p className="text-gray-700 font-serif leading-relaxed">
              {review.comment || "Great experience! Highly recommended for all travelers."}
            </p>
            
            <div className="mt-4 pt-4 border-t border-gray-100 flex justify-between items-center text-sm">
              <div className="text-gray-500 font-medium">
                {/* Could add helpful count here */}
                <span>Was this helpful?</span>
              </div>
              
              {/* `is_own` is set server-side: the payload carries an opaque author digest rather
                  than a uid, so this flag is the only way the client can identify its own review.
                  Owners get delete; everyone else gets report. Offering someone the option to
                  report their own review would be noise, and the API rejects it anyway. */}
              {review.is_own ? (
                <button
                  onClick={() => onDeleteReview(review.id)}
                  disabled={isDeletingReview}
                  className="text-red-500 hover:text-red-700 disabled:opacity-50 flex items-center gap-1"
                >
                  <FiTrash2 className="w-4 h-4" />
                  <span>{isDeletingReview ? 'Deleting…' : 'Delete'}</span>
                </button>
              ) : (
                <button
                  onClick={() => onReportReview(review.id)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <span className="sr-only">Report this review</span>
                  <FiFlag className="w-4 h-4" />
                </button>
              )}
            </div>
          </motion.div>
        ))}
      </div>
      
      {/* Show more button */}
      {viewMode === 'curated' && reviews.length > curatedReviews.length && (
        <div className="text-center mt-8">
          <button
            onClick={() => setViewMode('all')}
            className="inline-flex items-center justify-center px-6 py-3 border border-gray-300 shadow-sm text-base font-medium rounded-full text-gray-700 bg-white hover:bg-gray-50"
          >
            <span>View All {reviews.length} Reviews</span>
            <FiChevronRight className="ml-2 h-5 w-5" />
          </button>
        </div>
      )}
    </div>
  );
};

// Enhanced Additional Details with magazine layout
const MagazineDetails = ({ customKeys, themes, isLoading = false }) => {
  // Filter out system fields and empty values
  const filteredCustomKeys = customKeys ? Object.entries(customKeys).filter(([key, value]) => {
    const systemFields = [
      'created_by', 'created_at', 'updated_by', 'updated_at', 
      'created_by_name', 'updated_by_name', 'previous_update'
    ];
    return !systemFields.includes(key) && value && value.toString().trim() !== '';
  }) : [];

  const hasContent = (themes && themes.length > 0) || filteredCustomKeys.length > 0;

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
        <div className="flex items-center mb-6">
          <div className="w-12 h-12 bg-gray-200 rounded-lg mr-4 animate-pulse" />
          <div className="h-8 bg-gray-200 rounded w-64 animate-pulse" />
        </div>
        <div className="space-y-4">
          <div className="h-6 bg-gray-200 rounded w-32 animate-pulse" />
          <div className="flex flex-wrap gap-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-8 bg-gray-200 rounded-full w-20 animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!hasContent) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100"
    >
      <div className="flex items-center mb-8">
        <div className="p-3 bg-purple-100 rounded-lg mr-4">
          <FiInfo className="text-purple-600 h-6 w-6" />
        </div>
        <h3 className="text-3xl font-serif font-bold text-gray-900">Essential Details</h3>
      </div>
      
      <div className="space-y-10">
        {/* Themes as magazine-style tags */}
        {themes && themes.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <h4 className="text-lg font-serif font-bold text-gray-800 mb-5 flex items-center border-b border-gray-200 pb-2">
              <FiTag className="mr-2 h-5 w-5 text-purple-600" />
              Perfect For
            </h4>
            <div className="flex flex-wrap gap-3">
              {themes.map((theme, index) => {
                // Create different styles for variety
                const styles = [
                  "from-purple-500 to-pink-500",
                  "from-blue-500 to-indigo-500",
                  "from-emerald-500 to-teal-500",
                  "from-amber-500 to-orange-500",
                  "from-rose-500 to-red-500"
                ];
                
                return (
                  <motion.span
                    key={index}
                    initial={{ opacity: 0, scale: 0.8, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ delay: 0.3 + index * 0.1 }}
                    className={`bg-gradient-to-r ${styles[index % styles.length]} text-white text-sm font-medium px-5 py-2.5 rounded-full shadow-md`}
                  >
                    {theme.charAt(0).toUpperCase() + theme.slice(1)}
                  </motion.span>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Custom Keys in a magazine layout */}
        {filteredCustomKeys.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <h4 className="text-lg font-serif font-bold text-gray-800 mb-5 flex items-center border-b border-gray-200 pb-2">
              <FiInfo className="mr-2 h-5 w-5 text-purple-600" />
              Important Information
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {filteredCustomKeys.map(([key, value], index) => {
                // Different card styles for visual interest
                const cardStyles = [
                  "bg-gray-50 border-gray-200",
                  "bg-primary-50 border-primary-200",
                  "bg-amber-50 border-amber-200",
                  "bg-emerald-50 border-emerald-200",
                  "bg-rose-50 border-rose-200",
                  "bg-violet-50 border-violet-200"
                ];
                
                const style = cardStyles[index % cardStyles.length];
                
                return (
                  <motion.div 
                    key={index} 
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.4 + index * 0.1 }}
                    className={`rounded-xl p-5 border ${style}`}
                  >
                    <dt className="text-sm font-semibold text-gray-600 uppercase tracking-wider mb-2">
                      {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </dt>
                    <dd className="text-gray-900 font-serif text-lg">{value}</dd>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
};

// Utility functions
const formatDate = (dateString) => {
  if (!dateString) return null;
  try {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return null;
  }
};

const formatRelativeTime = (dateString) => {
  if (!dateString) return null;
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffInDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
    
    if (diffInDays === 0) return 'Today';
    if (diffInDays === 1) return 'Yesterday';
    if (diffInDays < 7) return `${diffInDays} days ago`;
    if (diffInDays < 30) return `${Math.floor(diffInDays / 7)} weeks ago`;
    if (diffInDays < 365) return `${Math.floor(diffInDays / 30)} months ago`;
    return `${Math.floor(diffInDays / 365)} years ago`;
  } catch {
    return null;
  }
};


/**
 * Compose the gallery: the primary image first, then the gallery rows, de-duplicated by URL.
 *
 * Shared by `getStaticProps` and the client refresh path so the two cannot disagree about what
 * the first image is — which matters, because the first image is the hero.
 */
const composeGallery = (place, galleryImages) => {
  const all = [
    { id: 'primary', image_url: place?.primary_image_url || place?.image_url || FALLBACK_IMAGE },
    ...(galleryImages || [])
  ].filter((img) => img.image_url);

  const seen = new Set();
  return all.filter((img) => {
    if (seen.has(img.image_url)) return false;
    seen.add(img.image_url);
    return true;
  });
};

// Main Component with enhanced magazine-style layout
//
// Place, gallery and reviews arrive as props from `getStaticProps` (IMP-040). This page used to
// be a three-stage client waterfall behind a spinner — place, then images + reviews, then
// related places — which meant a crawler saw an empty shell on the pages a travel site most
// needs indexed, and a visitor saw a spinner until three round trips had resolved.
export default function PlaceDetails({ initialPlace = null, initialImages = [], initialReviews = [] }) {
  const router = useRouter();
  const { id } = router.query;
  const { currentUser, isAuthenticated, getIdToken, loading: authLoading } = useAuth();
  const { scrollY } = useScroll();

  // State management — seeded from the pre-rendered payload, so the first render already has
  // content. The fetch path below survives for the retry button and for post-review refreshes.
  const [place, setPlace] = useState(initialPlace);
  const [images, setImages] = useState(initialImages);
  const [reviews, setReviews] = useState(initialReviews);
  const [loading, setLoading] = useState(!initialPlace);
  const [contentLoading, setContentLoading] = useState(!initialPlace);
  const [error, setError] = useState(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [activeSection, setActiveSection] = useState('about');
  const [showTableOfContents, setShowTableOfContents] = useState(false);

  // Review form state
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [isDeletingReview, setIsDeletingReview] = useState(false);
  const [reviewError, setReviewError] = useState(null);

  // Scroll progress
  const scrollProgress = useTransform(scrollY, [0, 2000], [0, 100]);
  
  // Content sections for table of contents
  const sections = [
    { id: 'about', title: 'About This Place' },
    { id: 'details', title: 'Essential Details' },
    { id: 'gallery', title: 'Photo Gallery' },
    { id: 'reviews', title: 'Traveler Reviews' },
    { id: 'related', title: 'Similar Places' }
  ];

  // Memoized calculation for average rating
  const avgRating = useMemo(() => {
    if (!place || !place.rating_count) return 0;
    return (place.rating_sum / place.rating_count).toFixed(1);
  }, [place]);

  // The API allows one review per user per place, so a second submit edits the existing one.
  // Ownership is marked by the server (`is_own`): the payload's user_id is an opaque
  // per-place digest, so comparing it to a Firebase uid would never match.
  const existingReview = useMemo(() => {
    if (!currentUser) return null;
    return reviews.find((review) => review.is_own) || null;
  }, [reviews, currentUser]);

  // Seed the form from the signed-in user's existing review so editing starts from its values
  useEffect(() => {
    if (!existingReview) return;
    setReviewRating(existingReview.rating || 0);
    setReviewComment(existingReview.comment || '');
  }, [existingReview]);

  // Enhanced data fetching with retry logic
  const fetchAllData = useCallback(async () => {
    if (!id) return;

    setLoading(true);
    setContentLoading(true);
    setError(null);
    
    try {
      console.log(`[${new Date().toISOString()}] Fetching data for place ID: ${id}`);

      // Fetch place data first (critical)
      const placeData = await getPlaceById(id);

      setPlace(placeData);
      setLoading(false); // Allow UI to render with basic data

      // Fetch additional data (non-critical)
      const [imagesData, reviewsData] = await Promise.allSettled([
        getPlaceImages(id),
        getPlaceReviews(id),
      ]);

      // Handle images
      const imageResults = imagesData.status === 'fulfilled' ? imagesData.value : [];
      setImages(composeGallery(placeData, imageResults));

      // Handle reviews
            // Handle reviews
      const reviewResults = reviewsData.status === 'fulfilled' ? reviewsData.value : [];
      setReviews(reviewResults || []);

      console.log(`[${new Date().toISOString()}] Successfully loaded data for place: ${placeData.name}`);
      
    } catch (err) {
      console.error('Error loading page data:', {
        message: err.message,
        placeId: id,
      });
      setError(err.message || 'Failed to load place details. Please try again.');
    } finally {
      setContentLoading(false);
    }
  }, [id]);

  // Re-seed when the props change.
  //
  // `useState(initialPlace)` only runs its initialiser on mount, and Next re-renders this same
  // component with new props when you navigate from one place to another. The keyed
  // ErrorBoundary in `_app` happens to remount the whole page subtree on every route change, so
  // this would be correct without the effect — but that makes this page's correctness depend on
  // an unrelated component's `key`, and the failure mode if someone removes it is silently
  // rendering the previous place's content under the new URL.
  useEffect(() => {
    if (!initialPlace) return;
    setPlace(initialPlace);
    setImages(initialImages);
    setReviews(initialReviews);
    setError(null);
    setLoading(false);
    setContentLoading(false);
  }, [initialPlace, initialImages, initialReviews]);

  // Client fetch, only when the page was not pre-rendered with data. With `getStaticProps` in
  // place that is the retry path rather than the normal one.
  useEffect(() => {
    if (initialPlace) return;
    fetchAllData();
  }, [fetchAllData, initialPlace]);

  // The first reviews read happens at mount, usually a beat before Firebase restores the
  // session, so it goes out unauthenticated and the server cannot mark `is_own`. Re-read
  // once a signed-in identity is known, otherwise a reload always renders the user's own
  // review as somebody else's and the edit UI never appears. Anonymous visitors skip this.
  useEffect(() => {
    if (!id || authLoading || !currentUser?.uid) return;

    let cancelled = false;

    getPlaceReviews(id)
      .then((data) => {
        if (!cancelled) setReviews(data || []);
      })
      .catch((err) => console.error('Error refreshing reviews:', err.message));

    return () => {
      cancelled = true;
    };
  }, [id, authLoading, currentUser?.uid]);

  // Scroll observer for section highlighting
  useEffect(() => {
    const observerOptions = {
      root: null,
      rootMargin: '0px',
      threshold: 0.3
    };

    const observerCallback = (entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const id = entry.target.getAttribute('id');
          if (id) {
            setActiveSection(id);
          }
        }
      });
    };

    const observer = new IntersectionObserver(observerCallback, observerOptions);
    
    sections.forEach(section => {
      const element = document.getElementById(section.id);
      if (element) observer.observe(element);
    });

    return () => {
      sections.forEach(section => {
        const element = document.getElementById(section.id);
        if (element) observer.unobserve(element);
      });
    };
  }, [sections, contentLoading]);

  // Handler for submitting (or updating) the signed-in user's review
  const handleReviewSubmit = async ({ rating, comment }) => {
    if (!isAuthenticated) {
      setReviewError('Please sign in to share your experience.');
      toast.error('You must be logged in to submit a review.');
      return;
    }

    if (!rating) {
      setReviewError('Please select a star rating before submitting.');
      return;
    }

    setIsSubmittingReview(true);
    setReviewError(null);

    const wasEditing = Boolean(existingReview);

    try {
      const token = await getIdToken();
      if (!token) {
        throw new Error('Your session has expired. Please sign in again.');
      }

      // Identity is derived server-side from the verified token, so the body carries
      // only the review itself.
      await createPlaceReview(id, { rating, comment }, token);

      // A database trigger recomputes the rating aggregate, so re-read both the list
      // and the place instead of patching counts client-side.
      const [reviewsResult, placeResult] = await Promise.allSettled([
        getPlaceReviews(id),
        getPlaceById(id),
      ]);

      if (reviewsResult.status === 'fulfilled') {
        setReviews(reviewsResult.value || []);
      }
      if (placeResult.status === 'fulfilled' && placeResult.value) {
        setPlace(placeResult.value);
      }

      toast.success(
        wasEditing
          ? 'Your review has been updated.'
          : 'Thank you! Your review has been published.'
      );
    } catch (err) {
      const message = err?.message || 'Failed to submit review. Please try again.';
      setReviewError(message);
      toast.error(message);
    } finally {
      setIsSubmittingReview(false);
    }
  };

  // Enhanced sharing handlers
  const handleShare = useCallback(() => {
    if (navigator.share && navigator.canShare?.()) {
      navigator.share({
        title: place.name,
        text: `Check out ${place.name} on EasyTrip!`,
        url: window.location.href,
      }).catch(console.error);
    } else {
      navigator.clipboard.writeText(window.location.href).then(() => {
        toast.success('Link copied to clipboard!', {
          icon: <FiCheckCircle className="text-green-500 h-5 w-5" />
        });
      }).catch(() => {
        toast.error('Failed to copy link');
      });
    }
  }, [place?.name]);

  const handleShareSocial = useCallback((platform) => {
    const url = encodeURIComponent(window.location.href);
    const text = encodeURIComponent(`Check out ${place.name} on EasyTrip!`);
    let shareUrl = '';
    
    switch (platform) {
      case 'twitter':
        shareUrl = `https://twitter.com/intent/tweet?url=${url}&text=${text}`;
        break;
      case 'facebook':
        shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${url}`;
        break;
      case 'whatsapp':
        shareUrl = `https://api.whatsapp.com/send?text=${text}%20${url}`;
        break;
      default:
        return;
    }
    window.open(shareUrl, '_blank', 'noopener,noreferrer');
  }, [place?.name]);

  // Handler for reporting reviews. This faked success with a setTimeout until Sprint 2.3
  // (IMP-023/019) — the button told users their report was filed and nothing was recorded.
  const handleReportReview = async (reviewId) => {
    if (!isAuthenticated) {
      toast.error('You must be logged in to report a review.');
      return;
    }

    try {
      const token = await getIdToken();
      if (!token) {
        throw new Error('Your session has expired. Please sign in again.');
      }

      // Reporting the same review twice is a no-op server-side, so there is nothing to guard
      // against here beyond the in-flight state.
      const result = await reportPlaceReview(id, reviewId, undefined, token);
      toast.success(result?.message || 'Thanks — this review has been reported for moderation.');
    } catch (err) {
      toast.error(err?.message || 'Failed to report review.');
    }
  };

  // Handler for deleting the signed-in user's own review. Editing stays on the upsert path in
  // handleReviewSubmit; this covers the one operation that had no route at all (IMP-019).
  const handleDeleteReview = async (reviewId) => {
    if (!isAuthenticated) {
      toast.error('You must be logged in to delete a review.');
      return;
    }

    // Deleting a review also drops the rating it contributed, and there is no undo — so this is
    // one of the few places a confirm is genuinely warranted rather than reflexive.
    if (!window.confirm('Delete your review? This will also remove your rating for this place.')) {
      return;
    }

    setIsDeletingReview(true);

    try {
      const token = await getIdToken();
      if (!token) {
        throw new Error('Your session has expired. Please sign in again.');
      }

      await deletePlaceReview(id, reviewId, token);

      // The delete trigger recomputes the place's rating aggregate, so re-read the place as well
      // as the list — patching counts client-side would drift from what the database now holds.
      const [reviewsResult, placeResult] = await Promise.allSettled([
        getPlaceReviews(id),
        getPlaceById(id),
      ]);

      if (reviewsResult.status === 'fulfilled') {
        setReviews(reviewsResult.value || []);
      }
      if (placeResult.status === 'fulfilled' && placeResult.value) {
        setPlace(placeResult.value);
      }

      // Clear the form too: with the review gone the section reverts to "Share Your Experience",
      // and leaving the old text in the inputs would look like it had not been deleted.
      setReviewRating(0);
      setReviewComment('');
      setReviewError(null);

      toast.success('Your review has been deleted.');
    } catch (err) {
      toast.error(err?.message || 'Failed to delete review.');
    } finally {
      setIsDeletingReview(false);
    }
  };

  // Show loading state
  if (loading && !place) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner size="large" />
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mt-6 text-xl text-gray-600 font-serif italic"
          >
            Loading destination...
          </motion.p>
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
            className="mt-2 text-sm text-gray-500"
          >
            Preparing a beautiful experience for you
          </motion.p>
        </div>
      </div>
    );
  }

  // Show error state
  if (error && !place) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center bg-white rounded-2xl shadow-xl p-8 max-w-md border border-gray-100"
        >
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <FiAlertCircle className="w-10 h-10 text-red-500" />
          </div>
          <h2 className="text-2xl font-serif font-bold text-gray-900 mb-3">Something went wrong</h2>
          <p className="text-gray-600 mb-8 leading-relaxed">{error}</p>
          <div className="flex flex-col sm:flex-row gap-3">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => fetchAllData()}
              className="flex-1 bg-primary-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-primary-700 transition-colors flex items-center justify-center"
            >
              <FiRefreshCw className="mr-2 h-4 w-4" />
              Try Again
            </motion.button>
            <Link 
              href="/browse" 
              className="flex-1 bg-gray-100 text-gray-700 px-6 py-3 rounded-lg font-medium hover:bg-gray-200 transition-colors text-center flex items-center justify-center"
            >
              <FiArrowLeft className="mr-2 h-4 w-4" />
              Explore Places
            </Link>
          </div>
        </motion.div>
      </div>
    );
  }

  // Prepare metadata for SEO and display
  const createdDate = formatDate(place.created_at);
  const updatedDate = formatDate(place.updated_at);
  
  // Create some editorial content
  const editorialExcerpt = place.description || `${place.name} offers travelers a unique blend of experiences, with local culture and natural beauty combining to create unforgettable memories.`;
  
  // Create facts about the place
  const facts = [
    place.district ? `Located in the ${place.district} district of ${place.state || 'the region'}` : null,
    place.custom_keys?.['Best Time to Visit'] ? `Best time to visit: ${place.custom_keys['Best Time to Visit']}` : 'Suitable for year-round visits',
    place.custom_keys?.['Opening Hours'] ? `Open hours: ${place.custom_keys['Opening Hours']}` : null,
    place.custom_keys?.['Entrance Fee'] ? `Entrance fee: ${place.custom_keys['Entrance Fee']}` : 'Contact for current entrance fees',
    'Perfect for photography enthusiasts and nature lovers',
  ].filter(Boolean);

  return (
    <>
      <Head>
        <title>{`${place.name} | EasyTrip Magazine`}</title>
        <meta name="description" content={place.description || `Discover ${place.name} in ${place.location} - Comprehensive travel guide with expert tips, photos and reviews.`} />
        <meta name="keywords" content={`${place.name}, ${place.location}, ${place.tags?.join(', ') || 'travel'}, tourism, vacation, travel guide`} />
        <meta property="og:title" content={`${place.name} | EasyTrip Magazine`} />
        <meta property="og:description" content={place.description || `Discover ${place.name} in ${place.location}`} />
        <meta property="og:image" content={getCloudinaryLargeImage(place.primary_image_url || place.image_url || FALLBACK_IMAGE, 1600)} />
        <meta property="og:url" content={typeof window !== 'undefined' ? window.location.href : ''} />
        <meta name="twitter:card" content="summary_large_image" />
      </Head>

      {/* Reading progress bar */}
      <motion.div 
        className="fixed top-0 left-0 right-0 h-1 bg-primary-600 z-50" 
        style={{ scaleX: scrollProgress, transformOrigin: "0%" }}
      />

      <div className="bg-gray-50 min-h-screen">
        {/* Magazine-style Hero */}
        <PlaceMagazineHero
          place={place}
          onBack={() => router.back()}
          onShare={handleShare}
          onToggleFavorite={() => setIsFavorite(prev => !prev)}
          isFavorite={isFavorite}
          avgRating={avgRating}
          onShareSocial={handleShareSocial}
        />

        {/* Floating table of contents toggle button */}
        <div className="fixed bottom-6 right-6 z-40 md:hidden">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowTableOfContents(prev => !prev)}
            className="bg-primary-600 text-white p-4 rounded-full shadow-lg flex items-center justify-center"
          >
            {showTableOfContents ? <FiX className="h-6 w-6" /> : <FiMenu className="h-6 w-6" />}
          </motion.button>
        </div>

        {/* Mobile table of contents */}
        <AnimatePresence>
          {showTableOfContents && (
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
              className="fixed bottom-20 right-6 z-40 bg-white rounded-xl shadow-xl p-4 w-64 md:hidden"
            >
              <h3 className="font-bold text-gray-900 mb-2 border-b pb-2">On This Page</h3>
              <ul className="space-y-2">
                {sections.map((section) => (
                  <li key={section.id}>
                    <a
                      href={`#${section.id}`}
                      className={`block py-2 px-3 rounded-lg text-sm ${
                        activeSection === section.id
                          ? 'bg-primary-50 text-primary-700 font-medium'
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                      onClick={() => setShowTableOfContents(false)}
                    >
                      {section.title}
                    </a>
                  </li>
                ))}
              </ul>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Magazine Issue Info Bar */}
        <div className="bg-gradient-to-r from-gray-900 to-indigo-900 text-white py-3 border-y border-gray-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between items-center text-sm">
            <div className="flex items-center space-x-4">
              <span className="font-serif">EasyTrip Travel Magazine</span>
              <span className="hidden md:inline-block">•</span>
              <span className="hidden md:inline-block">September 2025 Edition</span>
            </div>
            {currentUser && (
              <div className="flex items-center space-x-4">
                <span className="hidden md:inline-block">Signed in as</span>
                <span>{currentUser.displayName || currentUser.email}</span>
              </div>
            )}
          </div>
        </div>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 relative z-20">
          {/* Table of Contents for larger screens */}
          <div className="hidden md:block mb-12">
            <TableOfContents sections={sections} />
          </div>
          
          <div className="lg:grid lg:grid-cols-3 lg:gap-12">
            {/* Main Content Area */}
            <div className="lg:col-span-2 space-y-16">
              {contentLoading ? (
                <div className="space-y-12">
                  {/* Loading skeletons */}
                  <div className="bg-white rounded-2xl shadow-xl p-8 animate-pulse">
                    <div className="h-8 bg-gray-200 rounded w-1/3 mb-6"></div>
                    <div className="space-y-4">
                      <div className="h-4 bg-gray-200 rounded w-full"></div>
                      <div className="h-4 bg-gray-200 rounded w-5/6"></div>
                      <div className="h-4 bg-gray-200 rounded w-4/6"></div>
                    </div>
                  </div>
                  
                  <div className="bg-white rounded-2xl shadow-xl p-8 animate-pulse">
                    <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="h-24 bg-gray-200 rounded"></div>
                      <div className="h-24 bg-gray-200 rounded"></div>
                      <div className="h-24 bg-gray-200 rounded"></div>
                      <div className="h-24 bg-gray-200 rounded"></div>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {/* About Section */}
                  <section id="about" className="scroll-mt-24">
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.6 }}
                      className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100"
                    >
                      <h2 className="text-4xl font-serif font-bold text-gray-900 mb-8 leading-tight">
                        About {place.name}
                      </h2>
                      
                      {/* Magazine-style intro paragraph */}
                      <p className="text-xl font-serif leading-relaxed text-gray-800 mb-6 first-letter:text-5xl first-letter:font-bold first-letter:mr-1 first-letter:float-left first-letter:leading-tight">
                        {editorialExcerpt}
                      </p>
                      
                      {/* Three paragraphs of templated prose lived here, generated from the
                          place's own fields and rendered as editorial copy — including a pull quote
                          attributed to an "EasyTrip Editorial Team" that does not exist. Removed in
                          Sprint 3.1 (IMP-027): the admin-written description above is the real
                          content, and padding it with generated sentences made a short entry look
                          researched rather than short. */}
                      
                      {/* Quick Facts Box */}
                      <FactBox 
                        title={`Essential Facts: ${place.name}`}
                        facts={facts}
                      />
                      
                      {/* Tags displayed as magazine-style keywords */}
                      {place.tags && place.tags.length > 0 && (
                        <div className="mt-8 pt-6 border-t border-gray-100">
                          <h3 className="text-lg font-serif font-semibold text-gray-800 mb-3 flex items-center">
                            <FiTag className="mr-2 h-5 w-5 text-gray-500" />
                            Keywords
                          </h3>
                          <div className="flex flex-wrap gap-2">
                            {place.tags.map((tag, index) => (
                              <span
                                key={index}
                                className="bg-gray-100 text-gray-700 text-sm px-3 py-1 rounded-full hover:bg-gray-200 transition-colors cursor-default"
                              >
                                {tag.charAt(0).toUpperCase() + tag.slice(1)}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {/* Editorial Information */}
                      <div className="mt-8 pt-6 border-t border-gray-100 text-sm text-gray-500 flex flex-wrap justify-between">
                        {createdDate && (
                          <p className="flex items-center mr-4 mb-2">
                            <FiCalendar className="mr-2 h-4 w-4 text-gray-400" />
                            Published: {createdDate}
                          </p>
                        )}
                        {updatedDate && (
                          <p className="flex items-center mr-4 mb-2">
                            <FiEdit3 className="mr-2 h-4 w-4 text-gray-400" />
                            Updated: {updatedDate}
                          </p>
                        )}
                      </div>
                    </motion.div>
                  </section>

                  {/* Additional Details Section */}
                  <section id="details" className="scroll-mt-24">
                    <MagazineDetails 
                      customKeys={place.custom_keys} 
                      themes={place.themes} 
                    />
                  </section>

                  {/* Image Gallery */}
                  {images.length > 0 && (
                    <section id="gallery" className="scroll-mt-24">
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.1 }}
                        className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100"
                      >
                        <h2 className="text-4xl font-serif font-bold text-gray-900 mb-8 flex items-center">
                          <div className="p-3 bg-primary-100 rounded-lg mr-4">
                            <FiCamera className="text-primary-600 h-7 w-7" />
                          </div>
                          Photo Gallery
                        </h2>
                        <MagazineGallery images={images} placeName={place.name} />
                      </motion.div>
                    </section>
                  )}

                  {/* Reviews Section */}
                  <section id="reviews" className="scroll-mt-24">
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.6, delay: 0.2 }}
                      className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100"
                    >
                      <h2 className="text-4xl font-serif font-bold text-gray-900 mb-8 flex items-center">
                        <div className="p-3 bg-yellow-100 rounded-lg mr-4">
                          <FiMessageSquare className="text-yellow-600 h-7 w-7" />
                        </div>
                        Traveler Reviews
                      </h2>
                      
                      {/* Magazine-style review stats */}
                      {place.rating_count > 0 && (
                        <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between bg-gray-50 rounded-xl p-6 border border-gray-100">
                          <div className="flex items-center mb-4 md:mb-0">
                            <div className="flex items-center justify-center w-16 h-16 bg-yellow-100 rounded-full mr-4">
                              <span className="text-2xl font-bold text-yellow-700">{avgRating}</span>
                            </div>
                            <div>
                              <h4 className="font-medium text-gray-900">Overall Rating</h4>
                              <div className="flex mt-1">
                                {[...Array(5)].map((_, i) => (
                                  <FiStar 
                                    key={i} 
                                    className={`w-5 h-5 ${
                                      i < Math.round(avgRating)
                                        ? 'text-yellow-500 fill-current'
                                        : 'text-gray-300'
                                    }`}
                                  />
                                ))}
                              </div>
                              <p className="text-sm text-gray-500 mt-1">Based on {place.rating_count} reviews</p>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-3">
                            <button
                              onClick={() => document.getElementById('review-form')?.scrollIntoView({ behavior: 'smooth' })}
                              className="flex items-center justify-center bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors"
                            >
                              <FiEdit3 className="mr-2 h-4 w-4" />
                              Write a Review
                            </button>
                            <button
                              onClick={() => setActiveSection('reviews')}
                              className="flex items-center justify-center bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
                            >
                              <FiEye className="mr-2 h-4 w-4" />
                              View All
                            </button>
                          </div>
                        </div>
                      )}
                      
                      {/* Reviews display */}
                      <MagazineReviews
                        reviews={reviews}
                        onReportReview={handleReportReview}
                        onDeleteReview={handleDeleteReview}
                        isDeletingReview={isDeletingReview}
                        currentUserId={currentUser?.uid}
                        isLoading={contentLoading}
                      />
                      
                      {/* Review form */}
                      <div id="review-form" className="mt-12 pt-8 border-t border-gray-200">
                        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                          <h3 className="text-2xl font-serif font-bold text-gray-900">
                            {existingReview ? 'Edit Your Review' : 'Share Your Experience'}
                          </h3>
                          {/* Also offered here, not just on the review card: the list defaults to
                              the "curated" view, which only shows 4-star-and-up reviews, so an
                              owner who rated a place lower could not otherwise reach their own
                              delete control without switching views. */}
                          {existingReview && (
                            <button
                              type="button"
                              onClick={() => handleDeleteReview(existingReview.id)}
                              disabled={isDeletingReview}
                              className="text-sm text-red-600 hover:text-red-700 disabled:opacity-50 flex items-center gap-1.5"
                            >
                              <FiTrash2 className="w-4 h-4" />
                              {isDeletingReview ? 'Deleting…' : 'Delete my review'}
                            </button>
                          )}
                        </div>
                        {authLoading ? (
                          // Firebase resolves the session a beat after mount; without this
                          // a signed-in user sees the "Sign in to review" panel flash first.
                          <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 animate-pulse">
                            <div className="h-4 bg-gray-200 rounded w-40 mb-4"></div>
                            <div className="h-24 bg-gray-200 rounded w-full"></div>
                          </div>
                        ) : isAuthenticated ? (
                          <ReviewForm
                            rating={reviewRating}
                            comment={reviewComment}
                            onRatingChange={setReviewRating}
                            onCommentChange={setReviewComment}
                            onSubmit={handleReviewSubmit}
                            isSubmitting={isSubmittingReview}
                            userHasReviewed={Boolean(existingReview)}
                            error={reviewError}
                          />
                        ) : (
                          <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 text-center">
                            <p className="text-gray-700 mb-4">
                              Sign in to rate this place and share your experience with other travelers.
                            </p>
                            <Link
                              href="/login"
                              className="inline-flex items-center justify-center bg-primary-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-primary-700 transition-colors"
                            >
                              <FiUser className="mr-2 h-4 w-4" />
                              Sign in to review
                            </Link>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  </section>

                  {/* Related Places */}
                  <section id="related" className="scroll-mt-24">
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.6, delay: 0.3 }}
                    >
                      <div className="flex items-center mb-10">
                        <div className="p-3 bg-emerald-100 rounded-lg mr-4">
                          <FiCompass className="text-emerald-600 h-7 w-7" />
                        </div>
                        <h2 className="text-4xl font-serif font-bold text-gray-900">Similar Adventures</h2>
                      </div>
                      
                      <RelatedPlaces 
                        currentPlaceId={place.id} 
                        themes={place.themes} 
                        location={place.location}
                        isLoading={contentLoading}
                      />
                    </motion.div>
                  </section>
                </>
              )}
            </div>

            {/* Sidebar */}
            <div className="mt-12 lg:mt-0">
              <MagazineSidebar place={place} reviews={reviews} isLoading={contentLoading} />
            </div>
          </div>
        </main>
        
      </div>
    </>
  );
}
/**
 * Which detail pages exist at build time (IMP-040).
 *
 * Only the most recent 20 are pre-built. `fallback: 'blocking'` means everything else is
 * generated on its first request and then cached like any other static page, so the build stays
 * fast and bounded no matter how large the catalogue grows — pre-building all of them would make
 * deploy time a function of row count for pages nobody may visit.
 *
 * A failure here returns an empty path list rather than throwing. The API being unreachable
 * during a build is an infrastructure state, not a reason to ship nothing; every page is still
 * reachable through the fallback.
 */
export async function getStaticPaths() {
  try {
    const { data } = await fetchPlaces({ limit: 20, sort: 'newest' });
    return {
      paths: data.map((place) => ({ params: { id: String(place.id) } })),
      fallback: 'blocking'
    };
  } catch (error) {
    console.error('[getStaticPaths] places:', error.message);
    return { paths: [], fallback: 'blocking' };
  }
}

/**
 * Render the place, its gallery and its reviews into the HTML.
 *
 * Reviews are included even though `is_own` cannot be resolved without a caller — this request
 * has no user, so every review comes back marked as somebody else's. That is the correct answer
 * for the cached copy, which is shared by every visitor and by crawlers; the page re-reads
 * reviews with the user's token once Firebase restores the session, and that pass is what makes
 * the edit affordance appear. The alternative — leaving reviews out of the static payload — would
 * hide real review content from search engines to avoid a flag anonymous visitors never see.
 */
export async function getStaticProps({ params }) {
  try {
    const place = await fetchPlaceById(params.id);

    // Neither of these should sink the page: a place with an unreachable gallery or review list
    // is still worth rendering.
    const [imagesResult, reviewsResult] = await Promise.allSettled([
      fetchPlaceImages(params.id),
      fetchPlaceReviews(params.id)
    ]);

    return {
      props: {
        initialPlace: place,
        initialImages: composeGallery(
          place,
          imagesResult.status === 'fulfilled' ? imagesResult.value : []
        ),
        initialReviews: reviewsResult.status === 'fulfilled' ? reviewsResult.value : []
      },
      revalidate: 300
    };
  } catch (error) {
    // A real 404 is a real 404 — but recheck periodically, since `fallback: 'blocking'` means
    // this also covers a place created after the last build.
    if (error.status === 404) {
      return { notFound: true, revalidate: 300 };
    }

    // Anything else is an outage, not a missing page. Throwing keeps the last successfully
    // generated copy being served during ISR instead of replacing it with a 404 that would then
    // be cached and indexed.
    throw error;
  }
}
