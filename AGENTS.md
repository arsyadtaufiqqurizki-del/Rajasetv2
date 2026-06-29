# AGENTS.md - Raja Project Dashboard (Asset Inventory System)

## Project Overview

Aplikasi web React untuk manajemen aset perusahaan "Perusahaan Raja". Sistem ini mengelola inventaris aset, pelacakan pemeliharaan (maintenance), dan pelaporan secara client-side menggunakan in-memory state management.

## Tech Stack

- **Framework**: React 19 + TypeScript
- **Build Tool**: Vite 6
- **Routing**: React Router DOM v7
- **Styling**: Tailwind CSS v4 + `clsx` + `tailwind-merge`
- **Icons**: lucide-react
- **Animation**: motion (framer-motion)
- **Charts**: recharts
- **CSV**: papaparse
- **Date**: date-fns
- **AI**: @google/genai (Gemini API, optional)

## Commands

```bash
npm run dev        # Start dev server on port 3000
npm run build      # Production build
npm run preview    # Preview production build
npm run lint       # TypeScript type-check (tsc --noEmit)
npm run clean      # Remove dist/ and server.js
```

## Project Structure

```
.
├── index.html                    # Entry HTML
├── package.json
├── tsconfig.json
├── vite.config.ts                # Vite config with @ path alias
├── metadata.json                 # AI Studio metadata
├── .env.example                  # Environment variables template
├── src/
│   ├── main.tsx                  # React entry point
│   ├── App.tsx                   # Root component with routing
│   ├── index.css                 # Tailwind + custom theme
│   ├── lib/
│   │   └── utils.ts              # cn() utility (clsx + twMerge)
│   ├── contexts/
│   │   ├── AuthContext.tsx        # Authentication state (code: 123456)
│   │   ├── AssetContext.tsx       # Asset CRUD + master data
│   │   └── MaintenanceContext.tsx # Maintenance CRUD
│   ├── components/
│   │   ├── Layout.tsx            # Sidebar + header + outlet
│   │   ├── AutocompleteInput.tsx # Reusable autocomplete input
│   │   ├── AddAssetModal.tsx     # Add asset form modal
│   │   ├── EditAssetModal.tsx    # Edit asset form modal
│   │   ├── AddMaintenanceModal.tsx
│   │   └── EditMaintenanceModal.tsx
│   └── pages/
│       ├── Login.tsx             # Login page (access code)
│       ├── Dashboard.tsx         # Overview with charts & KPIs
│       ├── Inventory.tsx         # Asset table with CRUD, filter, CSV
│       ├── Maintenance.tsx       # Maintenance records & schedule
│       ├── MasterData.tsx        # Manage subsidiaries & categories
│       ├── Reports.tsx           # Report generation & preview
│       ├── AIAssistant.tsx       # Chat UI (simulated AI)
│       ├── Guide.tsx             # FAQ / user guide
│       └── Settings.tsx          # Profile, config, notifications, security
```

## Architecture

### State Management (In-Memory, Client-Side)

Semua data disimpan di React Context (tidak ada backend/database). Data hilang saat page refresh.

**AuthContext** (`src/contexts/AuthContext.tsx`)
- `isAuthenticated`: boolean
- `login(code)`: validasi kode akses (hardcode: `"123456"`)
- `logout()`

**AssetContext** (`src/contexts/AssetContext.tsx`)
- `assets`: Asset[] — data aset utama
- `subsidiaries`, `categories1`, `categories2`: string[] — master data referensi
- CRUD: `addAsset`, `updateAsset`, `deleteAsset`, `deleteMultipleAssets`
- Master data: `addSubsidiary`, `deleteSubsidiary`, `addCategory1`, `deleteCategory1`, `addCategory2`, `deleteCategory2`
- Modal state: `isAddModalOpen`, `isEditModalOpen`, `editingAsset`
- Auto-upsert: saat tambah/edit aset, subsidiary & categories otomatis ditambahkan ke master data jika belum ada
- `statusLevel` dikomputasi dari `status`: `active` → success, `maintenance` → warning, `broken`/`service` → error

**MaintenanceContext** (`src/contexts/MaintenanceContext.tsx`)
- `records`: MaintenanceRecord[]
- CRUD: `addRecord`, `updateRecord`, `deleteRecord`

### Data Schemas

**Asset**:
| Field | Type | Description |
|---|---|---|
| id | string | Auto-generated (random alphanumeric) |
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
| lifeInMonths | string | Umur ekonomis (bulan) |
| listed | string | Status listing (Audited/Non-Listed) |
| status | string | Active/In Maintenance/Needs Service/Broken/Retired |
| statusLevel | 'success'\|'warning'\|'error'\|'default' | Badge color (computed) |

**MaintenanceRecord**:
| Field | Type |
|---|---|
| id | string |
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

Semua halaman dilindungi oleh `PrivateRoute` (kecuali `/login`). Redirect ke `/login` jika tidak terotentikasi.

| Route | Page | Description |
|---|---|---|
| `/login` | Login | Access code login |
| `/` | Dashboard | KPI cards, charts, recent assets table |
| `/inventory` | Inventory | Full asset CRUD, CSV import/export, filters |
| `/maintenance` | Maintenance | Maintenance CRUD, schedule, filters |
| `/master-data` | MasterData | Manage subsidiaries & categories |
| `/reports` | Reports | Report generation with charts |
| `/ai-assistant` | AIAssistant | Chat UI (simulated) |
| `/guide` | Guide | FAQ accordion |
| `/settings` | Settings | Profile, config, notifications, security |

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
5. **CSV Import/Export**: Menggunakan papaparse, max 5000 rows per import
6. **Cost Formatting**: Input cost di-format dengan Intl.NumberFormat (comma separators)
7. **ID Generation**: `Math.random().toString(36).substring(2, 9).toUpperCase()`

## Environment Variables

```
GEMINI_API_KEY  # Untuk AI features (optional)
APP_URL         # URL hosting (auto-injected by AI Studio)
```

## Improvement Roadmap

Lihat `asset inventory improve.md` untuk rencana peningkatan:
- Advanced filtering & multi-sorting
- Bulk actions (update status, export)
- Image upload untuk aset
- Form validation (react-hook-form + zod)
- Audit trail
- RBAC (Role-Based Access Control)
- Component refactoring (AssetTable, AssetFilters, etc.)
- Unit testing

## Conventions

- Bahasa UI campuran Indonesia dan Inggris
- Semua komponen menggunakan functional components + hooks
- Tidak ada comments dalam kode (kecuali license header)
- Export default untuk semua komponen halaman
- Hook pattern: `useAsset()`, `useMaintenance()`, `useAuth()`
