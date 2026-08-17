-- Replaces the previous verified-checkbox-based sync (20260815010000) with a
-- category-based sync: the "Verified" checkbox stays independent/manual, but
-- asset_reclassifications.category is now the field that mirrors
-- assets.verification, bidirectionally, for linked rows.
--   category = 'Needs Review' <-> verification = false
--   category = anything else  <-> verification = true

DROP TRIGGER IF EXISTS trg_sync_asset_verification_from_reclassification ON asset_reclassifications;
DROP FUNCTION IF EXISTS sync_asset_verification_from_reclassification();
DROP TRIGGER IF EXISTS trg_auto_queue_asset_for_reclassification_insert ON assets;
DROP TRIGGER IF EXISTS trg_auto_queue_asset_for_reclassification_update ON assets;
DROP FUNCTION IF EXISTS auto_queue_asset_for_reclassification();

-- 1) assets.verification -> category
--    false: ensure a pending ('Needs Review') row exists for this asset (an asset
--    can accumulate history rows from past audit cycles, so "already pending"
--    means a row that's still Needs Review, not just any row).
--    true: auto-resolve any pending row to 'Asset'.
CREATE OR REPLACE FUNCTION sync_category_from_asset_verification()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.verification = false THEN
    IF NOT EXISTS (
      SELECT 1 FROM asset_reclassifications
      WHERE asset_id = NEW.id AND category = 'Needs Review'
    ) THEN
      INSERT INTO asset_reclassifications (asset_id, category, created_by)
      VALUES (NEW.id, 'Needs Review', auth.uid());
    END IF;
  ELSE
    UPDATE asset_reclassifications
    SET category = 'Asset', updated_at = NOW()
    WHERE asset_id = NEW.id AND category = 'Needs Review';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_category_from_asset_verification_insert ON assets;
CREATE TRIGGER trg_sync_category_from_asset_verification_insert
AFTER INSERT ON assets
FOR EACH ROW
EXECUTE FUNCTION sync_category_from_asset_verification();

DROP TRIGGER IF EXISTS trg_sync_category_from_asset_verification_update ON assets;
CREATE TRIGGER trg_sync_category_from_asset_verification_update
AFTER UPDATE ON assets
FOR EACH ROW
WHEN (OLD.verification IS DISTINCT FROM NEW.verification)
EXECUTE FUNCTION sync_category_from_asset_verification();

-- 2) category -> assets.verification (linked rows only). Convergent by
--    construction: once both sides agree, the WHEN/WHERE guards make the
--    opposite trigger a no-op, so this can't loop.
CREATE OR REPLACE FUNCTION sync_asset_verification_from_category()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.asset_id IS NOT NULL THEN
    UPDATE assets
    SET verification = (NEW.category <> 'Needs Review'),
        verification_date = CASE WHEN NEW.category <> 'Needs Review' THEN CURRENT_DATE ELSE NULL END
    WHERE id = NEW.asset_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_asset_verification_from_category_insert ON asset_reclassifications;
CREATE TRIGGER trg_sync_asset_verification_from_category_insert
AFTER INSERT ON asset_reclassifications
FOR EACH ROW
WHEN (NEW.asset_id IS NOT NULL)
EXECUTE FUNCTION sync_asset_verification_from_category();

DROP TRIGGER IF EXISTS trg_sync_asset_verification_from_category_update ON asset_reclassifications;
CREATE TRIGGER trg_sync_asset_verification_from_category_update
AFTER UPDATE ON asset_reclassifications
FOR EACH ROW
WHEN (NEW.asset_id IS NOT NULL AND NEW.category IS DISTINCT FROM OLD.category)
EXECUTE FUNCTION sync_asset_verification_from_category();
