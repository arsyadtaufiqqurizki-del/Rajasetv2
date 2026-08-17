# AGENTS.md - Raja Project Dashboard (Asset Inventory System)

## Project Overview

Aplikasi web React untuk manajemen aset perusahaan "Perusahaan Raja". Sistem ini mengelola inventaris aset, pelacakan pemeliharaan (maintenance), reklasifikasi aset, pelaporan (dengan riwayat tersimpan & export PDF/Excel), dan activity log — semua data persisten di **Supabase** (Postgres + Auth + Realtime + `pg_cron`). Ada juga AI Assistant yang terhubung ke server chat terpisah (`server/`).

## Tech Stack

- **Framework**: React 19 + TypeScript
- **Build Tool**: Vite 6
- **Routing**: React Router DOM v7
- **Backend/DB**: Supabase (Postgres, Auth, Realtime) via `@supabase/supabase-js`
- **Styling**: Tailwind CSS v4 + `clsx` + `tailwind-merge`
- **Icons**: lucide-react
- **Animation**: motion (framer-motion)
- **Charts**: recharts
- **CSV**: papaparse
- **Excel export**: xlsx
- **PDF export**: jspdf + jspdf-autotable, chart-to-image via html2canvas
- **Date**: date-fns
- **AI Assistant backend**: standalone Node server in `server/` (see below)

## Commands

```bash
npm run dev        # Start dev server on port 3000
npm run build      # Production build
npm run preview    # Preview production build
npm run lint       # TypeScript type-check (tsc --noEmit)
npm run clean      # Remove dist/ and server.js
```

`server/` is a separate Node app (`npm start` inside `server/`, or via Docker) — it is not run by the root `npm run dev`.

## Project Structure

```
.
├── index.html                    # Entry HTML
├── package.json
├── tsconfig.json
├── vite.config.ts                # Vite config with @ path alias
├── .env                          # VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_AI_SERVER_URL
├── src/
│   ├── main.tsx                  # React entry point
│   ├── App.tsx                   # Root component with routing
│   ├── index.css                 # Tailwind + custom theme
│   ├── lib/
│   │   ├── supabase.ts           # Supabase client (the one actually used everywhere)
│   │   ├── activityLogger.ts     # logActivity() helper — writes to activity_logs table
│   │   └── utils.ts              # cn() utility (clsx + twMerge)
│   ├── utils/supabase/client.ts  # UNUSED duplicate client — dead code, wrong env var name, do not use
│   ├── hooks/
│   │   ├── useActivityLog.ts     # Fetches activity_logs + Realtime subscription + unread count
│   │   └── useSystemAlerts.ts    # Computes overdue-maintenance / broken-asset alerts
│   ├── contexts/
│   │   ├── AuthContext.tsx        # Supabase Auth (email/password), session-based
│   │   ├── AssetContext.tsx       # Asset CRUD (Supabase `assets` table) + master data + `lastFetchedAt`
│   │   ├── MaintenanceContext.tsx # Maintenance CRUD (Supabase `maintenance_records` table)
│   │   ├── ReclassificationContext.tsx # Reclassification CRUD (Supabase `asset_reclassifications` table)
│   │   └── ReportContext.tsx      # Report history CRUD (Supabase `report_history` table), server-side pagination
│   ├── components/
│   │   ├── Layout.tsx            # Sidebar + header + outlet
│   │   ├── NotificationBell.tsx  # Bell icon, activity feed + system alerts panel
│   │   ├── AutocompleteInput.tsx # Reusable autocomplete input
│   │   ├── AddAssetModal.tsx     # Add asset form modal
│   │   ├── EditAssetModal.tsx    # Edit asset form modal
│   │   ├── AddMaintenanceModal.tsx
│   │   ├── EditMaintenanceModal.tsx
│   │   ├── AddReclassificationModal.tsx
│   │   ├── EditReclassificationModal.tsx
│   │   └── VerifyReclassificationModal.tsx
│   └── pages/
│       ├── Login.tsx             # Login page (Supabase email/password)
│       ├── Dashboard.tsx         # Overview with charts & KPIs
│       ├── Inventory.tsx         # Asset table with CRUD, filter, CSV import/export
│       ├── Maintenance.tsx       # Maintenance records & schedule
│       ├── Reclassification.tsx  # Reclassification table with CRUD, verify, CSV import/export
│       ├── MasterData.tsx        # Manage subsidiaries & categories
│       ├── Reports.tsx           # Report configuration, live chart preview, PDF/Excel export, report history table
│       ├── AIAssistant.tsx       # Chat UI, calls server/ backend for real LLM answers
│       ├── Guide.tsx             # FAQ / user guide
│       └── Settings.tsx          # Profile, config, notifications, security (UI-only, not persisted)
├── server/                       # Standalone Node HTTP server for AI Assistant
│   ├── index.js                  # POST /chat — fetches assets+maintenance from Supabase, calls LLM
│   └── Dockerfile
└── supabase/migrations/
    ├── 20260701000000_create_activity_logs.sql        # activity_logs table + RLS
    ├── 20260720000000_create_asset_reclassifications.sql # asset_reclassifications table + RLS
    ├── 20260721000000_purge_old_activity_logs.sql      # pg_cron job: purge activity_logs > 3 months
    ├── 20260722000000_add_remarks_to_asset_reclassifications.sql # adds `remarks` TEXT column
    ├── 20260724000000_create_report_history.sql        # report_history table + RLS (select/insert)
    ├── 20260724010000_add_delete_policy_to_report_history.sql # RLS delete policy for report_history
    ├── 20260814000000_link_reclassifications_to_assets.sql # adds `asset_id` FK; linked rows mirror asset fields live
    ├── 20260815020000_unify_reclassification_category_with_verification.sql # bidirectional trigger: category <-> assets.verification
    ├── 20260817000000_drop_reclassification_verified_column.sql # drops `verified` col — now derived from `category`
    ├── 20260818000000_link_reclassification_category_to_item_status.sql # extends sync to assets.item_status
    └── 20260818010000_fix_reclassification_duplicate_on_unverify.sql # fixes duplicate-row bug in the sync trigger (see "Reclassification ↔ Asset Verification Sync" below)
```

## Architecture

### State Management (Supabase-backed)

Semua data utama (assets, maintenance_records, asset_reclassifications, report_history, subsidiaries, categories, activity_logs, notification_reads) disimpan di **Supabase Postgres**, diakses lewat React Context yang fetch on-mount dan menulis langsung ke Supabase. Data persisten antar sesi/refresh.

**AuthContext** (`src/contexts/AuthContext.tsx`)
- `isAuthenticated`, `loading`: boolean, dari `supabase.auth.getSession()` + `onAuthStateChange`
- `login(email, password)`: `supabase.auth.signInWithPassword`
- `logout()`: `supabase.auth.signOut`

**AssetContext** (`src/contexts/AssetContext.tsx`)
- `assets`: Asset[] — fetched dari tabel `assets` (chunked fetch, 1000 rows/page, untuk lewati limit default Supabase)
- `lastFetchedAt`: Date | null — timestamp update terakhir (initial fetch + setiap CRUD sukses); dipakai Dashboard untuk menampilkan "Terakhir diperbarui"
- `subsidiaries`, `categories1`, `categories2`: string[] — dari tabel `subsidiaries`, `category_segments_1`, `category_segments_2` (nama tabel/kolom DB tidak diubah; di UI ditampilkan sebagai "Asset Class"/"Location" — lihat catatan di Known Issues)
- CRUD: `addAsset`, `updateAsset`, `deleteAsset`, `deleteMultipleAssets` (batched 100), `deleteAllAssets`
- Master data: `addSubsidiary`, `deleteSubsidiary`, `addCategory1`, `deleteCategory1`, `addCategory2`, `deleteCategory2` (upsert/delete langsung ke Supabase)
- Modal state: `isAddModalOpen`, `isEditModalOpen`, `editingAsset`
- Auto-upsert: saat tambah/edit aset, subsidiary & categories otomatis ditambahkan ke master data jika belum ada
- `statusLevel` dikomputasi dari `status`: `active` → success, `maintenance` → warning, `broken`/`service` → error
- Setiap mutasi CRUD memanggil `logActivity()` → tercatat di `activity_logs`

**MaintenanceContext** (`src/contexts/MaintenanceContext.tsx`)
- `records`: MaintenanceRecord[] — dari tabel `maintenance_records`
- CRUD: `addRecord`, `updateRecord`, `deleteRecord`
- `addRecord`/`updateRecord` memanggil `logActivity()`

**ReclassificationContext** (`src/contexts/ReclassificationContext.tsx`)
- `reclassifications`: Reclassification[] — fetched chunked (1000 rows/page) dari tabel `asset_reclassifications`
- Baris bisa **linked** (`assetId` set, via FK ke `assets`) atau **unlinked** (free-text). Baris linked me-mirror field identitas aset (nomor, deskripsi, lokasi, dll) secara live lewat join `linked_asset:assets(...)` — field itu tidak lagi disimpan di baris reclassification-nya sendiri untuk baris linked.
- CRUD: `addReclassification(item, skipLog?)` (unlinked), `addLinkedReclassification(assetId, category, remarks)` (linked — dipakai `AddReclassificationModal`, hanya menampilkan asset yang belum ter-link), `updateReclassification`, `deleteReclassification`
- `verifyReclassification(id, verified)`: menulis `category` ('Asset' saat verified, 'Needs Review' saat tidak) + `verification_date`/`verified_by` (nama dari `user_metadata.full_name` atau email). **Tidak ada kolom `verified` tersimpan** — lihat schema di bawah.
- `syncFromAssets(assets)`: bulk-link semua asset yang belum ter-link, `category` awal mengikuti `itemStatus` asset (fallback `'Asset'`) atau `'Needs Review'` kalau asset belum verified. Skip asset yang sudah ter-link (satu baris reclassification per asset yang ter-link).
- `remarks`: string — catatan tambahan bebas per temuan reklasifikasi (kolom `remarks` di `asset_reclassifications`, ditambah lewat migration terpisah)
- Modal state: `isAddModalOpen`, `isEditModalOpen`, `editingReclassification`, `isVerifyModalOpen`, `verifyingReclassification`
- Setiap mutasi (kecuali saat `skipLog=true`) memanggil `logActivity()` dengan actionType `ADD_RECLASSIFICATION`/`UPDATE_RECLASSIFICATION`/`DELETE_RECLASSIFICATION`/`VERIFY_RECLASSIFICATION`

### Reclassification ↔ Asset Verification Sync (DB triggers)

Untuk baris linked, `asset_reclassifications.category` dan `assets.verification`/`assets.item_status` disinkronkan bidirectional lewat Postgres trigger (bukan kode aplikasi):
- `category = 'Needs Review'` ⟷ `assets.verification = false`; `category` lain apa pun ⟷ `verification = true` (jadi `verified` di UI **derived** dari `category`, bukan kolom tersendiri — lihat migration `20260817000000`).
- `assets.item_status` di-mirror ke `category` dan sebaliknya (migration `20260818000000`) — dua kolom "Item Status" (Asset Inventory vs Reclassification) selalu senilai untuk baris linked.
- **Invariant**: maksimal satu baris `asset_reclassifications` per `asset_id` yang ter-link (ditegakkan di level aplikasi — `AddReclassificationModal`/`syncFromAssets` menyaring asset yang sudah ter-link — bukan constraint DB).
- **Bug yang pernah terjadi** (fixed di migration `20260818010000`): trigger `sync_category_from_asset_verification()` yang lama, saat un-verify dari **Asset Inventory** (bukan dari tombol Verify di halaman Reclassification), cuma cek "ada baris `category = 'Needs Review'`?" — kalau baris yang ada category-nya bukan `'Needs Review'` (mis. sudah `'Asset'`), trigger salah kaprah INSERT baris baru alih-alih UPDATE baris lama, melanggar invariant di atas dan bikin asset itu tampil dobel di halaman Reclassification. Fix-nya: cek dulu apakah asset itu **sudah punya baris apa pun**, kalau ya UPDATE baris itu balik ke `'Needs Review'`, insert baru hanya kalau benar-benar belum pernah ada baris untuk asset itu.
- Sinkronisasi ini jalan di level DB (trigger), bukan realtime di UI — perubahan dari satu halaman (mis. edit di Asset Inventory) baru kelihatan di halaman lain (Reclassification) setelah reload, karena context fetch data sekali saat mount (tidak ada refetch/subscription lintas halaman).

**ReportContext** (`src/contexts/ReportContext.tsx`)
- `reportHistory`: ReportRecord[] — halaman saat ini dari tabel `report_history`, server-side pagination (`PAGE_SIZE = 5`) via `.range()` + `count: 'exact'`
- `page`, `totalPages`, `totalCount`, `setPage`
- `saveReport({ reportType, subsidiary, dateStart, dateEnd, reportData })`: insert row baru (reportData disimpan sebagai JSONB berisi chart data + summary + detail records), lalu reset ke halaman 1; memanggil `logActivity()` dengan actionType `GENERATE_REPORT`
- `deleteReport(id)`: hapus row; mundur satu halaman otomatis jika menghapus item terakhir di halaman non-pertama
- `userName` per report diambil dari `user_metadata.full_name` atau email user yang generate

### Activity Log & Notifications

Sistem notifikasi bell (`NotificationBell.tsx`) menggabungkan dua sumber:
1. **Activity log** (`useActivityLog.ts`) — 20 log terbaru dari tabel `activity_logs`, live update via Supabase Realtime (`postgres_changes` INSERT). Unread count dihitung dari `notification_reads.last_read_at` per user.
2. **System alerts** (`useSystemAlerts.ts`) — dihitung on-demand saat panel dibuka: maintenance overdue (status = 'Overdue') dan aset rusak (>10% dari total).

`logActivity()` (`src/lib/activityLogger.ts`) dipanggil dari context CRUD methods dan dari `Inventory.tsx`/`Reclassification.tsx` (untuk `IMPORT_CSV`, sekali per operasi import — bukan per baris). Action types: `IMPORT_CSV`, `ADD_ASSET`, `UPDATE_ASSET`, `DELETE_ASSET`, `BULK_DELETE`, `ADD_MAINTENANCE`, `UPDATE_MAINTENANCE`, `ADD_RECLASSIFICATION`, `UPDATE_RECLASSIFICATION`, `DELETE_RECLASSIFICATION`, `VERIFY_RECLASSIFICATION`, `GENERATE_REPORT`, `EXPORT_REPORT` (dipanggil langsung dari `Reports.tsx` saat generate/export PDF/Excel, bukan dari context).

`addAsset`/`addReclassification` menerima parameter opsional `skipLog` (default `false`) — dipakai saat CSV bulk import memanggil CRUD per baris, agar tidak membanjiri `activity_logs` dengan satu row per baris; import CSV tetap mencatat satu log agregat (`total`/`success`/`failed`) di akhir.

RLS: semua authenticated user bisa `SELECT activity_logs`; insert hanya untuk `user_id` sendiri. Lihat `supabase/migrations/20260701000000_create_activity_logs.sql`.

**Retention**: `pg_cron` job `purge-activity-logs` (`supabase/migrations/20260721000000_purge_old_activity_logs.sql`) menghapus baris `activity_logs` lebih tua dari 3 bulan, jalan tiap tanggal 1 jam 3 pagi. Tidak ada arsip — purge langsung.

### AI Assistant

`AIAssistant.tsx` bukan simulasi — ia POST ke `${VITE_AI_SERVER_URL}/chat` (server terpisah di `server/index.js`). Server itu fetch data `assets` + `maintenance_records` langsung dari Supabase (pakai `SUPABASE_URL`/`SUPABASE_ANON_KEY` di env server, bukan `VITE_`-prefixed), susun system prompt berisi ringkasan + seluruh data, lalu forward ke endpoint Anthropic-compatible (`MIMO_BASE_URL`, model dari `MIMO_MODEL`, key dari `MIMO_API_KEY`). Chat history & pesan disimpan di `localStorage` browser (bukan Supabase) dengan sliding-window trim (`MAX_MESSAGES = 21`, `MAX_HISTORY = 20`).

### Reports

`Reports.tsx` menghitung 3 jenis report langsung di client dari data `AssetContext`/`MaintenanceContext` yang sudah ter-load (tidak ada query Supabase khusus report):
- **Asset Valuation Summary** (bar chart): total nilai aset per `categorySegment1` (label "Asset Class"), difilter subsidiary + `datePlaceInService` dalam rentang tanggal
- **Depreciation Schedule** (line chart): nilai buku per kuartal (`getQuartersInRange`) pakai depresiasi garis-lurus (`monthsBetween` vs `lifeInMonths`)
- **Maintenance Cost Analysis** (composed bar chart): estimated vs actual cost per `serviceType`, dari `maintenance_records` difilter `scheduledDate` dalam rentang

Setiap `generatePreview()` yang sukses otomatis memanggil `saveReport()` (ReportContext) — jadi tiap generate preview membuat 1 row baru di `report_history`, bukan cuma saat export. Tabel "Recent Reports" di bawah preview menampilkan `reportHistory` dengan pagination server-side dan tombol delete (`deleteReport`, ada confirm dialog `window.confirm`).

**Export**:
- **PDF** (`handleExportPDF`, via `jsPDF` + `jspdf-autotable`): render header (judul, subsidiary, rentang tanggal, generated-by), summary stat boxes, chart di-capture jadi PNG lewat `html2canvas` (ref `chartRef`) lalu di-`addImage`, tabel data utama dengan baris total, halaman kedua "Detail Records" per-asset dengan highlight merah pada kolom `variance` yang positif (over-budget, khusus Maintenance Cost Analysis), lalu blok sign-off ("Prepared by" / "Reviewed by" / "Approved by") dan page numbering di footer tiap halaman.
- **Excel** (`handleExportExcel`, via `xlsx`): export `previewData.data` (bukan detail records) ke satu sheet.
- Kedua export memanggil `sanitizeForSpreadsheet()` (prefix `'` pada value yang diawali `=`/`+`/`-`/`@`) untuk cegah formula injection, lalu `logActivity()` dengan actionType `EXPORT_REPORT` (`format: 'PDF'|'Excel'`).

### Data Schemas

**Asset** (kolom Supabase pakai snake_case, di-map ke camelCase di `AssetContext.tsx`):
| Field | Type | Description |
|---|---|---|
| id | string (UUID) | Primary key, dari Supabase |
| assetBook | string | Jenis buku aset |
| subsidiary | string | Entitas anak perusahaan |
| assetNumber | string | Nomor seri |
| assetDescription | string | Deskripsi aset |
| assetCost | string | Harga beli (formatted with commas) |
| datePlaceInService | string | Tanggal mulai digunakan |
| assetUnits | string | Jumlah unit |
| categorySegment1 | string | Kategori utama — ditampilkan di UI sebagai **"Asset Class"** (Inventory, Dashboard, MasterData, Add/EditAssetModal), tapi nama field/kolom DB (`categorySegment1`/`category_segment1`) tidak diubah |
| categorySegment2 | string | Kategori turunan — ditampilkan di UI sebagai **"Location"**, nama field/kolom DB tidak diubah |
| depreciationMethod | string | Metode penyusutan |
| lifeInMonths | string | Umur ekonomis (bulan), atau "Unlimited" |
| listed | string | Status listing (Audited/Non-Listed) |
| status | string | Active/In Maintenance/Needs Service/Broken/Retired |
| statusLevel | 'success'\|'warning'\|'error'\|'default' | Badge color (computed, tidak disimpan di DB) |

**MaintenanceRecord**:
| Field | Type |
|---|---|
| id | string (UUID) |
| assetBook | string |
| subsidiary | string |
| assetNumber | string |
| assetDescription | string |
| assetUnits | string |
| serviceType | string |
| assetCategorySegment1 | string | UI label: **"Asset Class"** (Maintenance table header), field/kolom DB tidak diubah |
| assetCategorySegment2 | string | UI label: **"Location"**, field/kolom DB tidak diubah |
| estimateCost | string |
| actualCost | string |
| status | string (Pending/In Progress/Completed/Overdue) |
| scheduledDate | string |

**Reclassification** (tabel `asset_reclassifications`):
| Field | Type | Description |
|---|---|---|
| id | string (UUID) | Primary key |
| assetId | string \| null | FK ke `assets.id`. Null = baris unlinked (free-text) |
| linkedAssetNumber | string | Hanya terisi untuk baris linked, live dari join `assets.asset_number` |
| assetCategory | string | Linked: live dari `assets.category_segment1`. Unlinked: kolom lokal `asset_category` |
| assetDescription | string | Linked: live dari `assets.asset_description`. Unlinked: kolom lokal |
| location | string | Linked: live dari `assets.category_segment2`. Unlinked: kolom lokal |
| unit | string | Linked: live dari `assets.asset_units`. Unlinked: kolom lokal (disimpan numeric, di-string-kan di client) |
| ownership | string | Linked: live dari `assets.subsidiary`. Unlinked: kolom lokal |
| category | 'Asset'\|'Needs Review'\|'Inventory'\|string | Kategori hasil reklasifikasi. UI label: **"Item Status"**. Untuk baris linked, disinkronkan bidirectional dengan `assets.verification`/`assets.item_status` via DB trigger — lihat "Reclassification ↔ Asset Verification Sync" di atas |
| verified | boolean | **Tidak disimpan** — derived di client: `category !== 'Needs Review'` (kolom `verified` di-drop via migration `20260817000000`) |
| verificationDate | string | Tanggal diverifikasi (kosong jika belum) |
| verifiedBy | string | Nama/email verifikator |
| createdAt | string | Timestamp dibuat |
| remarks | string | Catatan tambahan bebas (kolom `remarks`, ditambah via migration `20260722000000`) |

**ReportRecord** (tabel `report_history`):
| Field | Type | Description |
|---|---|---|
| id | string (UUID) | Primary key |
| userName | string | Nama/email user yang generate report |
| reportType | string | 'Asset Valuation Summary' \| 'Depreciation Schedule' \| 'Maintenance Cost Analysis' |
| subsidiary | string | 'All Divisions' atau nama subsidiary spesifik |
| dateStart / dateEnd | string | Rentang tanggal report (DATE di Supabase) |
| reportData | any (JSONB) | Payload lengkap: chart data, `summary[]`, `detailColumns[]`, `detailData[]` |
| status | string | Default `'Generated'` |
| createdAt | string | Timestamp dibuat |

### Routing

Semua halaman dilindungi oleh `PrivateRoute` (kecuali `/login`). Redirect ke `/login` jika tidak terotentikasi (dicek via `AuthContext`, bukan access code lokal).

| Route | Page | Description |
|---|---|---|
| `/login` | Login | Supabase email/password login |
| `/` | Dashboard | KPI cards, charts, filterable/searchable assets table with "last updated" timestamp |
| `/inventory` | Inventory | Full asset CRUD, CSV import/export, filters |
| `/maintenance` | Maintenance | Maintenance CRUD, schedule, filters |
| `/reclassification` | Reclassification | Reclassification CRUD, verify, CSV import/export |
| `/master-data` | MasterData | Manage subsidiaries & categories |
| `/reports` | Reports | Report config + live chart preview, PDF/Excel export, saved report history with pagination |
| `/ai-assistant` | AIAssistant | Chat UI, calls real LLM backend (`server/`) |
| `/guide` | Guide | FAQ accordion |
| `/settings` | Settings | Profile, config, notifications, security — UI state only, not persisted |

### Styling

- Custom theme di `src/index.css` menggunakan Tailwind CSS v4 `@theme` directive
- Warna corporate: primary=#000000, secondary=#515f74, error=#ba1a1a
- Font: Inter (sans) + JetBrains Mono (monospace)
- Utility `cn()` di `src/lib/utils.ts` untuk menggabungkan class names

### Path Alias

`@/*` → project root (configured in vite.config.ts dan tsconfig.json)

## Key Patterns

1. **Modal-based CRUD**: Asset dan Maintenance menggunakan modal untuk add/edit
2. **AutocompleteInput**: Komponen reusable yang terhubung ke master data untuk input konsisten
3. **Debounce Search**: Inventory, Maintenance, dan Dashboard menggunakan debounce 300ms pada pencarian
4. **Pagination**: Client-side pagination (10 items per page) pada Inventory, Maintenance, dan Dashboard
5. **CSV Import/Export**: Menggunakan papaparse, max 5000 rows per import, invalid rows di-skip dan bisa didownload terpisah (berlaku untuk Inventory & Reclassification)
6. **CSV Injection Prevention**: `Reclassification.tsx` punya `sanitizeCsvField()` — field yang diawali `=`, `+`, `-`, `@`, tab, atau CR di-prefix `'` sebelum di-export agar tidak dieksekusi sebagai formula oleh Excel/Sheets. Helper ini lokal per file, belum diekstrak jadi util bersama; `Inventory.tsx` export CSV **belum** memakainya.
7. **Cost Formatting**: Input cost di-format dengan Intl.NumberFormat (comma separators)
8. **Chunked/Batched Supabase calls**: fetch assets/reclassifications per 1000 rows, delete multiple per batch 100 — untuk hindari limit Supabase
9. **Activity logging**: setiap mutasi data penting (add/edit/delete asset, maintenance, reclassification, import CSV, generate/export report) memanggil `logActivity()`. CSV bulk import memakai `skipLog=true` pada tiap row lalu satu `logActivity()` agregat di akhir, supaya `activity_logs` tidak banjir per baris.
10. **PDF/Excel export**: pola di `Reports.tsx` — capture chart via `html2canvas` (ref ke container), gabung dengan tabel `jspdf-autotable` (custom `didParseCell` untuk conditional styling seperti highlight over-budget), lalu `xlsx` untuk sheet mentah. Semua field string di-`sanitizeForSpreadsheet()` dulu untuk cegah formula injection sebelum ditulis ke PDF/Excel.
11. **"Last updated" tracking**: `AssetContext` menyimpan `lastFetchedAt` (Date), di-set ulang di initial fetch dan tiap CRUD sukses; dipakai `Dashboard.tsx` via `formatLastUpdate()` (`src/lib/utils.ts`) untuk menampilkan timestamp format Indonesia ("Hari, tanggal Bulan tahun · HH:mm").

## Environment Variables

Frontend (`.env`, harus prefix `VITE_` karena Vite bukan Next.js — jangan pakai `process.env` langsung, pakai `import.meta.env`):
```
VITE_SUPABASE_URL          # Supabase project URL
VITE_SUPABASE_ANON_KEY     # Supabase anon/publishable key
VITE_AI_SERVER_URL         # Base URL server AI Assistant (server/), tanpa trailing /chat
```

Server (`server/index.js`, standard Node `process.env`, env vars TANPA prefix `VITE_`):
```
SUPABASE_URL
SUPABASE_ANON_KEY
MIMO_API_KEY
MIMO_BASE_URL              # default hardcoded: https://token-plan-sgp.xiaomimimo.com/anthropic
MIMO_MODEL
PORT                       # default 8080
```

`.env.example` di root masih berisi `GEMINI_API_KEY`/`APP_URL` (sisa template AI Studio) — **tidak dipakai** oleh kode saat ini, jangan dijadikan acuan.

## Known Issues / Cleanup Candidates

- `src/utils/supabase/client.ts` adalah duplikat client Supabase yang **tidak dipakai** di mana pun — dan pakai nama env var yang salah (`VITE_SUPABASE_PUBLISHABLE_KEY` alih-alih `VITE_SUPABASE_ANON_KEY`). Aman dihapus.
- `claudememo.md` masih mendeskripsikan state sebelum migrasi Supabase (login access code, data in-memory) — sudah tidak akurat, jangan dijadikan acuan.
- `.env.example` tidak sinkron dengan env var yang benar-benar dipakai kode (lihat bagian Environment Variables di atas).
- `Settings.tsx` murni UI state (tidak ada backend call) — tombol "Save Changes" hanya simulasi `setTimeout`.
- **UI label vs field/kolom DB tidak sinkron (disengaja)**: per 2026-08-13, label yang ditampilkan user diganti dari "Category Segment 1"/"Category Segment 2" (dan varian "Asset Category Segment 1/2") jadi **"Asset Class"**/**"Location"** di semua halaman (Inventory, Dashboard, Maintenance, MasterData, Add/EditAssetModal). Ini murni perubahan teks tampilan — field TypeScript (`categorySegment1/2`, `assetCategorySegment1/2`) dan kolom/tabel Supabase (`category_segment1/2`, `category_segments_1/2`) **tidak diubah**, supaya tidak perlu migration. Jangan asumsikan nama field mengikuti label UI saat membaca/mengubah kode.

## Improvement Roadmap

Lihat `asset inventory improve.md` untuk rencana peningkatan (status: pagination/debounce/memoization sudah selesai; audit trail via activity log sudah ada lengkap dengan retention policy 3 bulan via `pg_cron`; fitur reklasifikasi aset sudah selesai; fitur Reports — riwayat tersimpan di database, export PDF/Excel, chart image + detail table + sign-off block di PDF — sudah selesai, lihat `reports implementation.md`). Sisa yang belum dikerjakan:
- Advanced filtering & multi-sorting (multi-kriteria + sort per kolom)
- Bulk actions selain delete (bulk update status, bulk export)
- Image upload untuk aset
- Form validation (react-hook-form + zod)
- RBAC (Role-Based Access Control)
- Component refactoring (AssetTable, AssetFilters, dll — Inventory.tsx sudah cukup besar)
- Unit testing

## Conventions

- Bahasa UI campuran Indonesia dan Inggris
- Semua komponen menggunakan functional components + hooks
- Tidak ada comments dalam kode (kecuali license header di `App.tsx`)
- Export default untuk semua komponen halaman
- Hook pattern: `useAsset()`, `useMaintenance()`, `useReclassification()`, `useAuth()`, `useActivityLog()`, `useSystemAlerts()`
