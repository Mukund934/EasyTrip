import { useState, useEffect } from 'react';
import Link from 'next/link';
import { searchPlaces } from '../services/placeService';
import PlaceCard from './PlaceCard';

const RelatedPlaces = ({ currentPlaceId, themes, location }) => {
  const [relatedPlaces, setRelatedPlaces] = useState([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const fetchRelatedPlaces = async () => {
      try {
        setLoading(true);
        
        // Create search criteria
        const criteria = {
          ...(themes && themes.length > 0 && { themes }),
          ...(!themes?.length && location && { location })
        };
        
        // Fetch related places
        let results = await searchPlaces(criteria);
        
        // Filter out current place
        results = results.filter(place => place.id.toString() !== currentPlaceId.toString());
        
        // Limit to 4 places
        setRelatedPlaces(results.slice(0, 4));
      } catch (error) {
        console.error('Error fetching related places:', error);
        setRelatedPlaces([]);
      } finally {
        setLoading(false);
      }
    };
    
    if (currentPlaceId && (themes?.length > 0 || location)) {
      fetchRelatedPlaces();
    } else {
      setLoading(false);
    }
  }, [currentPlaceId, themes, location]);
  
  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <div className="w-10 h-10 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }
  
  if (relatedPlaces.length === 0) {
    return (
      <div className="bg-gray-50 rounded-lg p-8 text-center">
        <p className="text-gray-600 mb-4">No related places found.</p>
        <Link 
          href="/browse" 
          className="inline-flex items-center px-4 py-2 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700"
        >
          Browse All Places
        </Link>
      </div>
    );
  }
  
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      {relatedPlaces.map((place) => (
        <PlaceCard key={place.id} place={place} />
      ))}
    </div>
  );
};

export default RelatedPlaces;