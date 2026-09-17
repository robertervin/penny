-- Unique local-dev / external identity for bootstrap
CREATE UNIQUE INDEX IF NOT EXISTS people_external_ref_unique
  ON people (external_ref)
  WHERE external_ref IS NOT NULL;
