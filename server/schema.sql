CREATE TABLE IF NOT EXISTS organizations (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('donor', 'charity')),
  address TEXT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS listings (
  id SERIAL PRIMARY KEY,
  donor_id INTEGER NOT NULL REFERENCES organizations(id),
  claimed_by INTEGER REFERENCES organizations(id),
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  predicted_servings INTEGER NOT NULL CHECK (predicted_servings > 0),
  prepared_servings INTEGER NOT NULL CHECK (prepared_servings > 0),
  expected_demand INTEGER NOT NULL CHECK (expected_demand >= 0),
  confidence DOUBLE PRECISION NOT NULL DEFAULT 0.5,
  recommended_pickup_minutes INTEGER NOT NULL DEFAULT 30,
  available_until TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'available'
    CHECK (status IN ('available', 'claimed', 'completed')),
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS listings_available_until_idx
  ON listings (available_until) WHERE status = 'available';
CREATE INDEX IF NOT EXISTS listings_donor_id_idx ON listings (donor_id);
