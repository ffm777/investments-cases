PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS runs (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL CHECK (case_id IN ('chapter2','chapter3','chapter4')),
  label TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  closed_at INTEGER
);
CREATE UNIQUE INDEX IF NOT EXISTS one_open_run ON runs(case_id) WHERE closed_at IS NULL;
CREATE INDEX IF NOT EXISTS latest_run ON runs(case_id, created_at DESC);
CREATE TABLE IF NOT EXISTS participants (
  run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  gates INTEGER NOT NULL DEFAULT 0 CHECK (gates BETWEEN 0 AND 15),
  PRIMARY KEY (run_id, token_hash)
);

-- Current extensible tables; original tables retained for migration compatibility.
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS class_runs (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL CHECK (case_id IN ('chapter2','chapter3','chapter4','chapter5')),
  label TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  closed_at INTEGER
);
CREATE UNIQUE INDEX IF NOT EXISTS one_open_class_run ON class_runs(case_id) WHERE closed_at IS NULL;
CREATE INDEX IF NOT EXISTS latest_class_run ON class_runs(case_id, created_at DESC);
CREATE TABLE IF NOT EXISTS class_participants (
  run_id TEXT NOT NULL REFERENCES class_runs(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  gates INTEGER NOT NULL DEFAULT 0 CHECK (gates BETWEEN 0 AND 15),
  PRIMARY KEY (run_id, token_hash)
);
