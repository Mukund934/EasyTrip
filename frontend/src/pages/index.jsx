import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FiArrowRight, FiArrowLeft, FiMapPin, FiStar, FiCalendar, 
  FiCompass, FiChevronRight, FiClock, FiUsers, FiHeart, FiCamera 
} from 'react-icons/fi';
import { getAllPlaces, getLocations } from '../services/placeService';

export default function Home() {
  // State variables
  const [places, setPlaces] = useState([]);
  const [currentPlaceIndex, setCurrentPlaceIndex] = useState(0);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [autoplay, setAutoplay] = useState(true);
  const [direction, setDirection] = useState(1);
  const [likedPlaces, setLikedPlaces] = useState([]);
  
  // Refs
  const carouselRef = useRef(null);
  const autoplayRef = useRef(null);

  // Auto rotate carousel
  useEffect(() => {
    if (autoplay && places.length > 0) {
      autoplayRef.current = setInterval(() => {
        setDirection(1);
        setCurrentPlaceIndex(prev => (prev + 1) % places.length);
      }, 5000);
    }
    
    return () => {
      if (autoplayRef.current) {
        clearInterval(autoplayRef.current);
      }
    };
  }, [autoplay, places.length]);

  // Fetch places data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Fetch places and locations in parallel
        const [placesData, locationsData] = await Promise.all([
          getAllPlaces(),
          getLocations()
        ]);
        
        if (!Array.isArray(placesData)) {
          console.error('Invalid data format:', placesData);
          setError('Invalid data format received');
          setPlaces([]);
          return;
        }
        
        // Sort places by rating
        const sortedByRating = [...placesData].sort((a, b) => {
          const ratingA = a.rating_count > 0 ? a.rating_sum / a.rating_count : 0;
          const ratingB = b.rating_count > 0 ? b.rating_sum / b.rating_count : 0;
          return ratingB - ratingA;
        });
        
        // Add some metadata for display
        const enhancedPlaces = sortedByRating.slice(0, 8).map(place => ({
          ...place,
          visitors: Math.floor(Math.random() * 5000) + 1000,
          tags: place.tags || ["Nature", "Adventure", "Scenic"],
          best_time: place.best_time || "Year round"
        }));
        
        // Take top rated places
        setPlaces(enhancedPlaces);
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

  // Navigation functions
  const goToNextPlace = () => {
    setDirection(1);
    setCurrentPlaceIndex((prev) => (prev + 1) % places.length);
  };

  const goToPrevPlace = () => {
    setDirection(-1);
    setCurrentPlaceIndex((prev) => (prev - 1 + places.length) % places.length);
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

  // Calculate rating for display
  const calculateRating = (place) => {
    if (!place || !place.rating_count || place.rating_count === 0) return 'New';
    return (place.rating_sum / place.rating_count).toFixed(1);
  };

  // Animation variants
  const fadeInUp = {
    hidden: { opacity: 0, y: 20 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { duration: 0.5 }
    }
  };

  const carouselVariants = {
    enter: (direction) => {
      return {
        x: direction > 0 ? 1000 : -1000,
        opacity: 0,
        scale: 0.95
      };
    },
    center: {
      zIndex: 1,
      x: 0,
      opacity: 1,
      scale: 1
    },
    exit: (direction) => {
      return {
        zIndex: 0,
        x: direction < 0 ? 1000 : -1000,
        opacity: 0,
        scale: 0.95
      };
    }
  };

  return (
    <>
      <Head>
        <title>EasyTrip - Discover Amazing Places</title>
        <meta name="description" content="Discover amazing destinations around the world with EasyTrip." />
      </Head>

      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
        {/* Hero Section */}
        <div className="relative h-screen bg-cover bg-center" style={{ backgroundImage: 'url("/images/hero-bg.jpg")' }}>
          <div className="absolute inset-0 bg-black opacity-50"></div>
          
          <div className="absolute inset-0 flex flex-col justify-center px-4 sm:px-6 lg:px-8">
            <div className="container mx-auto">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                {/* Left Column - Text Content */}
                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8 }}
                  className="text-white max-w-xl"
                >
                  <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold mb-6 leading-tight">
                    Your Next <span className="text-yellow-300">Adventure</span> Awaits
                  </h1>
                  
                  <p className="text-lg sm:text-xl text-white/90 mb-8 max-w-lg">
                    EasyTrip is your smart travel companion. Explore destinations effortlessly, discover real-time places and routes, and get personalized recommendations tailored just for you.
                  </p>
                  
                  <div className="flex flex-wrap gap-4">
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => window.location.href = '/browse'}
                      className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg shadow-lg hover:bg-blue-700 transition-colors flex items-center"
                    >
                      <FiCompass className="mr-2" />
                      Explore Destinations
                    </motion.button>
                    
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className="px-6 py-3 bg-white/10 backdrop-blur-sm border border-white/20 text-white font-medium rounded-lg hover:bg-white/20 transition-colors"
                    >
                      Learn More
                    </motion.button>
                  </div>
                </motion.div>

                {/* Right Column - Featured Place Carousel */}
                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, delay: 0.2 }}
                  className="relative h-[550px]"
                  ref={carouselRef}
                  onMouseEnter={() => setAutoplay(false)}
                  onMouseLeave={() => setAutoplay(true)}
                >
                  {loading ? (
                    <div className="flex h-full items-center justify-center">
                      <div className="w-16 h-16 border-4 border-white/20 border-t-white rounded-full animate-spin"></div>
                    </div>
                  ) : (
                    <>
                      {/* Progress Bar */}
                      <div className="absolute top-0 left-0 right-0 z-20">
                        <motion.div 
                          className="h-1 bg-blue-500"
                          initial={{ width: "0%" }}
                          animate={{ width: "100%" }}
                          transition={{ duration: 5, ease: "linear", repeat: autoplay ? Infinity : 0 }}
                          key={currentPlaceIndex}
                        />
                      </div>
                    
                      <AnimatePresence initial={false} custom={direction}>
                        <motion.div
                          key={currentPlaceIndex}
                          custom={direction}
                          variants={carouselVariants}
                          initial="enter"
                          animate="center"
                          exit="exit"
                          transition={{
                            x: { type: "spring", stiffness: 300, damping: 30 },
                            opacity: { duration: 0.3 },
                            scale: { duration: 0.4 }
                          }}
                          className="absolute w-full h-full"
                        >
                          <div className="bg-white/10 backdrop-blur-md rounded-xl overflow-hidden border border-white/20 shadow-2xl shadow-black/30 h-full">
                            <div className="relative h-3/5 overflow-hidden">
                              <motion.img 
                                src={places[currentPlaceIndex]?.image_url || "/images/placeholder.jpg"} 
                                alt={places[currentPlaceIndex]?.name || "Featured Destination"}
                                className="w-full h-full object-cover"
                                initial={{ scale: 1 }}
                                animate={{ scale: 1.05 }}
                                transition={{ duration: 8 }}
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent"></div>
                              
                              {/* Rating Badge */}
                              <div className="absolute top-4 right-4 bg-white/80 backdrop-blur-sm rounded-full px-3 py-1 flex items-center">
                                <FiStar className="text-yellow-500 mr-1" />
                                <span className="font-medium text-gray-800">
                                  {calculateRating(places[currentPlaceIndex])}
                                </span>
                              </div>
                              
                              {/* Like Button */}
                              <motion.button
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                                onClick={(e) => toggleLike(e, places[currentPlaceIndex]?.id)}
                                className={`absolute top-4 left-4 w-10 h-10 rounded-full ${
                                  likedPlaces.includes(places[currentPlaceIndex]?.id) 
                                    ? 'bg-red-500 text-white' 
                                    : 'bg-white/80 text-gray-700'
                                } backdrop-blur-sm flex items-center justify-center shadow-lg`}
                              >
                                <FiHeart className={likedPlaces.includes(places[currentPlaceIndex]?.id) ? 'fill-current' : ''} />
                              </motion.button>
                              
                              {/* Location Tag */}
                              <div className="absolute bottom-4 left-4 bg-white/10 backdrop-blur-sm border border-white/30 rounded-lg px-3 py-1.5 text-white flex items-center">
                                <FiMapPin className="mr-1.5" />
                                <span>{places[currentPlaceIndex]?.location || "Worldwide"}</span>
                              </div>
                            </div>
                            
                            <div className="p-6 h-2/5 flex flex-col justify-between">
                              <div>
                                <div className="flex justify-between items-start mb-3">
                                  <h2 className="text-2xl font-bold text-white">
                                    {places[currentPlaceIndex]?.name || "Loading..."}
                                  </h2>
                                  
                                  <div className="text-sm flex items-center text-white/80">
                                    <FiUsers className="mr-1" />
                                    <span>{places[currentPlaceIndex]?.visitors?.toLocaleString() || '10,000+'}+ visitors</span>
                                  </div>
                                </div>
                                
                                <p className="text-white/90 line-clamp-2 mb-3">
                                  {places[currentPlaceIndex]?.description || "Discover this amazing destination with EasyTrip."}
                                </p>
                                
                                {/* Info Grid */}
                                <div className="grid grid-cols-2 gap-3 mb-4">
                                  <div className="bg-white/10 backdrop-blur-sm rounded-md p-2 flex items-center">
                                    <FiCalendar className="text-blue-300 mr-2" />
                                    <div className="text-xs">
                                      <span className="block text-white/70">Best Time to Visit</span>
                                      <span className="text-white font-medium">{places[currentPlaceIndex]?.best_time || "Year round"}</span>
                                    </div>
                                  </div>
                                  
                                  <div className="bg-white/10 backdrop-blur-sm rounded-md p-2 flex items-center">
                                    <FiClock className="text-green-300 mr-2" />
                                    <div className="text-xs">
                                      <span className="block text-white/70">Added</span>
                                      <span className="text-white font-medium">
                                        {places[currentPlaceIndex]?.created_at 
                                          ? new Date(places[currentPlaceIndex].created_at).toLocaleDateString()
                                          : "Recently"}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                                
                                {/* Tags */}
                                <div className="flex flex-wrap gap-2 mb-4">
                                  {places[currentPlaceIndex]?.tags?.map((tag, idx) => (
                                    <span 
                                      key={idx}
                                      className="text-xs px-2 py-1 bg-white/10 text-white/90 rounded-full backdrop-blur-sm"
                                    >
                                      {tag}
                                    </span>
                                  ))}
                                </div>
                              </div>
                              
                              <div className="flex justify-between items-center">
                                <motion.button
                                  whileHover={{ scale: 1.05 }}
                                  whileTap={{ scale: 0.95 }}
                                  onClick={() => window.location.href = `/places/${places[currentPlaceIndex]?.id}`}
                                  className="px-5 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 inline-flex items-center"
                                >
                                  Explore Now
                                  <FiChevronRight className="ml-1" />
                                </motion.button>
                                
                                <button
                                  onClick={() => window.location.href = `/browse?location=${places[currentPlaceIndex]?.location}`}
                                  className="text-white/80 hover:text-white text-sm underline underline-offset-2"
                                >
                                  More like this
                                </button>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      </AnimatePresence>

                      {/* Navigation Controls */}
                      <div className="absolute top-1/2 -translate-y-1/2 w-full flex justify-between px-4 z-10">
                        <motion.button
                          whileHover={{ scale: 1.1, backgroundColor: "rgba(255, 255, 255, 0.3)" }}
                          whileTap={{ scale: 0.9 }}
                          className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white border border-white/30 shadow-lg transition-colors"
                          onClick={goToPrevPlace}
                        >
                          <FiArrowLeft />
                        </motion.button>
                        <motion.button
                          whileHover={{ scale: 1.1, backgroundColor: "rgba(255, 255, 255, 0.3)" }}
                          whileTap={{ scale: 0.9 }}
                          className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white border border-white/30 shadow-lg transition-colors"
                          onClick={goToNextPlace}
                        >
                          <FiArrowRight />
                        </motion.button>
                      </div>
                      
                      {/* Indicator Dots */}
                      <div className="absolute -bottom-10 left-0 right-0 flex justify-center space-x-3">
                        {places.map((_, index) => (
                          <button
                            key={index}
                            onClick={() => {
                              setDirection(index > currentPlaceIndex ? 1 : -1);
                              setCurrentPlaceIndex(index);
                            }}
                            className={`w-3 h-3 rounded-full transition-all duration-300 ${
                              index === currentPlaceIndex 
                                ? 'bg-white scale-110' 
                                : 'bg-white/30 hover:bg-white/50'
                            }`}
                            aria-label={`View destination ${index + 1}`}
                          />
                        ))}
                      </div>
                      
                      {/* Quick Preview */}
                      <div className="absolute -bottom-24 left-0 right-0 flex justify-center overflow-hidden h-10 gap-2">
                        {places.map((place, index) => (
                          <motion.div 
                            key={index}
                            whileHover={{ y: -5 }}
                            onClick={() => {
                              setDirection(index > currentPlaceIndex ? 1 : -1);
                              setCurrentPlaceIndex(index);
                            }}
                            className={`w-12 h-12 rounded-md overflow-hidden cursor-pointer transition-all ${
                              index === currentPlaceIndex 
                                ? 'ring-2 ring-white scale-110 z-10' 
                                : 'opacity-70 hover:opacity-100'
                            }`}
                          >
                            <img 
                              src={place.image_url || "/images/placeholder.jpg"} 
                              alt={place.name}
                              className="w-full h-full object-cover" 
                            />
                          </motion.div>
                        ))}
                      </div>
                    </>
                  )}
                </motion.div>
              </div>
            </div>
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
          className="py-24 bg-white"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div 
              variants={fadeInUp}
              className="text-center mb-16"
            >
              <h2 className="text-3xl font-bold text-gray-900 mb-4">Why Choose EasyTrip</h2>
              <p className="text-lg text-gray-600 max-w-3xl mx-auto">
                We make travel planning easy and enjoyable with our curated destinations and personalized recommendations.
              </p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
              {[
                {
                  icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                  </svg>,
                  title: "Curated Destinations",
                  description: "We handpick the most amazing places for you to visit, with detailed information and beautiful imagery."
                },
                {
                  icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>,
                  title: "Personalized Experience",
                  description: "Find destinations that match your interests with our smart filters and recommendation engine."
                },
                {
                  icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>,
                  title: "Secure Booking",
                  description: "Coming soon: Book your trips securely with our encrypted payment system and get instant confirmations."
                }
              ].map((feature, index) => (
                <motion.div 
                  key={index}
                  variants={fadeInUp}
                  className="bg-white p-8 rounded-xl shadow-lg"
                  whileHover={{ y: -10, boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)" }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-6 mx-auto">
                    {feature.icon}
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2 text-center">{feature.title}</h3>
                  <p className="text-gray-600 text-center">
                    {feature.description}
                  </p>
                </motion.div>
              ))}
            </div>
            
            <motion.div 
              variants={fadeInUp}
              className="mt-16 text-center"
            >
              <Link href="/browse" passHref>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="px-8 py-3 bg-blue-600 text-white font-medium rounded-lg shadow-md hover:bg-blue-700 transition-colors inline-flex items-center"
                >
                  Start Exploring
                  <FiArrowRight className="ml-2" />
                </motion.button>
              </Link>
            </motion.div>
          </div>
        </motion.section>

        {/* Browse by Category Section */}
        <motion.section
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={{ 
            hidden: { opacity: 0 },
            visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
          }}
          className="py-20 bg-gray-50"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div 
              variants={fadeInUp} 
              className="text-center mb-12"
            >
              <h2 className="text-3xl font-bold text-gray-900 mb-4">Browse by Category</h2>
              <p className="text-lg text-gray-600 max-w-3xl mx-auto">
                Find the perfect destination based on your interests
              </p>
            </motion.div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8">
              {['Adventure', 'Historical', 'Romantic', 'Nature', 'Religious', 'Beach', 'Mountain', 'City'].map((category) => (
                <motion.div
                  key={category}
                  variants={fadeInUp}
                >
                  <Link href={`/browse?theme=${category.toLowerCase()}`}>
                    <motion.div
                      whileHover={{ y: -5, boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1)" }}
                      className="bg-gray-100 rounded-xl overflow-hidden h-40 relative group cursor-pointer"
                    >
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent group-hover:from-blue-900/70 transition-all duration-300"></div>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-white text-xl font-bold">{category}</span>
                      </div>
                    </motion.div>
                  </Link>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.section>
      </div>
    </>
  );
}
