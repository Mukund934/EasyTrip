// This handler should not return objects - fix the warnings

// Only a positive integer may be interpolated into the upstream URL, so this route can
// never be steered at a path (or host) other than the configured backend's image endpoint.
const isValidPlaceId = (value) =>
  typeof value === 'string' && /^\d+$/.test(value) && Number(value) > 0;

export default async function handler(req, res) {
  const { id } = req.query;

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return; // Don't return the object
  }

  if (!isValidPlaceId(id)) {
    res.status(400).json({ error: 'Invalid place ID' });
    return;
  }

  const placeId = Number(id);

  try {
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
    
    try {
      // Request image from backend
      const response = await fetch(`${API_URL}/places/${placeId}/image`, {
        method: 'GET',
        headers: {
          'Accept': 'image/*'
        },
      });
      
      if (response.redirected) {
        res.redirect(response.url);
        return; // Don't return the object
      }
      
      if (response.ok) {
        const contentType = response.headers.get('content-type') || 'image/jpeg';
        const imageBuffer = await response.arrayBuffer();
        
        res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control', 'public, max-age=86400');
        res.send(Buffer.from(imageBuffer));
        return; // Don't return the object
      }
    } catch (imageError) {
      console.error(`Error fetching image for place ${placeId}:`, imageError.message);
    }
    
    // Serve local placeholder
    res.redirect('/images/placeholder.jpg');
    return; // Don't return the object
    
  } catch (err) {
    console.error(`Error handling image request for place ${placeId}:`, err.message);
    res.redirect('/images/placeholder.jpg');
    return; // Don't return the object
  }
}