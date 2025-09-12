import { useState } from 'react';
import { FiStar } from 'react-icons/fi';

const ReviewForm = ({ rating, review, onRatingChange, onReviewChange, onSubmit, isSubmitting }) => {
  const [hoverRating, setHoverRating] = useState(0);
  
  const handleStarClick = (value) => {
    onRatingChange(value);
  };
  
  const handleStarHover = (value) => {
    setHoverRating(value);
  };
  
  const handleStarLeave = () => {
    setHoverRating(0);
  };
  
  return (
    <form onSubmit={onSubmit}>
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Your Rating
        </label>
        <div className="flex">
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => handleStarClick(value)}
              onMouseEnter={() => handleStarHover(value)}
              onMouseLeave={handleStarLeave}
              className="text-2xl mr-1 focus:outline-none"
            >
              <FiStar
                className={`h-8 w-8 ${
                  (hoverRating || rating) >= value
                    ? 'text-yellow-400 fill-current'
                    : 'text-gray-300'
                }`}
              />
            </button>
          ))}
        </div>
      </div>
      
      <div className="mb-4">
        <label htmlFor="review" className="block text-sm font-medium text-gray-700 mb-2">
          Your Review (Optional)
        </label>
        <textarea
          id="review"
          rows="4"
          value={review}
          onChange={(e) => onReviewChange(e.target.value)}
          placeholder="Share your experience..."
          className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
        ></textarea>
      </div>
      
      <button
        type="submit"
        disabled={isSubmitting || rating === 0}
        className="w-full md:w-auto px-6 py-3 bg-primary-600 text-white rounded-md font-medium hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isSubmitting ? (
          <span className="flex items-center justify-center">
            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Submitting...
          </span>
        ) : (
          'Submit Review'
        )}
      </button>
    </form>
  );
};

export default ReviewForm;