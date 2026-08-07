import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Head from 'next/head';
import { useInView } from 'react-intersection-observer';
import debounce from 'lodash/debounce';

import { fetchPlaces, fetchFacets, PLACES_PAGE_SIZE } from '../services/placesApi';
import { useAuth } from '../context/AuthContext';
import { useBrowseFilters } from '../hooks/useBrowseFilters';
import { useBrowsePlaces } from '../hooks/useBrowsePlaces';
import { useBrowseFacets, useBrowseMapPlaces } from '../hooks/useBrowseFacets';
import { useRecentSearches } from '../hooks/useRecentSearches';
import BrowseHero from '../components/browse/BrowseHero';
import BrowseMobileFilters from '../components/browse/BrowseMobileFilters';
import BrowseToolbar from '../components/browse/BrowseToolbar';
import BrowseActiveFilters from '../components/browse/BrowseActiveFilters';
import BrowseFilterPanel from '../components/browse/BrowseFilterPanel';
import BrowseResults from '../components/browse/BrowseResults';

function Browse({ initialResults, initialFacets, initialFilters, initialError }) {
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

  // ---------------------------------------------------------------------------
  // Filters, results, facets and history live in hooks; the markup lives in
  // `components/browse/` (IMP-070).
  //
  // What is left here is the wiring: this page owns the state that two sections disagree about —
  // the sort order is set from three places and read by two, the view mode is set by the toolbar
  // and read by the results — and hands each section the slice it needs. Anything owned by exactly
  // one section moved into that section.
  // ---------------------------------------------------------------------------
  const {
    filters,
    setFilter,
    toggleTheme: handleThemeToggle,
    toggleTag: handleTagToggle,
    clearAllFilters: resetFilters,
    criteria,
    criteriaKey,
    activeFilterCount,
    hasActiveFilters
  } = useBrowseFilters(initialFilters);

  // One object, memoised, rather than eight props repeated across four sections. Stable because
  // every member is itself stable — a new object here would re-render every section on every
  // keystroke.
  const setters = useMemo(
    () => ({
      setSearchTerm: (value) => setFilter('searchTerm', value),
      setSelectedLocation: (value) => setFilter('location', value),
      setSelectedDistrict: (value) => setFilter('district', value),
      setSelectedState: (value) => setFilter('state', value),
      setSelectedDate: (value) => setFilter('date', value),
      setRatingFilter: (value) => setFilter('minRating', value),
      handleThemeToggle,
      handleTagToggle
    }),
    [setFilter, handleThemeToggle, handleTagToggle]
  );

  const facets = useBrowseFacets(initialFacets);

  const { recentSearches, remember, removeSearch, clearAll } = useRecentSearches();

  // View state. Not filters — these change what the same result set looks like, not what it is,
  // and they deliberately do not appear in the URL.
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [viewMode, setViewMode] = useState('grid'); // 'grid', 'list', or 'map'
  const [sortOrder, setSortOrder] = useState('newest');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [searchActive, setSearchActive] = useState(false);
  const [mapFullscreen, setMapFullscreen] = useState(false);
  const searchInputRef = useRef(null);
  const [collapsedSections, setCollapsedSections] = useState({
    themes: false,
    location: false,
    rating: false,
    date: false,
    tags: false
  });

  // Infinite scroll sentinel
  const { ref: loadMoreRef, inView } = useInView({
    threshold: 0.1,
    triggerOnce: false,
    rootMargin: '400px 0px'
  });

  const {
    places,
    total,
    hasMore,
    loading,
    initialLoading,
    loadingMore,
    error,
    stats,
    lastUpdated,
    loadMore,
    refresh: handleRefresh
  } = useBrowsePlaces({
    criteria,
    criteriaKey,
    sortOrder,
    initialResults,
    initialError,
    inView
  });

  const { mapPlaces, mapLoading } = useBrowseMapPlaces({ viewMode, criteria, criteriaKey });

  // Detect screen size changes.
  //
  // The page size no longer varies with the viewport: it is a server `LIMIT` now, and changing it
  // mid-session would shift every subsequent offset, which is how offset pagination starts
  // duplicating and skipping rows.
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

  // Debounced search.
  //
  // useMemo, not useCallback: the debounce() call was evaluated on every render and handed to
  // useCallback, which — with an empty dependency array — kept the first one and discarded the
  // rest. A fresh timer object allocated per render for nothing.
  const debouncedSearch = useMemo(
    () =>
      debounce((term) => {
        setters.setSearchTerm(term);
        remember(term);
      }, 300),
    [setters, remember]
  );

  // Cancel a pending search on unmount: without this the trailing call can land after the
  // component is gone and set state on it.
  useEffect(() => () => debouncedSearch.cancel(), [debouncedSearch]);

  // Handle section toggle with animation
  const toggleSection = useCallback((section) => {
    setCollapsedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  }, []);

  // Clear all filters. The flash-highlight stays here rather than in the hook: it is a DOM effect
  // on one specific element, and a hook that reaches for getElementById cannot be tested.
  const clearAllFilters = useCallback(() => {
    document.getElementById('filter-panel')?.classList.add('flash-highlight');
    setTimeout(() => {
      document.getElementById('filter-panel')?.classList.remove('flash-highlight');
    }, 500);

    resetFilters();
  }, [resetFilters]);

  // Everything the hero's search box needs, in one prop rather than nine.
  const search = useMemo(
    () => ({
      debouncedSearch,
      searchActive,
      setSearchActive,
      searchInputRef,
      recentSearches,
      handleSearchFocus: () => {
        setSearchActive(true);
        searchInputRef.current?.focus();
      },
      applySearchSuggestion: (term) => {
        setters.setSearchTerm(term);
        setSearchActive(false);
        remember(term);
      },
      // The row is a button inside a button-bearing row; without this the suggestion is applied
      // on the way to removing it.
      clearSearchTerm: (term, e) => {
        e.stopPropagation();
        removeSearch(term);
      },
      clearAllSearchHistory: (e) => {
        e.stopPropagation();
        clearAll();
      }
    }),
    [debouncedSearch, searchActive, recentSearches, setters, remember, removeSearch, clearAll]
  );

  return (
    <>
      <Head>
        <title>Explore Amazing Places - EasyTrip</title>
        <meta
          name="description"
          content="Discover breathtaking destinations for your next adventure. Filter and find the perfect place for your trip."
        />
        <meta
          name="keywords"
          content="travel, destinations, places to visit, tourist spots, vacation, trip planning"
        />
        <meta property="og:title" content="Explore Amazing Places - EasyTrip" />
        <meta
          property="og:description"
          content="Discover breathtaking destinations for your next adventure"
        />
        <meta property="og:type" content="website" />
      </Head>

      <div className="bg-gray-50 min-h-screen pt-20">
        <BrowseHero
          isClient={isClient}
          stats={stats}
          filters={filters}
          setters={setters}
          search={search}
        />

        <BrowseMobileFilters
          open={mobileFiltersOpen}
          onClose={setMobileFiltersOpen}
          isClient={isClient}
          total={total}
          filters={filters}
          setters={setters}
          facets={facets}
          collapsedSections={collapsedSections}
          toggleSection={toggleSection}
          clearAllFilters={clearAllFilters}
        />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <BrowseToolbar
            activeFilterCount={activeFilterCount}
            onOpenFilters={setMobileFiltersOpen}
            sortOrder={sortOrder}
            setSortOrder={setSortOrder}
            showSortMenu={showSortMenu}
            setShowSortMenu={setShowSortMenu}
            viewMode={viewMode}
            setViewMode={setViewMode}
          />

          <BrowseActiveFilters
            hasActiveFilters={hasActiveFilters}
            total={total}
            loading={loading}
            onRefresh={handleRefresh}
            filters={filters}
            setters={setters}
            clearAllFilters={clearAllFilters}
          />

          <div className="lg:grid lg:grid-cols-4 lg:gap-x-8">
            <BrowseFilterPanel
              currentUser={currentUser}
              stats={stats}
              total={total}
              lastUpdated={lastUpdated}
              filters={filters}
              setters={setters}
              facets={facets}
              collapsedSections={collapsedSections}
              toggleSection={toggleSection}
              clearAllFilters={clearAllFilters}
              sortOrder={sortOrder}
              setSortOrder={setSortOrder}
              recentSearches={recentSearches}
              clearRecentSearches={clearAll}
            />

            <BrowseResults
              places={places}
              total={total}
              loading={loading}
              initialLoading={initialLoading}
              loadingMore={loadingMore}
              hasMore={hasMore}
              error={error}
              onRefresh={handleRefresh}
              onLoadMore={loadMore}
              loadMoreRef={loadMoreRef}
              viewMode={viewMode}
              setViewMode={setViewMode}
              sortOrder={sortOrder}
              setSortOrder={setSortOrder}
              showSortMenu={showSortMenu}
              setShowSortMenu={setShowSortMenu}
              mapFullscreen={mapFullscreen}
              setMapFullscreen={setMapFullscreen}
              mapPlaces={mapPlaces}
              mapLoading={mapLoading}
              hasActiveFilters={hasActiveFilters}
              clearAllFilters={clearAllFilters}
              handleTagToggle={handleTagToggle}
            />
          </div>
        </div>
      </div>
    </>
  );
}

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
