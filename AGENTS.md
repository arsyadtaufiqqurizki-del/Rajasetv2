# AGENTS.md - Raja Project Dashboard (Asset Inventory System)

## Project Overview

Aplikasi web React untuk manajemen aset perusahaan "Perusahaan Raja". Sistem ini mengelola inventaris aset, pelacakan pemeliharaan (maintenance), pelaporan, dan activity log — semua data persisten di **Supabase** (Postgres + Auth + Realtime). Ada juga AI Assistant yang terhubung ke server chat terpisah (`server/`).

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
│   │   ├── AssetContext.tsx       # Asset CRUD (Supabase `assets` table) + master data
│   │   └── MaintenanceContext.tsx # Maintenance CRUD (Supabase `maintenance_records` table)
│   ├── components/
│   │   ├── Layout.tsx            # Sidebar + header + outlet
│   │   ├── NotificationBell.tsx  # Bell icon, activity feed + system alerts panel
│   │   ├── AutocompleteInput.tsx # Reusable autocomplete input
│   │   ├── AddAssetModal.tsx     # Add asset form modal
│   │   ├── EditAssetModal.tsx    # Edit asset form modal
│   │   ├── AddMaintenanceModal.tsx
│   │   └── EditMaintenanceModal.tsx
│   └── pages/
│       ├── Login.tsx             # Login page (Supabase email/password)
│       ├── Dashboard.tsx         # Overview with charts & KPIs
│       ├── Inventory.tsx         # Asset table with CRUD, filter, CSV import/export
│       ├── Maintenance.tsx       # Maintenance records & schedule
│       ├── MasterData.tsx        # Manage subsidiaries & categories
│       ├── Reports.tsx           # Report generation & preview
│       ├── AIAssistant.tsx       # Chat UI, calls server/ backend for real LLM answers
│       ├── Guide.tsx             # FAQ / user guide
│       └── Settings.tsx          # Profile, config, notifications, security (UI-only, not persisted)
├── server/                       # Standalone Node HTTP server for AI Assistant
│   ├── index.js                  # POST /chat — fetches assets+maintenance from Supabase, calls LLM
│   └── Dockerfile
└── supabase/migrations/          # SQL migrations (activity_logs, notification_reads, RLS policies)
```

## Architecture

### State Management (Supabase-backed)

Semua data utama (assets, maintenance_records, subsidiaries, categories, activity_logs, notification_reads) disimpan di **Supabase Postgres**, diakses lewat React Context yang fetch on-mount dan menulis langsung ke Supabase. Data persisten antar sesi/refresh.

**AuthContext** (`src/contexts/AuthContext.tsx`)
- `isAuthenticated`, `loading`: boolean, dari `supabase.auth.getSession()` + `onAuthStateChange`
- `login(email, password)`: `supabase.auth.signInWithPassword`
- `logout()`: `supabase.auth.signOut`

**AssetContext** (`src/contexts/AssetContext.tsx`)
- `assets`: Asset[] — fetched dari tabel `assets` (chunked fetch, 1000 rows/page, untuk lewati limit default Supabase)
- `subsidiaries`, `categories1`, `categories2`: string[] — dari tabel `subsidiaries`, `category_segments_1`, `category_segments_2`
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

### Activity Log & Notifications

Sistem notifikasi bell (`NotificationBell.tsx`) menggabungkan dua sumber:
1. **Activity log** (`useActivityLog.ts`) — 20 log terbaru dari tabel `activity_logs`, live update via Supabase Realtime (`postgres_changes` INSERT). Unread count dihitung dari `notification_reads.last_read_at` per user.
2. **System alerts** (`useSystemAlerts.ts`) — dihitung on-demand saat panel dibuka: maintenance overdue (status = 'Overdue') dan aset rusak (>10% dari total).

`logActivity()` (`src/lib/activityLogger.ts`) dipanggil dari context CRUD methods dan dari `Inventory.tsx` (untuk `IMPORT_CSV`). Action types: `IMPORT_CSV`, `ADD_ASSET`, `UPDATE_ASSET`, `DELETE_ASSET`, `BULK_DELETE`, `ADD_MAINTENANCE`, `UPDATE_MAINTENANCE`.

RLS: semua authenticated user bisa `SELECT` activity_logs; insert hanya untuk `user_id` sendiri. Lihat `supabase/migrations/20260701000000_create_activity_logs.sql`.

### AI Assistant

`AIAssistant.tsx` bukan simulasi — ia POST ke `${VITE_AI_SERVER_URL}/chat` (server terpisah di `server/index.js`). Server itu fetch data `assets` + `maintenance_records` langsung dari Supabase (pakai `SUPABASE_URL`/`SUPABASE_ANON_KEY` di env server, bukan `VITE_`-prefixed), susun system prompt berisi ringkasan + seluruh data, lalu forward ke endpoint Anthropic-compatible (`MIMO_BASE_URL`, model dari `MIMO_MODEL`, key dari `MIMO_API_KEY`). Chat history & pesan disimpan di `localStorage` browser (bukan Supabase) dengan sliding-window trim (`MAX_MESSAGES = 21`, `MAX_HISTORY = 20`).

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
| categorySegment1 | string | Kategori utama |
| categorySegment2 | string | Kategori turunan |
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
| assetCategorySegment1 | string |
| assetCategorySegment2 | string |
| estimateCost | string |
| actualCost | string |
| status | string (Pending/In Progress/Completed/Overdue) |
| scheduledDate | string |

### Routing

Semua halaman dilindungi oleh `PrivateRoute` (kecuali `/login`). Redirect ke `/login` jika tidak terotentikasi (dicek via `AuthContext`, bukan access code lokal).

| Route | Page | Description |
|---|---|---|
| `/login` | Login | Supabase email/password login |
| `/` | Dashboard | KPI cards, charts, recent assets table |
| `/inventory` | Inventory | Full asset CRUD, CSV import/export, filters |
| `/maintenance` | Maintenance | Maintenance CRUD, schedule, filters |
| `/master-data` | MasterData | Manage subsidiaries & categories |
| `/reports` | Reports | Report generation with charts |
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
3. **Debounce Search**: Inventory dan Maintenance menggunakan debounce 300ms pada pencarian
4. **Pagination**: Client-side pagination (10 items per page) pada Inventory, Maintenance, dan Dashboard
5. **CSV Import/Export**: Menggunakan papaparse, max 5000 rows per import, invalid rows di-skip dan bisa didownload terpisah
6. **Cost Formatting**: Input cost di-format dengan Intl.NumberFormat (comma separators)
7. **Chunked/Batched Supabase calls**: fetch assets per 1000 rows, delete multiple per batch 100 — untuk hindari limit Supabase
8. **Activity logging**: setiap mutasi data penting (add/edit/delete asset & maintenance, import CSV) memanggil `logActivity()`

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

## Improvement Roadmap

Lihat `asset inventory improve.md` untuk rencana peningkatan (status: pagination/debounce/memoization sudah selesai; audit trail dasar sudah ada via activity log). Sisa yang belum dikerjakan:
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
- Hook pattern: `useAsset()`, `useMaintenance()`, `useAuth()`, `useActivityLog()`, `useSystemAlerts()`
