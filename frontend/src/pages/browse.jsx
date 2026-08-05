import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/router';
import { useInView } from 'react-intersection-observer';
import { motion, AnimatePresence } from 'framer-motion';
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
import { THEMES, SEASONS } from '../constants/themes';
import { fetchPlaces, fetchFacets, PLACES_PAGE_SIZE } from '../services/placesApi';
import { useAuth } from '../context/AuthContext';
import debounce from 'lodash/debounce';
import LoadingSpinner from '../components/LoadingSpinner';
import { getCloudinaryThumbnail } from '../utils/cloudinaryHelper';

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
// Presentation only. The ids and labels come from the shared vocabulary so this page cannot drift
// from what the admin forms can actually assign (IMP-118) — the bug this replaces was `beach` and
// `mountain` being filterable here but assignable nowhere.
const THEME_PRESENTATION = {
    hot: { icon: <FiSun />, color: 'orange', bgColor: 'bg-orange-500' },
    cold: { icon: <FiCloud />, color: 'blue', bgColor: 'bg-blue-500' },
    rainy: { icon: <FiCloudRain />, color: 'indigo', bgColor: 'bg-indigo-500' },
    romantic: { icon: <FiHeart />, color: 'pink', bgColor: 'bg-pink-500' },
    religious: { icon: <FiBook />, color: 'purple', bgColor: 'bg-purple-500' },
    historical: { icon: <FiClock />, color: 'amber', bgColor: 'bg-amber-600' },
    science: { icon: <FiCpu />, color: 'cyan', bgColor: 'bg-cyan-500' },
    tech: { icon: <FiMonitor />, color: 'slate', bgColor: 'bg-slate-500' },
    adventure: { icon: <FiCompass />, color: 'green', bgColor: 'bg-green-500' },
    nature: { icon: <FiGlobe />, color: 'emerald', bgColor: 'bg-emerald-500' },
    beach: { icon: <FiUmbrella />, color: 'sky', bgColor: 'bg-sky-500' },
    mountain: { icon: <FiTriangle />, color: 'stone', bgColor: 'bg-stone-600' },
    family: { icon: <FiUsers />, color: 'teal', bgColor: 'bg-teal-500' },
    weekend: { icon: <FiCalendar />, color: 'violet', bgColor: 'bg-violet-500' }
};

const themeOptions = THEMES.map((theme) => ({
    id: theme.id,
    label: theme.label,
    ...THEME_PRESENTATION[theme.id]
}));

const SEASON_PRESENTATION = {
    any: { icon: <FiCalendar />, color: 'gray' },
    summer: { icon: <FiSun />, color: 'yellow' },
    monsoon: { icon: <FiCloudRain />, color: 'blue' },
    winter: { icon: <FiCloud />, color: 'cyan' }
};

const dateOptions = SEASONS.map((season) => ({
    id: season.id,
    label: season.label,
    ...SEASON_PRESENTATION[season.id]
}));

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

function Browse({ initialResults, initialFacets, initialFilters, initialError }) {
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

    // Results (IMP-038 / IMP-046).
    //
    // There used to be three lists here — `places` (everything the API returned), `filteredPlaces`
    // (the same data narrowed) and `displayedPlaces` (a slice of that) — kept in step by a chain
    // of effects, one of which compared the whole dataset with `JSON.stringify` on every pass.
    // Filtering, sorting and paging all happen in the query now, so there is one list: the rows
    // the server returned for the current criteria, with each additional page appended to it.
    const [places, setPlaces] = useState(initialResults?.data || []);
    const [total, setTotal] = useState(initialResults?.pagination?.total || 0);
    const [hasMore, setHasMore] = useState(initialResults?.pagination?.hasMore || false);

    // Filter data
    const [locations, setLocations] = useState(initialFacets?.locations || []);
    const [districts, setDistricts] = useState(initialFacets?.districts || []);
    const [states, setStates] = useState(initialFacets?.states || []);
    const [tags, setTags] = useState(initialFacets?.tags || []);

    // Map markers: fetched separately, only while the map is open, with a marker-sized projection.
    // The grid is paginated and the map is not — one page of cards is the right amount of data to
    // scroll through, and twelve pins is not a map. Splitting them means neither view pays for
    // the other: the grid no longer downloads coordinates for the whole catalogue, and the map no
    // longer downloads descriptions it will never render.
    const [mapPlaces, setMapPlaces] = useState([]);
    const [mapLoading, setMapLoading] = useState(false);

    // UI state
    const [loading, setLoading] = useState(!initialResults);
    const [initialLoading, setInitialLoading] = useState(!initialResults);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState(initialError || null);
    const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
    const [viewMode, setViewMode] = useState('grid'); // 'grid', 'list', or 'map'
    const [sortOrder, setSortOrder] = useState('newest');
    const [showSortMenu, setShowSortMenu] = useState(false);
    const [searchActive, setSearchActive] = useState(false);
    const [mapFullscreen, setMapFullscreen] = useState(false);
    const searchInputRef = useRef(null);

    // Filter state, seeded from the URL by getServerSideProps so the server rendered the same
    // result set the client is about to display — otherwise a shared link would paint the
    // unfiltered catalogue and then replace it once the client re-read its own query string.
    const [searchTerm, setSearchTerm] = useState(initialFilters?.searchTerm || '');
    const [selectedLocation, setSelectedLocation] = useState(initialFilters?.location || '');
    const [selectedDistrict, setSelectedDistrict] = useState(initialFilters?.district || '');
    const [selectedState, setSelectedState] = useState(initialFilters?.state || '');
    const [selectedTags, setSelectedTags] = useState(initialFilters?.tags || []);
    const [selectedThemes, setSelectedThemes] = useState(initialFilters?.themes || []);
    const [selectedDate, setSelectedDate] = useState(initialFilters?.date || 'any');
    const [ratingFilter, setRatingFilter] = useState(initialFilters?.minRating || 0);
    const [recentSearches, setRecentSearches] = useState([]);
    const [collapsedSections, setCollapsedSections] = useState({
        themes: false,
        location: false,
        rating: false,
        date: false,
        tags: false
    });

    // Catalogue statistics, computed by the server alongside the result count.
    //
    // These were derived in the browser by reducing over every place the API returned. That only
    // worked while the browser held the entire catalogue; averaging a page of twelve under a
    // label reading "Average Rating" would be a wrong number, not a stale one, so the aggregate
    // moved into the same query that produces the total (`withStats`).
    const [stats, setStats] = useState(() => ({
        totalPlaces: initialResults?.stats?.total ?? 0,
        avgRating: initialResults?.stats?.avgRating ?? 0,
        topLocation: initialResults?.stats?.topLocation ?? '',
        locationCount: initialResults?.stats?.topLocationCount ?? 0
    }));

    // When the places currently on screen were actually fetched. Set on the client only: rendering
    // a server timestamp would mismatch the client's locale-formatted one and trip hydration.
    const [lastUpdated, setLastUpdated] = useState(null);

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

    // Detect screen size changes.
    //
    // The page size no longer varies with the viewport: it is a server `LIMIT` now, and changing
    // it mid-session would shift every subsequent offset, which is how offset pagination starts
    // duplicating and skipping rows. Infinite scroll made the responsive sizing moot anyway —
    // it decided how many cards arrived before the next scroll, not how many fit.
    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth < 640 && viewMode === 'list') {
                setViewMode('grid');
            }
        };

        window.addEventListener('resize', handleResize);
        handleResize();

        return () => window.removeEventListener('resize', handleResize);
    }, [viewMode]);

    // Filter vocabularies. `getServerSideProps` normally supplies these; this covers the case
    // where it could not reach the API and rendered the page anyway, so a transient outage costs
    // the filter lists until the next load rather than permanently.
    useEffect(() => {
        if (initialFacets) return;

        let cancelled = false;
        fetchFacets().then((facets) => {
            if (cancelled) return;
            setLocations(facets.locations);
            setDistricts(facets.districts);
            setStates(facets.states);
            setTags(facets.tags);
        });

        return () => { cancelled = true; };
    }, [initialFacets]);

    // Recent searches are per-browser, so they can only be read after hydration.
    useEffect(() => {
        const saved = localStorage.getItem('recentSearches');
        if (!saved) return;
        try {
            setRecentSearches(JSON.parse(saved).slice(0, 5));
        } catch (e) {
            console.warn('Failed to parse recent searches:', e);
        }
    }, []);

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

    // The filter set, in the shape the API takes. Everything downstream reads this rather than
    // the eight individual pieces of state, so there is one definition of "the current query".
    const criteria = useMemo(() => ({
        searchTerm: searchTerm || undefined,
        location: selectedLocation || undefined,
        district: selectedDistrict || undefined,
        state: selectedState || undefined,
        themes: selectedThemes.length ? selectedThemes : undefined,
        tags: selectedTags.length ? selectedTags : undefined,
        minRating: ratingFilter > 0 ? ratingFilter : undefined,
        date: selectedDate !== 'any' ? selectedDate : undefined
    }), [searchTerm, selectedLocation, selectedDistrict, selectedState,
         selectedThemes, selectedTags, ratingFilter, selectedDate]);

    // A stable dependency for the effects below. `criteria` is rebuilt whenever any filter's
    // identity changes — including the array literals — so depending on the object directly would
    // refetch on renders where nothing actually changed.
    const criteriaKey = useMemo(() => JSON.stringify(criteria), [criteria]);

    const hasActiveFilters = useCallback(
        () => Object.keys(criteria).some((key) => criteria[key] !== undefined),
        [criteria]
    );

    // Keep the URL in step with the filters, without navigating. Separate from fetching because
    // it is presentation: the address bar should describe the current view whether or not the
    // request behind it succeeded.
    useEffect(() => {
        const params = new URLSearchParams();
        if (searchTerm) params.set('q', searchTerm);
        if (selectedLocation) params.set('location', selectedLocation);
        if (selectedDistrict) params.set('district', selectedDistrict);
        if (selectedState) params.set('state', selectedState);
        if (selectedDate !== 'any') params.set('date', selectedDate);
        if (ratingFilter > 0) params.set('rating', String(ratingFilter));
        selectedThemes.forEach((t) => params.append('theme', t));
        selectedTags.forEach((t) => params.append('tag', t));

        const query = params.toString();
        window.history.replaceState({}, '', query ? `${window.location.pathname}?${query}` : window.location.pathname);
    }, [criteriaKey, searchTerm, selectedLocation, selectedDistrict, selectedState,
        selectedDate, ratingFilter, selectedThemes, selectedTags]);

    // Fetch the first page whenever the query changes.
    //
    // This replaces a pair of effects that fought each other: one asked the server for filtered
    // results *and* kept a client-side reimplementation of the same filters as a fallback, the
    // other re-sorted the result in the browser and compared old and new with `JSON.stringify`
    // over the entire dataset to decide whether to write it back. Filtering, sorting and paging
    // are one query now, so this is one request with one result.
    //
    // The client-side filter is gone rather than retained as a fallback: it could only ever see
    // the page in memory, so after pagination it would answer a whole-catalogue question with
    // whatever twelve rows happened to be loaded — confidently, and wrongly. A failed request
    // reports a failure.
    const skipNextFetchRef = useRef(Boolean(initialResults));

    useEffect(() => {
        // The server already rendered page one for these criteria; refetching it on mount would
        // throw away the payload that was just embedded in the HTML.
        if (skipNextFetchRef.current) {
            skipNextFetchRef.current = false;
            setLastUpdated(new Date());
            return;
        }

        let cancelled = false;
        const controller = new AbortController();
        setLoading(true);

        // Debounced so that typing in the search box issues one request, not one per keystroke.
        const timer = setTimeout(async () => {
            try {
                const response = await fetchPlaces(
                    { ...criteria, sort: sortOrder, limit: PLACES_PAGE_SIZE, offset: 0 },
                    { signal: controller.signal }
                );
                if (cancelled) return;

                setPlaces(response.data);
                setTotal(response.pagination.total);
                setHasMore(response.pagination.hasMore);
                // `stats` is deliberately not requested here: it describes the catalogue, not
                // the query, so it does not change when a filter does.
                setError(null);
                setLastUpdated(new Date());
            } catch (err) {
                // An abort is this effect superseding itself, not a failure to report.
                if (cancelled || err.name === 'AbortError') return;
                console.error('Failed to load places:', err);
                setError('Failed to load places. Please try again.');
            } finally {
                if (!cancelled) {
                    setLoading(false);
                    setInitialLoading(false);
                }
            }
        }, 250);

        return () => {
            cancelled = true;
            controller.abort();
            clearTimeout(timer);
        };
    }, [criteriaKey, sortOrder]);

    // Append the next page. Offsets come from how many rows are already held rather than a page
    // counter, so a short page or a concurrent insert cannot desynchronise the two.
    const loadMore = useCallback(async () => {
        if (loadingMore || !hasMore) return;

        setLoadingMore(true);
        try {
            const response = await fetchPlaces({
                ...criteria, sort: sortOrder, limit: PLACES_PAGE_SIZE, offset: places.length
            });
            setPlaces((prev) => [...prev, ...response.data]);
            setTotal(response.pagination.total);
            setHasMore(response.pagination.hasMore);
        } catch (err) {
            console.error('Failed to load more places:', err);
            setHasMore(false);
            setError('Could not load more places.');
        } finally {
            setLoadingMore(false);
        }
    }, [criteria, sortOrder, places.length, hasMore, loadingMore]);

    // Markers, fetched only while the map is open and thrown away when it closes. Unpaginated by
    // design — a map showing twelve of a hundred pins is worse than no map — which is affordable
    // only because `projection: 'map'` returns coordinates and a label rather than full rows.
    useEffect(() => {
        if (viewMode !== 'map') return;

        let cancelled = false;
        const controller = new AbortController();
        setMapLoading(true);

        fetchPlaces({ ...criteria, projection: 'map' }, { signal: controller.signal })
            .then((response) => {
                if (!cancelled) setMapPlaces(response.data);
            })
            .catch((err) => {
                if (cancelled || err.name === 'AbortError') return;
                console.error('Failed to load map places:', err);
                setMapPlaces([]);
            })
            .finally(() => {
                if (!cancelled) setMapLoading(false);
            });

        return () => {
            cancelled = true;
            controller.abort();
        };
    }, [viewMode, criteriaKey]);

    // Infinite scroll. Each page is now a real request, so the guard matters more than it did
    // when the next page was a slice of memory: this effect re-runs every time `places` grows,
    // and `inView` only clears asynchronously when the observer next fires, so without it one
    // sentinel sighting would fan out into a burst of concurrent requests for the whole
    // catalogue. One page per in-view episode; the explicit "Load More Places" button below
    // covers the case where the appended page is too short to push the sentinel back out of view.
    const advancedForCurrentViewRef = useRef(false);

    useEffect(() => {
        if (!inView) {
            advancedForCurrentViewRef.current = false;
            return;
        }

        if (advancedForCurrentViewRef.current) return;
        if (!hasMore || loadingMore) return;

        advancedForCurrentViewRef.current = true;
        loadMore();
    }, [inView, hasMore, loadingMore, loadMore]);

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

    // Re-run the current query from page one. It has to respect the active filters — the old
    // version fetched the unfiltered catalogue and then only applied it when no filters were set,
    // so pressing refresh with a filter active downloaded everything and displayed none of it.
    const handleRefresh = async () => {
        setLoading(true);
        try {
            const response = await fetchPlaces({
                ...criteria, sort: sortOrder, limit: PLACES_PAGE_SIZE, offset: 0, withStats: true
            });
            setPlaces(response.data);
            setTotal(response.pagination.total);
            setHasMore(response.pagination.hasMore);
            if (response.stats) {
                setStats({
                    totalPlaces: response.stats.total,
                    avgRating: response.stats.avgRating ?? 0,
                    topLocation: response.stats.topLocation || '',
                    locationCount: response.stats.topLocationCount
                });
            }
            setLastUpdated(new Date());
            setError(null);
        } catch (err) {
            console.error('Error refreshing places:', err);
            setError('Failed to refresh. Please try again.');
        } finally {
            setLoading(false);
        }
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

                    <div className="relative z-10 py-6 sm:py-8 md:py-10 bg-cover bg-center" style={{ backgroundImage: "url('/images/hero-bg.jpg')" }}>
                        {/* Dark overlay for readability */}
                        <div className="absolute inset-0 bg-black/60"></div>
                        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.6 }}
                                className="text-center max-w-4xl mx-auto text-white"
                            >
                                {/* Heading */}
                                <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">
                                    <span className="block">Discover</span>
                                    <span className="block bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
                                        Amazing Places
                                    </span>
                                </h1>

                                {/* Subheading */}
                                <p className="mt-2 text-xs sm:text-sm md:text-base text-gray-200 max-w-lg mx-auto leading-snug">
                                    Explore breathtaking destinations, hidden gems, and unforgettable experiences.
                                </p>

                                {/* Search bar */}
                                <div className="mt-4 max-w-md mx-auto">
                                    <div className="relative">
                                        <div className="relative bg-white rounded-md shadow-md border border-gray-200">
                                            <input
                                                type="text"
                                                value={searchTerm}
                                                onChange={(e) => debouncedSearch(e.target.value)}
                                                onFocus={handleSearchFocus}
                                                onBlur={() => setTimeout(() => setSearchActive(false), 200)}
                                                ref={searchInputRef}
                                                placeholder="Search destinations..."
                                                aria-label="Search destinations"
                                                className="block w-full bg-transparent pl-10 pr-4 py-2 text-sm text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 rounded-md"
                                            />
                                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                <FiSearch className="h-4 w-4 text-primary-600" />
                                            </div>
                                            {searchTerm && (
                                                <button
                                                    onClick={() => setSearchTerm('')}
                                                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
                                                >
                                                    <FiX className="h-4 w-4" />
                                                </button>
                                            )}
                                        </div>

                                        {/* Search Suggestions */}
                                        <AnimatePresence>
                                            {searchActive && recentSearches.length > 0 && (
                                                <motion.div
                                                    initial={{ opacity: 0, y: -8 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    exit={{ opacity: 0, y: -8 }}
                                                    className="absolute z-20 mt-1 w-full bg-white rounded-lg shadow-md border border-gray-200 py-2"
                                                >
                                                    <div className="px-2 py-1 border-b border-gray-100">
                                                        <div className="flex justify-between items-center">
                                                            <h3 className="text-xs font-medium text-gray-700">Recent Searches</h3>
                                                            <button
                                                                onClick={clearAllSearchHistory}
                                                                className="text-xs text-primary-600 hover:text-primary-800"
                                                            >
                                                                Clear All
                                                            </button>
                                                        </div>
                                                    </div>
                                                    <ul className="max-h-32 overflow-y-auto">
                                                        {recentSearches.map((term, index) => (
                                                            <li key={index} className="flex items-center hover:bg-gray-50">
                                                                <button
                                                                    type="button"
                                                                    className="flex flex-1 items-center px-3 py-1 text-gray-600 text-sm text-left"
                                                                    onClick={() => useSearchSuggestion(term)}
                                                                >
                                                                    <FiClock className="h-3 w-3 mr-2 text-gray-400" />
                                                                    <span>{term}</span>
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={(e) => clearSearchTerm(term, e)}
                                                                    aria-label={`Remove "${term}" from recent searches`}
                                                                    className="px-3 py-1 text-gray-400 hover:text-gray-600"
                                                                >
                                                                    <FiX className="h-3 w-3" />
                                                                </button>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                </div>

                                {/* Theme Chips */}
                                <div className="mt-4">
                                    <p className="text-xs text-gray-300 mb-2">Popular Themes</p>
                                    <div className="flex flex-wrap justify-center gap-2">
                                        {isClient &&
                                            themeOptions.map((theme) => (
                                                <motion.button
                                                    key={theme.id}
                                                    whileHover={{ scale: 1.05 }}
                                                    whileTap={{ scale: 0.95 }}
                                                    onClick={() => handleThemeToggle(theme.id)}
                                                    className={`group flex items-center px-3 py-1 rounded-md text-xs font-medium transition-all ${selectedThemes.includes(theme.id)
                                                            ? `${theme.bgColor} text-white shadow-sm`
                                                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                                        }`}
                                                >
                                                    <span className="mr-1">{theme.icon}</span>
                                                    <span>{theme.label}</span>
                                                    {selectedThemes.includes(theme.id) && (
                                                        <motion.span
                                                            initial={{ scale: 0 }}
                                                            animate={{ scale: 1 }}
                                                            className="ml-1"
                                                        >
                                                            <FiCheck className="h-3 w-3" />
                                                        </motion.span>
                                                    )}
                                                </motion.button>
                                            ))}
                                    </div>
                                </div>

                                {/* Stats Section */}
                                <motion.div
                                    initial={{ opacity: 0, y: 15 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.3, duration: 0.5 }}
                                    className="mt-6 flex flex-wrap justify-center gap-4"
                                >
                                    <div className="text-center">
                                        <div className="text-lg font-bold text-primary-400">{stats.totalPlaces}+</div>
                                        <div className="text-xs text-gray-300">Places</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-lg font-bold text-yellow-400">{stats.avgRating}</div>
                                        <div className="text-xs text-gray-300 flex items-center justify-center">
                                            <FiStar className="h-3 w-3 mr-1" />
                                            Avg Rating
                                        </div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-lg font-bold text-green-400">{stats.locationCount}</div>
                                        <div className="text-xs text-gray-300">Top Destinations</div>
                                    </div>
                                </motion.div>
                            </motion.div>
                        </div>
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
                                                aria-label="Search places"
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
                                            {total} {total === 1 ? 'place' : 'places'} found
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
                                            className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-primary-100 text-primary-800"
                                        >
                                            <FiCalendar className="mr-1 h-4 w-4" />
                                            {dateOptions.find(d => d.id === selectedDate)?.label || selectedDate}
                                            <motion.button
                                                whileHover={{ scale: 1.2 }}
                                                whileTap={{ scale: 0.9 }}
                                                onClick={() => setSelectedDate('any')}
                                                className="ml-1 text-primary-600 hover:text-primary-800"
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
                                    Found {total} {total === 1 ? 'place' : 'places'}
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

                                <div className="p-6 pb-0">
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
        {/* Location Dropdown */}
        <div>
            <label htmlFor="desktop-location" className="block text-sm font-medium text-gray-700 mb-1">
                Location
            </label>
            <select
                id="desktop-location"
                value={selectedLocation}
                onChange={(e) => setSelectedLocation(e.target.value)}
                className="block w-full bg-white border border-gray-200 rounded-lg shadow-md hover:shadow-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 px-4 py-2 text-gray-700 text-sm transition-all duration-300 ease-in-out cursor-pointer"
            >
                <option value="">All Locations</option>
                {locations.map((loc, index) => (
                    <option key={index} value={loc}>{loc}</option>
                ))}
            </select>
            {selectedLocation && (
                <div className="flex flex-wrap gap-2 mt-2">
                    <span className="px-3 py-1 text-sm bg-primary-100 text-primary-700 rounded-full shadow-sm flex items-center gap-1">
                        <FiMapPin className="h-4 w-4" /> {selectedLocation}
                    </span>
                </div>
            )}
        </div>

        {/* District Dropdown */}
        <div>
            <label htmlFor="desktop-district" className="block text-sm font-medium text-gray-700 mb-1">
                District
            </label>
            <select
                id="desktop-district"
                value={selectedDistrict}
                onChange={(e) => setSelectedDistrict(e.target.value)}
                className="block w-full bg-white border border-gray-200 rounded-lg shadow-md hover:shadow-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 px-4 py-2 text-gray-700 text-sm transition-all duration-300 ease-in-out cursor-pointer"
            >
                <option value="">All Districts</option>
                {districts.map((district, index) => (
                    <option key={index} value={district}>{district}</option>
                ))}
            </select>
            {selectedDistrict && (
                <div className="flex flex-wrap gap-2 mt-2">
                    <span className="px-3 py-1 text-sm bg-primary-100 text-primary-700 rounded-full shadow-sm flex items-center gap-1">
                        <FiMapPin className="h-4 w-4" /> {selectedDistrict}
                    </span>
                </div>
            )}
        </div>

        {/* State Dropdown */}
        <div>
            <label htmlFor="desktop-state" className="block text-sm font-medium text-gray-700 mb-1">
                States
            </label>
            <select
                id="desktop-state"
                value={selectedState}
                onChange={(e) => setSelectedState(e.target.value)}
                className="block w-full bg-white border border-gray-200 rounded-lg shadow-md hover:shadow-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 px-4 py-2 text-gray-700 text-sm transition-all duration-300 ease-in-out cursor-pointer"
            >
                <option value="">All States</option>
                {states.map((state, index) => (
                    <option key={index} value={state}>{state}</option>
                ))}
            </select>
            {selectedState && (
                <div className="flex flex-wrap gap-2 mt-2">
                    <span className="px-3 py-1 text-sm bg-primary-100 text-primary-700 rounded-full shadow-sm flex items-center gap-1">
                        <FiMapPin className="h-4 w-4" /> {selectedState}
                    </span>
                </div>
            )}
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
                                                        ? 'bg-primary-100 text-primary-800 border border-primary-300'
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
                                            {total}
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
                                {currentUser && (currentUser.displayName || currentUser.email) && (
                                    <div className="mt-6 pt-4 border-t border-gray-100">
                                        <div className="flex items-center text-xs text-gray-500">
                                            <FiUser className="h-3 w-3 mr-1" />
                                            <span>Logged in as</span>
                                            <span className="ml-1 font-medium text-primary-600">
                                                {currentUser.displayName || currentUser.email}
                                            </span>
                                        </div>
                                    </div>
                                )}

                                {/* Data timestamp */}
                                {lastUpdated && (
                                    <div className="mt-4 text-xs text-center text-gray-400">
                                        <div className="flex items-center justify-center">
                                            <FiClock className="mr-1 h-3 w-3" />
                                            <span>Data updated: {lastUpdated.toLocaleString()}</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </aside>

                        {/* Places Grid/List */}
                        <div className="mt-6 lg:mt-0 lg:col-span-3">
                            {/* Desktop results header: result count + view toggle. The search input that used to
                                sit here duplicated the hero search above it (IMP-029). */}
                            <div className="hidden md:flex justify-between items-center mb-6 bg-white shadow-lg rounded-xl p-6 border border-gray-100">
                                <div className="flex-1 max-w-md relative">
                                    <div className="text-sm text-gray-500">
                                        {total} {total === 1 ? 'place' : 'places'} found
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
                                                className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${viewMode === mode.id
                                                        ? 'bg-white text-primary-600 shadow-sm'
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
                                                            className={`flex items-center justify-between px-4 py-3 text-sm w-full text-left transition-colors ${sortOrder === option.id
                                                                    ? 'bg-primary-50 text-primary-700'
                                                                    : 'text-gray-700 hover:bg-gray-50'
                                                                }`}
                                                        >
                                                            <div className="flex items-center">
                                                                <span className="mr-3">{option.icon}</span>
                                                                <span>{option.label}</span>
                                                            </div>
                                                            {sortOrder === option.id && (
                                                                <FiCheck className="h-4 w-4 text-primary-600" />
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
                                        aria-label="Refresh results"
                                        className={`p-3 border-2 border-gray-200 rounded-xl text-gray-700 hover:bg-gray-50 transition-all shadow-sm ${loading ? 'animate-pulse' : ''
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
                                    <p className="text-xl text-primary-800 mt-6 font-medium">Loading amazing destinations...</p>
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
                                            className="inline-flex items-center px-6 py-3 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 transition-colors"
                                        >
                                            <FiRefreshCw className="mr-2 h-5 w-5" />
                                            Try Again
                                        </motion.button>
                                    </motion.div>
                                </div>
                            ) : places.length === 0 ? (
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
                                            className="inline-flex items-center px-6 py-3 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 transition-colors"
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
                                            className={`bg-white rounded-xl shadow-lg overflow-hidden ${mapFullscreen
                                                    ? 'fixed inset-4 z-50'
                                                    : 'h-96 sm:h-[500px] lg:h-[600px]'
                                                }`}
                                        >
                                            <div className="h-full relative">
                                                <ExploreMap
                                                    places={mapPlaces}
                                                    className="h-full w-full rounded-xl"
                                                />

                                                {/* Map overlay with place count. Markers are their
                                                    own request, so this reports its own state
                                                    rather than borrowing the grid's. */}
                                                <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-sm rounded-lg px-4 py-2 shadow-lg">
                                                    <div className="flex items-center text-sm font-medium text-gray-700">
                                                        <FiMapPin className="h-4 w-4 mr-2 text-primary-600" />
                                                        {mapLoading
                                                            ? 'Loading places…'
                                                            : `${mapPlaces.length} ${mapPlaces.length === 1 ? 'place' : 'places'}`}
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
                                    {/*
                                        No `LayoutGroup` and no `layout` prop (IMP-045). Layout
                                        animation makes Framer measure the bounding box of every
                                        participating element on each list change, so a filter
                                        toggle forced a synchronous layout read across the whole
                                        grid — the most expensive thing on the page, spent
                                        animating cards between positions nobody was tracking.
                                        The entrance fade stays; it costs nothing to measure.
                                    */}
                                    {viewMode === 'grid' && (
                                        <motion.div
                                            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
                                            variants={staggerChildren}
                                            initial="hidden"
                                            animate="visible"
                                        >
                                            {places.map((place, index) => (
                                                <motion.div
                                                    key={place.id}
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
                                    )}

                                    {/* List View */}
                                    {viewMode === 'list' && (
                                        <motion.div className="space-y-6">
                                                {places.map((place, index) => (
                                                    <motion.div
                                                        key={place.id}
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
                                                                                className={`inline-flex items-center text-white text-xs px-2 py-1 rounded-full backdrop-blur-sm shadow-sm ${themeOption?.bgColor || 'bg-gray-500'
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
                                                                        className="hover:text-primary-600 transition-colors group flex-1"
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
                                                                    <FiMapPin className="mr-1 text-primary-500" />
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
                                                                            <span className="text-xs text-primary-600 hover:text-primary-700 cursor-pointer">
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
                                                                        className="inline-flex items-center text-primary-600 hover:text-primary-800 font-medium transition-colors"
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
                                    )}

                                    {/* Load more. The next page is a request now rather than a
                                        slice of memory, so the button has to report that it is
                                        working and refuse a second click while it does. */}
                                    {hasMore && viewMode !== 'map' && (
                                        <div ref={loadMoreRef} className="flex justify-center py-8">
                                            <motion.button
                                                whileHover={loadingMore ? undefined : { scale: 1.05 }}
                                                whileTap={loadingMore ? undefined : { scale: 0.95 }}
                                                onClick={loadMore}
                                                disabled={loadingMore}
                                                aria-busy={loadingMore}
                                                className="inline-flex items-center px-8 py-4 border border-gray-300 rounded-xl shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors disabled:opacity-60 disabled:cursor-wait"
                                            >
                                                <span>{loadingMore ? 'Loading…' : 'Load More Places'}</span>
                                                {loadingMore
                                                    ? <FiLoader className="ml-2 h-4 w-4 animate-spin" />
                                                    : <FiChevronDown className="ml-2 h-4 w-4" />}
                                            </motion.button>
                                        </div>
                                    )}

                                    {/* Results count */}
                                    {viewMode !== 'map' && (
                                        <div className="text-center text-sm text-gray-500 bg-white rounded-xl py-4 shadow-sm">
                                            Showing {places.length} of {total} results
                                            {hasActiveFilters() && (
                                                <span className="ml-2">
                                                    • <button
                                                        onClick={clearAllFilters}
                                                        className="text-primary-600 hover:text-primary-800 underline"
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
                {icon && <span className="mr-2 group-hover:text-primary-600 transition-colors">{icon}</span>}
                <span className="group-hover:text-primary-600 transition-colors">{title}</span>
            </div>
            <motion.div
                className="bg-gray-100 group-hover:bg-primary-100 rounded-full p-1 transition-colors"
                whileTap={{ scale: 0.95 }}
            >
                <motion.div
                    initial={false}
                    animate={{ rotate: collapsed ? 0 : 180 }}
                    transition={{ duration: 0.3, type: 'spring' }}
                >
                    <FiChevronDown className="h-4 w-4 group-hover:text-primary-600 transition-colors" />
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

    // The API returns an absolute CDN url or null, so the proxy fallback is gone (IMP-037), and
    // with it the `?t=${Date.now()}` cache-buster — it ran on every render, not just in
    // development builds as intended, so each re-render produced a new URL and re-fetched.
    const getImageUrl = () => {
        // Card-sized delivery transform: never pull the full-resolution original into a ~400px slot
        if (place.primary_image_url) return getCloudinaryThumbnail(place.primary_image_url);
        if (place.image_url) return getCloudinaryThumbnail(place.image_url);
        return '/images/placeholder.jpg';
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

/**
 * Render the first page of results on the server (IMP-040).
 *
 * `getServerSideProps` rather than `getStaticProps`: this page's content is a function of its
 * query string, and the filter space — free text crossed with eight dimensions — has no bounded
 * set of paths to pre-render. It is also the page most often arrived at through a shared filtered
 * link, which is exactly the case that was worst before: the client mounted, read the URL, fetched
 * the unfiltered catalogue, then fetched again with filters applied.
 *
 * An unreachable API renders the page rather than failing the request: filters and chrome still
 * work, and the client retries. A 500 here would take out the whole route.
 */
export async function getServerSideProps({ query, res }) {
    const asArray = (value) => (value === undefined ? [] : Array.isArray(value) ? value : [value]);
    const parsedRating = Number.parseInt(query.rating, 10);

    const filters = {
        searchTerm: query.q || '',
        location: query.location || '',
        district: query.district || '',
        state: query.state || '',
        themes: asArray(query.theme),
        tags: asArray(query.tag),
        date: query.date || 'any',
        minRating: Number.isFinite(parsedRating) ? parsedRating : 0
    };

    // The rendered HTML depends only on the query string, so it is shareable between users, but
    // it must not be held long — a new place should appear without waiting out a cache.
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=60, stale-while-revalidate=300');

    try {
        const [results, facets] = await Promise.all([
            fetchPlaces({
                searchTerm: filters.searchTerm || undefined,
                location: filters.location || undefined,
                district: filters.district || undefined,
                state: filters.state || undefined,
                themes: filters.themes.length ? filters.themes : undefined,
                tags: filters.tags.length ? filters.tags : undefined,
                date: filters.date !== 'any' ? filters.date : undefined,
                minRating: filters.minRating > 0 ? filters.minRating : undefined,
                sort: 'newest',
                limit: PLACES_PAGE_SIZE,
                offset: 0,
                withStats: true
            }),
            fetchFacets()
        ]);

        return { props: { initialResults: results, initialFacets: facets, initialFilters: filters } };
    } catch (error) {
        console.error('[getServerSideProps] browse:', error.message);
        return {
            props: {
                initialResults: null,
                initialFacets: null,
                initialFilters: filters,
                initialError: 'Failed to load places. Please try again.'
            }
        };
    }
}

export default Browse;
