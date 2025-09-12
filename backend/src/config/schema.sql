-- Create places table
CREATE TABLE IF NOT EXISTS places (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  location VARCHAR(255) NOT NULL,
  district VARCHAR(100),
  state VARCHAR(100),
  locality VARCHAR(255),
  pin_code VARCHAR(20),
  latitude DECIMAL(10,8),
  longitude DECIMAL(11,8),
  primary_image_url TEXT,
  themes TEXT[] DEFAULT '{}',
  tags TEXT[] DEFAULT '{}',
  custom_keys JSONB DEFAULT '{}',
  rating_sum INT DEFAULT 0,
  rating_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(255),
  updated_by VARCHAR(255)
);

-- Create place_images table
CREATE TABLE IF NOT EXISTS place_images (
  id SERIAL PRIMARY KEY,
  place_id INT REFERENCES places(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  caption VARCHAR(255),
  display_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Create place_reviews table
CREATE TABLE IF NOT EXISTS place_reviews (
  id SERIAL PRIMARY KEY,
  place_id INT REFERENCES places(id) ON DELETE CASCADE,
  user_id VARCHAR(255) NOT NULL,
  user_name VARCHAR(255),
  rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  firebase_uid VARCHAR(255) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255),
  is_admin BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Timestamp trigger function
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to tables
CREATE TRIGGER update_places_modtime
BEFORE UPDATE ON places
FOR EACH ROW
EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER update_place_reviews_modtime
BEFORE UPDATE ON place_reviews
FOR EACH ROW
EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER update_users_modtime
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION update_modified_column();

-- Rating trigger
CREATE OR REPLACE FUNCTION update_place_rating() RETURNS TRIGGER AS $$
DECLARE
  new_rating_sum INT;
  new_rating_count INT;
BEGIN
  SELECT COALESCE(SUM(rating),0), COUNT(id)
  INTO new_rating_sum, new_rating_count
  FROM place_reviews
  WHERE place_id = COALESCE(NEW.place_id, OLD.place_id);

  UPDATE places
  SET rating_sum = new_rating_sum,
      rating_count = new_rating_count
  WHERE id = COALESCE(NEW.place_id, OLD.place_id);

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_place_rating_trigger
AFTER INSERT OR UPDATE OR DELETE ON place_reviews
FOR EACH ROW EXECUTE FUNCTION update_place_rating();
