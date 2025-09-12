import { useState, useEffect, useCallback } from 'react';
import { 
  getAllPlaces as apiGetAllPlaces, 
  getLocations as apiGetLocations,
  searchPlaces as apiSearchPlaces
} from '../services/placeService';

export const usePlaces = () => {
  const [places, setPlaces] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Fetch places from API
  const fetchPlaces = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      console.log(`[${lastUpdated}] Fetching all places by ${currentUser}`);
      
      // Use our modified API function with better error handling
      const data = await apiGetAllPlaces();
      
      if (!data || !Array.isArray(data) || data.length === 0) {
        console.warn('No places data received from API or empty array');
      } else {
        console.log(`[${lastUpdated}] Fetched ${data.length} places`);
        
        // Log first place for debugging if available
        if (data.length > 0) {
          console.log('First place sample:', {
            id: data[0].id,
            name: data[0].name,
            hasImageUrl: !!data[0].image_url,
            tags: Array.isArray(data[0].tags) ? data[0].tags.length : 'not an array'
          });
        }
      }
      
      // Save the data regardless
      setPlaces(data || []);
      return data || [];
    } catch (err) {
      console.error(`[${lastUpdated}] Error fetching places:`, err);
      setError('Failed to load destinations. Please try again.');
      return [];
    } finally {
      setLoading(false);
    }
  }, [currentUser, lastUpdated]);

  // Fetch locations for search filter
  const fetchLocations = useCallback(async () => {
    try {
      console.log(`[${lastUpdated}] Fetching locations by ${currentUser}`);
      const locationsData = await apiGetLocations();
      
      if (Array.isArray(locationsData)) {
        console.log(`[${lastUpdated}] Fetched ${locationsData.length} locations`);
        setLocations(locationsData);
      } else {
        console.warn('Invalid locations data received from API');
        setLocations([]);
      }
    } catch (err) {
      console.error(`[${lastUpdated}] Error fetching locations:`, err);
      setLocations([]);
    }
  }, [currentUser, lastUpdated]);

  // Search places
  const searchPlaces = useCallback(async (criteria) => {
    try {
      console.log(`[${lastUpdated}] Searching places by ${currentUser} with criteria:`, criteria);
      
      // If criteria is empty, return all places
      if (!criteria || ((!criteria.term || criteria.term.trim() === '') && 
          (!criteria.location || criteria.location.trim() === '') && 
          (!criteria.tags || !Array.isArray(criteria.tags) || criteria.tags.length === 0))) {
        console.log(`[${lastUpdated}] No search criteria provided, returning all places`);
        return places;
      }
      
      // Use the API search function
      const results = await apiSearchPlaces({
        searchTerm: criteria.term,
        location: criteria.location,
        tags: criteria.tags
      });
      
      console.log(`[${lastUpdated}] Search returned ${results.length} places`);
      return results;
    } catch (err) {
      console.error(`[${lastUpdated}] Error searching places:`, err);
      // Return existing places on error as fallback
      return places;
    }
  }, [places, currentUser, lastUpdated]);

  // Refresh places data
  const refreshPlaces = useCallback(async () => {
    console.log(`[${lastUpdated}] Refreshing places by ${currentUser}`);
    const data = await fetchPlaces();
    await fetchLocations();
    return data;
  }, [fetchPlaces, fetchLocations, currentUser, lastUpdated]);

  // Initial load
  useEffect(() => {
    console.log(`[${lastUpdated}] Initializing usePlaces hook by ${currentUser}`);
    
    // Define an async function inside useEffect
    const initialize = async () => {
      try {
        const data = await fetchPlaces();
        await fetchLocations();
        
        // Check if data was actually received
        if (!data || data.length === 0) {
          console.warn('No places data available after initialization');
        }
      } catch (err) {
        console.error('Error initializing places data:', err);
      }
    };
    
    initialize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    places,
    locations,
    loading,
    error,
    searchPlaces,
    refreshPlaces
  };
};