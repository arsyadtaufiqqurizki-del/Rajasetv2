# Asset Inventory System (Rajaset v2)

Aplikasi web untuk manajemen aset perusahaan, pelacakan inventaris, pemeliharaan, dan reklasifikasi aset. Dibangun dengan React + TypeScript di sisi klien dan **Supabase** (Postgres, Auth, RLS, pg_cron) sebagai backend.

## Tech Stack & Dependensi Utama

- **Framework & Build Tool**: React 19, Vite 6, TypeScript.
- **Backend / Database**: Supabase (`@supabase/supabase-js`, `@supabase/ssr`) — Postgres, Auth, Row Level Security, dan scheduled jobs via `pg_cron`.
- **Routing**: React Router DOM v7.
- **Styling**: Tailwind CSS v4, `clsx`, dan `tailwind-merge`.
- **Ikon & Animasi**: `lucide-react` untuk ikon dan `motion` untuk animasi transisi.
- **Visualisasi Data**: `recharts` untuk grafik interaktif pada Dashboard.
- **Utility**: `date-fns` untuk pemrosesan tanggal, `papaparse` untuk import/export CSV, `@google/genai` untuk fitur AI Assistant.
- **Deployment**: Cloudflare Workers (`wrangler`).

## Arsitektur Data (Supabase)

Aplikasi tidak lagi menggunakan state in-memory — seluruh data persisten disimpan di Supabase Postgres dan diakses lewat client di `src/lib/supabase.ts`. Autentikasi ditangani oleh `AuthContext.tsx` (Supabase Auth), dan setiap operasi CRUD utama tercatat ke tabel `activity_logs` (lihat `src/lib/activityLogger.ts` dan `src/hooks/useActivityLog.ts`) untuk feed notifikasi real-time (`NotificationBell.tsx`, `useSystemAlerts.ts`).

Skema database dikelola lewat migration di `supabase/migrations/`:
- `create_activity_logs` — tabel log aktivitas bersama sebagai feed notifikasi.
- `create_asset_reclassifications` — tabel untuk fitur reklasifikasi aset.
- `purge_old_activity_logs` — job `pg_cron` yang menghapus log aktivitas berumur lebih dari 3 bulan setiap tanggal 1 jam 3 pagi (tanpa arsip).

State pada sisi klien dikelola per-domain melalui React Context, masing-masing membungkus query/mutasi Supabase:
- **`AssetContext.tsx`** — data aset dan master data referensi (subsidiary, kategori 1 & 2), termasuk import/export CSV massal dengan proteksi CSV injection.
- **`MaintenanceContext.tsx`** — jadwal dan riwayat pemeliharaan aset.
- **`ReclassificationContext.tsx`** — pengajuan dan verifikasi reklasifikasi kategori/subsidiary aset.

## Fitur Utama

- **Manajemen Inventaris Aset**: CRUD lengkap dengan pagination, debounce search, dan autocomplete master data (`AutocompleteInput.tsx`).
- **Import/Export CSV**: Import massal aset dan reklasifikasi dengan sanitasi terhadap CSV injection, serta logging teragregasi (bukan per baris) agar `activity_logs` tidak membengkak.
- **Modul Pemeliharaan (Maintenance)**: Pelacakan tiket perbaikan aset (`AddMaintenanceModal.tsx`, `EditMaintenanceModal.tsx`).
- **Reklasifikasi Aset**: Alur pengajuan dan verifikasi perubahan kategori/subsidiary aset (`AddReclassificationModal.tsx`, `EditReclassificationModal.tsx`, `VerifyReclassificationModal.tsx`).
- **Dashboard & Analitik**: Statistik dan grafik interaktif (top subsidiary, distribusi kategori) dengan tooltip currency formatting.
- **Notifikasi & Activity Log**: Feed aktivitas real-time lintas modul dengan retention policy otomatis (purge 3 bulan via `pg_cron`).
- **AI Assistant**: Antarmuka bertenaga Gemini API (`@google/genai`) untuk membantu analisis/penggunaan aplikasi.
- **Autentikasi**: Login terproteksi berbasis Supabase Auth dengan route privat (`PrivateRoute`).

## Arsitektur Halaman (Routes)

- **`/login`**: Halaman login.
- **`/` (Dashboard)**: Ringkasan statistik dan analitik interaktif aset.
- **`/inventory`**: Tabel utama daftar aset — pencarian, CRUD, import/export CSV.
- **`/maintenance`**: Pemantauan dan pencatatan riwayat aset yang rusak/dalam perawatan.
- **`/reclassification`**: Pengajuan dan verifikasi reklasifikasi aset.
- **`/master-data`**: Manajemen entitas referensi (Kategori, Subsidiary, dll).
- **`/reports`**: Rekapitulasi pelaporan periodik.
- **`/ai-assistant`**: Asisten AI.
- **`/guide`**: Panduan penggunaan aplikasi.
- **`/settings`**: Konfigurasi umum aplikasi.

Semua route (kecuali `/login`) dibungkus `PrivateRoute` dan memerlukan sesi Supabase Auth aktif.

## Menjalankan Secara Lokal

```bash
npm install
npm run dev      # Vite dev server di http://localhost:3000
```

Buat file `.env` berdasarkan `.env.example` dan isi kredensial Supabase (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) serta `GEMINI_API_KEY` bila fitur AI Assistant digunakan.

Script lain:
- `npm run build` — build produksi via Vite.
- `npm run lint` — type-check dengan `tsc --noEmit`.
- `npm run deploy` — build lalu deploy ke Cloudflare Workers via `wrangler`.
