CREATE TABLE IF NOT EXISTS classes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  group_name TEXT NOT NULL DEFAULT '',
  parent_class_id TEXT REFERENCES classes(id) ON DELETE RESTRICT,
  description TEXT NOT NULL DEFAULT '',
  is_grouping INTEGER NOT NULL DEFAULT 0 CHECK (is_grouping IN (0, 1)),
  source_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS field_dictionary (
  name TEXT PRIMARY KEY,
  meaning TEXT NOT NULL DEFAULT '',
  value_type TEXT NOT NULL CHECK (value_type IN ('文本', '数值', '文件', '表格', '选项', '其他')),
  standard_unit TEXT NOT NULL DEFAULT '',
  aliases_json TEXT NOT NULL DEFAULT '[]',
  source_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS class_fields (
  class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE RESTRICT,
  field_name TEXT NOT NULL REFERENCES field_dictionary(name) ON DELETE RESTRICT,
  source_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (class_id, field_name)
);

CREATE TABLE IF NOT EXISTS class_compositions (
  parent_class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE RESTRICT,
  child_class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE RESTRICT,
  cardinality_label TEXT NOT NULL,
  min_count INTEGER NOT NULL DEFAULT 0 CHECK (min_count >= 0),
  max_count INTEGER CHECK (max_count IS NULL OR max_count >= min_count),
  source_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (parent_class_id, child_class_id)
);

CREATE TABLE IF NOT EXISTS relationship_types (
  name TEXT PRIMARY KEY,
  inverse_name TEXT NOT NULL DEFAULT '',
  direction_label TEXT NOT NULL DEFAULT '',
  source_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS class_relation_rules (
  source_class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE RESTRICT,
  relation_name TEXT NOT NULL REFERENCES relationship_types(name) ON DELETE RESTRICT,
  target_class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE RESTRICT,
  cardinality_label TEXT NOT NULL,
  min_count INTEGER NOT NULL DEFAULT 0 CHECK (min_count >= 0),
  max_count INTEGER CHECK (max_count IS NULL OR max_count >= min_count),
  source_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (source_class_id, relation_name, target_class_id)
);

CREATE TABLE IF NOT EXISTS entries (
  id TEXT PRIMARY KEY,
  class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  parent_entry_id TEXT REFERENCES entries(id) ON DELETE RESTRICT,
  description TEXT NOT NULL DEFAULT '',
  secondary_part INTEGER NOT NULL DEFAULT 0 CHECK (secondary_part IN (0, 1)),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision >= 1),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (parent_entry_id IS NULL OR parent_entry_id <> id)
);

CREATE INDEX IF NOT EXISTS idx_entries_class ON entries(class_id);
CREATE INDEX IF NOT EXISTS idx_entries_parent ON entries(parent_entry_id);
CREATE INDEX IF NOT EXISTS idx_entries_status ON entries(status);

CREATE TABLE IF NOT EXISTS assets (
  id TEXT PRIMARY KEY,
  original_name TEXT NOT NULL,
  storage_key TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL DEFAULT 'raw_file'
    CHECK (kind IN ('raw_file', 'table_data', 'document', 'image', 'model_method', 'derived_dataset', 'chart_export', 'other')),
  media_type TEXT NOT NULL DEFAULT 'application/octet-stream',
  size_bytes INTEGER NOT NULL CHECK (size_bytes >= 0),
  sha256 TEXT NOT NULL,
  format_entry_id TEXT REFERENCES entries(id) ON DELETE RESTRICT,
  source_path TEXT,
  representation TEXT NOT NULL DEFAULT 'original'
    CHECK (representation IN ('original', 'embedded_text', 'embedded_preview')),
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_assets_format ON assets(format_entry_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_assets_source_path ON assets(source_path) WHERE source_path IS NOT NULL;

CREATE TABLE IF NOT EXISTS entry_field_values (
  id TEXT PRIMARY KEY,
  entry_id TEXT NOT NULL REFERENCES entries(id) ON DELETE RESTRICT,
  field_name TEXT NOT NULL REFERENCES field_dictionary(name) ON DELETE RESTRICT,
  value_json TEXT,
  raw_value TEXT,
  unit TEXT NOT NULL DEFAULT '',
  group_name TEXT NOT NULL DEFAULT '',
  limit_value TEXT NOT NULL DEFAULT '',
  source_entry_id TEXT REFERENCES entries(id) ON DELETE RESTRICT,
  asset_id TEXT REFERENCES assets(id) ON DELETE RESTRICT,
  note TEXT NOT NULL DEFAULT '',
  source_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_field_values_entry ON entry_field_values(entry_id, source_order);
CREATE INDEX IF NOT EXISTS idx_field_values_name ON entry_field_values(field_name);
CREATE INDEX IF NOT EXISTS idx_field_values_source ON entry_field_values(source_entry_id);

CREATE TABLE IF NOT EXISTS entry_relations (
  id TEXT PRIMARY KEY,
  source_entry_id TEXT NOT NULL REFERENCES entries(id) ON DELETE RESTRICT,
  relation_name TEXT NOT NULL REFERENCES relationship_types(name) ON DELETE RESTRICT,
  target_entry_id TEXT NOT NULL REFERENCES entries(id) ON DELETE RESTRICT,
  created_at TEXT NOT NULL,
  CHECK (source_entry_id <> target_entry_id),
  UNIQUE (source_entry_id, relation_name, target_entry_id)
);

CREATE INDEX IF NOT EXISTS idx_entry_relations_source ON entry_relations(source_entry_id, relation_name);
CREATE INDEX IF NOT EXISTS idx_entry_relations_target ON entry_relations(target_entry_id, relation_name);

CREATE TABLE IF NOT EXISTS entry_revisions (
  id TEXT PRIMARY KEY,
  entry_id TEXT NOT NULL REFERENCES entries(id) ON DELETE RESTRICT,
  revision_no INTEGER NOT NULL CHECK (revision_no >= 1),
  snapshot_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (entry_id, revision_no)
);

CREATE TABLE IF NOT EXISTS asset_derivations (
  id TEXT PRIMARY KEY,
  source_asset_id TEXT NOT NULL REFERENCES assets(id) ON DELETE RESTRICT,
  derived_asset_id TEXT NOT NULL REFERENCES assets(id) ON DELETE RESTRICT,
  relation_type TEXT NOT NULL DEFAULT 'derived_from',
  transformation_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  CHECK (source_asset_id <> derived_asset_id),
  UNIQUE (source_asset_id, derived_asset_id, relation_type)
);

CREATE TABLE IF NOT EXISTS artifacts (
  id TEXT PRIMARY KEY,
  artifact_type TEXT NOT NULL,
  name TEXT NOT NULL,
  owner_entry_id TEXT REFERENCES entries(id) ON DELETE RESTRICT,
  payload_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'saved' CHECK (status IN ('draft', 'saved', 'archived')),
  revision_no INTEGER NOT NULL DEFAULT 1 CHECK (revision_no >= 1),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_artifacts_owner ON artifacts(owner_entry_id, artifact_type);
CREATE TABLE IF NOT EXISTS artifact_entry_sources (
  artifact_id TEXT NOT NULL REFERENCES artifacts(id) ON DELETE RESTRICT,
  entry_id TEXT NOT NULL REFERENCES entries(id) ON DELETE RESTRICT,
  role TEXT NOT NULL DEFAULT 'source',
  PRIMARY KEY (artifact_id, entry_id, role)
);
CREATE TABLE IF NOT EXISTS artifact_asset_sources (
  artifact_id TEXT NOT NULL REFERENCES artifacts(id) ON DELETE RESTRICT,
  asset_id TEXT NOT NULL REFERENCES assets(id) ON DELETE RESTRICT,
  role TEXT NOT NULL DEFAULT 'source',
  PRIMARY KEY (artifact_id, asset_id, role)
);
CREATE TABLE IF NOT EXISTS artifact_dependencies (
  artifact_id TEXT NOT NULL REFERENCES artifacts(id) ON DELETE RESTRICT,
  source_artifact_id TEXT NOT NULL REFERENCES artifacts(id) ON DELETE RESTRICT,
  role TEXT NOT NULL DEFAULT 'derived_from',
  PRIMARY KEY (artifact_id, source_artifact_id, role),
  CHECK (artifact_id <> source_artifact_id)
);

CREATE TABLE IF NOT EXISTS model_revisions (
  id TEXT PRIMARY KEY,
  model_entry_id TEXT NOT NULL REFERENCES entries(id) ON DELETE RESTRICT,
  version TEXT NOT NULL,
  method_asset_id TEXT REFERENCES assets(id) ON DELETE RESTRICT,
  input_schema_json TEXT NOT NULL DEFAULT '{}',
  output_schema_json TEXT NOT NULL DEFAULT '{}',
  scope_json TEXT NOT NULL DEFAULT '{}',
  validation_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'registered', 'deprecated')),
  created_at TEXT NOT NULL,
  UNIQUE (model_entry_id, version)
);

CREATE INDEX IF NOT EXISTS idx_model_revisions_entry ON model_revisions(model_entry_id, created_at);

CREATE TABLE IF NOT EXISTS model_runs (
  id TEXT PRIMARY KEY,
  object_model_entry_id TEXT NOT NULL REFERENCES entries(id) ON DELETE RESTRICT,
  model_revision_id TEXT NOT NULL REFERENCES model_revisions(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'running', 'completed', 'failed', 'cancelled')),
  input_snapshot_json TEXT NOT NULL DEFAULT '{}',
  parameter_snapshot_json TEXT NOT NULL DEFAULT '{}',
  output_snapshot_json TEXT NOT NULL DEFAULT '{}',
  error TEXT,
  started_at TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_model_runs_object_model ON model_runs(object_model_entry_id, created_at);
CREATE INDEX IF NOT EXISTS idx_model_runs_revision ON model_runs(model_revision_id, created_at);

CREATE TABLE IF NOT EXISTS model_run_entry_sources (
  model_run_id TEXT NOT NULL REFERENCES model_runs(id) ON DELETE RESTRICT,
  entry_id TEXT NOT NULL REFERENCES entries(id) ON DELETE RESTRICT,
  role TEXT NOT NULL,
  PRIMARY KEY (model_run_id, entry_id, role)
);
CREATE TABLE IF NOT EXISTS model_run_asset_sources (
  model_run_id TEXT NOT NULL REFERENCES model_runs(id) ON DELETE RESTRICT,
  asset_id TEXT NOT NULL REFERENCES assets(id) ON DELETE RESTRICT,
  role TEXT NOT NULL,
  PRIMARY KEY (model_run_id, asset_id, role)
);
CREATE TABLE IF NOT EXISTS model_run_artifacts (
  model_run_id TEXT NOT NULL REFERENCES model_runs(id) ON DELETE RESTRICT,
  artifact_id TEXT NOT NULL REFERENCES artifacts(id) ON DELETE RESTRICT,
  role TEXT NOT NULL DEFAULT 'output',
  PRIMARY KEY (model_run_id, artifact_id, role)
);

CREATE TABLE IF NOT EXISTS import_batches (
  id TEXT PRIMARY KEY,
  source_name TEXT NOT NULL,
  source_sha256 TEXT NOT NULL UNIQUE,
  imported_at TEXT NOT NULL,
  counts_json TEXT NOT NULL DEFAULT '{}'
);
