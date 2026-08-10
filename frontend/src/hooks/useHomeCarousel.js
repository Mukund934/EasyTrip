import { useState, useEffect, useRef } from 'react';
import { formatAverageRating } from '../utils/rating';

/** How long a slide transition is locked, and how long a slide is shown. */
const TRANSITION_MS = 500;
const AUTOPLAY_MS = 5000;

/**
 * Where liked places live between visits.
 *
 * One constant, not the same literal in the read effect and the write effect: renaming one and not
 * the other loses every user's saved likes with no error anywhere — new likes save, and nothing
 * ever reads them back.
 */
const LIKES_STORAGE_KEY = 'easytrip_liked_places';

/**
 * The landing page's hero carousel (IMP-070 / IMP-124 line criterion).
 *
 * `isTransitioning` is a lock, not decoration: without it a fast click or a swipe landing during
 * an in-flight slide change queues a second index update and the direction animation plays
 * backwards. Every navigation path goes through it.
 */
export function useHomeCarousel(places, loadError) {
  const [currentPlaceIndex, setCurrentPlaceIndex] = useState(0);
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

  /**
   * Restore liked places, then allow persistence — in that order, enforced.
   *
   * `likesRestored` is not bookkeeping; without it the feature loses data. Both effects run on
   * mount, and the write effect closes over the *initial* `[]`, so it overwrites the stored value
   * before the restore has been applied. With `reactStrictMode` on, React then re-invokes both
   * effects: the second read sees the `[]` it just wrote and resets state to empty. **The result
   * was that every liked place was destroyed on every page load in development**, and in
   * production the value was momentarily blanked before being rewritten — a window in which
   * closing the tab lost the data.
   *
   * Found by the E2E persistence test (`TD-018`), which seeded four likes, reloaded, and got back
   * an empty array.
   */
  const [likesRestored, setLikesRestored] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(LIKES_STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Guard the shape too: the UI does `likedPlaces.includes(id)`, which silently misbehaves
        // rather than throwing if a corrupted value is not an array.
        if (Array.isArray(parsed)) setLikedPlaces(parsed);
      } catch (e) {
        console.error('Error loading liked places:', e);
      }
    }
    setLikesRestored(true);
  }, []);

  useEffect(() => {
    // Never write before the restore has run, or the write races it and wins.
    if (!likesRestored) return;
    localStorage.setItem(LIKES_STORAGE_KEY, JSON.stringify(likedPlaces));
  }, [likedPlaces, likesRestored]);

  // Autoplay carousel
  useEffect(() => {
    if (autoplay && places.length > 0 && !isTransitioning) {
      autoplayRef.current = setInterval(() => {
        setDirection(1);
        setIsTransitioning(true);
        setCurrentPlaceIndex((prev) => (prev + 1) % places.length);
        setTimeout(() => setIsTransitioning(false), TRANSITION_MS);
      }, AUTOPLAY_MS); // 5 seconds for both mobile and desktop
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
    setCurrentPlaceIndex((prev) => (prev + 1) % places.length);
    setTimeout(() => setIsTransitioning(false), TRANSITION_MS);
  };

  const goToPrevPlace = () => {
    if (isTransitioning) return;
    setDirection(-1);
    setIsTransitioning(true);
    setCurrentPlaceIndex((prev) => (prev - 1 + places.length) % places.length);
    setTimeout(() => setIsTransitioning(false), TRANSITION_MS);
  };

  const goToPlace = (index) => {
    if (index === currentPlaceIndex || isTransitioning) return;
    setDirection(index > currentPlaceIndex ? 1 : -1);
    setIsTransitioning(true);
    setCurrentPlaceIndex(index);
    setTimeout(() => setIsTransitioning(false), TRANSITION_MS);
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
    setLikedPlaces((prev) =>
      prev.includes(id) ? prev.filter((placeId) => placeId !== id) : [...prev, id]
    );
  };

  // 'New' is this page's answer for an unrated place; the helper takes it as a parameter so the
  // three pages that each invented their own empty value cannot drift apart again (IMP-073).
  const calculateRating = (place) => formatAverageRating(place, 'New');

  return {
    places,
    error: loadError,
    currentPlaceIndex,
    autoplay,
    direction,
    likedPlaces,
    isMobile,
    isTransitioning,
    carouselRef,
    setAutoplay,
    goToNextPlace,
    goToPrevPlace,
    goToPlace,
    handleDragEnd,
    toggleLike,
    calculateRating
  };
}
