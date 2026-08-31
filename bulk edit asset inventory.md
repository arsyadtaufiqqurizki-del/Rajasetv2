# Bulk Edit — Asset Inventory

Rencana implementasi fitur **bulk edit** untuk halaman Asset Inventory, mencakup 4 field:
`Depreciation Method`, `Listed`, `Status`, `Item Status`.

`Verification` **sengaja dikeluarkan dari scope** — lihat §2.4.

Status: **rencana** (belum diimplementasikan).
Tanggal: 2026-08-31.

> ## ⚠️ Baca dulu: urutan pengerjaan
>
> Dari 4 field di atas, **hanya `Item Status` yang bersentuhan dengan trigger sync
> `assets` ⇄ `asset_reclassifications`.** Tiga field lain tidak muncul di klausa `WHEN` trigger
> mana pun — mengubahnya tidak memicu apa-apa.
>
> Karena itu rencana ini dibelah dua:
>
> | Tahap | Isi | Prasyarat |
> |---|---|---|
> | **1** | `Depreciation Method`, `Listed`, `Status` | tidak ada — bisa dikerjakan sekarang |
> | **2** | `Item Status` | Opsi 1 di [`reclassification trigger fix.md`](./reclassification%20trigger%20fix.md) sudah di-apply |
>
> Alasannya bukan kerapian. Opsi 1 membaca `NEW.verification` **langsung** alih-alih
> menyimpulkannya dari `category`, sehingga **seluruh** keterkaitan Item Status ⇄ Verification
> hilang untuk setiap nilai selain `'Needs Review'`. Mengerjakan Item Status lebih dulu berarti
> menulis §2.2, panel hitungan di §4 Fase 4, props `selectedAssets: Asset[]`, dan `refetch()` —
> lalu **membuang semuanya** begitu Opsi 1 masuk.
>
> Yang **tidak** hilang setelah Opsi 1: §2.4 (Verification di luar scope) dan §2.5
> (`'Needs Review'` tidak ditawarkan). Keduanya keputusan produk, bukan tambalan bug.
>
> Bagian di bawah ini ditulis untuk keadaan **sebelum** Opsi 1, jadi tetap lengkap dan bisa
> dijalankan apa adanya kalau Item Status memang harus rilis lebih dulu.

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
| `Verification` | **Tidak masuk bulk edit.** Terlalu sensitif untuk diubah massal — lihat §2.4. Tetap hanya bisa diubah per aset lewat `EditAssetModal`. |
| `Item Status = 'Needs Review'` | **Tidak ditawarkan di bulk edit.** Nilai ini identik dengan `Verification = No`, jadi mengizinkannya = membuka kembali bulk un-verify lewat pintu belakang — lihat §2.5. Bulk edit hanya bisa menggerakkan aset ke arah "sudah diperiksa". |
| Trigger reclassification | **Dibiarkan jalan**, dengan warning eksplisit di modal. Tidak ada migrasi bypass. |
| Eksekusi backend | **Batch update dari client**, mengikuti pola `deleteMultipleAssets` (`.in('id', batch)`, batch 100). |

---

## 2. Temuan backend (penting)

### 2.1 Tidak ada migrasi skema yang dibutuhkan

Keempat field sudah ada sebagai kolom di tabel `assets`:

| Field UI | Kolom DB | Tipe |
|---|---|---|
| Depreciation Method | `depreciation_method` | TEXT |
| Listed | `listed` | TEXT |
| Status | `status` | TEXT |
| Item Status | `item_status` | TEXT NOT NULL DEFAULT '' |

Dua kolom di bawah ini **tidak pernah ditulis langsung** oleh bulk edit, tapi tetap relevan
karena trigger bisa menulisnya secara tidak langsung (§2.2):

| Kolom DB | Tipe | Catatan |
|---|---|---|
| `verification` | BOOLEAN NOT NULL DEFAULT false | Di luar scope; hanya diubah lewat `EditAssetModal` per aset |
| `verification_date` | DATE (nullable) | Turunan dari `verification` |

RLS untuk UPDATE pada `assets` sudah aktif dan dipakai `updateAsset()` hari ini, jadi tidak
ada policy baru. `activity_logs.action_type` bertipe TEXT **tanpa CHECK constraint**
(`supabase/migrations/20260701000000_create_activity_logs.sql`), jadi menambah action type
baru `BULK_UPDATE` tidak butuh migrasi.

> **Kesimpulan: fitur ini murni perubahan front-end. Nol file migrasi baru.**

### 2.2 Trigger cascade — risiko utama fitur ini

Satu dari empat field, `item_status`, terikat **dua arah** dengan `asset_reclassifications`.
Konsekuensinya bukan sekadar "ada baris lain yang ikut berubah": **bulk edit Item Status ikut
mengubah `verification` — kolom yang justru sengaja dikeluarkan dari scope fitur ini.**

#### Trigger yang aktif hari ini

Penting: `20260815020000_unify_reclassification_category_with_verification.sql` **men-drop**
`trg_auto_queue_asset_for_reclassification_*` beserta fungsinya, dan `20260817000000` men-drop
kolom `asset_reclassifications.verified`. Jadi yang benar-benar hidup sekarang hanya 4 trigger:

Pada `assets` (AFTER UPDATE, di luar `trg_assets_updated_at` yang BEFORE):

| Trigger | WHEN | Efek |
|---|---|---|
| `trg_sync_category_from_asset_item_status` | `OLD.item_status IS DISTINCT FROM NEW.item_status` | UPDATE `category` baris yang masih `'Needs Review'`; INSERT baris baru bila aset belum punya baris sama sekali |
| `trg_sync_category_from_asset_verification_update` | `OLD.verification IS DISTINCT FROM NEW.verification` | `false` → set baris terakhir jadi `'Needs Review'` (atau INSERT bila belum ada); `true` → set baris `'Needs Review'` jadi `'Asset'` |

Trigger kedua **tidak pernah dipicu oleh bulk edit** karena `verification` tidak ada di patch —
`WHEN`-nya tidak pernah terpenuhi. Ia dicantumkan hanya supaya gambaran cascade-nya utuh.

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

> Ini juga yang membuat §2.4 belum tuntas. Verification dikeluarkan dari modal karena
> meng-*unverify* ratusan aset sekaligus itu sensitif — tapi bulk `Item Status = 'Needs Review'`
> adalah persis aksi itu, lewat pintu lain, dan saat ini ia **setengah jalan**: label berubah,
> status verifikasi dan antrean kerja tidak.

**B. `.select()` mengembalikan nilai basi**

`.select()` di supabase-js = `UPDATE ... RETURNING`. RETURNING dievaluasi saat baris ditulis,
sedangkan AFTER ROW trigger baru jalan di akhir statement. Jadi penulisan balik di poin A
**tidak terlihat** di hasil `.select()`. Tanpa penanganan, tabel Inventory akan menampilkan
nilai yang berbeda dari isi database sampai user refresh manual.

#### Mitigasi yang diambil

- **`'Needs Review'` dikeluarkan dari pilihan Item Status di bulk edit** (§2.5). Menutup baris
  keempat tabel di atas — satu-satunya baris yang perilakunya salah — sekaligus konsisten
  dengan alasan Verification dikeluarkan.
- **Panel penjelasan, bukan sekadar warning.** Karena Verification memang turunan Item Status,
  modal menyatakan aturannya apa adanya lalu menampilkan **hitungan riil** aset yang akan
  berubah status verifikasinya. Detail salinannya di §4 Fase 4.
- **`refetch()` wajib** setelah batch selesai bila patch menyentuh `itemStatus` (kasus B).
- Batch tetap 100 — tiap baris memicu rantai 3–4 statement tambahan; batch besar menaikkan
  risiko statement timeout.

Catatan: aturan saling-eksklusif Verification ⇄ Item Status yang ada di draft sebelumnya
**tidak lagi diperlukan** — hanya ada satu dari dua field itu di modal, jadi tidak ada kombinasi
yang bisa membuat kedua trigger `assets` antre dan saling menimpa.

> Kalau efek silang ini dianggap **bug**, bukan fitur, perbaikannya bukan di bulk edit
> melainkan di trigger (`sync_asset_verification_from_category()` sebaiknya tidak menulis
> `verification`/`verification_date` untuk perubahan yang tidak berasal dari verifikasi).
> Itu migrasi tersendiri di luar scope dokumen ini — lihat §7.

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

### 2.4 Kenapa `Verification` dikeluarkan dari scope

Verification bukan sekadar kolom data — ia menandai bahwa **seseorang benar-benar memeriksa
aset itu**, dan ia menggerakkan alur kerja user: aset unverified muncul di antrean
Reclassification sebagai `'Needs Review'`, dan hilang dari antrean begitu diverifikasi.
Mengubahnya untuk ratusan baris sekaligus lewat satu klik berarti:

- **Jejak audit jadi tidak bermakna.** `verification_date` akan berisi tanggal bulk edit,
  bukan tanggal pemeriksaan fisik. Tidak ada cara membedakan keduanya setelah tersimpan.
- **Antrean kerja user bisa hilang atau membengkak seketika.** Bulk `No` melempar ratusan aset
  ke antrean Needs Review; bulk `Yes` mengosongkan antrean tanpa ada yang benar-benar diperiksa.
- **Tidak ada undo.** Nilai `verification_date` sebelumnya hilang permanen dan tidak bisa
  direkonstruksi dari `activity_logs` (yang hanya menyimpan `count` + daftar nama field).

Karena itu Verification tetap **per-aset saja**, lewat `EditAssetModal`, di mana perubahannya
sengaja dan terlihat satu per satu.

Konsekuensi teknis dari keputusan ini: dua skenario yang ada di draft sebelumnya **hilang** —
bulk `Verification` menimpa `Item Status`, dan dua trigger `assets` antre lalu saling menimpa
sehingga input Item Status user terbuang. Yang tersisa hanya kasus A dan B di §2.2 (penomoran
sudah disesuaikan). Tapi lihat peringatan di kasus A — jalur tidak langsung ke `verification`
lewat Item Status masih terbuka, dan §2.5 yang menutupnya.

### 2.5 `'Needs Review'` juga dikeluarkan dari pilihan Item Status

Keputusan §2.4 belum tuntas kalau Item Status masih boleh di-set ke `'Needs Review'` secara
massal. Dari aturan turunan di §2.2, `Item Status = 'Needs Review'` **adalah** `Verification = No`
— jadi membiarkannya sama saja membuka kembali bulk un-verify lewat pintu belakang, persis yang
ditolak di §2.4. Ditambah lagi, hari ini aksi itu bahkan tidak berjalan benar (kasus A).

Maka pilihan Item Status di bulk edit **hanya nilai selain `'Needs Review'`**:

```ts
// 'Needs Review' == Verification: No. Bulk un-verify ditolak di §2.4, jadi nilai ini
// tidak ditawarkan di sini. Lihat "bulk edit asset inventory.md" §2.5.
const bulkItemStatusOptions = itemStatuses.filter(s => s !== 'Needs Review');
```

Efeknya, bulk edit hanya bisa menggerakkan aset **satu arah** — dari belum diperiksa menjadi
sudah diperiksa. Arah sebaliknya (mengembalikan aset ke antrean review) tetap per-aset lewat
`EditAssetModal`, di mana keputusannya sengaja dan terlihat.

> **Alternatif yang ditolak:** menawarkan `'Needs Review'` disertai warning. Ditolak karena
> perilakunya saat ini setengah jalan (kasus A) — user akan melihat Item Status berubah tapi
> aset tidak kembali ke antrean, dan warning apa pun tidak memperbaiki itu. Kalau nanti trigger
> di §7 diperbaiki sehingga arah ini berjalan penuh, keputusan §2.5 boleh ditinjau ulang — tapi
> §2.4 tetap jadi alasan berdiri sendiri untuk menahannya.

---

## 3. Perubahan file

| File | Aksi | Ringkasan |
|---|---|---|
| `src/types/asset.ts` | edit | Tambah tipe `AssetBulkPatch` |
| `src/contexts/AssetContext.tsx` | edit | Tambah `toDbPatch()` + `bulkUpdateAssets()`, expose di context |
| `src/lib/activityLogger.ts` | edit | Tambah `'BULK_UPDATE'` ke union `ActionType` |
| `src/components/NotificationBell.tsx` | edit | Tambah `case 'BULK_UPDATE'` di formatter notifikasi |
| `src/components/BulkEditModal.tsx` | **baru** | Form bulk edit 4 field + warning cascade |
| `src/components/BulkEditProgressModal.tsx` | **baru** | Wrapper `ui/ProgressModal`, pola `DeleteProgressModal` |
| `src/components/AssetToolbar.tsx` | edit | Tombol "Edit Selected (N)" |
| `src/pages/Inventory.tsx` | edit | State + handler + render dua modal baru |
| `src/pages/Inventory.test.tsx` | edit | Test integrasi bulk edit |
| `src/contexts/AssetContext.test.tsx` | baru (opsional) | Unit test `toDbPatch` / batching |

---

## 4. Detail implementasi

### Fase 1 — Tipe

`src/types/asset.ts`:

```ts
/**
 * Field yang boleh diubah lewat bulk edit.
 * `verification` sengaja TIDAK ada di sini — lihat "bulk edit asset inventory.md" §2.4.
 * Perubahan verification hanya lewat EditAssetModal, per aset.
 */
export type AssetBulkPatch = Partial<
  Pick<Asset, 'depreciationMethod' | 'listed' | 'status' | 'itemStatus'>
>;
```

Tipe inilah yang menegakkan keputusan §2.4 di level compiler: `bulkUpdateAssets` tidak bisa
menerima `verification` walau ada kode yang mencoba mengirimnya.

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
  // Tidak ada cabang verification/verification_date di sini — disengaja, lihat §2.4.
  return db;
};
```

Fungsi utama, mengikuti bentuk `deleteMultipleAssets` (batch + `onProgress` + log sekali di akhir):

```ts
const bulkUpdateAssets = async (
  ids: string[],
  patch: AssetBulkPatch,
  onProgress?: (processed: number, failed: number) => void,
): Promise<{ updated: number; failed: number }> => {
  const dbPatch = toDbPatch(patch);
  if (ids.length === 0 || Object.keys(dbPatch).length === 0) return { updated: 0, failed: 0 };

  // Daftarkan Item Status baru ke lookup table sekali saja, bukan per baris.
  if (patch.itemStatus) addItemStatus(patch.itemStatus);

  const BATCH_SIZE = 100;
  let processed = 0;
  let failed = 0;
  let updated = 0;

  for (let i = 0; i < ids.length; i += BATCH_SIZE) {
    const batch = ids.slice(i, i + BATCH_SIZE);
    const { data, error } = await supabase
      .from('assets')
      .update(dbPatch)
      .in('id', batch)
      .select();

    if (error) {
      failed += batch.length;
    } else {
      updated += data?.length ?? 0;
      const byId = new Map((data ?? []).map(row => [row.id, fromDb(row)]));
      setAssets(prev => prev.map(a => byId.get(a.id) ?? a));
    }
    processed += batch.length;
    onProgress?.(processed, failed);
  }

  if (updated > 0) {
    setLastFetchedAt(new Date());
    logActivity({
      actionType: 'BULK_UPDATE',
      entityType: 'asset',
      details: { count: updated, fields: Object.keys(patch) },
    });
  }

  // AFTER-trigger reclassification menulis balik ke assets setelah RETURNING dievaluasi,
  // jadi hasil .select() bisa basi untuk item_status DAN verification (§2.2 A).
  // Resync agar UI == DB.
  if (patch.itemStatus !== undefined) {
    await fetchAll();
  }

  return { updated, failed };
};
```

Tambahkan ke interface `AssetContextType` dan ke object `value` provider.

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
});
const [values, setValues] = useState({
  depreciationMethod: 'Straight Line',
  listed: 'Audited',
  status: 'Active',
  itemStatus: '',
});
```

Reset `enabled` + `values` ke default setiap kali modal dibuka (`useEffect` on `isOpen`),
supaya tidak ada patch nyangkut dari sesi sebelumnya.

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

**Verification tidak ditampilkan sama sekali** — bukan sebagai kontrol yang di-disable, bukan
pula sebagai baris berlabel "not available". Menampilkannya dalam bentuk apa pun mengundang user
mencarinya di sini. Modal cukup memuat 4 field di atas, apa adanya.

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

**Tombol Apply** `disabled` bila tidak ada field yang di-enable, atau bila
`enabled.itemStatus && values.itemStatus.trim() === ''`.

**Props:**

```ts
interface BulkEditModalProps {
  isOpen: boolean;
  /** Baris penuh, bukan sekadar jumlah — panel Item Status perlu membaca `verification`
   *  tiap aset untuk menghitung berapa yang akan berubah jadi Verified. */
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

`onApply` membangun patch hanya dari key yang `enabled`.

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

  const { updated, failed } = await bulkUpdateAssets(ids, patch, (processed, failedCount) => {
    setBulkEditProgress(prev => ({ ...prev, processed, failedCount }));
  });

  setBulkEditProgress(prev => ({ ...prev, status: 'done' }));
  setSelectedAssets(new Set());
  setNotice(
    failed > 0
      ? { message: `Updated ${updated} assets, ${failed} failed`, variant: 'error' }
      : { message: `Updated ${updated} asset${updated === 1 ? '' : 's'}`, variant: 'success' },
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
9. Modal **tidak merender kontrol Verification** dalam bentuk apa pun — kontrol input dengan
   label `/verification/i` → `null`. Test ini yang mengunci keputusan §2.4 supaya tidak
   diam-diam kembali lewat refactor.
10. Setelah Apply sukses → `selectedAssets` kosong dan toast sukses muncul.

Unit test `toDbPatch` (bisa lewat `AssetContext.test.tsx` baru, atau ekspor helper-nya):

11. `{ itemStatus: 'Inventory' }` → hanya key `item_status`.
12. Patch apa pun → hasilnya **tidak pernah** mengandung `verification` maupun
    `verification_date`.
13. `{}` → `{}` (dan `bulkUpdateAssets` langsung return tanpa memanggil supabase).
14. Patch menyentuh `itemStatus` → `fetchAll` dipanggil sekali di akhir;
    patch yang hanya berisi `status` → `fetchAll` **tidak** dipanggil.

Manual QA (setelah project Supabase di-*resume*) — fokus pada verifikasi tabel perilaku di §2.2:

15. Bulk `Item Status = 'Inventory'` untuk 3 aset **unverified** → konfirmasi ketiganya
    jadi `Verification = Yes` dengan tanggal hari ini, dan hitungan di panel modal
    (§4 Fase 4) cocok dengan hasil akhirnya. Ini baris pertama tabel §2.2 — perilaku yang
    memang diinginkan.
16. Bulk `Item Status = 'Inventory'` untuk 3 aset yang **sudah** verified → cek apakah
    `assets.item_status` dan `asset_reclassifications.category` jadi tidak sinkron
    (baris ketiga tabel §2.2). Kalau terbukti, catat sebagai isu terpisah — halaman
    Inventory dan Reclassification akan menampilkan Item Status berbeda untuk aset yang sama.
17. **Konfirmasi bug baris keempat masih ada** sebelum mengandalkan §2.5: lewat SQL langsung
    (bukan UI, karena UI sudah memblokirnya), jalankan
    `update assets set item_status = 'Needs Review' where id = '<aset-verified>'` lalu cek
    `verification` tetap `true` dan `reclass.category` tidak berubah. Kalau ternyata sudah
    ter-*unverify* dengan benar, berarti trigger sudah diperbaiki di luar dokumen ini dan
    §2.5 boleh ditinjau ulang.
18. Bulk `Status` / `Listed` / `Depreciation Method` (tanpa Item Status) untuk 3 aset campuran
    verified & unverified → konfirmasi `verification` dan `verification_date` **tidak berubah
    sama sekali**. Ini bukti bahwa 3 field itu benar-benar aman dirilis lebih dulu.
19. Cek Notification Bell menampilkan "memperbarui N aset sekaligus".
20. Uji dengan ≥ 250 aset tercentang → progress bar bergerak per 100, tidak ada timeout,
    dan tabel menampilkan nilai final yang benar setelah `refetch()`.

---

## 6. Risiko & batasan

| Risiko | Dampak | Mitigasi |
|---|---|---|
| **Bulk `Item Status` menandai ratusan aset sebagai Verified** (§2.2 A, baris 1) | Sesuai definisi field (Verification = turunan Item Status), tapi tetap perubahan audit berskala besar dari satu klik | Panel penjelasan + **hitungan riil** aset yang akan berubah, ditampilkan sebelum Apply (§4 Fase 4); dikonfirmasi lewat QA #15 |
| **`Item Status = 'Needs Review'` tidak meng-unverify aset yang sudah verified** (§2.2 A, baris 4) | Inkonsistensi 3 arah: label berubah, `verification` tidak, aset tidak kembali ke antrean review | `'Needs Review'` dikeluarkan dari pilihan bulk edit + divalidasi di input bebas ketik (§2.5). Akar masalahnya di trigger, §7 |
| Item Status kustom (`'Lost'`, salah ketik, dll) ikut menandai aset Verified | Aturannya `<> 'Needs Review'`, bukan daftar putih — nilai apa pun memverifikasi | Panel penjelasan menyatakan aturannya apa adanya, bukan menyebut `Asset`/`Inventory` saja; pertimbangkan mengunci Item Status ke daftar lookup sebagai isu terpisah |
| Cascade reclassification membanjiri halaman Reclassification | Data noise besar, sulit di-undo | Panel penjelasan + hitungan baris di modal sebelum Apply |
| `assets.item_status` vs `reclassifications.category` desync untuk aset yang sudah verified | Dua halaman menampilkan Item Status berbeda | Dikonfirmasi lewat QA #16; kalau terbukti, tangani sebagai isu trigger terpisah |
| `.select()` mengembalikan nilai pre-AFTER-trigger | UI beda dari DB | `refetch()` otomatis bila patch menyentuh `itemStatus` |
| Satu batch gagal → 100 baris ditandai gagal padahal sebagian mungkin sukses | Hitungan di progress modal pesimistis | `refetch()` di akhir + hitungan `updated` diambil dari `data.length`, bukan asumsi |
| Tidak ada undo | Bulk edit 500 baris salah field tidak bisa dibatalkan | Ringkasan konfirmasi di footer modal; pertimbangkan Export Selected ke CSV sebagai backup sebelum Apply |
| Operasi tidak atomik (per batch) | Gagal di tengah → sebagian ter-update | Diterima; konsisten dengan `deleteMultipleAssets`. Kalau atomicity jadi kebutuhan, ganti ke RPC (butuh migrasi) |
| Trigger belum terverifikasi terhadap DB live | Asumsi bisa meleset | Jalankan query `pg_trigger` di §2.3 sebelum mulai koding |

## 7. Di luar scope

- **Bulk edit `Verification`** — dikeluarkan secara sadar, alasannya di §2.4. Kalau suatu saat
  dibuka kembali, keputusan itu harus datang bersama mekanisme jejak audit yang layak (mis.
  `verification_source` untuk membedakan pemeriksaan fisik dari bulk edit), bukan sekadar
  menambah field ke modal.
- Undo / rollback bulk edit.
- Bulk edit untuk field numerik/teks (`assetCost`, `lifeInMonths`, `subsidiary`, dll).
- Bulk edit dari halaman Reclassification atau Maintenance.
- Preview diff per baris sebelum Apply.
- Bypass trigger reclassification (ditolak — berisiko desinkronisasi data).
- **Perbaikan trigger sync `assets` ⇄ `asset_reclassifications`**, akar dari kasus A di §2.2.
  Sudah ditelusuri di dokumen terpisah: [`reclassification trigger fix.md`](./reclassification%20trigger%20fix.md).

  Dua hal yang harus masuk perbaikan itu, dari temuan §2.2:

  1. Guard `WHERE ... AND category = 'Needs Review'` di `sync_category_from_asset_item_status()`
     membuat arah `→ Needs Review` tidak pernah berjalan untuk aset yang sudah verified
     (baris keempat tabel §2.2).
  2. `verification_date` di-stempel `CURRENT_DATE` oleh trigger tanpa membedakan pemeriksaan
     fisik dari perubahan label — akar dari kekhawatiran jejak audit di §2.4.

  > **Kalau perbaikan itu dikerjakan lebih dulu**, baris keempat tabel §2.2 hilang di level
  > database, dan §2.5 boleh ditinjau ulang — `'Needs Review'` bisa dipertimbangkan kembali
  > sebagai pilihan bulk edit. Tapi §2.4 tetap alasan yang berdiri sendiri untuk menahannya:
  > perbaikan trigger membuat bulk un-verify *berjalan benar*, bukan membuatnya *aman*.
  > QA #17 adalah cara mengecek apakah perbaikan itu sudah masuk. `refetch()` di §4 Fase 2
  > tetap dibutuhkan (kasus B tidak berubah).
