import { FiCamera, FiCompass } from 'react-icons/fi';
import { motion } from 'framer-motion';
import { PlaceAboutSection } from './PlaceAboutSection';
import { PlaceReviewsSection } from './PlaceReviewsSection';
import { PlaceArticleSkeleton } from './PlaceDetailStates';
import { MagazineDetails } from './MagazineDetails';
import MagazineGallery from '../MagazineGallery';
import RelatedPlaces from '../RelatedPlaces';
import { PlaceAccessibility } from './PlaceAccessibility';

/**
 * The article column — the five sections the table of contents lists, in order.
 *
 * Each `<section id>` here is what `useActiveSection` observes, so the ids must stay in step with
 * `PLACE_SECTIONS`. Gallery is conditional: a place with no images renders no gallery section at
 * all rather than an empty one.
 */
export const PlaceArticle = ({
  place,
  images,
  reviews,
  contentLoading,
  authLoading,
  isAuthenticated,
  onViewAllReviews,
  reviewActions
}) => {
  if (contentLoading) {
    return <PlaceArticleSkeleton />;
  }

  return (
    <>
      {/* About Section */}
      <section id="about" className="scroll-mt-24">
        <PlaceAboutSection place={place} />
      </section>

      {/* Additional Details Section */}
      <section id="details" className="scroll-mt-24">
        <MagazineDetails customKeys={place.custom_keys} themes={place.themes} />
      </section>

      {/* Getting in (`FV-029`). Between the details and the gallery, because it is a fact about the
          place rather than a picture of it — and early on a phone, which is where somebody who needs
          it will look first. Renders nothing when nothing has been recorded.
          
          **Deliberately not a `<section id>`.** Every id here is a `PLACE_SECTIONS` entry and the
          table of contents renders those unconditionally, so an "access" link would be a dead
          anchor on every place nobody has surveyed — which today is all of them. It becomes worth
          registering once the catalogue has coverage, and `BL-139` records the ToC change that
          would need to come first. */}
      <PlaceAccessibility place={place} />

      {/* Image Gallery */}
      {images.length > 0 && (
        <section id="gallery" className="scroll-mt-24">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100"
          >
            <h2 className="text-4xl font-serif font-bold text-gray-900 mb-8 flex items-center">
              <div className="p-3 bg-primary-100 rounded-lg mr-4">
                <FiCamera className="text-primary-600 h-7 w-7" />
              </div>
              Photo Gallery
            </h2>
            <MagazineGallery images={images} placeName={place.name} />
          </motion.div>
        </section>
      )}

      {/* Reviews Section */}
      <section id="reviews" className="scroll-mt-24">
        <PlaceReviewsSection
          place={place}
          reviews={reviews}
          contentLoading={contentLoading}
          authLoading={authLoading}
          isAuthenticated={isAuthenticated}
          onViewAll={onViewAllReviews}
          reviewActions={reviewActions}
        />
      </section>

      {/* Related Places */}
      <section id="related" className="scroll-mt-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          <div className="flex items-center mb-10">
            <div className="p-3 bg-emerald-100 rounded-lg mr-4">
              <FiCompass className="text-emerald-600 h-7 w-7" />
            </div>
            <h2 className="text-4xl font-serif font-bold text-gray-900">Similar Adventures</h2>
          </div>

          <RelatedPlaces
            currentPlaceId={place.id}
            themes={place.themes}
            location={place.location}
            isLoading={contentLoading}
          />
        </motion.div>
      </section>
    </>
  );
};
