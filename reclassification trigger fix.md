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

## 2. Tiga cacat yang berbeda

**Cacat A — konflasi (`verification` diturunkan dari `category`).**
`sync_asset_verification_from_category()` menghitung `verification = (NEW.category <> 'Needs Review')`.
Nilai `'Needs Review'` dipakai ganda: sebagai *nilai klasifikasi* sekaligus *sentinel "belum
diverifikasi"*. Padahal "sudah diperiksa orang" dan "ini Asset atau Inventory" dua hal berbeda.
→ Mengubah Item Status pada aset unverified mem-flip Verification jadi Yes + stempel tanggal
hari ini.

**Cacat B — writeback yang kebablasan.**
Fungsi yang sama menulis **ketiga** kolom (`verification`, `verification_date`, `item_status`)
setiap kali `category` berubah, termasuk saat perubahan itu **berasal dari `assets` sendiri**.
Round-trip-nya menimpa nilai yang baru saja di-set user.
→ Mengubah Verification menimpa Item Status; mengubah keduanya sekaligus membuang input user.

**Cacat C — arah `assets → reclass` mandek untuk aset yang sudah verified.**
`sync_category_from_asset_item_status()` hanya menyentuh baris yang **sudah** `'Needs Review'`:

```sql
WHERE asset_id = NEW.id AND category = 'Needs Review';   -- guard-nya di sini
```

Untuk aset verified (`category = 'Asset'`), set `item_status = 'Needs Review'` tidak cocok
dengan `WHERE` itu → 0 baris → tidak ada writeback → `verification` **tetap `true`**. Blok
`IF NOT EXISTS` juga tidak menolong karena barisnya memang ada.

Hasilnya inkonsisten di tiga tempat sekaligus: `assets.item_status = 'Needs Review'`,
`assets.verification = true`, `asset_reclassifications.category = 'Asset'` — dan aset itu
**tidak kembali ke antrean Needs Review** meski labelnya sudah berubah.

Cacat ini kebalikan arah dari Cacat A, dan sama-sama berakar pada satu kolom `category` yang
dipaksa memikul dua makna. Opsi 1 memperbaikinya sebagai efek dari mengganti guard itu dengan
`target_category` + `IS DISTINCT FROM`.

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

**Hasil terhadap tiap cacat:**

| Skenario | Sebelum | Sesudah Opsi 1 | Cacat |
|---|---|---|---|
| Verification=No, Item Status punya nilai | `item_status` → `'Needs Review'` | `item_status` **dipertahankan** ✓ | B |
| Verification=Yes | `item_status` → `'Asset'` | `item_status` **dipertahankan** ✓ | B |
| Item Status diubah pada aset **unverified** | `verification` → true + stempel tanggal | `verification` **tidak berubah** ✓ | A |
| Item Status → `'Needs Review'` pada aset **verified** | tidak terjadi apa-apa; `verification` tetap true | `verification` → **false**, aset kembali ke antrean ✓ | C |
| Verification + Item Status diubah sekaligus | input user dibuang | deterministik, input user menang ✓ | B |

**Konsekuensi bagi bulk edit — lebih besar dari sekadar menyederhanakan warning.** Rencana bulk
edit sekarang memuat **5 field**, termasuk `Verification`, jadi Opsi 1 menyentuh dua dari lima
field itu sekaligus. Yang berubah di sana:

- **§2.2 kasus A dihapus** beserta tabel perilaku 4 barisnya. Baris ketiga tabel di atas
  menghapus seluruh keterkaitan Item Status ⇄ Verification untuk setiap nilai selain
  `'Needs Review'` — tidak ada lagi cascade.
- **§2.2 kasus B dihapus**, dan ini yang paling penting: bulk `Verification` berhenti menghapus
  label `Item Status` ratusan baris sekaligus. Kasus B adalah satu-satunya risiko bulk edit yang
  **tidak bisa dimitigasi dari front-end** — di sana modal hanya bisa memberi tahu label mana
  yang akan hilang. Untuk field `Verification`, Opsi 1 bukan penyederhanaan, ia satu-satunya
  perbaikan yang ada.
- **§2.2 kasus C dihapus.** Trigger gabungan menghitung `target_category` sekali, jadi mengirim
  `Verification` + `Item Status` dalam satu patch jadi deterministik dan kedua input bertahan di
  `assets` — tidak ada lagi input user yang dibuang diam-diam.
- Panel penjelasan + hitungan "N aset akan jadi Verified" untuk **Item Status** di §4 Fase 4
  **dihapus**; Item Status jadi field biasa seperti Status atau Listed. Panel dampak
  **Verification** hanya **menyusut**: bagian "label Item Status yang akan hilang" dibuang,
  bagian hitungan baris yang benar-benar berpindah status tetap ada.
- `BulkEditModal` **tetap** butuh baris aset penuh (`selectedAssets: Asset[]`) — bukan lagi untuk
  cascade Item Status, tapi untuk menghitung berapa aset yang benar-benar berpindah status
  verifikasi. Aturan "baris yang sudah berada di nilai target tidak disentuh" (§1 dan §2.4 poin 1
  di sana) berdiri di atas alasan jejak audit, bukan trigger, jadi Opsi 1 tidak menyentuhnya.
- `refetch()` setelah patch `itemStatus`/`verification` berhenti jadi load-bearing: guard
  `IS DISTINCT FROM` di writeback membuat round-trip-nya 0 baris, jadi `.select()` tidak lagi
  basi. Boleh dipertahankan sebagai jaring pengaman murah.
- **§2.4 berubah judul, bukan isi.** Verification sekarang di dalam scope bulk edit; kekhawatiran
  jejak audit di sana tidak diselesaikan Opsi 1 dan tidak dimaksudkan diselesaikan olehnya —
  pemecahannya kolom `verification_source`, isu tersendiri.
- **§2.5 (`'Needs Review'` tidak ditawarkan) tetap berlaku, dan justru makin perlu.** Hari ini
  aksi itu setengah jalan (Cacat C); sesudah Opsi 1 ia berjalan penuh, jadi benar-benar
  meng-*unverify* ratusan aset sekaligus. Perbaikan ini membuat aksi tersebut **benar**, bukan
  **aman** — dan jalur yang memang dirancang untuk itu, `Verification = No`, sudah ada di modal
  yang sama. Satu aksi, satu kontrol.
- **§2.6 (Verification ⇄ Item Status saling eksklusif) turun status** dari keharusan teknis jadi
  pilihan UX, karena kasus C hilang. Boleh ditinjau ulang, tapi tidak wajib dibongkar.

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
4. **`'Needs Review'` berhenti bisa dipilih sebagai Item Status di Asset Inventory.** Di halaman
   Reclassification ia tetap ada. Ini bukan opsional — perubahan (1) yang membukanya jadi
   kondisi mandek. Lihat §6.3 untuk telusuran dan migrasi datanya.

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
| 3b | `update assets set item_status='Needs Review' where id=X` (X **verified**, `category='Asset'`) | **Cacat C:** `verification` → `false`, `verification_date` → `NULL`, reclass `category='Needs Review'`. Sebelum migrasi, ketiganya tidak berubah sama sekali — jalankan uji ini **dua kali**, sebelum dan sesudah apply, untuk membuktikan perbaikannya |
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

## 6. UX journey sesudah perbaikan

### 6.1 Model mentalnya berubah: dari satu sumbu jadi dua

**Sebelum.** `verification` dan `item_status` praktis satu hal yang sama, karena keduanya
disimpulkan dari `category`. Mengubah satu menyeret yang lain. Tidak ada cara mengatakan
"aset ini **Inventory**, tapi **belum** saya periksa".

**Sesudah.** Dua sumbu yang benar-benar independen:

| Sumbu | Pertanyaan yang dijawab | Siapa yang mengubah |
|---|---|---|
| `verification` | *Sudah diperiksa fisik atau belum?* | Auditor, sengaja, per aset |
| `item_status` | *Klasifikasinya apa — Asset, Inventory, …?* | Siapa pun yang mendata, kapan saja |

`asset_reclassifications.category` berhenti jadi kolom mandiri dan jadi **proyeksi** dari
keduanya:

```
category = verification ? item_status : 'Needs Review'
```

Konsekuensi yang harus dipahami tim: **halaman Reclassification bukan menampilkan klasifikasi
aset, melainkan status antrean audit.** Aset unverified selalu tampil `Needs Review` di sana —
berapa pun Item Status-nya di Asset Inventory. Itu bukan desync, itu definisi kolomnya.

### 6.2 Lima jalur yang berubah

**Jalur 1 — Aset baru masuk.**
Aset dibuat dengan `verification = false` → otomatis muncul satu baris `Needs Review` di antrean.
Aset yang diimpor sudah terverifikasi → **tidak** membuat baris reclassification. Tidak berubah
dari sekarang, dan sengaja: impor CSV 5000 baris terverifikasi tidak boleh membanjiri antrean.

**Jalur 2 — Mendata klasifikasi sebelum memeriksa.** ⭐ *baru, ini yang tadinya mustahil*
Staf mengisi `Item Status = Inventory` pada aset yang belum diperiksa. Sesudah perbaikan:
klasifikasi tersimpan, `Verification` **tetap No**, dan aset **tetap di antrean**.
Sebelum perbaikan, aksi ini diam-diam menandai aset itu terverifikasi hari ini.

Di halaman Reclassification aset itu masih tertulis `Needs Review` — benar, karena memang belum
diperiksa. Klasifikasinya terlihat di Asset Inventory.

**Jalur 3 — Auditor memverifikasi aset.**
Set `Verification = Yes` di `EditAssetModal`. `verification_date` terisi hari ini,
**`Item Status` tidak disentuh** — aset ber-Item Status `Inventory` tetap `Inventory`, tidak
dipaksa jadi `Asset` seperti sekarang. Barisnya keluar dari antrean dan muncul dengan
klasifikasi aslinya.

**Jalur 4 — Auditor mengembalikan aset ke antrean.**
Set `Verification = No`. Aset kembali ke antrean, `verification_date` dikosongkan, dan
**`Item Status` dipertahankan** — tidak lagi dihapus jadi `Needs Review` seperti sekarang.
Saat nanti diverifikasi ulang, klasifikasinya masih ada, tidak perlu diketik dari nol.

**Jalur 5 — Tombol Verify di halaman Reclassification.**
Tetap bekerja seperti sekarang: set `category` → `assets.verification = true` +
`item_status = category`. Halaman Reclassification tetap jadi tempat yang sah untuk
mem-*verify* dan meng-*unverify*, karena di sanalah `Needs Review` punya makna sebagai aksi.

### 6.3 Jebakan baru yang harus ditutup bersamaan

Perbaikan ini **membuka satu kondisi mandek** yang sekarang tersembunyi oleh bug.

`item_statuses` di-seed dengan tiga nilai — `Asset`, `Inventory`, dan **`Needs Review`** — jadi
`Needs Review` bisa dipilih sebagai Item Status di `AddAssetModal` / `EditAssetModal` hari ini.
Telusuri aset ber-`item_status = 'Needs Review'` yang diverifikasi:

```
target_category = COALESCE(NULLIF('Needs Review',''), 'Asset') = 'Needs Review'
→ category sudah 'Needs Review' → guard IS DISTINCT FROM menahan → tidak ada writeback
```

Hasilnya: `verification = true`, tapi `category = 'Needs Review'`. Aset itu **tampil terverifikasi
di Asset Inventory sekaligus mendekam di antrean Needs Review** di halaman Reclassification, dan
tidak ada aksi di UI yang bisa mengeluarkannya selain mengganti Item Status-nya.

Sekarang kondisi ini tidak terjadi hanya karena bug: verifikasi menimpa `item_status` jadi
`'Asset'`. Begitu penimpaan itu diperbaiki (dan memang harus), jebakannya terbuka.

**Perbaikannya: `'Needs Review'` berhenti ditawarkan sebagai Item Status di mana pun di Asset
Inventory** — bukan hanya di bulk edit (§2.5 rencana bulk edit), tapi juga di `AddAssetModal`,
`EditAssetModal`, dan hapus dari seed `item_statuses`.

Alasannya konsisten dengan seluruh dokumen ini: `'Needs Review'` adalah **sentinel verifikasi,
bukan klasifikasi**. Di Asset Inventory ia cuma duplikat dari `Verification = No` — dan
sekarang duplikat yang bisa berkonflik. Di halaman Reclassification ia **tetap ada** dan tetap
bermakna, karena di sana memilihnya adalah aksi "kembalikan ke antrean".

Cakupan kerjanya kecil: satu filter di sumber opsi Item Status, plus satu migrasi data untuk
aset yang terlanjur ber-`item_status = 'Needs Review'`:

```sql
-- Aset unverified: 'Needs Review' redundan dengan verification=false -> kosongkan.
-- Aset verified: sudah mandek hari ini -> beri klasifikasi default.
update assets set item_status = case when verification then 'Asset' else '' end
where item_status = 'Needs Review';

delete from item_statuses where name = 'Needs Review';
```

Jalankan hitungannya dulu sebelum memutuskan default `'Asset'` itu tepat:

```sql
select verification, count(*) from assets where item_status = 'Needs Review' group by 1;
```

---

## 7. Rekomendasi urutan kerja

Kuncinya: dari 5 field bulk edit, **dua bersentuhan dengan trigger ini — `Item Status` dan
`Verification`.** `Depreciation Method`, `Listed`, dan `Status` tidak muncul di klausa `WHEN`
trigger mana pun — mengubahnya tidak memicu apa-apa. Jadi rencana bulk edit bisa dibelah, dan
urutannya jadi:

1. **Resume project Supabase**, jalankan inventaris trigger di §5 untuk memvalidasi asumsi
   dokumen ini terhadap database sebenarnya. Jalankan juga uji **3b** untuk memastikan Cacat C
   memang ada sebelum diperbaiki.
2. **Bulk edit tahap 1 — 3 field non-trigger** (`Depreciation Method`, `Listed`, `Status`).
   Bisa dikerjakan **paralel** dengan langkah 3, karena nol ketergantungan. Ini yang membuat
   fitur bulk edit bisa sampai ke user tanpa menunggu keputusan proses bisnis.
3. **Konfirmasi tiga perubahan perilaku di §4** ke pemilik proses audit. Ini langkah manusia,
   bukan teknis — bisa memakan waktu, dan itulah alasan langkah 2 tidak menunggunya.
4. **Apply Opsi 1** di branch Supabase, jalankan 10 uji di §5 (termasuk 3b sebagai pembuktian
   Cacat C).
5. **Tutup jebakan `'Needs Review'` (§6.3) di rilis yang sama dengan Opsi 1**, bukan sesudahnya.
   Opsi 1 yang membuka kondisi mandek itu, jadi keduanya harus mendarat bersama: hapus
   `'Needs Review'` dari opsi Item Status di `AddAssetModal`/`EditAssetModal`, dari seed
   `item_statuses`, dan jalankan migrasi datanya.
6. **Bulk edit tahap 2 — tambahkan field `Item Status` dan `Verification`.** Setelah Opsi 1
   masuk, `Item Status` jadi field biasa: tanpa cascade, tanpa panel hitungan, tanpa `refetch()`
   yang load-bearing. `Verification` jadi aman dikerjakan: writeback berhenti menghapus label
   `Item Status` (Cacat B), yang merupakan satu-satunya risiko fitur itu yang tidak bisa
   dimitigasi dari front-end. Yang **tetap dipasang** terlepas dari migrasi ini: aturan §2.5
   (`'Needs Review'` tidak ditawarkan — dan setelah langkah 5 aturan itu berlaku global, bukan
   khusus bulk edit) dan aturan §1/§2.4 bahwa baris yang sudah berada di nilai Verification
   target tidak di-UPDATE sama sekali, supaya `verification_date` aslinya tidak tertimpa.
7. **Catat Opsi 3 sebagai backlog arsitektur.** Selama `assets` dan `asset_reclassifications`
   sama-sama menyimpan klasifikasi yang sama, kelas bug ini bisa muncul lagi lewat jalur baru.

**Kenapa tahap 2 sebaiknya menunggu** — dua alasan yang berbeda untuk dua field:

- **`Item Status`: kode yang dibuang.** Mengerjakannya lebih dulu berarti menulis panel
  penjelasan, hitungan aset-yang-akan-jadi-Verified, dan `refetch()` yang load-bearing — lalu
  **membongkar semuanya** begitu Opsi 1 masuk. Itu bukan mitigasi yang dipertahankan, itu kode
  yang dibuang. Ditambah, sampai Opsi 1 masuk, fitur ini melipatgandakan pemakaian jalur yang
  sudah diketahui rusak dari 1 baris jadi ratusan.
- **`Verification`: kerusakan yang tidak bisa ditambal.** Ini alasan yang lebih kuat. Sebelum
  Opsi 1, setiap bulk `Verification` **menghapus label `Item Status`** pada tiap baris yang
  berubah (Cacat B) — `'Asset'` saat Yes, `'Needs Review'` saat No — dan nilai lamanya tidak bisa
  direkonstruksi dari mana pun. Front-end tidak punya cara mencegahnya; yang bisa dilakukan modal
  hanyalah menampilkan daftar nilai yang akan hilang dan meminta user menerimanya. Merilis ini
  lebih dulu berarti menukar data auditor dengan waktu tunggu satu migrasi.

**Kalau tahap 2 memang harus rilis sekarang juga**, rencana bulk edit versi sekarang sudah
lengkap memuat mitigasinya (§2.2 kasus A–D, §2.5, §2.6, panel dampak di §4 Fase 4) — bisa
dijalankan apa adanya, dengan catatan bahwa sebagiannya akan dihapus lagi nanti, dan bahwa
Cacat B tidak punya mitigasi, hanya pengungkapan.
