ALTER TABLE entry_field_values
  ADD COLUMN schema_override INTEGER NOT NULL DEFAULT 0 CHECK (schema_override IN (0, 1));
