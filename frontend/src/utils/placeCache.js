// // Simple client-side cache for places
// const CACHE_KEY = 'easytrip_places_cache';
// const CACHE_EXPIRY = 1000 * 60 * 60; // 1 hour

// export const getPlacesFromCache = () => {
//   if (typeof window === 'undefined') return null;
  
//   try {
//     const cachedData = localStorage.getItem(CACHE_KEY);
//     if (!cachedData) return null;
    
//     const { places, timestamp } = JSON.parse(cachedData);
    
//     // Check if cache is expired
//     if (Date.now() - timestamp > CACHE_EXPIRY) {
//       localStorage.removeItem(CACHE_KEY);
//       return null;
//     }
    
//     return places;
//   } catch (error) {
//     console.error('Error retrieving places from cache:', error);
//     return null;
//   }
// };

// export const cachePlaces = (places) => {
//   if (typeof window === 'undefined' || !places) return;
  
//   try {
//     const cacheData = {
//       places,
//       timestamp: Date.now()
//     };
    
//     localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
//   } catch (error) {
//     console.error('Error caching places:', error);
//   }
// };