import Link from 'next/link';
import { FiStar, FiMapPin, FiChevronRight } from 'react-icons/fi';

const FALLBACK_IMAGE = '/images/placeholder.jpg';

export default function PlaceCompactCard({ place }) {
  return (
    <div className="bg-white rounded-xl overflow-hidden shadow-md hover:shadow-lg transition-shadow duration-300 group">
      <div className="relative h-40">
        <img
          src={place.primary_image_url || place.image_url || FALLBACK_IMAGE}
          alt={place.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
        {place.rating_count > 0 && (
          <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm text-white px-1.5 py-0.5 rounded text-xs flex items-center">
            <FiStar className="mr-0.5 h-3 w-3 text-yellow-400" />
            <span className="font-medium">
              {(place.rating_sum / place.rating_count).toFixed(1)}
            </span>
          </div>
        )}
      </div>
      <div className="p-3">
        <h3 className="font-bold text-gray-900 line-clamp-1 group-hover:text-primary-600 transition-colors">
          {place.name}
        </h3>
        <div className="flex items-center text-gray-500 text-sm mb-2">
          <FiMapPin className="mr-1 h-3 w-3" />
          <span className="truncate">{place.location}</span>
        </div>
        <Link
          href={`/places/${place.id}`}
          className="mt-1 text-primary-600 hover:text-primary-800 text-sm font-medium flex items-center"
        >
          View Details
          <FiChevronRight className="ml-1 h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}
