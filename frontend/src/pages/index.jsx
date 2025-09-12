import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FiArrowRight, FiArrowLeft, FiMapPin, FiStar, FiCalendar, 
  FiCompass, FiChevronRight, FiClock, FiHeart, FiImage 
} from 'react-icons/fi';
import { getAllPlaces, getLocations } from '../services/placeService';

// CarouselImage component with better loading states
const CarouselImage = ({ place, isActive }) => {
  const [imageState, setImageState] = useState('loading');

  const getImageUrl = () => {
    if (place?.primary_image_url) return place.primary_image_url;
    if (place?.image_url) return place.image_url;
    return `/api/places/${place?.id}/image`;
  };

  return (
    <div className="relative h-full overflow-hidden bg-gradient-to-br from-blue-100 to-purple-100">
      {/* Loading skeleton */}
      {imageState === 'loading' && (
        <div className="absolute inset-0 bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 animate-pulse">
          <div className="absolute inset-0 bg-gradient-to-t from-gray-400/20 to-transparent"></div>
        </div>
      )}
      
      {/* Error state */}
      {imageState === 'error' && (
        <div className="absolute inset-0 bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center">
          <div className="text-center">
            <FiImage className="h-8 w-8 sm:h-12 sm:w-12 text-blue-400 mx-auto mb-2 sm:mb-3" />
            <p className="text-blue-600 text-xs sm:text-sm font-medium">{place?.name}</p>
            <p className="text-blue-500 text-xs">Explore this destination</p>
          </div>
        </div>
      )}
      
      {/* Main image */}
      <img
        src={getImageUrl()}
        alt={place?.name || 'Featured Destination'}
        className={`w-full h-full object-cover transition-all duration-700 ease-out ${
          imageState === 'loaded' ? 'opacity-100 scale-100' : 'opacity-0 scale-105'
        }`}
        loading="eager"
        onLoad={() => setImageState('loaded')}
        onError={() => setImageState('error')}
      />
      
      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent"></div>
    </div>
  );
};

// FeatureCard component
const FeatureCard = ({ icon, title, description }) => (
  <motion.div
    variants={{
      hidden: { opacity: 0, y: 20 },
      visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
    }}
    className="bg-white p-4 sm:p-6 rounded-xl shadow-lg backdrop-blur-sm border border-gray-100/50 hover:shadow-xl transition-shadow duration-300"
    whileHover={{ y: -5 }}
  >
    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-4 sm:mb-6 mx-auto">
      {icon}
    </div>
    <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2 text-center">{title}</h3>
    <p className="text-sm sm:text-base text-gray-600 text-center">{description}</p>
  </motion.div>
);

// CategoryCard component
const CategoryCard = ({ category, gradient }) => (
  <motion.div
    variants={{
      hidden: { opacity: 0, y: 20 },
      visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
    }}
  >
    <Link href={`/browse?theme=${category.toLowerCase()}`} passHref>
      <motion.div
        whileHover={{ y: -3, scale: 1.02 }}
        className={`relative h-24 sm:h-32 md:h-40 rounded-xl overflow-hidden group cursor-pointer ${gradient}`}
      >
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent group-hover:from-black/40 transition-all duration-300"></div>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-white font-bold text-sm sm:text-lg md:text-xl drop-shadow-lg">{category}</span>
        </div>
      </motion.div>
    </Link>
  </motion.div>
);

// Main Home component
const Home = () => {
  const [places, setPlaces] = useState([]);
  const [locations, setLocations] = useState([]);
  const [currentPlaceIndex, setCurrentPlaceIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [autoplay, setAutoplay] = useState(true);
  const [direction, setDirection] = useState(1);
  const [likedPlaces, setLikedPlaces] = useState([]);
  const [isMobile, setIsMobile] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const carouselRef = useRef(null);
  const autoplayRef = useRef(null);

  // Check screen size
  useEffect(() => {
    const checkScreenSize = () => setIsMobile(window.innerWidth < 768);
    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  // Load liked places from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('easytrip_liked_places');
    if (saved) {
      try {
        setLikedPlaces(JSON.parse(saved));
      } catch (e) {
        console.error('Error loading liked places:', e);
      }
    }
  }, []);

  // Save liked places to localStorage
  useEffect(() => {
    localStorage.setItem('easytrip_liked_places', JSON.stringify(likedPlaces));
  }, [likedPlaces]);

  // Fetch data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Check localStorage first
        const cachedPlaces = localStorage.getItem('easytrip_carousel_places');
        const cachedTime = localStorage.getItem('easytrip_carousel_cache_time');
        
        if (cachedPlaces && cachedTime) {
          const cacheAge = Date.now() - parseInt(cachedTime);
          if (cacheAge < 300000) { // 5 minutes cache
            const parsedPlaces = JSON.parse(cachedPlaces);
            if (parsedPlaces.length > 0) {
              setPlaces(parsedPlaces.slice(0, 4));
              setLoading(false);
              return;
            }
          }
        }

        const [placesData, locationsData] = await Promise.all([getAllPlaces(), getLocations()]);
        
        if (!Array.isArray(placesData)) {
          console.error('Invalid data format:', placesData);
          setError('Invalid data format received');
          setPlaces([]);
          return;
        }

        // Sort places by rating (real data only)
        const sortedByRating = [...placesData].sort((a, b) => {
          const ratingA = a.rating_count > 0 ? a.rating_sum / a.rating_count : 0;
          const ratingB = b.rating_count > 0 ? b.rating_sum / b.rating_count : 0;
          return ratingB - ratingA;
        });

        // Take only top 4 places and clean the data
        const limitedPlaces = sortedByRating.slice(0, 4).map(place => ({
          ...place,
          tags: place.tags || ['Destination'],
          best_time: place.best_time || 'Year round',
        }));

        // Cache the data
        localStorage.setItem('easytrip_carousel_places', JSON.stringify(limitedPlaces));
        localStorage.setItem('easytrip_carousel_cache_time', Date.now().toString());
        
        setPlaces(limitedPlaces);
        setLocations(locationsData);
        
      } catch (err) {
        console.error('Error fetching places:', err);
        setError('Failed to load destinations. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Autoplay carousel
  useEffect(() => {
    if (autoplay && places.length > 0 && !isTransitioning) {
      autoplayRef.current = setInterval(() => {
        setDirection(1);
        setIsTransitioning(true);
        setCurrentPlaceIndex(prev => (prev + 1) % places.length);
        setTimeout(() => setIsTransitioning(false), 500);
      }, 5000); // 5 seconds for both mobile and desktop
    }
    
    return () => {
      if (autoplayRef.current) clearInterval(autoplayRef.current);
    };
  }, [autoplay, places.length, isTransitioning]);

  // Navigation functions
  const goToNextPlace = () => {
    if (isTransitioning) return;
    setDirection(1);
    setIsTransitioning(true);
    setCurrentPlaceIndex(prev => (prev + 1) % places.length);
    setTimeout(() => setIsTransitioning(false), 500);
  };

  const goToPrevPlace = () => {
    if (isTransitioning) return;
    setDirection(-1);
    setIsTransitioning(true);
    setCurrentPlaceIndex(prev => (prev - 1 + places.length) % places.length);
    setTimeout(() => setIsTransitioning(false), 500);
  };

  const goToPlace = (index) => {
    if (index === currentPlaceIndex || isTransitioning) return;
    setDirection(index > currentPlaceIndex ? 1 : -1);
    setIsTransitioning(true);
    setCurrentPlaceIndex(index);
    setTimeout(() => setIsTransitioning(false), 500);
  };

  // Swipe handling for mobile
  const handleDragEnd = (event, info) => {
    if (Math.abs(info.offset.x) > 50 && Math.abs(info.velocity.x) > 300) {
      if (info.offset.x < 0) {
        goToNextPlace();
      } else {
        goToPrevPlace();
      }
    }
  };

  // Toggle like
  const toggleLike = (e, id) => {
    e.stopPropagation();
    setLikedPlaces(prev => 
      prev.includes(id) 
        ? prev.filter(placeId => placeId !== id) 
        : [...prev, id]
    );
  };

  // Calculate rating
  const calculateRating = (place) => {
    if (!place || !place.rating_count || place.rating_count === 0) return 'New';
    return (place.rating_sum / place.rating_count).toFixed(1);
  };

  // Animation variants
  const carouselVariants = {
    enter: (direction) => ({
      x: direction > 0 ? '100%' : '-100%',
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (direction) => ({
      x: direction < 0 ? '100%' : '-100%',
      opacity: 0,
    }),
  };

  // Category gradients
  const categoryGradients = [
    'bg-gradient-to-br from-orange-500 to-red-500',
    'bg-gradient-to-br from-purple-500 to-pink-500',
    'bg-gradient-to-br from-pink-500 to-rose-500',
    'bg-gradient-to-br from-green-500 to-emerald-500',
    'bg-gradient-to-br from-blue-500 to-indigo-500',
    'bg-gradient-to-br from-yellow-500 to-orange-500',
    'bg-gradient-to-br from-gray-600 to-gray-800',
    'bg-gradient-to-br from-cyan-500 to-blue-500',
  ];

  return (
    <>
      <Head>
        <title>EasyTrip - Discover Your Journey</title>
        <meta name="description" content="Explore curated destinations with EasyTrip, your premium travel companion." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap" rel="stylesheet" />
      </Head>

      <div className="min-h-screen bg-gray-900 font-inter">
        {/* Hero Section */}
        <div className="relative min-h-screen overflow-hidden">
          {/* Dynamic Background Image */}
          <AnimatePresence mode="wait">
            <motion.div
              key={currentPlaceIndex}
              className="absolute inset-0 bg-cover bg-center bg-no-repeat"
              style={{ 
                backgroundImage: `url(${places[currentPlaceIndex]?.primary_image_url || places[currentPlaceIndex]?.image_url || '/images/hero-bg.jpg'})` 
              }}
              initial={{ opacity: 0, scale: 1.1 }}
              animate={{ opacity: 0.3, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 1, ease: "easeInOut" }}
            />
          </AnimatePresence>
          
          {/* Overlay */}
          <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/60 to-black/80"></div>

          <div className="relative container mx-auto px-3 sm:px-4 lg:px-8 min-h-screen flex items-center">
            {/* Mobile Layout */}
            {isMobile ? (
              <div className="w-full space-y-6">
                {/* Hero Content - Mobile (Top) */}
                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8 }}
                  className="text-center text-white pt-4"
                >
                  <h1 className="text-2xl sm:text-3xl font-extrabold mb-3 leading-tight">
                    Discover Your Next
                    <span className="block text-blue-300">Adventure</span>
                  </h1>
                  
                  <p className="text-sm text-gray-200 mb-5 max-w-xs mx-auto leading-relaxed">
                    Explore breathtaking destinations with curated recommendations.
                  </p>
                  
                  <div className="flex flex-col gap-2 max-w-64 mx-auto">
                    <Link href="/browse" passHref>
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="w-full px-5 py-2.5 bg-blue-600 text-white font-medium rounded-lg shadow-lg hover:bg-blue-700 transition-colors flex items-center justify-center text-sm"
                      >
                        <FiCompass className="mr-2 h-4 w-4" />
                        Explore Now
                      </motion.button>
                    </Link>
                    <Link href="/about" passHref>
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="w-full px-5 py-2.5 bg-white/10 backdrop-blur-md border border-white/30 text-white font-medium rounded-lg hover:bg-white/20 transition-colors text-sm"
                      >
                        Learn More
                      </motion.button>
                    </Link>
                  </div>
                </motion.div>

                {/* Carousel - Mobile (Bottom) */}
                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, delay: 0.2 }}
                  className="relative pb-12"
                >
                  <div 
                    className="relative h-80 mx-2"
                    ref={carouselRef}
                    onTouchStart={() => setAutoplay(false)}
                    onTouchEnd={() => setTimeout(() => setAutoplay(true), 3000)}
                  >
                    {loading ? (
                      <div className="flex h-full items-center justify-center bg-white/10 backdrop-blur-md rounded-xl border border-white/20">
                        <div className="text-center">
                          <div className="w-10 h-10 border-4 border-white/20 border-t-white rounded-full animate-spin mb-3"></div>
                          <p className="text-white/80 text-sm">Loading...</p>
                        </div>
                      </div>
                    ) : error ? (
                      <div className="flex h-full items-center justify-center bg-white/10 backdrop-blur-md rounded-xl border border-white/20">
                        <div className="text-center text-white p-4">
                          <p className="mb-3 text-sm">{error}</p>
                          <button 
                            onClick={() => window.location.reload()}
                            className="px-3 py-2 bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors text-sm"
                          >
                            Try Again
                          </button>
                        </div>
                      </div>
                    ) : places.length > 0 ? (
                      <>
                        {/* Progress Bar */}
                        <div className="absolute top-0 left-0 right-0 z-20 h-1 bg-white/20 rounded-t-xl overflow-hidden">
                          <motion.div 
                            className="h-full bg-gradient-to-r from-blue-500 to-purple-500"
                            initial={{ width: "0%" }}
                            animate={{ width: autoplay && !isTransitioning ? "100%" : "0%" }}
                            transition={{ 
                              duration: 5, 
                              ease: "linear",
                              repeat: 0
                            }}
                            key={`progress-${currentPlaceIndex}`}
                          />
                        </div>

                        {/* Carousel Container */}
                        <div className="relative w-full h-full overflow-hidden rounded-xl">
                          <AnimatePresence mode="wait" custom={direction}>
                            <motion.div
                              key={currentPlaceIndex}
                              custom={direction}
                              variants={carouselVariants}
                              initial="enter"
                              animate="center"
                              exit="exit"
                              transition={{
                                x: { type: 'spring', stiffness: 300, damping: 30 },
                                opacity: { duration: 0.3 }
                              }}
                              drag="x"
                              dragConstraints={{ left: 0, right: 0 }}
                              dragElastic={0.2}
                              onDragEnd={handleDragEnd}
                              className="absolute w-full h-full"
                            >
                              <div className="bg-white/95 backdrop-blur-md border border-white/30 shadow-2xl h-full rounded-xl overflow-hidden">
                                {/* Image Section - 65% height */}
                                <div className="h-3/5 relative">
                                  <CarouselImage place={places[currentPlaceIndex]} isActive={true} />
                                  
                                  {/* Rating Badge */}
                                  <div className="absolute top-2 right-2 bg-white/95 backdrop-blur-sm rounded-full px-2 py-1 flex items-center shadow-lg">
                                    <FiStar className="text-yellow-500 mr-1 h-3 w-3" />
                                    <span className="text-xs font-medium text-gray-800">
                                      {calculateRating(places[currentPlaceIndex])}
                                    </span>
                                  </div>
                                  
                                  {/* Like Button */}
                                  <motion.button
                                    whileHover={{ scale: 1.1 }}
                                    whileTap={{ scale: 0.9 }}
                                    onClick={(e) => toggleLike(e, places[currentPlaceIndex]?.id)}
                                    className={`absolute top-2 left-2 rounded-full backdrop-blur-sm w-7 h-7 flex items-center justify-center shadow-lg transition-colors ${
                                      likedPlaces.includes(places[currentPlaceIndex]?.id) 
                                        ? 'bg-red-500 text-white' 
                                        : 'bg-white/95 text-gray-700'
                                    }`}
                                  >
                                    <FiHeart className={`h-3 w-3 ${
                                      likedPlaces.includes(places[currentPlaceIndex]?.id) ? 'fill-current' : ''
                                    }`} />
                                  </motion.button>
                                  
                                  {/* Location Tag */}
                                  <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-sm rounded-md text-white flex items-center px-2 py-1">
                                    <FiMapPin className="mr-1 h-3 w-3" />
                                    <span className="text-xs">{places[currentPlaceIndex]?.location || 'Worldwide'}</span>
                                  </div>
                                </div>
                                
                                {/* Content Section - 35% height */}
                                <div className="h-2/5 p-3 flex flex-col justify-between bg-white">
                                  <div>
                                    <h2 className="text-base font-bold text-gray-900 mb-1 line-clamp-1">
                                      {places[currentPlaceIndex]?.name}
                                    </h2>
                                    
                                    <p className="text-xs text-gray-600 mb-2 line-clamp-2 leading-relaxed">
                                      {places[currentPlaceIndex]?.description || 'Discover this amazing destination.'}
                                    </p>
                                    
                                    {/* Tags */}
                                    <div className="flex flex-wrap gap-1 mb-2">
                                      {places[currentPlaceIndex]?.tags?.slice(0, 2).map((tag, idx) => (
                                        <span 
                                          key={idx} 
                                          className="bg-blue-100 text-blue-700 rounded-full px-2 py-0.5 text-xs font-medium"
                                        >
                                          {tag}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                  
                                  {/* Action Buttons */}
                                  <div className="flex justify-between items-center pt-2 border-t border-gray-100">
                                    <Link href={`/places/${places[currentPlaceIndex]?.id}`} passHref>
                                      <motion.button
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                        className="bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 px-3 py-1.5 text-xs flex items-center"
                                      >
                                        View Details
                                        <FiChevronRight className="ml-1 h-3 w-3" />
                                      </motion.button>
                                    </Link>
                                    
                                    <Link href={`/browse?location=${places[currentPlaceIndex]?.location}`} passHref>
                                      <button className="text-blue-600 hover:text-blue-800 text-xs underline underline-offset-2">
                                        More places
                                      </button>
                                    </Link>
                                  </div>
                                </div>
                              </div>
                            </motion.div>
                          </AnimatePresence>
                        </div>
                        
                        {/* Indicator Dots */}
                        <div className="absolute -bottom-6 left-0 right-0 flex justify-center space-x-2">
                          {places.map((_, index) => (
                            <motion.button
                              key={index}
                              onClick={() => goToPlace(index)}
                              whileHover={{ scale: 1.2 }}
                              whileTap={{ scale: 0.9 }}
                              className={`rounded-full w-2 h-2 transition-all duration-300 ${
                                index === currentPlaceIndex 
                                  ? 'bg-white scale-125 shadow-lg' 
                                  : 'bg-white/50'
                              }`}
                              disabled={isTransitioning}
                              aria-label={`View destination ${index + 1}`}
                            />
                          ))}
                        </div>
                      </>
                    ) : (
                      <div className="flex h-full items-center justify-center bg-white/10 backdrop-blur-md rounded-xl border border-white/20">
                        <p className="text-white/80 text-sm">No destinations available</p>
                      </div>
                    )}
                  </div>
                </motion.div>
              </div>
            ) : (
              /* Desktop Layout */
              <div className="flex items-center justify-between w-full gap-12">
                {/* Left Column - Hero Content */}
                <div className="w-1/2">
                  <motion.div
                    initial={{ opacity: 0, x: -30 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.8 }}
                    className="text-white max-w-2xl"
                  >
                    <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold mb-6 leading-tight">
                      Discover Your Next <span className="text-blue-300">Adventure</span>
                    </h1>
                    
                    <p className="text-lg lg:text-xl text-gray-200 mb-8 max-w-lg leading-relaxed">
                      Explore breathtaking destinations with curated recommendations and seamless planning.
                    </p>
                    
                    <div className="flex gap-4">
                      <Link href="/browse" passHref>
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg shadow-lg hover:bg-blue-700 transition-colors flex items-center"
                        >
                          <FiCompass className="mr-2" />
                          Explore Now
                        </motion.button>
                      </Link>
                      
                      <Link href="/about" passHref>
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          className="px-6 py-3 bg-white/10 backdrop-blur-md border border-white/30 text-white font-medium rounded-lg hover:bg-white/20 transition-colors"
                        >
                          Learn More
                        </motion.button>
                      </Link>
                    </div>
                  </motion.div>
                </div>

                {/* Right Column - Carousel */}
                <div className="w-1/2">
                  <motion.div
                    initial={{ opacity: 0, x: 30 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.8, delay: 0.2 }}
                    className="relative h-[500px]"
                    ref={carouselRef}
                    onMouseEnter={() => setAutoplay(false)}
                    onMouseLeave={() => setAutoplay(true)}
                  >
                    {loading ? (
                      <div className="flex h-full items-center justify-center bg-white/10 backdrop-blur-md rounded-xl border border-white/20">
                        <div className="text-center">
                          <div className="w-16 h-16 border-4 border-white/20 border-t-white rounded-full animate-spin mb-4"></div>
                          <p className="text-white/80 text-sm">Loading destinations...</p>
                        </div>
                      </div>
                    ) : error ? (
                      <div className="flex h-full items-center justify-center bg-white/10 backdrop-blur-md rounded-xl border border-white/20">
                        <div className="text-center text-white p-4">
                          <p className="mb-4 text-sm">{error}</p>
                          <button 
                            onClick={() => window.location.reload()}
                            className="px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors text-sm"
                          >
                            Try Again
                          </button>
                        </div>
                      </div>
                    ) : places.length > 0 ? (
                      <>
                        {/* Progress Bar */}
                        <div className="absolute top-0 left-0 right-0 z-20 h-1 bg-white/20 rounded-t-xl overflow-hidden">
                          <motion.div 
                            className="h-full bg-gradient-to-r from-blue-500 to-purple-500"
                            initial={{ width: "0%" }}
                            animate={{ width: autoplay && !isTransitioning ? "100%" : "0%" }}
                            transition={{ 
                              duration: 5, 
                              ease: "linear",
                              repeat: 0
                            }}
                            key={`progress-${currentPlaceIndex}`}
                          />
                        </div>

                        {/* Carousel Container */}
                        <div className="relative w-full h-full overflow-hidden rounded-xl">
                          <AnimatePresence mode="wait" custom={direction}>
                            <motion.div
                              key={currentPlaceIndex}
                              custom={direction}
                              variants={carouselVariants}
                              initial="enter"
                              animate="center"
                              exit="exit"
                              transition={{
                                x: { type: 'spring', stiffness: 300, damping: 30 },
                                opacity: { duration: 0.3 }
                              }}
                              className="absolute w-full h-full"
                            >
                              <div className="bg-white/95 backdrop-blur-md border border-white/30 shadow-2xl h-full rounded-xl overflow-hidden">
                                {/* Image Section */}
                                <div className="h-3/5 relative">
                                  <CarouselImage place={places[currentPlaceIndex]} isActive={true} />
                                  
                                  {/* Rating Badge */}
                                  <div className="absolute top-4 right-4 bg-white/95 backdrop-blur-sm rounded-full px-3 py-1 flex items-center shadow-lg">
                                    <FiStar className="text-yellow-500 mr-1 h-4 w-4" />
                                    <span className="text-sm font-medium text-gray-800">
                                      {calculateRating(places[currentPlaceIndex])}
                                    </span>
                                  </div>
                                  
                                  {/* Like Button */}
                                  <motion.button
                                    whileHover={{ scale: 1.1 }}
                                    whileTap={{ scale: 0.9 }}
                                    onClick={(e) => toggleLike(e, places[currentPlaceIndex]?.id)}
                                    className={`absolute top-4 left-4 rounded-full backdrop-blur-sm w-10 h-10 flex items-center justify-center shadow-lg transition-colors ${
                                      likedPlaces.includes(places[currentPlaceIndex]?.id) 
                                        ? 'bg-red-500 text-white' 
                                        : 'bg-white/95 text-gray-700'
                                    }`}
                                  >
                                    <FiHeart className={`h-4 w-4 ${
                                      likedPlaces.includes(places[currentPlaceIndex]?.id) ? 'fill-current' : ''
                                    }`} />
                                  </motion.button>
                                  
                                  {/* Location Tag */}
                                  <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-sm rounded-lg text-white flex items-center px-3 py-1.5">
                                    <FiMapPin className="mr-1.5 h-4 w-4" />
                                    <span className="text-sm">{places[currentPlaceIndex]?.location || 'Worldwide'}</span>
                                  </div>
                                </div>
                                
                                {/* Content Section */}
                                <div className="h-2/5 p-6 flex flex-col justify-between bg-white">
                                  <div>
                                    <h2 className="text-2xl font-bold text-gray-900 mb-2 line-clamp-1">
                                      {places[currentPlaceIndex]?.name}
                                    </h2>
                                    
                                    <p className="text-gray-600 mb-4 line-clamp-2 leading-relaxed">
                                      {places[currentPlaceIndex]?.description || 'Discover this amazing destination with EasyTrip.'}
                                    </p>
                                    
                                    {/* Tags */}
                                    <div className="flex flex-wrap gap-2 mb-4">
                                      {places[currentPlaceIndex]?.tags?.slice(0, 3).map((tag, idx) => (
                                        <span 
                                          key={idx} 
                                          className="bg-blue-100 text-blue-700 rounded-full px-3 py-1 text-sm font-medium"
                                        >
                                          {tag}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                  
                                  {/* Action Buttons */}
                                  <div className="flex justify-between items-center pt-4 border-t border-gray-100">
                                    <Link href={`/places/${places[currentPlaceIndex]?.id}`} passHref>
                                      <motion.button
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                        className="bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 px-5 py-2 text-sm flex items-center"
                                      >
                                        View Details
                                        <FiChevronRight className="ml-1 h-4 w-4" />
                                      </motion.button>
                                    </Link>
                                    
                                    <Link href={`/browse?location=${places[currentPlaceIndex]?.location}`} passHref>
                                      <button className="text-blue-600 hover:text-blue-800 text-sm underline underline-offset-2">
                                        More destinations
                                      </button>
                                    </Link>
                                  </div>
                                </div>
                              </div>
                            </motion.div>
                          </AnimatePresence>
                        </div>

                        {/* Navigation Controls */}
                        <div className="absolute top-1/2 -translate-y-1/2 w-full flex justify-between px-4 z-10">
                          <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white border border-white/30 shadow-lg transition-all disabled:opacity-50"
                            onClick={goToPrevPlace}
                            disabled={isTransitioning}
                          >
                            <FiArrowLeft className="h-5 w-5" />
                          </motion.button>
                          <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white border border-white/30 shadow-lg transition-all disabled:opacity-50"
                            onClick={goToNextPlace}
                            disabled={isTransitioning}
                          >
                            <FiArrowRight className="h-5 w-5" />
                          </motion.button>
                        </div>
                        
                        {/* Indicator Dots */}
                        <div className="absolute -bottom-10 left-0 right-0 flex justify-center space-x-3">
                          {places.map((_, index) => (
                            <motion.button
                              key={index}
                              onClick={() => goToPlace(index)}
                              whileHover={{ scale: 1.2 }}
                              whileTap={{ scale: 0.9 }}
                              className={`rounded-full w-3 h-3 transition-all duration-300 ${
                                index === currentPlaceIndex 
                                  ? 'bg-white scale-125 shadow-lg' 
                                  : 'bg-white/50 hover:bg-white/70'
                              }`}
                              disabled={isTransitioning}
                              aria-label={`View destination ${index + 1}`}
                            />
                          ))}
                        </div>
                      </>
                    ) : (
                      <div className="flex h-full items-center justify-center bg-white/10 backdrop-blur-md rounded-xl border border-white/20">
                        <p className="text-white/80 text-sm">No destinations available</p>
                      </div>
                    )}
                  </motion.div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Features Section */}
        <motion.section
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={{ 
            hidden: { opacity: 0 }, 
            visible: { opacity: 1, transition: { staggerChildren: 0.2 } } 
          }}
          className="py-12 sm:py-16 lg:py-20 bg-white"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div 
              variants={{ 
                hidden: { opacity: 0, y: 20 }, 
                visible: { opacity: 1, y: 0, transition: { duration: 0.5 } } 
              }} 
              className="text-center mb-8 sm:mb-12"
            >
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4">Why Choose EasyTrip</h2>
              <p className="text-sm sm:text-base lg:text-lg text-gray-600 max-w-3xl mx-auto">
                Curated destinations and personalized recommendations for seamless travel planning.
              </p>
            </motion.div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
              {[
                {
                  icon: <FiCompass className="h-5 w-5 sm:h-6 sm:w-6" />,
                  title: 'Curated Destinations',
                  description: 'Handpicked places with detailed information and authentic reviews.',
                },
                {
                  icon: <FiStar className="h-5 w-5 sm:h-6 sm:w-6" />,
                  title: 'Real Reviews',
                  description: 'Genuine feedback from travelers to help you make informed decisions.',
                },
                {
                  icon: <FiHeart className="h-5 w-5 sm:h-6 sm:w-6" />,
                  title: 'Personalized Experience',
                  description: 'Smart recommendations based on your preferences and interests.',
                },
              ].map((feature, index) => (
                <FeatureCard key={index} {...feature} />
              ))}
            </div>
            
            <motion.div 
              variants={{ 
                hidden: { opacity: 0, y: 20 }, 
                visible: { opacity: 1, y: 0, transition: { duration: 0.5 } } 
              }} 
              className="mt-8 sm:mt-12 text-center"
            >
              <Link href="/browse" passHref>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="px-6 sm:px-8 py-3 bg-blue-600 text-white font-medium rounded-lg flex items-center mx-auto text-sm sm:text-base shadow-lg hover:bg-blue-700 transition-colors"
                >
                  Start Exploring
                  <FiArrowRight className="ml-2 h-4 w-4" />
                </motion.button>
              </Link>
            </motion.div>
          </div>
        </motion.section>

        {/* Categories Section */}
        <motion.section
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={{ 
            hidden: { opacity: 0 }, 
            visible: { opacity: 1, transition: { staggerChildren: 0.1 } } 
          }}
          className="py-12 sm:py-16 lg:py-20 bg-gray-50"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div 
              variants={{ 
                hidden: { opacity: 0, y: 20 }, 
                visible: { opacity: 1, y: 0, transition: { duration: 0.5 } } 
              }} 
              className="text-center mb-8 sm:mb-12"
            >
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4">Explore by Category</h2>
              <p className="text-sm sm:text-base lg:text-lg text-gray-600 max-w-3xl mx-auto">
                Find destinations that match your travel style and interests.
              </p>
            </motion.div>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 sm:gap-3 md:gap-4">
              {[
                'Adventure', 'Historical', 'Romantic', 'Nature', 
                'Religious', 'Beach', 'Mountain', 'City'
              ].map((category, index) => (
                <CategoryCard 
                  key={category} 
                  category={category} 
                  gradient={categoryGradients[index]} 
                />
              ))}
            </div>
          </div>
        </motion.section>
      </div>
    </>
  );
};

export default Home;
