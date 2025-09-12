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

function Browse() {
  const router = useRouter();
  const { q, location, district, state, theme, tag, date, rating } = router.query;
  const { currentUser } = useAuth();
  const scrollPosition = useRef(0);
  
  // Fix for hydration error - using isClient to ensure components are only rendered on client-side
  const [isClient, setIsClient] = useState(false);
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

      <div className="bg-gray-50 min-h-screen pt-20">
        {/* Enhanced Hero Banner with better contrast and readability */}
        <div className="relative overflow-hidden">
          {/* Background Image with Overlay */}
          <div
            className="absolute inset-0 bg-cover bg-center bg-no-repeat"
            style={{
              backgroundImage: "url('/images/hero-bg.jpg')",
            }}
          />
          {/* Dark Overlay for better text readability */}
          <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/50 to-black/70" />
          {/* Pattern Overlay */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute inset-0" style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Ccircle cx='30' cy='30' r='2'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            }} />
          </div>

          <div className="relative z-10 py-16 sm:py-20 md:py-24">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8 }}
                className="text-center max-w-4xl mx-auto"
              >
                <h1 className="text-4xl font-extrabold text-white sm:text-5xl md:text-6xl lg:text-7xl">
                  <span className="block">Discover</span>
                  <span className="block bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
                    Amazing Places
                  </span>
                </h1>

                <p className="mt-6 text-xl sm:text-2xl text-gray-200 max-w-3xl mx-auto leading-relaxed">
                  Explore breathtaking destinations, hidden gems, and unforgettable experiences from around the world
                </p>

                {/* Enhanced Search bar in hero */}
                <div className="mt-10 max-w-2xl mx-auto">
                  <div className="relative">
                    <div className="relative bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl border border-white/20">
                      <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => debouncedSearch(e.target.value)}
                        onFocus={handleSearchFocus}
                        onBlur={() => setTimeout(() => setSearchActive(false), 200)}
                        ref={searchInputRef}
                        placeholder="Search destinations, activities, or places..."
                        className="block w-full bg-transparent pl-16 pr-6 py-5 text-lg text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-4 focus:ring-blue-500/20 rounded-2xl"
                      />
                      <div className="absolute inset-y-0 left-0 pl-6 flex items-center pointer-events-none">
                        <FiSearch className="h-6 w-6 text-blue-600" />
                      </div>
                      {searchTerm && (
                        <button
                          onClick={() => setSearchTerm('')}
                          className="absolute inset-y-0 right-0 pr-6 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
                        >
                          <FiX className="h-6 w-6" />
                        </button>
                      )}
                    </div>

                    {/* Search suggestions dropdown */}
                    <AnimatePresence>
                      {searchActive && recentSearches.length > 0 && (
                        <motion.div
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="absolute z-20 mt-3 w-full bg-white/95 backdrop-blur-sm rounded-xl shadow-xl border border-white/20 py-2"
                        >
                          <div className="px-4 py-2 border-b border-gray-200">
                            <div className="flex justify-between items-center">
                              <h3 className="text-sm font-medium text-gray-700">Recent Searches</h3>
                              <button
                                onClick={clearAllSearchHistory}
                                className="text-sm text-blue-600 hover:text-blue-800 transition-colors"
                              >
                                Clear All
                              </button>
                            </div>
                          </div>
                          <ul className="max-h-48 overflow-y-auto">
                            {recentSearches.map((term, index) => (
                              <li key={index}>
                                <button
                                  className="flex w-full items-center px-4 py-3 hover:bg-gray-50 text-left transition-colors"
                                  onClick={() => useSearchSuggestion(term)}
                                >
                                  <FiClock className="h-4 w-4 mr-3 text-gray-400" />
                                  <span className="text-gray-700">{term}</span>
                                  <button
                                    onClick={(e) => clearSearchTerm(term, e)}
                                    className="ml-auto text-gray-400 hover:text-gray-600 p-1"
                                  >
                                    <FiX className="h-4 w-4" />
                                  </button>
                                </button>
                              </li>
                            ))}
                          </ul>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                {/* Enhanced Theme chips with better visibility */}
                  <div className="mt-8">
                    <p className="text-lg text-gray-300 mb-4">Popular themes</p>
                    <div className="flex flex-wrap justify-center gap-3">
                      {isClient && themeOptions.slice(0, isMobile ? 4 : 8).map((theme) => (
                        <motion.button
                          key={theme.id}
                          whileHover={{ scale: 1.05, y: -2 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => handleThemeToggle(theme.id)}
                          className={`group flex items-center px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                            selectedThemes.includes(theme.id)
                              ? `${theme.bgColor} text-white shadow-lg shadow-${theme.color}-500/25`
                              : 'bg-white/90 backdrop-blur-sm text-gray-700 hover:bg-white hover:shadow-lg border border-white/20'
                          }`}
                        >
                          <span className={`mr-2 transition-transform group-hover:scale-110 ${
                            selectedThemes.includes(theme.id) ? 'text-white' : `text-${theme.color}-600`
                          }`}>
                            {theme.icon}
                          </span>
                          <span>{theme.label}</span>
                          {selectedThemes.includes(theme.id) && (
                            <motion.span
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              className="ml-2"
                            >
                              <FiCheck className="h-4 w-4" />
                            </motion.span>
                          )}
                        </motion.button>
                      ))}
                    </div>
                  </div>                {/* Quick stats */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5, duration: 0.6 }}
                  className="mt-12 flex flex-wrap justify-center gap-8 text-white/80"
                >
                  <div className="text-center">
                    <div className="text-2xl sm:text-3xl font-bold text-white">{stats.totalPlaces}+</div>
                    <div className="text-sm">Amazing Places</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl sm:text-3xl font-bold text-white">{stats.avgRating}</div>
                    <div className="text-sm flex items-center justify-center">
                      <FiStar className="h-4 w-4 mr-1 text-yellow-400" />
                      Average Rating
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl sm:text-3xl font-bold text-white">{stats.locationCount}</div>
                    <div className="text-sm">Top Destinations</div>
                  </div>
                </motion.div>
              </motion.div>
            </div>
          </div>

          {/* Animated wave divider */}
          <div className="absolute bottom-0 left-0 right-0 overflow-hidden">
            <svg
              className="relative block w-full h-16 sm:h-20"
              viewBox="0 0 1200 120"
              preserveAspectRatio="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <motion.path
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 2, ease: "easeInOut" }}
                d="M0,0V46.29c47.79,22.2,103.59,32.17,158,28,70.36-5.37,136.33-33.31,206.8-37.5C438.64,32.43,512.34,53.67,583,72.05c69.27,18,138.3,24.88,209.4,13.08,36.15-6,69.85-17.84,104.45-29.34C989.49,25,1113-14.29,1200,52.47V0Z"
                fill="#f9fafb"
                opacity="1"
              />
            </svg>
          </div>
        </div>

        {/* Mobile filter dialog */}
        <AnimatePresence>
          {mobileFiltersOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 lg:hidden"
            >
              <div
                className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm"
                onClick={() => setMobileFiltersOpen(false)}
              ></div>

              <motion.div
                initial={{ x: '-100%' }}
                animate={{ x: 0 }}
                exit={{ x: '-100%' }}
                transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                className="fixed inset-y-0 left-0 z-40 w-full max-w-xs overflow-y-auto bg-white shadow-xl"
              >
                <div className="sticky top-0 z-10 bg-white p-4 flex items-center justify-between border-b border-gray-200">
                  <h2 className="text-lg font-medium text-gray-900 flex items-center">
                    <FiFilter className="mr-2 text-primary-600" />
                    Filters
                  </h2>
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setMobileFiltersOpen(false)}
                    className="bg-white rounded-full p-1 hover:bg-gray-100"
                  >
                    <FiX className="h-6 w-6 text-gray-500" />
                  </motion.button>
                </div>

                <div className="p-4 pb-24" id="filter-panel">
                  {/* Search */}
                  <div className="mb-6">
                    <label htmlFor="mobile-search" className="block text-sm font-medium text-gray-700 mb-1">
                      Search
                    </label>
                    <div className="relative">
                      <input
                        id="mobile-search"
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Search places..."
                        className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                      />
                      <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                        <FiSearch className="h-5 w-5 text-gray-400" />
                      </div>
                      {searchTerm && (
                        <button
                          onClick={() => setSearchTerm('')}
                          className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                        >
                          <FiX className="h-5 w-5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Mobile filter sections */}
                  <FilterSection
                    title="Location"
                    icon={<FiMapPin className="text-primary-600" />}
                    collapsed={collapsedSections.location}
                    onToggle={() => toggleSection('location')}
                  >
                    <motion.div
                      variants={staggerChildren}
                      initial="hidden"
                      animate="visible"
                      className="space-y-4"
                    >
                      <motion.div variants={fadeInUp}>
                        <label htmlFor="mobile-location" className="block text-sm font-medium text-gray-700 mb-1">
                          Location
                        </label>
                        <select
                          id="mobile-location"
                          value={selectedLocation}
                          onChange={(e) => setSelectedLocation(e.target.value)}
                          className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                        >
                          <option value="">All Locations</option>
                          {locations.map((loc, index) => (
                            <option key={index} value={loc}>{loc}</option>
                          ))}
                        </select>
                      </motion.div>

                      <motion.div variants={fadeInUp}>
                        <label htmlFor="mobile-district" className="block text-sm font-medium text-gray-700 mb-1">
                          District
                        </label>
                        <select
                          id="mobile-district"
                          value={selectedDistrict}
                          onChange={(e) => setSelectedDistrict(e.target.value)}
                          className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                        >
                          <option value="">All Districts</option>
                          {districts.map((district, index) => (
                            <option key={index} value={district}>{district}</option>
                          ))}
                        </select>
                      </motion.div>

                      <motion.div variants={fadeInUp}>
                        <label htmlFor="mobile-state" className="block text-sm font-medium text-gray-700 mb-1">
                          State
                        </label>
                        <select
                          id="mobile-state"
                          value={selectedState}
                          onChange={(e) => setSelectedState(e.target.value)}
                          className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                        >
                          <option value="">All States</option>
                          {states.map((state, index) => (
                            <option key={index} value={state}>{state}</option>
                          ))}
                        </select>
                      </motion.div>
                    </motion.div>
                  </FilterSection>

                  <FilterSection
                    title="Themes"
                    icon={<FiLayers className="text-primary-600" />}
                    collapsed={collapsedSections.themes}
                    onToggle={() => toggleSection('themes')}
                  >
                    <div className="grid grid-cols-2 gap-2">
                      {themeOptions.map((theme) => (
                        <motion.button
                          key={theme.id}
                          whileHover={{ scale: 1.03 }}
                          whileTap={{ scale: 0.97 }}
                          onClick={() => handleThemeToggle(theme.id)}
                          className={`flex items-center px-3 py-2 rounded-md text-sm ${selectedThemes.includes(theme.id)
                            ? 'bg-primary-100 text-primary-800 border border-primary-300'
                            : 'bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200'
                            }`}
                        >
                          <span className="mr-2">{theme.icon}</span>
                          <span className="truncate">{theme.label}</span>
                          {selectedThemes.includes(theme.id) && (
                            <motion.span
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              className="ml-auto"
                            >
                              <FiCheck className="h-4 w-4 text-primary-600" />
                            </motion.span>
                          )}
                        </motion.button>
                      ))}
                    </div>
                  </FilterSection>

                  <FilterSection
                    title="Tags"
                    icon={<FiTag className="text-primary-600" />}
                    collapsed={collapsedSections.tags}
                    onToggle={() => toggleSection('tags')}
                  >
                    <div className="flex flex-wrap gap-2">
                      {tags.slice(0, 20).map((tag, index) => (
                        <motion.button
                          key={index}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => handleTagToggle(tag)}
                          className={`text-sm px-3 py-1 rounded-full ${selectedTags.includes(tag)
                            ? 'bg-primary-100 text-primary-800 border border-primary-300'
                            : 'bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200'
                            }`}
                        >
                          {tag}
                          {selectedTags.includes(tag) && (
                            <motion.span
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              className="ml-1"
                            >
                              <FiCheck className="inline-block h-3 w-3 text-primary-600" />
                            </motion.span>
                          )}
                        </motion.button>
                      ))}
                    </div>
                  </FilterSection>

                  <FilterSection
                    title="Best Time to Visit"
                    icon={<FiCalendar className="text-primary-600" />}
                    collapsed={collapsedSections.date}
                    onToggle={() => toggleSection('date')}
                  >
                    <div className="grid grid-cols-2 gap-2">
                      {isClient && dateOptions.map((option) => (
                        <motion.button
                          key={option.id}
                          whileHover={{ scale: 1.03 }}
                          whileTap={{ scale: 0.97 }}
                          onClick={() => setSelectedDate(option.id)}
                          className={`py-2 px-3 rounded-md text-sm flex items-center ${selectedDate === option.id
                            ? 'bg-primary-100 text-primary-800 border border-primary-300'
                            : 'bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200'
                            }`}
                        >
                          <span className="mr-2">{option.icon}</span>
                          <span>{option.label}</span>
                          {selectedDate === option.id && (
                            <motion.span
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              className="ml-auto"
                            >
                              <FiCheck className="h-4 w-4 text-primary-600" />
                            </motion.span>
                          )}
                        </motion.button>
                      ))}
                    </div>
                  </FilterSection>

                  <FilterSection
                    title="Rating"
                    icon={<FiStar className="text-primary-600" />}
                    collapsed={collapsedSections.rating}
                    onToggle={() => toggleSection('rating')}
                  >
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Minimum Rating
                      </label>
                      <div className="flex items-center justify-between space-x-2">
                        {[0, 1, 2, 3, 4, 5].map((rating) => (
                          <motion.button
                            key={rating}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => setRatingFilter(rating)}
                            className={`flex-1 py-2 flex items-center justify-center rounded-md ${ratingFilter === rating
                              ? 'bg-primary-600 text-white'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                              }`}
                          >
                            {rating === 0 ? (
                              <span>Any</span>
                            ) : (
                              <div className="flex items-center">
                                {rating}
                                <FiStar className={`ml-1 h-3 w-3 ${ratingFilter === rating ? 'text-yellow-300' : ''}`} />
                              </div>
                            )}
                          </motion.button>
                        ))}
                      </div>
                    </div>
                  </FilterSection>

                  <div className="sticky bottom-0 bg-white p-4 border-t border-gray-200 mt-6">
                    <div className="flex space-x-3">
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={clearAllFilters}
                        className="flex-1 py-2 px-4 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none"
                      >
                        Clear All
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setMobileFiltersOpen(false)}
                        className="flex-1 bg-primary-600 py-2 px-4 border border-transparent rounded-md text-sm font-medium text-white hover:bg-primary-700 focus:outline-none"
                      >
                        Apply Filters
                      </motion.button>
                    </div>

                    <div className="mt-3 text-xs text-center text-gray-500">
                      {filteredPlaces.length} {filteredPlaces.length === 1 ? 'place' : 'places'} found
                    </div>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Filter bar for mobile */}
          <div className="md:hidden bg-white shadow rounded-lg mb-6">
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center space-x-2">
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  type="button"
                  className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none"
                  onClick={() => setMobileFiltersOpen(true)}
                >
                  <FiFilter className="mr-2 h-5 w-5 text-primary-600" />
                  Filters
                  {activeFilterCount > 0 && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="ml-1 bg-primary-100 text-primary-800 rounded-full w-5 h-5 flex items-center justify-center text-xs"
                    >
                      {activeFilterCount}
                    </motion.span>
                  )}
                </motion.button>

                <div className="relative">
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    type="button"
                    className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none"
                    onClick={() => setShowSortMenu(!showSortMenu)}
                  >
                    <FiSliders className="mr-2 h-5 w-5 text-primary-600" />
                    Sort
                  </motion.button>

                  <AnimatePresence>
                    {showSortMenu && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="absolute right-0 mt-2 w-48 bg-white shadow-lg rounded-md py-1 z-10"
                      >
                        <button
                          onClick={() => {
                            setSortOrder('newest');
                            setShowSortMenu(false);
                          }}
                          className={`block px-4 py-2 text-sm w-full text-left ${sortOrder === 'newest' ? 'bg-primary-50 text-primary-700' : 'text-gray-700'}`}
                        >
                          Newest First
                        </button>
                        <button
                          onClick={() => {
                            setSortOrder('rating');
                            setShowSortMenu(false);
                          }}
                          className={`block px-4 py-2 text-sm w-full text-left ${sortOrder === 'rating' ? 'bg-primary-50 text-primary-700' : 'text-gray-700'}`}
                        >
                          Highest Rated
                        </button>
                        <button
                          onClick={() => {
                            setSortOrder('name');
                            setShowSortMenu(false);
                          }}
                          className={`block px-4 py-2 text-sm w-full text-left ${sortOrder === 'name' ? 'bg-primary-50 text-primary-700' : 'text-gray-700'}`}
                        >
                          Alphabetical
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setViewMode('grid')}
                  className={`p-2 rounded ${viewMode === 'grid'
                    ? 'bg-primary-100 text-primary-700'
                    : 'bg-gray-100 text-gray-500'
                    }`}
                  aria-label="Grid view"
                >
                  <FiGrid className="h-5 w-5" />
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setViewMode('list')}
                  className={`p-2 rounded ${viewMode === 'list'
                    ? 'bg-primary-100 text-primary-700'
                    : 'bg-gray-100 text-gray-500'
                    }`}
                  aria-label="List view"
                >
                  <FiList className="h-5 w-5" />
                </motion.button>
              </div>
            </div>

            {/* Search bar for mobile */}
            <div className="px-4 pb-4">
              <div className="relative">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => debouncedSearch(e.target.value)}
                  placeholder="Search places..."
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                />
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                  <FiSearch className="h-5 w-5 text-gray-400" />
                </div>
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                  >
                    <FiX className="h-5 w-5" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Active filters with enhanced animations */}
          {hasActiveFilters() && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white shadow rounded-lg p-4 mb-6"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-gray-700 mr-2 flex items-center">
                  <FiFilter className="mr-1 h-4 w-4 text-primary-600" />
                  Active filters:
                </span>

                <AnimatePresence>
                  {searchTerm && (
                    <motion.span
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.15 } }}
                      className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800"
                    >
                      <FiSearch className="mr-1 h-4 w-4" />
                      {searchTerm}
                      <motion.button
                        whileHover={{ scale: 1.2 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => setSearchTerm('')}
                        className="ml-1 text-gray-500 hover:text-gray-700"
                      >
                        <FiX className="h-4 w-4" />
                      </motion.button>
                    </motion.span>
                  )}

                  {selectedLocation && (
                    <motion.span
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.15 } }}
                      className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800"
                    >
                      <FiMapPin className="mr-1 h-4 w-4" />
                      {selectedLocation}
                      <motion.button
                        whileHover={{ scale: 1.2 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => setSelectedLocation('')}
                        className="ml-1 text-gray-500 hover:text-gray-700"
                      >
                        <FiX className="h-4 w-4" />
                      </motion.button>
                    </motion.span>
                  )}

                  {selectedDistrict && (
                    <motion.span
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.15 } }}
                      className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800"
                    >
                      <FiMap className="mr-1 h-4 w-4" />
                      District: {selectedDistrict}
                      <motion.button
                        whileHover={{ scale: 1.2 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => setSelectedDistrict('')}
                        className="ml-1 text-gray-500 hover:text-gray-700"
                      >
                        <FiX className="h-4 w-4" />
                      </motion.button>
                    </motion.span>
                  )}

                  {selectedState && (
                    <motion.span
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.15 } }}
                      className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800"
                    >
                      <FiFlag className="mr-1 h-4 w-4" />
                      State: {selectedState}
                      <motion.button
                        whileHover={{ scale: 1.2 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => setSelectedState('')}
                        className="ml-1 text-gray-500 hover:text-gray-700"
                      >
                        <FiX className="h-4 w-4" />
                      </motion.button>
                    </motion.span>
                  )}

                  {selectedThemes.map(theme => {
                    const themeOption = themeOptions.find(t => t.id === theme);
                    return (
                      <motion.span
                        key={theme}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.15 } }}
                        className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-primary-100 text-primary-800"
                      >
                        {themeOption?.icon && <span className="mr-1">{themeOption.icon}</span>}
                        {themeOption?.label || theme}
                        <motion.button
                          whileHover={{ scale: 1.2 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => handleThemeToggle(theme)}
                          className="ml-1 text-primary-600 hover:text-primary-800"
                        >
                          <FiX className="h-4 w-4" />
                        </motion.button>
                      </motion.span>
                    );
                  })}

                  {selectedTags.map(tag => (
                    <motion.span
                      key={tag}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.15 } }}
                      className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800"
                    >
                      <FiTag className="mr-1 h-4 w-4" />
                      {tag}
                      <motion.button
                        whileHover={{ scale: 1.2 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => handleTagToggle(tag)}
                        className="ml-1 text-green-600 hover:text-green-800"
                      >
                        <FiX className="h-4 w-4" />
                      </motion.button>
                    </motion.span>
                  ))}

                  {selectedDate !== 'any' && (
                    <motion.span
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.15 } }}
                      className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800"
                    >
                      <FiCalendar className="mr-1 h-4 w-4" />
                      {dateOptions.find(d => d.id === selectedDate)?.label || selectedDate}
                      <motion.button
                        whileHover={{ scale: 1.2 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => setSelectedDate('any')}
                        className="ml-1 text-blue-600 hover:text-blue-800"
                      >
                        <FiX className="h-4 w-4" />
                      </motion.button>
                    </motion.span>
                  )}

                  {ratingFilter > 0 && (
                    <motion.span
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.15 } }}
                      className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800"
                    >
                      <FiStar className="mr-1 h-4 w-4" />
                      {ratingFilter}+ Stars
                      <motion.button
                        whileHover={{ scale: 1.2 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => setRatingFilter(0)}
                        className="ml-1 text-yellow-600 hover:text-yellow-800"
                      >
                        <FiX className="h-4 w-4" />
                      </motion.button>
                    </motion.span>
                  )}
                </AnimatePresence>

                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={clearAllFilters}
                  className="ml-auto text-sm text-primary-600 hover:text-primary-800 px-3 py-1 bg-primary-50 rounded-full flex items-center"
                >
                  <FiX className="mr-1 h-4 w-4" />
                  Clear all
                </motion.button>
              </div>

              <div className="mt-2 flex justify-between items-center text-sm text-gray-500">
                <div className="flex items-center">
                  <FiInfo className="mr-1 h-4 w-4 text-primary-500" />
                  Found {filteredPlaces.length} {filteredPlaces.length === 1 ? 'place' : 'places'}
                </div>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleRefresh}
                  className="flex items-center text-primary-600 hover:text-primary-800"
                  disabled={loading}
                >
                  <FiRefreshCw className={`mr-1 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                  Refresh
                </motion.button>
              </div>
            </motion.div>
          )}

          <div className="lg:grid lg:grid-cols-4 lg:gap-x-8">
            {/* Desktop Filters */}
            <aside className="hidden lg:block">
              <h2 className="sr-only">Filters</h2>

              <div className="bg-white shadow rounded-lg overflow-hidden divide-y divide-gray-200">
                {/* Search input */}
                <div className="p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-3 flex items-center">
                    <FiSearch className="mr-2 text-primary-600" />
                    Search
                  </h3>
                  <div className="relative">
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => debouncedSearch(e.target.value)}
                      placeholder="Search places..."
                      className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                    />
                    <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                      <FiSearch className="h-5 w-5 text-gray-400" />
                    </div>
                    {searchTerm && (
                      <button
                        onClick={() => setSearchTerm('')}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                      >
                        <FiX className="h-5 w-5" />
                      </button>
                    )}
                  </div>

                  {/* Recent searches */}
                  {recentSearches.length > 0 && (
                    <div className="mt-2">
                      <div className="flex justify-between items-center text-xs text-gray-500 mb-1">
                        <span>Recent searches</span>
                        <button
                          onClick={() => {
                            setRecentSearches([]);
                            localStorage.removeItem('recentSearches');
                          }}
                          className="text-primary-600 hover:text-primary-800"
                        >
                          Clear
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {recentSearches.slice(0, 3).map((term, idx) => (
                          <button
                            key={idx}
                            onClick={() => setSearchTerm(term)}
                            className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
                          >
                            {term}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Desktop filter sections */}
                <div className="p-6">
                  <FilterSection
                    title="Location Details"
                    icon={<FiMapPin className="text-primary-600" />}
                    collapsed={collapsedSections.location}
                    onToggle={() => toggleSection('location')}
                  >
                    <div className="space-y-4">
                      <div>
                        <label htmlFor="desktop-location" className="block text-sm font-medium text-gray-700 mb-1">
                          Location
                        </label>
                        <select
                          id="desktop-location"
                          value={selectedLocation}
                          onChange={(e) => setSelectedLocation(e.target.value)}
                          className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                        >
                          <option value="">All Locations</option>
                          {locations.map((loc, index) => (
                            <option key={index} value={loc}>{loc}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label htmlFor="desktop-district" className="block text-sm font-medium text-gray-700 mb-1">
                          District
                        </label>
                        <select
                          id="desktop-district"
                          value={selectedDistrict}
                          onChange={(e) => setSelectedDistrict(e.target.value)}
                          className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                        >
                          <option value="">All Districts</option>
                          {districts.map((district, index) => (
                            <option key={index} value={district}>{district}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label htmlFor="desktop-state" className="block text-sm font-medium text-gray-700 mb-1">
                          State
                        </label>
                        <select
                          id="desktop-state"
                          value={selectedState}
                          onChange={(e) => setSelectedState(e.target.value)}
                          className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                        >
                          <option value="">All States</option>
                          {states.map((state, index) => (
                            <option key={index} value={state}>{state}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </FilterSection>

                  <FilterSection
                    title="Themes"
                    icon={<FiLayers className="text-primary-600" />}
                    collapsed={collapsedSections.themes}
                    onToggle={() => toggleSection('themes')}
                  >
                    <div className="grid grid-cols-2 gap-2">
                      {themeOptions.map((theme) => (
                        <motion.button
                          key={theme.id}
                          whileHover={{ scale: 1.03 }}
                          whileTap={{ scale: 0.97 }}
                          onClick={() => handleThemeToggle(theme.id)}
                          className={`flex items-center px-3 py-2 rounded-md text-sm ${selectedThemes.includes(theme.id)
                            ? 'bg-primary-100 text-primary-800 border border-primary-300'
                            : 'bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200'
                            }`}
                        >
                          <span className="mr-2">{theme.icon}</span>
                          <span className="truncate">{theme.label}</span>
                          {selectedThemes.includes(theme.id) && (
                            <motion.span
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              className="ml-auto"
                            >
                              <FiCheck className="h-4 w-4 text-primary-600" />
                            </motion.span>
                          )}
                        </motion.button>
                      ))}
                    </div>
                  </FilterSection>

                  <FilterSection
                    title="Tags"
                    icon={<FiTag className="text-primary-600" />}
                    collapsed={collapsedSections.tags}
                    onToggle={() => toggleSection('tags')}
                  >
                    <div className="space-y-2">
                      <div className="flex flex-wrap gap-2">
                        {tags.slice(0, 15).map((tag, index) => (
                          <motion.button
                            key={index}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => handleTagToggle(tag)}
                            className={`text-sm px-3 py-1 rounded-full ${selectedTags.includes(tag)
                              ? 'bg-green-100 text-green-800 border border-green-300'
                              : 'bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200'
                              }`}
                          >
                            {tag}
                            {selectedTags.includes(tag) && (
                              <motion.span
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                className="ml-1"
                              >
                                <FiCheck className="inline h-3 w-3 text-green-600" />
                              </motion.span>
                            )}
                          </motion.button>
                        ))}
                      </div>

                      {tags.length > 15 && (
                        <button
                          className="text-sm text-primary-600 hover:text-primary-800"
                          onClick={() => toggleSection('tags')}
                        >
                          {collapsedSections.tags ? 'Show all tags' : 'Show fewer tags'}
                        </button>
                      )}
                    </div>
                  </FilterSection>

                  <FilterSection
                    title="Best Time to Visit"
                    icon={<FiCalendar className="text-primary-600" />}
                    collapsed={collapsedSections.date}
                    onToggle={() => toggleSection('date')}
                  >
                    <div className="grid grid-cols-2 gap-2">
                      {dateOptions.map((option) => (
                        <motion.button
                          key={option.id}
                          whileHover={{ scale: 1.03 }}
                          whileTap={{ scale: 0.97 }}
                          onClick={() => setSelectedDate(option.id)}
                          className={`py-2 px-3 rounded-md text-sm flex items-center justify-between ${selectedDate === option.id
                            ? 'bg-blue-100 text-blue-800 border border-blue-300'
                            : 'bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200'
                            }`}
                        >
                          <div className="flex items-center">
                            <span className="mr-2">{option.icon}</span>
                            <span>{option.label}</span>
                          </div>
                          {selectedDate === option.id && (
                            <motion.span
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                            >
                              <FiCheck className="h-4 w-4 text-blue-600" />
                            </motion.span>
                          )}
                        </motion.button>
                      ))}
                    </div>
                  </FilterSection>

                  <FilterSection
                    title="Rating"
                    icon={<FiStar className="text-primary-600" />}
                    collapsed={collapsedSections.rating}
                    onToggle={() => toggleSection('rating')}
                  >
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Minimum Rating
                      </label>
                      <div className="flex items-center justify-between space-x-2">
                        {[0, 1, 2, 3, 4, 5].map((rating) => (
                          <motion.button
                            key={rating}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => setRatingFilter(rating)}
                            className={`flex-1 py-2 flex items-center justify-center rounded-md ${ratingFilter === rating
                              ? 'bg-yellow-100 text-yellow-800 border border-yellow-300'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200'
                              }`}
                          >
                            {rating === 0 ? (
                              <span>Any</span>
                            ) : (
                              <div className="flex items-center">
                                {rating}
                                <FiStar className={`ml-1 h-3 w-3 ${ratingFilter === rating ? 'text-yellow-500' : ''}`} />
                              </div>
                            )}
                          </motion.button>
                        ))}
                      </div>

                      <div className="mt-4 flex items-center justify-between">
                        <div className="flex items-center">
                          {ratingFilter > 0 ? (
                            <div className="flex text-yellow-600">
                              {[...Array(ratingFilter)].map((_, i) => (
                                <FiStar key={i} className="h-4 w-4 fill-current" />
                              ))}
                              {[...Array(5 - ratingFilter)].map((_, i) => (
                                <FiStar key={i} className="h-4 w-4 text-gray-300" />
                              ))}
                            </div>
                          ) : (
                            <span className="text-sm text-gray-500">Any rating</span>
                          )}
                        </div>

                        {ratingFilter > 0 && (
                          <button
                            onClick={() => setRatingFilter(0)}
                            className="text-sm text-primary-600 hover:text-primary-800"
                          >
                            Clear
                          </button>
                        )}
                      </div>
                    </div>
                  </FilterSection>
                </div>

                {/* Sort options */}
                <div className="p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-3 flex items-center">
                    <FiSliders className="mr-2 text-primary-600" />
                    Sort By
                  </h3>
                  <div className="space-y-2">
                    <motion.button
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setSortOrder('newest')}
                      className={`flex items-center justify-between w-full py-2 px-3 rounded-md ${sortOrder === 'newest'
                        ? 'bg-primary-100 text-primary-800'
                        : 'text-gray-700 hover:bg-gray-100'
                        }`}
                    >
                      <span className="flex items-center">
                        <FiClock className="mr-2 h-4 w-4" />
                        Newest First
                      </span>
                      {sortOrder === 'newest' && (
                        <motion.span
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                        >
                          <FiCheck className="h-4 w-4" />
                        </motion.span>
                      )}
                    </motion.button>

                    <motion.button
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setSortOrder('rating')}
                      className={`flex items-center justify-between w-full py-2 px-3 rounded-md ${sortOrder === 'rating'
                        ? 'bg-primary-100 text-primary-800'
                        : 'text-gray-700 hover:bg-gray-100'
                        }`}
                    >
                      <span className="flex items-center">
                        <FiStar className="mr-2 h-4 w-4" />
                        Highest Rated
                      </span>
                      {sortOrder === 'rating' && (
                        <motion.span
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                        >
                          <FiCheck className="h-4 w-4" />
                        </motion.span>
                      )}
                    </motion.button>

                    <motion.button
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setSortOrder('name')}
                      className={`flex items-center justify-between w-full py-2 px-3 rounded-md ${sortOrder === 'name'
                        ? 'bg-primary-100 text-primary-800'
                        : 'text-gray-700 hover:bg-gray-100'
                        }`}
                    >
                      <span className="flex items-center">
                        <FiInfo className="mr-2 h-4 w-4" />
                        Alphabetical
                      </span>
                      {sortOrder === 'name' && (
                        <motion.span
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                        >
                          <FiCheck className="h-4 w-4" />
                        </motion.span>
                      )}
                    </motion.button>
                  </div>
                </div>

                {/* Clear filters */}
                <div className="p-6">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={clearAllFilters}
                    className="w-full py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none transition-colors"
                  >
                    Clear All Filters
                  </motion.button>

                  <div className="mt-4 text-xs text-center text-gray-500">
                    <div className="flex items-center justify-center">
                      <FiClock className="mr-1 h-3 w-3" />
                      <span>{new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick stats card */}
              <div className="mt-6 bg-white shadow rounded-lg p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-3 flex items-center">
                  <FiTarget className="mr-2 text-primary-600" />
                  Explore Stats
                </h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Total Places</span>
                    <span className="text-sm font-medium bg-primary-100 text-primary-800 px-2 py-1 rounded">
                      {stats.totalPlaces}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Filtered Results</span>
                    <span className="text-sm font-medium bg-primary-100 text-primary-800 px-2 py-1 rounded">
                      {filteredPlaces.length}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Top Location</span>
                    <span className="text-sm font-medium bg-primary-100 text-primary-800 px-2 py-1 rounded truncate max-w-[120px]">
                      {stats.topLocation || 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Average Rating</span>
                    <div className="flex items-center text-sm">
                      <span className="font-medium text-yellow-500 flex items-center">
                        {stats.avgRating}
                        <FiStar className="ml-1 h-3 w-3 fill-current" />
                      </span>
                    </div>
                  </div>
                </div>

                {/* User status */}
                {currentUser && (
                  <div className="mt-6 pt-4 border-t border-gray-100">
                    <div className="flex items-center text-xs text-gray-500">
                      <FiUser className="h-3 w-3 mr-1" />
                      <span>Logged in as</span>
                      <span className="ml-1 font-medium text-primary-600">
                        {currentUser.displayName || currentUser.email || 'dharmendra23101'}
                      </span>
                    </div>
                  </div>
                )}

                {/* Data timestamp */}
                <div className="mt-4 text-xs text-center text-gray-400">
                  <div className="flex items-center justify-center">
                    <FiClock className="mr-1 h-3 w-3" />
                    <span>Data updated: 2025-09-05 22:08:08</span>
                  </div>
                </div>
              </div>
            </aside>

            {/* Places Grid/List */}
            <div className="mt-6 lg:mt-0 lg:col-span-3">
              {/* Enhanced Desktop header with search and view toggle */}
              <div className="hidden md:flex justify-between items-center mb-6 bg-white shadow-lg rounded-xl p-6 border border-gray-100">
                <div className="flex-1 max-w-md relative">
                  <div className="relative">
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => debouncedSearch(e.target.value)}
                      placeholder="Search places..."
                      className="block w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl shadow-sm focus:ring-blue-500 focus:border-blue-500 transition-all"
                    />
                    <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
                      <FiSearch className="h-5 w-5 text-gray-400" />
                    </div>
                    {searchTerm && (
                      <button
                        onClick={() => setSearchTerm('')}
                        className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        <FiX className="h-5 w-5" />
                      </button>
                    )}
                  </div>

                  <div className="mt-2 text-sm text-gray-500">
                    {filteredPlaces.length} {filteredPlaces.length === 1 ? 'place' : 'places'} found
                  </div>
                </div>

                <div className="flex items-center ml-6 space-x-4">
                  {/* View Mode Toggle */}
                  <div className="flex items-center bg-gray-100 rounded-xl p-1">
                    {viewModes.map((mode) => (
                      <motion.button
                        key={mode.id}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setViewMode(mode.id)}
                        className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                          viewMode === mode.id
                            ? 'bg-white text-blue-600 shadow-sm'
                            : 'text-gray-600 hover:text-gray-900'
                        }`}
                        title={mode.description}
                      >
                        <span className="text-lg">{mode.icon}</span>
                        <span className="hidden lg:inline">{mode.label}</span>
                      </motion.button>
                    ))}
                  </div>

                  {/* Sort Dropdown */}
                  <div className="relative">
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      className="flex items-center space-x-2 bg-white px-4 py-3 border-2 border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-all shadow-sm"
                      onClick={() => setShowSortMenu(!showSortMenu)}
                    >
                      <FiSliders className="h-4 w-4" />
                      <span>Sort: {sortOptions.find(s => s.id === sortOrder)?.label}</span>
                      <FiChevronDown className={`h-4 w-4 transition-transform ${showSortMenu ? 'rotate-180' : ''}`} />
                    </motion.button>

                    <AnimatePresence>
                      {showSortMenu && (
                        <motion.div
                          initial={{ opacity: 0, y: 10, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -10, scale: 0.95 }}
                          transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                          className="absolute right-0 mt-2 w-56 bg-white shadow-xl rounded-xl py-2 z-20 border border-gray-100"
                        >
                          {sortOptions.map((option) => (
                            <button
                              key={option.id}
                              onClick={() => {
                                setSortOrder(option.id);
                                setShowSortMenu(false);
                              }}
                              className={`flex items-center justify-between px-4 py-3 text-sm w-full text-left transition-colors ${
                                sortOrder === option.id
                                  ? 'bg-blue-50 text-blue-700'
                                  : 'text-gray-700 hover:bg-gray-50'
                              }`}
                            >
                              <div className="flex items-center">
                                <span className="mr-3">{option.icon}</span>
                                <span>{option.label}</span>
                              </div>
                              {sortOrder === option.id && (
                                <FiCheck className="h-4 w-4 text-blue-600" />
                              )}
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Refresh Button */}
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleRefresh}
                    className={`p-3 border-2 border-gray-200 rounded-xl text-gray-700 hover:bg-gray-50 transition-all shadow-sm ${
                      loading ? 'animate-pulse' : ''
                    }`}
                    disabled={loading}
                    title="Refresh places"
                  >
                    <FiRefreshCw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
                  </motion.button>

                  {/* Map Fullscreen Toggle (only show when in map mode) */}
                  {viewMode === 'map' && (
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setMapFullscreen(!mapFullscreen)}
                      className="p-3 border-2 border-gray-200 rounded-xl text-gray-700 hover:bg-gray-50 transition-all shadow-sm"
                      title={mapFullscreen ? "Exit fullscreen" : "Fullscreen map"}
                    >
                      {mapFullscreen ? (
                        <FiMinimize2 className="h-5 w-5" />
                      ) : (
                        <FiMaximize2 className="h-5 w-5" />
                      )}
                    </motion.button>
                  )}
                </div>
              </div>

              {/* Places display with enhanced views */}
              {initialLoading ? (
                <div className="flex flex-col items-center justify-center py-32 bg-white rounded-xl shadow-lg">
                  <LoadingSpinner size="large" color="primary" />
                  <p className="text-xl text-blue-800 mt-6 font-medium">Loading amazing destinations...</p>
                  <p className="text-sm text-gray-500 mt-2">Discovering perfect places for your next adventure</p>
                </div>
              ) : error ? (
                <div className="bg-white rounded-xl shadow-lg p-8 text-center">
                  <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', damping: 20 }}
                  >
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 text-red-600 mb-4">
                      <FiAlertCircle className="h-8 w-8" />
                    </div>
                    <h3 className="text-lg font-medium text-red-600 mb-2">{error}</h3>
                    <p className="text-gray-500 mb-4">Something went wrong while loading places.</p>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={handleRefresh}
                      className="inline-flex items-center px-6 py-3 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors"
                    >
                      <FiRefreshCw className="mr-2 h-5 w-5" />
                      Try Again
                    </motion.button>
                  </motion.div>
                </div>
              ) : filteredPlaces.length === 0 ? (
                <div className="bg-white rounded-xl shadow-lg p-8 text-center">
                  <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', damping: 20 }}
                  >
                    <div className="mx-auto w-16 h-16 text-gray-400 mb-4">
                      <FiSearch className="w-full h-full" />
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No places found</h3>
                    <p className="text-gray-500 mb-6">Try adjusting your filters or search criteria.</p>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={clearAllFilters}
                      className="inline-flex items-center px-6 py-3 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors"
                    >
                      Clear All Filters
                    </motion.button>
                  </motion.div>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Map View */}
                  {viewMode === 'map' && (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`bg-white rounded-xl shadow-lg overflow-hidden ${
                        mapFullscreen
                          ? 'fixed inset-4 z-50'
                          : 'h-96 sm:h-[500px] lg:h-[600px]'
                      }`}
                    >
                      <div className="h-full relative">
                        <ExploreMap
                          places={filteredPlaces}
                          className="h-full w-full rounded-xl"
                        />

                        {/* Map overlay with place count */}
                        <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-sm rounded-lg px-4 py-2 shadow-lg">
                          <div className="flex items-center text-sm font-medium text-gray-700">
                            <FiMapPin className="h-4 w-4 mr-2 text-blue-600" />
                            {filteredPlaces.length} {filteredPlaces.length === 1 ? 'place' : 'places'}
                          </div>
                        </div>

                        {/* Close fullscreen button */}
                        {mapFullscreen && (
                          <button
                            onClick={() => setMapFullscreen(false)}
                            className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm rounded-lg p-2 shadow-lg hover:bg-white transition-colors"
                          >
                            <FiX className="h-6 w-6 text-gray-700" />
                          </button>
                        )}
                      </div>
                    </motion.div>
                  )}

                  {/* Grid View */}
                  {viewMode === 'grid' && (
                    <LayoutGroup>
                      <motion.div
                        layout
                        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
                        variants={staggerChildren}
                        initial="hidden"
                        animate="visible"
                      >
                        {displayedPlaces.map((place, index) => (
                          <motion.div
                            key={place.id}
                            layout
                            variants={fadeInUp}
                            initial="hidden"
                            animate="visible"
                            transition={{
                              duration: 0.4,
                              delay: index % 3 * 0.1
                            }}
                          >
                            <PlaceCard
                              place={place}
                              priority={index < 6}
                            />
                          </motion.div>
                        ))}
                      </motion.div>
                    </LayoutGroup>
                  )}

                  {/* List View */}
                  {viewMode === 'list' && (
                    <LayoutGroup>
                      <motion.div layout className="space-y-6">
                        {displayedPlaces.map((place, index) => (
                          <motion.div
                            key={place.id}
                            layout
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{
                              duration: 0.4,
                              delay: index % 5 * 0.05
                            }}
                            whileHover={{ y: -4 }}
                            className="bg-white rounded-xl shadow-lg overflow-hidden flex flex-col sm:flex-row hover:shadow-xl transition-all duration-300"
                          >
                            {/* List view image */}
                            <div className="sm:w-1/3 h-48 sm:h-auto relative">
                              <EnhancedImage
                                place={place}
                                priority={index < 3}
                              />

                              {/* Rating badge */}
                              {place.rating_count > 0 && (
                                <div className="absolute top-3 right-3 bg-yellow-500/90 text-white px-3 py-1 rounded-full text-sm flex items-center backdrop-blur-sm shadow-md">
                                  <FiStar className="mr-1 h-4 w-4" />
                                  {(place.rating_sum / place.rating_count).toFixed(1)}
                                </div>
                              )}

                              {/* Themes badges */}
                              {place.themes && place.themes.length > 0 && (
                                <div className="absolute top-3 left-3 flex flex-wrap gap-1">
                                  {place.themes.slice(0, 2).map(theme => {
                                    const themeOption = themeOptions.find(t => t.id === theme);
                                    return (
                                      <span
                                        key={theme}
                                        className={`inline-flex items-center text-white text-xs px-2 py-1 rounded-full backdrop-blur-sm shadow-sm ${
                                          themeOption?.bgColor || 'bg-gray-500'
                                        }`}
                                      >
                                        {themeOption?.icon && (
                                          <span className="mr-1">{themeOption.icon}</span>
                                        )}
                                        {themeOption?.label || theme}
                                      </span>
                                    );
                                  })}
                                  {place.themes.length > 2 && (
                                    <span className="inline-block px-2 py-1 text-xs font-medium rounded-full bg-gray-700/80 text-white backdrop-blur-sm shadow-sm">
                                      +{place.themes.length - 2}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>

                            <div className="p-6 flex-1 flex flex-col">
                              <div className="flex-1">
                                <h3 className="text-xl font-bold text-gray-900 mb-2 flex items-start">
                                  <Link
                                    href={`/places/${place.id}`}
                                    className="hover:text-blue-600 transition-colors group flex-1"
                                  >
                                    <span className="group-hover:underline">{place.name}</span>
                                  </Link>
                                  {(place.district || place.state) && (
                                    <span className="ml-2 text-sm font-normal text-gray-500 bg-gray-100 px-2 py-1 rounded-md">
                                      {place.district && place.state
                                        ? `${place.district}, ${place.state}`
                                        : place.district || place.state
                                      }
                                    </span>
                                  )}
                                </h3>

                                <div className="flex items-center text-sm text-gray-500 mb-3">
                                  <FiMapPin className="mr-1 text-blue-500" />
                                  <span>{place.location}</span>
                                </div>

                                <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                                  {place.description || 'No description available.'}
                                </p>

                                {/* Tags */}
                                {place.tags && place.tags.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mb-4">
                                    {place.tags.slice(0, 5).map((tag, tagIndex) => (
                                      <span
                                        key={tagIndex}
                                        className="text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded-full hover:bg-gray-200 transition-colors cursor-pointer"
                                        onClick={() => handleTagToggle(tag)}
                                      >
                                        {tag}
                                      </span>
                                    ))}
                                    {place.tags.length > 5 && (
                                      <span className="text-xs text-blue-600 hover:text-blue-700 cursor-pointer">
                                        +{place.tags.length - 5} more
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>

                              <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
                                <div className="flex items-center text-xs text-gray-500">
                                  <FiClock className="mr-1 text-gray-400" />
                                  <span>
                                    {new Date(place.created_at).toLocaleDateString('en-US', {
                                      year: 'numeric',
                                      month: 'short',
                                      day: 'numeric'
                                    })}
                                  </span>
                                </div>

                                <div className="flex items-center space-x-4">
                                  {place.rating_count > 0 && (
                                    <div className="flex items-center text-xs text-gray-500">
                                      <FiMessageCircle className="mr-1 text-gray-400" />
                                      <span>
                                        {place.rating_count} {place.rating_count === 1 ? 'review' : 'reviews'}
                                      </span>
                                    </div>
                                  )}

                                  <Link
                                    href={`/places/${place.id}`}
                                    className="inline-flex items-center text-blue-600 hover:text-blue-800 font-medium transition-colors"
                                  >
                                    <span className="hidden sm:inline">View Details</span>
                                    <FiArrowRight className="ml-2 h-4 w-4" />
                                  </Link>
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        ))}
                      </motion.div>
                    </LayoutGroup>
                  )}

                  {/* Load more */}
                  {displayedPlaces.length < filteredPlaces.length && viewMode !== 'map' && (
                    <div ref={loadMoreRef} className="flex justify-center py-8">
                      {loadingMore ? (
                        <div className="flex items-center bg-white rounded-xl px-6 py-4 shadow-lg">
                          <LoadingSpinner size="small" color="primary" />
                          <span className="text-blue-600 ml-3 font-medium">Loading more places...</span>
                        </div>
                      ) : (
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => setCurrentPage(currentPage + 1)}
                          className="inline-flex items-center px-8 py-4 border border-gray-300 rounded-xl shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                        >
                          <span>Load More Places</span>
                          <FiChevronDown className="ml-2 h-4 w-4" />
                        </motion.button>
                      )}
                    </div>
                  )}

                  {/* Results count */}
                  {viewMode !== 'map' && (
                    <div className="text-center text-sm text-gray-500 bg-white rounded-xl py-4 shadow-sm">
                      Showing {displayedPlaces.length} of {filteredPlaces.length} results
                      {hasActiveFilters() && (
                        <span className="ml-2">
                          • <button
                            onClick={clearAllFilters}
                            className="text-blue-600 hover:text-blue-800 underline"
                          >
                            Clear filters
                          </button>
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Enhanced footer with useful information */}
      <div className="bg-white border-t border-gray-200 py-8 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex flex-wrap items-center space-x-6 mb-4 md:mb-0">
              <Link href="/" className="text-sm text-gray-600 hover:text-blue-600 flex items-center transition-colors">
                <FiHome className="mr-1 h-4 w-4" />
                Home
              </Link>
              <button
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                className="text-sm text-gray-600 hover:text-blue-600 flex items-center transition-colors"
              >
                <FiNavigation className="mr-1 h-4 w-4" />
                Back to Top
              </button>
              {currentUser && (
                <div className="text-sm text-gray-600 flex items-center">
                  <FiUser className="mr-1 h-4 w-4" />
                  <span>{currentUser.displayName || currentUser.email || 'User'}</span>
                </div>
              )}
            </div>

            <div className="text-sm text-gray-500">
              <span>© 2025 EasyTrip • {stats.totalPlaces} amazing places to explore</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

// Enhanced filter section component with animations
const FilterSection = ({ title, icon, collapsed, onToggle, children }) => (
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
    </button>

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
  </div>
);


const EnhancedImage = ({ place, priority = false }) => {
  const [status, setStatus] = useState('loading');
  const fallbackImage = '/images/placeholder.jpg';

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
      {status === 'loading' && (
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
      {status === 'error' && (
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

export default Browse;