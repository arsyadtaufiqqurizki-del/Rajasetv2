-- Activity log untuk semua aksi user di dashboard
CREATE TABLE IF NOT EXISTS activity_logs (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_name   TEXT NOT NULL,
  action_type TEXT NOT NULL,
  entity_type TEXT,
  entity_id   UUID,
  details     JSONB,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_activity_logs_created_at ON activity_logs(created_at DESC);

-- Menyimpan kapan tiap user terakhir membuka panel notifikasi
CREATE TABLE IF NOT EXISTS notification_reads (
  user_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  last_read_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS: semua authenticated user bisa baca, hanya bisa insert milik sendiri
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated users can read activity logs"
  ON activity_logs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "users can insert own activity logs"
  ON activity_logs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users can read own notification read state"
  ON notification_reads FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "users can upsert own notification read state"
  ON notification_reads FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users can update own notification read state"
  ON notification_reads FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);
