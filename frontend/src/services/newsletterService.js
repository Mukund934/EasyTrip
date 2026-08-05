import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

/**
 * Subscribe an email address to the newsletter.
 *
 * Public — no token. The server answers identically whether the address was new or already on
 * the list, so callers cannot use this to test which addresses are subscribed, and neither can
 * the UI accidentally reveal it.
 *
 * @param {String} email - Subscriber email address
 * @param {String} source - Where the signup came from: 'footer' | 'place_page' | 'landing' | 'api'
 * @returns {Promise<{ message: String }>}
 */
const subscribeToNewsletter = async (email, source) => {
  try {
    const response = await axios.post(`${API_URL}/newsletter`, { email, source });
    return response.data;
  } catch (error) {
    console.error('Error subscribing to newsletter:', error.response?.data || error.message);
    // The validator's field message ("Please enter a valid email address") is the useful one;
    // the generic envelope message is the fallback.
    throw {
      message:
        error.response?.data?.errors?.[0]?.message ||
        error.response?.data?.message ||
        'Could not complete your subscription. Please try again.',
      status: error.response?.status
    };
  }
};

const newsletterService = { subscribeToNewsletter };

export default newsletterService;
export { subscribeToNewsletter };
