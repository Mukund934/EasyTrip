import axios from 'axios';
import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
  const { id } = req.query;

  if (!id || isNaN(parseInt(id))) {
    return res.status(400).json({ error: 'Invalid place ID' });
  }

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
  const fallbackImagePath = path.join(process.cwd(), 'public', 'images', 'placeholder.jpg');

  try {
    const response = await axios.get(`${API_URL}/places/${id}/images`, {
      responseType: 'arraybuffer',
      timeout: 5000
    });

    const contentType = response.headers['content-type'] || 'image/jpeg';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.send(Buffer.from(response.data, 'binary'));
  } catch (error) {
    console.error(`Error fetching image for place ${id}:`, error.message || error);

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
