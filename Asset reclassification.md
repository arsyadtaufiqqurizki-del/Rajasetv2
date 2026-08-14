# Asset Reclassification

## Overview

Fitur audit fisik aset (stock opname) yang **selalu tertaut ke tabel `assets`**. Setiap baris reclassification mewakili satu aset dari Asset Inventory yang sedang diaudit: auditor memilih aset yang sudah terdaftar, lalu mengklasifikasikan hasil temuannya sebagai Aset / Perlu Ditinjau / Inventaris / kategori custom, dan menandai status verifikasinya.

**Perubahan arah desain (14 Agustus 2026):** versi awal fitur ini (Juli 2026) sengaja dibuat independen dari `assets` — tanpa FK, murni free-text — supaya barang yang belum terdaftar di sistem tetap bisa dicatat saat audit fisik. Setelah didiskusikan, arah ini diubah: audit sekarang **selalu berbasis aset yang sudah ada di Inventory** (mirip pola `AddMaintenanceModal.tsx` — pilih asset dari dropdown pencarian, bukan input manual). Konsekuensinya, temuan barang yang benar-benar belum terdaftar di sistem **tidak bisa lagi dicatat lewat fitur ini** — itu perlu didaftarkan dulu sebagai Asset di Inventory, baru bisa diaudit di sini.

Baris-baris lama (dibuat sebelum perubahan ini, ~128 item, `asset_id IS NULL`) tetap ada apa adanya dan tetap bisa diedit/dihapus/diverifikasi seperti biasa — hanya jalur pembuatan baris **baru** yang berubah.

---

## Database

### Tabel: `asset_reclassifications`

```sql
CREATE TABLE asset_reclassifications (
  id                 UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  asset_id           UUID REFERENCES assets(id) ON DELETE SET NULL,
                                         -- ditambahkan 14 Agustus 2026; NULL = baris lama/manual
  asset_category     TEXT,              -- fallback untuk baris tanpa asset_id (legacy)
  asset_description  TEXT,              -- nullable (sejak 14 Agustus 2026) — baris linked tidak mengisi ini
  location           TEXT,              -- fallback untuk baris tanpa asset_id (legacy)
  unit               NUMERIC,           -- fallback untuk baris tanpa asset_id (legacy)
  ownership          TEXT,              -- fallback untuk baris tanpa asset_id (legacy)
  category           TEXT NOT NULL DEFAULT 'Needs Review',
                                         -- hasil klasifikasi audit: 'Asset' | 'Needs Review' | 'Inventory' | custom
  remarks            TEXT,              -- catatan audit, selalu milik reclassification (bukan dari asset)
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
CREATE INDEX idx_reclass_asset_id ON asset_reclassifications(asset_id);
```

**Trigger `trg_snapshot_reclassification_before_asset_delete`** (`BEFORE DELETE ON assets`): kalau asset yang tertaut dihapus dari Inventory, nilai `asset_description` / `asset_category` / `location` / `ownership` / `unit` di-snapshot ke kolom lokal reclassification sebelum `asset_id` di-null-kan oleh FK — supaya baris audit tidak jadi kosong, riwayatnya tetap ada meski aset sumbernya sudah dihapus.

**RLS**: semua authenticated user bisa `SELECT`/`UPDATE`/`DELETE`; `INSERT` wajib `created_by = auth.uid()`. Tidak berubah dari desain awal.

Migrations terkait: `20260720000000_create_asset_reclassifications.sql` (awal), `20260814000000_link_reclassifications_to_assets.sql` (tambah `asset_id` + trigger), `20260814010000_relax_reclassification_description_not_null.sql` (drop NOT NULL `asset_description`).

---

## Field Detail

| Field | Sumber (baris linked, `asset_id` terisi) | Sumber (baris legacy, `asset_id` NULL) |
|---|---|---|
| Asset Description | **Live** dari `assets.asset_description` (join) | Kolom lokal, read-only di UI (historis) |
| Asset Category | **Live** dari `assets.category_segment1` | Kolom lokal |
| Location | **Live** dari `assets.category_segment2` | Kolom lokal |
| Ownership | **Live** dari `assets.subsidiary` | Kolom lokal |
| Unit | **Live** dari `assets.asset_units` | Kolom lokal |
| Category (klasifikasi) | Selalu milik reclassification — dropdown `Asset` / `Needs Review` / `Inventory` / custom | sama |
| Remarks | Selalu milik reclassification — textarea bebas | sama |
| Verified / Verification date / Verified by | Selalu milik reclassification, diubah lewat `VerifyReclassificationModal` | sama |

"Live" berarti dibaca lewat Supabase FK-embed (`asset_reclassifications.select('*, linked_asset:assets(...)')`) setiap fetch — bukan disalin sekali saat insert. Kalau deskripsi/kategori/lokasi asset diedit di Inventory, baris reclassification yang tertaut otomatis ikut berubah tanpa perlu sinkron ulang manual.

---

## Arsitektur Komponen

```
src/contexts/ReclassificationContext.tsx   ← CRUD, live-join fetch, sync dari assets
src/components/AddReclassificationModal.tsx   ← pilih asset dari Inventory (bukan form manual)
src/components/EditReclassificationModal.tsx  ← field identitas read-only kalau linked
src/components/VerifyReclassificationModal.tsx   ← toggle verified + set verification_date
src/pages/Reclassification.tsx             ← tabel + filter + KPI cards + Sync from Assets
```

### `ReclassificationContext.tsx` — fungsi kunci

- `fromDb(row)` — kalau `row.asset_id` ada dan join `linked_asset` berhasil, field identitas diambil dari situ; kalau tidak, fallback ke kolom lokal (baris legacy).
- `addLinkedReclassification(assetId, category, remarks)` — satu-satunya jalur pembuatan baris baru. Insert `{ asset_id, category, remarks, created_by }` saja; field identitas tidak pernah ditulis (selalu live via join). **Melempar error** kalau insert gagal (bukan gagal diam-diam) supaya modal bisa menampilkan alert.
- `syncFromAssets(assets, onProgress)` — versi bulk dari atas: link semua asset yang belum punya baris reclassification (dedup lewat `asset_id`), batch 10, default `category: 'Asset'`.
- `updateReclassification(id, data)` — kalau baris `assetId` terisi, hanya `category` dan `remarks` yang di-`UPDATE`; field identitas diabaikan (karena bukan milik reclassification lagi).
- `addReclassification(item, skipLog)` — masih ada untuk kompatibilitas baris legacy (dipanggil hanya lewat proses internal, tidak lagi lewat UI Add manapun sejak CSV import & form manual dihapus).

### UI — `Reclassification.tsx`

- **Tambah Item** → buka `AddReclassificationModal`: dropdown pencarian asset (mirip `AddMaintenanceModal`), asset yang sudah tertaut disaring keluar dari daftar, lalu isi Category + Remarks saja.
- **Sync from Assets** — tombol bulk-link untuk semua asset yang belum tertaut, dengan progress modal.
- Kolom tabel: checkbox, Actions, **Source** (badge "Linked (#assetNumber)" vs "Manual" untuk baris legacy), Asset Description, Asset Category, Location, Unit, Ownership, Category, Remarks, Status (Verified/Unverified, klik untuk buka modal verifikasi), Verification Date.
- Filter: Category, Status Verifikasi, Ownership, search deskripsi/lokasi (single-select, belum disamakan dengan multi-select filter Asset Inventory — di luar scope perubahan ini).
- **Export CSV** tetap ada (mengekspor data yang sedang ter-filter). **Import CSV dan Download Template sudah dihapus** (14 Agustus 2026) — tidak relevan lagi karena baris baru selalu dibuat lewat pemilihan asset, bukan input massal free-text.

### `EditReclassificationModal.tsx`

- Kalau `editingReclassification.assetId` terisi: Asset Description/Category/Location/Unit/Ownership ditampilkan **read-only** dengan catatan "Sourced from Asset Inventory — edit lewat halaman Inventory". Hanya Category (klasifikasi) dan Remarks yang bisa diubah.
- Kalau `assetId` kosong (baris legacy): form tetap seperti semula, semua field bisa diedit manual.

---

## Riwayat Implementasi

### Fase 1–5 (Juli 2026) — desain awal, independen dari `assets` ✅
Fondasi tabel, Context, UI, filter/KPI, dan CSV import/export dengan model free-text independen. Lihat git history untuk detail (`20260720000000` s.d. `20260724`-an).

### Fase 6 — Linked ke Asset Inventory (14 Agustus 2026) ✅
- [x] Migration `asset_id` FK + index + trigger snapshot-on-delete
- [x] `fromDb` live-join ke `assets` untuk baris linked
- [x] `syncFromAssets()` — bulk link asset yang belum tertaut
- [x] Kolom "Source" di tabel (Linked vs Manual)
- [x] `EditReclassificationModal` — field identitas read-only untuk baris linked
- [x] Lookup Add/Edit modal (waktu itu masih ada form manual) diarahkan ke `categories1`/`categories2`/`subsidiaries` milik `AssetContext`

### Fase 7 — Add Item selalu pilih asset, hapus form manual & CSV import (14 Agustus 2026) ✅
- [x] `AddReclassificationModal` dirombak total — mengikuti pola `AddMaintenanceModal` (searchable asset dropdown, ringkasan read-only, lalu Category + Remarks)
- [x] `addLinkedReclassification()` — fungsi context khusus untuk jalur ini
- [x] Migration drop `NOT NULL` di `asset_description` (baris linked tidak lagi mengisi kolom ini saat insert)
- [x] Error dari `addLinkedReclassification` dilempar ke pemanggil (sebelumnya gagal diam-diam lewat `setError` yang tidak ditampilkan di UI manapun)
- [x] Import CSV, Download Template, dan `public/reclassification_import_template.csv` dihapus dari `Reclassification.tsx`

---

## Catatan

- **Tidak lagi independen dari `assets`**: berbeda dari keputusan desain awal — sekarang setiap baris baru wajib berasal dari asset yang sudah terdaftar. Kalau ke depan ada kebutuhan mencatat temuan fisik yang benar-benar belum terdaftar, itu perlu didaftarkan dulu sebagai Asset baru di Inventory (lewat `AddAssetModal`), baru bisa masuk audit di sini — bukan lagi lewat form Reclassification langsung.
- **Category dropdown custom**: opsi "custom nama" tetap ada, `category` tetap `TEXT` bebas (bukan enum), sama seperti sebelumnya.
- **Verification date**: tetap di-set otomatis oleh sistem (`NOW()`) saat toggle verified diaktifkan lewat `VerifyReclassificationModal`.
- **Satu asset = maksimal satu baris reclassification aktif**: baik `AddReclassificationModal` maupun `syncFromAssets()` menyaring asset yang sudah tertaut supaya tidak ada duplikat audit untuk asset yang sama.
- **Filter UX** (multi-select, date/cost range, URL persistence, chips) yang sudah dipakai di Asset Inventory **belum** diterapkan ke halaman ini — eksplisit di luar scope perubahan 14 Agustus 2026.
