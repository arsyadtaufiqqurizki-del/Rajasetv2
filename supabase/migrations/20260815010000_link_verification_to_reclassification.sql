-- Connects Asset Inventory's "Verification" flag to the Reclassification audit queue.
-- Previously the two verification concepts (assets.verification vs.
-- asset_reclassifications.verified) were fully independent — this makes
-- Reclassification the actual worklist for unverified assets, and keeps
-- Inventory's flag in sync once an audit row is verified there.

-- 1) When an asset is (or becomes) unverified, auto-create an audit row for it,
--    unless it already has one that's still pending (unverified). Rows the asset
--    already verified in the past are left alone — a fresh re-audit gets its own
--    new row instead of resetting history.
CREATE OR REPLACE FUNCTION auto_queue_asset_for_reclassification()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM asset_reclassifications
    WHERE asset_id = NEW.id AND verified = false
  ) THEN
    INSERT INTO asset_reclassifications (asset_id, category, verified, created_by)
    VALUES (NEW.id, 'Needs Review', false, auth.uid());
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Split into separate INSERT/UPDATE triggers: a WHEN clause can't reference
-- TG_OP, and OLD isn't available to compare against on INSERT.
DROP TRIGGER IF EXISTS trg_auto_queue_asset_for_reclassification ON assets;
DROP TRIGGER IF EXISTS trg_auto_queue_asset_for_reclassification_insert ON assets;
DROP TRIGGER IF EXISTS trg_auto_queue_asset_for_reclassification_update ON assets;

CREATE TRIGGER trg_auto_queue_asset_for_reclassification_insert
AFTER INSERT ON assets
FOR EACH ROW
WHEN (NEW.verification = false)
EXECUTE FUNCTION auto_queue_asset_for_reclassification();

CREATE TRIGGER trg_auto_queue_asset_for_reclassification_update
AFTER UPDATE ON assets
FOR EACH ROW
WHEN (NEW.verification = false AND OLD.verification IS DISTINCT FROM NEW.verification)
EXECUTE FUNCTION auto_queue_asset_for_reclassification();

-- 2) When a linked audit row gets verified, mirror that back onto the asset's
--    Verification / Verification Date so Inventory reflects it without a second
--    manual entry.
CREATE OR REPLACE FUNCTION sync_asset_verification_from_reclassification()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE assets
  SET verification = true,
      verification_date = COALESCE(NEW.verification_date::date, CURRENT_DATE)
  WHERE id = NEW.asset_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_asset_verification_from_reclassification ON asset_reclassifications;
CREATE TRIGGER trg_sync_asset_verification_from_reclassification
AFTER UPDATE ON asset_reclassifications
FOR EACH ROW
WHEN (NEW.asset_id IS NOT NULL AND NEW.verified = true AND OLD.verified = false)
EXECUTE FUNCTION sync_asset_verification_from_reclassification();
