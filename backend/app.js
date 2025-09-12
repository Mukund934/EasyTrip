require('dotenv').config();

// Initialize configurations first
const { testCloudinary } = require('./src/config/cloudinary');
const express = require('express');
const cors = require('cors');
const path = require('path');
const { Pool } = require('pg');

// Import routes
const placeRoutes = require('./src/routes/placeRoutes');
const authRoutes = require('./src/routes/authRoutes');
const adminRoutes = require('./src/routes/adminRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://easytrip-psi.vercel.app/'] 
    : ['http://localhost:3000'],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Check database schema compatibility
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function ensureDatabaseSchema() {
  try {
    console.log('Checking database schema compatibility...');
    
    // Add primary_image_url column to places table if it doesn't exist
    await pool.query(`
      ALTER TABLE places 
      ADD COLUMN IF NOT EXISTS primary_image_url TEXT;
    `);
    
    // Add image_url column to place_images table if it doesn't exist
    await pool.query(`
      ALTER TABLE place_images 
      ADD COLUMN IF NOT EXISTS image_url TEXT;
    `);
    
    console.log('✅ Database schema is compatible');
  } catch (error) {
    console.error('❌ Database schema check failed:', error.message);
  }
}

// Run schema check
ensureDatabaseSchema();

// Health check endpoint
app.get('/api/health', async (req, res) => {
  const dbStatus = await pool.query('SELECT NOW() as time')
    .then(() => 'connected')
    .catch(err => `error: ${err.message}`);
  
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    database: dbStatus,
    cloudinary: process.env.CLOUDINARY_CLOUD_NAME ? 'configured' : 'not configured'
  });
});



// Routes
app.use('/api', placeRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);

// 404 handler
app.use('*', (req, res) => {
  console.log(`❌ 404 - Route not found: ${req.method} ${req.originalUrl}`);
  console.log('   Available routes start with: /api/auth, /api/places, /api/admin');
  res.status(404).json({ 
    message: 'Route not found',
    path: req.originalUrl,
    method: req.method,
    availableRoutes: ['/api/health', '/api/places', '/api/auth', '/api/admin']
  });
});

// Error handler
app.use((error, req, res, next) => {
  console.error('Global error handler:', error);
  res.status(500).json({
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? error.message : 'Server error',
    timestamp: new Date().toISOString()
  });
});

// Test database connection
pool.query('SELECT NOW() as current_time')
  .then(result => {
    console.log('Database connected successfully at', result.rows[0].current_time);
    console.log('✅ PostgreSQL connected successfully');
  })
  .catch(err => {
    console.error('❌ Database connection error:', err.message);
  });

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📍 API base URL: http://localhost:${PORT}/api`);
  console.log(`🏥 Health check: http://localhost:${PORT}/api/health`);
  console.log(`📍 Places: http://localhost:${PORT}/api/places`);
  console.log(`🔐 Auth: http://localhost:${PORT}/api/auth`);
  console.log(`⚙️  Admin: http://localhost:${PORT}/api/admin`);
});


module.exports = app;
