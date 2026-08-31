# Bulk Edit — Asset Inventory

Rencana implementasi fitur **bulk edit** untuk halaman Asset Inventory, mencakup 5 field:
`Depreciation Method`, `Listed`, `Status`, `Item Status`, `Verification`.

`Verification` **masuk scope**, dengan aturan tetap: `verification_date` tidak pernah diisi user —
`Yes` menstempel **tanggal hari ini**, `No` mengosongkannya. Tidak ada date picker di bulk edit.
Konsekuensinya di §2.4, aturan saling-eksklusif dengan `Item Status` di §2.6.

Status: **Tahap 1 selesai diimplementasikan** (Depreciation Method, Listed, Status). Tahap 2
(Item Status, Verification) masih **rencana**, menunggu Opsi 1 di
[`reclassification trigger fix.md`](./reclassification%20trigger%20fix.md).
Tanggal: 2026-08-31.

> ## ⚠️ Baca dulu: urutan pengerjaan
>
> Dari 5 field di atas, **dua bersentuhan dengan trigger sync `assets` ⇄ `asset_reclassifications`:
> `Item Status` dan `Verification`.** Tiga field lain tidak muncul di klausa `WHEN` trigger mana
> pun — mengubahnya tidak memicu apa-apa.
>
> Karena itu rencana ini dibelah dua:
>
> | Tahap | Isi | Prasyarat |
> |---|---|---|
> | **1** ✅ | `Depreciation Method`, `Listed`, `Status` | tidak ada — **selesai diimplementasikan** |
> | **2** | `Item Status`, `Verification` | Opsi 1 di [`reclassification trigger fix.md`](./reclassification%20trigger%20fix.md) sudah di-apply |
>
> Alasannya bukan kerapian — kedua field itu rusak hari ini, dengan cara yang berbeda:
>
> - **`Item Status`** — Opsi 1 membaca `NEW.verification` **langsung** alih-alih menyimpulkannya
>   dari `category`, sehingga seluruh keterkaitan Item Status ⇄ Verification hilang untuk setiap
>   nilai selain `'Needs Review'`. Mengerjakannya lebih dulu berarti menulis §2.2 A, panel
>   hitungan Item Status di §4 Fase 4, dan `refetch()` — lalu **membuang semuanya** begitu
>   Opsi 1 masuk.
> - **`Verification`** — writeback trigger menimpa `assets.item_status` dengan `'Asset'` (saat
>   `Yes`) atau `'Needs Review'` (saat `No`), padahal kolom itu tidak ada di patch (§2.2 B).
>   Ini **tidak bisa dimitigasi dari front-end**: yang bisa dilakukan modal hanyalah memberi tahu
>   label mana saja yang akan hilang sebelum user menekan Apply. Opsi 1 menghapusnya di level
>   database.
>
> Setelah Opsi 1 masuk, dua keputusan di bawah ini **tetap berlaku** tapi alasannya bergeser:
>
> - §2.5 (`'Needs Review'` tidak ditawarkan sebagai Item Status) — alasannya jadi **lebih kuat**,
>   bukan lebih lemah: sesudah Opsi 1 aksi itu berjalan penuh, dan jalur yang benar untuk
>   mengembalikan aset ke antrean sudah tersedia sebagai `Verification = No` di modal yang sama.
>   Satu aksi, satu kontrol.
> - §2.6 (Verification ⇄ Item Status saling eksklusif) — **boleh ditinjau ulang**. Opsi 1 membuat
>   kombinasi keduanya deterministik dan kedua input bertahan di `assets`, jadi larangannya
>   berubah dari keharusan teknis jadi pilihan UX.
>
> Bagian di bawah ini ditulis untuk keadaan **sebelum** Opsi 1, jadi tetap lengkap dan bisa
> dijalankan apa adanya kalau Tahap 2 memang harus rilis lebih dulu.

---

## 1. Ringkasan

User memilih beberapa aset lewat checkbox di `AssetTable`, menekan tombol **Edit Selected (N)**
di `AssetToolbar`, lalu mengisi modal bulk edit. Hanya field yang di-*enable* (dicentang) di
modal yang ikut di-update; field lain dibiarkan apa adanya per baris. Update dikirim ke Supabase
dalam batch 100 ID, dengan progress modal, lalu di-log ke `activity_logs`.

### Keputusan yang sudah disepakati

| Topik | Keputusan |
|---|---|
| Scope target | Hanya baris yang dicentang (`selectedAssets`). Checkbox header sudah otomatis memilih seluruh hasil filter, jadi kasus "semua yang terfilter" tetap tercakup. |
| `Verification` | **Masuk bulk edit** sebagai radio `Yes`/`No`. |
| `verification_date` | **Tidak punya kontrol sendiri.** `Yes` → tanggal hari ini; `No` → dikosongkan. Sama seperti perilaku `EditAssetModal` hari ini (`handleVerificationChange`), jadi tidak ada aturan baru yang harus dipelajari user. |
| Baris yang sudah di nilai target | **Tidak disentuh sama sekali.** Bulk `Verification = Yes` hanya meng-UPDATE baris yang saat ini `No`, dan sebaliknya. Ini yang menjaga `verification_date` asli aset yang sudah terverifikasi supaya tidak tertimpa tanggal bulk edit — lihat §2.4. |
| `Verification` ⇄ `Item Status` | **Saling eksklusif di modal.** Keduanya menulis kolom `category` yang sama lewat trigger; mengirim keduanya dalam satu statement membuang salah satu input — §2.2 C dan §2.6. |
| `Item Status = 'Needs Review'` | **Tidak ditawarkan di bulk edit.** Alasannya sekarang teknis, bukan kebijakan: lewat Item Status aksi itu **tidak berjalan** (§2.2 A baris 4), sementara jalur yang benar — `Verification = No` — sudah ada di modal yang sama. Lihat §2.5. |
| Trigger reclassification | **Dibiarkan jalan**, dengan panel dampak eksplisit di modal. Tidak ada migrasi bypass. |
| Eksekusi backend | **Batch update dari client**, mengikuti pola `deleteMultipleAssets` (`.in('id', batch)`, batch 100). |

---

## 2. Temuan backend (penting)

### 2.1 Tidak ada migrasi skema yang dibutuhkan

Kelima field sudah ada sebagai kolom di tabel `assets`:

| Field UI | Kolom DB | Tipe |
|---|---|---|
| Depreciation Method | `depreciation_method` | TEXT |
| Listed | `listed` | TEXT |
| Status | `status` | TEXT |
| Item Status | `item_status` | TEXT NOT NULL DEFAULT '' |
| Verification | `verification` | BOOLEAN NOT NULL DEFAULT false |

Satu kolom lagi ditulis bulk edit **tanpa punya kontrol di modal** — nilainya diturunkan dari
`Verification`:

| Kolom DB | Tipe | Diisi dengan |
|---|---|---|
| `verification_date` | DATE (nullable) | `Verification = Yes` → tanggal hari ini; `No` → `NULL` |

RLS untuk UPDATE pada `assets` sudah aktif dan dipakai `updateAsset()` hari ini, jadi tidak
ada policy baru. `activity_logs.action_type` bertipe TEXT **tanpa CHECK constraint**
(`supabase/migrations/20260701000000_create_activity_logs.sql`), jadi menambah action type
baru `BULK_UPDATE` tidak butuh migrasi.

> **Kesimpulan: fitur ini murni perubahan front-end. Nol file migrasi baru.**

### 2.2 Trigger cascade — risiko utama fitur ini

Dua dari lima field — `item_status` dan `verification` — terikat **dua arah** dengan
`asset_reclassifications`, lewat kolom `category` yang sama. Konsekuensinya bukan sekadar "ada
baris lain yang ikut berubah": **masing-masing field ikut menulis kolom milik field yang lain,
dan mengirim keduanya sekaligus membuang salah satu input user.**

#### Trigger yang aktif hari ini

Penting: `20260815020000_unify_reclassification_category_with_verification.sql` **men-drop**
`trg_auto_queue_asset_for_reclassification_*` beserta fungsinya, dan `20260817000000` men-drop
kolom `asset_reclassifications.verified`. Jadi yang benar-benar hidup sekarang hanya 4 trigger:

Pada `assets` (AFTER UPDATE, di luar `trg_assets_updated_at` yang BEFORE):

| Trigger | WHEN | Efek |
|---|---|---|
| `trg_sync_category_from_asset_item_status` | `OLD.item_status IS DISTINCT FROM NEW.item_status` | UPDATE `category` baris yang masih `'Needs Review'`; INSERT baris baru bila aset belum punya baris sama sekali |
| `trg_sync_category_from_asset_verification_update` | `OLD.verification IS DISTINCT FROM NEW.verification` | `false` → set baris terakhir jadi `'Needs Review'` (atau INSERT bila belum ada); `true` → set baris `'Needs Review'` jadi `'Asset'` |

**Kedua trigger sekarang bisa dipicu bulk edit** — trigger pertama oleh field `Item Status`,
trigger kedua oleh field `Verification`. Inilah perbedaan terbesar dari draft yang mengeluarkan
Verification dari scope: dulu hanya satu jalur cascade yang aktif, sekarang dua, dan keduanya
bermuara di kolom `category` yang sama.

Pada `asset_reclassifications` (AFTER INSERT/UPDATE), keduanya memanggil
`sync_asset_verification_from_category()` yang **menulis balik ke `assets`**:

```sql
UPDATE assets
SET verification      = (NEW.category <> 'Needs Review'),
    verification_date = CASE WHEN NEW.category <> 'Needs Review' THEN CURRENT_DATE ELSE NULL END,
    item_status       = NEW.category          -- <- ditambahkan oleh 20260818000000
WHERE id = NEW.asset_id;
```

Baris `item_status = NEW.category` inilah sumber semua kejutan di bawah: apa pun yang
menyentuh `category`, akan menimpa `assets.item_status` **dan** `assets.verification`.

#### Aturan yang dimaksudkan desain

`Verification` bukan field independen — ia **turunan dari Item Status**. Aturannya ditulis
eksplisit di header migrasi `20260815020000`:

```
--   category = 'Needs Review' <-> verification = false
--   category = anything else  <-> verification = true
```

Dua hal yang sering salah dibaca dari aturan ini:

1. **Bukan** "`Asset` dan `Inventory` → Yes". Yang benar: **apa pun selain `'Needs Review'` → Yes.**
   `item_statuses` memang di-seed dengan tiga nilai (`Asset`, `Inventory`, `Needs Review`), tapi
   `AutocompleteInput` mengizinkan nilai baru dan `addItemStatus` menyimpannya ke tabel lookup.
   Jadi Item Status kustom apa pun — `'Lost'`, `'Pending Audit'`, salah ketik — ikut menandai
   aset **Verified**. Perbandingannya `<> 'Needs Review'`, bukan daftar putih.
2. Aturan itu **tidak berlaku dua arah dengan sempurna**. Lihat kasus A di bawah.

#### Konsekuensi konkret

**A. Arah `→ Needs Review` tidak berjalan — aset verified tidak bisa di-unverify lewat Item Status**

Ini yang paling penting untuk bulk edit, dan bertentangan dengan aturan di atas.

`sync_category_from_asset_item_status()` hanya menyentuh baris reclassification yang
**sudah** `'Needs Review'`:

```sql
UPDATE asset_reclassifications
SET category = NEW.item_status, updated_at = NOW()
WHERE asset_id = NEW.id AND category = 'Needs Review';   -- <- guard-nya di sini
```

Untuk aset yang sudah verified (`category = 'Asset'`), set `item_status = 'Needs Review'`
tidak cocok dengan `WHERE`-nya → 0 baris ter-update. Blok `IF NOT EXISTS` juga tidak jalan
karena barisnya ada. Jadi **tidak ada yang terjadi**: tidak ada penulisan balik, `verification`
tetap `true`.

Hasil akhirnya inkonsisten di tiga tempat sekaligus:

| Kolom | Nilai |
|---|---|
| `assets.item_status` | `'Needs Review'` |
| `assets.verification` | `true` ← seharusnya `false` |
| `asset_reclassifications.category` | `'Asset'` ← tidak berubah |

Aset itu **tidak kembali ke antrean Needs Review** di halaman Reclassification, padahal
Item Status-nya di Asset Inventory sudah bertuliskan `Needs Review`.

**Tabel perilaku lengkap bulk `Item Status`:**

| Kondisi aset | Set ke | `item_status` | `verification` | `reclass.category` | Sesuai aturan? |
|---|---|---|---|---|---|
| Unverified (`category='Needs Review'`) | `Asset`/`Inventory`/kustom | nilai baru | `false` → **`true`**, `date` = hari ini | nilai baru | ✅ ya |
| Unverified | `Needs Review` | tetap | tetap `false` | tetap | ✅ ya (no-op) |
| Verified (`category` ≠ `'Needs Review'`) | `Asset`/`Inventory`/kustom | nilai baru | tetap `true`, tanggal **tidak** di-stempel ulang | **tidak berubah** → desync | ⚠️ sebagian |
| Verified | **`Needs Review`** | `'Needs Review'` | **tetap `true`** | tidak berubah | ❌ **tidak** |

Baris pertama adalah perilaku yang benar dan memang diinginkan: memberi Item Status pada aset
yang belum diperiksa = menyatakan aset itu sudah diperiksa. Baris keempat adalah bug.

> Baris keempat inilah alasan `'Needs Review'` tidak ditawarkan sebagai pilihan Item Status
> (§2.5). Sejak `Verification = No` masuk modal, tidak ada lagi yang hilang dari user: jalur
> yang **berjalan benar** untuk mengembalikan aset ke antrean review ada di field sebelahnya.

**B. Bulk `Verification` menimpa `Item Status` — kolom yang tidak ada di patch**

Ini kebalikan arah dari kasus A, dan konsekuensi terbesar dari memasukkan Verification ke scope.

`Verification = Yes` pada aset yang saat ini unverified:

1. `UPDATE assets SET verification = true, verification_date = <hari ini>`
2. `trg_sync_category_from_asset_verification_update` → cabang ELSE:
   `UPDATE asset_reclassifications SET category = 'Asset' WHERE asset_id = NEW.id AND category = 'Needs Review'`
3. Writeback `sync_asset_verification_from_category()` →
   `UPDATE assets SET verification = true, verification_date = CURRENT_DATE, item_status = 'Asset'`

Perhatikan `'Asset'` di langkah 2: nilainya **hard-coded**, bukan diambil dari `assets.item_status`.
Jadi aset unverified yang Item Status-nya `'Inventory'` atau nilai kustom (`'Lost'`,
`'Pending Audit'`) **kehilangan label itu** dan berubah jadi `'Asset'` — padahal user hanya
menekan tombol verifikasi.

`Verification = No` bekerja simetris lewat cabang IF: baris reclassification terakhir di-set
`'Needs Review'`, dan writeback menulis `item_status = 'Needs Review'` + `verification_date = NULL`.
Untuk bulk 300 baris, ini menghapus 300 label Item Status sekaligus, dan nilai lamanya **tidak
bisa direkonstruksi** — `activity_logs` hanya menyimpan `count` + daftar nama field.

| Aksi bulk | `verification` | `verification_date` | `item_status` (tidak diminta user) |
|---|---|---|---|
| `Yes` pada aset unverified | `true` | hari ini | **ditimpa `'Asset'`** |
| `Yes` pada aset yang sudah verified | tidak disentuh (§1) | tidak disentuh | tidak berubah |
| `No` pada aset verified | `false` | `NULL` | **ditimpa `'Needs Review'`** |
| `No` pada aset yang sudah unverified | tidak disentuh (§1) | tidak disentuh | tidak berubah |

Baris 2 dan 4 kosong karena keputusan "baris yang sudah di nilai target tidak disentuh" di §1 —
tanpa aturan itu, `Yes` pada aset yang sudah verified akan menstempel ulang `verification_date`
dengan tanggal hari ini dan menghapus tanggal pemeriksaan aslinya.

Ini **Cacat B** di [`reclassification trigger fix.md`](./reclassification%20trigger%20fix.md),
dan Opsi 1 di sana menghapusnya: `'Needs Review'` diperlakukan murni sebagai sentinel verifikasi
dan berhenti menghapus `item_status`. Sampai itu masuk, satu-satunya yang bisa dilakukan
front-end adalah **memberi tahu label mana saja yang akan hilang** sebelum Apply (§4 Fase 4).

*Konvergensi:* langkah 3 mengubah `item_status`, jadi ia memicu
`trg_sync_category_from_asset_item_status`. Untuk `Yes`, `WHERE category = 'Needs Review'` tidak
lagi cocok (sudah `'Asset'`) → 0 baris → berhenti. Untuk `No`, barisnya cocok dan di-UPDATE ulang
dengan nilai yang sama, lalu writeback menulis nilai identik → kedua klausa `WHEN` jadi false →
berhenti. Rantainya konvergen, tapi tiap baris memicu 4–6 statement tambahan — alasan tambahan
batch tetap 100.

**C. `Verification` + `Item Status` dalam satu statement → salah satu input dibuang**

Kedua trigger `assets` antre pada UPDATE yang sama dan jalan berurutan menurut **urutan alfabet
nama trigger**: `trg_sync_category_from_asset_item_status` sebelum
`trg_sync_category_from_asset_verification_update`. Keduanya membaca snapshot `NEW` dari
statement asli, jadi trigger kedua **tidak melihat** writeback trigger pertama.

| Input user (aset unverified) | Jalannya | Hasil akhir |
|---|---|---|
| `Verification = Yes` + `Item Status = 'Inventory'` | trigger item_status set `category = 'Inventory'` → writeback `verification = true`, `item_status = 'Inventory'`. Trigger verification lalu mencari `category = 'Needs Review'` → 0 baris | ✅ kedua input bertahan — **secara kebetulan** |
| `Verification = No` + `Item Status = 'Inventory'` | trigger item_status set `category = 'Inventory'` → writeback mem-*flip* `verification` jadi `true`. Trigger verification lalu set `category = 'Needs Review'` → writeback `verification = false`, `item_status = 'Needs Review'` | ❌ `'Inventory'` yang diketik user **dibuang** |

Baris kedua memang kombinasi yang kontradiktif secara semantik, tapi UI tidak melarangnya dan
user tidak diberi tahu inputnya hilang. Yang lebih penting: baris **pertama** pun benar hanya
karena `i` < `v` dalam nama trigger. Urutan alfabet bukan kontrak — mengganti nama trigger
membalikkan hasilnya.

Karena itu mitigasinya bukan validasi kombinasi, melainkan **saling eksklusif** (§2.6): satu
modal, satu jalur menulis `category`.

**D. `.select()` mengembalikan nilai basi**

`.select()` di supabase-js = `UPDATE ... RETURNING`. RETURNING dievaluasi saat baris ditulis,
sedangkan AFTER ROW trigger baru jalan di akhir statement. Jadi penulisan balik di poin A dan B
**tidak terlihat** di hasil `.select()` — termasuk `item_status` yang baru saja ditimpa trigger.
Tanpa penanganan, tabel Inventory akan menampilkan nilai yang berbeda dari isi database sampai
user refresh manual.

#### Mitigasi yang diambil

- **`Verification` dan `Item Status` saling eksklusif di modal** (§2.6). Menutup kasus C
  sepenuhnya — tidak ada patch yang bisa memicu kedua trigger sekaligus.
- **`'Needs Review'` dikeluarkan dari pilihan Item Status** (§2.5). Menutup baris keempat tabel
  kasus A — satu-satunya baris yang perilakunya salah — dan sekarang tanpa biaya bagi user,
  karena jalur yang benar (`Verification = No`) ada di modal yang sama.
- **Baris yang sudah berada di nilai Verification target tidak di-UPDATE sama sekali** (§1).
  Menutup penstempelan ulang `verification_date` pada aset yang sudah terverifikasi — kekhawatiran
  jejak audit di §2.4.
- **Panel dampak, bukan sekadar warning.** Untuk `Item Status`: aturan turunannya dinyatakan apa
  adanya plus hitungan riil aset yang akan berubah status verifikasinya. Untuk `Verification`:
  hitungan baris yang benar-benar berubah **plus daftar nilai Item Status yang akan hilang**
  (kasus B). Detail salinannya di §4 Fase 4.
- **`refetch()` wajib** setelah batch selesai bila patch menyentuh `itemStatus` **atau**
  `verification` (kasus D).
- Batch tetap 100 — tiap baris memicu rantai 4–6 statement tambahan; batch besar menaikkan
  risiko statement timeout.

> Kasus A, B, dan C bukan efek yang bisa dibereskan di front-end — semuanya berasal dari trigger.
> Perbaikan akarnya sudah dirancang sebagai Opsi 1 di
> [`reclassification trigger fix.md`](./reclassification%20trigger%20fix.md) (Cacat A, B, C di
> sana). Mitigasi di atas adalah yang bisa dilakukan **sebelum** migrasi itu masuk; sesudahnya,
> kasus A, B, dan C hilang di level database dan panel dampaknya menyusut jadi hitungan biasa.

### 2.3 Catatan verifikasi

Project Supabase `ousbnycezagukyxzavmi` sedang berstatus `INACTIVE` (paused) saat rencana ini
ditulis, sehingga trigger/RLS **tidak bisa diverifikasi langsung terhadap database live**.
Seluruh analisis di atas berasal dari file `supabase/migrations/`. Sebelum implementasi,
jalankan sekali:

```sql
select tgname, pg_get_triggerdef(oid)
from pg_trigger
where not tgisinternal
  and tgrelid in ('assets'::regclass, 'asset_reclassifications'::regclass);
```

untuk memastikan tidak ada trigger tambahan yang dibuat manual lewat dashboard, dan bahwa
`trg_auto_queue_asset_for_reclassification_*` memang sudah tidak ada.

Khusus kasus A, verifikasi empirik pada satu baris uji sebelum bergantung pada analisisnya —
pakai aset yang **belum terverifikasi**:

```sql
-- harapan: verification berubah false -> true dan verification_date terisi hari ini,
-- padahal statement hanya menyentuh item_status
select verification, verification_date, item_status from assets where id = '<id-uji>';
update assets set item_status = 'Inventory' where id = '<id-uji>';
select verification, verification_date, item_status from assets where id = '<id-uji>';
```

Khusus kasus B, verifikasi arah sebaliknya pada satu aset **unverified yang Item Status-nya
sudah terisi** — ini yang membuktikan apakah bulk `Verification` benar-benar menghapus label
Item Status:

```sql
-- harapan: item_status berubah 'Inventory' -> 'Asset', padahal statement tidak menyentuhnya
update assets set item_status = 'Inventory' where id = '<id-uji-2>';   -- siapkan label
update assets set verification = true, verification_date = CURRENT_DATE where id = '<id-uji-2>';
select verification, verification_date, item_status from assets where id = '<id-uji-2>';
```

Kalau `item_status` ternyata bertahan `'Inventory'`, berarti Opsi 1 sudah masuk lebih dulu dan
seluruh panel dampak Verification di §4 Fase 4 boleh disederhanakan.

### 2.4 `Verification` di dalam scope — yang dijaga dan yang tidak

Verification bukan sekadar kolom data. Ia menandai bahwa **seseorang benar-benar memeriksa aset
itu**, dan ia menggerakkan alur kerja user: aset unverified muncul di antrean Reclassification
sebagai `'Needs Review'`, dan hilang dari antrean begitu diverifikasi. Mengubahnya untuk ratusan
baris lewat satu klik punya tiga konsekuensi. Dua bisa dimitigasi di fitur ini, satu tidak.

**1. Jejak audit — dimitigasi sebagian.**
Kekhawatirannya: `verification_date` berisi tanggal bulk edit, bukan tanggal pemeriksaan fisik,
dan tidak ada cara membedakan keduanya setelah tersimpan. Yang dilakukan rencana ini:

- **Baris yang sudah berada di nilai target tidak disentuh** (§1). Bulk `Yes` hanya meng-UPDATE
  aset yang saat ini `No`. Artinya `verification_date` sebuah aset yang sudah terverifikasi
  **tidak pernah tertimpa** oleh bulk edit — hanya aset yang memang baru berpindah status yang
  mendapat tanggal hari ini. Ini menghapus mode kegagalan yang paling merusak: kehilangan
  tanggal pemeriksaan asli.
- `activity_logs` mencatat `BULK_UPDATE` + `count` + daftar field, jadi ada jejak bahwa perubahan
  itu massal.

Yang **tidak** terpecahkan: untuk satu baris tertentu, `assets` sendiri tetap tidak bisa
membedakan "diverifikasi lewat pemeriksaan fisik" dari "diverifikasi lewat bulk edit". Pembedanya
hanya ada di `activity_logs`, dan itu korelasi berdasarkan waktu, bukan atribusi per baris.
Pemecahan sebenarnya adalah kolom `verification_source` — tetap **di luar scope**, lihat §7.

**2. Antrean kerja bergerak masif — dimitigasi.**
Bulk `No` melempar ratusan aset ke antrean Needs Review; bulk `Yes` mengosongkan antrean.
Mitigasinya adalah panel dampak dengan **hitungan riil** sebelum Apply (§4 Fase 4): berapa aset
yang benar-benar berpindah status, berapa yang tidak disentuh, dan — selama Opsi 1 belum masuk —
nilai Item Status mana saja yang akan hilang (§2.2 B). User melihat angka, bukan peringatan
umum.

**3. Tidak ada undo — tidak dimitigasi.**
Nilai `verification_date` sebelumnya hilang permanen untuk baris yang memang berubah, dan
`item_status` yang ditimpa trigger (§2.2 B) juga tidak bisa direkonstruksi dari `activity_logs`.
Satu-satunya jaring pengaman adalah Export Selected ke CSV sebelum Apply — disarankan di §6,
tapi bukan sesuatu yang dipaksakan fitur ini.

> **Jangan salah baca poin 1.** Aturan "baris yang sudah di nilai target tidak disentuh" bukan
> optimasi performa, dan bukan detail implementasi yang boleh disederhanakan belakangan. Ia
> satu-satunya hal yang membuat bulk `Verification = Yes` aman dijalankan pada seleksi campuran.
> Kalau ia dihapus, seluruh riwayat tanggal verifikasi dari baris yang sudah terverifikasi
> tertimpa tanggal hari ini dalam satu klik. Test #14 dan #15 di §5 yang menguncinya.

### 2.5 `'Needs Review'` tidak ditawarkan sebagai pilihan Item Status

Alasan keputusan ini **berubah** sejak Verification masuk scope. Dulu alasannya kebijakan:
`Item Status = 'Needs Review'` identik dengan `Verification = No`, jadi mengizinkannya sama saja
membuka bulk un-verify lewat pintu belakang. Sekarang bulk un-verify memang tersedia — jadi yang
tersisa adalah dua alasan teknis, dan keduanya lebih kuat:

1. **Lewat Item Status, aksi itu tidak berjalan.** Untuk aset yang sudah verified, kasus A baris
   keempat: label berubah, `verification` tetap `true`, aset tidak kembali ke antrean.
2. **Jalur yang berjalan benar ada di modal yang sama.** `Verification = No` memicu cabang IF
   `sync_category_from_asset_verification()` yang justru dirancang untuk ini. Menawarkan dua
   kontrol untuk satu aksi, yang satu rusak, tidak ada gunanya.

Maka pilihan Item Status di bulk edit **hanya nilai selain `'Needs Review'`**:

```ts
// 'Needs Review' lewat Item Status tidak meng-unverify aset yang sudah verified
// (kasus A baris 4). Jalur yang benar adalah field Verification = No di modal yang sama.
// Lihat "bulk edit asset inventory.md" §2.5.
const bulkItemStatusOptions = itemStatuses.filter(s => s !== 'Needs Review');
```

> **Alternatif yang ditolak:** menawarkan `'Needs Review'` disertai warning. Ditolak karena
> perilakunya saat ini setengah jalan (kasus A) — user akan melihat Item Status berubah tapi
> aset tidak kembali ke antrean, dan warning apa pun tidak memperbaiki itu. Sesudah Opsi 1 aksi
> itu berjalan penuh, tapi saat itu ia jadi **duplikat persis** dari `Verification = No`, jadi
> keputusan §2.5 tetap sama dengan alasan berbeda: satu aksi, satu kontrol.

### 2.6 `Verification` dan `Item Status` saling eksklusif

Dari kasus C: keduanya menulis kolom `category` yang sama lewat dua trigger yang berbeda, dan
hasilnya bergantung pada urutan alfabet nama trigger. Modal karena itu **menonaktifkan yang satu
begitu yang lain dicentang** — bukan memvalidasi kombinasinya, karena kombinasi yang "benar" pun
benar secara kebetulan.

Aturan ini juga jujur secara konseptual, bahkan setelah Opsi 1: satu aset punya **satu** posisi
di `asset_reclassifications`, dan dua field ini adalah dua cara menuliskannya. Meminta user
memilih salah satu bukan batasan teknis yang bocor ke UI — itu memang bentuk datanya.

Implementasinya di §4 Fase 4 (`toggleField`). Sesudah Opsi 1 masuk, larangan ini boleh ditinjau
ulang sebagai pilihan UX, bukan keharusan — lihat kotak di awal dokumen.

---

## 3. Perubahan file

> **Tahap 1 (bagian bawah tabel ini) sudah diimplementasikan** dengan scope 3 field
> (`Depreciation Method`, `Listed`, `Status`) — bukan 5. `AssetBulkPatch`, `toDbPatch`, dan
> `bulkUpdateAssets` sengaja dibuat lebih sederhana dari draft di §4 di bawah: satu pass update
> (tidak ada pemisahan `verificationIds`), tidak ada `refetch()` wajib, karena tidak ada field
> yang menyentuh trigger cascade (§2.2). `BulkEditModal` juga tidak punya logika saling-eksklusif
> atau panel dampak — itu baru relevan begitu `Item Status`/`Verification` masuk di Tahap 2.
> Test integrasi khusus bulk edit (baris terakhir tabel) **belum ditambahkan** — diverifikasi
> manual di browser, bukan lewat `Inventory.test.tsx`.

| File | Aksi | Ringkasan |
|---|---|---|
| `src/types/asset.ts` | ✅ edit | Tambah tipe `AssetBulkPatch` (Tahap 1: 3 field saja) |
| `src/contexts/AssetContext.tsx` | ✅ edit | Tambah `toDbPatch()` + `bulkUpdateAssets()`, expose di context |
| `src/lib/activityLogger.ts` | ✅ edit | Tambah `'BULK_UPDATE'` ke union `ActionType` |
| `src/components/NotificationBell.tsx` | ✅ edit | Tambah `case 'BULK_UPDATE'` di formatter notifikasi |
| `src/components/BulkEditModal.tsx` | ✅ **baru** | Form bulk edit — Tahap 1: 3 field, tanpa saling-eksklusif/panel dampak |
| `src/components/BulkEditProgressModal.tsx` | ✅ **baru** | Wrapper `ui/ProgressModal`, pola `DeleteProgressModal` |
| `src/components/AssetToolbar.tsx` | ✅ edit | Tombol "Edit Selected (N)" |
| `src/pages/Inventory.tsx` | ✅ edit | State + handler + render dua modal baru |
| `src/pages/Inventory.test.tsx` | belum | Test integrasi bulk edit |
| `src/contexts/AssetContext.test.tsx` | baru (opsional) | Unit test `toDbPatch` / batching |

---

## 4. Detail implementasi

### Fase 1 — Tipe

`src/types/asset.ts`:

```ts
/**
 * Field yang boleh diubah lewat bulk edit.
 * `verificationDate` sengaja TIDAK ada di sini: ia diturunkan dari `verification`
 * (Yes -> hari ini, No -> kosong), bukan diisi user.
 * Lihat "bulk edit asset inventory.md" §2.4.
 */
export type AssetBulkPatch = Partial<
  Pick<Asset, 'depreciationMethod' | 'listed' | 'status' | 'itemStatus' | 'verification'>
>;
```

Tipe inilah yang menegakkan aturan tanggal di level compiler: `bulkUpdateAssets` tidak bisa
menerima `verificationDate` walau ada kode yang mencoba mengirimnya, jadi tidak ada jalan untuk
diam-diam menambahkan date picker tanpa mengubah tipe ini lebih dulu.

### Fase 2 — `AssetContext.bulkUpdateAssets()`

Tambah helper `toDbPatch` **terpisah** dari `toDb` yang sudah ada. `toDb` tidak bisa dipakai
ulang: ia membangun objek lengkap, sehingga field yang tidak diisi akan tertimpa `null`/`''`.

```ts
const toDbPatch = (patch: AssetBulkPatch): Record<string, unknown> => {
  const db: Record<string, unknown> = {};
  if (patch.depreciationMethod !== undefined) db.depreciation_method = patch.depreciationMethod;
  if (patch.listed !== undefined) db.listed = patch.listed;
  if (patch.status !== undefined) db.status = patch.status;
  if (patch.itemStatus !== undefined) db.item_status = patch.itemStatus;
  if (patch.verification !== undefined) {
    db.verification = patch.verification;
    // verification_date tidak pernah datang dari user (§2.4). Bentuk tanggalnya sama
    // dengan EditAssetModal.handleVerificationChange supaya kedua jalur konsisten.
    db.verification_date = patch.verification
      ? new Date().toISOString().split('T')[0]
      : null;
  }
  return db;
};
```

> **Catatan ±1 hari.** `toISOString()` menghasilkan tanggal UTC, sedangkan writeback trigger
> menulis `CURRENT_DATE` menurut timezone server. Antara 00:00–07:00 WIB keduanya bisa berbeda
> satu hari, dan baris yang punya baris reclassification akan berakhir dengan nilai trigger
> sementara baris yang tidak punya mempertahankan nilai dari client. Selisihnya diterima:
> `EditAssetModal` sudah memakai bentuk yang sama hari ini, jadi memperbaikinya di sini saja
> justru membuat dua jalur tidak konsisten. Kalau mau dibereskan, bereskan keduanya sekaligus
> sebagai isu terpisah.

**Baris mana yang benar-benar di-UPDATE.** Ini bukan optimasi — lihat §2.4 poin 1. Patch
`verification` hanya boleh menyentuh baris yang nilainya memang berbeda, sementara field lain
tetap menyentuh semua baris terpilih. Karena itu satu panggilan `bulkUpdateAssets` bisa
menghasilkan **dua pass** dengan daftar ID yang berbeda:

```ts
const bulkUpdateAssets = async (
  ids: string[],
  patch: AssetBulkPatch,
  onProgress?: (processed: number, failed: number, total: number) => void,
): Promise<{ updated: number; failed: number; skipped: number }> => {
  // { verification, ...rest } dipisah supaya masing-masing dapat daftar ID sendiri.
  const restPatch = toDbPatch({ ...patch, verification: undefined });

  // Baris yang sudah berada di nilai target tidak disentuh: menulis ulang
  // verification_date-nya akan menimpa tanggal pemeriksaan aslinya (§2.4 poin 1).
  const verificationIds =
    patch.verification === undefined
      ? []
      : ids.filter(id => assets.find(a => a.id === id)?.verification !== patch.verification);

  const passes: { dbPatch: Record<string, unknown>; ids: string[] }[] = [];
  if (Object.keys(restPatch).length > 0) passes.push({ dbPatch: restPatch, ids });
  if (verificationIds.length > 0) {
    passes.push({ dbPatch: toDbPatch({ verification: patch.verification }), ids: verificationIds });
  }

  const total = passes.reduce((n, p) => n + p.ids.length, 0);
  const skipped = patch.verification === undefined ? 0 : ids.length - verificationIds.length;
  if (total === 0) return { updated: 0, failed: 0, skipped };

  // Daftarkan Item Status baru ke lookup table sekali saja, bukan per baris.
  if (patch.itemStatus) addItemStatus(patch.itemStatus);

  const BATCH_SIZE = 100;
  let processed = 0;
  let failed = 0;
  const updatedIds = new Set<string>();

  for (const pass of passes) {
    for (let i = 0; i < pass.ids.length; i += BATCH_SIZE) {
      const batch = pass.ids.slice(i, i + BATCH_SIZE);
      const { data, error } = await supabase
        .from('assets')
        .update(pass.dbPatch)
        .in('id', batch)
        .select();

      if (error) {
        failed += batch.length;
      } else {
        const byId = new Map((data ?? []).map(row => [row.id, fromDb(row)]));
        byId.forEach((_, id) => updatedIds.add(id as string));
        setAssets(prev => prev.map(a => byId.get(a.id) ?? a));
      }
      processed += batch.length;
      onProgress?.(processed, failed, total);
    }
  }

  const updated = updatedIds.size;   // aset unik, bukan jumlah baris ter-UPDATE
  if (updated > 0) {
    setLastFetchedAt(new Date());
    logActivity({
      actionType: 'BULK_UPDATE',
      entityType: 'asset',
      details: { count: updated, fields: Object.keys(patch) },
    });
  }

  // AFTER-trigger reclassification menulis balik ke assets setelah RETURNING dievaluasi,
  // jadi hasil .select() basi untuk item_status DAN verification (§2.2 D).
  // Resync agar UI == DB.
  if (patch.itemStatus !== undefined || patch.verification !== undefined) {
    await fetchAll();
  }

  return { updated, failed, skipped };
};
```

Tambahkan ke interface `AssetContextType` dan ke object `value` provider.

Tiga catatan pada bentuk di atas:

- **`updated` dihitung dari `Set` ID, bukan penjumlahan `data.length`.** Dengan dua pass, aset
  yang sama bisa muncul di keduanya (mis. patch `Status` + `Verification`), dan penjumlahan
  langsung akan melaporkan "Updated 400 assets" untuk 200 aset.
- **`total` dikirim lewat `onProgress`, tidak diasumsikan `ids.length`.** Kalau separuh seleksi
  sudah berada di nilai Verification target, jumlah baris yang benar-benar diproses lebih kecil
  dari jumlah yang dicentang — progress bar harus memakai angka yang benar. `skipped` yang
  dikembalikan dipakai untuk kalimat toast di §4 Fase 7.
- **`assets` dibaca dari closure provider.** Cukup untuk kasus ini karena `bulkUpdateAssets`
  dipanggil dari event handler pada render yang sama dengan seleksi user. Kalau nanti fungsi ini
  dipanggil dari tempat yang tidak menjamin itu, ganti ke ref.

> Catatan: batch yang gagal dihitung `failed += batch.length` — sama seperti
> `deleteMultipleAssets`. Ini pesimistis (satu error menandai 100 baris gagal) tapi konsisten
> dengan pola yang ada, dan `refetch` di akhir memastikan tampilan tetap benar.

### Fase 3 — `activityLogger` + `NotificationBell`

```ts
// src/lib/activityLogger.ts
| 'BULK_DELETE'
| 'BULK_UPDATE'   // <- baru
```

```tsx
// src/components/NotificationBell.tsx — setelah case 'BULK_DELETE'
case 'BULK_UPDATE':
  return {
    icon: <Pencil className="h-4 w-4 text-amber-500" />,
    bg: 'bg-amber-50',
    title: `${name} memperbarui ${Number(d.count ?? 0)} aset sekaligus`,
    subtitle: Array.isArray(d.fields) ? d.fields.join(', ') : '',
  }
```

### Fase 4 — `BulkEditModal.tsx`

Pakai `ui/Modal` (portal + focus trap + Esc), **bukan** div inline seperti `EditAssetModal`.
Lebar `max-w-2xl`.

**Struktur state:**

```ts
const [enabled, setEnabled] = useState({
  depreciationMethod: false,
  listed: false,
  status: false,
  itemStatus: false,
  verification: false,
});
const [values, setValues] = useState({
  depreciationMethod: 'Straight Line',
  listed: 'Audited',
  status: 'Active',
  itemStatus: '',
  verification: 'Yes' as 'Yes' | 'No',
});
```

Reset `enabled` + `values` ke default setiap kali modal dibuka (`useEffect` on `isOpen`),
supaya tidak ada patch nyangkut dari sesi sebelumnya.

**Saling eksklusif Verification ⇄ Item Status** (§2.6) — ditegakkan di satu tempat, di handler
checkbox, bukan disebar ke tiap kontrol:

```ts
const toggleField = (key: keyof typeof enabled) => {
  setEnabled(prev => {
    const next = { ...prev, [key]: !prev[key] };
    // Keduanya menulis kolom `category` yang sama lewat dua trigger berbeda; mengirim
    // keduanya dalam satu statement membuang salah satu input. Lihat §2.2 C dan §2.6.
    if (key === 'verification' && next.verification) next.itemStatus = false;
    if (key === 'itemStatus' && next.itemStatus) next.verification = false;
    return next;
  });
};
```

Baris yang dimatikan otomatis tidak boleh hilang begitu saja — user harus tahu kenapa. Tampilkan
teks kecil di bawah checkbox yang non-aktif: *"Can't be combined with Verification — an asset has
one position in the reclassification queue."* (dan sebaliknya).

**Layout tiap baris field:** checkbox enable di kiri + label + kontrol input yang
`disabled` selama checkbox belum dicentang (`opacity-50`, kontrol tetap terlihat agar user
paham apa yang akan diubah).

**Opsi per field** — harus identik dengan `EditAssetModal` supaya tidak ada nilai liar:

- **Depreciation Method** — radio vertikal: `Straight Line`, `Declining Balance`,
  `Units of Production`. Ikuti commit `a9cc3f9`: `Units of Production` **disabled** dan diberi
  label `(Maintenance)`, karena belum didukung `src/lib/depreciation.ts`.
- **Listed** — radio horizontal: `Audited`, `Non-Listed`.
- **Status** — select: `Active`, `In Maintenance`, `Needs Service`, `Broken`, `Retired`.
  (`statusLevel` dihitung ulang otomatis oleh `computeStatusLevel` di `fromDb` — tidak perlu
  disentuh.)
- **Item Status** — `ui/AutocompleteInput` dengan `options={bulkItemStatusOptions}` (yaitu
  `itemStatuses` tanpa `'Needs Review'`, lihat §2.5), boleh nilai baru (akan didaftarkan ke
  `item_statuses` oleh `bulkUpdateAssets`). Karena input ini bebas ketik, `'Needs Review'` harus
  ditolak juga di level validasi, bukan cuma disembunyikan dari daftar saran:

  ```ts
  const itemStatusError =
    values.itemStatus.trim().toLowerCase() === 'needs review'
      ? "Use the asset's own Edit form to send an asset back to Needs Review."
      : null;
  ```

  Tombol Apply `disabled` selama `itemStatusError` ada.

- **Verification** — radio horizontal: `Yes`, `No`. Mengikuti commit `a9cc3f9` yang mengubah
  field ini jadi radio di `AddAssetModal`. **Tidak ada input Verification Date di modal ini** —
  tanggalnya diturunkan (§2.4), dan menampilkan date picker yang di-disable hanya mengundang
  pertanyaan. Sebagai gantinya, aturannya ditulis sebagai teks bantuan tepat di bawah radio:

  > `Yes` stamps today's date ({todayISO}). `No` clears the verification date.

**Panel dampak Verification** — muncul bila `enabled.verification`. Isinya dua bagian.

Bagian 1 — berapa baris yang benar-benar tersentuh (§2.4 poin 1):

```ts
const target = values.verification === 'Yes';
const willChange = selectedAssets.filter(a => a.verification !== target).length;
const untouched  = selectedAssets.length - willChange;
```

> Of **{N}** selected assets:
> - **{willChange}** will change to **{Yes/No}** — verification date {set to {todayISO} / cleared}
> - **{untouched}** are already {Yes/No} → **not modified**, their verification date is preserved

Baris kedua penting dan bukan basa-basi: ia menjelaskan kenapa hitungan di toast nanti lebih
kecil dari jumlah yang dicentang. Kalau `willChange === 0`, ganti seluruh panel dengan satu
baris — *"All selected assets are already {Yes/No} — nothing will change."* — dan `disable`
tombol Apply bila Verification adalah satu-satunya field yang di-enable.

Bagian 2 — **hanya selama Opsi 1 belum masuk** (§2.2 B): label Item Status yang akan hilang.

```ts
const overwrittenWith = target ? 'Asset' : 'Needs Review';
const itemStatusesLost = [...new Set(
  selectedAssets
    .filter(a => a.verification !== target && a.itemStatus && a.itemStatus !== overwrittenWith)
    .map(a => a.itemStatus),
)];
```

> ⚠️ The reclassification sync will also overwrite **Item Status** to `{overwrittenWith}` on the
> {willChange} assets that change. {itemStatusesLost.length} distinct value(s) will be lost:
> {itemStatusesLost.join(', ')}. This can't be undone.

Sembunyikan bagian 2 bila `itemStatusesLost` kosong. Beri komentar di atas blok ini bahwa
**seluruh bagian 2 dihapus** begitu Opsi 1 masuk — supaya tidak jadi kode zombi yang menakuti
user tentang perilaku yang sudah tidak ada:

```tsx
{/* Hapus blok ini setelah Opsi 1 (reclassification trigger fix.md) di-apply:
    writeback berhenti menimpa item_status, jadi tidak ada label yang hilang. */}
```

**Panel penjelasan Item Status** — muncul bila `enabled.itemStatus`. Ini menggantikan warning
amber di draft sebelumnya. Alasannya: efek ke Verification **bukan efek samping yang tidak
disengaja**, melainkan definisi field-nya (§2.2). Yang dibutuhkan user bukan peringatan, tapi
aturan main yang jelas plus angka yang bisa dicek sebelum menekan Apply.

Bagian 1 — aturannya, netral:

> **Item Status determines Verification.** An asset with any Item Status other than
> `Needs Review` counts as verified. Setting an Item Status here will mark unverified assets as
> **Verified**, dated today ({todayISO}).

Bagian 2 — hitungan riil dari baris yang dicentang, dihitung di client:

```ts
// Asset sudah punya field `verification` di context, jadi ini murni hitungan lokal.
const willBecomeVerified = selectedAssetRows.filter(a => !a.verification).length;
const alreadyVerified     = selectedAssetRows.length - willBecomeVerified;
```

> Of **{N}** selected assets:
> - **{willBecomeVerified}** are currently unverified → will become **Verified**, dated {todayISO}
> - **{alreadyVerified}** are already verified → Verification unchanged

Angka ini yang membuat panelnya berguna. Kalau `willBecomeVerified` = 0, user tahu operasinya
tidak menyentuh verification sama sekali; kalau angkanya 300, ia tahu persis apa yang ia
setujui. Sembunyikan bagian 2 ini bila `willBecomeVerified` = 0 dan ganti dengan satu baris:
*"All selected assets are already verified — Verification won't change."*

Supaya bisa dihitung, `BulkEditModal` butuh baris aset terpilih, bukan sekadar jumlahnya —
lihat perubahan props di bawah.

Efek ini tidak terlihat di tabel sampai `refetch()` selesai, jadi panel ini adalah satu-satunya
tempat user melihatnya sebelum operasi berjalan.

**Ringkasan konfirmasi** di footer, di atas tombol:

> Applying **{jumlah field}** change(s) to **{N}** selected assets.

**Tombol Apply** `disabled` bila salah satu dari:

- tidak ada field yang di-enable;
- `enabled.itemStatus && values.itemStatus.trim() === ''`;
- `itemStatusError` ada (§2.5);
- `enabled.verification` adalah satu-satunya field yang di-enable **dan** `willChange === 0` —
  operasi yang tidak akan mengubah apa pun.

**Props:**

```ts
interface BulkEditModalProps {
  isOpen: boolean;
  /** Baris penuh, bukan sekadar jumlah — panel Item Status perlu membaca `verification`
   *  tiap aset, dan panel Verification perlu membaca `verification` + `itemStatus`
   *  untuk menghitung baris yang berubah dan label yang akan hilang. */
  selectedAssets: Asset[];
  itemStatuses: string[];
  onCancel: () => void;
  onApply: (patch: AssetBulkPatch) => void;
}
```

`selectedCount` diturunkan dari `selectedAssets.length`, dan `'Needs Review'` disaring dari
`itemStatuses` di dalam komponen (§2.5) supaya aturannya hidup di satu tempat.

Di `Inventory.tsx`, `selectedAssets` adalah `Set<string>` berisi ID, jadi petakan dulu:

```tsx
const selectedAssetRows = useMemo(
  () => assets.filter(a => selectedAssets.has(a.id)),
  [assets, selectedAssets],
);
```

`onApply` membangun patch hanya dari key yang `enabled`, dan mengubah radio Verification jadi
boolean di sini — bukan di context:

```ts
const patch: AssetBulkPatch = {};
if (enabled.depreciationMethod) patch.depreciationMethod = values.depreciationMethod;
if (enabled.listed)             patch.listed = values.listed;
if (enabled.status)             patch.status = values.status;
if (enabled.itemStatus)         patch.itemStatus = values.itemStatus.trim();
if (enabled.verification)       patch.verification = values.verification === 'Yes';
```

### Fase 5 — `BulkEditProgressModal.tsx`

Salinan pola `DeleteProgressModal` di atas `ui/ProgressModal`:

```ts
export interface BulkEditProgressState {
  isOpen: boolean;
  status: 'updating' | 'done';
  total: number;
  processed: number;
  failedCount: number;
}
```

`busyTitle="Updating Assets..."`, `unit="assets updated"`, `doneTitle="Bulk Edit Complete"`,
stats sukses/gagal sama seperti delete.

`total` di-*set* dua kali: optimistis dari `ids.length` saat modal dibuka, lalu dikoreksi dari
argumen ketiga `onProgress` begitu batch pertama kembali. Ini perlu karena patch `Verification`
melewati baris yang sudah berada di nilai target (§4 Fase 2), jadi jumlah baris yang diproses
bisa lebih kecil dari jumlah yang dicentang — tanpa koreksi, progress bar akan berhenti di
tengah dan tidak pernah sampai 100%.

### Fase 6 — `AssetToolbar.tsx`

Tambah prop `onBulkEditClick: () => void`, dan tombol yang muncul bersama tombol Delete
saat `selectedCount > 0`, **di sebelah kiri** tombol Delete (aksi non-destruktif dulu):

```tsx
{selectedCount > 0 && (
  <button
    onClick={onBulkEditClick}
    className="flex items-center gap-2 px-4 py-2 bg-surface border border-outline-variant text-on-surface-variant rounded-md hover:text-primary hover:border-primary font-medium text-sm transition-colors shadow-sm"
  >
    <Edit2 className="h-4 w-4" />
    Edit Selected ({selectedCount})
  </button>
)}
```

Import `Edit2` dari `lucide-react` (ikon yang sama dipakai tombol edit per baris di `AssetTable`).

### Fase 7 — `Inventory.tsx`

```tsx
const { ..., bulkUpdateAssets } = useAsset();

const [isBulkEditModalOpen, setIsBulkEditModalOpen] = useState(false);
const [bulkEditProgress, setBulkEditProgress] = useState<BulkEditProgressState>({
  isOpen: false, status: 'updating', total: 0, processed: 0, failedCount: 0,
});

const handleApplyBulkEdit = useCallback(async (patch: AssetBulkPatch) => {
  const ids = Array.from(selectedAssets);
  const total = ids.length;

  setIsBulkEditModalOpen(false);
  setBulkEditProgress({ isOpen: true, status: 'updating', total, processed: 0, failedCount: 0 });

  const { updated, failed, skipped } = await bulkUpdateAssets(
    ids,
    patch,
    (processed, failedCount, actualTotal) => {
      // actualTotal bisa < total: baris yang sudah di nilai Verification target dilewati.
      setBulkEditProgress(prev => ({ ...prev, processed, failedCount, total: actualTotal }));
    },
  );

  setBulkEditProgress(prev => ({ ...prev, status: 'done' }));
  setSelectedAssets(new Set());

  const skippedNote = skipped > 0 ? `, ${skipped} already up to date` : '';
  setNotice(
    failed > 0
      ? { message: `Updated ${updated} assets, ${failed} failed${skippedNote}`, variant: 'error' }
      : {
          message: `Updated ${updated} asset${updated === 1 ? '' : 's'}${skippedNote}`,
          variant: 'success',
        },
  );
}, [selectedAssets, bulkUpdateAssets]);
```

Wire `onBulkEditClick={() => setIsBulkEditModalOpen(true)}` ke `AssetToolbar`, lalu render
`<BulkEditModal selectedAssets={selectedAssetRows} …>` dan `<BulkEditProgressModal>` bersama
modal-modal lain di akhir JSX (`selectedAssetRows` didefinisikan di Fase 4).

---

## 5. Rencana test

`src/pages/Inventory.test.tsx` (ikuti pola yang sudah ada di file itu):

1. Tombol **Edit Selected** tidak muncul saat tidak ada baris tercentang.
2. Centang 2 baris → tombol muncul dengan hitungan `(2)`.
3. Buka modal → tombol **Apply** disabled sampai minimal satu field di-enable.
4. Enable `Status`, pilih `Retired`, Apply → `bulkUpdateAssets` dipanggil dengan
   `(['id1','id2'], { status: 'Retired' })` — memastikan field lain **tidak** ikut terkirim.
5. Enable `Item Status` → panel penjelasan tampil dan **menyebut Verification**.
6. Panel itu menghitung dengan benar: pilih 3 aset (2 `verification: false`, 1 `true`) →
   panel menyebut **2** akan jadi Verified dan **1** tidak berubah.
7. Semua aset terpilih sudah verified → panel menampilkan baris *"All selected assets are
   already verified"*, bukan hitungan `0`.
8. Ketik `Needs Review` (dan variasi kapitalisasinya) di Item Status → pesan error muncul dan
   Apply `disabled` (§2.5). Daftar saran autocomplete juga tidak memuat `Needs Review`.
9. Setelah Apply sukses → `selectedAssets` kosong dan toast sukses muncul.

Verification (§2.4, §2.6) — ini kelompok yang mengunci keputusan baru:

10. Modal merender radio `Verification` dengan opsi `Yes`/`No`, dan **tidak merender input
    tanggal apa pun**: kontrol dengan label `/verification date/i` → `null`. Test ini yang
    menahan date picker supaya tidak masuk diam-diam.
11. Enable `Verification` → checkbox `Item Status` jadi non-aktif, dan sebaliknya (§2.6).
    Keduanya tidak pernah bisa `enabled` bersamaan.
12. Enable `Verification = Yes` pada 3 aset (2 unverified, 1 verified) → panel menyebut
    **2** akan berubah dan **1** tidak dimodifikasi dengan tanggal verifikasinya dipertahankan.
13. Semua aset terpilih sudah `Yes` dan Verification satu-satunya field yang di-enable →
    Apply `disabled` dan panel menampilkan *"nothing will change"*.
14. Enable `Verification = No` pada aset yang Item Status-nya `'Inventory'` → panel bagian 2
    menyebut `'Inventory'` sebagai nilai yang akan hilang (§2.2 B). Test ini dihapus bersama
    blok panelnya begitu Opsi 1 masuk.
15. Apply `Verification = Yes` → `bulkUpdateAssets` dipanggil dengan
    `{ verification: true }`, **tanpa** key `verificationDate`.

Unit test `toDbPatch` / `bulkUpdateAssets` (lewat `AssetContext.test.tsx` baru, atau ekspor
helper-nya):

16. `{ itemStatus: 'Inventory' }` → hanya key `item_status`.
17. `{ verification: true }` → `{ verification: true, verification_date: '<hari ini>' }`.
18. `{ verification: false }` → `{ verification: false, verification_date: null }`.
19. **`bulkUpdateAssets` melewati baris yang sudah di nilai target.** 3 ID, satu di antaranya
    sudah `verification: true`, patch `{ verification: true }` → `.in('id', …)` dipanggil hanya
    dengan 2 ID sisanya, dan hasilnya melaporkan `skipped: 1`. Ini test yang menjaga §2.4 poin 1
    — kalau ia gagal, tanggal verifikasi asli sedang tertimpa.
20. Patch `{ status, verification }` pada seleksi campuran → **dua** panggilan `.update()`
    dengan daftar ID berbeda, dan `updated` menghitung aset unik (bukan penjumlahan dua pass).
21. `{}` → `{}` (dan `bulkUpdateAssets` langsung return tanpa memanggil supabase).
22. Patch menyentuh `itemStatus` **atau** `verification` → `fetchAll` dipanggil sekali di akhir;
    patch yang hanya berisi `status` → `fetchAll` **tidak** dipanggil.

Manual QA (setelah project Supabase di-*resume*) — fokus pada verifikasi tabel perilaku di §2.2:

23. Bulk `Item Status = 'Inventory'` untuk 3 aset **unverified** → konfirmasi ketiganya
    jadi `Verification = Yes` dengan tanggal hari ini, dan hitungan di panel modal
    (§4 Fase 4) cocok dengan hasil akhirnya. Ini baris pertama tabel §2.2 A — perilaku yang
    memang diinginkan.
24. Bulk `Item Status = 'Inventory'` untuk 3 aset yang **sudah** verified → cek apakah
    `assets.item_status` dan `asset_reclassifications.category` jadi tidak sinkron
    (baris ketiga tabel §2.2 A). Kalau terbukti, catat sebagai isu terpisah — halaman
    Inventory dan Reclassification akan menampilkan Item Status berbeda untuk aset yang sama.
25. **Bulk `Verification = Yes`** untuk 3 aset unverified yang Item Status-nya `'Inventory'` →
    konfirmasi `item_status` ketiganya **berubah jadi `'Asset'`** (§2.2 B) dan panel modal sudah
    menyebutkan `'Inventory'` sebagai nilai yang hilang. Kalau `item_status` ternyata bertahan,
    Opsi 1 sudah masuk → hapus panel bagian 2 dan test #14.
26. **Bulk `Verification = No`** untuk 3 aset verified → konfirmasi ketiganya muncul di antrean
    Needs Review halaman Reclassification, `verification_date` jadi kosong, dan `item_status`
    berubah jadi `'Needs Review'`.
27. **Bulk `Verification = Yes`** untuk seleksi campuran (2 unverified, 2 sudah verified dengan
    `verification_date` lama yang berbeda-beda) → konfirmasi tanggal kedua aset yang sudah
    verified **tidak berubah sama sekali**. Ini pembuktian §2.4 poin 1 terhadap database asli,
    bukan hanya terhadap mock di test #19.
28. **Konfirmasi bug kasus A baris keempat masih ada** sebelum mengandalkan §2.5: lewat SQL
    langsung (bukan UI, karena UI sudah memblokirnya), jalankan
    `update assets set item_status = 'Needs Review' where id = '<aset-verified>'` lalu cek
    `verification` tetap `true` dan `reclass.category` tidak berubah. Kalau ternyata sudah
    ter-*unverify* dengan benar, berarti trigger sudah diperbaiki di luar dokumen ini.
29. Bulk `Status` / `Listed` / `Depreciation Method` (tanpa Item Status maupun Verification)
    untuk 3 aset campuran verified & unverified → konfirmasi `verification`,
    `verification_date`, dan `item_status` **tidak berubah sama sekali**. Ini bukti bahwa 3
    field Tahap 1 benar-benar aman dirilis lebih dulu.
30. Cek Notification Bell menampilkan "memperbarui N aset sekaligus".
31. Uji dengan ≥ 250 aset tercentang pada patch `Verification` → progress bar bergerak per 100
    **dan berakhir di 100%** meski sebagian baris dilewati (§4 Fase 5), tidak ada statement
    timeout meski tiap baris memicu 4–6 statement trigger, dan tabel menampilkan nilai final
    yang benar setelah `refetch()`.

---

## 6. Risiko & batasan

| Risiko | Dampak | Mitigasi |
|---|---|---|
| **Bulk `Verification` menghapus label `Item Status`** (§2.2 B) | `'Asset'` (Yes) atau `'Needs Review'` (No) menimpa nilai lama pada tiap baris yang berubah; tidak bisa direkonstruksi | **Tidak bisa dimitigasi dari front-end.** Modal menampilkan daftar nilai yang akan hilang sebelum Apply (§4 Fase 4 bagian 2); dikonfirmasi QA #25/#26. Hilang total setelah Opsi 1 |
| **Bulk `Verification = No` melempar ratusan aset ke antrean Needs Review** | Antrean kerja Reclassification membengkak seketika | Panel dampak dengan hitungan riil sebelum Apply; `Verification` dan `Item Status` saling eksklusif supaya tidak ada perubahan antrean yang tersembunyi di balik field lain |
| **`verification_date` tertimpa tanggal bulk edit** | Tanggal pemeriksaan fisik asli hilang permanen | Baris yang sudah di nilai target **tidak disentuh** (§1, §2.4 poin 1); dikunci test #19 dan QA #27 |
| Tidak ada cara membedakan verifikasi fisik dari bulk edit **per baris** | Jejak audit lemah; hanya `activity_logs` yang menyimpan konteksnya | **Diterima sadar.** Pemecahannya kolom `verification_source`, di luar scope (§7) |
| **Bulk `Item Status` menandai ratusan aset sebagai Verified** (§2.2 A, baris 1) | Sesuai definisi field (Verification = turunan Item Status), tapi tetap perubahan audit berskala besar dari satu klik | Panel penjelasan + **hitungan riil** aset yang akan berubah, ditampilkan sebelum Apply (§4 Fase 4); dikonfirmasi lewat QA #23 |
| **`Item Status = 'Needs Review'` tidak meng-unverify aset yang sudah verified** (§2.2 A, baris 4) | Inkonsistensi 3 arah: label berubah, `verification` tidak, aset tidak kembali ke antrean review | `'Needs Review'` dikeluarkan dari pilihan bulk edit + divalidasi di input bebas ketik (§2.5); jalur yang benar (`Verification = No`) ada di modal yang sama. Akar masalahnya di trigger, §7 |
| **Verification + Item Status dalam satu patch membuang salah satu input** (§2.2 C) | User mengetik nilai yang diam-diam tidak tersimpan | Saling eksklusif di modal (§2.6), ditegakkan di `toggleField` dan dikunci test #11 |
| Item Status kustom (`'Lost'`, salah ketik, dll) ikut menandai aset Verified | Aturannya `<> 'Needs Review'`, bukan daftar putih — nilai apa pun memverifikasi | Panel penjelasan menyatakan aturannya apa adanya, bukan menyebut `Asset`/`Inventory` saja; pertimbangkan mengunci Item Status ke daftar lookup sebagai isu terpisah |
| `assets.item_status` vs `reclassifications.category` desync untuk aset yang sudah verified | Dua halaman menampilkan Item Status berbeda | Dikonfirmasi lewat QA #24; kalau terbukti, tangani sebagai isu trigger terpisah |
| `.select()` mengembalikan nilai pre-AFTER-trigger | UI beda dari DB | `refetch()` otomatis bila patch menyentuh `itemStatus` **atau** `verification` |
| Rantai trigger 4–6 statement per baris | Risiko statement timeout pada seleksi besar | Batch tetap 100; diuji di QA #31 dengan ≥ 250 baris |
| Satu batch gagal → 100 baris ditandai gagal padahal sebagian mungkin sukses | Hitungan di progress modal pesimistis | `refetch()` di akhir + `updated` dihitung dari `Set` ID yang benar-benar kembali, bukan asumsi |
| Progress bar tidak sampai 100% saat sebagian baris dilewati | Modal terlihat menggantung | `total` dikoreksi dari argumen ketiga `onProgress` (§4 Fase 5); diuji QA #31 |
| Tidak ada undo | Bulk edit 500 baris salah field tidak bisa dibatalkan | Ringkasan konfirmasi di footer modal; pertimbangkan Export Selected ke CSV sebagai backup sebelum Apply |
| Operasi tidak atomik (per batch, dan kini bisa dua pass) | Gagal di tengah → sebagian ter-update, mungkin hanya sebagian field | Diterima; konsisten dengan `deleteMultipleAssets`. Kalau atomicity jadi kebutuhan, ganti ke RPC (butuh migrasi) |
| Trigger belum terverifikasi terhadap DB live | Asumsi bisa meleset | Jalankan query `pg_trigger` di §2.3 sebelum mulai koding, termasuk uji arah kasus B |

## 7. Di luar scope

- **Kolom `verification_source`** — pembeda "pemeriksaan fisik" vs "bulk edit" per baris.
  Ini satu-satunya kekhawatiran §2.4 yang **tidak** terpecahkan oleh rencana ini; hari ini
  pembedanya hanya `activity_logs`, dan itu korelasi waktu, bukan atribusi per baris. Butuh
  migrasi (kolom baru + backfill `'manual'` untuk data lama) dan penulisan nilai di ketiga
  jalur yang menyentuh `verification`: `EditAssetModal`, bulk edit, dan writeback trigger.
- **Date picker untuk `verification_date` di bulk edit** — sengaja tidak ada (§2.4). Menambahkan
  tanggal bebas ke operasi massal justru memperburuk masalah atribusi di atas, bukan
  memperbaikinya. Tanggal per aset tetap bisa diedit lewat `EditAssetModal`.
- Undo / rollback bulk edit.
- Bulk edit untuk field numerik/teks (`assetCost`, `lifeInMonths`, `subsidiary`, dll).
- Bulk edit dari halaman Reclassification atau Maintenance.
- Preview diff per baris sebelum Apply.
- Bypass trigger reclassification (ditolak — berisiko desinkronisasi data).
- **Perbaikan trigger sync `assets` ⇄ `asset_reclassifications`**, akar dari kasus A, B, dan C
  di §2.2. Sudah ditelusuri di dokumen terpisah:
  [`reclassification trigger fix.md`](./reclassification%20trigger%20fix.md) — Opsi 1 di sana
  adalah prasyarat Tahap 2 (lihat kotak di awal dokumen ini).

  Tiga hal yang harus masuk perbaikan itu, dari temuan §2.2:

  1. Guard `WHERE ... AND category = 'Needs Review'` di `sync_category_from_asset_item_status()`
     membuat arah `→ Needs Review` tidak pernah berjalan untuk aset yang sudah verified
     (kasus A baris 4 — Cacat C di dokumen itu).
  2. Writeback `sync_asset_verification_from_category()` menulis `item_status` setiap kali
     `category` berubah, termasuk ketika perubahan itu berasal dari `assets` sendiri — akar
     kasus B, satu-satunya risiko fitur ini yang **tidak bisa** dimitigasi dari front-end.
  3. `verification_date` di-stempel `CURRENT_DATE` oleh trigger tanpa membedakan pemeriksaan
     fisik dari perubahan label — bagian dari kekhawatiran jejak audit di §2.4 poin 1.
     Perhatikan: Opsi 1 **tidak** menyelesaikan atribusi per baris; itu butuh
     `verification_source` di butir pertama §7 ini.

  > **Kalau perbaikan itu dikerjakan lebih dulu** (urutan yang direkomendasikan), kasus A, B,
  > dan C hilang di level database: panel dampak Verification menyusut jadi hitungan baris saja
  > (bagian 2 dihapus bersama test #14), panel Item Status hilang seluruhnya, dan §2.6 turun
  > status dari keharusan teknis jadi pilihan UX. Kasus D ikut hilang: guard `IS DISTINCT FROM`
  > di writeback baru membuat round-trip-nya 0 baris, jadi `.select()` tidak lagi basi dan
  > `refetch()` di §4 Fase 2 turun jadi jaring pengaman murah, bukan keharusan.
  >
  > Yang **tidak** berubah sama sekali: §2.5 (alasannya justru menguat) dan aturan "baris yang
  > sudah di nilai target tidak disentuh" di §1/§2.4 — yang terakhir berdiri di atas alasan jejak
  > audit, bukan trigger. QA #25 dan #28 adalah cara mengecek apakah perbaikan itu sudah masuk.
