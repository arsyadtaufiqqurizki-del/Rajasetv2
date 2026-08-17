-- Reclassification's "Verification" state now derives from `category`
-- ('Needs Review' = Unverified, anything else = Verified) instead of the
-- separate `verified` flag, so it stays consistent with the existing
-- bidirectional category <-> assets.verification sync (20260815020000).
-- The manual verify action now writes `category` directly (see
-- verifyReclassification in ReclassificationContext.tsx), so this column
-- is redundant. Its index is dropped automatically with it.
ALTER TABLE asset_reclassifications DROP COLUMN verified;
