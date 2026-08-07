import { getPlaceImageUrl, PLACEHOLDER_IMAGE } from './placeImage';

/**
 * Pure helpers for the place detail page (IMP-070).
 *
 * These were inline in `pages/places/[id].jsx`. They are plain functions of their arguments, so
 * moving them out is what makes them reachable from a test without mounting the page.
 */

/**
 * Compose the gallery: the primary image first, then the gallery rows, de-duplicated by URL.
 *
 * Shared by `getStaticProps` and the client refresh path so the two cannot disagree about what
 * the first image is — which matters, because the first image is the hero.
 */
export const composeGallery = (place, galleryImages) => {
  const all = [
    { id: 'primary', image_url: getPlaceImageUrl(place, PLACEHOLDER_IMAGE) },
    ...(galleryImages || [])
  ].filter((img) => img.image_url);

  const seen = new Set();
  return all.filter((img) => {
    if (seen.has(img.image_url)) return false;
    seen.add(img.image_url);
    return true;
  });
};

/**
 * The bullet list under "Essential Facts".
 *
 * Two of the five entries have a stated fallback and always appear; the rest drop out when the
 * place has no value for them.
 */
export const buildPlaceFacts = (place) =>
  [
    place.district
      ? `Located in the ${place.district} district of ${place.state || 'the region'}`
      : null,
    place.custom_keys?.['Best Time to Visit']
      ? `Best time to visit: ${place.custom_keys['Best Time to Visit']}`
      : 'Suitable for year-round visits',
    place.custom_keys?.['Opening Hours']
      ? `Open hours: ${place.custom_keys['Opening Hours']}`
      : null,
    place.custom_keys?.['Entrance Fee']
      ? `Entrance fee: ${place.custom_keys['Entrance Fee']}`
      : 'Contact for current entrance fees',
    'Perfect for photography enthusiasts and nature lovers'
  ].filter(Boolean);

/** The opening paragraph: the admin's description, or a stand-in when there is none. */
export const buildEditorialExcerpt = (place) =>
  place.description ||
  `${place.name} offers travelers a unique blend of experiences, with local culture and natural beauty combining to create unforgettable memories.`;

/** The sections the table of contents and the scroll observer both walk. */
export const PLACE_SECTIONS = [
  { id: 'about', title: 'About This Place' },
  { id: 'details', title: 'Essential Details' },
  { id: 'gallery', title: 'Photo Gallery' },
  { id: 'reviews', title: 'Traveler Reviews' },
  { id: 'related', title: 'Similar Places' }
];
