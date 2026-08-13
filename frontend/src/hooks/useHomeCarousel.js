import { useState, useEffect, useRef } from 'react';
import { formatAverageRating } from '../utils/rating';
import { useWishlist } from './useWishlist';

/** How long a slide transition is locked, and how long a slide is shown. */
const TRANSITION_MS = 500;
const AUTOPLAY_MS = 5000;

/**
 * The landing page's hero carousel (IMP-070 / IMP-124 line criterion).
 *
 * `isTransitioning` is a lock, not decoration: without it a fast click or a swipe landing during
 * an in-flight slide change queues a second index update and the direction animation plays
 * backwards. Every navigation path goes through it.
 *
 * **Likes moved out in `IMP-108`.** This hook used to own `easytrip_liked_places` — the read
 * effect, the write effect, the `likesRestored` gate between them, and the storage key itself. All
 * of it is now `useWishlist`, because the detail page's heart had a *second*, incompatible
 * implementation (`useState(false)`, ephemeral) and one of the two had to stop being the source of
 * truth. The signed-out behaviour, including the storage key and the array-of-numbers shape
 * `TD-018` asserts on, is unchanged.
 */
export function useHomeCarousel(places, loadError) {
  const [currentPlaceIndex, setCurrentPlaceIndex] = useState(0);
  const [autoplay, setAutoplay] = useState(true);
  const [direction, setDirection] = useState(1);
  const [isMobile, setIsMobile] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const carouselRef = useRef(null);
  const autoplayRef = useRef(null);

  const wishlist = useWishlist();

  // Check screen size
  useEffect(() => {
    const checkScreenSize = () => setIsMobile(window.innerWidth < 768);
    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

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

  // Toggle like. `stopPropagation` still belongs here — the heart sits inside the slide, which is
  // itself clickable, and without it liking a place also navigates to it.
  const toggleLike = (e, id) => {
    e.stopPropagation();
    wishlist.toggle(id);
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
    // Still called `likedPlaces` because that is what the two hero components read, and renaming a
    // prop across them is churn this change does not need. It is now the wishlist's id list.
    likedPlaces: wishlist.savedIds,
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
