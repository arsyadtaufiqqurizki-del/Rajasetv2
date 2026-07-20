-- Asset reclassification: log audit fisik aset, independen dari tabel `assets`
CREATE TABLE IF NOT EXISTS asset_reclassifications (
  id                 UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  asset_category     TEXT,
  asset_description  TEXT NOT NULL,
  location           TEXT,
  unit               NUMERIC,
  ownership          TEXT,
  category           TEXT NOT NULL DEFAULT 'Needs Review',
  verified           BOOLEAN NOT NULL DEFAULT false,
  verification_date  TIMESTAMPTZ,
  verified_by        TEXT,
  created_by         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_reclass_category ON asset_reclassifications(category);
CREATE INDEX idx_reclass_verified ON asset_reclassifications(verified);
CREATE INDEX idx_reclass_created_at ON asset_reclassifications(created_at DESC);

ALTER TABLE asset_reclassifications ENABLE ROW LEVEL SECURITY;

-- Sama model trust dengan tabel `assets`: semua authenticated user bisa baca/ubah/hapus,
-- tapi insert wajib tercatat atas nama pembuatnya sendiri untuk jejak audit.
CREATE POLICY "authenticated users can read reclassifications"
  ON asset_reclassifications FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "users can insert own reclassifications"
  ON asset_reclassifications FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "authenticated users can update reclassifications"
  ON asset_reclassifications FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "authenticated users can delete reclassifications"
  ON asset_reclassifications FOR DELETE
  TO authenticated
  USING (true);
