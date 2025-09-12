import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/router';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { 
  FiMapPin, FiStar, FiHeart, FiMap, FiCalendar, FiFilter, FiX, 
  FiSearch, FiSliders, FiCheckSquare, FiClock, FiCompass, 
  FiActivity, FiSun, FiCloud, FiCloudRain, FiThermometer, FiFeather, 
  FiDroplet, FiZap, FiWind, FiMenu, FiUser, FiSettings, FiLayers,
  FiFlag, FiCamera, FiShare2, FiEye, FiInfo, FiBookmark, FiPlusCircle,
  FiGrid, FiLayout, FiColumns, FiBookOpen, FiGlobe, FiNavigation,
  FiChevronRight, FiChevronDown, FiChevronUp, FiRefreshCw, FiAward,
  FiTriangle, FiCoffee, FiWatch, FiMaximize2, FiMinimize2, FiVoicemail,
  FiMic, FiUsers, FiSmile, FiSunrise, FiSunset, FiMessageSquare,
  FiAlertCircle, FiCheck, FiPlus, FiMinus
} from 'react-icons/fi';
import { debounce } from 'lodash';
import { getAllPlaces, searchPlaces, getLocations, getDistricts, getStates, getTags } from '../services/placeService';
import { useAuth } from '../context/AuthContext';

// Dynamically import heavy components
const Map = dynamic(() => import('../components/ExploreMap'), { 
  ssr: false,
  loading: () => <div className="h-full w-full bg-gray-100 animate-pulse flex items-center justify-center text-gray-400">Loading Map...</div>
});

// Categories with beautiful gradients
const CATEGORIES = [
  { 
    id: 'featured', 
    label: 'Featured Destinations',
    gradient: 'from-amber-500 to-orange-600',
    icon: <FiAward className="text-amber-200" />
  },
  { 
    id: 'trending', 
    label: 'Trending Now', 
    gradient: 'from-pink-500 to-rose-600',
    icon: <FiActivity className="text-pink-200" />
  },
  { 
    id: 'mountains', 
    label: 'Mountain Escapes', 
    gradient: 'from-emerald-500 to-teal-600',
    icon: <FiTriangle className="text-emerald-200" />
  },
  { 
    id: 'beaches', 
    label: 'Beach Getaways', 
    gradient: 'from-sky-500 to-blue-600',
    icon: <FiFeather className="text-sky-200" />
  },
  { 
    id: 'cultural', 
    label: 'Cultural Experiences', 
    gradient: 'from-purple-500 to-indigo-600',
    icon: <FiGlobe className="text-purple-200" />
  },
  { 
    id: 'adventure', 
    label: 'Adventure Travel', 
    gradient: 'from-lime-500 to-green-600',
    icon: <FiCompass className="text-lime-200" />
  },
  { 
    id: 'relaxation', 
    label: 'Relaxation Retreats', 
    gradient: 'from-cyan-500 to-blue-600',
    icon: <FiCoffee className="text-cyan-200" />
  },
  { 
    id: 'spiritual', 
    label: 'Spiritual Journeys', 
    gradient: 'from-violet-500 to-purple-600',
    icon: <FiFeather className="text-violet-200" /> 
  }
];

// Seasonal filters with icons
const SEASONS = [
  { id: 'all', label: 'All Seasons', icon: <FiCalendar /> },
  { id: 'spring', label: 'Spring', icon: <FiSunrise className="text-green-500" /> },
  { id: 'summer', label: 'Summer', icon: <FiSun className="text-yellow-500" /> },
  { id: 'monsoon', label: 'Monsoon', icon: <FiCloudRain className="text-blue-500" /> },
  { id: 'autumn', label: 'Autumn', icon: <FiWind className="text-orange-500" /> },
  { id: 'winter', label: 'Winter', icon: <FiCloud className="text-blue-300" /> }
];

// View modes for different layouts
const VIEW_MODES = [
  { id: 'gallery', label: 'Gallery', icon: <FiGrid /> },
  { id: 'magazine', label: 'Magazine', icon: <FiLayout /> },
  { id: 'list', label: 'List', icon: <FiMenu /> },
  { id: 'map', label: 'Map View', icon: <FiMap /> }
];

// Animations
const fadeIn = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.4 } }
};

const slideUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } }
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08
    }
  }
};

// Main component
function ExploreDestinations() {
  const router = useRouter();
  const { isAuthenticated, currentUser } = useAuth();
  const { q, category, season, rating } = router.query;
  const currentDateTime = '2025-09-05 22:32:35';
  const currentUserLogin = 'dharmendra23101';
  
  // Core state management
  const [places, setPlaces] = useState([]);
  const [filteredPlaces, setFilteredPlaces] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // UI state
  const [viewMode, setViewMode] = useState('gallery');
  const [activeCategory, setActiveCategory] = useState('featured');
  const [activeSeason, setActiveSeason] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMapFullscreen, setIsMapFullscreen] = useState(false);
  const [showSearchOverlay, setShowSearchOverlay] = useState(false);
  const [recentSearches, setRecentSearches] = useState([]);
  const [favoriteFilters, setFavoriteFilters] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(12);
  
  // Filter state
  const [locations, setLocations] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [states, setStates] = useState([]);
  const [tags, setTags] = useState([]);
  const [activeFilters, setActiveFilters] = useState({
    locations: [],
    districts: [],
    states: [],
    tags: [],
    minRating: 0,
    priceRange: [0, 5000],
    activities: []
  });
  
  // Advanced options
  const [sortCriteria, setSortCriteria] = useState('popularity');
  const [showFeaturedOnly, setShowFeaturedOnly] = useState(false);
  const [visiblePlaces, setVisiblePlaces] = useState([]);
  const searchRef = useRef(null);
  
  // Filter panel state
  const [advancedFiltersOpen, setAdvancedFiltersOpen] = useState(false);
  const [filterPanels, setFilterPanels] = useState({
    location: true,
    tags: false,
    rating: false,
    price: false,
    activities: false
  });
  
  // Map interaction state
  const [selectedMapPlace, setSelectedMapPlace] = useState(null);
  const [mapCenter, setMapCenter] = useState({ lat: 20.5937, lng: 78.9629 });
  const [mapZoom, setMapZoom] = useState(5);
  
  // Stats for display
  const [stats, setStats] = useState({
    totalDestinations: 0,
    averageRating: 0,
    mostPopularLocation: '',
    featuredCount: 0
  });
  
  // Featured collections for magazine layout
  const [collections, setCollections] = useState([
    { id: 'weekend-getaways', name: 'Weekend Getaways', places: [] },
    { id: 'hidden-gems', name: 'Hidden Gems', places: [] },
    { id: 'photographers-choice', name: 'Photographer\'s Choice', places: [] },
    { id: 'family-friendly', name: 'Family Friendly', places: [] }
  ]);
  
  // Weather data memoization
  const [weatherData, setWeatherData] = useState({});
  
  // Load initial data
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        setIsLoading(true);
        
        // Start with a nice delay for animation purposes
        const startTime = Date.now();
        
        // Fetch places
        const allPlaces = await getAllPlaces();
        
        // Calculate stats
        const avgRating = allPlaces.reduce((acc, place) => {
          return acc + (place.rating_sum / (place.rating_count || 1));
        }, 0) / (allPlaces.length || 1);
        
        // Get location counts
        const locationCounts = {};
        allPlaces.forEach(place => {
          locationCounts[place.location] = (locationCounts[place.location] || 0) + 1;
        });
        
        // Find most popular location
        const mostPopular = Object.entries(locationCounts)
          .sort((a, b) => b[1] - a[1])
          .shift();
        
        // Count featured places (placeholder logic)
        const featuredCount = allPlaces.filter(p => p.rating_count > 3).length;
        
        // Update stats
        setStats({
          totalDestinations: allPlaces.length,
          averageRating: avgRating.toFixed(1),
          mostPopularLocation: mostPopular ? mostPopular[0] : 'Unknown',
          featuredCount
        });
        
        // Update places
        setPlaces(allPlaces);
        
        // Apply any initial filters from URL
        if (q) setSearchQuery(q);
        if (category) setActiveCategory(category);
        if (season) setActiveSeason(season);
        
        // Load metadata
        const [locData, distData, stateData, tagData] = await Promise.all([
          getLocations(),
          getDistricts(),
          getStates(),
          getTags()
        ]);
        
        setLocations(locData);
        setDistricts(distData);
        setStates(stateData);
        setTags(tagData);
        
        // Create collections based on places
        const updatedCollections = [...collections];
        
        // Weekend getaways - places with shorter visit duration
        updatedCollections[0].places = allPlaces
          .filter(p => p.custom_keys?.['Best Time to Visit']?.toLowerCase().includes('weekend'))
          .slice(0, 6);
          
        // Hidden gems - places with fewer reviews but high ratings
        updatedCollections[1].places = allPlaces
          .filter(p => p.rating_count > 0 && p.rating_count < 5 && p.rating_sum / p.rating_count > 4)
          .slice(0, 6);
          
        // Photographer's choice - places with beautiful imagery
        updatedCollections[2].places = allPlaces
          .filter(p => p.tags?.some(tag => ['scenic', 'photography', 'beautiful'].includes(tag.toLowerCase())))
          .slice(0, 6);
          
        // Family friendly
        updatedCollections[3].places = allPlaces
          .filter(p => p.tags?.some(tag => ['family', 'kid-friendly', 'children'].includes(tag.toLowerCase())))
          .slice(0, 6);
          
        setCollections(updatedCollections);
        
        // Load recent searches from localStorage
        if (typeof window !== 'undefined') {
          const savedSearches = localStorage.getItem('recentTravelSearches');
          if (savedSearches) {
            try {
              setRecentSearches(JSON.parse(savedSearches));
            } catch (e) {
              console.warn('Failed to parse saved searches');
            }
          }
          
          // Load favorite filters
          const savedFilters = localStorage.getItem('favoriteTravelFilters');
          if (savedFilters) {
            try {
              setFavoriteFilters(JSON.parse(savedFilters));
            } catch (e) {
              console.warn('Failed to parse saved filters');
            }
          }
        }
        
        // Ensure we show loading for at least 1.2 seconds for UX
        const elapsed = Date.now() - startTime;
        if (elapsed < 1200) {
          await new Promise(resolve => setTimeout(resolve, 1200 - elapsed));
        }
        
      } catch (err) {
        console.error('Error loading initial data:', err);
        setError('Failed to load destinations. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };
    
    loadInitialData();
  }, []);
  
  // Filter places when search or filters change
  useEffect(() => {
    const applyFilters = async () => {
      if (!places.length) return;
      
      try {
        let filtered = [...places];
        
        // Apply category filter
        if (activeCategory !== 'featured') {
          const categoryMap = {
            trending: place => place.rating_count > 5,
            mountains: place => place.tags?.some(tag => ['mountain', 'hill', 'peak', 'trek'].includes(tag.toLowerCase())),
            beaches: place => place.tags?.some(tag => ['beach', 'sea', 'ocean', 'coast'].includes(tag.toLowerCase())),
            cultural: place => place.tags?.some(tag => ['culture', 'heritage', 'history', 'temple'].includes(tag.toLowerCase())),
            adventure: place => place.tags?.some(tag => ['adventure', 'trek', 'hiking', 'sport'].includes(tag.toLowerCase())),
            relaxation: place => place.tags?.some(tag => ['relax', 'spa', 'peaceful', 'quiet'].includes(tag.toLowerCase())),
            spiritual: place => place.tags?.some(tag => ['spiritual', 'religious', 'temple', 'pilgrimage'].includes(tag.toLowerCase()))
          };
          
          if (categoryMap[activeCategory]) {
            filtered = filtered.filter(categoryMap[activeCategory]);
          }
        }
        
        // Apply season filter
        if (activeSeason !== 'all') {
          const seasonMap = {
            spring: ['march', 'april', 'may'],
            summer: ['june', 'july', 'august'],
            monsoon: ['july', 'august', 'september'],
            autumn: ['september', 'october', 'november'],
            winter: ['december', 'january', 'february']
          };
          
          filtered = filtered.filter(place => {
            const bestTime = place.custom_keys?.['Best Time to Visit']?.toLowerCase() || '';
            return seasonMap[activeSeason].some(month => bestTime.includes(month));
          });
        }
        
        // Apply search filter
        if (searchQuery) {
          const query = searchQuery.toLowerCase();
          filtered = filtered.filter(place => 
            place.name.toLowerCase().includes(query) ||
            place.location.toLowerCase().includes(query) ||
            place.description?.toLowerCase().includes(query) ||
            place.tags?.some(tag => tag.toLowerCase().includes(query)) ||
            place.district?.toLowerCase().includes(query) ||
            place.state?.toLowerCase().includes(query)
          );
          
          // Add to recent searches
          if (!recentSearches.includes(searchQuery)) {
            const newSearches = [searchQuery, ...recentSearches].slice(0, 5);
            setRecentSearches(newSearches);
            localStorage.setItem('recentTravelSearches', JSON.stringify(newSearches));
          }
        }
        
        // Apply advanced filters
        if (activeFilters.locations.length) {
          filtered = filtered.filter(place => 
            activeFilters.locations.includes(place.location)
          );
        }
        
        if (activeFilters.districts.length) {
          filtered = filtered.filter(place => 
            place.district && activeFilters.districts.includes(place.district)
          );
        }
        
        if (activeFilters.states.length) {
          filtered = filtered.filter(place => 
            place.state && activeFilters.states.includes(place.state)
          );
        }
        
        if (activeFilters.tags.length) {
          filtered = filtered.filter(place => 
            place.tags?.some(tag => activeFilters.tags.includes(tag))
          );
        }
        
        if (activeFilters.minRating > 0) {
          filtered = filtered.filter(place => {
            const avgRating = place.rating_count ? place.rating_sum / place.rating_count : 0;
            return avgRating >= activeFilters.minRating;
          });
        }
        
        // Apply sort
        switch (sortCriteria) {
          case 'popularity':
            filtered.sort((a, b) => (b.rating_count || 0) - (a.rating_count || 0));
            break;
          case 'rating':
            filtered.sort((a, b) => {
              const ratingA = a.rating_count ? a.rating_sum / a.rating_count : 0;
              const ratingB = b.rating_count ? b.rating_sum / b.rating_count : 0;
              return ratingB - ratingA;
            });
            break;
          case 'newest':
            filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            break;
          case 'name_asc':
            filtered.sort((a, b) => a.name.localeCompare(b.name));
            break;
          case 'name_desc':
            filtered.sort((a, b) => b.name.localeCompare(a.name));
            break;
        }
        
        // Update state with filtered results
        setFilteredPlaces(filtered);
        
        // Reset page when filters change
        setCurrentPage(1);
        
        // Update URL query parameters
        const queryParams = new URLSearchParams();
        if (searchQuery) queryParams.set('q', searchQuery);
        if (activeCategory !== 'featured') queryParams.set('category', activeCategory);
        if (activeSeason !== 'all') queryParams.set('season', activeSeason);
        
        const url = `${window.location.pathname}?${queryParams.toString()}`;
        window.history.replaceState({}, '', url);
        
      } catch (err) {
        console.error('Error applying filters:', err);
      }
    };
    
    const debouncedFilter = debounce(applyFilters, 300);
    debouncedFilter();
    
    return () => debouncedFilter.cancel();
  }, [
    places,
    searchQuery,
    activeCategory,
    activeSeason,
    activeFilters,
    sortCriteria,
    recentSearches
  ]);
  
  // Update visible places based on pagination
  useEffect(() => {
    if (!filteredPlaces.length) return;
    
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    setVisiblePlaces(filteredPlaces.slice(0, endIndex));
  }, [filteredPlaces, currentPage, itemsPerPage]);
  
  // Add to favorites
  const addToFavorites = useCallback((placeId) => {
    if (!isAuthenticated) {
      // Show login prompt
      return;
    }
    
    // Add to favorites logic here
    toast.success('Added to favorites!');
  }, [isAuthenticated]);
  
  // Save filter preset
  const saveFilterPreset = useCallback(() => {
    if (activeFilters.locations.length || activeFilters.tags.length || activeFilters.minRating > 0) {
      const preset = {
        id: `preset_${Date.now()}`,
        name: `Filter ${favoriteFilters.length + 1}`,
        filters: { ...activeFilters },
        category: activeCategory,
        season: activeSeason
      };
      
      const newFavorites = [...favoriteFilters, preset];
      setFavoriteFilters(newFavorites);
      localStorage.setItem('favoriteTravelFilters', JSON.stringify(newFavorites));
      
      toast.success('Filter preset saved!');
    }
  }, [activeFilters, activeCategory, activeSeason, favoriteFilters]);
  
  // Handle load more
  const loadMore = useCallback(() => {
    setCurrentPage(prev => prev + 1);
  }, []);
  
  // Toggle filter panel
  const toggleFilterPanel = useCallback((panel) => {
    setFilterPanels(prev => ({
      ...prev,
      [panel]: !prev[panel]
    }));
  }, []);
  
  // Handle voice search
  const startVoiceSearch = useCallback(() => {
    if (!('webkitSpeechRecognition' in window)) {
      toast.error('Voice recognition is not supported in this browser');
      return;
    }
    
    const recognition = new window.webkitSpeechRecognition();
    recognition.continuous = false;
    recognition.lang = 'en-US';
    
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setSearchQuery(transcript);
    };
    
    recognition.onerror = (event) => {
      console.error('Speech recognition error', event.error);
      toast.error('Failed to recognize speech');
    };
    
    recognition.start();
  }, []);
  
  // Determine if we're on mobile
  const isMobile = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < 768;
  }, []);
  
  // Toggle sidebar for small screens
  const toggleSidebar = useCallback(() => {
    setIsSidebarOpen(prev => !prev);
  }, []);
  
  // Clear all filters
  const clearAllFilters = useCallback(() => {
    setSearchQuery('');
    setActiveCategory('featured');
    setActiveSeason('all');
    setActiveFilters({
      locations: [],
      districts: [],
      states: [],
      tags: [],
      minRating: 0,
      priceRange: [0, 5000],
      activities: []
    });
    setSortCriteria('popularity');
    setShowFeaturedOnly(false);
  }, []);
  
  // Empty state component
  const EmptyState = () => (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-6">
        <FiSearch className="w-12 h-12 text-gray-400" />
      </div>
      <h3 className="text-xl font-bold text-gray-900 mb-2">No destinations found</h3>
      <p className="text-gray-600 max-w-md mb-8">
        We couldn't find any destinations matching your current filters. 
        Try adjusting your search criteria or exploring different categories.
      </p>
      <button
        onClick={clearAllFilters}
        className="px-6 py-3 bg-primary-600 text-white rounded-full font-medium shadow-lg hover:bg-primary-700 transition-all hover:shadow-xl"
      >
        Reset All Filters
      </button>
    </div>
  );
  
  // Loading skeleton
  const LoadingSkeleton = () => (
    <div className="animate-pulse">
      <div className="flex mb-8 space-x-4 overflow-x-auto pb-4">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="flex-shrink-0 w-40 h-12 bg-gray-200 rounded-full"></div>
        ))}
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {[...Array(12)].map((_, i) => (
          <div key={i} className="bg-white rounded-xl overflow-hidden shadow-lg">
            <div className="h-52 bg-gray-200"></div>
            <div className="p-4">
              <div className="h-6 bg-gray-200 rounded mb-3 w-3/4"></div>
              <div className="h-4 bg-gray-200 rounded mb-2 w-1/2"></div>
              <div className="h-4 bg-gray-200 rounded w-full"></div>
              <div className="mt-4 flex justify-between">
                <div className="h-8 bg-gray-200 rounded w-20"></div>
                <div className="h-8 bg-gray-200 rounded w-20"></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
  
  // Stats bar content
  const StatsBar = () => (
    <div className="hidden lg:flex justify-between items-center mb-6 px-4 py-3 bg-white rounded-xl shadow-sm">
      <div className="flex items-center">
        <div className="bg-primary-100 p-2 rounded-full text-primary-600 mr-3">
          <FiMap className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm text-gray-500">Total Destinations</p>
          <p className="font-semibold">{stats.totalDestinations}</p>
        </div>
      </div>
      
      <div className="flex items-center">
        <div className="bg-yellow-100 p-2 rounded-full text-yellow-600 mr-3">
          <FiStar className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm text-gray-500">Average Rating</p>
          <p className="font-semibold">{stats.averageRating} / 5</p>
        </div>
      </div>
      
      <div className="flex items-center">
        <div className="bg-green-100 p-2 rounded-full text-green-600 mr-3">
          <FiMapPin className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm text-gray-500">Popular Location</p>
          <p className="font-semibold">{stats.mostPopularLocation}</p>
        </div>
      </div>
      
      <div className="flex items-center">
        <div className="bg-purple-100 p-2 rounded-full text-purple-600 mr-3">
          <FiAward className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm text-gray-500">Featured Places</p>
          <p className="font-semibold">{stats.featuredCount}</p>
        </div>
      </div>
      
      <div className="flex items-center text-gray-500 text-sm">
        <FiClock className="mr-1" />
        <span>Updated: {currentDateTime}</span>
      </div>
    </div>
  );
  
  // Filter sidebar
  const FilterSidebar = () => (
    <aside 
      className={`fixed lg:sticky lg:top-24 h-full lg:h-auto z-30 lg:z-0 bg-white lg:bg-transparent shadow-xl lg:shadow-none transition-all duration-300 transform ${
        isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      } w-80 lg:w-72 overflow-y-auto lg:block`}
    >
      <div className="p-4 lg:p-0">
        <div className="flex justify-between items-center lg:hidden border-b border-gray-200 pb-4 mb-4">
          <h2 className="text-xl font-bold text-gray-900">Filters</h2>
          <button 
            onClick={toggleSidebar}
            className="p-2 rounded-full hover:bg-gray-100"
          >
            <FiX className="h-5 w-5 text-gray-600" />
          </button>
        </div>
        
        {/* User profile card - mobile only */}
        {isAuthenticated && (
          <div className="lg:hidden bg-gradient-to-r from-primary-600 to-primary-800 rounded-xl p-4 mb-6 text-white">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                <FiUser className="h-6 w-6" />
              </div>
              <div className="ml-3">
                <p className="font-medium">{currentUserLogin}</p>
                <p className="text-sm text-white/80">Explorer Level 2</p>
              </div>
            </div>
          </div>
        )}
        
        {/* Search input */}
        <div className="relative mb-6 mt-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search destinations..."
            className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all"
            ref={searchRef}
          />
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <FiSearch className="h-5 w-5 text-gray-400" />
          </div>
          
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute inset-y-0 right-0 pr-3 flex items-center"
            >
              <FiX className="h-5 w-5 text-gray-400 hover:text-gray-600" />
            </button>
          )}
          
          {/* Voice search button */}
          <button
            onClick={startVoiceSearch}
            className="absolute right-12 inset-y-0 pr-2 flex items-center text-gray-400 hover:text-primary-600"
            title="Search with voice"
          >
            <FiMic className="h-5 w-5" />
          </button>
        </div>
        
        {/* Recent searches */}
        {recentSearches.length > 0 && (
          <div className="mb-6">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-sm font-medium text-gray-500">Recent Searches</h3>
              <button 
                onClick={() => {
                  setRecentSearches([]);
                  localStorage.removeItem('recentTravelSearches');
                }}
                className="text-xs text-primary-600 hover:text-primary-800"
              >
                Clear All
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {recentSearches.map((search, index) => (
                <button
                  key={index}
                  onClick={() => setSearchQuery(search)}
                  className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded-full text-sm text-gray-700 flex items-center"
                >
                  <FiClock className="mr-1 h-3 w-3 text-gray-500" />
                  {search}
                </button>
              ))}
            </div>
          </div>
        )}
        
        {/* Filter by category */}
        <div className="mb-6">
          <h3 className="text-sm font-medium text-gray-900 mb-3 flex items-center">
            <FiLayers className="mr-2 text-primary-600" />
            Filter by Category
          </h3>
          <div className="space-y-2">
            {CATEGORIES.map(category => (
              <button
                key={category.id}
                onClick={() => setActiveCategory(category.id)}
                className={`flex items-center w-full px-3 py-2 rounded-lg text-left ${
                  activeCategory === category.id
                    ? `bg-gradient-to-r ${category.gradient} text-white`
                    : 'bg-gray-50 hover:bg-gray-100 text-gray-700'
                }`}
              >
                <span className="mr-2">{category.icon}</span>
                <span className="font-medium">{category.label}</span>
                {activeCategory === category.id && (
                  <FiCheckSquare className="ml-auto h-4 w-4" />
                )}
              </button>
            ))}
          </div>
        </div>
        
        {/* Filter by season */}
        <div className="mb-6 pb-6 border-b border-gray-200">
          <h3 className="text-sm font-medium text-gray-900 mb-3 flex items-center">
            <FiCalendar className="mr-2 text-primary-600" />
            Best Time to Visit
          </h3>
          <div className="flex flex-wrap gap-2">
            {SEASONS.map(season => (
              <button
                key={season.id}
                onClick={() => setActiveSeason(season.id)}
                className={`px-3 py-2 rounded-lg flex items-center ${
                  activeSeason === season.id
                    ? 'bg-primary-100 text-primary-800 border border-primary-300'
                    : 'bg-gray-50 hover:bg-gray-100 text-gray-700 border border-transparent'
                }`}
              >
                <span className="mr-2">{season.icon}</span>
                <span className="text-sm">{season.label}</span>
              </button>
            ))}
          </div>
        </div>
        
        {/* Advanced Filters */}
        <div className="mb-4">
          <button
            onClick={() => setAdvancedFiltersOpen(!advancedFiltersOpen)}
            className="flex items-center justify-between w-full text-left text-sm font-medium text-gray-900 px-3 py-2 bg-gray-50 rounded-lg hover:bg-gray-100"
          >
            <div className="flex items-center">
              <FiSliders className="mr-2 text-primary-600" />
              Advanced Filters
            </div>
            <div>
              {activeFilters.locations.length > 0 || 
               activeFilters.tags.length > 0 || 
               activeFilters.minRating > 0 ? (
                <span className="px-2 py-1 bg-primary-100 text-primary-800 text-xs rounded-full mr-2">
                  {activeFilters.locations.length + 
                   activeFilters.districts.length + 
                   activeFilters.states.length + 
                   activeFilters.tags.length + 
                   (activeFilters.minRating > 0 ? 1 : 0)}
                </span>
              ) : null}
              {advancedFiltersOpen ? (
                <FiChevronUp className="h-5 w-5 text-gray-500" />
              ) : (
                <FiChevronDown className="h-5 w-5 text-gray-500" />
              )}
            </div>
          </button>
          
          {advancedFiltersOpen && (
            <div className="mt-4 space-y-6">
              {/* Location filter */}
              <div>
                <button
                  onClick={() => toggleFilterPanel('location')}
                  className="flex items-center justify-between w-full text-left text-sm font-medium text-gray-700 mb-2"
                >
                  <span>Location</span>
                  {filterPanels.location ? (
                    <FiChevronUp className="h-4 w-4 text-gray-500" />
                  ) : (
                    <FiChevronDown className="h-4 w-4 text-gray-500" />
                  )}
                </button>
                
                {filterPanels.location && (
                  <div className="mt-2 space-y-2">
                    <select
                      value={activeFilters.locations[0] || ''}
                      onChange={(e) => setActiveFilters(prev => ({
                        ...prev,
                        locations: e.target.value ? [e.target.value] : []
                      }))}
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                    >
                      <option value="">All Locations</option>
                      {locations.map((loc, idx) => (
                        <option key={idx} value={loc}>{loc}</option>
                      ))}
                    </select>
                    
                    <select
                      value={activeFilters.districts[0] || ''}
                      onChange={(e) => setActiveFilters(prev => ({
                        ...prev,
                        districts: e.target.value ? [e.target.value] : []
                      }))}
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                    >
                      <option value="">All Districts</option>
                      {districts.map((district, idx) => (
                        <option key={idx} value={district}>{district}</option>
                      ))}
                    </select>
                    
                    <select
                      value={activeFilters.states[0] || ''}
                      onChange={(e) => setActiveFilters(prev => ({
                        ...prev,
                        states: e.target.value ? [e.target.value] : []
                      }))}
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                    >
                      <option value="">All States</option>
                      {states.map((state, idx) => (
                        <option key={idx} value={state}>{state}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
              
              {/* Tags filter */}
              <div>
                <button
                  onClick={() => toggleFilterPanel('tags')}
                  className="flex items-center justify-between w-full text-left text-sm font-medium text-gray-700 mb-2"
                >
                  <span>Tags & Features</span>
                  {filterPanels.tags ? (
                    <FiChevronUp className="h-4 w-4 text-gray-500" />
                  ) : (
                    <FiChevronDown className="h-4 w-4 text-gray-500" />
                  )}
                </button>
                
                {filterPanels.tags && (
                  <div className="mt-2">
                    <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto p-1">
                      {tags.slice(0, 20).map((tag, idx) => (
                        <button
                          key={idx}
                          onClick={() => {
                            setActiveFilters(prev => {
                              const tagExists = prev.tags.includes(tag);
                              return {
                                ...prev,
                                tags: tagExists
                                  ? prev.tags.filter(t => t !== tag)
                                  : [...prev.tags, tag]
                              };
                            });
                          }}
                          className={`px-3 py-1 rounded-full text-xs ${
                            activeFilters.tags.includes(tag)
                              ? 'bg-primary-100 text-primary-800 border border-primary-300'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-transparent'
                          }`}
                        >
                          {tag}
                          {activeFilters.tags.includes(tag) && (
                            <FiCheck className="inline-block ml-1 h-3 w-3" />
                          )}
                        </button>
                      ))}
                    </div>
                    
                    {tags.length > 20 && (
                      <button className="text-xs text-primary-600 hover:text-primary-800 mt-2">
                        Show more tags
                      </button>
                    )}
                  </div>
                )}
              </div>
              
              {/* Rating filter */}
              <div>
                <button
                  onClick={() => toggleFilterPanel('rating')}
                  className="flex items-center justify-between w-full text-left text-sm font-medium text-gray-700 mb-2"
                >
                  <span>Minimum Rating</span>
                  {filterPanels.rating ? (
                    <FiChevronUp className="h-4 w-4 text-gray-500" />
                  ) : (
                    <FiChevronDown className="h-4 w-4 text-gray-500" />
                  )}
                </button>
                
                {filterPanels.rating && (
                  <div className="mt-2">
                    <div className="flex items-center justify-between">
                      {[0, 1, 2, 3, 4, 5].map(rating => (
                        <button
                          key={rating}
                          onClick={() => setActiveFilters(prev => ({
                            ...prev,
                            minRating: rating
                          }))}
                          className={`flex-1 py-2 flex items-center justify-center ${
                            activeFilters.minRating === rating
                              ? 'bg-yellow-100 text-yellow-800 border border-yellow-300 rounded'
                              : 'text-gray-700 hover:bg-gray-100 rounded'
                          }`}
                        >
                          {rating === 0 ? (
                            <span>Any</span>
                          ) : (
                            <div className="flex items-center">
                              {rating}
                              <FiStar className="ml-1 h-3 w-3" />
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                    
                    <div className="mt-4 flex items-center">
                      {activeFilters.minRating > 0 ? (
                        <div className="flex text-yellow-500">
                          {[...Array(5)].map((_, i) => (
                            <FiStar
                              key={i}
                              className={`h-4 w-4 ${i < activeFilters.minRating ? 'fill-current' : 'text-gray-300'}`}
                            />
                          ))}
                        </div>
                      ) : (
                        <span className="text-sm text-gray-500">No minimum rating</span>
                      )}
                      
                      {activeFilters.minRating > 0 && (
                        <button
                          onClick={() => setActiveFilters(prev => ({
                            ...prev,
                            minRating: 0
                          }))}
                          className="ml-auto text-xs text-primary-600 hover:text-primary-800"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        
        {/* Sort options */}
        <div className="mb-6">
          <h3 className="text-sm font-medium text-gray-900 mb-3 flex items-center">
            <FiSliders className="mr-2 text-primary-600" />
            Sort By
          </h3>
          <select
            value={sortCriteria}
            onChange={(e) => setSortCriteria(e.target.value)}
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
          >
            <option value="popularity">Most Popular</option>
            <option value="rating">Highest Rated</option>
            <option value="newest">Newest First</option>
            <option value="name_asc">Name (A-Z)</option>
            <option value="name_desc">Name (Z-A)</option>
          </select>
        </div>
        
        {/* Featured only toggle */}
        <div className="mb-6">
          <label className="flex items-center text-sm font-medium text-gray-700">
            <input
              type="checkbox"
              checked={showFeaturedOnly}
              onChange={() => setShowFeaturedOnly(!showFeaturedOnly)}
              className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
            />
            <span className="ml-2">Show featured only</span>
          </label>
        </div>
        
        {/* Save & Clear buttons */}
        <div className="flex space-x-3 mb-6">
          <button
            onClick={clearAllFilters}
            className="flex-1 py-2 px-4 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Clear All
          </button>
          <button
            onClick={saveFilterPreset}
            className="flex-1 py-2 px-4 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700"
          >
            Save Filter
          </button>
        </div>
        
        {/* Saved filter presets */}
        {favoriteFilters.length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-900 mb-3 flex items-center">
              <FiBookmark className="mr-2 text-primary-600" />
              Saved Filters
            </h3>
            <div className="space-y-2">
              {favoriteFilters.map((filter, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setActiveFilters(filter.filters);
                    setActiveCategory(filter.category);
                    setActiveSeason(filter.season);
                  }}
                  className="flex items-center justify-between w-full px-3 py-2 bg-gray-50 hover:bg-gray-100 rounded-lg text-left text-sm"
                >
                  <span className="font-medium text-gray-700">{filter.name}</span>
                  <FiChevronRight className="h-4 w-4 text-gray-500" />
                </button>
              ))}
            </div>
          </div>
        )}
        
        {/* Current UTC time */}
        <div className="text-xs text-gray-500 text-center">
          <FiClock className="inline-block mr-1" />
          {currentDateTime}
        </div>
      </div>
    </aside>
  );
  
  // Card component implementations
  const PlaceGalleryCard = ({ place, onFavorite, priority = false }) => {
    return (
      <div className="bg-white rounded-xl overflow-hidden shadow-lg hover:shadow-xl transition-shadow duration-300 h-full flex flex-col group">
        <div className="relative h-52 overflow-hidden">
          <img 
            src={place.primary_image_url || place.image_url || '/images/placeholder.jpg'} 
            alt={place.name}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
            loading={priority ? "eager" : "lazy"}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent"></div>
          
          {place.rating_count > 0 && (
            <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-sm text-white px-2 py-1 rounded-lg flex items-center">
              <FiStar className="mr-1 text-yellow-400" />
              <span className="font-medium">
                {(place.rating_sum / place.rating_count).toFixed(1)}
              </span>
            </div>
          )}
          
          <button 
            onClick={(e) => {
              e.preventDefault();
              onFavorite();
            }}
            className="absolute top-3 left-3 w-8 h-8 flex items-center justify-center bg-black/60 backdrop-blur-sm text-white rounded-full hover:bg-red-500/80 transition-colors"
          >
            <FiHeart className="h-4 w-4" />
          </button>
          
          <div className="absolute bottom-3 left-3 right-3">
            <h3 className="text-lg font-bold text-white line-clamp-1">{place.name}</h3>
            <div className="flex items-center text-white/90 text-sm">
              <FiMapPin className="mr-1 h-3 w-3" />
              <span className="truncate">{place.location}</span>
            </div>
          </div>
        </div>
        
        <div className="p-4 flex-grow flex flex-col">
          <div className="flex-grow">
            <p className="text-gray-600 text-sm line-clamp-2 mb-3">
              {place.description || 'Explore this amazing destination and discover its unique features and attractions.'}
            </p>
            
            <div className="flex flex-wrap gap-1 mb-3">
              {place.tags?.slice(0, 3).map((tag, idx) => (
                <span key={idx} className="text-xs text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full">
                  {tag}
                </span>
              ))}
              {place.tags?.length > 3 && (
                <span className="text-xs text-gray-500">+{place.tags.length - 3}</span>
              )}
            </div>
          </div>
          
          <Link
            href={`/places/${place.id}`}
            className="mt-2 w-full py-2 bg-primary-600 text-white rounded-lg text-center font-medium hover:bg-primary-700 transition-colors"
          >
            View Details
          </Link>
        </div>
      </div>
    );
  };
  
  const PlaceFeatureCard = ({ place, size = 'medium' }) => {
    return (
      <div className={`group relative overflow-hidden rounded-xl shadow-lg ${
        size === 'large' ? 'h-96' : size === 'small' ? 'h-48' : 'h-64'
      }`}>
        <img
          src={place.primary_image_url || place.image_url || '/images/placeholder.jpg'}
          alt={place.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent"></div>
        
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <h3 className={`font-bold text-white ${
            size === 'large' ? 'text-2xl' : 'text-lg'
          }`}>{place.name}</h3>
          
          <div className="flex items-center text-white/90 text-sm mb-2">
            <FiMapPin className="mr-1 h-3 w-3" />
            <span>{place.location}</span>
          </div>
          
          {size === 'large' && (
            <p className="text-white/80 text-sm mb-4 line-clamp-2">
              {place.description}
            </p>
          )}
          
          <Link
            href={`/places/${place.id}`}
            className={`inline-flex items-center ${
              size === 'large'
                ? 'px-4 py-2 bg-white text-primary-700 rounded-lg font-medium hover:bg-gray-100'
                : 'text-white hover:text-primary-300'
            }`}
          >
            {size === 'large' ? 'Explore Now' : 'View Details'}
            <FiChevronRight className="ml-1 h-4 w-4" />
          </Link>
        </div>
        
        {place.rating_count > 0 && (
          <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-sm text-white px-2 py-1 rounded-lg flex items-center">
            <FiStar className="mr-1 text-yellow-400" />
            <span className="font-medium">
              {(place.rating_sum / place.rating_count).toFixed(1)}
            </span>
          </div>
        )}
      </div>
    );
  };
  
  const PlaceCompactCard = ({ place }) => {
    return (
      <div className="bg-white rounded-xl overflow-hidden shadow-md hover:shadow-lg transition-shadow duration-300 group">
        <div className="relative h-40">
          <img
            src={place.primary_image_url || place.image_url || '/images/placeholder.jpg'}
            alt={place.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
          
          {place.rating_count > 0 && (
            <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm text-white px-1.5 py-0.5 rounded text-xs flex items-center">
              <FiStar className="mr-0.5 h-3 w-3 text-yellow-400" />
              <span className="font-medium">
                {(place.rating_sum / place.rating_count).toFixed(1)}
              </span>
            </div>
          )}
        </div>
        
        <div className="p-3">
          <h3 className="font-bold text-gray-900 line-clamp-1 group-hover:text-primary-600 transition-colors">
            {place.name}
          </h3>
          
          <div className="flex items-center text-gray-500 text-sm mb-2">
            <FiMapPin className="mr-1 h-3 w-3" />
            <span className="truncate">{place.location}</span>
          </div>
          
          <Link
            href={`/places/${place.id}`}
            className="mt-1 text-primary-600 hover:text-primary-800 text-sm font-medium flex items-center"
          >
            View Details
            <FiChevronRight className="ml-1 h-3 w-3" />
          </Link>
        </div>
      </div>
    );
  };
  
  // Custom toast utility
  const toast = {
    success: (message) => {
      if (typeof document === 'undefined') return;
      
      const container = document.getElementById('toast-container') || document.createElement('div');
      if (!document.getElementById('toast-container')) {
        container.id = 'toast-container';
        container.className = 'fixed bottom-4 right-4 z-50';
        document.body.appendChild(container);
      }
      
      const toast = document.createElement('div');
      toast.className = 'mb-3 p-4 rounded-lg shadow-lg flex items-center bg-green-500 text-white transform transition-all duration-500 opacity-0 translate-y-8';
      
      const icon = document.createElement('span');
      icon.className = 'mr-3 text-xl';
      icon.innerHTML = '✓';
      
      const text = document.createElement('span');
      text.textContent = message;
      
      toast.appendChild(icon);
      toast.appendChild(text);
      container.appendChild(toast);
      
      // Trigger animation
      setTimeout(() => {
        toast.classList.remove('opacity-0', 'translate-y-8');
      }, 10);
      
      // Auto remove
      setTimeout(() => {
        toast.classList.add('opacity-0', 'translate-y-8');
        setTimeout(() => {
          container.removeChild(toast);
        }, 500);
      }, 3000);
    },
    error: (message) => {
      if (typeof document === 'undefined') return;
      
      const container = document.getElementById('toast-container') || document.createElement('div');
      if (!document.getElementById('toast-container')) {
        container.id = 'toast-container';
        container.className = 'fixed bottom-4 right-4 z-50';
        document.body.appendChild(container);
      }
      
      const toast = document.createElement('div');
      toast.className = 'mb-3 p-4 rounded-lg shadow-lg flex items-center bg-red-500 text-white transform transition-all duration-500 opacity-0 translate-y-8';
      
      const icon = document.createElement('span');
      icon.className = 'mr-3 text-xl';
      icon.innerHTML = '✗';
      
      const text = document.createElement('span');
      text.textContent = message;
      
      toast.appendChild(icon);
      toast.appendChild(text);
      container.appendChild(toast);
      
      // Trigger animation
      setTimeout(() => {
        toast.classList.remove('opacity-0', 'translate-y-8');
      }, 10);
      
      // Auto remove
      setTimeout(() => {
        toast.classList.add('opacity-0', 'translate-y-8');
        setTimeout(() => {
          container.removeChild(toast);
        }, 500);
      }, 3000);
    }
  };
  
  // Main content renders differently based on view mode
  const renderContent = () => {
    if (isLoading) {
      return <LoadingSkeleton />;
    }
    
    if (filteredPlaces.length === 0) {
      return <EmptyState />;
    }
    
    switch (viewMode) {
      case 'gallery':
        return (
          <motion.div 
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
          >
            {visiblePlaces.map((place, index) => (
              <motion.div key={place.id} variants={slideUp}>
                <PlaceGalleryCard 
                  place={place} 
                  onFavorite={() => addToFavorites(place.id)}
                  priority={index < 8}
                />
              </motion.div>
            ))}
          </motion.div>
        );
        
      case 'magazine':
        return (
          <div className="space-y-16">
            {/* Featured section with large card */}
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
                <FiAward className="mr-2 text-amber-500" />
                Editor's Picks
              </h2>
              
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Large feature card */}
                <div className="lg:col-span-2">
                  {visiblePlaces.length > 0 && (
                    <PlaceFeatureCard place={visiblePlaces[0]} size="large" />
                  )}
                </div>
                
                {/* Side columns */}
                <div className="space-y-6">
                  {visiblePlaces.slice(1, 3).map(place => (
                    <PlaceFeatureCard key={place.id} place={place} size="small" />
                  ))}
                </div>
              </div>
            </section>
            
            {/* Collections */}
            {collections.map((collection, idx) => (
                            <section key={collection.id}>
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold text-gray-900">{collection.name}</h2>
                  <Link href={`/collections/${collection.id}`} className="text-primary-600 hover:text-primary-800 flex items-center text-sm font-medium">
                    View All
                    <FiChevronRight className="ml-1 h-4 w-4" />
                  </Link>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {collection.places.slice(0, 3).map(place => (
                    <PlaceCompactCard key={place.id} place={place} />
                  ))}
                </div>
              </section>
            ))}
            
            {/* More destinations */}
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-6">More Destinations</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {visiblePlaces.slice(3, 11).map(place => (
                  <PlaceCompactCard key={place.id} place={place} />
                ))}
              </div>
            </section>
          </div>
        );
        
      case 'list':
        return (
          <div className="space-y-6">
            {visiblePlaces.map(place => (
              <motion.div 
                key={place.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-xl shadow-lg overflow-hidden flex flex-col sm:flex-row"
              >
                {/* Image */}
                <div className="sm:w-1/3 h-56 sm:h-auto relative">
                  <div className="w-full h-full bg-gray-100">
                    <img
                      src={place.primary_image_url || place.image_url || '/images/placeholder.jpg'}
                      alt={place.name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </div>
                  
                  {/* Rating */}
                  {place.rating_count > 0 && (
                    <div className="absolute top-4 right-4 bg-black/70 backdrop-blur-sm text-white px-2 py-1 rounded-lg flex items-center">
                      <FiStar className="mr-1 text-yellow-400" />
                      <span className="font-medium">
                        {(place.rating_sum / place.rating_count).toFixed(1)}
                      </span>
                    </div>
                  )}
                  
                  {/* Category tags */}
                  <div className="absolute bottom-4 left-4 flex flex-wrap gap-2">
                    {place.tags?.slice(0, 2).map((tag, idx) => (
                      <span key={idx} className="px-2 py-1 bg-black/70 backdrop-blur-sm text-white text-xs rounded-lg">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
                
                {/* Content */}
                <div className="p-6 flex-1 flex flex-col">
                  <div className="mb-auto">
                    <div className="flex justify-between items-start mb-1">
                      <h3 className="text-xl font-bold text-gray-900">{place.name}</h3>
                      <button 
                        onClick={() => addToFavorites(place.id)}
                        className="text-gray-400 hover:text-red-500"
                      >
                        <FiHeart className="h-5 w-5" />
                      </button>
                    </div>
                    
                    <div className="flex items-center text-gray-600 mb-3">
                      <FiMapPin className="mr-1 h-4 w-4 text-gray-400" />
                      <span className="text-sm">
                        {place.location}
                        {place.district && `, ${place.district}`}
                        {place.state && `, ${place.state}`}
                      </span>
                    </div>
                    
                    <p className="text-gray-600 text-sm mb-4 line-clamp-3">
                      {place.description || 'No description available.'}
                    </p>
                    
                    <div className="flex flex-wrap gap-2 mb-3">
                      {place.themes?.map((theme, idx) => {
                        const themeInfo = CATEGORIES.find(cat => cat.id === theme);
                        return (
                          <span key={idx} className="flex items-center text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded-full">
                            {themeInfo?.icon && <span className="mr-1">{themeInfo.icon}</span>}
                            {themeInfo?.label || theme}
                          </span>
                        );
                      })}
                    </div>
                    
                    {/* Weather preview */}
                    {place.latitude && place.longitude && (
                      <div className="flex items-center text-xs text-gray-500 mb-4">
                        <FiSun className="mr-1 text-yellow-500" />
                        <span>Best time to visit: </span>
                        <span className="font-medium ml-1">
                          {place.custom_keys?.['Best Time to Visit'] || 'All year'}
                        </span>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                    <Link 
                      href={`/places/${place.id}`}
                      className="px-4 py-2 bg-primary-600 text-white rounded-lg flex items-center text-sm font-medium hover:bg-primary-700 transition-colors"
                    >
                      View Details
                      <FiChevronRight className="ml-1 h-4 w-4" />
                    </Link>
                    
                    <div className="flex items-center space-x-4">
                      <button className="p-2 text-gray-400 hover:text-gray-600">
                        <FiBookmark className="h-5 w-5" />
                      </button>
                      <button className="p-2 text-gray-400 hover:text-gray-600">
                        <FiShare2 className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        );
        
      case 'map':
        return (
          <div className="relative h-[calc(100vh-200px)] min-h-[600px] rounded-xl overflow-hidden bg-gray-100 shadow-inner">
            <Map 
              places={filteredPlaces}
              selectedPlace={selectedMapPlace}
              onSelectPlace={setSelectedMapPlace}
              center={mapCenter}
              zoom={mapZoom}
              onZoomChange={setMapZoom}
              onCenterChange={setMapCenter}
              className="w-full h-full"
            />
            
            {/* Map controls */}
            <div className="absolute top-4 right-4 flex flex-col space-y-2">
              <button
                onClick={() => setIsMapFullscreen(!isMapFullscreen)}
                className="p-2 bg-white rounded-lg shadow-lg text-gray-700 hover:bg-gray-100"
                title={isMapFullscreen ? "Exit fullscreen" : "Fullscreen map"}
              >
                {isMapFullscreen ? (
                  <FiMinimize2 className="h-5 w-5" />
                ) : (
                  <FiMaximize2 className="h-5 w-5" />
                )}
              </button>
              <button
                onClick={() => setMapZoom(mapZoom + 1)}
                className="p-2 bg-white rounded-lg shadow-lg text-gray-700 hover:bg-gray-100"
                title="Zoom in"
              >
                <FiPlus className="h-5 w-5" />
              </button>
              <button
                onClick={() => setMapZoom(mapZoom - 1)}
                className="p-2 bg-white rounded-lg shadow-lg text-gray-700 hover:bg-gray-100"
                title="Zoom out"
              >
                <FiMinus className="h-5 w-5" />
              </button>
            </div>
            
            {/* Selected place info */}
            {selectedMapPlace && (
              <div className="absolute bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-72 bg-white rounded-xl shadow-lg p-4">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-bold text-gray-900">{selectedMapPlace.name}</h3>
                  <button 
                    onClick={() => setSelectedMapPlace(null)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <FiX className="h-5 w-5" />
                  </button>
                </div>
                <div className="flex items-center text-sm text-gray-600 mb-3">
                  <FiMapPin className="mr-1 h-4 w-4 text-gray-400" />
                  <span>{selectedMapPlace.location}</span>
                </div>
                <Link
                  href={`/places/${selectedMapPlace.id}`}
                  className="w-full px-4 py-2 bg-primary-600 text-white rounded-lg flex items-center justify-center text-sm font-medium hover:bg-primary-700 transition-colors"
                >
                  View Details
                </Link>
              </div>
            )}
          </div>
        );
        
      default:
        return <div>Unknown view mode</div>;
    }
  };
  
  return (
    <>
      <Head>
        <title>Explore Incredible Destinations | EasyTrip</title>
        <meta name="description" content="Discover amazing places to visit with personalized recommendations for your next adventure. Find the perfect destination based on your preferences." />
        <meta name="keywords" content="travel, destinations, places to visit, adventure, explore, vacations, holidays" />
        <meta property="og:title" content="Explore Incredible Destinations | EasyTrip" />
        <meta property="og:description" content="Discover amazing places to visit with personalized recommendations for your next adventure." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://easytrip.com/explore" />
        <meta property="og:image" content="/images/og-explore.jpg" />
      </Head>

      <div className="min-h-screen bg-gray-50 pt-20">
        {/* Hero banner with dynamic BG */}
        <div className="relative bg-gradient-to-r from-indigo-800 to-purple-900 text-white">
          <div 
            className="absolute inset-0 opacity-20 bg-pattern-dots"
            style={{
              backgroundImage: "url('/images/travel-pattern.png')",
              backgroundSize: "cover",
              mixBlendMode: "overlay"
            }}
          ></div>
          
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-20 relative z-10">
            <div className="max-w-3xl">
              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="text-4xl md:text-5xl lg:text-6xl font-extrabold leading-tight"
              >
                Discover Your Next Adventure
              </motion.h1>
              <motion.p 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="mt-4 text-xl text-indigo-100 max-w-2xl"
              >
                Explore {stats.totalDestinations} amazing destinations carefully curated for unforgettable experiences.
              </motion.p>
              
              {/* Search bar in hero */}
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.4 }}
                className="mt-8 max-w-xl"
              >
                <div className="relative rounded-full shadow-xl">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search for mountains, beaches, heritage sites..."
                    className="block w-full bg-white/90 backdrop-blur-sm pl-12 pr-20 py-4 rounded-full text-gray-900 placeholder:text-gray-500 focus:ring-2 focus:ring-primary-500 shadow-inner"
                    aria-label="Search destinations"
                  />
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <FiSearch className="h-6 w-6 text-primary-600" />
                  </div>
                  <div className="absolute inset-y-0 right-0 pr-4 flex items-center space-x-1">
                    <button
                      onClick={startVoiceSearch}
                      className="p-1.5 text-gray-400 hover:text-primary-600 focus:outline-none"
                      aria-label="Search with voice"
                    >
                      <FiMic className="h-5 w-5" />
                    </button>
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery('')}
                        className="p-1.5 text-gray-400 hover:text-gray-600 focus:outline-none"
                        aria-label="Clear search"
                      >
                        <FiX className="h-5 w-5" />
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
              
              {/* Quick filter chips */}
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
                className="mt-6 flex flex-wrap gap-2"
              >
                {CATEGORIES.slice(0, 5).map((category, idx) => (
                  <motion.button
                    key={category.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6 + idx * 0.1 }}
                    onClick={() => setActiveCategory(category.id)}
                    className={`flex items-center px-4 py-2 rounded-full text-sm ${
                      activeCategory === category.id
                        ? `bg-gradient-to-r ${category.gradient} text-white shadow-lg`
                        : 'bg-white/20 backdrop-blur-sm text-white hover:bg-white/30'
                    }`}
                  >
                    <span className="mr-2">{category.icon}</span>
                    <span>{category.label}</span>
                  </motion.button>
                ))}
              </motion.div>
            </div>
          </div>
          
          {/* Wave divider */}
          <div className="absolute bottom-0 left-0 right-0 overflow-hidden leading-none w-full text-gray-50">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 120" preserveAspectRatio="none" className="w-full h-12">
              <path d="M321.39,56.44c58-10.79,114.16-30.13,172-41.86,82.39-16.72,168.19-17.73,250.45-.39C823.78,31,906.67,72,985.66,92.83c70.05,18.48,146.53,26.09,214.34,3V0H0V27.35A600.21,600.21,0,0,0,321.39,56.44Z" className="fill-current"></path>
            </svg>
          </div>
        </div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Stats bar */}
          <StatsBar />
          
          {/* Mobile filter button */}
          <div className="lg:hidden flex justify-between mb-6">
            <button
              onClick={toggleSidebar}
              className="flex items-center px-4 py-2 bg-white rounded-lg shadow-sm text-gray-700 border border-gray-200"
            >
              <FiFilter className="mr-2 h-5 w-5 text-primary-600" />
              <span>Filters</span>
              {(activeFilters.locations.length || activeFilters.tags.length || activeFilters.minRating > 0 || activeCategory !== 'featured' || activeSeason !== 'all') && (
                <span className="ml-2 bg-primary-100 text-primary-800 text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {activeFilters.locations.length + activeFilters.tags.length + (activeFilters.minRating > 0 ? 1 : 0) + (activeCategory !== 'featured' ? 1 : 0) + (activeSeason !== 'all' ? 1 : 0)}
                </span>
              )}
            </button>
            
            <div className="flex items-center space-x-2">
              {VIEW_MODES.map(mode => (
                <button
                  key={mode.id}
                  onClick={() => setViewMode(mode.id)}
                  className={`p-2 rounded-lg ${
                    viewMode === mode.id
                      ? 'bg-primary-100 text-primary-700'
                      : 'bg-white text-gray-700 hover:bg-gray-100'
                  }`}
                  title={mode.label}
                >
                  {mode.icon}
                </button>
              ))}
            </div>
          </div>
          
          {/* Category pills for mobile */}
          <div className="lg:hidden mb-6 overflow-x-auto pb-2 flex space-x-2 scrollbar-hide">
            {CATEGORIES.map(category => (
              <button
                key={category.id}
                onClick={() => setActiveCategory(category.id)}
                className={`flex-shrink-0 flex items-center px-4 py-2 rounded-full text-sm whitespace-nowrap ${
                  activeCategory === category.id
                    ? `bg-gradient-to-r ${category.gradient} text-white shadow-md`
                    : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
                }`}
              >
                <span className="mr-2">{category.icon}</span>
                <span>{category.label}</span>
              </button>
            ))}
          </div>
          
          <div className="lg:grid lg:grid-cols-4 lg:gap-8">
            {/* Sidebar */}
            <FilterSidebar />
            
            {/* Main content */}
            <div className="lg:col-span-3">
              {/* Desktop view mode selector */}
              <div className="hidden lg:flex justify-between items-center mb-6 bg-white rounded-xl shadow-sm p-3">
                <div className="font-medium text-gray-800 flex items-center">
                  <FiEye className="mr-2 text-primary-600" />
                  View Mode
                </div>
                
                <div className="flex items-center bg-gray-100 rounded-lg p-1">
                  {VIEW_MODES.map(mode => (
                    <button
                      key={mode.id}
                      onClick={() => setViewMode(mode.id)}
                      className={`flex items-center px-3 py-1.5 rounded-lg text-sm ${
                        viewMode === mode.id
                          ? 'bg-white text-primary-700 shadow-sm'
                          : 'text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      <span className="mr-2">{mode.icon}</span>
                      <span>{mode.label}</span>
                    </button>
                  ))}
                </div>
                
                <div className="text-sm text-gray-500 flex items-center">
                  <span className="mr-2">Showing {filteredPlaces.length} destinations</span>
                  <button
                    onClick={() => {
                      setCurrentPage(1);
                      setFilteredPlaces([...places]);
                    }}
                    className="p-1 hover:text-primary-600"
                    title="Refresh results"
                  >
                    <FiRefreshCw className="h-4 w-4" />
                  </button>
                </div>
              </div>
              
              {/* Main content area */}
              {renderContent()}
              
              {/* Load more button */}
              {viewMode !== 'map' && filteredPlaces.length > visiblePlaces.length && (
                <div className="mt-8 flex justify-center">
                  <button
                    onClick={loadMore}
                    className="px-6 py-3 bg-white text-primary-700 border border-primary-300 rounded-lg shadow-sm hover:bg-primary-50 flex items-center font-medium"
                  >
                    <FiPlusCircle className="mr-2 h-5 w-5" />
                    Load More Destinations
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Footer with updated timestamp */}
        <footer className="bg-white border-t border-gray-200 py-8 mt-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col md:flex-row justify-between items-center">
              <div className="flex items-center mb-4 md:mb-0">
                <img src="/images/logo.png" alt="EasyTrip Logo" className="h-8 w-auto mr-3" />
                <div>
                  <p className="text-gray-900 font-semibold">EasyTrip</p>
                  <p className="text-gray-500 text-sm">Explore the world with us</p>
                </div>
              </div>
              
              <div className="text-gray-500 text-sm">
                <p>© 2025 EasyTrip. All rights reserved.</p>
                <p className="flex items-center justify-center md:justify-end mt-1">
                  <FiClock className="mr-1" />
                  Last updated: 2025-09-05 22:36:22 UTC
                </p>
              </div>
            </div>
            
            {isAuthenticated && (
              <div className="mt-6 pt-6 border-t border-gray-200 flex items-center justify-center text-sm text-gray-500">
                <FiUser className="mr-1" />
                <span>Logged in as </span>
                <span className="font-medium text-gray-800 ml-1">{currentUserLogin}</span>
              </div>
            )}
          </div>
        </footer>
      </div>
      
      {/* Overlay for mobile filters */}
      {isSidebarOpen && isMobile && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-20"
          onClick={toggleSidebar}
        ></div>
      )}
      
      {/* Toast notification container */}
      <div id="toast-container" className="fixed bottom-4 right-4 z-50"></div>
      
      {/* Global styles */}
      <style jsx global>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        
        /* Custom scrollbar for sidebar */
        .sidebar-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .sidebar-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .sidebar-scrollbar::-webkit-scrollbar-thumb {
          background: #d1d5db;
          border-radius: 20px;
        }
        
        /* Text shadow utility */
        .text-shadow {
          text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }
        .text-shadow-lg {
          text-shadow: 0 4px 8px rgba(0, 0, 0, 0.12);
        }
        
        /* Animation for skeleton loading */
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }
        .animate-pulse {
          animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
      `}</style>
    </>
  );
}

export default ExploreDestinations;