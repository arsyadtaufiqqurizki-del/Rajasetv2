-- Link asset_reclassifications to assets so "Sync from Assets" can seed
-- reclassification rows from Asset Inventory as the stock-opname baseline.
-- Nullable + ON DELETE SET NULL: manual (unregistered) finds keep asset_id = NULL,
-- exactly as before this migration.

ALTER TABLE asset_reclassifications
  ADD COLUMN IF NOT EXISTS asset_id UUID REFERENCES assets(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_reclass_asset_id ON asset_reclassifications(asset_id);

-- Snapshot fallback: when a linked asset is deleted from Inventory, copy its
-- current values into the reclassification row's own free-text columns before
-- the FK nulls asset_id out, so the audit row doesn't go blank.
CREATE OR REPLACE FUNCTION snapshot_reclassification_before_asset_delete()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE asset_reclassifications
  SET
    asset_description = OLD.asset_description,
    asset_category = OLD.category_segment1,
    location = OLD.category_segment2,
    ownership = OLD.subsidiary,
    unit = OLD.asset_units,
    asset_id = NULL
  WHERE asset_id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_snapshot_reclassification_before_asset_delete ON assets;
CREATE TRIGGER trg_snapshot_reclassification_before_asset_delete
BEFORE DELETE ON assets
FOR EACH ROW
EXECUTE FUNCTION snapshot_reclassification_before_asset_delete();
