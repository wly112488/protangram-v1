ALTER TABLE model_runs
  ADD COLUMN object_model_revision_no INTEGER NOT NULL DEFAULT 1 CHECK (object_model_revision_no >= 1);
ALTER TABLE model_runs
  ADD COLUMN model_entry_revision_no INTEGER NOT NULL DEFAULT 1 CHECK (model_entry_revision_no >= 1);
ALTER TABLE model_run_entry_sources
  ADD COLUMN source_revision_no INTEGER NOT NULL DEFAULT 1 CHECK (source_revision_no >= 1);
ALTER TABLE model_run_asset_sources
  ADD COLUMN source_sha256 TEXT NOT NULL DEFAULT '';
ALTER TABLE model_run_artifacts
  ADD COLUMN artifact_revision_no INTEGER NOT NULL DEFAULT 1 CHECK (artifact_revision_no >= 1);
ALTER TABLE artifact_entry_sources
  ADD COLUMN source_revision_no INTEGER NOT NULL DEFAULT 1 CHECK (source_revision_no >= 1);
ALTER TABLE artifact_asset_sources
  ADD COLUMN source_sha256 TEXT NOT NULL DEFAULT '';
ALTER TABLE artifact_dependencies
  ADD COLUMN source_revision_no INTEGER NOT NULL DEFAULT 1 CHECK (source_revision_no >= 1);
