import Link from 'next/link';
import { FiStar, FiMapPin, FiChevronRight } from 'react-icons/fi';

const FALLBACK_IMAGE = '/images/placeholder.jpg';

export default function PlaceFeatureCard({ place, size = 'medium' }) {
  return (
    <div className={`group relative overflow-hidden rounded-xl shadow-lg ${
      size === 'large' ? 'h-96' : size === 'small' ? 'h-48' : 'h-64'
    }`}>
      <img
        src={place.primary_image_url || place.image_url || FALLBACK_IMAGE}
        alt={place.name}
        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent"></div>
      <div className="absolute bottom-0 left-0 right-0 p-4">
        <h3 className={`font-bold text-white ${
          size === 'large' ? 'text-2xl' : 'text-lg'
        }`}>{place.name}</h3>
        <div className="flex items-center text-white/90 text-sm mb-2">
          <FiMapPin className="mr-1 h-3 w-3" />
          <span>{place.location}</span>
        </div>
        {size === 'large' && (
          <p className="text-white/80 text-sm mb-4 line-clamp-2">
            {place.description}
          </p>
        )}
        <Link
          href={`/places/${place.id}`}
          className={`inline-flex items-center ${
            size === 'large'
              ? 'px-4 py-2 bg-white text-primary-700 rounded-lg font-medium hover:bg-gray-100'
              : 'text-white hover:text-primary-300'
          }`}
        >
          {size === 'large' ? 'Explore Now' : 'View Details'}
          <FiChevronRight className="ml-1 h-4 w-4" />
        </Link>
      </div>
      {place.rating_count > 0 && (
        <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-sm text-white px-2 py-1 rounded-lg flex items-center">
          <FiStar className="mr-1 text-yellow-400" />
          <span className="font-medium">
            {(place.rating_sum / place.rating_count).toFixed(1)}
          </span>
        </div>
      )}
    </div>
  );
}
