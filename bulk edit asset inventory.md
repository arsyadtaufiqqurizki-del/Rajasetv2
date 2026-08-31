# Bulk Edit — Asset Inventory

Rencana implementasi fitur **bulk edit** untuk halaman Asset Inventory, mencakup 5 field:
`Depreciation Method`, `Listed`, `Status`, `Verification`, `Item Status`.

Status: **rencana** (belum diimplementasikan).
Tanggal: 2026-08-31.

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
| `verification_date` | Set `Verification = Yes` → isi tanggal **hari ini**. Set `No` → kosongkan (`null`). Konsisten dengan `EditAssetModal.handleVerificationChange`. |
| Trigger reclassification | **Dibiarkan jalan**, dengan warning eksplisit di modal. Tidak ada migrasi bypass. |
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
| Verification | `verification` | BOOLEAN NOT NULL DEFAULT false |
| Item Status | `item_status` | TEXT NOT NULL DEFAULT '' |
| (turunan) Verification Date | `verification_date` | DATE (nullable) |

RLS untuk UPDATE pada `assets` sudah aktif dan dipakai `updateAsset()` hari ini, jadi tidak
ada policy baru. `activity_logs.action_type` bertipe TEXT **tanpa CHECK constraint**
(`supabase/migrations/20260701000000_create_activity_logs.sql`), jadi menambah action type
baru `BULK_UPDATE` tidak butuh migrasi.

> **Kesimpulan: fitur ini murni perubahan front-end. Nol file migrasi baru.**

### 2.2 Trigger cascade — risiko utama fitur ini

Dua dari lima field, `verification` dan `item_status`, terikat **dua arah** dengan
`asset_reclassifications`. Konsekuensinya bukan sekadar "ada baris lain yang ikut berubah":
**nilai akhir di database bisa berbeda dari yang diketik user di modal.**

#### Trigger yang aktif hari ini

Penting: `20260815020000_unify_reclassification_category_with_verification.sql` **men-drop**
`trg_auto_queue_asset_for_reclassification_*` beserta fungsinya, dan `20260817000000` men-drop
kolom `asset_reclassifications.verified`. Jadi yang benar-benar hidup sekarang hanya 4 trigger:

Pada `assets` (AFTER UPDATE, di luar `trg_assets_updated_at` yang BEFORE):

| Trigger | WHEN | Efek |
|---|---|---|
| `trg_sync_category_from_asset_item_status` | `OLD.item_status IS DISTINCT FROM NEW.item_status` | UPDATE `category` baris yang masih `'Needs Review'`; INSERT baris baru bila aset belum punya baris sama sekali |
| `trg_sync_category_from_asset_verification_update` | `OLD.verification IS DISTINCT FROM NEW.verification` | `false` → set baris terakhir jadi `'Needs Review'` (atau INSERT bila belum ada); `true` → set baris `'Needs Review'` jadi `'Asset'` |

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

#### Konsekuensi konkret

**A. Bulk `Verification = No` → `Item Status` semua aset ikut jadi `'Needs Review'`**

User hanya mencentang Verification. Yang terjadi per aset:
`verification=false` → baris reclassification jadi `'Needs Review'` → tulis balik
`assets.item_status = 'Needs Review'`.
Aset yang tadinya `Item Status = 'Inventory'` berubah jadi `'Needs Review'` tanpa diminta.
Ini terjadi pada **100% aset terpilih** yang statusnya berubah.

**B. Bulk `Verification = Yes` → `Item Status` ikut jadi `'Asset'`**

Jalur cermin dari A: baris `'Needs Review'` jadi `'Asset'` → tulis balik
`assets.item_status = 'Asset'`. Kena pada aset terpilih yang sebelumnya unverified.

**C. Bulk `Item Status` → `Verification` ikut ter-flip jadi `Yes` (paling mengejutkan)**

User hanya mencentang Item Status, misal set ke `'Inventory'`. Untuk aset yang **sekarang
unverified** (baris reclassification-nya `'Needs Review'`, atau belum punya baris sama sekali):
`category` jadi `'Inventory'` → tulis balik `verification = ('Inventory' <> 'Needs Review')` =
**`true`**, plus `verification_date = CURRENT_DATE`.
Artinya: mengganti Item Status massal **diam-diam menandai ratusan aset sebagai sudah
diverifikasi hari ini**, padahal tidak ada yang memverifikasi apa pun. Ini yang paling berbahaya
dari sisi integritas data audit.

Efek samping kedua: untuk aset yang **sudah** verified, klausa `AND category = 'Needs Review'`
membuat baris reclassification tidak ikut ter-update, sehingga `assets.item_status` dan
`asset_reclassifications.category` jadi **tidak sinkron** untuk aset-aset itu.

**D. Enable `Verification = No` DAN `Item Status` bersamaan → input user ditimpa**

Satu statement UPDATE mengubah dua kolom, jadi kedua trigger di `assets` antre. Postgres
menjalankan AFTER ROW trigger **urut alfabet nama trigger**, dan tiap trigger memakai snapshot
`NEW` dari statement asli — bukan hasil trigger sebelumnya. Karena
`..._item_status` < `..._verification_update` secara alfabet:

1. Trigger item_status jalan → `category = 'Inventory'` → tulis balik `verification=true`, `item_status='Inventory'`
2. Trigger verification jalan (masih membaca `NEW.verification = false`) → `category = 'Needs Review'` → tulis balik `verification=false`, `item_status='Needs Review'`

Hasil akhir: `item_status = 'Needs Review'`, **bukan** `'Inventory'` yang diketik user.
Kombinasi ini secara diam-diam membuang input user.

**E. `.select()` mengembalikan nilai basi**

`.select()` di supabase-js = `UPDATE ... RETURNING`. RETURNING dievaluasi saat baris ditulis,
sedangkan AFTER ROW trigger baru jalan di akhir statement. Jadi semua penulisan balik di poin
A–D **tidak terlihat** di hasil `.select()`. Tanpa penanganan, tabel Inventory akan menampilkan
nilai yang berbeda dari isi database sampai user refresh manual.

#### Mitigasi yang diambil

- **Verification dan Item Status dibuat saling eksklusif di modal.** Mencentang salah satu
  men-disable yang lain, disertai penjelasan singkat. Ini menutup kasus D sepenuhnya, dan
  memaksa user melakukan dua operasi terpisah yang hasilnya dapat diprediksi.
- **Warning eksplisit menyebut efek silang**, bukan sekadar "Reclassification akan berubah":
  - Verification di-enable → *"Item Status of all selected assets will also be set to
    `Needs Review` / `Asset`."*
  - Item Status di-enable → *"Assets that are currently unverified will also be marked
    Verified with today's date."*
- **`refetch()` wajib** setelah batch selesai bila patch menyentuh `verification` atau
  `itemStatus` (kasus E).
- Batch tetap 100 — tiap baris memicu rantai 3–4 statement tambahan; batch besar menaikkan
  risiko statement timeout.

> Kalau efek silang ini dianggap **bug**, bukan fitur, perbaikannya bukan di bulk edit
> melainkan di trigger (`item_status = NEW.category` sebaiknya tidak menimpa nilai yang
> di-set eksplisit). Itu migrasi tersendiri di luar scope dokumen ini — lihat §7.

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

Khusus kasus D (urutan trigger), verifikasi empirik pada satu baris uji sebelum bergantung pada
analisisnya:

```sql
-- harapan: item_status berakhir 'Needs Review', bukan 'Inventory'
update assets set verification = false, item_status = 'Inventory' where id = '<id-uji>';
select verification, verification_date, item_status from assets where id = '<id-uji>';
```

---

## 3. Perubahan file

| File | Aksi | Ringkasan |
|---|---|---|
| `src/types/asset.ts` | edit | Tambah tipe `AssetBulkPatch` |
| `src/contexts/AssetContext.tsx` | edit | Tambah `toDbPatch()` + `bulkUpdateAssets()`, expose di context |
| `src/lib/activityLogger.ts` | edit | Tambah `'BULK_UPDATE'` ke union `ActionType` |
| `src/components/NotificationBell.tsx` | edit | Tambah `case 'BULK_UPDATE'` di formatter notifikasi |
| `src/components/BulkEditModal.tsx` | **baru** | Form bulk edit 5 field + warning cascade |
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
/** Field yang boleh diubah lewat bulk edit. verificationDate diturunkan, bukan diinput. */
export type AssetBulkPatch = Partial<
  Pick<Asset, 'depreciationMethod' | 'listed' | 'status' | 'verification' | 'itemStatus'>
>;
```

### Fase 2 — `AssetContext.bulkUpdateAssets()`

Tambah helper `toDbPatch` **terpisah** dari `toDb` yang sudah ada. `toDb` tidak bisa dipakai
ulang: ia membangun objek lengkap, sehingga field yang tidak diisi akan tertimpa `null`/`''`.

```ts
const todayISO = () => new Date().toISOString().split('T')[0];

const toDbPatch = (patch: AssetBulkPatch): Record<string, unknown> => {
  const db: Record<string, unknown> = {};
  if (patch.depreciationMethod !== undefined) db.depreciation_method = patch.depreciationMethod;
  if (patch.listed !== undefined) db.listed = patch.listed;
  if (patch.status !== undefined) db.status = patch.status;
  if (patch.itemStatus !== undefined) db.item_status = patch.itemStatus;
  if (patch.verification !== undefined) {
    db.verification = patch.verification;
    // Cermin EditAssetModal: Yes -> tanggal hari ini, No -> dikosongkan.
    db.verification_date = patch.verification ? todayISO() : null;
  }
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
  // jadi hasil .select() bisa basi untuk dua field ini. Resync agar UI == DB.
  if (patch.verification !== undefined || patch.itemStatus !== undefined) {
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
  verification: false,
  itemStatus: false,
});
const [values, setValues] = useState({
  depreciationMethod: 'Straight Line',
  listed: 'Audited',
  status: 'Active',
  verification: 'No',
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
- **Verification** — radio horizontal: `Yes`, `No`. Di bawahnya teks bantu:
  *"Setting Yes will stamp today's date ({todayISO}) as Verification Date. Setting No will clear it."*
- **Item Status** — `ui/AutocompleteInput` dengan `options={itemStatuses}`, boleh nilai baru
  (akan didaftarkan ke `item_statuses` oleh `bulkUpdateAssets`).

**Saling eksklusif Verification ⇄ Item Status** (mitigasi kasus D di §2.2):

```ts
const toggleField = (key: keyof typeof enabled) => {
  setEnabled(prev => {
    const next = { ...prev, [key]: !prev[key] };
    // Mengubah keduanya dalam satu UPDATE membuat trigger saling menimpa
    // dan input Item Status user terbuang — lihat "bulk edit asset inventory.md" §2.2 D.
    if (key === 'verification' && next.verification) next.itemStatus = false;
    if (key === 'itemStatus' && next.itemStatus) next.verification = false;
    return next;
  });
};
```

Field yang ter-disable karena aturan ini diberi teks kecil:
*"Can't be combined with {Verification|Item Status} in one bulk edit — apply them separately."*

**Warning cascade** — panel amber, isinya berbeda tergantung field mana yang di-enable:

- `enabled.verification`:
  > ⚠️ **This also changes Item Status.** Setting Verification to **Yes** will set Item Status
  > to `Asset` for all **N** selected assets; setting it to **No** will set Item Status to
  > `Needs Review`. The matching rows on the Reclassification page are updated too.

- `enabled.itemStatus`:
  > ⚠️ **This also changes Verification.** Selected assets that are currently **unverified**
  > will be marked **Verified** with today's date ({todayISO}), because Reclassification derives
  > verification from Item Status. The matching rows on the Reclassification page are updated
  > too, and new rows are created for assets that don't have one yet.

Warning ini harus tetap tampil walau user hanya melakukan hal yang terlihat sepele — efeknya
tidak terlihat di tabel sampai `refetch()` selesai.

**Ringkasan konfirmasi** di footer, di atas tombol:

> Applying **{jumlah field}** change(s) to **{N}** selected assets.

**Tombol Apply** `disabled` bila tidak ada field yang di-enable, atau bila
`enabled.itemStatus && values.itemStatus.trim() === ''`.

**Props:**

```ts
interface BulkEditModalProps {
  isOpen: boolean;
  selectedCount: number;
  itemStatuses: string[];
  onCancel: () => void;
  onApply: (patch: AssetBulkPatch) => void;
}
```

`onApply` membangun patch hanya dari key yang `enabled`, dan mengkonversi
`verification: 'Yes' | 'No'` → `boolean`.

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
`<BulkEditModal>` dan `<BulkEditProgressModal>` bersama modal-modal lain di akhir JSX.

---

## 5. Rencana test

`src/pages/Inventory.test.tsx` (ikuti pola yang sudah ada di file itu):

1. Tombol **Edit Selected** tidak muncul saat tidak ada baris tercentang.
2. Centang 2 baris → tombol muncul dengan hitungan `(2)`.
3. Buka modal → tombol **Apply** disabled sampai minimal satu field di-enable.
4. Enable `Status`, pilih `Retired`, Apply → `bulkUpdateAssets` dipanggil dengan
   `(['id1','id2'], { status: 'Retired' })` — memastikan field lain **tidak** ikut terkirim.
5. Enable `Verification = Yes` → panel warning cascade tampil dan menyebut Item Status.
6. Enable `Verification` → kontrol `Item Status` jadi disabled, dan sebaliknya (kasus D).
7. Setelah Apply sukses → `selectedAssets` kosong dan toast sukses muncul.

Unit test `toDbPatch` (bisa lewat `AssetContext.test.tsx` baru, atau ekspor helper-nya):

8. `{ verification: true }` → `{ verification: true, verification_date: '<today>' }`.
9. `{ verification: false }` → `{ verification: false, verification_date: null }`.
10. `{ status: 'Active' }` → hanya key `status`, tidak ada `verification_date`.
11. `{}` → `{}` (dan `bulkUpdateAssets` langsung return tanpa memanggil supabase).
12. Patch menyentuh `verification`/`itemStatus` → `fetchAll` dipanggil sekali di akhir;
    patch yang hanya berisi `status` → `fetchAll` **tidak** dipanggil.

Manual QA (setelah project Supabase di-*resume*) — fokus pada verifikasi kasus A–D di §2.2:

13. Bulk `Verification = No` untuk 3 aset verified yang `Item Status`-nya `'Inventory'` →
    konfirmasi ketiganya berubah jadi `'Needs Review'` (kasus A), dan baris Reclassification
    ter-update **tanpa duplikat** per aset.
14. Bulk `Item Status = 'Inventory'` untuk 3 aset **unverified** → konfirmasi ketiganya
    ikut jadi `Verification = Yes` dengan tanggal hari ini (kasus C). Ini perilaku yang
    diperingatkan di modal, bukan bug implementasi.
15. Bulk `Item Status` untuk 3 aset yang **sudah** verified → cek apakah
    `assets.item_status` dan `asset_reclassifications.category` jadi tidak sinkron
    (efek samping kasus C). Kalau iya, catat sebagai isu terpisah.
16. Cek Notification Bell menampilkan "memperbarui N aset sekaligus".
17. Uji dengan ≥ 250 aset tercentang → progress bar bergerak per 100, tidak ada timeout,
    dan tabel menampilkan nilai final yang benar setelah `refetch()`.

---

## 6. Risiko & batasan

| Risiko | Dampak | Mitigasi |
|---|---|---|
| **Bulk `Item Status` diam-diam menandai ratusan aset sebagai Verified** (§2.2 C) | Integritas data audit rusak — aset tercatat terverifikasi padahal tidak pernah diperiksa | Warning eksplisit di modal; kalau tidak dapat diterima secara bisnis, hapus Item Status dari scope bulk edit sampai trigger diperbaiki |
| **Bulk `Verification` menimpa `Item Status`** (§2.2 A/B) | Field yang tidak dipilih user ikut berubah | Warning eksplisit menyebut nilai akhirnya (`Asset` / `Needs Review`) |
| Verification + Item Status dalam satu patch saling menimpa (§2.2 D) | Input user terbuang diam-diam | Dua field dibuat saling eksklusif di modal |
| Cascade reclassification membanjiri halaman Reclassification | Data noise besar, sulit di-undo | Warning eksplisit + hitungan baris di modal sebelum Apply |
| `assets.item_status` vs `reclassifications.category` desync untuk aset yang sudah verified | Dua halaman menampilkan Item Status berbeda | Dikonfirmasi lewat QA #15; kalau terbukti, tangani sebagai isu trigger terpisah |
| `.select()` mengembalikan nilai pre-AFTER-trigger | UI beda dari DB | `refetch()` otomatis bila patch menyentuh `verification`/`itemStatus` |
| Satu batch gagal → 100 baris ditandai gagal padahal sebagian mungkin sukses | Hitungan di progress modal pesimistis | `refetch()` di akhir + hitungan `updated` diambil dari `data.length`, bukan asumsi |
| Tidak ada undo | Bulk edit 500 baris salah field tidak bisa dibatalkan | Ringkasan konfirmasi di footer modal; pertimbangkan Export Selected ke CSV sebagai backup sebelum Apply |
| Operasi tidak atomik (per batch) | Gagal di tengah → sebagian ter-update | Diterima; konsisten dengan `deleteMultipleAssets`. Kalau atomicity jadi kebutuhan, ganti ke RPC (butuh migrasi) |
| Trigger belum terverifikasi terhadap DB live | Asumsi bisa meleset | Jalankan query `pg_trigger` di §2.3 sebelum mulai koding |

## 7. Di luar scope

- Undo / rollback bulk edit.
- Bulk edit untuk field numerik/teks (`assetCost`, `lifeInMonths`, `subsidiary`, dll).
- Bulk edit dari halaman Reclassification atau Maintenance.
- Preview diff per baris sebelum Apply.
- Bypass trigger reclassification (ditolak — berisiko desinkronisasi data).
- **Perbaikan trigger sync `assets` ⇄ `asset_reclassifications`**, akar dari kasus A–D di §2.2.
  Sudah ditelusuri di dokumen terpisah: [`reclassification trigger fix.md`](./reclassification%20trigger%20fix.md).

  > **Kalau perbaikan itu dikerjakan lebih dulu**, kasus A–D hilang di level database dan
  > rencana ini menyusut: aturan saling-eksklusif Verification ⇄ Item Status di §4 Fase 4
  > **dicoret**, warning cascade disederhanakan jadi sekadar "baris Reclassification ikut
  > ter-update", dan QA #13–15 diganti dengan uji di §5 dokumen tersebut. `refetch()` di
  > §4 Fase 2 tetap dibutuhkan (kasus E tidak berubah).
