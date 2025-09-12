import axios from 'axios';

export default async function handler(req, res) {
  const { id } = req.query;

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Set up the backend API URL
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
    
    try {
      // Request binary image data with proper headers
      const response = await axios.get(`${API_URL}/places/${id}/image`, {
        responseType: 'arraybuffer',
        timeout: 15000,
        headers: {
          'Accept': 'image/*',
          'x-user': 'dharmendra23101'
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
      console.error(`Error fetching binary image for place ${id}:`, imageError.message);
      
      // Serve local placeholder image
      return res.redirect('/images/placeholder.jpg');
    }
  } catch (err) {
    console.error(`Error handling image request for place ${id}:`, err.message);
    
    // Serve a local placeholder image
    return res.redirect('/images/placeholder.jpg');
  }
}