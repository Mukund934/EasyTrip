import axios from 'axios';
import fs from 'fs';
import path from 'path';

// Only a positive integer may be interpolated into the upstream URL, so this route can
// never be steered at a path (or host) other than the configured backend's image endpoint.
const isValidPlaceId = (value) =>
  typeof value === 'string' && /^\d+$/.test(value) && Number(value) > 0;

export default async function handler(req, res) {
  const { id } = req.query;

  if (!isValidPlaceId(id)) {
    return res.status(400).json({ error: 'Invalid place ID' });
  }

  const placeId = Number(id);
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
  const fallbackImagePath = path.join(process.cwd(), 'public', 'images', 'placeholder.jpg');

  try {
    const response = await axios.get(`${API_URL}/places/${placeId}/images`, {
      responseType: 'arraybuffer',
      timeout: 5000
    });

    const contentType = response.headers['content-type'] || 'image/jpeg';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.send(Buffer.from(response.data, 'binary'));
  } catch (error) {
    console.error(`Error fetching image for place ${placeId}:`, error.message || error);

    // Always return fallback
    try {
      const imageBuffer = fs.readFileSync(fallbackImagePath);
      res.setHeader('Content-Type', 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.send(imageBuffer);
    } catch (fallbackError) {
      console.error('Fallback image not found:', fallbackError.message);
      res.status(404).end('Image not found');
    }
  }
}
