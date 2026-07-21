-- Retention policy untuk activity_logs: hapus baris lebih lama dari 3 bulan
-- setiap tanggal 1 jam 3 pagi. Lihat "activity log.md" untuk rasionalnya.
CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE OR REPLACE FUNCTION purge_old_activity_logs()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM activity_logs
  WHERE created_at < now() - interval '3 months';
$$;

SELECT cron.schedule(
  'purge-activity-logs',
  '0 3 1 * *',
  $$SELECT purge_old_activity_logs()$$
);
