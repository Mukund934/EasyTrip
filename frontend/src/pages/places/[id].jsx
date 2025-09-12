import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import NextImage from 'next/image'; 
import {
  FiArrowLeft, FiMapPin, FiStar, FiTag, FiMap, FiShare2, FiHeart,
  FiMessageSquare, FiInfo, FiCalendar, FiChevronDown, FiGlobe, FiCloud,
  FiThermometer, FiDroplet, FiWind, FiSun, FiCamera, FiNavigation,
  FiExternalLink, FiClock, FiUser, FiEdit3, FiEye, FiX, FiLoader,
  FiAlertCircle, FiRefreshCw, FiCheckCircle, FiBookmark, FiLink,
  FiChevronRight, FiChevronUp, FiList, FiMenu, FiArrowDown, FiArrowUp,
  FiFeather, FiAward, FiCoffee, FiShield, FiThumbsUp, FiGrid, FiCompass,
  FiChevronLeft
} from 'react-icons/fi';
import { toast } from 'react-toastify';
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion';
import { getPlaceById, getPlaceImages, getPlaceReviews, createPlaceReview } from '../../services/placeService';
import ImageGallery from '../../components/ImageGallery';
import MagazineGallery from '../../components/MagazineGallery';
import ReviewForm from '../../components/ReviewForm';
import ReviewList from '../../components/ReviewList';
import RelatedPlaces from '../../components/RelatedPlaces';
import { useAuth } from '../../context/AuthContext';
import LoadingSpinner from '../../components/LoadingSpinner';

const FALLBACK_IMAGE = '/images/placeholder.jpg';
const CURRENT_DATE = '2025-09-05 23:25:51';
const CURRENT_USER = 'dharmendra23101';

// Hero section with cinematic magazine styling
const PlaceMagazineHero = ({ place, onBack, onShare, onToggleFavorite, isFavorite, avgRating, onShareSocial }) => {
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
    const imageUrl = place.primary_image_url || place.image_url || FALLBACK_IMAGE;
    
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
      
      {/* Decorative patterns */}
      <div className="absolute inset-0 z-5 opacity-10 mix-blend-overlay" style={{ 
        backgroundImage: "url('/images/pattern-dots.svg')",
        backgroundSize: "30px 30px"
      }}></div>
      
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
            className="relative group"
          >
            <button
              onClick={onShare}
              className="bg-white/90 backdrop-blur-md text-gray-900 p-3 rounded-full hover:bg-white shadow-2xl transition-all duration-300 hover:scale-110 border border-white/20 group-hover:bg-blue-50"
              aria-label="Share"
            >
              <FiShare2 className="h-6 w-6 group-hover:text-blue-600 transition-colors" />
            </button>
            
            {/* Share dropdown */}
            <div className="absolute right-0 mt-2 w-56 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-40 transform origin-top-right">
              <div className="bg-white rounded-xl shadow-2xl border border-gray-100 overflow-hidden">
                <div className="p-4 border-b border-gray-100">
                  <h3 className="font-serif font-semibold text-gray-900">Share this place</h3>
                </div>
                <div className="p-2">
                  {[
                    { platform: 'copy', label: 'Copy Link', icon: FiLink, color: 'gray' },
                    { platform: 'twitter', label: 'Twitter', icon: FiExternalLink, color: 'blue' },
                    { platform: 'facebook', label: 'Facebook', icon: FiExternalLink, color: 'indigo' },
                    { platform: 'whatsapp', label: 'WhatsApp', icon: FiExternalLink, color: 'green' }
                  ].map(({ platform, label, icon: Icon, color }) => (
                    <button
                      key={platform}
                      onClick={() => platform === 'copy' ? onShare() : onShareSocial(platform)}
                      className={`flex items-center w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-${color}-50 hover:text-${color}-600 rounded-lg transition-all duration-200`}
                    >
                      <Icon className="mr-3 h-4 w-4" />
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
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
        <div className="flex items-center">
          <FiUser className="mr-1 h-3 w-3" />
          <span>EasyTrip Editorial</span>
        </div>
        <div className="hidden md:flex items-center">
          <FiClock className="mr-1 h-3 w-3" />
          <span>{CURRENT_DATE}</span>
        </div>
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
          <div className="p-2 bg-indigo-100 rounded-lg mr-3">
            <FiList className="text-indigo-600 h-5 w-5" />
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
            <ul className="mt-4 space-y-2 border-l-2 border-indigo-100 pl-4">
              {sections.map((section, index) => (
                <li key={index} className="py-1">
                  <a 
                    href={`#${section.id}`}
                    className="flex items-center text-gray-700 hover:text-indigo-600 transition-colors"
                  >
                    <span className="text-indigo-600 font-serif font-bold mr-2">{index + 1}</span>
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

// Pull Quote component
const PullQuote = ({ quote, author, color = "indigo" }) => {
  const colorClasses = {
    indigo: "border-indigo-500 text-indigo-800 bg-indigo-50",
    amber: "border-amber-500 text-amber-800 bg-amber-50",
    emerald: "border-emerald-500 text-emerald-800 bg-emerald-50",
    rose: "border-rose-500 text-rose-800 bg-rose-50",
    violet: "border-violet-500 text-violet-800 bg-violet-50"
  };
  
  return (
    <blockquote className={`my-8 mx-auto max-w-2xl p-6 border-l-4 ${colorClasses[color]} rounded-r-xl font-serif italic relative`}>
      <div className="absolute top-0 left-0 transform -translate-x-4 -translate-y-1/2 text-6xl opacity-20 font-serif">
        "
      </div>
      <p className="text-xl md:text-2xl leading-relaxed relative z-10">
        {quote}
      </p>
      {author && (
        <footer className="mt-2 font-sans text-sm not-italic font-medium">
          — {author}
        </footer>
      )}
    </blockquote>
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
              <span className="font-serif font-bold text-2xl text-indigo-500 mr-3">•</span>
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
            <LoadingSpinner color="indigo" />
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
const MagazineSidebar = ({ place, isLoading = false }) => (
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
        <div className="p-2 bg-blue-100 rounded-lg mr-3">
          <FiMapPin className="text-blue-600 h-5 w-5" />
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
      {place.rating_count > 0 && (
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
          
          <div className="space-y-2">
            {/* This is a mockup - would need actual breakdown data */}
            {[
              { label: 'Overall Experience', value: 4.7 },
              { label: 'Value for Money', value: 4.2 },
              { label: 'Accessibility', value: 3.9 },
              { label: 'Facilities', value: 4.5 }
            ].map((item, index) => (
              <div key={index} className="flex items-center justify-between">
                <span className="text-sm text-gray-600">{item.label}</span>
                <div className="flex items-center">
                  <div className="w-24 h-2 bg-gray-200 rounded-full mr-2 overflow-hidden">
                    <div 
                      className="h-full bg-yellow-500 rounded-full" 
                      style={{ width: `${(item.value / 5) * 100}%` }}
                    ></div>
                  </div>
                  <span className="text-sm font-medium">{item.value}</span>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}
      
      {/* Weather Widget */}
      {place.latitude && place.longitude && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mt-6 pt-6 border-t border-gray-100"
        >
          <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
            <FiSun className="mr-2 h-4 w-4" />
            Current Weather
          </h4>
          <WeatherWidget lat={place.latitude} lon={place.longitude} />
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
                <FiNavigation className="h-5 w-5 text-indigo-600" />
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
            className="flex items-center justify-center bg-indigo-600 text-white px-4 py-3 rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors"
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
    
    {/* Travel Tips Card */}
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.3 }}
      className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl shadow-xl p-6 border border-amber-100"
    >
      <h3 className="text-xl font-serif font-bold text-amber-900 mb-4 flex items-center">
        <div className="p-2 bg-amber-200 rounded-lg mr-3">
          <FiAward className="text-amber-700 h-5 w-5" />
        </div>
        Travel Tips
      </h3>
      
      <ul className="space-y-3">
        {/* These tips would ideally come from the place data */}
        {[
          "Best time to visit is during early morning to avoid crowds",
          "Don't forget to carry water and comfortable walking shoes",
          "Photography is allowed, but tripods may require special permission",
          "Local guides can enhance your experience with historical insights"
        ].map((tip, index) => (
          <li key={index} className="flex">
            <span className="text-amber-500 mr-2">•</span>
            <span className="text-amber-900">{tip}</span>
          </li>
        ))}
      </ul>
      
      <div className="mt-4 pt-4 border-t border-amber-200">
        <p className="text-amber-800 text-sm font-medium italic">
          Tips updated on {formatDate(place.updated_at) || 'September 2025'}
        </p>
      </div>
    </motion.div>
    
    {/* Magazine Issue Card */}
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.4 }}
      className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100"
    >
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-4 text-white">
        <h3 className="font-serif font-bold text-lg">In This Issue</h3>
        <p className="text-white/80 text-sm">September 2025 • Vol. 12 Issue 9</p>
      </div>
      
      <div className="p-4">
        <ul className="space-y-3">
          {[
            "Top 10 Hidden Beaches in South Asia",
            "The Ultimate Foodie's Guide to Street Cuisine",
            "Sustainable Travel: Eco-friendly Destinations",
            "Photography Special: Capturing Culture"
          ].map((article, index) => (
            <li key={index} className="border-b border-gray-100 pb-2 last:border-0 last:pb-0">
              <a href="#" className="text-gray-700 hover:text-indigo-600 transition-colors flex items-center">
                <span className="font-serif text-indigo-500 mr-2">{index + 1}</span>
                <span>{article}</span>
              </a>
            </li>
          ))}
        </ul>
        
        <a 
          href="#"
          className="mt-4 inline-flex items-center text-sm font-medium text-indigo-600 hover:text-indigo-800"
        >
          Browse all articles
          <FiChevronRight className="ml-1 h-4 w-4" />
        </a>
      </div>
    </motion.div>
  </aside>
);

// Magazine-style Review Section
const MagazineReviews = ({ reviews, onReportReview, currentUserId, isLoading = false }) => {
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
                ? 'bg-white shadow text-indigo-600' 
                : 'text-gray-700 hover:text-gray-900'
            }`}
          >
            Editor's Picks
          </button>
          <button
            onClick={() => setViewMode('all')}
            className={`px-4 py-2 rounded-full text-sm font-medium ${
              viewMode === 'all' 
                ? 'bg-white shadow text-indigo-600' 
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
                  ? <img src={review.user_avatar} alt={review.user_name} className="w-full h-full rounded-full object-cover" />
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
              
              <button
                onClick={() => onReportReview(review.id)}
                className="text-gray-400 hover:text-gray-600"
              >
                <span className="sr-only">Report</span>
                <FiFlag className="w-4 h-4" />
              </button>
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
                  "bg-blue-50 border-blue-200",
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

// Enhanced Weather Widget Component with better loading
const WeatherWidget = ({ lat, lon }) => {
  const [weather, setWeather] = useState({
    temp_c: 24,
    condition: "Partly cloudy",
    icon: "/images/weather/partly-cloudy.svg",
    humidity: 65,
    wind_kph: 12,
    feels_like: 25,
    uv: 5
  });
  const [loadingWeather, setLoadingWeather] = useState(false);
  
  // Note: We're using mock data to keep it simple in this example
  
  if (loadingWeather) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-blue-50 rounded-xl p-4 flex items-center justify-center min-h-[120px]"
      >
        <div className="text-center">
          <FiLoader className="h-6 w-6 text-blue-600 animate-spin mx-auto mb-2" />
          <span className="text-blue-700 text-sm">Loading weather...</span>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-100"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="relative w-12 h-12">
            <img
              src={weather.icon}
              alt={weather.condition}
              className="rounded-lg"
            />
          </div>
          <div>
            <div className="text-2xl font-bold text-blue-900">{weather.temp_c}°C</div>
            <div className="text-blue-700 text-sm font-medium truncate max-w-[120px]">
              {weather.condition}
            </div>
          </div>
        </div>
        <div className="text-right text-xs text-blue-600 space-y-1">
          <div className="flex items-center justify-end">
            <FiDroplet className="mr-1 h-3 w-3" />
            {weather.humidity}%
          </div>
          <div className="flex items-center justify-end">
            <FiWind className="mr-1 h-3 w-3" />
            {weather.wind_kph} kph
          </div>
        </div>
      </div>
      
      <div className="mt-3 pt-3 border-t border-blue-100 grid grid-cols-2 gap-2 text-xs">
        <div className="text-blue-800">
          <span className="text-blue-500">Feels like:</span> {weather.feels_like}°C
        </div>
        <div className="text-blue-800">
          <span className="text-blue-500">UV Index:</span> {weather.uv}
        </div>
      </div>
    </motion.div>
  );
};

// Main Component with enhanced magazine-style layout
export default function PlaceDetails() {
  const router = useRouter();
  const { id } = router.query;
  const { currentUser, isAuthenticated } = useAuth();
  const { scrollY } = useScroll();

  // State management
  const [place, setPlace] = useState(null);
  const [images, setImages] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [contentLoading, setContentLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [activeSection, setActiveSection] = useState('about');
  const [showTableOfContents, setShowTableOfContents] = useState(false);

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

  // Enhanced data fetching with retry logic
  const fetchAllData = useCallback(async () => {
    if (!id) return;

    setLoading(true);
    setContentLoading(true);
    setError(null);
    
    try {
      console.log(`[${new Date().toISOString()}] Fetching data for place ID: ${id} by user: ${CURRENT_USER}`);
      
      // Fetch place data first (critical)
      const placeData = await getPlaceById(id);
      
      // Update place data with current context
      const updatedPlaceData = {
        ...placeData,
        updated_by: placeData.updated_by || CURRENT_USER,
        previous_update: placeData.previous_update || '2025-08-29T20:46:09.863Z',
        updated_by_name: currentUser?.displayName || currentUser?.email || placeData.updated_by_name || CURRENT_USER,
      };

      setPlace(updatedPlaceData);
      setLoading(false); // Allow UI to render with basic data

      // Fetch additional data (non-critical)
      const [imagesData, reviewsData] = await Promise.allSettled([
        getPlaceImages(id),
        getPlaceReviews(id),
      ]);

      // Handle images
      const imageResults = imagesData.status === 'fulfilled' ? imagesData.value : [];
      const allImages = [
        { id: 'primary', image_url: placeData.primary_image_url || placeData.image_url || FALLBACK_IMAGE },
        ...(imageResults || []),
      ].filter(img => img.image_url);

      // Remove duplicates and set images
      const uniqueImages = Array.from(new Set(allImages.map(img => img.image_url)))
        .map(url => allImages.find(img => img.image_url === url));
      setImages(uniqueImages);

      // Handle reviews
            // Handle reviews
      const reviewResults = reviewsData.status === 'fulfilled' ? reviewsData.value : [];
      setReviews(reviewResults || []);

      console.log(`[${new Date().toISOString()}] Successfully loaded data for place: ${placeData.name}`);
      
    } catch (err) {
      console.error('Error loading page data:', { 
        message: err.message, 
        placeId: id, 
        user: 'dharmendra23101',
      });
      setError(err.message || 'Failed to load place details. Please try again.');
    } finally {
      setContentLoading(false);
    }
  }, [id, currentUser]);

  // Effect for initial data loading
  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

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

  // Handler for submitting a new review
  const handleReviewSubmit = async ({ rating, comment }) => {
    if (!isAuthenticated) {
      toast.error('You must be logged in to submit a review.');
      return;
    }
    
    try {
      const token = await currentUser.getIdToken();
      const newReview = await createPlaceReview(id, {
        rating,
        comment,
        user_id: currentUser.uid,
        user_name: currentUser.displayName || currentUser.email || 'dharmendra23101',
      }, token);

      // Optimistic UI Update
      setReviews(prevReviews => [newReview, ...prevReviews]);
      setPlace(prevPlace => ({
        ...prevPlace,
        rating_count: (prevPlace.rating_count || 0) + 1,
        rating_sum: (prevPlace.rating_sum || 0) + rating,
      }));

      toast.success('Thank you! Your review has been submitted.');
    } catch (err) {
      toast.error(err.message || 'Failed to submit review. Please try again.');
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

  // Handler for reporting reviews
  const handleReportReview = async (reviewId) => {
    if (!isAuthenticated) {
      toast.error('You must be logged in to report a review.');
      return;
    }
    try {
      // Mock implementation - replace with actual API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      toast.success('Review reported successfully.');
    } catch (err) {
      toast.error('Failed to report review.');
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
              className="flex-1 bg-indigo-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-indigo-700 transition-colors flex items-center justify-center"
            >
              <FiRefreshCw className="mr-2 h-4 w-4" />
              Try Again
            </motion.button>
            <Link 
              href="/explore" 
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
  const updatedDate = formatDate(place.updated_at) || formatDate('2025-09-05 23:34:11');
  const showUpdatedBy = true;
  
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
        <meta property="og:image" content={place.primary_image_url || place.image_url || FALLBACK_IMAGE} />
        <meta property="og:url" content={typeof window !== 'undefined' ? window.location.href : ''} />
        <meta name="twitter:card" content="summary_large_image" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;0,900;1,400;1,700&family=Source+Sans+Pro:wght@300;400;600;700&display=swap" rel="stylesheet" />
      </Head>

      {/* Reading progress bar */}
      <motion.div 
        className="fixed top-0 left-0 right-0 h-1 bg-indigo-600 z-50" 
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
            className="bg-indigo-600 text-white p-4 rounded-full shadow-lg flex items-center justify-center"
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
                          ? 'bg-indigo-50 text-indigo-700 font-medium'
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
            <div className="flex items-center space-x-4">
              <span>{CURRENT_DATE}</span>
              <span className="hidden md:inline-block">•</span>
              <span className="hidden md:inline-block">By {CURRENT_USER}</span>
            </div>
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
                      
                      {/* Additional descriptive content */}
                      <div className="prose prose-lg max-w-none text-gray-700 leading-relaxed">
                        {/* Add more detailed description - this would normally come from the backend */}
                        <p>
                          Nestled in the heart of {place.district || place.location}, this {place.themes?.[0] || 'amazing'} destination attracts visitors from all around the world. The perfect balance of natural beauty and cultural heritage makes it a must-visit for travelers seeking authentic experiences.
                        </p>
                        
                        <PullQuote 
                          quote={`${place.name} represents the perfect blend of tradition and natural beauty that defines the essence of ${place.state || 'this region'}.`} 
                          author="EasyTrip Editorial Team"
                        />
                        
                        <p>
                          Whether you're an adventure enthusiast, a cultural explorer, or simply looking for a peaceful retreat, {place.name} offers something special for every type of traveler. The local hospitality adds to the charm, ensuring visitors leave with unforgettable memories.
                        </p>
                      </div>
                      
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
                            {showUpdatedBy && ` by ${CURRENT_USER}`}
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
                          <div className="p-3 bg-indigo-100 rounded-lg mr-4">
                            <FiCamera className="text-indigo-600 h-7 w-7" />
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
                              className="flex items-center justify-center bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
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
                        currentUserId={currentUser?.uid}
                        isLoading={contentLoading}
                      />
                      
                      {/* Review form */}
                      <div id="review-form" className="mt-12 pt-8 border-t border-gray-200">
                        <h3 className="text-2xl font-serif font-bold text-gray-900 mb-6">Share Your Experience</h3>
                        <ReviewForm
                          rating={0}
                          review=""
                          onRatingChange={() => {}}
                          onReviewChange={() => {}}
                          onSubmit={handleReviewSubmit}
                          isSubmitting={false}
                          userHasReviewed={reviews.some(r => r.user_id === currentUser?.uid)}
                        />
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
              <MagazineSidebar place={place} isLoading={contentLoading} />
            </div>
          </div>
        </main>
        
        {/* Magazine-style Footer */}
        <footer className="bg-gray-900 text-white py-16 mt-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
              <div>
                <h3 className="text-2xl font-serif font-bold mb-6">EasyTrip Magazine</h3>
                <p className="text-gray-300 mb-6 leading-relaxed">
                  Inspiring travelers with expertly curated destinations, insider tips, and immersive cultural experiences since 2022.
                </p>
                <div className="flex space-x-4">
                  <a href="#" className="text-gray-300 hover:text-white transition-colors">
                    <span className="sr-only">Twitter</span>
                    <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M8.29 20.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0022 5.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.072 4.072 0 012.8 9.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 012 18.407a11.616 11.616 0 006.29 1.84" />
                    </svg>
                  </a>
                  <a href="#" className="text-gray-300 hover:text-white transition-colors">
                    <span className="sr-only">Instagram</span>
                    <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path fillRule="evenodd" d="M12.315 2c2.43 0 2.784.013 3.808.06 1.064.049 1.791.218 2.427.465a4.902 4.902 0 011.772 1.153 4.902 4.902 0 011.153 1.772c.247.636.416 1.363.465 2.427.048 1.067.06 1.407.06 4.123v.08c0 2.643-.012 2.987-.06 4.043-.049 1.064-.218 1.791-.465 2.427a4.902 4.902 0 01-1.153 1.772 4.902 4.902 0 01-1.772 1.153c-.636.247-1.363.416-2.427.465-1.067.048-1.407.06-4.123.06h-.08c-2.643 0-2.987-.012-4.043-.06-1.064-.049-1.791-.218-2.427-.465a4.902 4.902 0 01-1.772-1.153 4.902 4.902 0 01-1.153-1.772c-.247-.636-.416-1.363-.465-2.427-.047-1.024-.06-1.379-.06-3.808v-.63c0-2.43.013-2.784.06-3.808.049-1.064.218-1.791.465-2.427a4.902 4.902 0 011.153-1.772A4.902 4.902 0 015.45 2.525c.636-.247 1.363-.416 2.427-.465C8.901 2.013 9.256 2 11.685 2h.63zm-.081 1.802h-.468c-2.456 0-2.784.011-3.807.058-.975.045-1.504.207-1.857.344-.467.182-.8.398-1.15.748-.35.35-.566.683-.748 1.15-.137.353-.3.882-.344 1.857-.047 1.023-.058 1.351-.058 3.807v.468c0 2.456.011 2.784.058 3.807.045.975.207 1.504.344 1.857.182.466.399.8.748 1.15.35.35.683.566 1.15.748.353.137.882.3 1.857.344 1.054.048 1.37.058 4.041.058h.08c2.597 0 2.917-.01 3.96-.058.976-.045 1.505-.207 1.858-.344.466-.182.8-.398 1.15-.748.35-.35.566-.683.748-1.15.137-.353.3-.882.344-1.857.048-1.055.058-1.37.058-4.041v-.08c0-2.597-.01-2.917-.058-3.96-.045-.976-.207-1.505-.344-1.858a3.097 3.097 0 00-.748-1.15 3.098 3.098 0 00-1.15-.748c-.353-.137-.882-.3-1.857-.344-1.023-.047-1.351-.058-3.807-.058zM12 6.865a5.135 5.135 0 110 10.27 5.135 5.135 0 010-10.27zm0 1.802a3.333 3.333 0 100 6.666 3.333 3.333 0 000-6.666zm5.338-3.205a1.2 1.2 0 110 2.4 1.2 1.2 0 010-2.4z" clipRule="evenodd" />
                    </svg>
                  </a>
                </div>
              </div>
              
              <div>
                <h4 className="font-medium text-lg font-serif mb-6">Popular Categories</h4>
                <ul className="space-y-3">
                  <li><a href="#" className="text-gray-300 hover:text-white transition-colors">Adventure Travel</a></li>
                  <li><a href="#" className="text-gray-300 hover:text-white transition-colors">Cultural Experiences</a></li>
                  <li><a href="#" className="text-gray-300 hover:text-white transition-colors">Food & Cuisine</a></li>
                  <li><a href="#" className="text-gray-300 hover:text-white transition-colors">Eco Tourism</a></li>
                  <li><a href="#" className="text-gray-300 hover:text-white transition-colors">Luxury Getaways</a></li>
                </ul>
              </div>
              
              <div>
                <h4 className="font-medium text-lg font-serif mb-6">Stay Connected</h4>
                <p className="text-gray-300 mb-4">Subscribe to our newsletter for travel inspiration, tips and exclusive offers.</p>
                <form className="flex">
                  <input
                    type="email"
                    placeholder="Your email address"
                    className="px-4 py-2 w-full bg-gray-800 border border-gray-700 rounded-l-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    type="submit"
                    className="bg-indigo-600 text-white px-4 py-2 rounded-r-lg hover:bg-indigo-700 transition-colors"
                  >
                    Subscribe
                  </button>
                </form>
              </div>
            </div>
            
            <div className="mt-12 pt-8 border-t border-gray-800 flex flex-col md:flex-row justify-between">
              <p className="text-gray-400 text-sm mb-4 md:mb-0">
                © 2025 EasyTrip Magazine. All rights reserved.
              </p>
              <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm text-gray-400">
                <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
                <a href="#" className="hover:text-white transition-colors">Terms of Service</a>
                <a href="#" className="hover:text-white transition-colors">Cookie Policy</a>
                <span>{CURRENT_DATE}</span>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}