-- Fixes duplicate asset_reclassifications rows created by
-- sync_category_from_asset_verification() (20260815020000). When an asset
-- was un-verified from Asset Inventory (EditAssetModal, not the
-- Reclassification page's own Verify toggle) while its existing linked row's
-- category was already something other than 'Needs Review', the trigger's
-- false-branch did a blind NOT EXISTS(category = 'Needs Review') check and
-- INSERTed a second row instead of resetting the existing one -- violating
-- the "one reclassification row per linked asset" invariant that
-- AddReclassificationModal/syncFromAssets both rely on (they filter out
-- already-linked assets, assuming at most one row per asset_id).

-- 1) Cleanup: for assets with more than one linked row, keep only the row
-- most recently touched (it reflects the asset's current
-- verification/item_status state, since the trigger cascade always converges
-- assets <-> the row it last wrote) and drop the rest. Unlinked rows
-- (asset_id IS NULL) are untouched.
DELETE FROM asset_reclassifications r
WHERE r.asset_id IS NOT NULL
AND r.id NOT IN (
  SELECT DISTINCT ON (asset_id) id
  FROM asset_reclassifications
  WHERE asset_id IS NOT NULL
  ORDER BY asset_id, COALESCE(updated_at, created_at) DESC, created_at DESC
);

-- 2) Fix the trigger: un-verifying an asset that already has a linked row
-- must UPDATE that row back to 'Needs Review', never insert a second one.
-- Only insert when the asset truly has no reclassification row yet (e.g. the
-- unconditional INSERT-trigger path for brand new assets).
CREATE OR REPLACE FUNCTION sync_category_from_asset_verification()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.verification = false THEN
    IF EXISTS (SELECT 1 FROM asset_reclassifications WHERE asset_id = NEW.id) THEN
      UPDATE asset_reclassifications
      SET category = 'Needs Review', updated_at = NOW()
      WHERE id = (
        SELECT id FROM asset_reclassifications
        WHERE asset_id = NEW.id
        ORDER BY COALESCE(updated_at, created_at) DESC, created_at DESC
        LIMIT 1
      );
    ELSE
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
