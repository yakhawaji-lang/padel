-- PostgreSQL schema for Padel Platform
-- Run: psql $DATABASE_URL -f server/db/schema.sql

-- Key-value store (replaces localStorage: admin_clubs, members, settings, etc.)
CREATE TABLE IF NOT EXISTS app_store (
  key   TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Matches (replaces IndexedDB matches store)
CREATE TABLE IF NOT EXISTS matches (
  id SERIAL PRIMARY KEY,
  club_id TEXT NOT NULL,
  tournament_type TEXT NOT NULL,
  tournament_id INTEGER NOT NULL,
  data JSONB NOT NULL,
  saved_at BIGINT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_matches_club ON matches(club_id);
CREATE INDEX IF NOT EXISTS idx_matches_tournament ON matches(club_id, tournament_type, tournament_id);
CREATE INDEX IF NOT EXISTS idx_matches_saved_at ON matches(saved_at);

-- Member stats snapshots (replaces IndexedDB member_stats)
CREATE TABLE IF NOT EXISTS member_stats (
  id SERIAL PRIMARY KEY,
  club_id TEXT NOT NULL,
  member_id TEXT NOT NULL,
  tournament_id INTEGER NOT NULL,
  data JSONB NOT NULL,
  saved_at BIGINT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_member_stats_club ON member_stats(club_id);
CREATE INDEX IF NOT EXISTS idx_member_stats_member ON member_stats(member_id);

-- Tournament summaries (replaces IndexedDB tournaments store)
CREATE TABLE IF NOT EXISTS tournament_summaries (
  id SERIAL PRIMARY KEY,
  club_id TEXT NOT NULL,
  data JSONB NOT NULL,
  saved_at BIGINT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tournament_summaries_club ON tournament_summaries(club_id);

-- Ensure hala-padel exists in app_store
INSERT INTO app_store (key, value) VALUES ('admin_clubs', '[]'::jsonb)
ON CONFLICT (key) DO NOTHING;
