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
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  -- One review per user per place; the review upsert targets this constraint by name
  CONSTRAINT place_reviews_place_id_user_id_key UNIQUE (place_id, user_id)
);

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  firebase_uid VARCHAR(255) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255),
  location VARCHAR(120),
  dob DATE,
  is_admin BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Reports filed against a review; feeds the moderation queue planned in IMP-111.
-- CASCADE because a report about a deleted review has nothing left to moderate.
CREATE TABLE IF NOT EXISTS review_reports (
  id SERIAL PRIMARY KEY,
  review_id INT NOT NULL REFERENCES place_reviews(id) ON DELETE CASCADE,
  -- Firebase uid, as in place_reviews.user_id. Not a FK: users rows are created lazily.
  reporter_uid VARCHAR(255) NOT NULL,
  reason TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'reviewed', 'dismissed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- One report per person per review, so reporting is idempotent
  CONSTRAINT review_reports_review_id_reporter_uid_key UNIQUE (review_id, reporter_uid)
);

CREATE INDEX IF NOT EXISTS review_reports_status_created_at_idx
  ON review_reports (status, created_at DESC);

-- Newsletter signups. `email` is normalised (trimmed, lower-cased) by the API before insert,
-- so the UNIQUE constraint is a real duplicate guard. `source` is intentionally unconstrained
-- in the schema — the API owns the allowlist, so a new signup surface needs no migration.
CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  status VARCHAR(20) NOT NULL DEFAULT 'subscribed'
    CHECK (status IN ('subscribed', 'unsubscribed')),
  subscribed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  unsubscribed_at TIMESTAMPTZ,
  source VARCHAR(40) NOT NULL DEFAULT 'unknown',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
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
--
-- Every CREATE TRIGGER below is preceded by DROP TRIGGER IF EXISTS. Postgres has no
-- CREATE TRIGGER IF NOT EXISTS and no CREATE OR REPLACE TRIGGER before v14, so without the drop
-- this file errors with "trigger already exists" the second time it runs — while every CREATE
-- TABLE above it is guarded with IF NOT EXISTS and succeeds. That made the file look re-runnable
-- when it was not: it would get most of the way through and then fail, which is the worst of both.
-- It matters now because docker-compose runs this on database init and it is the fresh-database
-- path the migrations are checked against.
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

DROP TRIGGER IF EXISTS update_newsletter_subscribers_modtime ON newsletter_subscribers;
CREATE TRIGGER update_newsletter_subscribers_modtime
BEFORE UPDATE ON newsletter_subscribers
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

DROP TRIGGER IF EXISTS update_place_rating_trigger ON place_reviews;
CREATE TRIGGER update_place_rating_trigger
AFTER INSERT OR UPDATE OR DELETE ON place_reviews
FOR EACH ROW EXECUTE FUNCTION update_place_rating();
