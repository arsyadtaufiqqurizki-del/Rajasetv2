# Rencana Implementasi — Kolom **Book Value** di Asset Inventory

Tujuan: menambahkan kolom **Book Value** pada tabel Asset Inventory, diletakkan **di antara `Asset Cost` dan `Date Place in Service`**, dengan perilaku book value yang sebenarnya (nilai buku = harga perolehan − akumulasi penyusutan sampai hari ini), bukan sekadar kolom teks kosong.

---

## 1. Keputusan Desain Utama

### 1.1 Book value = **nilai turunan (computed)**, bukan kolom baru di database

Book value **tidak** disimpan di tabel `assets`. Nilainya dihitung on-the-fly dari field yang sudah ada:

| Input | Field yang dipakai |
| --- | --- |
| Harga perolehan | `assetCost` |
| Tanggal mulai disusutkan | `datePlaceInService` |
| Masa manfaat | `lifeInMonths` (bisa bernilai `"Unlimited"`) |
| Metode penyusutan | `depreciationMethod` (`Straight Line` / `Declining Balance` / `Units of Production`) |
| Tanggal evaluasi | "hari ini" (awal hari, lihat §4.3) |

Alasan:

- **Selalu akurat.** Book value berubah setiap bulan dengan sendirinya. Kalau disimpan di DB, butuh cron/trigger untuk update ribuan baris tiap bulan — dan begitu ada yang lupa jalan, angkanya salah diam-diam.
- **Tidak ada migrasi + backfill.** Tidak perlu `ALTER TABLE`, tidak perlu mengisi ulang data lama, tidak ada risiko data lama `NULL`.
- **Tidak ada sinkronisasi.** Kalau user mengedit `assetCost` atau `lifeInMonths` lewat EditAssetModal, book value ikut benar tanpa kode tambahan.
- **Konsisten dengan yang sudah ada.** `statusLevel` di `AssetContext.fromDb()` sudah memakai pola field turunan yang sama.

Konsekuensi yang harus diterima (dan dicatat): **tidak bisa** menyimpan override manual, *impairment*, atau revaluasi per aset. Kalau nanti dibutuhkan, itu ditambahkan sebagai kolom DB terpisah (`book_value_override`) yang dipakai kalau terisi — lihat §8.

### 1.2 Sumber kebenaran tunggal: `src/lib/depreciation.ts`

Saat ini logika penyusutan **sudah ada tapi tertanam** di `src/lib/reports/buildDepreciationReport.ts` (baris 17–25 dan 53–67), ditulis dua kali di file yang sama, dan **mengabaikan `depreciationMethod`** — semua aset dihitung straight-line meskipun metodenya `Declining Balance`.

Rencana ini mengekstrak logika itu ke satu modul `src/lib/depreciation.ts`, lalu:

- Tabel Inventory memakai modul itu.
- `buildDepreciationReport.ts` diubah untuk memakai modul yang sama.

Hasilnya: angka **Book Value** di Inventory dijamin sama persis dengan angka **Net Book Value** di halaman Reports. Kalau tidak dilakukan, dua halaman akan menampilkan angka berbeda untuk aset yang sama dan itu akan jadi bug laporan yang mahal.

### 1.3 Data existing (±2.800 baris) — tidak perlu backfill

Tabel `assets` saat ini berisi sekitar **2.800 baris** yang belum punya book value. **Tidak ada yang perlu dikerjakan untuk data lama.** Begitu kode rilis, seluruh 2.800 baris langsung menampilkan book value, karena nilainya dihitung dari kolom yang sudah terisi di baris-baris itu — bukan data baru yang menunggu diisi.

Bandingkan dengan kalau book value disimpan sebagai kolom DB: `ALTER TABLE` → script backfill 2.800 baris → jadwal recompute bulanan selamanya → plus keharusan menulis ulang book value setiap kali ada yang mengedit `assetCost` atau `lifeInMonths`. Semua itu hilang dengan pendekatan computed.

#### Risiko sebenarnya: kelengkapan data, bukan jumlah baris

Book value hanya sebagus data inputnya. Setiap baris existing akan jatuh ke salah satu kategori berikut:

| Kondisi data | Book value yang tampil | Status |
| --- | --- | --- |
| `asset_cost` + `date_place_in_service` + `life_in_months` angka valid | Nilai tersusut sesungguhnya | ✅ ideal |
| `life_in_months = "Unlimited"` | = asset cost, tidak menyusut | ✅ memang seharusnya begitu |
| `date_place_in_service` kosong | = asset cost | ⚠️ benar secara logika, tapi data belum lengkap |
| `life_in_months` kosong / `0` / bukan angka | = asset cost | ⚠️ sama |
| `asset_cost` kosong | `-` | ⚠️ sama |

Baris ⚠️ akan tampil dengan Book Value **persis sama dengan Asset Cost**. Secara aturan itu benar (aset tanpa masa manfaat memang tidak menyusut), tapi kalau jumlahnya besar, kolom baru ini akan terlihat seperti sekadar menyalin kolom sebelahnya dan dikira rusak.

#### Audit sebelum rilis (wajib)

Jalankan query berikut lebih dulu untuk tahu sebaran datanya — read-only, aman:

```sql
select
  count(*) as total_assets,
  count(*) filter (where asset_cost is null or asset_cost = 0)                   as cost_kosong,
  count(*) filter (where date_place_in_service is null)                          as tgl_service_kosong,
  count(*) filter (where life_in_months is null or trim(life_in_months) = '')    as life_kosong,
  count(*) filter (where lower(trim(coalesce(life_in_months,''))) = 'unlimited') as life_unlimited,
  count(*) filter (where life_in_months ~ '^[0-9]+$' and life_in_months::int > 0) as life_angka_valid,
  count(*) filter (where date_place_in_service > current_date)                    as tgl_masa_depan
from assets;
```

Angka penentunya adalah **`life_angka_valid`** — jumlah aset yang book value-nya akan benar-benar bergerak. Interpretasinya:

- **`life_angka_valid` mendekati total** → rilis langsung, tidak ada tindakan tambahan.
- **Porsi ⚠️ signifikan (misal >20%)** → tetap rilis (angkanya tidak salah), tapi barengi dengan pembersihan data. Filter `Date Place in Service` dan filter Book Value (fase 2, §5) bisa dipakai untuk menemukan baris bermasalah: set `Max book value` = `Min book value` = nilai cost, atau lebih praktis, filter tanggal kosong.
- **Mayoritas ⚠️** → tunda rilis kolomnya sampai data diperbaiki, karena kolom yang isinya menduplikasi Asset Cost tidak memberi informasi apa pun.

Catatan status: saat rencana ini ditulis (2026-08-26), project Supabase `ousbnycezagukyxzavmi` berstatus **INACTIVE/paused**, sehingga query di atas belum bisa dijalankan. Bangunkan project-nya dulu lewat dashboard, lalu jalankan.

#### Performa di 2.800 baris

Bukan masalah. Satu pass aritmatika sederhana per aset, dijalankan sekali saat data dimuat lalu disimpan di `Map` yang di-memo (§4.2) — hitungan milidetik. Yang berbahaya justru menaruh perhitungan di dalam accessor filter, karena itu terulang untuk 2.800 baris **setiap ketikan** di kotak search. Lihat §4 untuk pencegahannya.

---

## 2. Modul Baru: `src/lib/depreciation.ts`

### 2.1 API

```ts
import type { Asset } from '../types/asset';
import { parseCost } from './money';
import { monthsBetween } from './dates';

export type BookValueResult = {
  /** Harga perolehan hasil parse; 0 kalau tidak valid. */
  cost: number;
  /** Akumulasi penyusutan sampai `asOf`. Selalu 0..cost. */
  accumulatedDepreciation: number;
  /** Nilai buku = cost - accumulatedDepreciation. Selalu 0..cost. */
  bookValue: number;
  /** Umur aset dalam bulan penuh sampai `asOf`. */
  ageMonths: number;
  /** Sisa masa manfaat dalam bulan; null kalau masa manfaat unlimited. */
  remainingLifeMonths: number | null;
  /** true kalau aset tidak pernah disusutkan (life unlimited / 0 / tanpa tanggal). */
  isNonDepreciable: boolean;
  /** true kalau bookValue sudah menyentuh 0. */
  isFullyDepreciated: boolean;
};

/** Nilai buku sebuah aset pada tanggal `asOf` (default: sekarang). */
export function computeBookValue(asset: Asset, asOf?: Date): BookValueResult;

/** Total nilai buku sekumpulan aset — untuk footer/KPI. */
export function totalBookValue(assets: Asset[], asOf?: Date): number;
```

### 2.2 Aturan perhitungan

Diterapkan berurutan:

1. **Parse cost** dengan `parseCost(asset.assetCost)` (sudah menangani `"$"`, koma, spasi, string kosong → 0).
2. **Aset non-depresiasi** → `bookValue = cost`, `accumulatedDepreciation = 0`, `isNonDepreciable = true`, jika salah satu terpenuhi:
   - `lifeInMonths` bernilai `"Unlimited"` (case-insensitive) — ini nilai nyata yang bisa disimpan lewat checkbox "Unlimited" di Add/EditAssetModal, jadi **wajib** ditangani. `parseInt("Unlimited")` menghasilkan `NaN`, dan kode lama diam-diam menggantinya dengan `60` bulan — itu salah untuk tanah/aset abadi.
   - `lifeInMonths` kosong, bukan angka, atau `<= 0`.
   - `datePlaceInService` kosong atau bukan tanggal valid (aset belum mulai disusutkan).
3. **Tanggal di masa depan** → `monthsBetween()` sudah mengembalikan 0, jadi `bookValue = cost` secara alami. Tidak perlu cabang khusus.
4. **Hitung `ageMonths`** = `monthsBetween(new Date(datePlaceInService), asOf)`, lalu `effectiveAge = Math.min(ageMonths, life)`.
5. **Terapkan metode** (salvage value diasumsikan **0** — tidak ada field-nya di skema):

   | `depreciationMethod` | Rumus book value |
   | --- | --- |
   | `Straight Line` (default) | `cost * (1 - effectiveAge / life)` |
   | `Declining Balance` | `cost * (1 - 2 / life) ** effectiveAge` (double-declining, basis bulanan) |
   | `Units of Production` | **fallback ke Straight Line** |
   | lainnya / kosong | fallback ke Straight Line |

   Catatan `Units of Production`: metode ini butuh data unit produksi aktual vs kapasitas total, dan **skema tidak menyimpannya** (`assetUnits` adalah jumlah unit fisik aset, bukan output produksi). Fallback ke straight-line adalah pilihan yang jujur dan sama dengan perilaku saat ini di Reports. Ini **harus ditulis sebagai komentar di kode** supaya tidak dikira bug.

   Catatan `Declining Balance`: dengan rumus murni, nilai buku tidak pernah mencapai 0. Karena itu setelah `effectiveAge >= life`, hasilnya dipaksa ke 0 supaya konsisten dengan straight-line dan dengan ekspektasi "habis masa manfaat = nilai buku nol".
6. **Clamp**: `bookValue = Math.min(cost, Math.max(0, bookValue))`. Melindungi dari cost negatif dan dari pembulatan floating-point.
7. `accumulatedDepreciation = cost - bookValue`.

### 2.3 Tabel kasus tepi (harus semuanya benar)

| Kasus | Ekspektasi |
| --- | --- |
| `assetCost = ""` | `bookValue = 0`, UI tampilkan `-` |
| `assetCost = "$1,200.50"` | ter-parse jadi `1200.5` |
| `lifeInMonths = "Unlimited"` | `bookValue = cost` selamanya |
| `lifeInMonths = "0"` / `""` / `"abc"` | `bookValue = cost`, non-depreciable |
| `datePlaceInService = ""` | `bookValue = cost` |
| `datePlaceInService` di masa depan | `bookValue = cost` |
| `ageMonths` tepat = `life` | `bookValue = 0` |
| `ageMonths` > `life` | `bookValue = 0` (tidak negatif) |
| Straight line, umur setengah masa manfaat | `bookValue = cost / 2` |

---

## 3. Perubahan File

Urutan pengerjaan mengikuti urutan di bawah — tiap langkah bisa dicek sendiri.

### Langkah 1 — `src/lib/depreciation.ts` (baru)

Implementasi §2. Tidak menyentuh file lain, tidak ada risiko regresi.

### Langkah 2 — `src/lib/depreciation.test.ts` (baru)

Unit test untuk seluruh tabel §2.3, plus:

- `Declining Balance` menghasilkan nilai **lebih kecil** dari `Straight Line` di pertengahan umur, dan `0` setelah masa manfaat habis.
- `totalBookValue([])` = 0.
- `asOf` yang dikirim eksplisit dipakai (bukan `new Date()`), supaya test deterministik.

Ini satu-satunya bagian dengan logika finansial murni, jadi ini yang paling wajib ditest. Jalankan `npm test`.

### Langkah 3 — `src/components/AssetTable.tsx`

1. Import: `import { computeBookValue } from '../lib/depreciation';`
2. Tambah prop opsional `asOf?: Date` (lihat §4.3) — atau lebih sederhana, terima map hasil hitung dari parent (§4.2). **Rekomendasi: terima `bookValues: Map<string, number>` dari parent**, supaya komponen tabel tetap murni presentasional dan perhitungan tidak berulang antara filter dan render.
3. **Header** — sisipkan `<th>` baru **setelah** `Asset Cost` (baris 44) dan **sebelum** `Date Place in Service` (baris 45):

```tsx
<th className="py-3 px-4 text-xs font-semibold text-on-surface-variant uppercase whitespace-nowrap tracking-wider text-right">Book Value</th>
```

4. **Cell** — sisipkan `<td>` baru setelah cell `assetCost` (baris 91), mengikuti gaya kolom cost (rata kanan, mono, tabular-nums):

```tsx
<td className={cn(
  "py-4 px-4 text-right font-mono tabular-nums",
  bookValue === 0 ? "text-on-surface-variant/60" : "text-on-surface-variant"
)}>
  {asset.assetCost === '' ? '-' : formatCurrency(bookValue)}
</td>
```

   Aset yang sudah habis disusutkan ditampilkan lebih redup — sinyal visual cepat tanpa menambah kolom lagi.

5. **`colSpan` baris kosong** (baris 123): `18` → **`19`**. Gampang terlewat; kalau tidak diubah, baris "no data" tidak akan membentang penuh.

### Langkah 4 — `src/pages/Inventory.tsx`

1. Hitung map book value sekali per perubahan data (§4.2):

```tsx
const asOf = useMemo(() => startOfToday(), []);
const bookValues = useMemo(
  () => new Map(assets.map(a => [a.id, computeBookValue(a, asOf).bookValue])),
  [assets, asOf]
);
```

2. Teruskan ke `<AssetTable bookValues={bookValues} … />`.
3. **CSV export** (`handleExportCSV`, baris 132–149) — tambah key baru **tepat setelah** `'Asset Cost'` agar urutan kolom CSV = urutan kolom tabel:

```ts
'Asset Cost': asset.assetCost,
'Book Value': bookValues.get(asset.id) ?? 0,
'Date Place In Service': asset.datePlaceInService,
```

4. **CSV import** (`handleImportCSV`, baris 220–237) — **tidak diubah.** `Book Value` adalah kolom turunan; kalau ada di file impor, kolom itu diabaikan begitu saja karena `addAsset` hanya membaca key yang dikenal. Perilaku ini sengaja: file hasil export bisa langsung di-import ulang tanpa error, dan tidak ada jalan bagi user untuk memasukkan book value yang bertentangan dengan cost/umur.

#### Kenapa export tetap jalan padahal book value tidak ada di database

`handleExportCSV` **tidak menyentuh Supabase sama sekali**. Sumber datanya `filteredAssets` / `selectedAssets` — array objek `Asset` yang sudah berada di memori browser, hasil fetch `AssetContext` saat halaman dimuat:

```
Supabase (tabel assets) → AssetContext.fromDb() → assets[] di memori
                                                     ↓
                                             computeBookValue()
                                                     ↓
                                           filteredAssets → CSV
```

Pada titik export, field turunan sama tersedianya dengan field tersimpan — keduanya hanya nilai di objek JavaScript. Karena `bookValues` sudah dihitung di poin 1, export tinggal membacanya. Angka di CSV dijamin identik dengan angka di layar karena keduanya membaca map yang sama.

Tiga aturan yang harus dipatuhi supaya file-nya benar:

- **Tulis angka mentah, bukan string terformat.** Gunakan `bookValues.get(asset.id) ?? 0` (misal `1200.5`), **bukan** `formatCurrency(...)` yang menghasilkan `"$1,200.50"`. Ini konsisten dengan `'Asset Cost': asset.assetCost` yang juga mentah, dan membuat Excel/Sheets memperlakukan kolomnya sebagai angka yang bisa di-SUM. Kolom terformat akan terbaca sebagai teks.
- **CSV adalah snapshot per tanggal export.** Book value bergerak tiap bulan, jadi file yang di-export bulan lalu akan berbeda dengan hasil export hari ini untuk aset yang sama — itu benar, bukan bug. Nama file sudah memuat tanggal (`Asset_Inventory_2026-08-26.csv`), jadi konteksnya terbawa. Kalau ingin lebih eksplisit untuk kebutuhan audit, header kolomnya bisa ditulis `Book Value (as of YYYY-MM-DD)` — tapi ini membuat header tidak stabil antar file, jadi **default-nya cukup `Book Value` saja** dan andalkan nama file.
- **Round-trip aman.** Export → import kembali tetap berhasil: kolom `Book Value` diabaikan saat impor (poin 4), sehingga tidak ada risiko book value hasil edit manual di Excel masuk ke database dan bertentangan dengan `assetCost`/`lifeInMonths`.

### Langkah 5 — `src/lib/reports/buildDepreciationReport.ts` (konsolidasi)

Ganti dua blok perhitungan manual dengan `computeBookValue(a, q.endDate)` dan `computeBookValue(a, end)`:

```ts
const totalValue = filteredAssets.reduce(
  (sum, a) => sum + computeBookValue(a, q.endDate).bookValue, 0
);
```

```ts
detailData: filteredAssets.map(a => {
  const { cost, accumulatedDepreciation, bookValue, remainingLifeMonths } = computeBookValue(a, end);
  return {
    assetNumber: a.assetNumber,
    description: a.assetDescription,
    cost,
    accumulatedDepreciation,
    netBookValue: bookValue,
    remainingLifeMonths: remainingLifeMonths ?? 0,
  };
}),
```

**Perubahan perilaku yang disengaja** (harus disebut di commit message):

- Aset `Unlimited` / tanpa masa manfaat tidak lagi dipaksa memakai default 60 bulan → nilai bukunya tetap penuh. Ini perbaikan bug.
- Aset `Declining Balance` sekarang benar-benar dihitung declining balance → angka laporan bisa berubah untuk aset tersebut.

Jalankan `src/pages/Reports.test.tsx` setelah perubahan ini; kalau ada assertion angka yang bergeser, itu memang efek perbaikan di atas dan angka harapannya yang perlu diperbarui — bukan logikanya yang dikembalikan.

---

## 4. Performa & Ketepatan Waktu Evaluasi

### 4.1 Masalahnya

`filteredAssets` di `useAssetFilters` mengevaluasi setiap accessor untuk **setiap baris** pada **setiap perubahan filter/ketikan**. Dataset didesain sampai 5000 baris (batas impor). Kalau `computeBookValue` dipanggil langsung di dalam accessor, tiap ketikan di kotak search memicu 5000 kali konstruksi `Date` + perhitungan.

### 4.2 Solusi: hitung sekali, simpan di `Map`

Map `assetId → bookValue` di-`useMemo` terhadap `[assets, asOf]`. Filter dan tabel sama-sama membaca map yang sama. Perhitungan hanya berulang saat data aset benar-benar berubah, bukan saat mengetik.

### 4.3 `asOf` harus stabil

`new Date()` menghasilkan nilai baru tiap render — kalau dipakai langsung sebagai dependency `useMemo`, memoization-nya tidak pernah kena. Karena itu `asOf` dipatok ke **awal hari ini**:

```ts
// src/lib/dates.ts
/** Tengah malam hari ini — nilai stabil untuk dependency useMemo. */
export function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
```

Book value bergerak dalam satuan bulan, jadi presisi per hari lebih dari cukup dan nilai `asOf` konstan selama sesi.

---

## 5. Filter Book Value (opsional, fase 2)

Infrastruktur `numberRange` di `useListFilters` sudah lengkap (URL sync, chips, clear) — menambah filter book value hanya butuh tiga sentuhan kecil:

1. `src/hooks/useAssetFilters.ts` — tambah def setelah filter `cost`:

```ts
{ kind: 'numberRange', key: 'bookValue', label: 'Book Value', accessor: (a) => bookValueOf(a) },
```

   `useAssetFilters` perlu menerima map book value dari pemanggil (atau menghitungnya sendiri dengan `useMemo` yang sama), lalu mengekspor `bookValueMin/Max` + setter-nya mengikuti pola `costMin/costMax` (baris 55–58).

2. `src/components/AssetFilters.tsx` — duplikat blok input min/max cost (baris 132–148) dengan placeholder `Min book value` / `Max book value`.

3. `src/pages/Inventory.tsx` — teruskan props baru dan tambahkan ke pengecekan `noFilters` di `handleConfirmDeleteSelected` (baris 282). **Ini yang paling mudah terlewat**: kalau lupa, user yang memfilter dengan book value lalu memilih semua dan menghapus akan memicu jalur `deleteAllAssets` — menghapus seluruh aset, bukan hanya yang terfilter.

Kalau fase 2 dikerjakan, tambahkan test di `src/hooks/useAssetFilters.test.ts` mengikuti pola test filter cost yang ada.

---

## 6. Turunan Lain (opsional, fase 3)

- **KPI dashboard "Total Book Value"** — `totalBookValue(assets)` di `useDashboardMetrics`, ditampilkan di `DashboardKpiRow` di sebelah total valuation. Berguna karena "Total Valuation" saat ini memakai harga perolehan, yang selalu melebih-lebihkan nilai riil.
- **`DashboardRecentAssetsPanel.tsx`** — tabel ringkas ini juga menampilkan cost; kolom book value bisa ditambahkan dengan pola yang sama.
- **`buildValuationReport.ts`** — bisa ditawarkan opsi basis "cost" vs "book value".

Ketiganya tidak diperlukan untuk permintaan awal dan sebaiknya dikerjakan terpisah.

---

## 7. Checklist Verifikasi

Status per 2026-08-26 — Langkah 1–5 (§3) sudah dieksekusi dan dicek dengan `npm test` + `npx tsc --noEmit`, bukan dengan menjalankan app di browser. Item yang butuh verifikasi manual (browser, Supabase) ditandai jelas di bawah.

- [ ] Query audit data existing (§1.3) sudah dijalankan dan hasilnya dinilai sebelum rilis. — **terblokir**: project Supabase `ousbnycezagukyxzavmi` masih INACTIVE, query belum bisa dijalankan.
- [x] `npm test` hijau (termasuk `depreciation.test.ts` baru). — 63/63 test lulus, termasuk 17 test baru di `depreciation.test.ts`.
- [x] `npx tsc --noEmit` bersih.
- [x] Kolom **Book Value** muncul persis di antara Asset Cost dan Date Place in Service. — diverifikasi dari kode (`AssetTable.tsx`), belum dilihat visual di browser.
- [x] Aset baru (tanggal hari ini) → book value ≈ asset cost. — dicakup unit test (kasus `ageMonths = 0`).
- [x] Aset dengan `lifeInMonths = Unlimited` → book value = asset cost, tidak menyusut. — dicakup unit test.
- [x] Aset yang umurnya melewati masa manfaat → `$0.00`, ditampilkan redup. — nilai `$0.00` dicakup unit test; styling redup diverifikasi dari kode, belum dilihat visual.
- [x] Aset tanpa asset cost → `-`. — dicakup unit test (`cost = 0`) + kode tampilan di `AssetTable.tsx`.
- [x] Baris kosong ("no asset data") membentang penuh selebar tabel (`colSpan={19}`). — diverifikasi dari kode.
- [x] Export CSV memuat kolom `Book Value` setelah `Asset Cost`. — diverifikasi dari kode (`Inventory.tsx`), belum dicoba export file sungguhan.
- [ ] Import CSV hasil export tadi tetap berhasil tanpa error. — belum dicoba round-trip manual.
- [x] Angka Book Value di Inventory = Net Book Value di Reports → Depreciation untuk aset yang sama pada tanggal yang sama. — dijamin oleh refactor §3 Langkah 5 (satu modul `computeBookValue` dipakai keduanya); `Reports.test.tsx` diupdate dan lulus.
- [ ] Mengetik di kotak search tetap responsif dengan dataset besar. — belum diuji performa dengan dataset besar.

---

## 8. Catatan untuk Masa Depan

Kalau nanti akuntansi meminta hal-hal berikut, book value harus naik pangkat jadi kolom database:

- **Salvage value / nilai residu** — butuh field baru; rumus berubah jadi `cost - (cost - salvage) * age/life`.
- **Impairment / revaluasi manual** — butuh `book_value_override` + tanggal + alasan, dan aturan "override menang atas hasil hitung".
- **Penyusutan yang dibekukan saat aset berstatus Retired/Broken** — saat ini `status` tidak memengaruhi perhitungan sama sekali; aset Retired tetap menyusut. Ini perlu dikonfirmasi ke sisi akuntansi sebelum diubah.

Selama ketiganya belum dibutuhkan, pendekatan computed di rencana ini adalah yang paling murah dan paling kecil kemungkinan salahnya.
