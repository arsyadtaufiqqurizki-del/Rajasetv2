# Activity Log — Retention Plan

## Latar Belakang

`activity_logs` bisa terus membengkak seiring waktu karena setiap aksi user (tambah aset, edit, hapus, import CSV, reklasifikasi, maintenance) menghasilkan baris baru. Flooding dari import CSV per-baris sudah pernah diatasi (lihat commit `5740850` — `skipLog` param di `AssetContext`/`ReclassificationContext` bikin 1x import = 1 baris log summary, bukan ribuan baris). Yang belum ditangani adalah pertumbuhan **jangka panjang**: kalau import & aktivitas harian terus berjalan selama berbulan-bulan, tabel tetap tumbuh tanpa batas karena belum ada retention policy.

## Tabel `activity_logs` (referensi)

Struktur saat ini (migration `20260701000000_create_activity_logs.sql`), jadi pertimbangan untuk desain purge di bawah:

```sql
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
```

RLS: semua authenticated user bisa `SELECT` (`USING (true)`), tapi `INSERT` hanya untuk baris milik sendiri (`auth.uid() = user_id`). Tidak ada policy `DELETE` — artinya purge harus lewat fungsi `SECURITY DEFINER` (lihat bagian Mekanisme), bukan lewat client langsung, karena user biasa memang tidak diberi izin hapus baris di tabel ini.

## Keputusan

Tidak menambah tabel archive terpisah. `activity_logs` di sini berfungsi sebagai feed notifikasi real-time, bukan audit trail resmi — jadi data lama cukup **dihapus permanen**, tidak perlu dipindah/disimpan di tempat lain. Kalau nanti ternyata butuh histori jangka panjang untuk audit/kepatuhan, baru dipertimbangkan lapisan archive (tabel archive atau export ke Supabase Storage) sebagai iterasi berikutnya.

## Mekanisme

### 1. Fungsi purge

```sql
CREATE OR REPLACE FUNCTION purge_old_activity_logs()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  DELETE FROM activity_logs
  WHERE created_at < now() - interval '6 months';
$$;
```

`SECURITY DEFINER` supaya fungsi bisa jalan lewat cron tanpa terikat RLS user biasa.

### 2. Jadwal otomatis via `pg_cron`

```sql
CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.schedule(
  'purge-activity-logs',
  '0 3 1 * *',  -- tiap tanggal 1, jam 3 pagi
  $$SELECT purge_old_activity_logs()$$
);
```

Jalan otomatis tiap bulan tanpa campur tangan manual.

### 3. Tidak ada perubahan di frontend

Activity feed & notifikasi sudah query `activity_logs` dengan `ORDER BY created_at DESC` + limit, jadi begitu data lama terhapus, tampilan tetap normal — histori di luar retention window memang tidak pernah ditampilkan di feed.

### 4. Retention window

**3 bulan** (dikonfirmasi), disimpan sebagai literal `interval` di fungsi. Kalau kebutuhan berubah, tinggal buat migration baru yang `CREATE OR REPLACE FUNCTION` dengan interval baru.

## Trade-off

- **Plus**: implementasi minimal — satu migration file (function + cron schedule), tidak ada tabel/RLS tambahan, tidak ada perubahan kode aplikasi.
- **Minus**: data yang lewat retention window hilang permanen, tidak bisa ditelusuri lagi (misal "siapa yang ubah aset X bulan lalu?").
- **Skala**: untuk volume saat ini (ribuan baris per event, bukan jutaan), `DELETE` + autovacuum bawaan Supabase sudah cukup. Table partitioning (`PARTITION BY RANGE` + drop partition) baru relevan kalau volume naik ke jutaan baris/bulan.

## Status

Selesai. Migration `supabase/migrations/20260721000000_purge_old_activity_logs.sql` sudah di-apply ke project remote (`kuvuylohuhuyjpzbkitp`) lewat `supabase db push` pada 21 Jul 2026. Cron job `purge-activity-logs` aktif, jalan tiap tanggal 1 jam 3 pagi.
