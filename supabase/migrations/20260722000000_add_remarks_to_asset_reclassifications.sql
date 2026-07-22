-- Tambah kolom remarks untuk catatan tambahan pada temuan reclassification
ALTER TABLE asset_reclassifications ADD COLUMN IF NOT EXISTS remarks TEXT;
