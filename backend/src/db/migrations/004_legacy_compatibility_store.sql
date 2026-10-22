CREATE TABLE IF NOT EXISTS legacy_records (
  resource_type TEXT NOT NULL CHECK (resource_type IN ('experiments', 'templates', 'projects', 'reports')),
  id TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (resource_type, id)
);

CREATE INDEX IF NOT EXISTS idx_legacy_records_updated ON legacy_records(resource_type, updated_at);

CREATE TABLE IF NOT EXISTS processing_runs (
  id TEXT PRIMARY KEY,
  module TEXT NOT NULL,
  algorithm TEXT NOT NULL,
  input_json TEXT NOT NULL,
  output_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_processing_runs_created ON processing_runs(created_at);

CREATE TABLE IF NOT EXISTS legacy_import_batches (
  resource_type TEXT PRIMARY KEY,
  imported_at TEXT NOT NULL,
  files_imported INTEGER NOT NULL DEFAULT 0,
  source_dir TEXT NOT NULL
);
