import { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import { FiAlertCircle, FiArrowRight, FiStar, FiMap, FiCompass, FiChevronRight } from 'react-icons/fi';
import SearchBar from '../components/SearchBar';
import PlaceCard from '../components/PlaceCard';
import { getAllPlaces, getLocations } from '../services/placeService';

export default function Home() {
  // State variables
  const [topRatedPlaces, setTopRatedPlaces] = useState([]);
  const [recentlyAddedPlaces, setRecentlyAddedPlaces] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated] = useState('2025-08-24 12:41:10');
  const [currentUser] = useState('dharmendra23101');
  const [animationComplete, setAnimationComplete] = useState(false);

  // Fetch all places and organize them
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        console.log(`Fetching places at ${lastUpdated} by ${currentUser}`);
        
        // Fetch places and locations in parallel
        const [placesData, locationsData] = await Promise.all([
          getAllPlaces(),
          getLocations()
        ]);
        
        if (!Array.isArray(placesData)) {
          console.error('Invalid data format:', placesData);
          setError('Invalid data format received');
          setTopRatedPlaces([]);
          setRecentlyAddedPlaces([]);
          return;
        }
        
        console.log(`Fetched ${placesData.length} places`);
        
        // Sort places by rating (top-rated first)
        const sortedByRating = [...placesData].sort((a, b) => {
          const ratingA = a.rating_count > 0 ? a.rating_sum / a.rating_count : 0;
          const ratingB = b.rating_count > 0 ? b.rating_sum / b.rating_count : 0;
          return ratingB - ratingA;
        });
        
        // Sort places by creation date (newest first)
        const sortedByDate = [...placesData].sort((a, b) => 
          new Date(b.created_at) - new Date(a.created_at)
        );
        
        // Take top 4 from each category
        setTopRatedPlaces(sortedByRating.slice(0, 4));
        setRecentlyAddedPlaces(sortedByDate.slice(0, 4));
        setLocations(locationsData);
        
      } catch (err) {
        console.error('Error fetching places:', err);
        setError('Failed to load destinations. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [lastUpdated, currentUser]);

  // Handle search - redirect to browse page with search params
  const handleSearch = (searchCriteria) => {
    // Build query parameters
    const params = new URLSearchParams();
    if (searchCriteria.term) params.set('q', searchCriteria.term);
    if (searchCriteria.location) params.set('location', searchCriteria.location);
    
    // Redirect to browse page with search parameters
    window.location.href = `/browse?${params.toString()}`;
  };

  // Animation variants
  const heroVariants = {
    hidden: { opacity: 0, y: -50 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { 
        duration: 0.8, 
        ease: "easeOut" 
      }
    }
  };

  const sectionVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: { 
      opacity: 1,
      y: 0,
      transition: { 
        duration: 0.6,
        ease: "easeOut"
      }
    }
  };

  const cardContainerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { duration: 0.5 }
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
          
          <div className="absolute inset-0 flex flex-col justify-center items-center px-4 sm:px-6 lg:px-8">
            <motion.div
              variants={heroVariants}
              initial="hidden"
              animate="visible"
              className="max-w-4xl mx-auto text-center"
            >
              <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-white mb-6 leading-tight">
                Your Next <span className="text-yellow-300">Adventure</span> Awaits
              </h1>
              <p className="text-lg sm:text-xl md:text-2xl text-white mb-10 max-w-3xl mx-auto">
                Discover breathtaking destinations and create unforgettable memories with EasyTrip.
              </p>
              
              <div className="mt-8 sm:mt-12 relative z-20 max-w-2xl mx-auto">
                <SearchBar 
                  locations={locations} 
                  onSearch={handleSearch}
                />
              </div>
              
              <div className="mt-8 flex justify-center">
                <Link href="/browse" passHref>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="px-6 py-3 bg-primary-600 text-white font-medium rounded-full shadow-lg hover:bg-primary-700 transition-colors flex items-center"
                  >
                    <FiCompass className="mr-2" />
                    Explore All Destinations
                  </motion.button>
                </Link>
              </div>
            </motion.div>
          </div>
        </div>

        {/* Top Rated Places Section */}
        <motion.section
          variants={sectionVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="py-16 bg-white"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center mb-10">
              <div>
                <h2 className="text-3xl font-bold text-gray-900">Top-Rated Destinations</h2>
                <p className="mt-2 text-lg text-gray-600">The highest-rated places loved by our travelers</p>
              </div>
              <Link href="/browse" className="text-primary-600 hover:text-primary-800 flex items-center font-medium">
                View all
                <FiChevronRight className="ml-1" />
              </Link>
            </div>
            
            {loading ? (
              <div className="flex justify-center items-center py-20">
                <div className="relative w-20 h-20">
                  <div className="absolute top-0 left-0 w-full h-full border-4 border-t-primary-600 border-b-primary-300 border-l-primary-600 border-r-primary-300 rounded-full animate-spin"></div>
                </div>
              </div>
            ) : error ? (
              <div className="text-center py-12 bg-red-50 rounded-lg border border-red-100">
                <FiAlertCircle className="h-12 w-12 mx-auto text-red-500 mb-4" />
                <p className="text-red-600 text-lg font-medium">Error: {error}</p>
              </div>
            ) : topRatedPlaces.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 rounded-lg">
                <p className="text-gray-500">No top-rated destinations available yet.</p>
              </div>
            ) : (
              <motion.div 
                variants={cardContainerVariants}
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8"
              >
                {topRatedPlaces.map((place) => (
                  <motion.div
                    key={place.id}
                    variants={cardVariants}
                    onClick={() => window.location.href = `/places/${place.id}`}
                  >
                    <PlaceCard 
                      place={place} 
                      timestamp={lastUpdated}
                      username={currentUser}
                    />
                  </motion.div>
                ))}
              </motion.div>
            )}
          </div>
        </motion.section>

        {/* Recently Added Section */}
        <motion.section
          variants={sectionVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="py-16 bg-gray-50"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center mb-10">
              <div>
                <h2 className="text-3xl font-bold text-gray-900">Recently Added</h2>
                <p className="mt-2 text-lg text-gray-600">Discover our newest destinations</p>
              </div>
              <Link href="/browse" className="text-primary-600 hover:text-primary-800 flex items-center font-medium">
                View all
                <FiChevronRight className="ml-1" />
              </Link>
            </div>
            
            {loading ? (
              <div className="flex justify-center items-center py-20">
                <div className="relative w-20 h-20">
                  <div className="absolute top-0 left-0 w-full h-full border-4 border-t-primary-600 border-b-primary-300 border-l-primary-600 border-r-primary-300 rounded-full animate-spin"></div>
                </div>
              </div>
            ) : error ? (
              <div className="text-center py-12 bg-red-50 rounded-lg border border-red-100">
                <FiAlertCircle className="h-12 w-12 mx-auto text-red-500 mb-4" />
                <p className="text-red-600 text-lg font-medium">Error: {error}</p>
              </div>
            ) : recentlyAddedPlaces.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 rounded-lg">
                <p className="text-gray-500">No recent destinations available yet.</p>
              </div>
            ) : (
              <motion.div 
                variants={cardContainerVariants}
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8"
              >
                {recentlyAddedPlaces.map((place) => (
                  <motion.div
                    key={place.id}
                    variants={cardVariants}
                    onClick={() => window.location.href = `/places/${place.id}`}
                  >
                    <PlaceCard 
                      place={place} 
                      timestamp={lastUpdated}
                      username={currentUser}
                    />
                  </motion.div>
                ))}
              </motion.div>
            )}
          </div>
        </motion.section>

        {/* Browse by Category Section */}
        <motion.section
          variants={sectionVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="py-16 bg-white"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-gray-900 mb-4">Browse by Category</h2>
              <p className="text-lg text-gray-600 max-w-3xl mx-auto">
                Find the perfect destination based on your interests
              </p>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8">
              {['Adventure', 'Historical', 'Romantic', 'Nature', 'Religious', 'Beach', 'Mountain', 'City'].map((category) => (
                <Link key={category} href={`/browse?theme=${category.toLowerCase()}`} className="block">
                  <motion.div
                    whileHover={{ y: -5, boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1)" }}
                    className="bg-gray-100 rounded-xl overflow-hidden h-40 relative group cursor-pointer"
                  >
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent group-hover:from-primary-900/70 transition-all duration-300"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-white text-xl font-bold">{category}</span>
                    </div>
                  </motion.div>
                </Link>
              ))}
            </div>
            
            <div className="mt-12 text-center">
              <Link href="/browse" className="inline-block">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="px-6 py-3 bg-primary-600 text-white font-medium rounded-md shadow hover:bg-primary-700 transition-colors flex items-center mx-auto"
                >
                  Explore All Categories
                  <FiArrowRight className="ml-2" />
                </motion.button>
              </Link>
            </div>
          </div>
        </motion.section>

        {/* Features Section */}
        <motion.section
          variants={sectionVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="py-16 bg-gradient-to-b from-gray-50 to-gray-100"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-bold text-gray-900 mb-4">Why Choose EasyTrip</h2>
              <p className="text-lg text-gray-600 max-w-3xl mx-auto">
                We make travel planning easy and enjoyable with our curated destinations and personalized recommendations.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
              <motion.div 
                className="bg-white p-8 rounded-xl shadow-lg"
                whileHover={{ y: -10, boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)" }}
                transition={{ duration: 0.3 }}
              >
                <div className="w-16 h-16 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center mb-6 mx-auto">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2 text-center">Curated Destinations</h3>
                <p className="text-gray-600 text-center">
                  We handpick the most amazing places for you to visit, with detailed information and beautiful imagery.
                </p>
              </motion.div>
              
              <motion.div 
                className="bg-white p-8 rounded-xl shadow-lg"
                whileHover={{ y: -10, boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)" }}
                transition={{ duration: 0.3 }}
              >
                <div className="w-16 h-16 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center mb-6 mx-auto">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2 text-center">Personalized Experience</h3>
                <p className="text-gray-600 text-center">
                  Find destinations that match your interests with our smart filters and recommendation engine.
                </p>
              </motion.div>
              
              <motion.div 
                className="bg-white p-8 rounded-xl shadow-lg"
                whileHover={{ y: -10, boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)" }}
                transition={{ duration: 0.3 }}
              >
                <div className="w-16 h-16 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center mb-6 mx-auto">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2 text-center">Secure Booking</h3>
                <p className="text-gray-600 text-center">
                  Coming soon: Book your trips securely with our encrypted payment system and get instant confirmations.
                </p>
              </motion.div>
            </div>
          </div>
        </motion.section>
      </div>
    </>
  );
}
