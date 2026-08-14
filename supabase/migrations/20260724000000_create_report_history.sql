-- Riwayat report yang di-generate dari halaman Reports
CREATE TABLE IF NOT EXISTS report_history (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_name     TEXT NOT NULL,
  report_type   TEXT NOT NULL,
  subsidiary    TEXT,
  date_start    DATE,
  date_end      DATE,
  report_data   JSONB NOT NULL,
  status        TEXT NOT NULL DEFAULT 'Generated',
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_report_history_created_at ON report_history(created_at DESC);

-- RLS: semua authenticated user bisa baca, hanya bisa insert milik sendiri
ALTER TABLE report_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated users can read report history" ON report_history;
CREATE POLICY "authenticated users can read report history"
  ON report_history FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "users can insert own report history" ON report_history;
CREATE POLICY "users can insert own report history"
  ON report_history FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);
