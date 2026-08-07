import { useCallback } from 'react';
import { toast } from 'react-toastify';
import { FiCheckCircle } from 'react-icons/fi';

/**
 * Sharing a place: the Web Share sheet where it exists, a clipboard copy where it does not, and
 * the three social intents behind the hero's share menu (IMP-070).
 *
 * @param {Object|null} place
 * @returns {{share: Function, shareTo: Function}}
 */
export function useSharePlace(place) {
  const share = useCallback(() => {
    if (navigator.share && navigator.canShare?.()) {
      navigator
        .share({
          title: place.name,
          text: `Check out ${place.name} on EasyTrip!`,
          url: window.location.href
        })
        .catch(console.error);
    } else {
      navigator.clipboard
        .writeText(window.location.href)
        .then(() => {
          toast.success('Link copied to clipboard!', {
            icon: <FiCheckCircle className="text-green-500 h-5 w-5" />
          });
        })
        .catch(() => {
          toast.error('Failed to copy link');
        });
    }
  }, [place?.name]);

  const shareTo = useCallback(
    (platform) => {
      const url = encodeURIComponent(window.location.href);
      const text = encodeURIComponent(`Check out ${place.name} on EasyTrip!`);
      let shareUrl = '';

      switch (platform) {
        case 'twitter':
          shareUrl = `https://twitter.com/intent/tweet?url=${url}&text=${text}`;
          break;
        case 'facebook':
          shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${url}`;
          break;
        case 'whatsapp':
          shareUrl = `https://api.whatsapp.com/send?text=${text}%20${url}`;
          break;
        default:
          return;
      }
      window.open(shareUrl, '_blank', 'noopener,noreferrer');
    },
    [place?.name]
  );

  return { share, shareTo };
}
