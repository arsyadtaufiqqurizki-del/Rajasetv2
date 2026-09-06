-- Flags asset_reclassifications rows whose linked asset was deleted from Asset
-- Inventory, so "Sync from Asset" can tell them apart from rows that were
-- unlinked because they're manual (unregistered) findings.
--
-- snapshot_reclassification_before_asset_delete() (20260814000000) already
-- preserves the row and nulls asset_id on delete; this only adds a timestamp
-- marker to that same write.

ALTER TABLE asset_reclassifications
  ADD COLUMN IF NOT EXISTS asset_deleted_at TIMESTAMPTZ;

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
    asset_id = NULL,
    asset_deleted_at = NOW()
  WHERE asset_id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;
