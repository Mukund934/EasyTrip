import axios from 'axios';

// Only a positive integer may be interpolated into the upstream URL, so this route can
// never be steered at a path (or host) other than the configured backend's image endpoint.
const isValidPlaceId = (value) =>
  typeof value === 'string' && /^\d+$/.test(value) && Number(value) > 0;

export default async function handler(req, res) {
  const { id } = req.query;

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!isValidPlaceId(id)) {
    return res.status(400).json({ error: 'Invalid place ID' });
  }

  const placeId = Number(id);

  try {
    // Set up the backend API URL
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

    try {
      // Request binary image data with proper headers
      const response = await axios.get(`${API_URL}/places/${placeId}/image`, {
        responseType: 'arraybuffer',
        timeout: 15000,
        headers: {
          'Accept': 'image/*'
        }
      });

      // Get content type from headers or default to JPEG
      const contentType = response.headers['content-type'] || 'image/jpeg';
      const contentLength = response.headers['content-length'];

      // Set appropriate headers
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 1 day
      if (contentLength) {
        res.setHeader('Content-Length', contentLength);
      }

      // Send the binary data
      return res.send(Buffer.from(response.data, 'binary'));
    } catch (imageError) {
      console.error(`Error fetching binary image for place ${placeId}:`, imageError.message);

      // Serve local placeholder image
      return res.redirect('/images/placeholder.jpg');
    }
  } catch (err) {
    console.error(`Error handling image request for place ${placeId}:`, err.message);

    // Serve a local placeholder image
    return res.redirect('/images/placeholder.jpg');
  }
}
