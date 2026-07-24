# Asset Inventory System (Rajaset v2)

Aplikasi web untuk manajemen aset perusahaan, pelacakan inventaris, pemeliharaan, dan reklasifikasi aset. Dibangun dengan React + TypeScript di sisi klien dan **Supabase** (Postgres, Auth, RLS, pg_cron) sebagai backend.

## Tech Stack & Dependensi Utama

- **Framework & Build Tool**: React 19, Vite 6, TypeScript.
- **Backend / Database**: Supabase (`@supabase/supabase-js`, `@supabase/ssr`) — Postgres, Auth, Row Level Security, dan scheduled jobs via `pg_cron`.
- **Routing**: React Router DOM v7.
- **Styling**: Tailwind CSS v4, `clsx`, dan `tailwind-merge`.
- **Ikon & Animasi**: `lucide-react` untuk ikon dan `motion` untuk animasi transisi.
- **Visualisasi Data**: `recharts` untuk grafik interaktif pada Dashboard.
- **Utility**: `date-fns` untuk pemrosesan tanggal, `papaparse` untuk import/export CSV.
- **Export Laporan**: `xlsx` untuk export Excel, `jspdf` + `jspdf-autotable` untuk export PDF (tabel & sign-off block), `html2canvas` untuk merender chart jadi gambar di PDF.
- **AI Assistant**: bukan simulasi client-side — frontend memanggil server Node terpisah (`server/`) yang meneruskan permintaan ke endpoint Anthropic-compatible.
- **Deployment**: Cloudflare Workers (`wrangler`).

## Arsitektur Data (Supabase)

Aplikasi tidak lagi menggunakan state in-memory — seluruh data persisten disimpan di Supabase Postgres dan diakses lewat client di `src/lib/supabase.ts`. Autentikasi ditangani oleh `AuthContext.tsx` (Supabase Auth), dan setiap operasi CRUD utama tercatat ke tabel `activity_logs` (lihat `src/lib/activityLogger.ts` dan `src/hooks/useActivityLog.ts`) untuk feed notifikasi real-time (`NotificationBell.tsx`, `useSystemAlerts.ts`).

Skema database dikelola lewat migration di `supabase/migrations/`:
- `create_activity_logs` — tabel log aktivitas bersama sebagai feed notifikasi.
- `create_asset_reclassifications` (+ migration `add_remarks_to_asset_reclassifications`) — tabel untuk fitur reklasifikasi aset, termasuk kolom catatan bebas (`remarks`).
- `purge_old_activity_logs` — job `pg_cron` yang menghapus log aktivitas berumur lebih dari 3 bulan setiap tanggal 1 jam 3 pagi (tanpa arsip).
- `create_report_history` (+ migration `add_delete_policy_to_report_history`) — tabel riwayat laporan yang di-generate dari halaman Reports.

State pada sisi klien dikelola per-domain melalui React Context, masing-masing membungkus query/mutasi Supabase:
- **`AssetContext.tsx`** — data aset dan master data referensi (subsidiary, kategori 1 & 2), termasuk import/export CSV massal dengan proteksi CSV injection dan timestamp `lastFetchedAt` untuk indikator "terakhir diperbarui".
- **`MaintenanceContext.tsx`** — jadwal dan riwayat pemeliharaan aset.
- **`ReclassificationContext.tsx`** — pengajuan dan verifikasi reklasifikasi kategori/subsidiary aset.
- **`ReportContext.tsx`** — riwayat laporan yang di-generate (paginasi server-side), simpan dan hapus entri `report_history`.

## Fitur Utama

- **Manajemen Inventaris Aset**: CRUD lengkap dengan pagination, debounce search, dan autocomplete master data (`AutocompleteInput.tsx`).
- **Import/Export CSV**: Import massal aset dan reklasifikasi dengan sanitasi terhadap CSV injection, serta logging teragregasi (bukan per baris) agar `activity_logs` tidak membengkak.
- **Modul Pemeliharaan (Maintenance)**: Pelacakan tiket perbaikan aset (`AddMaintenanceModal.tsx`, `EditMaintenanceModal.tsx`).
- **Reklasifikasi Aset**: Alur pengajuan dan verifikasi perubahan kategori/subsidiary aset (`AddReclassificationModal.tsx`, `EditReclassificationModal.tsx`, `VerifyReclassificationModal.tsx`).
- **Dashboard & Analitik**: Statistik dan grafik interaktif (top subsidiary, distribusi kategori) dengan tooltip currency formatting, tabel aset dengan filter (subsidiary/kategori/status) + pencarian debounce, dan indikator waktu "terakhir diperbarui".
- **Laporan (Reports)**: Generate 3 jenis laporan (Asset Valuation Summary, Depreciation Schedule, Maintenance Cost Analysis) dengan preview chart interaktif, riwayat laporan tersimpan di database dengan paginasi, dan export ke PDF (termasuk gambar chart, tabel detail per-aset dengan highlight over-budget, serta blok sign-off) maupun Excel — keduanya dengan sanitasi terhadap formula injection.
- **Notifikasi & Activity Log**: Feed aktivitas real-time lintas modul dengan retention policy otomatis (purge 3 bulan via `pg_cron`).
- **AI Assistant**: Chat UI yang memanggil server Node terpisah (`server/`) — server mengambil data aset & maintenance dari Supabase lalu meneruskan ke endpoint LLM Anthropic-compatible untuk jawaban kontekstual.
- **Autentikasi**: Login terproteksi berbasis Supabase Auth dengan route privat (`PrivateRoute`).

## Arsitektur Halaman (Routes)

- **`/login`**: Halaman login.
- **`/` (Dashboard)**: Ringkasan statistik dan analitik interaktif aset.
- **`/inventory`**: Tabel utama daftar aset — pencarian, CRUD, import/export CSV.
- **`/maintenance`**: Pemantauan dan pencatatan riwayat aset yang rusak/dalam perawatan.
- **`/reclassification`**: Pengajuan dan verifikasi reklasifikasi aset.
- **`/master-data`**: Manajemen entitas referensi (Kategori, Subsidiary, dll).
- **`/reports`**: Konfigurasi & preview laporan, export PDF/Excel, riwayat laporan tersimpan dengan paginasi.
- **`/ai-assistant`**: Asisten AI (chat, terhubung ke server backend terpisah).
- **`/guide`**: Panduan penggunaan aplikasi.
- **`/settings`**: Konfigurasi umum aplikasi.

Semua route (kecuali `/login`) dibungkus `PrivateRoute` dan memerlukan sesi Supabase Auth aktif.

## Menjalankan Secara Lokal

```bash
npm install
npm run dev      # Vite dev server di http://localhost:3000
```

Buat file `.env` di root dan isi kredensial Supabase (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) serta `VITE_AI_SERVER_URL` (base URL server AI Assistant, tanpa trailing `/chat`) bila fitur AI Assistant digunakan. Catatan: `.env.example` di root masih berisi sisa template `GEMINI_API_KEY`/`APP_URL` yang **tidak dipakai** kode saat ini — jangan dijadikan acuan.

Fitur AI Assistant butuh server terpisah di `server/` (`npm start` di dalam folder tersebut, atau via Docker) — server ini tidak dijalankan oleh `npm run dev` di root. Lihat `AGENTS.md` untuk daftar environment variable server (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `MIMO_API_KEY`, dll).

Script lain:
- `npm run build` — build produksi via Vite.
- `npm run preview` — preview hasil build produksi.
- `npm run lint` — type-check dengan `tsc --noEmit`.
- `npm run clean` — hapus `dist/` dan `server.js`.
- `npm run deploy` — build lalu deploy ke Cloudflare Workers via `wrangler`.
