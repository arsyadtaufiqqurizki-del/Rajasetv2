# Refactoring Plan v2 — Rajaset v2

> Status: **sedang dieksekusi — Step 0, 1, 2, 3, 4 SELESAI (2026-09-10). Berikutnya: Step 5.**
> Disusun: 2026-09-09 · Baseline commit: `6b59a11`
> Progres: 0 ✅ · 1 ✅ · 2 ✅ · 3 ✅ · 4 ✅ · 5–8a ⬜ · 9 ⏸️ ditunda · 10 ⬜
> Test: 63 → **281** (22 file) · lint: 46 → **42 problems** · gate terakhir dijalankan 2026-09-10
> Pendahulu: `refactoring_plan.md` (v1, Agustus 2026 — Step 1–12 sudah dieksekusi)

---

## 0. Tujuan & Batasan

**Tujuan (dikonfirmasi):**
1. Kurangi duplikasi kode — terutama pasangan Add/Edit modal, plumbing Supabase di context, dan scaffolding halaman list.
2. Pisahkan logic bisnis dari UI — logic yang sekarang tertanam di dalam komponen page/modal dipindah ke `lib/` (pure function) dan `hooks/` (stateful) supaya bisa diuji tanpa render.

Step 0–8 dikerjakan berurutan. **Step 9 (rapikan prop filter) ditunda** sampai ada kebutuhan nyata.

**Batasan:**
- **Structure-only, kecuali tiga pengecualian yang disetujui: B1, B2, dan B5** (lihat §5). Ketiganya
  dikerjakan sebagai commit tersendiri yang terpisah dari step refactor, supaya bisa di-revert sendiri.
- Public API context (`useAsset()`, `useReclassification()`, `useMaintenance()`, `useReport()`) tidak berubah bentuknya — halaman & komponen konsumen tidak perlu diubah kecuali disebut eksplisit.
- Nama query param URL filter (`subsidiary`, `category`, `dateFrom`, `costMin`, `q`, `sort`, `dir`, …) tidak berubah — link tersimpan user harus tetap valid.
- Format CSV/XLSX/PDF export tidak berubah (header, urutan kolom, sanitasi).
- Skema database & migrations tidak disentuh.
- Setiap step = 1 commit yang bisa di-*revert* sendiri. Tidak boleh mencampur step dengan pekerjaan fitur.

---

## 1. Baseline terverifikasi (dijalankan 2026-09-09)

| Ukuran | Nilai |
|---|---|
| `npx tsc --noEmit` | **bersih** (exit 0, `strict: true`) |
| `npm test` (vitest) | **63 test / 8 file — semua lulus** |
| `npx eslint .` | **37 error + 9 warning** |
| → 21 error | `@typescript-eslint/no-explicit-any` |
| → 16 error | `react-hooks/set-state-in-effect` |
| Total LOC `src/` | 14.982 baris (ts/tsx) |

Test yang ada (jaring pengaman saat ini):
`depreciation.test.ts`, `useListFilters.test.ts`, `useAssetFilters.test.ts`, `useMaintenanceFilters.test.ts`,
`Modal.test.tsx`, `Inventory.test.tsx`, `Dashboard.test.tsx`, `Reports.test.tsx`.

**Celah jaring pengaman:** `Reclassification.tsx`, `Maintenance.tsx`, dan seluruh Add/Edit modal
belum punya test sama sekali — padahal justru itu yang paling banyak disentuh rencana ini. Ditangani di Step 0.

### Yang sudah beres dari v1 (jangan diulang)
`useListFilters<T>` sebagai satu-satunya filter engine · `lib/money.ts` · `lib/csv.ts` (termasuk `sanitizeCell`) ·
`lib/dates.ts` · `components/ui/*` (Modal, Pagination, FilterBar, ConfirmModal, ProgressModal, StatCard, Toast) ·
dekomposisi Dashboard/Reports/Reclassification/Settings/MasterData · `lib/reports/*` · route code-splitting +
ErrorBoundary di `App.tsx` · `strict: true` · i18n `en.ts`/`id.ts`.

---

## 2. Temuan — apa yang perlu di-refactor dan kenapa

### F1 🔴 Pasangan Add/Edit modal digandakan — ±1.823 LOC
| Pasangan | LOC | Baris berbeda setelah normalisasi kata add/edit |
|---|---|---|
| `AddAssetModal` + `EditAssetModal` | 424 + 461 = 885 | **101** (≈89% identik) |
| `AddMaintenanceModal` + `EditMaintenanceModal` | 274 + 169 = 443 | 155 |
| `AddReclassificationModal` + `EditReclassificationModal` | 247 + 248 = 495 | 287 |

Yang tergandakan di dalamnya:
- **Algoritma format ribuan untuk Asset Cost** — 3 salinan identik (`AddAssetModal.tsx:93–117`,
  `EditAssetModal.tsx:38–53` dan `:130–…`). Logic murni, 0 test.
- **Aturan lintas-field Listed ↔ Verification** — 2 salinan identik (`AddAssetModal.tsx:74–91`,
  `EditAssetModal.tsx:111–128`). Ini **aturan bisnis** yang hidup di dalam komponen UI.
- **State simpan/error/loading + effect reset** — 6 salinan (`isSaving`, `saveError`, `useEffect` reset).
- **String className input** — literal Tailwind yang sama diulang belasan kali per file.
- **Asset picker** (search + dropdown + `slice(0,50)` + click-outside ref) — 2 salinan identik di
  `AddReclassificationModal.tsx:11–39` dan `AddMaintenanceModal.tsx:15–37`.

*Kenapa penting:* setiap perubahan field asset harus dikerjakan dua kali. Riwayat commit membuktikan
biayanya nyata — "Samakan UI Edit Asset dengan Add New Asset" (cec19ac) adalah commit untuk memperbaiki
drift yang terjadi karena duplikasi ini.

### F2 🔴 Lima modal masih hand-roll chrome-nya sendiri
`ui/Modal` (portal + focus trap + Esc + body-scroll lock, sudah ada test) dipakai oleh 9 komponen,
tapi **tidak** dipakai oleh:
`AddMaintenanceModal`, `EditMaintenanceModal`, `AddReclassificationModal`, `EditReclassificationModal`,
`VerifyReclassificationModal`, `MaintenanceCalendarModal` — semuanya menulis `fixed inset-0` sendiri.

*Konsekuensi:* modal-modal itu tidak punya focus trap, tidak menutup dengan Esc, dan tidak mengunci
scroll body. ⚠️ Memperbaikinya **adalah perubahan behavior yang terlihat user** (Esc jadi menutup modal).
Lihat §5 — butuh persetujuan terpisah.

### F3 🟠 Plumbing Supabase digandakan di context layer
| Pola | Lokasi | Catatan |
|---|---|---|
| Loop fetch chunked 1000-baris | `AssetContext.tsx:119–159`, `ReclassificationContext.tsx:90–112` | identik, beda tabel & select |
| Loop batch-delete 100-baris + `onProgress` | `AssetContext.tsx:253–275`, `ReclassificationContext.tsx:195–216` | identik, beda tabel & setter |
| CRUD lookup table (add/delete + optimistic state) | `AssetContext.tsx:165–203` | **4 salinan** dalam satu file (subsidiaries, category_1, category_2, item_statuses) |
| Trio state modal (`isAdd`/`isEdit`/`editing`) | `AssetContext.tsx:115–117`, `ReclassificationContext.tsx:84–88` | state UI menumpang di context data |
| `fromDb`/`toDb` dengan `row: any` | 3 context | 5 dari 21 error `no-explicit-any` |

### F4 🟠 Logic bisnis tertanam di komponen page
`Inventory.tsx` (624 LOC) berisi logic murni yang tidak bisa diuji tanpa me-render halaman:
- `handleImportCSV` (`:242–346`) — 105 baris: mapping header CSV, validasi baris, normalisasi, batching.
- `normalizeListed` (`:30–34`) — aturan domain, didefinisikan lokal di file page.
- `handleExportCSV` (`:208–240`) — pemilihan kolom + mapping baris.
- `filteredTotals` (`:157–167`) — agregasi cost/book value/unit.
- 2 dari 21 error `no-explicit-any` ada di sini (`:250`, `:258` — `results.data as any[]`).

### F5 🟠 Scaffolding halaman list digandakan
| Pola | Inventory | Reclassification | Maintenance |
|---|---|---|---|
| `Set` seleksi + selectAll/selectOne | `:188–206` | `:155–173` | — |
| State paginasi + `totalPages` + `paginated…` useMemo | `:150–155` | `:97–101` | `:42–47` |
| Alur bulk delete (ketik `DELETE` → cek noFilters+allSelected → deleteAll vs deleteMultiple → progress modal) | `:360–382` | `:175–197` | — |
| `pendingDeleteId` + `ConfirmModal` per baris | `:179–186` | `:146–153` | `:64–74` |

⚠️ Bentuknya sama tapi **tidak identik**: Inventory mempersistensi page size ke localStorage dan punya
opsi 10/25/50/100; Reclassification & Maintenance hard-code `itemsPerPage = 10`. Hook bersama harus
menerima ini sebagai konfigurasi, bukan menyeragamkannya.

### F6 🟡 `useAssetFilters` meratakan API generik jadi 30+ prop
`useAssetFilters.ts:65–99` membongkar objek `list` menjadi 30 field bernama → `Inventory.tsx:116–141`
mendestrukturisasi 30 → `AssetFilters.tsx` mendeklarasikan interface 30-prop (`:6–40`) lalu
mendestrukturisasinya lagi (`:42–57`). Menambah satu filter = menyentuh 4 tempat.

*Trade-off:* prop bernama memberi type-safety yang enak di call site. Ini step opsional, ditaruh paling akhir.

### F7 🟢 Dead code
`src/utils/supabase/client.ts` — **nol importer** (terverifikasi via grep). Duplikat dari `src/lib/supabase.ts`
dan memakai nama env var yang salah. Hapus.

---

## 3. Daftar file yang akan diubah

**File baru (14):**
```
src/lib/assetCsv.ts                 ← import/export mapping + validasi (dari Inventory.tsx)
src/lib/assetCsv.test.ts
src/lib/assetRules.ts               ← aturan Listed ↔ Verification (dari 2 modal)
src/lib/assetRules.test.ts
src/lib/supabase/fetchAllRows.ts    ← loop chunked select
src/lib/supabase/batchWrite.ts      ← loop batch delete/update + onProgress
src/hooks/useEntityForm.ts          ← formData + isSaving + saveError + reset-on-open
src/hooks/useLookupTable.ts         ← CRUD master data optimistic
src/hooks/useEntityModals.ts        ← trio state add/edit/editing
src/hooks/useRowSelection.ts        ← Set seleksi + selectAll/selectOne
src/hooks/usePagination.ts          ← page + pageSize + slice (pageSize sebagai config)
src/hooks/useBulkDelete.ts          ← alur konfirmasi + progress bulk delete
src/components/ui/FormModal.tsx     ← header + tombol close + footer + error banner
src/components/AssetFormFields.tsx  ← field bersama Add/Edit Asset
```

**File yang diubah (18):**
```
src/lib/money.ts                          + formatCostInput()
src/contexts/AssetContext.tsx             adopsi fetchAllRows/batchWrite/useLookupTable/useEntityModals
src/contexts/ReclassificationContext.tsx  adopsi fetchAllRows/batchWrite/useEntityModals
src/contexts/MaintenanceContext.tsx       ketik ulang fromDb (hapus `any`)
src/components/AddAssetModal.tsx          → tipis, pakai AssetFormFields + useEntityForm
src/components/EditAssetModal.tsx         → tipis, idem
src/components/AddMaintenanceModal.tsx    → FormModal + AssetPicker + useEntityForm
src/components/EditMaintenanceModal.tsx   → idem
src/components/AddReclassificationModal.tsx    → idem
src/components/EditReclassificationModal.tsx   → idem
src/components/VerifyReclassificationModal.tsx → ui/Modal
src/components/MaintenanceCalendarModal.tsx    → ui/Modal
src/pages/Inventory.tsx                   624 → ±430 (logic pindah ke lib/ + hooks/)
src/pages/Reclassification.tsx            398 → ±300
src/pages/Maintenance.tsx                 198 → ±175
src/hooks/useAssetFilters.ts              (opsional, Step 9)
src/components/AssetFilters.tsx           (opsional, Step 9)
src/pages/Inventory.test.tsx              penyesuaian bila prop berubah (Step 9 saja)
```

**Tambahan untuk Step 8a (B5) — copy ke bahasa Inggris:**
```
src/i18n/en.ts                            + ±25 kunci baru
tukar import id → en (8 file):
  AddMaintenanceModal · AddReclassificationModal · MaintenanceStats · MaintenanceTable
  NotificationBell · ReclassificationStats · ReclassificationTable · pages/Reclassification.tsx
string hardcoded (11 file tambahan):
  pages/AIAssistant.tsx · pages/Guide.tsx · hooks/useAiChat.ts · hooks/useSystemAlerts.ts
  VerifyReclassificationModal · ReclassificationToolbar · ImportProgressModal
  EditReclassificationModal · MaintenanceSchedulePanel · MaintenanceCalendarModal
```

**File yang dihapus (2):**
`src/utils/supabase/client.ts` (Step 1) · `src/i18n/id.ts` (Step 8a.3, nol importer setelah 8a.1)

---

## 4. Urutan pengerjaan

Prinsip: **daun dulu** (`lib/` → `hooks/` → `components/ui/` → komponen → page). Setiap step berdiri
sendiri, punya gate, dan bisa di-revert tanpa menyeret step lain.

---

### Step 0 — Perluas jaring pengaman ✅ **SELESAI 2026-09-10** *(tanpa perubahan production code)*
Tulis characterization test untuk yang belum tertutup **sebelum** disentuh:
- `AddAssetModal` / `EditAssetModal`: submit sukses, submit gagal → pesan error, Listed=Audited memaksa
  Verification=Yes + mengisi tanggal, checkbox Unlimited life, format ribuan pada Asset Cost.
- `Reclassification.tsx`: bulk delete (`DELETE` → deleteAll vs deleteMultiple), seleksi, paginasi.
- `Maintenance.tsx`: alur delete satu record.
- `lib/assetCsv` belum ada — tapi rekam **CSV export fixture** (satu file .csv hasil export saat ini)
  sebagai golden file untuk dibandingkan di Step 2.

**Risiko:** nihil (hanya menambah test). **Gate:** test baru hijau di kode yang belum diubah.

**Hasil (2026-09-10):** 5 file baru, **63 → 136 test** (13 file), semuanya hijau di kode yang belum diubah.
`tsc --noEmit` tetap bersih; `eslint .` tetap **46 problems (37 error, 9 warning)** — tidak ada lint baru.

| File | Test | Yang dipin |
|---|---|---|
| `src/components/AddAssetModal.test.tsx` | 25 | payload save (koma dilepas, verification→boolean), pesan `Failed to save asset`, aturan Listed↔Verification, format ribuan, checkbox Unlimited |
| `src/components/EditAssetModal.test.tsx` | 18 | hidrasi dari `editingAsset` (termasuk re-format cost), `updateAsset(id, …)`, pesan `Failed to update asset`, return `null` tanpa asset, judul/tombol berbeda — yaitu keempat perbedaan yang didaftar di Step 6 |
| `src/pages/Reclassification.test.tsx` | 17 | routing `deleteAll` vs `deleteMultiple` di semua cabang, gate teks `DELETE`, seleksi lintas-halaman, paginasi, jalur orphan yang **tidak boleh** lewat `deleteAll` |
| `src/pages/Maintenance.test.tsx` | 10 | alur delete satu record (konfirmasi, state `Deleting...`, baris yang benar), baseline kegagalan senyap untuk B2, paginasi, metrik header |
| `src/pages/Inventory.export.test.tsx` + `src/pages/__fixtures__/asset-export.golden.csv` | 3 | golden file CSV export (urutan kolom, CRLF, quoting, guard formula-injection `sanitizeCell`, book value pada tanggal beku) — pembanding untuk gate Step 2 |

Rekam ulang golden file setelah perubahan format yang **disengaja**:
`UPDATE_GOLDEN=1 npx vitest run src/pages/Inventory.export.test.tsx`

> ⚠️ **Temuan baru saat Step 0 — fokus dicuri di modal Add/Edit Asset.**
> `ui/Modal` menaruh `onClose` di dependency array effect fokusnya, sementara `AddAssetModal`/`EditAssetModal`
> membuat ulang `handleClose` setiap render. Akibatnya **setiap ketikan** menjalankan ulang effect itu dan
> memindahkan fokus ke tombol X — mengetik spasi lalu menekan tombol X dan menutup modal.
> Dipin sementara di blok `known defect` pada `AddAssetModal.test.tsx`. Perbaikannya masuk Step 5/6
> (saat handler pindah ke `ui/FormModal` + `useEntityForm`); hapus blok itu ketika sudah diperbaiki.
> Ini bukan bagian dari B1/B2/B5 — pertimbangkan menambahkannya sebagai B6.

---

### Step 1 — Hapus dead code ✅ **SELESAI 2026-09-10** *(±10 menit)*
- Hapus `src/utils/supabase/client.ts`.

**Risiko:** nihil — nol importer, sudah diverifikasi grep. **Gate:** `tsc --noEmit` bersih, build sukses.

**Hasil (2026-09-10):** `src/utils/supabase/client.ts` dihapus (6 baris). Direktori `src/utils/supabase/`
dan `src/utils/` ikut hilang karena jadi kosong — `src/utils` tidak lagi ada di pohon sumber.
Grep ulang sebelum menghapus: nol importer di kode; satu-satunya penyebutan ada di file dokumentasi
(`AGENTS.md:52`, `:319`, `claudememo.md:21`, `:72`, `refactoring_plan.md:537`) — **belum diperbarui,
ditangani di Step 10** bersama penyegaran dokumen lain.

| Gate | Hasil |
|---|---|
| `npx tsc --noEmit` | bersih (exit 0) |
| `npx vitest run` | **136 test / 13 file — semua lulus** (tak berubah dari Step 0) |
| `npm run build` | sukses (22,68 s; hanya peringatan lama soal ukuran chunk >500 kB) |

---

### Step 2 — Ekstraksi pure function: `lib/assetCsv.ts`, `lib/assetRules.ts`, `money.formatCostInput` ✅ **SELESAI 2026-09-10** *(±5 jam)*
Pindahkan **apa adanya**, tanpa "sekalian memperbaiki":
- `normalizeListed`, mapping header CSV, validasi baris → `lib/assetCsv.ts` (+ tipe `AssetCsvRow`, buang `any`).
- Mapping kolom export → `lib/assetCsv.ts` (`buildExportRows`).
- Aturan Listed ↔ Verification → `lib/assetRules.ts` (`applyListedChange`, `applyVerificationChange`).
- Algoritma format ribuan → `lib/money.ts` (`formatCostInput`), 3 salinan diganti panggilan.
- Tulis unit test untuk masing-masing.

**Risiko: SEDANG.** Kalau salah pindah, import CSV bisa diam-diam menolak baris valid atau menerima
baris invalid, dan Asset Cost bisa salah format. Mitigasi: bandingkan hasil export dengan golden file
Step 0 byte-per-byte; import file CSV uji sebelum & sesudah, bandingkan jumlah success/failed/skipped.

**Gate:** golden file identik · test import/export baru hijau · 63 test lama tetap hijau.

**Hasil (2026-09-10):** 2 modul lib baru + 3 file test baru, **136 → 201 test** (16 file), semuanya hijau.
Golden file CSV **tidak berubah sama sekali** — test export lulus tanpa `UPDATE_GOLDEN`, jadi byte export
identik dengan sebelum refactor.

| Yang dipindah | Dari | Ke |
|---|---|---|
| Algoritma format ribuan (3 salinan identik) | `AddAssetModal:93–117`, `EditAssetModal:38–53` & `:130–…` | `lib/money.ts` → `formatCostInput(value)` |
| Aturan Listed ↔ Verification (2 salinan identik) | `AddAssetModal:74–91`, `EditAssetModal:111–128` | `lib/assetRules.ts` → `applyListedChange`, `applyVerificationChange`, `todayIso` |
| `normalizeListed` | `Inventory.tsx:30–34` | `lib/assetCsv.ts` |
| Validasi baris import + penomoran baris | `Inventory.tsx:257–283` | `lib/assetCsv.ts` → `partitionCsvRows` |
| Mapping header CSV → payload `addAsset` | `Inventory.tsx:294–316` | `lib/assetCsv.ts` → `mapCsvRowToAssetInput` |
| Mapping kolom export | `Inventory.tsx:219–226` | `lib/assetCsv.ts` → `buildExportRows` |
| Batas 5000 baris | literal di `Inventory.tsx` | `lib/assetCsv.ts` → `MAX_IMPORT_ROWS` |

**Dua keputusan bentuk API** (supaya `lib/` tidak bergantung ke `components/` atau ke penulis CSV):
- `buildExportRows(assets, columnIds, fields, bookValues, sanitize)` — `ASSET_CSV_FIELDS` dan `sanitizeCell`
  di-*inject* dari `Inventory.tsx`. `AssetTable.tsx` **tidak disentuh** (di luar cakupan, §7).
- `partitionCsvRows` tetap memakai `i18n/en` untuk teks alasan, mengikuti preseden `lib/reports/datePresets.ts`.
  Objek `invalidRows` bentuknya persis sama seperti sebelumnya — `ImportProgressModal` dan unduhan
  baris gagal tidak berubah.

**Hidrasi cost di Edit** ternyata algoritma yang sama persis dengan handler keystroke (sudah dicek
cabang per cabang: `''`, `.5`, `1.2.3`, `0012`) — jadi 15 baris di `useEffect` menjadi satu panggilan
`formatCostInput`. Perbedaan Add vs Edit yang didaftar di Step 6 **tidak** tersentuh.

| Gate | Hasil |
|---|---|
| Golden file CSV | **identik** — `Inventory.export.test.tsx` lulus tanpa merekam ulang |
| `npx tsc --noEmit` | bersih (exit 0) |
| `npx vitest run` | **201 test / 16 file — semua lulus** (136 lama + 65 baru) |
| `npx eslint .` | **44 problems (35 error, 9 warning)** — turun 2 error dari 46/37; keduanya `no-explicit-any` di `Inventory.tsx:250` & `:258` yang hilang bersama `results.data as any[]` |
| `npm run build` | sukses (11,18 s) |

**Delta LOC:** kode produksi −92 baris di 3 file lama, +177 baris di 2 modul lib baru → **+85 bersih**.
Step 2 memang bukan step penghapus baris; nilainya ada di 5 salinan yang jadi 1 dan di 65 test baru
yang jalan tanpa render. Pengurangan besar datang di Step 6–8.

Test baru: `lib/money.test.ts` (16) · `lib/assetRules.test.ts` (12) · `lib/assetCsv.test.ts` (37).

---

### Step 3 — Helper Supabase: `fetchAllRows` + `batchWrite` ✅ **SELESAI 2026-09-10** *(±3 jam)*
- `lib/supabase/fetchAllRows.ts` — loop chunk 1000, mengembalikan `{ rows, error }`.
- `lib/supabase/batchWrite.ts` — `batchDelete(table, ids, onProgress)` dengan chunk 100.
- Adopsi di `AssetContext` dan `ReclassificationContext`.

⚠️ **Jangan sekalian menyeragamkan error handling.** Saat ini `addAsset` melempar exception sementara
`addRecord`/`addReclassification` menelannya — halaman mengandalkan perbedaan itu (`AddAssetModal`
menangkap error, `Reclassification` tidak). Menyeragamkannya = perubahan behavior; lihat §5.

**Risiko: SEDANG.** Batasan chunk/batch harus persis sama (1000 dan 100) — mengubahnya mengubah pola
request ke Supabase dan granularitas progress bar. Mitigasi: pertahankan konstanta, pastikan callback
`onProgress` dipanggil dengan urutan & nilai yang sama.

**Gate:** buka Inventory & Reclassification dengan >1000 baris → jumlah baris sama · bulk delete →
progress bar bergerak dengan langkah yang sama seperti sebelumnya.

**Hasil (2026-09-10):** 2 modul lib baru + 4 file test baru, **201 → 241 test** (20 file), semuanya hijau.
Golden file CSV tetap identik. Konstanta dipertahankan sebagai konstanta bernama:
`FETCH_CHUNK_SIZE = 1000` dan `WRITE_BATCH_SIZE = 100`.

| Yang dipindah | Dari | Ke |
|---|---|---|
| Loop fetch chunked 1000-baris (2 salinan identik) | `AssetContext:123–137`, `ReclassificationContext:94–107` | `lib/supabase/fetchAllRows.ts` → `fetchAllRows(table, { select, orderBy, chunkSize })` |
| Loop batch-delete 100-baris + `onProgress` (2 salinan identik) | `AssetContext:253–275`, `ReclassificationContext:195–216` | `lib/supabase/batchWrite.ts` → `batchDelete(table, ids, { onProgress, onBatchDeleted, batchSize })` |
| Loop batch-update 100-baris + `onProgress` (1 salinan) | `AssetContext:290–312` (`bulkUpdateAssets`) | `lib/supabase/batchWrite.ts` → `batchUpdate(table, ids, patch, { onProgress, onBatchUpdated, batchSize })` |

**Empat keputusan bentuk API** (semuanya untuk mempertahankan behavior persis):
- `fetchAllRows` **mengembalikan** `{ rows, error }` alih-alih melempar, dan pada kegagalan di tengah
  tetap mengembalikan chunk yang sudah berhasil — persis seperti loop lama yang `break` lalu tetap
  memanggil `setAssets(allRows.map(fromDb))`. Halaman tetap menampilkan data parsial + pesan error.
- Rekonsiliasi state optimistic dipindah ke callback `onBatchDeleted` / `onBatchUpdated`, dipanggil
  **sebelum** `onProgress` — urutan yang sama seperti loop lama, jadi baris hilang dari tabel sebelum
  progress bar bergerak. Diuji eksplisit di `batchWrite.test.ts` ("removes rows from local state
  before advancing the progress bar").
- `batchUpdate` ikut diekstrak meskipun hanya punya **satu** call site: file bernama `batchWrite`
  (tulis = delete + update), dan loopnya identik bentuk dengan `batchDelete`. Ini menambah cakupan
  Step 3 satu fungsi di luar teks aslinya — LOC turun 20 baris di `AssetContext` dan `bulkUpdateAssets`
  jadi punya test.
- Nama field hasil diseragamkan jadi `{ processed, failed, succeeded }`. `bulkUpdateAssets` tetap
  mengembalikan `{ updated, failed }` ke pemanggil — **public API context tidak berubah**.

⚠️ **Error handling sengaja tidak diseragamkan**, sesuai peringatan di atas: `addAsset` tetap melempar,
`addRecord`/`addReclassification` tetap menelan. Step 3 tidak menyentuh satu pun fungsi itu.

**Catatan resolusi modul:** `src/lib/supabase.ts` (file) dan `src/lib/supabase/` (direktori) hidup
berdampingan. Baik TypeScript maupun Vite memilih file `.ts` lebih dulu, jadi `import { supabase } from
'../supabase'` di dalam `lib/supabase/*.ts` tetap menunjuk ke klien tunggal — bukan ke direktori.
Terverifikasi lewat `tsc --noEmit`, `vitest`, dan `vite build`.

| Gate | Hasil |
|---|---|
| `npx tsc --noEmit` | bersih (exit 0) |
| `npx vitest run` | **241 test / 20 file — semua lulus** (201 lama + 40 baru) |
| Golden file CSV | **identik** — lulus tanpa `UPDATE_GOLDEN` |
| `npx eslint .` | **42 problems (33 error, 9 warning)** — turun 2 error dari 44/35; keduanya `no-explicit-any` yang hilang bersama `let allRows: any[]` di kedua context |
| `npm run build` | sukses (8,35 s) |
| Gate manual (>1000 baris, progress bar) | ⬜ **belum dijalankan** — butuh sesi browser terhadap data produksi; digantikan sementara oleh test di bawah |

**Pengganti gate manual.** Gate Step 3 aslinya manual (buka halaman dengan >1000 baris, perhatikan
progress bar). Karena sesi ini tanpa browser, jaminannya dipindah ke dua lapis test:

| Lapis | File | Test | Yang dipin |
|---|---|---|---|
| Semantik loop | `lib/supabase/fetchAllRows.test.ts` | 8 | ukuran & urutan `range()` (`[0,999]`, `[1000,1999]`, …), berhenti pada chunk pendek **dan** pada chunk kosong (kelipatan pas), baris parsial + pesan error saat gagal di tengah, `select`/`orderBy` diteruskan di **setiap** chunk |
| Semantik loop | `lib/supabase/batchWrite.test.ts` | 9 | pemecahan 250 id → 100/100/50, `onProgress` = `[100,0] [200,0] [250,0]`, batch gagal dihitung tapi tidak menghentikan sisa batch, urutan `onBatchDeleted` → `onProgress`, id kosong = nol request |
| Wiring context | `contexts/AssetContext.test.tsx` | 15 | tabel & opsi yang diminta, 2500 baris masuk utuh, error fetch tampil tanpa mengosongkan list, `lastFetchedAt` dari `updated_at` terbaru, `onProgress` pemanggil diteruskan apa adanya, `deleteAll` mengirim seluruh id, patch kosong / seleksi kosong = nol request |
| Wiring context | `contexts/ReclassificationContext.test.tsx` | 8 | idem, plus **join `linked_asset` harus tetap ada di select** — ini yang menjaga baris linked tetap mirror Asset Inventory |

Yang **tidak** tercakup test dan masih perlu dilihat mata di sesi berikutnya: rendering progress bar
sungguhan dan jumlah baris terhadap database produksi.

**Delta LOC:** kode produksi **−49 baris** di 2 context (−80/+31), +154 baris di 2 modul lib baru.

---

### Step 4 — `useLookupTable` + `useEntityModals` ✅ **SELESAI 2026-09-10** *(±3 jam)*
- 4 blok master-data di `AssetContext:165–203` → 4 pemanggilan `useLookupTable('subsidiaries')` dst.
- Trio state modal di 2 context → `useEntityModals<T>()`.
- Bentuk objek yang di-*provide* tidak berubah sedikit pun.

**Risiko: RENDAH-SEDANG.** Update optimistic harus tetap urutannya (set state dulu, lalu fire-and-forget
ke Supabase) — `addAsset` bergantung pada `addSubsidiary` yang mendaftarkan nilai baru secara sinkron.

**Gate:** tambah asset dengan subsidiary/kategori/item status baru → langsung muncul di dropdown
Autocomplete tanpa refresh (perilaku sekarang).

**Hasil (2026-09-10):** 2 hook baru + 2 file test baru, **241 → 281 test** (22 file), semuanya hijau.
Golden file CSV tetap identik. Public API kedua context **tidak berubah satu field pun**.

| Yang dipindah | Dari | Ke |
|---|---|---|
| 4 blok CRUD master-data optimistic (identik, beda tabel & setter) | `AssetContext:159–197` | `hooks/useLookupTable.ts` → `useLookupTable(table)` → `{ values, hydrate, add, remove }` |
| Trio state modal add/edit/editing | `AssetContext:117–119`, `ReclassificationContext:86–88` | `hooks/useEntityModals.ts` → `useEntityModals<T>()` |
| Pasangan state modal verify | `ReclassificationContext:89–90` | `hooks/useEntityModals.ts` → `useModalState<T>()` |

**Tiga keputusan bentuk API:**
- **Nama publik dipulihkan di tempat destructuring**, bukan di dalam hook:
  `const { values: subsidiaries, add: addSubsidiary, remove: deleteSubsidiary } = useLookupTable('subsidiaries')`.
  Objek yang di-*provide* karena itu tersusun dari variabel dengan nama yang persis sama seperti sebelumnya —
  `MasterData.tsx` dan seluruh konsumen lain tidak disentuh.
- **`hydrate(names)` dipisah dari `add`.** Fetch master data tetap satu `Promise.all` di `fetchAll`
  (4 request paralel, urutan sama seperti sebelumnya); hook hanya menerima hasilnya. Memindahkan fetch
  ke dalam hook akan mengubah pola request jadi 4 effect terpisah — di luar cakupan step ini.
  Dedupe `[...new Set(...)]` yang tadinya ditulis 4 kali sekarang hidup di `hydrate`.
- **`useModalState<T>()` diekspor terpisah** dan dipakai `useEntityModals` untuk bagian edit-nya.
  Modal verify di Reclassification punya bentuk yang sama (flag + baris) tapi bukan pasangan add/edit,
  jadi memaksanya masuk `useEntityModals` akan menghasilkan hook bercabang. `RECLASSIFICATION` jadi
  satu-satunya context dengan tiga modal; test memastikan yang ketiga tetap terpisah dari dua lainnya.

⚠️ **Urutan optimistic dipertahankan persis:** `setValues(...)` dipanggil lebih dulu, lalu request
`upsert`/`delete` dikirim **tanpa di-`await`**. `add('')` tetap no-op; `remove('')` tetap **tidak**
dijaga — keduanya persis seperti kode lama. `add` pada nama yang sudah terdaftar tidak menduplikasi
di state tapi tetap mengirim upsert (idempoten), juga seperti kode lama.

Callback `hydrate`/`add`/`remove` sekarang stabil (`useCallback`), jadi `fetchAll` bisa
mencantumkan keempat `hydrate` di dependency array-nya tanpa membuat `refetch` berubah identitas
tiap render.

| Gate | Hasil |
|---|---|
| `npx tsc --noEmit` | bersih (exit 0) |
| `npx vitest run` | **281 test / 22 file — semua lulus** (241 lama + 40 baru) |
| Golden file CSV | **identik** — lulus tanpa `UPDATE_GOLDEN` |
| `npx eslint .` | **42 problems (33 error, 9 warning)** — tidak berubah dari Step 3; tidak ada lint baru |
| `npm run build` | sukses (9,20 s) |
| Gate manual (dropdown Autocomplete tanpa refresh) | ⬜ **belum dijalankan** — sesi ini tanpa browser; digantikan test di bawah |

**Pengganti gate manual.** Gate Step 4 aslinya manual (tambah asset dengan subsidiary baru, lihat
dropdown). Jaminannya dipindah ke dua lapis test:

| Lapis | File | Test | Yang dipin |
|---|---|---|---|
| Semantik hook | `hooks/useLookupTable.test.ts` | 16 | dedupe `hydrate`, append tanpa re-sort, `add('')` no-op, `remove('')` tetap mengirim delete, tabel yang benar per instance, callback stabil, **dan** nilai tetap muncul walau request menggantung selamanya (bukti fire-and-forget) |
| Semantik hook | `hooks/useEntityModals.test.ts` | 11 | flag add/edit saling bebas, baris edit bertahan saat modal ditutup, tiap `useModalState` punya state sendiri |
| Wiring context | `contexts/AssetContext.test.tsx` | +8 | 4 list terbit di bawah nama publiknya masing-masing & ter-dedupe, add/delete tiap list menuju tabelnya sendiri, list saling bebas, **`addAsset` mendaftarkan subsidiary/kategori/item status baru dalam call yang sama** (= gate Step 4), field kosong tidak mengirim upsert, state modal awal & saling bebas |
| Wiring context | `contexts/ReclassificationContext.test.tsx` | +5 | tiga modal mulai tertutup, baris edit vs baris verify tidak saling mengganggu, membersihkan baris verify tidak menghapus baris edit |

Yang **tidak** tercakup test dan masih perlu dilihat mata: dropdown Autocomplete sungguhan di
`AddAssetModal`, dan halaman Master Data terhadap database produksi.

**Delta LOC:** kode produksi **−14 baris** di 2 context (−57/+43), +93 baris di 2 hook baru.
Sama seperti Step 2–3, nilainya bukan di jumlah baris melainkan di 4 salinan yang jadi 1 dan
27 test baru yang jalan tanpa render provider.

---

### Step 5 — `ui/FormModal` + primitive field *(±4 jam)*
- `ui/FormModal.tsx` di atas `ui/Modal`: header + judul + tombol X + `<form>` + error banner + footer
  (Cancel / Save dengan spinner).
- Adopsi **hanya di `AddAssetModal`** dulu (yang sudah memakai `ui/Modal`, jadi tidak ada perubahan a11y).

**Risiko: RENDAH.** Murni pemindahan markup. Mitigasi: bandingkan screenshot sebelum/sesudah.

**Gate:** test `AddAssetModal` dari Step 0 hijau · Esc & Tab masih berperilaku sama.

---

### Step 6 — 🎯 Satukan Add/EditAssetModal *(±6 jam — nilai terbesar)*
- `hooks/useEntityForm.ts`: `formData`, `setField`, `isSaving`, `saveError`, `resetOn(open)`.
  Menghapus 2 dari 16 error `set-state-in-effect`.
- `components/AssetFormFields.tsx`: seluruh body field (16 field), menerima `values` + `onChange` +
  daftar opsi lookup. Memakai `lib/assetRules.ts` dari Step 2 dan `formatCostInput` dari Step 2.
- `AddAssetModal` menyusut ke ±90 LOC (state awal kosong + `addAsset`).
- `EditAssetModal` menyusut ke ±130 LOC (hidrasi dari `editingAsset` + `updateAsset`).
- Perkiraan: 885 → ±450 LOC.

**Risiko: SEDANG-TINGGI** — ini step dengan permukaan sentuh terbesar. Bahaya spesifik:
1. Edit mem-format ulang `assetCost` saat hidrasi, Add tidak → jangan sampai hilang.
2. Edit menampilkan judul & tombol berbeda ("Save Asset" vs "Update Asset") — periksa teks aktual, jangan diseragamkan.
3. `EditAssetModal` return `null` saat `editingAsset` kosong; `AddAssetModal` tidak — kondisi mount berbeda.
4. Pesan error berbeda ("Failed to save asset" vs "Failed to update asset") — pertahankan keduanya.

Mitigasi: kerjakan sebagai dua commit (ekstrak `AssetFormFields` → Add saja; baru migrasi Edit),
jalankan test Step 0 di antaranya.

**Gate:** buat asset baru & edit asset lalu bandingkan baris database sebelum/sesudah · semua test hijau.

---

### Step 7 — Modal Maintenance & Reclassification *(±5 jam)*
- Ekstrak `ui/AssetPicker.tsx` dari `AddReclassificationModal` + `AddMaintenanceModal` (2 salinan identik).
- Pasangan Maintenance & Reclassification memakai `useEntityForm` + `FormModal`.

**Risiko: SEDANG.** Duplikasi pasangan ini lebih rendah (287 dan 155 baris berbeda) — jangan dipaksa
jadi satu komponen. Add-Reclassification memilih asset yang belum tertaut; Edit-Reclassification
mengedit field bebas dan membedakan baris linked vs unlinked. Itu perbedaan **domain**, bukan duplikasi.

**Gate:** CRUD penuh di Maintenance & Reclassification · alur verify tetap jalan.

---

### Step 7a — ⚠️ B1: migrasi 6 modal ke `ui/Modal` *(±2 jam — MENGUBAH BEHAVIOR, commit terpisah)*
`AddMaintenanceModal`, `EditMaintenanceModal`, `AddReclassificationModal`, `EditReclassificationModal`,
`VerifyReclassificationModal`, `MaintenanceCalendarModal` — buang markup `fixed inset-0` buatan sendiri,
pakai `ui/Modal`.

**Perubahan yang akan dirasakan user:** Esc menutup modal (sebelumnya tidak) · fokus keyboard terperangkap
di dalam dialog · scroll body terkunci saat modal terbuka · modal dirender lewat portal.

**Risiko: SEDANG.** `ui/Modal` memfokuskan elemen fokusable pertama saat dibuka — di `AddMaintenanceModal`
itu adalah search box asset picker, yang bisa langsung membuka dropdown-nya. Periksa satu per satu.
Untuk `MaintenanceCalendarModal` (253 LOC, layout lebar), pastikan `className` panel mempertahankan
lebar maksimum yang sekarang.

**Gate:** setiap modal — buka, tekan Esc, Tab sampai putar balik, klik overlay · bandingkan screenshot.

---

### Step 7b — ⚠️ B2: hentikan kegagalan simpan yang senyap *(±3 jam — MENGUBAH BEHAVIOR, commit terpisah)*
Saat ini `addRecord`, `updateRecord`, `deleteRecord` (`MaintenanceContext`) dan `addReclassification`,
`updateReclassification`, `deleteReclassification`, `verifyReclassification` (`ReclassificationContext`)
menelan error: `if (error) { setError(error.message); return; }`. Modal tetap tertutup seolah sukses,
dan user mengira datanya tersimpan.

- Samakan dengan pola `AssetContext.addAsset`: `setError(...)` **lalu `throw error`**.
- Modal pemanggil menangkapnya lewat `saveError` dari `useEntityForm` (sudah tersedia sejak Step 7)
  dan menampilkan banner error, modal tetap terbuka.
- `Reclassification.tsx` belum punya `Toast` — tambahkan untuk kegagalan delete & verify (pola sama
  seperti `Inventory.tsx:610–614`).

**Risiko: SEDANG-TINGGI.** Ini satu-satunya step yang sengaja mengubah alur kontrol. Bahaya: ada
pemanggil yang tidak menangkap `throw` sehingga error naik jadi unhandled rejection dan tertangkap
`ErrorBoundary` — layar putih, bukan pesan error. Mitigasi: telusuri **setiap** call site tiap fungsi
sebelum mengubah tanda tangannya; uji jalur gagal dengan mematikan jaringan.

**Gate:** matikan koneksi → coba simpan/hapus di Maintenance & Reclassification → muncul pesan error,
modal tidak menutup, tidak ada layar putih.

---

### Step 8 — Hook halaman list *(±5 jam)*
- `useRowSelection`, `usePagination(pageSizeConfig)`, `useBulkDelete`.
- Adopsi di `Inventory.tsx` lalu `Reclassification.tsx`; `Maintenance.tsx` hanya `usePagination`.
- `Inventory.tsx` 624 → ±430; `Reclassification.tsx` 398 → ±300.

**Risiko: SEDANG.** Titik paling rawan: cek `noFilters && allSelected` yang memutuskan `deleteAll…`
vs `deleteMultiple…`. Daftar filter yang diperiksa berbeda per halaman (Inventory 11 kondisi,
Reclassification 5) — hook harus menerima predikat itu sebagai argumen, bukan menebaknya.
Catatan: `handleConfirmDeleteOrphans` di Reclassification sengaja **tidak** boleh memakai jalur
`deleteAll` (ada komentar eksplisit di `:199–201`) — pertahankan.

Persistensi page size Inventory (localStorage, opsi 10/25/50/100) harus tetap; Reclassification &
Maintenance tetap 10 tanpa persistensi.

**Gate:** pilih semua → hapus dengan & tanpa filter aktif, bandingkan jumlah baris terhapus dengan
perilaku sekarang · page size Inventory masih tersimpan setelah reload.

---

### Step 8a — ⚠️ B5: seragamkan copy UI ke bahasa Inggris *(±5 jam — MENGUBAH BEHAVIOR, commit terpisah)*
Dikerjakan **setelah** Step 8 supaya setiap file sudah berada di bentuk akhirnya — menerjemahkan string
lebih dulu berarti mengerjakannya dua kali.

**8a.1 — Tukar import (±30 menit, mekanis).** 8 file berpindah `i18n/id` → `i18n/en`:
`AddMaintenanceModal`, `AddReclassificationModal`, `MaintenanceStats`, `MaintenanceTable`,
`NotificationBell`, `ReclassificationStats`, `ReclassificationTable`, `Reclassification.tsx`.
Paritas kunci sudah diverifikasi: `en.ts` memuat **semua** 100 kunci `id.ts` (plus 1 kunci ekstra
`noPriorMonthData`) — tidak akan ada kunci yang hilang.

**8a.2 — Pindahkan ±25 string hardcoded (±3 jam).** String Indonesia yang ditulis langsung di JSX,
bukan lewat i18n:

| File | Jumlah | Contoh |
|---|---|---|
| `pages/Reclassification.tsx` | 10 | "Catat dan verifikasi temuan audit fisik aset.", "Hapus baris ini" |
| `pages/AIAssistant.tsx` | 5 (dari 8 — lihat catatan AI di bawah) | "Hapus semua percakapan?", "Batal", "Ya, Hapus", "Hapus Chat" |
| `components/AddReclassificationModal.tsx` | 6 | "Tambah Item Reclassification", "Cari asset number atau deskripsi..." |
| `hooks/useAiChat.ts` | 3 (dari 4 — `GREETING` dikecualikan) | "Gagal menghubungi server AI.", "Server tidak mengembalikan jawaban." |
| `components/NotificationBell.tsx` | 3 | "Belum ada notifikasi", "{n} baris gagal divalidasi" |
| `VerifyReclassificationModal`, `ReclassificationToolbar`, `ImportProgressModal`, `EditReclassificationModal`, `AddMaintenanceModal` | 2 masing-masing | "Tandai Terverifikasi", "Tambah Item", "Baris yang dilewati" |
| `MaintenanceSchedulePanel`, `MaintenanceCalendarModal`, `hooks/useSystemAlerts.ts` | 1 masing-masing | "Belum ada jadwal maintenance" |

Semuanya masuk ke `en.ts` (bukan ditulis inline) supaya tidak menambah utang yang sama.

**8a.3 — Hapus `src/i18n/id.ts` (±15 menit).** Setelah 8a.1 file ini nol importer. Selector bahasa di
`SystemConfigTab.tsx:33–41` **disabled dan bertanda "Coming soon"** — tidak ada switch runtime yang
memakainya, jadi menghapusnya aman. Bisa dipulihkan dari git bila suatu saat i18n sungguhan dibangun.

**Risiko: SEDANG.** Empat jebakan konkret:
1. ⛔ **Jangan terjemahkan nilai database.** `RECLASSIFICATION_PRESET_CATEGORIES` (`'Asset'`,
   `'Needs Review'`, `'Inventory'`), `status` asset, `listed` (`'Audited'`/`'Non-Listed'`), dan
   `itemStatus` adalah **nilai yang tersimpan di DB dan dicocokkan oleh trigger sync**
   (lihat migrasi `20260815020000`, `20260818000000`). Kebetulan semuanya sudah berbahasa Inggris —
   biarkan apa adanya, jangan "dirapikan".
2. ⛔ **Label yang terlanjur tersimpan.** `report_history` menyimpan label tampilan, bukan filter mentah —
   `Reports.tsx:166` sengaja mengecek `'Semua Divisi'` **dan** `'All Divisions'` karena baris lama
   memakai bentuk Indonesia. Cek itu **harus dipertahankan**, jangan dianggap sisa yang bisa dibuang.
3. **`Guide.tsx` menyebut label tombol secara verbatim** — `"Tambah Item"` (`:74`) dan `'Hapus Chat'`
   (`:155`) ditulis di dalam teks panduan berbahasa Inggris. Kalau tombolnya diganti nama, teks panduan
   ikut diperbarui di commit yang sama, kalau tidak panduannya jadi salah.
4. **Riwayat chat AI di localStorage** berisi greeting Indonesia. Sesi lama akan tampil campur sampai
   user menekan "Clear Chat". Tidak merusak, tapi akan terlihat.

**Gate:** grep kata-kata penanda Indonesia di `src/` (di luar komentar kode) → nol hasil **kecuali**
`GREETING` dan 4 prompt saran dari 8a.4 · buka setiap halaman & modal, tidak ada teks Indonesia
tersisa di chrome UI · buka satu laporan lama dari report history lewat "Run again" → filter tetap
termuat benar · kirim satu pertanyaan ke AI Assistant → tetap dijawab dalam bahasa Indonesia
(artinya backend memang tak tersentuh).

**8a.4 — Pengecualian AI Assistant (keputusan 2026-09-09).** `server/index.js` **tidak diubah** —
asisten AI tetap menjawab dalam bahasa Indonesia, dan tidak ada deploy Cloud Run dalam rencana ini.
Konsekuensinya halaman AI Assistant dipisah dua lapis:

| Lapis | Contoh | Tindakan |
|---|---|---|
| **Chrome UI** — milik aplikasi | tombol "Hapus Chat", modal "Hapus semua percakapan?", "Batal", label mode, pesan error jaringan | ✅ **terjemahkan** |
| **Isi percakapan** — masuk/keluar dari model berbahasa Indonesia | `GREETING` (`useAiChat.ts:33`), 4 prompt saran (`AIAssistant.tsx:36–39`) | ⛔ **biarkan Indonesia** |

Alasannya: prompt saran dikirim apa adanya ke model, dan greeting berdiri tepat di atas jawaban
berbahasa Indonesia. Menerjemahkan keduanya justru membuat halaman terlihat lebih campur, bukan
lebih rapi. Kalau suatu saat system prompt backend diubah ke Inggris, dua item ini ikut di commit
yang sama.

---

### Step 9 — *(DITUNDA)* Rapikan prop filter *(±4 jam)*
`useAssetFilters` mengembalikan objek `filters` tunggal; `AssetFilters` menerima satu prop.
30 prop → 3 prop. Menyentuh `Inventory.test.tsx`.

**Risiko: SEDANG, imbalan rendah.** Ini kosmetik struktural — tidak menghapus logic, hanya memindahkan
bentuk. **Rekomendasi saya: tunda** sampai ada kebutuhan nyata (mis. filter baru untuk RBAC).

---

### Step 10 — Gate akhir *(±2 jam)*
- Bersihkan sisa `no-explicit-any` yang belum tersapu step sebelumnya.
- `npm run lint` → target **0 error** (dari 37).
- `graphify update .` untuk menyegarkan knowledge graph.
- Perbarui `AGENTS.md` / `README.md` bila struktur folder berubah.

---

### Ringkasan urutan
```
0 Test ✅     ─► 1 Dead code ✅ ─► 2 lib/ (assetCsv, assetRules, money) ✅
                                        │
3 Supabase helpers ✅ ─► 4 useLookupTable + useEntityModals ✅
                                        │
5 ui/FormModal   ◄── di sini
  └─► 6 🎯 Add/EditAssetModal ─► 7 Modal Maintenance & Reclassification
                                        │
                              7a ⚠️ B1 ui/Modal ─► 7b ⚠️ B2 error handling
                                        │
8 Hook halaman list ─► 8a ⚠️ B5 copy ke Inggris ─► [9 ditunda] ─► 10 Gate akhir
```

**Estimasi total: ±46 jam** (36 jam refactor + 10 jam untuk B1, B2, B5; Step 9 ditunda).
**Perkiraan hasil:** −1.100 s/d −1.400 LOC bersih, `Inventory.tsx` 624→±430,
pasangan modal asset 885→±450, lint 37 error → 0, UI seluruhnya berbahasa Inggris.

---

## 5. Perubahan yang MENGUBAH BEHAVIOR

Semua ditemukan saat analisis. Status per 2026-09-09 setelah konfirmasi:

| # | Temuan | Dampak ke user | Status |
|---|---|---|---|
| B1 | 6 modal tanpa focus trap / Esc / scroll lock (F2) | Esc jadi menutup modal; fokus terperangkap di dialog | ✅ **DISETUJUI** → Step 7a |
| B2 | Error handling context tidak konsisten: `addAsset` melempar, `addRecord`/`addReclassification` menelan | Kegagalan simpan di Maintenance/Reclassification saat ini **senyap** — user mengira tersimpan | ✅ **DISETUJUI** → Step 7b |
| B3 | 4 provider data mount di root `App.tsx`, semuanya fetch saat mount — termasuk saat user di halaman Login | Fetch penuh sebelum login; waktu muat awal | ⏸️ ditunda — sesi terpisah |
| B4 | `Reclassification.tsx:220` — `h-[calc(100vh-[180px])]` (kurung siku bersarang, kelas Tailwind invalid) | Tinggi container tidak sesuai maksud | ⏸️ ditunda — tata letak akan bergeser |
| B5 | Bahasa campur Indonesia/Inggris di UI (8 file pakai `i18n/id`, 11 pakai `i18n/en`, plus ±25 string hardcoded) | Seluruh UI jadi bahasa Inggris | ✅ **DISETUJUI** → Step 8a. Bahasa target: **Inggris** |

**Diputuskan 2026-09-09:** `server/index.js:149–183` (`"Jawab dalam Bahasa Indonesia"`) **tidak diubah**.
Asisten AI tetap menjawab dalam bahasa Indonesia; tidak ada deploy Cloud Run dalam rencana ini.
Penanganannya di Step 8a.4 — chrome UI diterjemahkan, isi percakapan (greeting + prompt saran)
dibiarkan Indonesia.

---

## 6. Register risiko menyeluruh

| Risiko | Di mana | Mitigasi |
|---|---|---|
| Import CSV diam-diam berubah aturan validasinya | Step 2 | Golden file + hitung success/failed/skipped sebelum-sesudah |
| Angka export berubah (format, kolom, urutan) | Step 2, 8 | Byte-compare CSV; XLSX/PDF tidak disentuh |
| Modal Add & Edit tanpa sadar diseragamkan padahal berbeda | Step 6 | Daftar 4 perbedaan disengaja di Step 6; dua commit terpisah |
| Bulk delete melebar jadi hapus-semua | Step 8 | Predikat `noFilters` di-inject per halaman; orphan-delete tetap jalur `deleteMultiple` |
| Link filter tersimpan user rusak | Semua step | Nama query param tidak disentuh sama sekali |
| Progress bar melompat / granularitas berubah | Step 3 | Konstanta chunk 1000 & batch 100 dipertahankan |
| Refactor bertabrakan dengan pekerjaan fitur (RBAC ada di antrean) | Menyeluruh | Satu step = satu commit; jangan campur dengan fitur |
| `throw` baru tidak tertangkap → layar putih dari ErrorBoundary | Step 7b (B2) | Telusuri setiap call site sebelum ubah tanda tangan; uji dengan jaringan mati |
| Autofokus `ui/Modal` membuka dropdown asset picker | Step 7a (B1) | Periksa tiap modal satu per satu setelah migrasi |
| Nilai DB ikut diterjemahkan → trigger sync & filter putus | Step 8a (B5) | Daftar terlarang eksplisit di Step 8a: preset kategori, status, listed, itemStatus |
| Baris `report_history` lama tak cocok lagi dengan label baru | Step 8a (B5) | Pertahankan cek dua-bentuk di `Reports.tsx:166`; uji "Run again" pada laporan lama |
| Teks `Guide.tsx` menyebut nama tombol yang berubah | Step 8a (B5) | Perbarui `Guide.tsx:74` & `:155` di commit yang sama |

---

## 7. Eksplisit di luar cakupan

Disebut agar tidak dikira terlewat: skema database & migrations · `server/` (backend AI di Cloud Run) ·
konfigurasi deploy Cloudflare · `Guide.tsx` (konten statis) · penggantian library (form library,
state manager, dsb.) · `AssetTable.tsx` dan komponen Dashboard/Reports (baru saja di-overhaul di
`6b59a11`, biarkan mengendap dulu) · 20+ file `.md` perencanaan di root repo (bisa dipindah ke `docs/`,
tapi itu housekeeping, bukan refactoring).
