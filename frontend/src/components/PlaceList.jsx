import PlaceCard from './PlaceCard';

const PlaceList = ({ places }) => {
  if (!places || places.length === 0) {
    return (
      <div className="text-center py-10">
        <p className="text-gray-500">No places found matching your criteria.</p>
      </div>
    );
  }
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {places.map(place => (
        <PlaceCard 
          key={place.id} 
          place={{
            ...place,
            // Ensure image_url is always set
            image_url: place.image_url || `/api/places/${place.id}/image`
          }} 
        />
      ))}
    </div>
  );
};

export default PlaceList;