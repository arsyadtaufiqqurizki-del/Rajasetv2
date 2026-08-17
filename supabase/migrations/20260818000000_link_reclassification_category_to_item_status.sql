-- Extends the existing category <-> assets.verification sync (20260815020000)
-- to also mirror assets.item_status, since the Reclassification UI labels
-- `category` as "Item Status" but it never actually touched assets.item_status
-- until now. `verification` stays as-is (derived from category, independent
-- Yes/No flag); item_status becomes a second field kept in lockstep with
-- category so the two "Item Status" columns (Reclassification vs Asset
-- Inventory) show the same value for linked rows.

-- 1) assets.item_status -> category (linked rows only)
CREATE OR REPLACE FUNCTION sync_category_from_asset_item_status()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.item_status IS DISTINCT FROM '' THEN
    UPDATE asset_reclassifications
    SET category = NEW.item_status, updated_at = NOW()
    WHERE asset_id = NEW.id AND category = 'Needs Review';

    IF NOT EXISTS (SELECT 1 FROM asset_reclassifications WHERE asset_id = NEW.id) THEN
      INSERT INTO asset_reclassifications (asset_id, category, created_by)
      VALUES (NEW.id, NEW.item_status, auth.uid());
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_category_from_asset_item_status ON assets;
CREATE TRIGGER trg_sync_category_from_asset_item_status
AFTER UPDATE ON assets
FOR EACH ROW
WHEN (OLD.item_status IS DISTINCT FROM NEW.item_status)
EXECUTE FUNCTION sync_category_from_asset_item_status();

-- 2) category -> assets.verification (unchanged) + assets.item_status (new),
--    linked rows only. Same convergent-by-construction guard pattern as
--    20260815020000: once both sides agree, the opposing WHEN clause is a
--    no-op, so this can't loop.
CREATE OR REPLACE FUNCTION sync_asset_verification_from_category()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.asset_id IS NOT NULL THEN
    UPDATE assets
    SET verification = (NEW.category <> 'Needs Review'),
        verification_date = CASE WHEN NEW.category <> 'Needs Review' THEN CURRENT_DATE ELSE NULL END,
        item_status = NEW.category
    WHERE id = NEW.asset_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- One-time backfill: align existing linked assets' item_status with their
-- most recent reclassification category so historical data matches the new
-- sync before it takes over going forward.
UPDATE assets a
SET item_status = r.category
FROM (
  SELECT DISTINCT ON (asset_id) asset_id, category
  FROM asset_reclassifications
  WHERE asset_id IS NOT NULL
  ORDER BY asset_id, created_at DESC
) r
WHERE a.id = r.asset_id AND a.item_status IS DISTINCT FROM r.category;
