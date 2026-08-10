import Head from 'next/head';
import { getPlaceLargeImageUrl, PLACEHOLDER_IMAGE } from '../../utils/placeImage';

/** Title, description, keywords and the Open Graph / Twitter card for one place. */
export const PlaceSeoHead = ({ place }) => (
  <Head>
    <title>{`${place.name} | EasyTrip Magazine`}</title>
    <meta
      name="description"
      content={
        place.description ||
        `Discover ${place.name} in ${place.location} - Comprehensive travel guide with expert tips, photos and reviews.`
      }
    />
    <meta
      name="keywords"
      content={`${place.name}, ${place.location}, ${place.tags?.join(', ') || 'travel'}, tourism, vacation, travel guide`}
    />
    <meta property="og:title" content={`${place.name} | EasyTrip Magazine`} />
    <meta
      property="og:description"
      content={place.description || `Discover ${place.name} in ${place.location}`}
    />
    <meta property="og:image" content={getPlaceLargeImageUrl(place, 1600, PLACEHOLDER_IMAGE)} />
    <meta property="og:url" content={typeof window !== 'undefined' ? window.location.href : ''} />
    <meta name="twitter:card" content="summary_large_image" />
  </Head>
);
