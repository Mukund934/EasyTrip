import Link from 'next/link';
import { FiStar, FiHeart, FiMapPin } from 'react-icons/fi';

const FALLBACK_IMAGE = '/images/placeholder.jpg';

export default function PlaceGalleryCard({ place, onFavorite, priority = false }) {
  return (
    <div className="bg-white rounded-xl overflow-hidden shadow-lg hover:shadow-xl transition-shadow duration-300 h-full flex flex-col group">
      <div className="relative h-52 overflow-hidden">
        <img 
          src={place.primary_image_url || place.image_url || FALLBACK_IMAGE} 
          alt={place.name}
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
          loading={priority ? "eager" : "lazy"}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent"></div>
        {place.rating_count > 0 && (
          <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-sm text-white px-2 py-1 rounded-lg flex items-center">
            <FiStar className="mr-1 text-yellow-400" />
            <span className="font-medium">
              {(place.rating_sum / place.rating_count).toFixed(1)}
            </span>
          </div>
        )}
        <button 
          onClick={e => {
            e.preventDefault();
            if (onFavorite) onFavorite();
          }}
          className="absolute top-3 left-3 w-8 h-8 flex items-center justify-center bg-black/60 backdrop-blur-sm text-white rounded-full hover:bg-red-500/80 transition-colors"
        >
          <FiHeart className="h-4 w-4" />
        </button>
        <div className="absolute bottom-3 left-3 right-3">
          <h3 className="text-lg font-bold text-white line-clamp-1">{place.name}</h3>
          <div className="flex items-center text-white/90 text-sm">
            <FiMapPin className="mr-1 h-3 w-3" />
            <span className="truncate">{place.location}</span>
          </div>
        </div>
      </div>
      <div className="p-4 flex-grow flex flex-col">
        <div className="flex-grow">
          <p className="text-gray-600 text-sm line-clamp-2 mb-3">
            {place.description || 'Explore this amazing destination and discover its unique features and attractions.'}
          </p>
          <div className="flex flex-wrap gap-1 mb-3">
            {place.tags?.slice(0, 3).map((tag, idx) => (
              <span key={idx} className="text-xs text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full">
                {tag}
              </span>
            ))}
            {place.tags?.length > 3 && (
              <span className="text-xs text-gray-500">+{place.tags.length - 3}</span>
            )}
          </div>
        </div>
        <Link
          href={`/places/${place.id}`}
          className="mt-2 w-full py-2 bg-primary-600 text-white rounded-lg text-center font-medium hover:bg-primary-700 transition-colors"
        >
          View Details
        </Link>
      </div>
    </div>
  );
}
