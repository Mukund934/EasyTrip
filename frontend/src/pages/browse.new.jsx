import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/router';
import { useInView } from 'react-intersection-observer';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import {
  FiFilter, FiMap, FiMapPin, FiStar, FiTag, FiList, FiGrid,
  FiArrowRight, FiX, FiSearch, FiSliders, FiChevronDown,
  FiChevronUp, FiCalendar, FiCheck, FiInfo, FiHome,
  FiRefreshCw, FiClock, FiTarget, FiLayers, FiFlag,
  FiSun, FiCloud, FiCloudRain, FiHeart, FiBook, FiCompass,
  FiCpu, FiTriangle, FiMonitor, FiUmbrella, FiUsers,
  FiZap, FiEye, FiAward, FiMessageCircle, FiShare2,
  FiUser, FiAlertCircle, FiLoader, FiMaximize2, FiMinimize2,
  FiCamera, FiFeather, FiGlobe, FiNavigation, FiActivity
} from 'react-icons/fi';
import PlaceCard from '../components/PlaceCard';
import { getAllPlaces, searchPlaces, getLocations, getDistricts, getStates, getTags } from '../services/placeService';
import { useAuth } from '../context/AuthContext';
import debounce from 'lodash/debounce';
import LoadingSpinner from '../components/LoadingSpinner';

// Dynamically import the map component
const ExploreMap = dynamic(() => import('../components/ExploreMap'), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full bg-gray-100 animate-pulse flex items-center justify-center">
      <div className="text-center">
        <FiLoader className="h-8 w-8 text-gray-400 animate-spin mx-auto mb-2" />
        <p className="text-gray-400">Loading Map...</p>
      </div>
    </div>
  )
});

// Enhanced theme options with better styling
const themeOptions = [
  { id: 'hot', label: 'Hot Weather', icon: <FiSun />, color: 'orange', bgColor: 'bg-orange-500' },
  { id: 'cold', label: 'Cold Weather', icon: <FiCloud />, color: 'blue', bgColor: 'bg-blue-500' },
  { id: 'rainy', label: 'Rainy Season', icon: <FiCloudRain />, color: 'indigo', bgColor: 'bg-indigo-500' },
  { id: 'romantic', label: 'Romantic', icon: <FiHeart />, color: 'pink', bgColor: 'bg-pink-500' },
  { id: 'religious', label: 'Religious', icon: <FiBook />, color: 'purple', bgColor: 'bg-purple-500' },
  { id: 'historical', label: 'Historical', icon: <FiClock />, color: 'amber', bgColor: 'bg-amber-600' },
  { id: 'science', label: 'Science', icon: <FiCpu />, color: 'cyan', bgColor: 'bg-cyan-500' },
  { id: 'tech', label: 'Technology', icon: <FiMonitor />, color: 'slate', bgColor: 'bg-slate-500' },
  { id: 'adventure', label: 'Adventure', icon: <FiCompass />, color: 'green', bgColor: 'bg-green-500' },
  { id: 'nature', label: 'Nature', icon: <FiGlobe />, color: 'emerald', bgColor: 'bg-emerald-500' },
  { id: 'beach', label: 'Beach', icon: <FiUmbrella />, color: 'sky', bgColor: 'bg-sky-500' },
  { id: 'mountain', label: 'Mountain', icon: <FiTriangle />, color: 'stone', bgColor: 'bg-stone-600' },
  { id: 'family', label: 'Family-Friendly', icon: <FiUsers />, color: 'teal', bgColor: 'bg-teal-500' }
];

// Enhanced date options with icons
const dateOptions = [
  { id: 'any', label: 'Anytime', icon: <FiCalendar />, color: 'gray' },
  { id: 'summer', label: 'Summer (Apr-Jun)', icon: <FiSun />, color: 'yellow' },
  { id: 'monsoon', label: 'Monsoon (Jul-Sep)', icon: <FiCloudRain />, color: 'blue' },
  { id: 'winter', label: 'Winter (Oct-Mar)', icon: <FiCloud />, color: 'cyan' }
];

// View modes with enhanced options
const viewModes = [
  { id: 'grid', label: 'Grid', icon: <FiGrid />, description: 'Card view' },
  { id: 'list', label: 'List', icon: <FiList />, description: 'Detailed list' },
  { id: 'map', label: 'Map', icon: <FiMap />, description: 'Interactive map' }
];

// Sort options
const sortOptions = [
  { id: 'newest', label: 'Newest First', icon: <FiClock /> },
  { id: 'rating', label: 'Highest Rated', icon: <FiStar /> },
  { id: 'name', label: 'Alphabetical', icon: <FiInfo /> },
  { id: 'popular', label: 'Most Popular', icon: <FiActivity /> }
];

// Animation variants
const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } }
};

const staggerChildren = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.1
    }
  }
};

// Enhanced filter section component with animations
const FilterSection = ({ title, icon, collapsed, onToggle, children }) => {
  const [isClientSide, setIsClientSide] = useState(false);
  
  useEffect(() => {
    setIsClientSide(true);
  }, []);

  return (
    <div className="border-b border-gray-200 py-4">
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between text-base font-medium text-gray-900 group"
        aria-expanded={!collapsed}
      >
        <div className="flex items-center">
          {icon && <span className="mr-2 group-hover:text-blue-600 transition-colors">{icon}</span>}
          <span className="group-hover:text-blue-600 transition-colors">{title}</span>
        </div>
        {isClientSide ? (
          <motion.div
            className="bg-gray-100 group-hover:bg-blue-100 rounded-full p-1 transition-colors"
            whileTap={{ scale: 0.95 }}
          >
            <motion.div
              initial={false}
              animate={{ rotate: collapsed ? 0 : 180 }}
              transition={{ duration: 0.3, type: 'spring' }}
            >
              <FiChevronDown className="h-4 w-4 group-hover:text-blue-600 transition-colors" />
            </motion.div>
          </motion.div>
        ) : (
          <div className="bg-gray-100 rounded-full p-1">
            <FiChevronDown className="h-4 w-4 text-gray-600" />
          </div>
        )}
      </button>

      {isClientSide ? (
        <AnimatePresence initial={false}>
          {!collapsed && (
            <motion.div
              initial={{ height: 0, opacity: 0, overflow: 'hidden' }}
              animate={{
                height: 'auto',
                opacity: 1,
                transition: { duration: 0.3, ease: [0.33, 1, 0.68, 1] }
              }}
              exit={{
                height: 0,
                opacity: 0,
                transition: { duration: 0.2, ease: [0.33, 1, 0.68, 1] }
              }}
              className="overflow-hidden"
            >
              <div className="mt-4">
                {children}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      ) : (
        !collapsed && (
          <div className="mt-4">
            {children}
          </div>
        )
      )}
    </div>
  );
};

// Enhanced Image component for list view
const EnhancedImage = ({ place, priority = false }) => {
  const [status, setStatus] = useState('loading');
  const fallbackImage = '/images/placeholder.jpg';
  const [isClientSide, setIsClientSide] = useState(false);
  
  useEffect(() => {
    setIsClientSide(true);
  }, []);

  // Get proper image URL with cache busting in development
  const getImageUrl = () => {
    const cacheBuster = process.env.NODE_ENV === 'development' ? `?t=${Date.now()}` : '';

    if (place.primary_image_url) return `${place.primary_image_url}${cacheBuster}`;
    if (place.image_url) return `${place.image_url}${cacheBuster}`;

    return `/api/places/${place.id}/image${cacheBuster}`;
  };

  return (
    <div className="w-full h-full relative">
      {/* Loading state */}
      {isClientSide && status === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 animate-pulse">
          <FiLoader className="h-8 w-8 text-gray-400 animate-spin" />
        </div>
      )}

      {/* Actual image */}
      <img
        src={getImageUrl()}
        alt={place.name}
        className={`w-full h-full object-cover transition-opacity duration-500 ${status === 'loaded' ? 'opacity-100' : 'opacity-0'}`}
        onLoad={() => setStatus('loaded')}
        onError={() => {
          console.log(`Image failed to load for ${place.name} (ID: ${place.id})`);
          setStatus('error');
        }}
        loading={priority ? 'eager' : 'lazy'}
      />

      {/* Error fallback */}
      {isClientSide && status === 'error' && (
        <img
          src={fallbackImage}
          alt="Placeholder"
          className="w-full h-full object-cover"
          loading="lazy"
        />
      )}
    </div>
  );
};

function Browse() {
  const router = useRouter();
  const { q, location, district, state, theme, tag, date, rating } = router.query;
  const { currentUser } = useAuth();
  const scrollPosition = useRef(0);
  const [isClient, setIsClient] = useState(false);
  
  // Use client-side only rendering to fix hydration issues
  useEffect(() => {
    setIsClient(true);
  }, []);
  
  // Preserve scroll position between renders
  useEffect(() => {
    window.scrollTo(0, scrollPosition.current);

    const handleScroll = () => {
      scrollPosition.current = window.scrollY;
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // State management
  const [places, setPlaces] = useState([]);
  const [displayedPlaces, setDisplayedPlaces] = useState([]);
  const [filteredPlaces, setFilteredPlaces] = useState([]);
  const [placesPerPage, setPlacesPerPage] = useState(12);
  const [currentPage, setCurrentPage] = useState(1);

  // Filter data
  const [locations, setLocations] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [states, setStates] = useState([]);
  const [tags, setTags] = useState([]);

  // UI state
  const [loading, setLoading] = useState(true);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [viewMode, setViewMode] = useState('grid'); // 'grid', 'list', or 'map'
  const [sortOrder, setSortOrder] = useState('newest');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [searchActive, setSearchActive] = useState(false);
  const [mapFullscreen, setMapFullscreen] = useState(false);
  const searchInputRef = useRef(null);

  // Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [selectedState, setSelectedState] = useState('');
  const [selectedTags, setSelectedTags] = useState([]);
  const [selectedThemes, setSelectedThemes] = useState([]);
  const [selectedDate, setSelectedDate] = useState('any');
  const [ratingFilter, setRatingFilter] = useState(0);
  const [recentSearches, setRecentSearches] = useState([]);
  const [collapsedSections, setCollapsedSections] = useState({
    themes: false,
    location: false,
    rating: false,
    date: false,
    tags: false
  });

  // Stats for enhanced UI
  const [stats, setStats] = useState({
    totalPlaces: 0,
    avgRating: 0,
    topLocation: '',
    locationCount: 0
  });

  // Infinite scroll
  const { ref: loadMoreRef, inView } = useInView({
    threshold: 0.1,
    triggerOnce: false,
    rootMargin: '400px 0px'
  });

  // Check if we're on a mobile device
  const isMobile = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < 768;
  }, []);

  // Detect screen size changes
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 640) {
        setPlacesPerPage(6);
      } else if (window.innerWidth < 1024) {
        setPlacesPerPage(8);
      } else {
        setPlacesPerPage(12);
      }

      if (window.innerWidth < 640 && viewMode === 'list') {
        setViewMode('grid');
      }
    };

    window.addEventListener('resize', handleResize);
    handleResize();

    return () => window.removeEventListener('resize', handleResize);
  }, [viewMode]);

  // Load data and apply URL filters on initial load with better error handling
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setInitialLoading(true);

        // Show loading spinner for at least 800ms for better UX
        const startTime = Date.now();

        // Fetch places first since it's critical
        let placesData;
        try {
          placesData = await getAllPlaces();

          // Calculate stats
          if (placesData.length > 0) {
            // Average rating
            const avgRating = placesData.reduce((acc, place) => {
              const rating = place.rating_count > 0 ? place.rating_sum / place.rating_count : 0;
              return acc + rating;
            }, 0) / placesData.length;

            // Most common location
            const locationCounts = {};
            placesData.forEach(place => {
              locationCounts[place.location] = (locationCounts[place.location] || 0) + 1;
            });

            const topLocation = Object.entries(locationCounts)
              .sort((a, b) => b[1] - a[1])[0] || ['', 0];

            setStats({
              totalPlaces: placesData.length,
              avgRating: avgRating.toFixed(1),
              topLocation: topLocation[0],
              locationCount: topLocation[1]
            });
          }

        } catch (error) {
          console.error('Failed to load places:', error);
          setError('Failed to load places. Please try again.');

          // Ensure minimum loading time for UX
          const elapsed = Date.now() - startTime;
          if (elapsed < 800) {
            await new Promise(resolve => setTimeout(resolve, 800 - elapsed));
          }

          setLoading(false);
          setInitialLoading(false);
          return; // Exit early if places can't be loaded
        }

        // Fetch the rest in parallel with individual error handling
        const [locationsData, districtsData, statesData, tagsData] = await Promise.all([
          getLocations().catch(err => {
            console.warn('Failed to load locations:', err);
            return [];
          }),
          getDistricts().catch(err => {
            console.warn('Failed to load districts:', err);
            return [];
          }),
          getStates().catch(err => {
            console.warn('Failed to load states:', err);
            return [];
          }),
          getTags().catch(err => {
            console.warn('Failed to load tags:', err);
            return [];
          })
        ]);

        // Update state with fetched data
        setPlaces(placesData);
        setLocations(locationsData);
        setDistricts(districtsData);
        setStates(statesData);
        setTags(tagsData);

        // Apply URL filters if any
        if (q) setSearchTerm(q);
        if (location) setSelectedLocation(location);
        if (district) setSelectedDistrict(district);
        if (state) setSelectedState(state);
        if (rating) setRatingFilter(parseInt(rating) || 0);
        if (date) setSelectedDate(date);

        // Handle arrays
        if (theme) {
          const themes = Array.isArray(theme) ? theme : [theme];
          setSelectedThemes(themes);
        }

        if (tag) {
          const tagArray = Array.isArray(tag) ? tag : [tag];
          setSelectedTags(tagArray);
        }

        // Load recent searches from localStorage
        if (typeof window !== 'undefined') {
          const savedSearches = localStorage.getItem('recentSearches');
          if (savedSearches) {
            try {
              setRecentSearches(JSON.parse(savedSearches).slice(0, 5));
            } catch (e) {
              console.warn('Failed to parse recent searches:', e);
            }
          }
        }

        // Ensure minimum loading time for UX
        const elapsed = Date.now() - startTime;
        if (elapsed < 800) {
          await new Promise(resolve => setTimeout(resolve, 800 - elapsed));
        }

      } catch (err) {
        console.error('Error in data fetching process:', err);
        setError('Failed to load data. Please try again.');
      } finally {
        setLoading(false);
        setInitialLoading(false);
      }
    };

    fetchData();
  }, [q, location, district, state, theme, tag, date, rating]);

  // Debounced search handler
  const debouncedSearch = useCallback(
    debounce((term) => {
      setSearchTerm(term);
      // Save search term to recent searches
      if (term && term.trim() !== '') {
        setRecentSearches(prev => {
          const updated = [term, ...prev.filter(s => s !== term)].slice(0, 5);
          if (typeof window !== 'undefined') {
            localStorage.setItem('recentSearches', JSON.stringify(updated));
          }
          return updated;
        });
      }
    }, 300),
    []
  );

  // Apply filters whenever they change
  useEffect(() => {
    const applyFilters = async () => {
      // Skip if we don't have places yet
      if (places.length === 0) return;

      // Show a loading indicator for filter changes
      if (!initialLoading) setLoading(true);

      try {
        // If we have active filters, perform filtering
        if (hasActiveFilters()) {
          // Prepare search criteria
          const criteria = {
            searchTerm: searchTerm,
            location: selectedLocation,
            district: selectedDistrict,
            state: selectedState,
            themes: selectedThemes,
            tags: selectedTags,
            date: selectedDate !== 'any' ? selectedDate : null,
            minRating: ratingFilter
          };

          // Update URL with filters (without triggering navigation)
          updateUrlWithFilters();

          // Try server-side search first
          try {
            const results = await searchPlaces(criteria);
            setFilteredPlaces(results);
          } catch (searchError) {
            console.error('Server search failed, falling back to client filtering:', searchError);

            // Fallback to client-side filtering with optimized performance
            let results = clientSideFilter();
            setFilteredPlaces(results);
          }
        } else {
          // Clear URL and show all places
          window.history.replaceState({}, '', window.location.pathname);
          setFilteredPlaces(places);
        }

        // Reset pagination
        setCurrentPage(1);
      } catch (err) {
        console.error('Error applying filters:', err);
        setFilteredPlaces(places);
      } finally {
        // Short delay to prevent flickering
        setTimeout(() => setLoading(false), 300);
      }
    };

    // Client-side filtering implementation
    const clientSideFilter = () => {
      let results = [...places];

      // Apply search term filter
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        results = results.filter(place =>
          place.name.toLowerCase().includes(term) ||
          (place.description && place.description.toLowerCase().includes(term))
        );
      }

      // Apply location filters
      if (selectedLocation) {
        results = results.filter(place =>
          place.location.toLowerCase() === selectedLocation.toLowerCase()
        );
      }

      if (selectedDistrict) {
        results = results.filter(place =>
          place.district && place.district.toLowerCase() === selectedDistrict.toLowerCase()
        );
      }

      if (selectedState) {
        results = results.filter(place =>
          place.state && place.state.toLowerCase() === selectedState.toLowerCase()
        );
      }

      // Apply theme filter
      if (selectedThemes.length > 0) {
        results = results.filter(place =>
          place.themes && selectedThemes.some(theme => place.themes.includes(theme))
        );
      }

      // Apply tag filter
      if (selectedTags.length > 0) {
        results = results.filter(place =>
          place.tags && selectedTags.some(tag => place.tags.includes(tag))
        );
      }

      // Apply date filter
      if (selectedDate !== 'any') {
        // Check if the place has best time to visit in its custom_keys
        results = results.filter(place => {
          if (!place.custom_keys || !place.custom_keys['Best Time to Visit']) return true;

          const bestTime = place.custom_keys['Best Time to Visit'].toLowerCase();

          switch (selectedDate) {
            case 'summer':
              return bestTime.includes('april') || bestTime.includes('may') || bestTime.includes('june');
            case 'monsoon':
              return bestTime.includes('july') || bestTime.includes('august') || bestTime.includes('september');
            case 'winter':
              return bestTime.includes('october') || bestTime.includes('november') ||
                bestTime.includes('december') || bestTime.includes('january') ||
                bestTime.includes('february') || bestTime.includes('march');
            default:
              return true;
          }
        });
      }

      // Apply rating filter
      if (ratingFilter > 0) {
        results = results.filter(place => {
          const avgRating = place.rating_count > 0
            ? place.rating_sum / place.rating_count
            : 0;
          return avgRating >= ratingFilter;
        });
      }

      return results;
    };

    // Update URL with current filter state
    const updateUrlWithFilters = () => {
      const queryParams = new URLSearchParams();
      if (searchTerm) queryParams.set('q', searchTerm);
      if (selectedLocation) queryParams.set('location', selectedLocation);
      if (selectedDistrict) queryParams.set('district', selectedDistrict);
      if (selectedState) queryParams.set('state', selectedState);
      if (selectedDate !== 'any') queryParams.set('date', selectedDate);
      if (ratingFilter > 0) queryParams.set('rating', ratingFilter.toString());

      // Add arrays
      selectedThemes.forEach(theme => queryParams.append('theme', theme));
      selectedTags.forEach(tag => queryParams.append('tag', tag));

      // Update the URL without triggering a navigation
      const url = `${window.location.pathname}?${queryParams.toString()}`;
      window.history.replaceState({}, '', url);
    };

    // Execute filter logic
    const timeoutId = setTimeout(() => {
      applyFilters();
    }, 100); // Small delay to batch filter changes

    return () => clearTimeout(timeoutId);
  }, [
    places,
    searchTerm,
    selectedLocation,
    selectedDistrict,
    selectedState,
    selectedThemes,
    selectedTags,
    selectedDate,
    ratingFilter,
    initialLoading
  ]);

  // Apply sorting with optimized performance
  useEffect(() => {
    if (filteredPlaces.length === 0) return;

    // Create a new array to avoid modifying the original
    const sortedPlaces = [...filteredPlaces];

    // Sort in-place for better performance
    switch (sortOrder) {
      case 'newest':
        sortedPlaces.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        break;
      case 'rating':
        sortedPlaces.sort((a, b) => {
          const ratingA = a.rating_count > 0 ? a.rating_sum / a.rating_count : 0;
          const ratingB = b.rating_count > 0 ? b.rating_sum / b.rating_count : 0;
          return ratingB - ratingA;
        });
        break;
      case 'name':
        sortedPlaces.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'popular':
        sortedPlaces.sort((a, b) => (b.views || 0) - (a.views || 0));
        break;
    }

    // This comparison avoids an infinite loop if the order is already correct.
    if (JSON.stringify(sortedPlaces) !== JSON.stringify(filteredPlaces)) {
        setFilteredPlaces(sortedPlaces);
    }
  }, [sortOrder, filteredPlaces]);

  // Update displayed places based on pagination with virtualization concepts
  useEffect(() => {
    const start = 0;
    const end = currentPage * placesPerPage;

    // Only render what's needed for current view
    setDisplayedPlaces(filteredPlaces.slice(start, end));
  }, [filteredPlaces, currentPage, placesPerPage]);

  // Infinite scroll loading with improved UX
  useEffect(() => {
    if (inView && !loadingMore && displayedPlaces.length < filteredPlaces.length) {
      setLoadingMore(true);

      // Simulate loading delay with smooth transition
      const timer = setTimeout(() => {
        setCurrentPage(prev => prev + 1);
        setLoadingMore(false);
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [inView, loadingMore, displayedPlaces.length, filteredPlaces.length]);

  // Handle theme toggle with animation feedback
  const handleThemeToggle = (themeId) => {
    if (selectedThemes.includes(themeId)) {
      setSelectedThemes(selectedThemes.filter(id => id !== themeId));
    } else {
      setSelectedThemes([...selectedThemes, themeId]);
    }
  };

  // Handle tag toggle with animation feedback
  const handleTagToggle = (tag) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter(t => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  // Handle section toggle with animation
  const toggleSection = (section) => {
    setCollapsedSections({
      ...collapsedSections,
      [section]: !collapsedSections[section]
    });
  };

  // Clear all filters with animation
  const clearAllFilters = () => {
    // Animate the reset by applying a temporary class
    document.getElementById('filter-panel')?.classList.add('flash-highlight');
    setTimeout(() => {
      document.getElementById('filter-panel')?.classList.remove('flash-highlight');
    }, 500);

    setSearchTerm('');
    setSelectedLocation('');
    setSelectedDistrict('');
    setSelectedState('');
    setSelectedThemes([]);
    setSelectedTags([]);
    setSelectedDate('any');
    setRatingFilter(0);
    window.history.replaceState({}, '', window.location.pathname);
  };

  // Handle refresh with animation
  const handleRefresh = async () => {
    try {
      setLoading(true);

      // Add a small delay to show the loading animation
      await new Promise(resolve => setTimeout(resolve, 400));

      const placesData = await getAllPlaces();
      setPlaces(placesData);

      if (!hasActiveFilters()) {
        setFilteredPlaces(placesData);
      }
    } catch (error) {
      console.error('Error refreshing places:', error);
    } finally {
      setLoading(false);
    }
  };

  // Check if any filters are active
  const hasActiveFilters = () => {
    return searchTerm ||
      selectedLocation ||
      selectedDistrict ||
      selectedState ||
      selectedThemes.length > 0 ||
      selectedTags.length > 0 ||
      selectedDate !== 'any' ||
      ratingFilter > 0;
  };

  // Count active filters for badge
  const activeFilterCount = useMemo(() => {
    return (searchTerm ? 1 : 0) +
      (selectedLocation ? 1 : 0) +
      (selectedDistrict ? 1 : 0) +
      (selectedState ? 1 : 0) +
      selectedThemes.length +
      selectedTags.length +
      (selectedDate !== 'any' ? 1 : 0) +
      (ratingFilter > 0 ? 1 : 0);
  }, [
    searchTerm,
    selectedLocation,
    selectedDistrict,
    selectedState,
    selectedThemes,
    selectedTags,
    selectedDate,
    ratingFilter
  ]);

  // Handle search input focus
  const handleSearchFocus = () => {
    setSearchActive(true);
    // Focus the input
    searchInputRef.current?.focus();
  };

  // Use a search suggestion from history
  const useSearchSuggestion = (term) => {
    setSearchTerm(term);
    setSearchActive(false);

    // Move this term to the top of recent searches
    const updatedSearches = [
      term,
      ...recentSearches.filter(s => s !== term)
    ].slice(0, 5);

    setRecentSearches(updatedSearches);
    localStorage.setItem('recentSearches', JSON.stringify(updatedSearches));
  };

  // Clear a specific search term from history
  const clearSearchTerm = (term, e) => {
    e.stopPropagation();
    const updatedSearches = recentSearches.filter(s => s !== term);
    setRecentSearches(updatedSearches);
    localStorage.setItem('recentSearches', JSON.stringify(updatedSearches));
  };

  // Clear all search history
  const clearAllSearchHistory = (e) => {
    e.stopPropagation();
    setRecentSearches([]);
    localStorage.removeItem('recentSearches');
  };

  return (
    <>
      <Head>
        <title>Explore Amazing Places - EasyTrip</title>
        <meta name="description" content="Discover breathtaking destinations for your next adventure. Filter and find the perfect place for your trip." />
        <meta name="keywords" content="travel, destinations, places to visit, tourist spots, vacation, trip planning" />
        <meta property="og:title" content="Explore Amazing Places - EasyTrip" />
        <meta property="og:description" content="Discover breathtaking destinations for your next adventure" />
        <meta property="og:type" content="website" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="dns-prefetch" href="https://fonts.googleapis.com" />
      </Head>

      {!isClient ? (
        // Initial loading state - shown during SSR to prevent hydration mismatch
        <div className="bg-gray-50 min-h-screen pt-20 flex items-center justify-center">
          <div className="text-center">
            <LoadingSpinner size="large" color="primary" />
            <p className="mt-4 text-gray-600">Loading amazing destinations...</p>
          </div>
        </div>
      ) : (
        <div className="bg-gray-50 min-h-screen pt-20">
          {/* Your existing JSX content here, but with isClient checks for any animations */}
        </div>
      )}
    </>
  );
}

export default Browse;
