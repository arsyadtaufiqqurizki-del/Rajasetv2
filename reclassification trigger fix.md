# Perbaikan Trigger Sync: assets ⇄ asset_reclassifications

Dokumen ini menindaklanjuti §2.2 dan §7 di [`bulk edit asset inventory.md`](./bulk%20edit%20asset%20inventory.md).
Masalahnya **bukan** milik bulk edit — sudah berdampak pada edit satuan hari ini. Bulk edit hanya
memperbesar skalanya dari 1 baris jadi ratusan.

Status: **analisis + rekomendasi** (belum diimplementasikan).
Tanggal: 2026-08-31.

---

## 1. Kondisi sekarang

Tiga kolom menyimpan state yang saling tumpang tindih:

| Kolom | Makna nominal |
|---|---|
| `assets.verification` (bool) | Sudah diperiksa fisik atau belum |
| `assets.item_status` (text) | Klasifikasi hasil audit: `Asset` / `Inventory` / … |
| `asset_reclassifications.category` (text) | Sama dengan dua-duanya sekaligus |

Empat trigger menjaga dua invariant:

- `category = 'Needs Review'` ⟺ `verification = false`
- `category` = `item_status`

Sejak `20260817000000` men-drop kolom `asset_reclassifications.verified`, dan
`20260818010000` menetapkan "satu baris reclassification per aset ter-link", baris ter-link
praktis **tidak menyimpan informasi independen apa pun** selain `remarks`, `verified_by`, dan
`verification_date`. Sisanya duplikat dari `assets`.

## 2. Dua cacat yang berbeda

**Cacat A — konflasi (`verification` diturunkan dari `category`).**
`sync_asset_verification_from_category()` menghitung `verification = (NEW.category <> 'Needs Review')`.
Nilai `'Needs Review'` dipakai ganda: sebagai *nilai klasifikasi* sekaligus *sentinel "belum
diverifikasi"*. Padahal "sudah diperiksa orang" dan "ini Asset atau Inventory" dua hal berbeda.
→ Menyebabkan **kasus C** (ganti Item Status ⇒ Verification ter-flip jadi Yes).

**Cacat B — writeback yang kebablasan.**
Fungsi yang sama menulis **ketiga** kolom (`verification`, `verification_date`, `item_status`)
setiap kali `category` berubah, termasuk saat perubahan itu **berasal dari `assets` sendiri**.
Round-trip-nya menimpa nilai yang baru saja di-set user.
→ Menyebabkan **kasus A, B, D**.

Bukti bahwa ini dianggap bug, bukan desain: `ReclassificationContext.syncFromAssets`
(`src/contexts/ReclassificationContext.tsx:274-277`) sudah menambal gejala yang sama secara
manual di sisi aplikasi —

```ts
category: a.verification ? (a.itemStatus || 'Asset') : 'Needs Review',
// "so linking doesn't silently flip already-unverified assets to verified"
```

Trigger tidak pernah ikut ditambal, jadi jalur lain (EditAssetModal, dan nanti bulk edit) masih
terbuka.

---

## 3. Tiga opsi

### Opsi 1 — Perbaiki plumbing, pertahankan model turunan ✅ **rekomendasi**

Dua perubahan, satu file migrasi, **nol perubahan front-end**:

1. **Gabungkan dua trigger sisi `assets` jadi satu.** Sumber kasus D adalah dua trigger terpisah
   yang antre dan saling menimpa karena masing-masing membaca snapshot `NEW` dari statement asli.
   Satu trigger yang menghitung `target_category` sekali menghilangkan ketergantungan pada urutan
   alfabet nama trigger.
2. **Buat writeback tidak menimpa.** `'Needs Review'` diperlakukan murni sebagai sentinel
   verifikasi — ia tidak boleh menghapus `item_status`. Ditambah guard `IS DISTINCT FROM` supaya
   penulisan yang tidak perlu tidak terjadi sama sekali.

Yang penting: trigger baru membaca `NEW.verification` **langsung**, bukan menyimpulkannya dari
`category`. Itulah yang mematikan cacat A tanpa perlu mengubah skema.

**Konvergensi tanpa `pg_trigger_depth()`.** Rekursi berhenti karena guard `IS DISTINCT FROM`,
bukan karena deteksi kedalaman trigger — jadi tidak bergantung pada perilaku
`pg_trigger_depth()` di klausa `WHEN` yang ambigu (0 vs 1). Semua jalur konvergen dalam ≤ 2 hop:

| Aksi | Hop 1 | Hop 2 | Berhenti karena |
|---|---|---|---|
| assets: `verification` → false | reclass `category` → `'Needs Review'` | writeback: `verification` sudah false, `item_status` **dipertahankan** | tidak ada kolom yang berubah |
| assets: `item_status` → `'Inventory'` (aset unverified) | `target_category` = `'Needs Review'` (karena `verification=false`), sudah sama | — | guard `IS DISTINCT FROM` |
| reclass: `category` → `'Asset'` (tombol Verify) | writeback: `verification`=true, `item_status`=`'Asset'` | assets trigger: `target_category` = `'Asset'`, sudah sama | guard `IS DISTINCT FROM` |
| reclass: `category` → `'Needs Review'` (un-verify) | writeback: `verification`=false, `item_status` dipertahankan | assets trigger: `target` = `'Needs Review'`, sudah sama | guard `IS DISTINCT FROM` |

**Hasil terhadap empat kasus di rencana bulk edit:**

| Kasus | Sebelum | Sesudah Opsi 1 |
|---|---|---|
| A — Verification=No menimpa Item Status | `item_status` → `'Needs Review'` | `item_status` **tidak disentuh** ✓ |
| B — Verification=Yes menimpa Item Status | `item_status` → `'Asset'` | `item_status` **dipertahankan** ✓ |
| C — Item Status mem-flip Verification | `verification` → true + stempel tanggal | `verification` **tidak berubah** ✓ |
| D — dua field sekaligus saling menimpa | input user dibuang | deterministik, input user menang ✓ |

**Konsekuensi bagi bulk edit:** aturan saling-eksklusif Verification ⇄ Item Status di modal
(§4 Fase 4 rencana bulk edit) jadi **tidak perlu lagi** — kasus D hilang di level database.
Warning cascade tetap perlu, tapi isinya menyusut jadi sekadar "baris Reclassification ikut
ter-update", bukan "field lain ikut berubah".

**Batasan yang tersisa (diterima sadar):** untuk aset yang belum terverifikasi tapi
`item_status`-nya sudah diisi (mis. `'Inventory'`), baris reclassification tetap
menampilkan `'Needs Review'`. Satu kolom `category` tidak bisa mengekspresikan klasifikasi dan
status verifikasi sekaligus — itu cacat A yang tidak disentuh Opsi 1. Ini berubah dari
*korupsi data* jadi *keterbatasan tampilan*, yang jauh lebih bisa diterima.

**Effort:** 1 migrasi, ~70 baris SQL. Tanpa perubahan TypeScript. Tanpa perubahan UI.

### Opsi 2 — Pisahkan kolom: kembalikan `verified` ke `asset_reclassifications`

Kembalikan boolean yang di-drop `20260817000000`, sehingga `category` jadi klasifikasi murni dan
`verified` jadi status verifikasi murni. `'Needs Review'` berhenti jadi sentinel. Ini menyelesaikan
cacat A secara benar.

**Masalahnya:** membatalkan keputusan desain yang disengaja, dan menyentuh banyak front-end —
`ReclassificationContext.fromDb` (baris 61 menurunkan `verified` dari `category`),
`verifyReclassification`, `syncFromAssets`, filter & stats halaman Reclassification,
`VerifyReclassificationModal`. Migrasi datanya juga lossy: baris ber-`category = 'Needs Review'`
tidak punya klasifikasi asli untuk dipulihkan — nilainya sudah hilang tertimpa.

**Verdict:** paling buruk dari dua dunia — churn UI signifikan, tapi duplikasi `assets` ⇄
`asset_reclassifications` tetap ada.

### Opsi 3 — Hapus duplikasinya: `assets` jadi satu-satunya sumber kebenaran

Untuk baris ter-link, `asset_reclassifications` berhenti menyimpan `category` sama sekali dan
membacanya lewat join `linked_asset` yang **sudah ada** di `RECLASSIFICATION_SELECT`. Tabel itu
tinggal menyimpan metadata audit yang memang miliknya sendiri: `remarks`, `verified_by`,
`verification_date`. Tombol Verify menulis ke `assets`. Keempat trigger sync dihapus.

Pola ini sudah dipakai di codebase: `fromDb` sudah me-resolve `assetDescription`, `location`,
`ownership`, `unit` dari join, bukan dari kolom sendiri (`ReclassificationContext.tsx:43-66`).
Memperluasnya ke `category`/`verified` justru konsisten. Kolom `category` tetap dipertahankan
untuk baris tak-ter-link (`asset_id IS NULL`, temuan manual).

**Verdict:** perbaikan arsitektural yang sesungguhnya — seluruh kelas bug ini lenyap permanen,
bukan ditambal. Tapi effort-nya paling besar dan menyentuh halaman Reclassification secara
menyeluruh. Layak dikerjakan, tapi bukan sebagai prasyarat bulk edit.

---

## 4. Rancangan migrasi Opsi 1

Nama usulan: `supabase/migrations/20260831000000_fix_asset_reclassification_sync.sql`

```sql
-- Memperbaiki dua cacat pada sync assets <-> asset_reclassifications:
--
-- 1) Dua trigger terpisah di sisi `assets` (item_status & verification) antre pada
--    UPDATE yang menyentuh kedua kolom. Keduanya membaca snapshot NEW dari statement
--    asli, jadi yang berjalan belakangan (urut alfabet nama trigger) menimpa hasil
--    yang pertama -- input user terbuang diam-diam. Digabung jadi satu trigger yang
--    menghitung target category sekali.
--
-- 2) sync_asset_verification_from_category() menulis ketiga kolom setiap kali category
--    berubah, termasuk saat perubahan itu berasal dari `assets` sendiri. Round-trip-nya
--    menimpa nilai yang baru saja di-set user. 'Needs Review' sekarang diperlakukan
--    murni sebagai sentinel verifikasi dan tidak lagi menghapus item_status.
--
-- Konvergensi dijamin guard IS DISTINCT FROM di kedua arah, bukan pg_trigger_depth().

-- === Arah 1: assets -> asset_reclassifications =============================

DROP TRIGGER IF EXISTS trg_sync_category_from_asset_item_status ON assets;
DROP TRIGGER IF EXISTS trg_sync_category_from_asset_verification_insert ON assets;
DROP TRIGGER IF EXISTS trg_sync_category_from_asset_verification_update ON assets;
DROP FUNCTION IF EXISTS sync_category_from_asset_item_status();
DROP FUNCTION IF EXISTS sync_category_from_asset_verification();

CREATE OR REPLACE FUNCTION sync_reclassification_from_asset()
RETURNS TRIGGER AS $$
DECLARE
  target_category TEXT;
BEGIN
  -- verification dibaca LANGSUNG, tidak disimpulkan dari category -- inilah yang
  -- mencegah perubahan item_status mem-flip status verifikasi.
  target_category := CASE
    WHEN NEW.verification = false THEN 'Needs Review'
    ELSE COALESCE(NULLIF(NEW.item_status, ''), 'Asset')
  END;

  IF EXISTS (SELECT 1 FROM asset_reclassifications WHERE asset_id = NEW.id) THEN
    UPDATE asset_reclassifications
    SET category = target_category, updated_at = NOW()
    WHERE asset_id = NEW.id
      AND category IS DISTINCT FROM target_category;
  ELSIF NEW.verification = false THEN
    -- Hanya aset yang belum terverifikasi yang di-antrekan ke worklist audit.
    -- Aset terverifikasi tanpa baris reclassification dibiarkan tanpa baris,
    -- sesuai perilaku 20260815020000 (penting: impor CSV 5000 baris terverifikasi
    -- tidak boleh membuat 5000 baris reclassification).
    INSERT INTO asset_reclassifications (asset_id, category, created_by)
    VALUES (NEW.id, 'Needs Review', auth.uid());
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sync_reclassification_from_asset_insert
AFTER INSERT ON assets
FOR EACH ROW
WHEN (NEW.verification = false)
EXECUTE FUNCTION sync_reclassification_from_asset();

CREATE TRIGGER trg_sync_reclassification_from_asset_update
AFTER UPDATE ON assets
FOR EACH ROW
WHEN (OLD.verification IS DISTINCT FROM NEW.verification
   OR OLD.item_status  IS DISTINCT FROM NEW.item_status)
EXECUTE FUNCTION sync_reclassification_from_asset();

-- === Arah 2: asset_reclassifications -> assets =============================
-- Trigger-nya tidak berubah (trg_sync_asset_verification_from_category_insert
-- dan _update dari 20260815020000); hanya fungsinya yang diganti.

CREATE OR REPLACE FUNCTION sync_asset_verification_from_category()
RETURNS TRIGGER AS $$
DECLARE
  is_verified BOOLEAN;
  next_item_status TEXT;
BEGIN
  IF NEW.asset_id IS NULL THEN
    RETURN NEW;
  END IF;

  is_verified := (NEW.category <> 'Needs Review');

  SELECT CASE WHEN is_verified THEN NEW.category ELSE a.item_status END
    INTO next_item_status
  FROM assets a WHERE a.id = NEW.asset_id;

  UPDATE assets
  SET verification      = is_verified,
      verification_date = CASE WHEN is_verified THEN CURRENT_DATE ELSE NULL END,
      -- 'Needs Review' adalah sentinel verifikasi, bukan klasifikasi:
      -- un-verify tidak boleh menghapus Item Status milik aset.
      item_status       = next_item_status
  WHERE id = NEW.asset_id
    AND (verification IS DISTINCT FROM is_verified
      OR item_status  IS DISTINCT FROM next_item_status);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### Perubahan perilaku yang perlu dikonfirmasi ke pemilik proses bisnis

1. **Un-verify dari halaman Reclassification tidak lagi mengosongkan `Item Status`.**
   Sebelumnya `item_status` ikut jadi `'Needs Review'`. Sekarang klasifikasinya dipertahankan.
   Ini yang membuat kasus A/B hilang — perlu dipastikan sesuai ekspektasi auditor.
2. **Verify tidak lagi memaksa `Item Status = 'Asset'`.** Aset ber-`Item Status = 'Inventory'`
   yang diverifikasi akan tetap `'Inventory'`.
3. `verification_date` tetap dikosongkan (`NULL`) saat un-verify — sama seperti sekarang, dan
   konsisten dengan `EditAssetModal`.

### Data lama

**Tidak ada backfill yang bisa diandalkan.** Nilai `item_status` yang sudah tertimpa di masa lalu
sudah hilang — tidak ada riwayat untuk memulihkannya. Yang bisa dilakukan hanya mengukur
dampaknya sebelum migrasi:

```sql
-- Berapa aset yang item_status-nya kemungkinan hasil clobber?
select verification, item_status, count(*)
from assets
group by 1, 2
order by 3 desc;
```

Aset dengan `verification = false AND item_status = 'Needs Review'` bersifat ambigu: tidak bisa
dibedakan antara "memang perlu direview" dan "tertimpa trigger". Dokumentasikan, jangan ditebak.

---

## 5. Rencana verifikasi

Project Supabase `ousbnycezagukyxzavmi` sedang **paused**, jadi seluruh analisis di dokumen ini
berasal dari pembacaan file migrasi dan semantik trigger Postgres — **belum diverifikasi terhadap
database live**. Sebelum migrasi ini di-apply, jalankan dulu inventaris trigger:

```sql
select tgname, pg_get_triggerdef(oid)
from pg_trigger
where not tgisinternal
  and tgrelid in ('assets'::regclass, 'asset_reclassifications'::regclass)
order by tgrelid::regclass::text, tgname;
```

Lalu, pada branch Supabase (bukan production), uji tiap kasus pada satu baris:

| # | Aksi | Ekspektasi |
|---|---|---|
| 1 | `update assets set verification=false where id=X` (X verified, `item_status='Inventory'`) | `item_status` tetap `'Inventory'`; reclass `category='Needs Review'` |
| 2 | `update assets set verification=true where id=X` (X unverified, `item_status='Inventory'`) | `item_status` tetap `'Inventory'`; reclass `category='Inventory'` |
| 3 | `update assets set item_status='Inventory' where id=X` (X unverified) | `verification` tetap `false`; `verification_date` tetap `NULL` |
| 4 | `update assets set verification=false, item_status='Inventory' where id=X` | `item_status='Inventory'` (input user menang); reclass `'Needs Review'` |
| 5 | `update asset_reclassifications set category='Asset' where asset_id=X` | `verification=true`, `verification_date=today`, `item_status='Asset'` |
| 6 | `update asset_reclassifications set category='Needs Review' where asset_id=X` | `verification=false`, `item_status` **tidak berubah** |
| 7 | `insert into assets (...) values (... verification=false ...)` | tepat **satu** baris reclassification `'Needs Review'` |
| 8 | `insert into assets (...) values (... verification=true ...)` | **nol** baris reclassification (perilaku lama dipertahankan) |
| 9 | Impor CSV 100 baris verified | nol baris reclassification baru, tanpa timeout |

Regresi front-end yang wajib dijalankan setelahnya: `npm run test` (khususnya
`Inventory.test.tsx`), plus QA manual tombol Verify/Un-verify di halaman Reclassification dan
`EditAssetModal`.

---

## 6. Rekomendasi urutan kerja

1. **Resume project Supabase**, jalankan inventaris trigger di §5 untuk memvalidasi asumsi
   dokumen ini terhadap database sebenarnya.
2. **Konfirmasi tiga perubahan perilaku di §4** ke pemilik proses audit. Kalau salah satunya
   ditolak, rancangan trigger perlu disesuaikan sebelum ditulis.
3. **Apply Opsi 1** di branch Supabase, jalankan 9 uji di §5.
4. **Baru kerjakan bulk edit.** Dengan Opsi 1 sudah masuk, aturan saling-eksklusif
   Verification ⇄ Item Status di modal bisa dicoret dari rencana, dan warning-nya disederhanakan.
5. **Catat Opsi 3 sebagai backlog arsitektur.** Selama `assets` dan `asset_reclassifications`
   sama-sama menyimpan klasifikasi yang sama, kelas bug ini bisa muncul lagi lewat jalur baru.

Mengerjakan bulk edit lebih dulu tanpa perbaikan ini bukan blocker mutlak — rencana bulk edit
sudah memuat mitigasi di level UI. Tapi artinya kita mengirim fitur yang **memperbanyak**
pemakaian jalur yang sudah diketahui rusak, dan mitigasi UI-nya (saling eksklusif + warning)
harus dibongkar lagi setelah trigger diperbaiki.
