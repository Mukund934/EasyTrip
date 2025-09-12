import { FiStar } from 'react-icons/fi';

const RatingStars = ({ rating, count, size = 'medium' }) => {
  // Size classes for different star sizes
  const sizeClasses = {
    small: 'h-3 w-3',
    medium: 'h-5 w-5',
    large: 'h-6 w-6'
  };
  
  // Default to 0 if rating is undefined
  const normalizedRating = rating || 0;
  const displayCount = count || 0;
  
  return (
    <div className="flex items-center">
      <div className="flex">
        {[1, 2, 3, 4, 5].map((star) => (
          <FiStar
            key={star}
            className={`${sizeClasses[size]} ${
              star <= normalizedRating
                ? 'text-yellow-400 fill-current'
                : 'text-gray-300'
            }`}
          />
        ))}
      </div>
      {displayCount > 0 && (
        <span className="ml-1 text-sm text-gray-600">({displayCount})</span>
      )}
    </div>
  );
};

export default RatingStars;