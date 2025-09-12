-- ========================= --
-- EasyTrip Database Schema (Updated) --
-- ========================= --

-- This schema is updated to store image URLs instead of binary data (BYTEA).
-- This is a more scalable and performant approach. Images should be uploaded to a
-- dedicated storage service (like Firebase Storage, AWS S3, etc.), and the
-- public URL should be stored in the database.

-- Table: places (main entity)
CREATE TABLE IF NOT EXISTS places (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  location VARCHAR(255) NOT NULL,
  district VARCHAR(100),
  state VARCHAR(100),
  locality VARCHAR(255),
  pin_code VARCHAR(20),
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  -- UPDATED: Storing the URL of the primary image.
  primary_image_url TEXT,
  themes TEXT[] DEFAULT '{}',
  tags TEXT[] DEFAULT '{}',
  custom_keys JSONB DEFAULT '{}',
  rating_sum INT DEFAULT 0,
  rating_count INT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(255),
  updated_by VARCHAR(255)
);

-- Table: place_images (multiple images per place)
CREATE TABLE IF NOT EXISTS place_images (
  id SERIAL PRIMARY KEY,
  place_id INT REFERENCES places(id) ON DELETE CASCADE,
  -- UPDATED: Storing the URL of the additional image.
  image_url TEXT NOT NULL,
  caption VARCHAR(255),
  display_order INT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table: place_reviews (user reviews for a place)
CREATE TABLE IF NOT EXISTS place_reviews (
  id SERIAL PRIMARY KEY,
  place_id INT REFERENCES places(id) ON DELETE CASCADE,
  user_id VARCHAR(255) NOT NULL,
  user_name VARCHAR(255),
  rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table: users (for authentication/admin)
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  firebase_uid VARCHAR(255) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255),
  is_admin BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Trigger function to update timestamps
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply timestamp trigger to tables
DROP TRIGGER IF EXISTS update_places_modtime ON places;
CREATE TRIGGER update_places_modtime
BEFORE UPDATE ON places
FOR EACH ROW
EXECUTE FUNCTION update_modified_column();

DROP TRIGGER IF EXISTS update_place_reviews_modtime ON place_reviews;
CREATE TRIGGER update_place_reviews_modtime
BEFORE UPDATE ON place_reviews
FOR EACH ROW
EXECUTE FUNCTION update_modified_column();

DROP TRIGGER IF EXISTS update_users_modtime ON users;
CREATE TRIGGER update_users_modtime
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION update_modified_column();


-- Check what's currently in the database
SELECT id, name, primary_image_url FROM places;

-- Update the URLs to a placeholder temporarily


-- Trigger function: update rating_sum and rating_count in places
-- NOTE: This function is slightly optimized to reduce redundant queries.
CREATE OR REPLACE FUNCTION update_place_rating() RETURNS TRIGGER AS $$
DECLARE
  new_rating_sum INT;
  new_rating_count INT;
BEGIN
  -- Get the target place_id
  DECLARE
    target_place_id INT := COALESCE(NEW.place_id, OLD.place_id);
  BEGIN
    -- Recalculate sum and count for the affected place
    SELECT COALESCE(SUM(rating), 0), COUNT(id)
    INTO new_rating_sum, new_rating_count
    FROM place_reviews
    WHERE place_id = target_place_id;

    -- Update the places table
    UPDATE places
    SET
      rating_sum = new_rating_sum,
      rating_count = new_rating_count
    WHERE id = target_place_id;
  END;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Drop old trigger if exists, then create
DROP TRIGGER IF EXISTS update_place_rating_trigger ON place_reviews;
CREATE TRIGGER update_place_rating_trigger
AFTER INSERT OR UPDATE OR DELETE ON place_reviews
FOR EACH ROW EXECUTE FUNCTION update_place_rating();