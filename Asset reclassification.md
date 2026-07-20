# Asset Reclassification

## Overview

Fitur audit fisik aset (stock opname) yang **independen** dari tabel `assets` yang sudah ada — tidak pakai foreign key ke `assets.id`. Tujuannya: mencatat temuan fisik apa adanya (termasuk barang yang belum terdaftar di sistem), lalu mengklasifikasikan tiap temuan sebagai Aset / Perlu Ditinjau / Inventaris / kategori custom, dan menandai status verifikasinya.

Keputusan desain: dibuat terpisah (bukan extend tabel `assets`) karena saat audit fisik banyak temuan yang belum tentu ada di sistem — memaksa link ke `assets.id` menyulitkan pencatatan barang yang belum terdaftar. Konsekuensinya, rekonsiliasi antara hasil audit vs data aset utama dilakukan manual (laporan terpisah), bukan otomatis lewat relasi database.

---

## Database

### Tabel: `asset_reclassifications`

```sql
CREATE TABLE asset_reclassifications (
  id                 UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  asset_category     TEXT,              -- kategori aset (mis. Elektronik, Furniture) - free text
  asset_description  TEXT NOT NULL,     -- deskripsi item yang ditemukan
  location           TEXT,              -- lokasi fisik saat ditemukan
  unit               NUMERIC,           -- jumlah unit
  ownership          TEXT,              -- milik entitas/departemen mana
  category           TEXT NOT NULL DEFAULT 'Needs Review',
                                         -- hasil klasifikasi: 'Asset' | 'Needs Review' | 'Inventory' | custom
  verified           BOOLEAN NOT NULL DEFAULT false,
  verification_date  TIMESTAMPTZ,       -- diisi saat verified = true
  verified_by        TEXT,              -- nama user yang memverifikasi
  created_by         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_reclass_category ON asset_reclassifications(category);
CREATE INDEX idx_reclass_verified ON asset_reclassifications(verified);
CREATE INDEX idx_reclass_created_at ON asset_reclassifications(created_at DESC);
```

**RLS**: semua authenticated user bisa `SELECT` dan `INSERT`; `UPDATE`/`DELETE` sebaiknya dibatasi (mis. hanya `created_by` sendiri atau role admin) — sama pola dengan tabel `activity_logs`.

---

## Field Detail

| Field | Tipe UI | Catatan |
|---|---|---|
| Asset category | Autocomplete free-text | Sama pola dengan `categorySegment1/2` di `AddAssetModal.tsx` — bisa reuse `AutocompleteInput` |
| Asset description | Text input, required | — |
| Location | Text input | Field baru, belum ada di sistem manapun sekarang |
| Unit | Number input | — |
| Ownership | Text input / autocomplete | Bisa reuse pola `subsidiary` autocomplete kalau ownership = entitas perusahaan |
| Category (klasifikasi) | Dropdown: `Asset`, `Needs Review`, `Inventory`, + opsi custom (input manual) | Ini field inti — hasil audit |
| Verified/Unverified | Toggle/badge, read-only di form utama | Diubah lewat modal verifikasi terpisah |
| Verification date | Auto-terisi saat status diubah jadi Verified | Read-only, di-set oleh sistem |

---

## Arsitektur Komponen

Mengikuti pola yang sudah ada di project (Context + Modal + Page), lihat `AssetContext.tsx` / `AddAssetModal.tsx` / `Inventory.tsx` sebagai referensi.

```
src/contexts/ReclassificationContext.tsx   ← CRUD, fetch, lookup kategori
src/components/AddReclassificationModal.tsx
src/components/EditReclassificationModal.tsx
src/components/VerifyReclassificationModal.tsx   ← khusus tandai verified + verification_date
src/pages/Reclassification.tsx             ← tabel + filter + KPI cards
```

Routing & navigasi: tambah menu baru di sidebar (`Layout.tsx` / komponen nav yang ada) + route baru di `App.tsx`.

### UI Halaman (mockup kasar)

```
┌───────────────────────────────────────────────────────────┐
│  Asset Reclassification                    [+ Tambah Item] │
├───────────────────────────────────────────────────────────┤
│  [Total: 128]  [Verified: 90]  [Unverified: 38]  [Needs   │
│                                 Review: 12]                │
├───────────────────────────────────────────────────────────┤
│  Filter: [Category ▾] [Status Verifikasi ▾] [Ownership ▾] │
│          [Search deskripsi...]                             │
├───────────────────────────────────────────────────────────┤
│  Description   | Category | Location | Ownership | Status │
│  Kompresor GA-30 | Asset  | Gudang A | Div. Ops  | ✅ 12/07│
│  Meja kantor lama| Inventory | Lt.2  | Div. HR   | ⚠️ -    │
│  Barang tak dikenal| Needs Review | Gudang B | -  | ⚠️ -   │
└───────────────────────────────────────────────────────────┘
```

Klik baris → buka `VerifyReclassificationModal` untuk ubah status verifikasi + isi tanggal.

---

## Rencana Implementasi (Bertahap)

### Fase 1 — Database & Context (fondasi) ✅
- [x] Buat migration `supabase/migrations/20260720000000_create_asset_reclassifications.sql`
- [x] Buat tabel `asset_reclassifications` + index + RLS policy
- [x] Buat `src/contexts/ReclassificationContext.tsx` (fetch, add, update, delete, verify)
- [x] Tambah action type baru (`ADD/UPDATE/DELETE/VERIFY_RECLASSIFICATION`) & entity type `reclassification` di `src/lib/activityLogger.ts`
- [x] Daftarkan `ReclassificationProvider` di `App.tsx`

### Fase 2 — UI Komponen ✅
- [x] Buat `src/pages/Reclassification.tsx` (tabel data + KPI cards + filter)
- [x] Buat `AddReclassificationModal.tsx`
- [x] Buat `EditReclassificationModal.tsx`
- [x] Buat `VerifyReclassificationModal.tsx` (toggle verified + set verification_date otomatis)
- [x] Tambah menu sidebar (`Layout.tsx`) + route baru (`App.tsx`, path `/reclassification`)

### Fase 3 — Filter & KPI ✅ (dikerjakan sekaligus di Fase 2)
- [x] KPI cards: Total item, Verified, Unverified, Needs Review
- [x] Filter by category, status verifikasi, ownership
- [x] Search by description & location

### Fase 4 — Integrasi Activity Log
- [ ] Log `ADD_RECLASSIFICATION`, `VERIFY_RECLASSIFICATION`, `UPDATE_RECLASSIFICATION`, `DELETE_RECLASSIFICATION` ke tabel `activity_logs` yang sudah ada (reuse `src/lib/activityLogger.ts`, `entityType: 'reclassification'`)

### Fase 5 — Export & Import CSV ✅
- [x] Buat `public/reclassification_import_template.csv`
- [x] Implementasi `handleExportCSV` + tombol Export CSV
- [x] Implementasi `handleImportCSV` + progress modal + `handleDownloadInvalidRows`
- [ ] Tes manual: export data yang ada → edit CSV → import lagi (belum diverifikasi langsung di browser oleh pembuat perubahan ini — silakan tes manual sebelum dipakai produksi)

Ikuti pola yang sudah ada persis di `src/pages/Inventory.tsx` (`handleExportCSV`, `handleImportCSV`, `handleDownloadInvalidRows`) — pakai library yang sama (`papaparse`, sudah jadi dependency project, tidak perlu install lagi).

#### 5.1 Export CSV
- Tambah `handleExportCSV` di `src/pages/Reclassification.tsx`:
  - Sumber data: `filteredItems` (hasil filter+search yang sedang aktif), bukan seluruh `reclassifications` — supaya user bisa export subset (mis. hanya yang "Needs Review").
  - Mapping kolom (urutan sama dengan tabel & field detail di dokumen ini):
    ```
    'Asset Category'    ← assetCategory
    'Asset Description' ← assetDescription
    'Location'          ← location
    'Unit'              ← unit
    'Ownership'         ← ownership
    'Category'          ← category
    'Verified'          ← verified ? 'Yes' : 'No'
    'Verification Date' ← verificationDate
    'Verified By'       ← verifiedBy
    ```
  - `Papa.unparse(dataToExport)` → `Blob` → download sebagai `Asset_Reclassification_${tanggal}.csv`, identik dengan pola di Inventory.
  - Tombol "Export CSV" (icon `Download` dari lucide-react) diletakkan di header halaman, sebelah tombol "+ Tambah Item" yang sudah ada.

#### 5.2 Import CSV
- Tambah `fileInputRef`, `handleImportCSV`, dan state `importModal` (struktur identik dengan Inventory: `isOpen`, `status`, `total`, `processed`, `successCount`, `failedCount`, `skippedCount`, `invalidRows`).
- Validasi wajib per baris (baris invalid masuk `invalidRows`, tidak di-insert):
  - `Asset Description` — wajib diisi (field `NOT NULL` di DB).
  - `Category` — kalau kosong, default ke `'Needs Review'` (bukan error, karena kolom punya `DEFAULT` di DB).
- Limit baris per file: samakan dengan Inventory (5000 baris) supaya konsisten dan menghindari timeout batch insert.
- Proses insert: batch `BATCH_SIZE = 10` paralel per batch, panggil `addReclassification()` dari `ReclassificationContext` untuk tiap baris (bukan raw `supabase.insert`, supaya activity log & state lokal ikut ter-update otomatis lewat context yang sudah ada).
- Mapping kolom CSV → `ReclassificationInput` (terima juga variasi nama kolom camelCase untuk kompatibilitas, sama seperti Inventory):
  ```
  assetCategory:    row['Asset Category'] || row['assetCategory'] || ''
  assetDescription: row['Asset Description'] || row['assetDescription']   // required
  location:         row['Location'] || row['location'] || ''
  unit:             row['Unit'] || row['unit'] || ''
  ownership:        row['Ownership'] || row['ownership'] || ''
  category:         row['Category'] || row['category'] || 'Needs Review'
  ```
  Catatan: `verified`, `verificationDate`, `verifiedBy` **tidak** di-import lewat CSV — status verifikasi tetap harus lewat `VerifyReclassificationModal` di aplikasi, supaya "siapa yang verifikasi" akurat (bukan diklaim lewat file upload).
- Progress modal reuse pola Inventory: tampilkan total/processed/success/failed secara live selama batch berjalan, lalu status `done` di akhir dengan tombol download `invalid_rows.csv` kalau ada baris gagal.
- `logActivity({ actionType: 'IMPORT_CSV', entityType: 'reclassification', details: { total, success, failed } })` di akhir proses (tambah action type baru `IMPORT_CSV` untuk entity `reclassification` kalau belum general di `activityLogger.ts` — cek dulu, karena `IMPORT_CSV` untuk `entityType: 'asset'` sudah ada, mungkin bisa dibuat generic).

#### 5.3 Template CSV
- Buat `public/reclassification_import_template.csv` (pola sama dengan `public/asset_import_template.csv` yang sudah ada) berisi header kolom + 1 baris contoh:
  ```csv
  Asset Category,Asset Description,Location,Unit,Ownership,Category
  Elektronik,Kompresor GA-30,Gudang A,1,Div. Ops,Asset
  ```
- Tombol "Download Template" (icon `FileDown`) di header halaman, link statis `href="/reclassification_import_template.csv"`.

#### 5.4 File yang disentuh
- `src/pages/Reclassification.tsx` — tambah `handleExportCSV`, `handleImportCSV`, `handleDownloadInvalidRows`, `importModal` state, `fileInputRef`, 3 tombol baru di header (Import/Template/Export), + progress modal (copy struktur dari `Inventory.tsx` baris ~488 ke bawah).
- `src/contexts/ReclassificationContext.tsx` — tidak perlu diubah, `addReclassification` yang sudah ada langsung dipakai untuk tiap baris import.
- `src/lib/activityLogger.ts` — cek/tambah action type `IMPORT_CSV` untuk `entityType: 'reclassification'`.
- `public/reclassification_import_template.csv` — file baru.

#### 5.5 Urutan pengerjaan
1. Buat file template CSV di `public/`.
2. Implementasi `handleExportCSV` + tombol Export (paling sederhana, tidak ada validasi, bisa langsung diverifikasi manual di browser).
3. Implementasi `handleImportCSV` + progress modal + `handleDownloadInvalidRows`, reuse `addReclassification` dari context.
4. Tes manual: export data yang ada → edit CSV → import lagi → cek data baru muncul & baris invalid ter-skip dengan benar.
5. Update checklist Fase 5 di dokumen ini jadi ✅ setelah selesai & diverifikasi.

---

## Catatan

- **Independen dari `assets`**: tidak ada FK ke `assets.id` — sesuai keputusan di awal diskusi. Kalau nanti dibutuhkan rekonsiliasi otomatis (mis. tandai aset di tabel `assets` sebagai "sudah diverifikasi"), perlu fitur tambahan terpisah, bukan bagian dari desain awal ini.
- **Category dropdown custom**: opsi "custom nama" berarti field `category` tetap `TEXT` (bukan enum Postgres) supaya user bisa input nilai baru selain 3 preset (`Asset`, `Needs Review`, `Inventory`) — sama pola dengan `categorySegment1/2` yang free-text dengan autocomplete.
- **Verification date**: sebaiknya di-set otomatis oleh sistem (`NOW()`) saat toggle verified diaktifkan, bukan diinput manual, supaya akurat sebagai jejak audit.
