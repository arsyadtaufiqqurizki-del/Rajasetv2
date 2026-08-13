# Inventory Filter System

## Overview

Upgrade sistem filter di halaman **Asset Inventory** (`src/pages/Inventory.tsx`). Sebelumnya filter hanya search text + 3 dropdown single-select (Subsidiary, Asset Class, Status) tanpa persistence. Sekarang:

1. **Filter dimensi baru** — Location (`categorySegment2`), Date Place in Service (range), Asset Cost (range)
2. **Multi-select** pada Subsidiary, Asset Class, Location, Status (sebelumnya cuma bisa pilih 1 nilai)
3. **Active filter chips** — tiap nilai filter yang aktif muncul sebagai chip yang bisa dihapus satu-satu, plus badge jumlah filter aktif di label "Filters"
4. **URL persistence** — semua filter tersimpan sebagai query params di URL (`/inventory?subsidiary=EHK&status=Active&costMin=10000`), sehingga reload-safe dan bisa di-share sebagai link

Listed (Yes/No) sengaja belum dimasukkan.

---

## File yang Terlibat

```
src/components/MultiSelectDropdown.tsx   ← komponen baru
src/pages/Inventory.tsx                  ← state, filtering logic, URL sync, UI filter bar
```

Tidak ada perubahan database/schema — semua field yang dipakai (`categorySegment2`, `assetCost`, `datePlaceInService`) sudah ada di `AssetContext.tsx`, termasuk `categories2` (list Location) yang ternyata sudah di-expose context tapi belum dipakai di UI.

---

## Alur Kerja

### 1. State filter

Setiap filter jadi `useState`, filter dropdown berubah dari `string` jadi `string[]`:

```ts
const [filterSubsidiary, setFilterSubsidiary] = useState<string[]>(...);
const [filterCategory, setFilterCategory] = useState<string[]>(...);   // Asset Class
const [filterLocation, setFilterLocation] = useState<string[]>(...);   // BARU
const [filterStatus, setFilterStatus] = useState<string[]>(...);
const [dateFrom, setDateFrom] = useState("");
const [dateTo, setDateTo] = useState("");
const [costMin, setCostMin] = useState("");
const [costMax, setCostMax] = useState("");
```

Nilai awal setiap state **tidak** langsung `""`/`[]`, tapi dibaca dulu dari URL lewat lazy initializer (`useState(() => ...)`) — supaya begitu halaman dibuka dengan query param, filter langsung ke-restore tanpa flicker "unfiltered" dulu.

### 2. Komponen `MultiSelectDropdown`

Dropdown custom (tidak ada library combobox terpasang di project, jadi dibuat dari nol mengikuti pattern `AutocompleteInput.tsx` yang sudah ada — ref + `mousedown` listener untuk click-outside-to-close).

```
[ All Subsidiaries ▾ ]     ← belum ada yang dipilih
[ EHK ▾ ]                  ← 1 dipilih, tampilkan namanya langsung
[ 2 selected ▾ ]           ← >1 dipilih
```

Klik toggle checkbox per opsi via `onChange(values: string[])`. Dipakai 4 kali (Subsidiary, Asset Class, Location, Status) dengan `options` yang berasal dari context (`subsidiaries`, `categories1`, `categories2`) atau `useMemo` lokal (`uniqueStatuses`, karena tidak ada context-level list untuk status).

### 3. Filtering logic (`filteredAssets` useMemo)

Semua kondisi filter di-AND-kan, tapi di dalam satu filter (misal Subsidiary) nilai-nilainya di-OR-kan pakai `.includes()`:

```ts
const matchSubsidiary = filterSubsidiary.length === 0 || filterSubsidiary.includes(asset.subsidiary);
// ...sama untuk Category, Location, Status

const matchDateFrom = dateFrom === "" || asset.datePlaceInService >= dateFrom;
const matchDateTo   = dateTo === "" || asset.datePlaceInService <= dateTo;
// datePlaceInService disimpan sebagai string "YYYY-MM-DD" (native <input type="date">),
// jadi perbandingan string ISO langsung valid tanpa perlu parsing Date.

const cost = parseFloat(asset.assetCost.replace(/[^0-9.-]+/g, "")) || 0;
const matchCostMin = costMin === "" || cost >= parseFloat(costMin);
const matchCostMax = costMax === "" || cost <= parseFloat(costMax);
// assetCost disimpan sebagai string dengan koma ribuan (mis. "1,152,379.00"),
// regex strip semua karakter non-digit/non-dot/non-minus — pattern yang sama
// dengan yang sudah dipakai di Dashboard.tsx & Reports.tsx untuk hal serupa.
```

### 4. Sinkronisasi ke URL (`useSearchParams`)

Satu `useEffect` yang jalan tiap kali salah satu filter berubah, menulis ulang seluruh query string:

```ts
useEffect(() => {
  const params = new URLSearchParams();
  if (filterSubsidiary.length > 0) params.set('subsidiary', filterSubsidiary.join(','));
  // ...
  if (debouncedSearchQuery) params.set('q', debouncedSearchQuery);
  setSearchParams(params, { replace: true });
}, [filterSubsidiary, filterCategory, filterLocation, filterStatus, dateFrom, dateTo, costMin, costMax, debouncedSearchQuery, setSearchParams]);
```

Catatan penting:
- Pakai `debouncedSearchQuery` (bukan `searchQuery` mentah) supaya URL **tidak** update tiap ketikan huruf, cuma setelah user berhenti mengetik 300ms.
- `{ replace: true }` supaya browser history tidak penuh entry baru tiap kali filter berubah — back/forward tetap wajar dipakai untuk pindah halaman lain.
- Nilai multi-select di-encode comma-joined (`?subsidiary=EHK,KMJ`), bukan repeated key — cukup untuk kasus ini karena nilai (nama subsidiary/kategori) tidak mengandung koma.

### 5. Active filter chips + badge

`activeFilters` (`useMemo`) membangun array chip dari semua filter yang sedang aktif — granular per nilai untuk multi-select, satu chip gabungan untuk date-range dan cost-range:

```ts
const activeFilters = [
  ...filterSubsidiary.map(v => ({ label: `Subsidiary: ${v}`, onRemove: () => ... })),
  ...filterCategory.map(...),
  ...filterLocation.map(...),
  ...filterStatus.map(...),
  ...(dateFrom || dateTo ? [{ label: `Date: ${dateFrom} → ${dateTo}`, onRemove: () => ... }] : []),
  ...(costMin || costMax ? [{ label: `Cost: ${costMin} - ${costMax}`, onRemove: () => ... }] : []),
  ...(debouncedSearchQuery ? [{ label: `Search: "..."`, onRemove: () => ... }] : []),
];
```

`activeFilters.length` dipakai untuk badge angka di sebelah label "FILTERS". Tiap chip render dengan tombol `×` yang manggil `onRemove` masing-masing — jadi user bisa hapus 1 filter tanpa reset semuanya.

`Clear Filters` tetap ada, reset semua state (array jadi `[]`, string jadi `""`) sekaligus — otomatis membersihkan URL juga karena efek sync di atas.

---

## Diagram Alur

```
User pilih/ubah filter (dropdown, date, cost, search)
        │
        ▼
  React state berubah (misal filterSubsidiary: ["EHK"])
        │
        ├──► filteredAssets (useMemo) re-hitung  →  tabel ter-update
        │
        ├──► activeFilters (useMemo) re-hitung   →  chip + badge ter-update
        │
        ├──► currentPage reset ke 1 (useEffect)
        │
        └──► useEffect sync ke URL               →  /inventory?subsidiary=EHK

Reload halaman / buka link dengan query param
        │
        ▼
  useState lazy initializer baca searchParams saat mount
        │
        ▼
  Filter langsung ter-restore (tabel, chip, badge semua sesuai URL)
```

---

## Yang Sudah Diverifikasi

- `npx tsc --noEmit` — tidak ada error TypeScript baru dari perubahan ini (error yang muncul di project sudah ada sebelumnya, tidak terkait `Inventory.tsx`/`MultiSelectDropdown.tsx`).
- Dites langsung di browser (dev server, login manual oleh user):
  - Pilih beberapa Subsidiary sekaligus (multi-select) → URL & tabel ter-update, chip muncul per nilai
  - Isi cost range (min 50000) → tabel ter-filter benar (semua baris ≥ $50,000), chip "Cost: 50000 - ∞" muncul
  - Hapus 1 chip → filter itu saja yang hilang, URL & tabel ikut update
  - Buka `/inventory?subsidiary=EHK,KMJ&status=Active&costMin=10000` langsung (deep link) → filter, chip (4 chip), dan badge ("4") ter-restore otomatis dari URL
  - Klik "Clear Filters" → semua filter & query param bersih

---

## Catatan / Batasan

- Nilai multi-select di URL comma-joined — kalau suatu saat ada nama subsidiary/kategori yang mengandung koma, encoding ini akan salah parse. Risikonya rendah karena nilai-nilai ini enum-like pendek, tapi kalau jadi masalah, ganti ke repeated query key (`?subsidiary=EHK&subsidiary=KMJ`).
- Nomor halaman (`currentPage`) **tidak** disinkronkan ke URL — tiap filter berubah, halaman selalu reset ke 1. Ini konsisten dengan behavior lama, di luar scope upgrade ini.
- Filter Location pakai list `categories2` dari context (bukan hasil `useMemo` dari data asset), jadi opsi yang muncul di dropdown mengikuti master data Location yang terdaftar, bukan cuma nilai yang sedang dipakai di tabel.
