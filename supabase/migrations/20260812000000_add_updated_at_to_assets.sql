-- Track real last-modified time per asset row, so Dashboard's "Terakhir diperbarui"
-- reflects an actual data change instead of merely the last fetch/page refresh.
ALTER TABLE assets ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

UPDATE assets SET updated_at = created_at WHERE updated_at IS NULL;

CREATE OR REPLACE FUNCTION set_assets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_assets_updated_at ON assets;
CREATE TRIGGER trg_assets_updated_at
  BEFORE UPDATE ON assets
  FOR EACH ROW
  EXECUTE FUNCTION set_assets_updated_at();
