import { useState } from 'react';
import { FiStar, FiFlag, FiThumbsUp, FiUser, FiChevronDown, FiChevronUp } from 'react-icons/fi';

const ReviewList = ({ reviews = [], onReportReview, currentUserId }) => {
  const [sortOption, setSortOption] = useState('newest');
  const [expandedReviews, setExpandedReviews] = useState({});
  
  if (!reviews || reviews.length === 0) {
    return (
      <div className="bg-gray-50 rounded-lg p-8 text-center">
        <p className="text-gray-600">No reviews yet. Be the first to share your experience!</p>
      </div>
    );
  }
  
  // Sort reviews based on selected option
  const sortedReviews = [...reviews].sort((a, b) => {
    switch (sortOption) {
      case 'highest':
        return b.rating - a.rating;
      case 'lowest':
        return a.rating - b.rating;
      case 'oldest':
        return new Date(a.created_at) - new Date(b.created_at);
      case 'newest':
      default:
        return new Date(b.created_at) - new Date(a.created_at);
    }
  });
  
  const toggleReviewExpansion = (reviewId) => {
    setExpandedReviews(prev => ({
      ...prev,
      [reviewId]: !prev[reviewId]
    }));
  };
  
  const formatDate = (dateString) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch (e) {
      return 'Unknown date';
    }
  };
  
  return (
    <div>
      {/* Sort controls */}
      <div className="flex justify-end mb-4">
        <select
          value={sortOption}
          onChange={(e) => setSortOption(e.target.value)}
          className="block w-48 border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 text-sm"
        >
          <option value="newest">Newest First</option>
          <option value="oldest">Oldest First</option>
          <option value="highest">Highest Rated</option>
          <option value="lowest">Lowest Rated</option>
        </select>
      </div>
      
      {/* Reviews list */}
      <div className="space-y-6">
        {sortedReviews.map((review) => {
          // Check if review text is long enough to need expansion
          const isLongReview = review.comment && review.comment.length > 300;
          const isExpanded = expandedReviews[review.id];
          const displayText = isLongReview && !isExpanded
            ? `${review.comment.substring(0, 300)}...`
            : review.comment;
            
          return (
            <div key={review.id} className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
              <div className="flex justify-between items-start">
                <div className="flex items-center">
                  {review.user_avatar ? (
                    <img
                      src={review.user_avatar}
                      alt={review.user_name || 'User'}
                      className="w-10 h-10 rounded-full mr-3"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center mr-3">
                      <FiUser className="text-gray-500" />
                    </div>
                  )}
                  <div>
                    <h4 className="font-medium text-gray-900">
                      {review.user_name || 'Anonymous User'}
                      {review.user_id === currentUserId && (
                        <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">You</span>
                      )}
                    </h4>
                    <div className="flex items-center mt-1">
                      <div className="flex">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <FiStar
                            key={star}
                            className={`h-4 w-4 ${
                              star <= review.rating
                                ? 'text-yellow-400 fill-current'
                                : 'text-gray-300'
                            }`}
                          />
                        ))}
                      </div>
                      <span className="text-xs text-gray-500 ml-2">
                        {formatDate(review.created_at)}
                      </span>
                    </div>
                  </div>
                </div>
                
                {review.user_id !== currentUserId && (
                  <button
                    onClick={() => onReportReview(review.id)}
                    className="text-gray-400 hover:text-red-500"
                    title="Report review"
                  >
                    <FiFlag className="h-4 w-4" />
                  </button>
                )}
              </div>
              
              {review.comment && (
                <div className="mt-4">
                  <p className="text-gray-700">{displayText}</p>
                  
                  {isLongReview && (
                    <button
                      onClick={() => toggleReviewExpansion(review.id)}
                      className="mt-2 text-sm text-primary-600 hover:text-primary-800 flex items-center"
                    >
                      {isExpanded ? (
                        <>
                          Show less <FiChevronUp className="ml-1" />
                        </>
                      ) : (
                        <>
                          Read more <FiChevronDown className="ml-1" />
                        </>
                      )}
                    </button>
                  )}
                </div>
              )}
              
              {/* Review images if any */}
              {review.images && review.images.length > 0 && (
                <div className="mt-4 flex space-x-2 overflow-x-auto">
                  {review.images.map((image, index) => (
                    <img
                      key={index}
                      src={image.url}
                      alt={`Review image ${index + 1}`}
                      className="h-20 w-20 object-cover rounded-md"
                    />
                  ))}
                </div>
              )}
              
              {/* Review actions */}
              <div className="mt-4 flex items-center text-sm">
                <button className="flex items-center text-gray-500 hover:text-primary-600">
                  <FiThumbsUp className="h-4 w-4 mr-1" />
                  Helpful ({review.helpful_count || 0})
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ReviewList;