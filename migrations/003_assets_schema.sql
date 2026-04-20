-- Extend assets table with the columns the UI uses.
ALTER TABLE assets ADD COLUMN IF NOT EXISTS asset_code       VARCHAR(100);
ALTER TABLE assets ADD COLUMN IF NOT EXISTS asset_type       VARCHAR(150);
ALTER TABLE assets ADD COLUMN IF NOT EXISTS model            VARCHAR(255);
ALTER TABLE assets ADD COLUMN IF NOT EXISTS location         VARCHAR(255);
ALTER TABLE assets ADD COLUMN IF NOT EXISTS department       VARCHAR(150);
ALTER TABLE assets ADD COLUMN IF NOT EXISTS purchase_date    DATE;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS warranty_expiry  DATE;

-- Original schema required name NOT NULL, but the new form uses asset_code.
ALTER TABLE assets ALTER COLUMN name DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS assets_asset_code_org_uniq
  ON assets (org_domain, asset_code)
  WHERE asset_code IS NOT NULL;

-- Assignment history: record who assigned and when it was returned.
ALTER TABLE asset_assignments ADD COLUMN IF NOT EXISTS assigned_by UUID REFERENCES users(id);
ALTER TABLE asset_assignments ADD COLUMN IF NOT EXISTS returned_at TIMESTAMPTZ;
