# Rencana Upgrade UI/UX — Asset Inventory

**Tanggal:** 8 September 2026
**Scope:** Halaman `/inventory` — `src/pages/Inventory.tsx` (496 baris) + `AssetTable.tsx` · `AssetFilters.tsx` · `AssetToolbar.tsx` · `AssetTablePagination.tsx` · `ColumnVisibilityDropdown.tsx` · `AddAssetModal.tsx` · `EditAssetModal.tsx` + hook `useAssetFilters` / `useColumnVisibility`
**Status:** Rencana — belum ada yang dikerjakan
**Data produksi saat audit:** 2.881 aset, 10 subsidiary, 17 kolom tabel, 10 baris per halaman

---

## 1. Ringkasan Eksekutif

Asset Inventory adalah halaman dengan **fungsi paling lengkap** di aplikasi ini — 9 dimensi filter, multi-select dengan chip, URL persistence, column visibility, bulk edit, bulk delete berbatch, import/export CSV dengan progress modal dan laporan baris invalid. Secara fitur, halaman ini jauh di depan Dashboard maupun Reclassification.

Masalahnya bukan di fitur. Masalahnya: **halaman ini dirancang untuk tabel puluhan baris, tapi dipakai untuk 2.881 baris.**

Empat masalah terbesar:

1. **Tabel tidak bisa diurutkan sama sekali.** Pencarian `sortBy|sortKey|onSort|sortDirection` di seluruh `src/` menghasilkan **nol hasil**. Tidak ada satu pun kolom yang bisa di-sort. Untuk menjawab "aset apa yang paling mahal?" atau "apa yang paling baru masuk?", pengguna harus export CSV lalu buka Excel. Filter yang canggih jadi setengah berguna tanpa pengurutan.

2. **Navigasi 289 halaman hanya dengan tombol Prev/Next.** `itemsPerPage = 10` di-hardcode (`Inventory.tsx:42`), dan `AssetTablePagination` hanya menyediakan panah kiri/kanan. Untuk sampai ke halaman 150, pengguna klik 149 kali. Tidak ada input lompat halaman, tidak ada pilihan 25/50/100 baris.

3. **Tidak ada loading state dan tidak ada error state.** `Inventory.tsx:34` mengambil dari `useAsset()` tanpa `loading` dan tanpa `error`, padahal keduanya tersedia di context (`AssetContext.tsx:10, 107`) dan **sudah dipakai Dashboard** (`Dashboard.tsx:169-185` dengan `DashboardSkeleton` + tombol "Try again"). Akibatnya selama 2.881 aset di-fetch, Inventory menampilkan tabel kosong dengan tulisan "Showing 0 of 0 entries" — persis seperti tampilan "data Anda hilang". Kalau fetch gagal, tampilannya sama persis, tanpa pesan dan tanpa cara mencoba ulang.

4. **Seleksi bertahan melewati perubahan filter.** `selectedAssets` tidak pernah direset saat filter berubah. Pengguna bisa mencentang 50 aset, mengganti filter subsidiary, dan tombol **"Delete Selected (50)"** tetap muncul — mengoperasikan 50 baris yang tidak lagi terlihat di layar. Ini bukan ketidaknyamanan; ini jalur menuju penghapusan data yang tidak disengaja.

Ditambah satu hal yang langsung terlihat di screenshot: **kolom pertama tabel menampilkan UUID database mentah** (`18832dbf-de1f-464e-9043-34991ff0414f`), pecah jadi 4 baris, karena `asset.assetBook || asset.id` (`AssetTable.tsx:22`) jatuh ke kunci internal saat Asset Book kosong.

Dokumen ini memetakan **30 temuan** (9 dampak tinggi, 14 sedang, 7 rendah), lalu menyusunnya jadi 4 fase kerja berurutan.

---

## 2. Konteks Pengguna

| Persona | Yang dilakukan di halaman ini | Frekuensi |
|---|---|---|
| **Staf Aset / Admin** | Input aset baru, import CSV bulanan, koreksi data, verifikasi fisik | Harian |
| **Finance / Akuntansi** | Cari aset tertentu, cek Book Value, export subset untuk rekonsiliasi | Mingguan |
| **Auditor** | Filter per subsidiary + Listed, telusuri aset bernilai besar, tandai Verification | Kuartalan |
| **Manajemen** | Sesekali melihat aset termahal / terbaru per anak perusahaan | Bulanan |

**Job-to-be-done utama:** *"Temukan sekelompok aset tertentu, pastikan datanya benar, lalu ubah atau keluarkan datanya."*

Tiga verba itu — **temukan → pastikan → ubah** — jadi kerangka penilaian di seluruh dokumen ini.
Kondisi sekarang: **temukan** kuat di filter tapi lumpuh tanpa sorting dan pagination yang layak; **pastikan** lemah karena tidak ada tampilan detail dan tidak ada ringkasan agregat; **ubah** kuat (bulk edit, bulk delete, import) tapi rawan karena seleksi tidak terikat pada apa yang terlihat.

---

## 3. Temuan Audit

Kode temuan: `IA` = arsitektur informasi & konten · `ST` = state, feedback & keamanan aksi · `A11Y` = aksesibilitas · `VD` = visual design · `RSP` = responsif · `PERF` = performa · `CONS` = konsistensi dengan bagian aplikasi lain.

### 3.1 Arsitektur Informasi & Konten

**IA-1 · Kolom pertama menampilkan UUID database mentah — DAMPAK TINGGI**
`AssetTable.tsx:22` — `render: (asset) => asset.assetBook || asset.id`. Ketika `assetBook` kosong (kondisi umum pada data hasil import), sel menampilkan UUID 36 karakter. Di screenshot terlihat pecah jadi 4 baris (`18832dbf-` / `de1f-464e-` / `9043-` / `34991ff0414f`), memakan kolom terlebar kedua di layar untuk informasi yang **tidak berarti apa pun bagi pengguna** dan tidak bisa dicari (search hanya mencakup `assetDescription` dan `assetNumber`, lihat `useAssetFilters.ts:33`).
Efek berantai: UUID inilah penyebab utama tinggi baris tidak konsisten (lihat VD-1) — hanya ~4 baris yang muat di layar padahal satu halaman berisi 10.

**IA-2 · Tidak ada pengurutan kolom sama sekali — DAMPAK TINGGI**
Nol hasil untuk `sortBy|sortKey|onSort|sortDirection` di seluruh `src/`. `useListFilters.ts` mengembalikan `filtered` sebagai hasil `rows.filter(...)` murni — urutan apa pun yang datang dari context dipertahankan apa adanya.
Konsekuensi konkret untuk 2.881 baris: pertanyaan "aset termahal", "yang paling baru", "yang paling lama umurnya", "yang belum diverifikasi paling lama" **tidak bisa dijawab di dalam aplikasi**. Ini juga menjelaskan kenapa Export CSV jadi jalur keluar de-facto — Excel dipakai untuk pekerjaan yang seharusnya bisa dilakukan tabelnya sendiri.

**IA-3 · Pagination hanya Prev/Next untuk 289 halaman — DAMPAK TINGGI**
`Inventory.tsx:42` — `itemsPerPage = 10` hardcode. `AssetTablePagination.tsx` hanya punya `ChevronLeft` dan `ChevronRight`.
2.881 ÷ 10 = **289 halaman**. Tidak ada: input nomor halaman, tombol First/Last, pemilih ukuran halaman (25/50/100), atau penunjuk rentang baris ("101–110 dari 2.881" — yang ada hanya "Showing 10 of 2881 entries", tidak menyebut posisi).
Dampak: setelah filter menyempitkan hasil ke ~200 baris pun, itu masih 20 halaman klik satu-satu.

**IA-4 · Tidak ada ringkasan agregat dari hasil filter — DAMPAK SEDANG**
`Inventory.tsx:116-119` sudah menghitung `computeBookValue` untuk **seluruh** 2.881 aset dan menyimpannya di `Map`. Biaya komputasinya sudah dibayar. Tapi yang ditampilkan hanya per baris, dan hanya 10 baris yang terlihat.
Halaman tidak pernah menjawab: berapa **total Asset Cost** hasil filter ini? Berapa **total Book Value**-nya? Berapa **total unit**-nya? Pengguna yang memfilter "Subsidiary: EHK + Asset Class: FA Land" tidak bisa tahu nilainya tanpa export.
Ini adalah nilai gratis terbesar yang tersedia di halaman ini.

**IA-5 · Kolom "Actions" menempati posisi kedua tapi kosong saat idle — DAMPAK SEDANG**
`AssetTable.tsx:203` — tombol Edit/Delete dibungkus `opacity-0 group-hover:opacity-100`. Kolomnya sendiri selalu memakan lebar (~75px) dan berada di posisi **kedua**, sebelum semua data. Di screenshot, kolom "ACTIONS" terlihat sebagai header di atas ruang kosong.
Dua kerugian sekaligus: real estate paling berharga dipakai untuk kolom yang secara visual kosong, dan aksinya tidak bisa ditemukan tanpa hover (tidak ada afordansi).

**IA-6 · Tidak ada tampilan detail aset — DAMPAK SEDANG**
Satu-satunya cara melihat seluruh field sebuah aset adalah membuka **modal Edit**. Ini memakai antarmuka tulis untuk kebutuhan baca: pengguna yang cuma ingin memeriksa memasuki form yang bisa mengubah data, dan setiap pemeriksaan berisiko jadi perubahan tak sengaja.
Alternatifnya sekarang: tampilkan semua 17 kolom lalu scroll horizontal — yang membuat identitas baris hilang (lihat VD-2).

**IA-7 · Empty state tidak membedakan "belum ada data" dan "tidak ada hasil filter" — DAMPAK SEDANG**
`AssetTable.tsx:236-238` merender `<td colSpan>` mentah dengan `copy.emptyState.noAssetData`, padahal proyek sudah punya komponen `TableEmptyRow` di `ui/EmptyState.tsx` yang dipakai `MaintenanceTable`, `ReclassificationTable`, dan `DashboardRecentAssetsPanel`.
Lebih penting: pesannya sama untuk dua situasi yang sangat berbeda. Pengguna yang memasang 6 filter dan mendapat nol hasil melihat pesan yang persis sama dengan pengguna di database kosong — tanpa tombol "Clear Filters" untuk keluar dari jalan buntu.

**IA-8 · Dua format tanggal berdampingan di satu baris — DAMPAK RENDAH**
`AssetTable.tsx:63` memformat `datePlaceInService` dengan `formatDateDMY` (hasil: `01/01/2008`). `AssetTable.tsx:130` merender `verificationDate` **mentah** (hasil: `2008-01-01`). Keduanya kolom tanggal di tabel yang sama.
`formatDateDMY` hanya dipakai di satu tempat di seluruh codebase.

**IA-9 · Export mengabaikan konfigurasi kolom — DAMPAK RENDAH**
`Inventory.tsx:160-178` selalu mengekspor 17 field tetap. Pengguna yang menyembunyikan 10 kolom untuk fokus pada 7 kolom tetap mendapat CSV 17 kolom. Column visibility terasa seperti pengaturan tampilan sementara, bukan definisi "data yang saya kerjakan".

### 3.2 State, Feedback & Keamanan Aksi

**ST-1 · Tidak ada loading state dan tidak ada error state — DAMPAK TINGGI**
`Inventory.tsx:34` — destructuring dari `useAsset()` **tidak menyertakan `loading` maupun `error`**, padahal keduanya ada di context (`AssetContext.tsx:10, 107, 328`) dan sudah dipakai Dashboard:

```tsx
// Dashboard.tsx:169-185 — pola yang sudah ada, tinggal ditiru
{loading ? <DashboardSkeleton /> : error ? (
  <div>… <button onClick={() => refetch()}>Try again</button></div>
) : ( … )}
```

Selama fetch 2.881 aset, Inventory menampilkan header, filter bar penuh, tabel kosong, dan footer "Showing 0 of 0 entries". Bagi pengguna, itu **tidak bisa dibedakan dari kehilangan data**. Kalau fetch benar-benar gagal, tampilannya identik — tidak ada pesan, tidak ada tombol coba lagi, satu-satunya jalan adalah refresh browser.

**ST-2 · Seleksi bertahan saat filter berubah — DAMPAK TINGGI (risiko data)**
`selectedAssets` (`Inventory.tsx:40`) tidak pernah direset di `onFiltersChanged` — callback itu hanya mengembalikan halaman ke 1 (`Inventory.tsx:97`).
Skenario nyata: pilih Subsidiary EHK → centang 50 aset → ganti ke Subsidiary KMJ → tabel berganti isi total, tapi tombol **"Delete Selected (50)"** dan **"Edit Selected (50)"** masih di sana, dan keduanya beroperasi pada 50 ID EHK yang tidak terlihat di layar. Bulk edit akan menulis ke baris yang tidak sedang dilihat pengguna.

**ST-3 · Select-all mencentang seluruh hasil filter lintas halaman tanpa isyarat — DAMPAK TINGGI**
`handleSelectAll` (`Inventory.tsx:133-139`) melakukan `setSelectedAssets(new Set(filteredAssets.map(a => a.id)))` — **seluruh** hasil filter, bukan halaman yang terlihat. Tanpa filter, satu klik = 2.881 aset terpilih.
Tidak ada banner "2.881 aset terpilih di semua halaman · Batalkan seleksi". Satu-satunya isyarat adalah angka di dalam tombol "Delete Selected (2881)".
Checkbox header juga tidak punya state **indeterminate** (`AssetTable.tsx:172-177` hanya `checked`), jadi "sebagian terpilih" tampil identik dengan "tidak ada yang terpilih".
Perlu dicatat sebagai penyeimbang: alur delete sendiri sudah bagus — ketik `DELETE` untuk konfirmasi, progress modal berbatch. Masalahnya ada di *bagaimana angka 2.881 itu sampai ke sana*.

**ST-4 · Modal Add/Edit Asset tidak punya loading state maupun error handling — DAMPAK SEDANG**
`AddAssetModal.tsx:32-60` — `await addAsset(dataToSave)` lalu `setIsAddModalOpen(false)`, tanpa `try/catch` dan tanpa menonaktifkan tombol Save.
Dua akibat: (a) tombol "Save Asset" tetap bisa diklik berulang selama request berjalan → aset duplikat; (b) kalau simpan gagal, modal tetap menutup dan form ter-reset — pengguna kehilangan seluruh isian tanpa satu pun pesan error. `EditAssetModal` mengikuti pola yang sama.
Bandingkan dengan alur bulk edit yang justru sudah punya progress modal lengkap dengan hitungan gagal.

**ST-5 · Toast tidak bisa ditutup dan tidak diumumkan ke screen reader — DAMPAK RENDAH**
`ui/Toast.tsx` tidak punya tombol close dan tidak punya `role="status"` / `aria-live`. Notifikasi hilang sendiri setelah 3 detik (5 detik untuk error). Pesan error import CSV yang panjang ("File exceeds the maximum limit of 5000 rows…") harus dibaca dalam 5 detik, tanpa cara menahannya.

**ST-6 · "Clear Filters" selalu aktif meski tidak ada filter — DAMPAK RENDAH**
`AssetFilters.tsx:159-164` — tombol tidak pernah `disabled`. Mengkliknya saat kondisi bersih tidak melakukan apa pun, tanpa umpan balik.

### 3.3 Aksesibilitas

**A11Y-1 · Tombol aksi tak terlihat tapi tetap bisa difokus keyboard — DAMPAK TINGGI**
`AssetTable.tsx:203` — `opacity-0 group-hover:opacity-100` tanpa varian `group-focus-within:opacity-100`. `opacity: 0` **tidak** menghapus elemen dari urutan tab.
Akibatnya pengguna keyboard men-tab masuk ke tombol **Delete** yang sepenuhnya tak terlihat, tanpa focus ring yang tampak, di setiap baris. Sepuluh baris = 20 tombol hantu per halaman, dan salah satunya destruktif.

**A11Y-2 · Dua modal terpenting tidak memakai komponen Modal bersama — DAMPAK TINGGI**
`ui/Modal.tsx` sudah menyediakan focus trap, Esc-to-close, `createPortal`, `aria-labelledby`, dan body scroll lock. `BulkEditModal.tsx:52` dan `DeleteConfirmModal.tsx:30` memakainya.
`AddAssetModal.tsx:123` dan `EditAssetModal.tsx:146` **tidak** — keduanya merender `<div className="fixed inset-0 z-[100] …">` sendiri. Jadi dua modal yang paling sering dibuka di seluruh aplikasi tidak punya: Esc untuk menutup, focus trap (Tab keluar ke halaman di belakangnya), `role="dialog"`, label dialog, maupun klik backdrop untuk menutup.

**A11Y-3 · Checkbox tabel tanpa label aksesibel — DAMPAK SEDANG**
`AssetTable.tsx:172` dan `:186` — tidak ada `aria-label`. Screen reader membacakan "checkbox, tidak dicentang" tanpa menyebut aset mana. Checkbox select-all juga tidak menyatakan cakupannya.

**A11Y-4 · Dropdown kustom tidak mengikuti pola listbox — DAMPAK SEDANG**
`MultiSelectDropdown`, `ColumnVisibilityDropdown`, dan menu Export di `AssetToolbar` semuanya memakai `<li onClick>` tanpa `role="listbox"` / `role="option"` / `aria-expanded`, dan tanpa navigasi panah atas-bawah atau Enter/Space. Seluruh filter bar — 8 dari 12 kontrolnya — praktis tidak bisa dioperasikan tanpa mouse.

**A11Y-5 · Semantik tabel belum lengkap — DAMPAK RENDAH**
Tidak ada `scope="col"` pada `<th>`, tidak ada `<caption>`. Untuk tabel 17 kolom dengan scroll horizontal, ini membuat navigasi screen reader jauh lebih sulit.

### 3.4 Visual Design

**VD-1 · Tinggi baris tidak konsisten, kapasitas layar terbuang — DAMPAK SEDANG**
Tidak ada `max-width`, `truncate`, atau `whitespace-nowrap` pada sel data mana pun. Di screenshot: baris 1 setinggi 4 baris teks (karena UUID), baris 3 setinggi 3 baris (deskripsi panjang), baris 4 setinggi 1 baris. Hasilnya ritme visual yang gaduh dan **hanya ~4 dari 10 baris yang muat di viewport** — pengguna harus scroll vertikal untuk melihat satu halaman yang isinya cuma 10.

**VD-2 · Tidak ada kolom identitas yang dibekukan saat scroll horizontal — DAMPAK SEDANG**
17 kolom melebihi lebar layar (screenshot terpotong di tengah "ASSET C…"). Saat pengguna scroll ke kanan untuk melihat Depreciation Method atau Item Status, kolom Asset Number dan Asset Description **ikut hilang** — pengguna melihat deretan angka tanpa tahu baris mana miliknya.

**VD-3 · Toolbar 7 kontrol sejajar dengan hierarki lemah — DAMPAK SEDANG**
Baris header memuat: Columns · Import CSV · Download Template · Export · Add New Asset (+ Edit Selected & Delete Selected saat ada seleksi) = hingga **7 tombol**. Hanya "Add New Asset" yang punya bobot berbeda (`bg-primary`); empat lainnya identik (`bg-surface border-outline-variant`), sehingga aksi harian (Add, Export) bersaing sejajar dengan aksi jarang (Download Template).
Tombol Edit/Delete Selected juga **muncul dan menghilang** dari tengah barisan, menggeser posisi tombol lain setiap kali seleksi berubah — target klik yang bergerak.

**VD-4 · Filter bar 12 kontrol tanpa pengelompokan atau collapse — DAMPAK SEDANG**
`AssetFilters.tsx` merender: 1 search + 7 multi-select + 2 date input + 2 number input, semuanya `flex-wrap` sejajar. Di screenshot sudah membungkus jadi 2 baris dan memakan ~130px tinggi **secara permanen**, bahkan ketika pengguna hanya butuh search.
Tidak ada pembeda antara filter yang sering dipakai (Subsidiary, Asset Class, Status) dan yang jarang (Verification, Item Status, rentang cost).

**VD-5 · Warna badge status di luar design token — DAMPAK RENDAH**
`AssetTable.tsx:100-105` mencampur dua sistem dalam satu ekspresi: `bg-emerald-50 border-emerald-200 text-emerald-800` dan `bg-amber-50 border-amber-200 text-amber-800` (palet Tailwind mentah) berdampingan dengan `bg-error-container/40 border-error/20 text-on-error-container` (token design system). Badge Verification (`:124`) juga memakai `emerald` mentah.
Ini masalah yang sama persis dengan VD-2 di dokumen dashboard — warna hardcoded di luar token.

**VD-6 · Bahasa campur dalam satu layar — DAMPAK RENDAH**
`Inventory.tsx:24` mengimpor `i18n/en`; `AssetTable.tsx:6` mengimpor `i18n/id`. Dua bahasa dirender berdampingan dalam satu tabel.
Pesan validasi import CSV juga berbahasa Indonesia di tengah UI Inggris: `'Asset Number kosong'`, `'Asset Description kosong'` (`Inventory.tsx:216-217`), sementara pesan errornya sendiri `'File exceeds the maximum limit of 5000 rows…'` berbahasa Inggris.

### 3.5 Responsif & Performa

**RSP-1 · Kelas tinggi kontainer tidak valid — DAMPAK SEDANG**
`Inventory.tsx:381` — `h-[calc(100vh-[180px])]`. Kurung siku bersarang di dalam arbitrary value; Tailwind **tidak menghasilkan CSS apa pun** untuk kelas ini (dan `100vh-[180px]` juga bukan ekspresi `calc()` yang sah). Tinggi halaman sebenarnya sepenuhnya ditentukan `min-h-[600px]`.
Artinya perilaku "tabel mengisi sisa tinggi layar" yang tampaknya diniatkan tidak pernah aktif — termasuk `sticky top-0` pada `<thead>` (`AssetTable.tsx:167`) yang bergantung pada kontainer bertinggi tetap agar berguna.

**RSP-2 · Tidak ada perilaku mobile untuk toolbar dan filter — DAMPAK SEDANG**
Header sudah punya `flex-col sm:flex-row`, tapi isi `AssetToolbar` (7 tombol) dan `AssetFilters` (12 kontrol) tidak punya breakpoint sendiri. Di layar sempit keduanya membungkus jadi tumpukan panjang yang mendorong tabel jauh ke bawah lipatan.

**PERF-1 · Book Value dihitung untuk 2.881 aset, dipakai 10 — DAMPAK RENDAH**
`Inventory.tsx:116-119` sudah di-`useMemo` dengan dependency yang benar, jadi tidak dihitung ulang setiap render. Tapi ia menghitung seluruh dataset padahal hanya `paginatedAssets` yang dirender. Ini bukan masalah sekarang (dan justru **menguntungkan** kalau IA-4 dikerjakan, karena agregat butuh seluruh data) — dicatat agar tidak dianggap bug saat ada yang membacanya.

**PERF-2 · Import CSV berjalan 500 putaran berurutan — DAMPAK RENDAH**
`Inventory.tsx:243-289` — batch 10 dengan `await Promise.all` per batch. Untuk 5.000 baris itu 500 round-trip berurutan. Progress modal sudah ada dan informatif, jadi pengguna tidak dibiarkan menebak; ini soal durasi, bukan soal umpan balik.

### 3.6 Konsistensi dengan Bagian Aplikasi Lain

**CONS-1 · `AssetTablePagination` menduplikasi `ui/Pagination` — DAMPAK RENDAH**
`AssetTablePagination.tsx` (44 baris) identik secara visual dan struktural dengan `ui/Pagination.tsx`, hanya berbeda nama prop (`currentPage`/`page`, `paginatedCount`/`visibleCount`). Komponen bersama itu dipakai **7 tempat lain**: Maintenance, Reclassification, DashboardRecentAssetsPanel, ReportDetailTable, ReportHistoryTable, AllCategoriesModal, AllSubsidiariesModal.
Inventory satu-satunya yang punya salinan sendiri — artinya perbaikan pagination di Fase 2 harus dikerjakan dua kali kalau tidak disatukan lebih dulu.

**CONS-2 · Filter tanggal tetap tampil MM/DD/YYYY meski sudah diberi `lang="en-GB"` — DAMPAK SEDANG**
`AssetFilters.tsx:133, 143` memasang `lang="en-GB"` pada `<input type="date">` untuk memaksa format DD/MM/YYYY. **Chrome mengabaikan atribut `lang` untuk date input** — formatnya ditentukan oleh setelan bahasa browser/OS, bukan oleh markup. Screenshot mengonfirmasi: kedua input masih menampilkan placeholder `mm/dd/yyyy`.
Hasilnya kontradiksi di satu layar: kolom tabel menampilkan `01/01/2008` (DD/MM, sesuai commit b2e07b4), sementara filter di atasnya meminta input dengan urutan MM/DD. Ini persis jenis ambiguitas yang membuat orang salah memfilter tanpa sadar — dan ini adalah persyaratan yang sudah pernah diminta secara eksplisit.

---

## 4. Rencana Upgrade

Empat fase, diurutkan berdasarkan **risiko yang dihilangkan lebih dulu, baru kemampuan yang ditambahkan**. Setiap fase berdiri sendiri dan bisa dirilis terpisah.

### Fase 1 — Hentikan kebohongan dan risiko (≈ 1 hari) — ✅ SELESAI (8 Sep 2026)

Fase paling murah dengan dampak paling langsung. Tidak ada fitur baru; semuanya memperbaiki hal yang saat ini menyesatkan atau berbahaya.

| # | Pekerjaan | File | Temuan | Status |
|---|---|---|---|---|
| 1.1 | Ambil `loading`, `error`, `refetch` dari `useAsset()`; tambahkan skeleton tabel + panel error dengan tombol "Try again", tiru pola `Dashboard.tsx:169-185` | `Inventory.tsx`, komponen baru `InventorySkeleton.tsx` | ST-1 | ✅ |
| 1.2 | Reset `selectedAssets` di dalam `onFiltersChanged` — seleksi tidak boleh melampaui hasil filter yang melahirkannya | `Inventory.tsx:97` | ST-2 | ✅ |
| 1.3 | Tambahkan banner seleksi di atas tabel: "2.881 aset terpilih di semua halaman · Batalkan seleksi", muncul saat seleksi melampaui halaman yang terlihat; tambahkan state `indeterminate` pada checkbox header | `AssetTable.tsx`, `Inventory.tsx` | ST-3 | ✅ |
| 1.4 | Ganti fallback `asset.assetBook \|\| asset.id` menjadi `asset.assetBook \|\| '—'`; UUID tidak pernah ditampilkan | `AssetTable.tsx:22` | IA-1 | ✅ |
| 1.5 | Tambahkan `group-focus-within:opacity-100` pada wrapper tombol aksi | `AssetTable.tsx:203` | A11Y-1 | ✅ |
| 1.6 | Hapus `h-[calc(100vh-[180px])]`; ganti dengan tinggi yang benar-benar valid (`h-[calc(100vh-11rem)]`) agar sticky header berfungsi | `Inventory.tsx:381` | RSP-1 | ✅ |
| 1.7 | Ganti dua `<input type="date">` filter dengan komponen date picker yang formatnya dikendalikan aplikasi (atau tampilkan label bantu "DD/MM/YYYY" eksplisit) | `AssetFilters.tsx:130-150` | CONS-2 | ✅ (label bantu "In service (MM/DD/YYYY)" — dipilih karena Chrome tetap merender input dengan urutan MM/DD terlepas dari `lang`; label mengikuti apa yang benar-benar ditampilkan browser, bukan yang diinginkan. Date picker kustom yang benar-benar mengunci DD/MM/YYYY masih dicadangkan untuk fase berikutnya.) |
| 1.8 | Format `verificationDate` dengan `formatDateDMY` seperti `datePlaceInService` | `AssetTable.tsx:130` | IA-8 | ✅ |

**Hasil yang diharapkan setelah Fase 1:** halaman tidak lagi terlihat seperti kehilangan data saat memuat, tidak lagi bisa menghapus baris yang tidak terlihat, dan tidak lagi menampilkan kunci database ke pengguna.

### Fase 2 — Jadikan tabel layak untuk 2.881 baris (≈ 2–3 hari) — ✅ SELESAI (8 Sep 2026)

Inti dari upgrade ini. Fase 1 menghilangkan bahaya; fase ini menjawab masalah asli halaman.

| # | Pekerjaan | File | Temuan | Status |
|---|---|---|---|---|
| 2.1 | **Sorting kolom.** Tambahkan `sortKey` + `sortDirection` ke `useListFilters` (dengan comparator per tipe: teks via `localeCompare` numeric / angka / tanggal lexical), sinkronkan ke URL (`?sort=assetCost&dir=desc`) seperti filter lain, dan render indikator panah di `<th>` yang bisa diklik. Karena berada di `useListFilters`, Maintenance dan Reclassification ikut mendapatkannya gratis (tinggal kirim `sortAccessors`). | `useListFilters.ts`, `useAssetFilters.ts`, `AssetTable.tsx` | IA-2 | ✅ |
| 2.2 | **Satukan pagination.** Hapus `AssetTablePagination`, pakai `ui/Pagination`; tambahkan ke komponen bersama itu (semua opsional, backward-compatible untuk 7 pemakai lain): input lompat halaman + tombol First/Last (via `onPageChange`), pemilih ukuran halaman 10/25/50/100 tersimpan ke localStorage (`rajaset:inventory:pageSize`), dan label rentang "Showing 101–110 of 2,881". | hapus `AssetTablePagination.tsx`, ubah `ui/Pagination.tsx`, `Inventory.tsx` | IA-3, CONS-1 | ✅ |
| 2.3 | **Ringkasan agregat.** Bar di atas tabel berisi: jumlah aset, total unit, total Asset Cost, total Book Value — dihitung dari `filteredAssets` (bukan halaman terlihat), memakai `bookValues` Map yang sudah ada. Diimplementasikan sebagai bar ringkas (bukan `<tfoot>` sejajar kolom) agar tetap benar meski kolom disembunyikan lewat Column Visibility. | `Inventory.tsx` | IA-4 | ✅ |
| 2.4 | **Kepadatan baris terkendali.** `whitespace-nowrap` pada seluruh kolom teks + `truncate` dengan `title` (native tooltip) khusus pada Asset Description; satu baris = satu tinggi baris. | `AssetTable.tsx` | VD-1 | ✅ |
| 2.5 | **Bekukan kolom identitas.** Checkbox + Actions + Asset Number + Asset Description `sticky left` (kontigu, dengan offset piksel dihitung dari lebar tiap kolom) agar identitas baris dan tombol aksi bertahan saat scroll horizontal. Actions ikut dibekukan (di luar permintaan literal) karena posisinya di antara checkbox dan Asset Number — tanpa itu blok sticky tidak kontigu. | `AssetTable.tsx` | VD-2 | ✅ |
| 2.6 | **Empty state yang membedakan konteks.** `TableEmptyRow` diberi prop `action` opsional; kalau ada filter aktif tampilkan "No assets match the current filters" + tombol "Clear filters", kalau tidak tampilkan "No asset data yet" + tombol "+ Add New Asset". | `AssetTable.tsx`, `ui/EmptyState.tsx`, `i18n/en.ts`, `i18n/id.ts` | IA-7 | ✅ |

**Catatan implementasi:**
- 2.4 tidak memakai `ui/ValueWithTooltip` seperti draf awal — komponen itu didesain untuk nilai pendek (tombol + tooltip keyboard-accessible), bukan truncation CSS. `truncate` + `title` native mencapai hasil yang sama (baris konsisten, teks penuh saat hover) dengan lebih sedikit kode dan tanpa mengubah kontrak komponen bersama.
- 2.2 tidak mengubah 7 pemakai `ui/Pagination` lain (Maintenance, Reclassification, Dashboard, Reports, dll.) — fitur baru semuanya opsional via prop, jadi tidak ada perubahan visual di halaman lain kecuali Inventory. Mengaktifkan `pageSizeOptions` di halaman lain adalah pekerjaan lanjutan yang mudah kalau dibutuhkan.
- `useAssetFilters` sekarang menerima `bookValues` sebagai parameter kelima opsional (default Map kosong) supaya kolom Book Value bisa di-sort; ini backward-compatible dengan test yang ada.

**Hasil yang dicapai:** "aset termahal di EHK" bisa dijawab dalam dua klik tanpa membuka Excel (sort + filter), dan pengguna tahu berapa nilai total dari apa pun yang sedang difilter (bar ringkasan). Divalidasi lewat `tsc --noEmit`, `eslint`, dan full `vitest run` (63 test lulus) — belum divalidasi visual di browser sesuai permintaan.

### Fase 3 — Perbaiki jalur baca dan tulis (≈ 2 hari) — ✅ SELESAI (9 Sep 2026)

| # | Pekerjaan | File | Temuan | Status |
|---|---|---|---|---|
| 3.1 | Migrasikan `AddAssetModal` dan `EditAssetModal` ke `ui/Modal` — mendapat focus trap, Esc, portal, `aria-labelledby`, dan body scroll lock sekaligus | `AddAssetModal.tsx`, `EditAssetModal.tsx` | A11Y-2 | ✅ |
| 3.2 | Tambahkan state `isSaving` + `try/catch` pada submit kedua modal: tombol dinonaktifkan dengan spinner selama request, modal **tetap terbuka** dengan pesan error kalau gagal (isian tidak hilang) | `AddAssetModal.tsx`, `EditAssetModal.tsx` | ST-4 | ✅ |
| 3.3 | Tambahkan panel detail aset (drawer kanan atau modal read-only) yang dibuka dengan klik baris — menampilkan seluruh 17 field terformat, dengan tombol "Edit" di dalamnya sebagai jalan ke mode tulis | komponen baru `AssetDetailPanel.tsx`, `AssetTable.tsx` | IA-6 | ✅ (dipilih modal read-only, bukan drawer — opsi yang sudah disediakan rencana ini) |
| 3.4 | Pindahkan kolom Actions ke ujung kanan (atau ganti dengan menu kebab per baris), dan beri opacity dasar ~40% agar terlihat tanpa hover | `AssetTable.tsx` | IA-5 | Sengaja dilewati — keputusan eksplisit: kolom Actions tetap di posisi kiri (sudah sticky, sudah terlihat saat fokus keyboard sejak Fase 1) |
| 3.5 | Tambahkan `aria-label` pada semua checkbox tabel dan `scope="col"` pada `<th>` | `AssetTable.tsx` | A11Y-3, A11Y-5 | ✅ (aria-label checkbox sudah ada dari pekerjaan sebelumnya; `scope="col"` + `<caption className="sr-only">` ditambahkan) |

**Catatan implementasi:**
- `addAsset`/`updateAsset` di `AssetContext.tsx` sekarang `throw` saat Supabase mengembalikan error (selain `setError` seperti sebelumnya) — pola yang sama persis dengan `addLinkedReclassification` di `ReclassificationContext.tsx`. Tanpa ini, modal tidak punya cara mendeteksi kegagalan simpan untuk menampilkan pesan error.
- Efek samping yang menguntungkan: `.catch()` pada `addAsset()` di alur import CSV (`Inventory.tsx`) sebelumnya adalah kode mati (tidak pernah ter-trigger karena `addAsset` tidak pernah reject) — sekarang benar-benar berfungsi, sehingga hitungan gagal saat import CSV menjadi akurat.
- Panel detail aset dibuka dengan klik baris; klik pada checkbox atau tombol Actions tidak memicu panel (`stopPropagation`). Baris juga bisa diakses lewat keyboard (`tabIndex`, Enter/Space).

### Fase 4 — Kerapian dan penyelesaian (≈ 1–2 hari) — ✅ SELESAI (9 Sep 2026)

| # | Pekerjaan | File | Temuan | Status |
|---|---|---|---|---|
| 4.1 | Rapikan toolbar: kelompokkan Import CSV + Download Template + Export ke dalam satu menu "Data"; sediakan slot lebar tetap untuk tombol bulk agar tidak menggeser tombol lain saat muncul | `AssetToolbar.tsx` | VD-3 | ✅ |
| 4.2 | Filter bar bertingkat: search + 3 filter utama selalu terlihat, sisanya di balik tombol "More filters" yang menampilkan badge jumlah filter tersembunyi yang aktif | `AssetFilters.tsx` | VD-4 | ✅ |
| 4.3 | Tambahkan navigasi keyboard (panah, Enter, Esc) dan `role="listbox"`/`role="option"`/`aria-expanded` pada `MultiSelectDropdown`, `ColumnVisibilityDropdown`, dan menu Export | `ui/MultiSelectDropdown.tsx`, `ColumnVisibilityDropdown.tsx`, `AssetToolbar.tsx` | A11Y-4 | ✅ (menu Export — sekarang bagian dari menu "Data" — dipakai sebagai `role="menu"`/`menuitem`/`menuitemcheckbox`, bukan `listbox`/`option`, karena isinya aksi (Import/Template/Export) bukan daftar nilai yang dipilih; `MultiSelectDropdown` dan `ColumnVisibilityDropdown` memakai `listbox`/`option` sesuai rencana) |
| 4.4 | Pindahkan warna badge status/verification ke design token (`success-container`, `warning-container`) — sejalan dengan temuan yang sama di dokumen dashboard | `AssetTable.tsx`, `index.css` | VD-5 | ✅ |
| 4.5 | Samakan bahasa: satu sumber `i18n` untuk seluruh halaman, termasuk pesan validasi import CSV | `Inventory.tsx`, `AssetTable.tsx`, `i18n/*` | VD-6 | ✅ (`AssetTable.tsx` sudah memakai `i18n/en` sejak Fase 2.6 — sisa pekerjaan nyata hanya dua pesan validasi CSV yang masih Indonesia, dipindah ke `copy.csvImport.*`) |
| 4.6 | Ekspor mengikuti kolom yang terlihat (dengan opsi "Export semua kolom" di menu Export) | `Inventory.tsx` | IA-9 | ✅ (checkbox "Export all columns" di menu Data; default ekspor memakai kolom yang sedang terlihat) |
| 4.7 | Tombol close pada Toast + `role="status"` | `ui/Toast.tsx` | ST-5 | ✅ (`aria-live="polite"` ditambahkan juga) |
| 4.8 | `disabled` pada "Clear Filters" saat tidak ada filter aktif | `AssetFilters.tsx` | ST-6 | ✅ |
| 4.9 | Breakpoint mobile untuk toolbar dan filter bar | `AssetToolbar.tsx`, `AssetFilters.tsx` | RSP-2 | ✅ (`flex-wrap` pada toolbar dan header kolom; filter bar sudah wrap sejak sebelumnya, sekarang lebih ringan karena Fase 4.2 memindahkan sebagian kontrol ke balik "More filters") |

**Catatan implementasi:**
- Slot tetap untuk tombol bulk (4.1) diimplementasikan dengan selalu me-render `Edit Selected`/`Delete Selected` dan menyembunyikannya lewat `invisible` (bukan `opacity-0`) saat tidak ada seleksi, supaya tombol tidak ikut ter-fokus keyboard saat tersembunyi (pelajaran yang sama dengan A11Y-1 di Fase 1).
- Hook kecil baru `src/hooks/useListNav.ts` dipakai bersama oleh `MultiSelectDropdown`, `ColumnVisibilityDropdown`, dan menu "Data" di `AssetToolbar` untuk navigasi panah/Home/End/Enter/Esc, memakai pola `aria-activedescendant` (fokus DOM tetap di trigger/kolom cari, bukan pindah ke tiap opsi).
- Panel "More filters" (4.2) dibuka otomatis saat halaman dimuat jika ada filter tersembunyi yang aktif dari URL (misalnya link yang dibagikan dengan filter Location), supaya pengguna tidak bingung kenapa ada chip filter yang kontrolnya tidak terlihat.
- Validasi lengkap: `tsc --noEmit`, `eslint` (tanpa error/warning baru dibanding sebelum Fase 4), dan full `vitest run` (63 test lulus — satu test pinning pesan CSV Indonesia diperbarui ke bahasa Inggris mengikuti 4.5). Tidak divalidasi visual di browser sesuai permintaan (tanpa Playwright).

---

## 5. Ringkasan Prioritas

| Fase | Temuan yang diselesaikan | Estimasi | Nilai utama | Status |
|---|---|---|---|---|
| **1** | ST-1, ST-2, ST-3, IA-1, IA-8, A11Y-1, RSP-1, CONS-2 | ~1 hari | Menghilangkan risiko kehilangan data & tampilan yang menyesatkan | ✅ Selesai (8 Sep 2026) |
| **2** | IA-2, IA-3, IA-4, IA-7, VD-1, VD-2, CONS-1 | ~2–3 hari | Membuat tabel benar-benar bisa dipakai untuk 2.881 baris | ✅ Selesai (8 Sep 2026) |
| **3** | A11Y-2, A11Y-3, A11Y-5, ST-4, IA-6 | ~2 hari | Jalur baca yang aman & jalur tulis yang tidak kehilangan isian | ✅ Selesai (9 Sep 2026) — IA-5 sengaja dilewati (Actions tetap di kiri) |
| **4** | VD-3, VD-4, VD-5, VD-6, A11Y-4, IA-9, ST-5, ST-6, RSP-2 | ~1–2 hari | Kerapian visual, aksesibilitas penuh, konsistensi | ✅ Selesai (9 Sep 2026) |

**PERF-1 dan PERF-2 sengaja tidak dijadwalkan** — keduanya tercatat sebagai konteks, bukan pekerjaan. PERF-1 justru menjadi prasyarat yang menguntungkan untuk 2.3.

---

## 6. Ukuran Keberhasilan

Setelah keempat fase selesai, pertanyaan-pertanyaan berikut harus bisa dijawab **tanpa meninggalkan halaman**:

1. "Sepuluh aset termahal di subsidiary EHK?" → filter + klik header Asset Cost. *(Sekarang: mustahil.)*
2. "Berapa total nilai buku aset FA Land di semua subsidiary?" → filter, baca baris ringkasan. *(Sekarang: mustahil.)*
3. "Aset apa yang paling baru masuk bulan ini?" → filter tanggal + sort Date Place in Service. *(Sekarang: mustahil.)*
4. "Tunjukkan halaman 150." → satu ketikan, bukan 149 klik.
5. "Data saya masih dimuat atau gagal?" → skeleton vs panel error, bukan tabel kosong yang ambigu.
6. Seluruh filter bar bisa dioperasikan dari keyboard, dan tidak ada tombol Delete tak terlihat yang bisa difokus.

---

## 7. Yang Sengaja Tidak Diubah

- **Arsitektur filter** (`useListFilters` + URL persistence + chips) — ini bagian terkuat halaman dan jadi pola bersama untuk Maintenance, Reclassification, dan Reports. Fase 2 menambah sorting **ke dalam** hook ini, tidak menggantikannya.
- **Alur bulk delete** (ketik `DELETE` + progress modal berbatch) — sudah tepat. Yang diperbaiki hanya bagaimana seleksinya terbentuk (ST-2, ST-3).
- **Import CSV** (validasi baris wajib, batas 5.000, progress modal, unduh baris invalid) — lengkap dan informatif; hanya bahasa pesannya yang disamakan (4.5).
- **Column visibility + localStorage** — bekerja baik; hanya cakupan efeknya yang diperluas ke export (4.6).
- **Skema database dan `AssetContext`** — tidak ada perubahan yang dibutuhkan. Seluruh rencana ini murni lapisan presentasi.

---

## Lampiran — Gambaran Tampilan Sesudah Upgrade

Wireframe teks di bawah menggambarkan hasil akhir setelah Fase 1–3. Ini bukan desain final piksel, tapi susunan dan perilaku yang dituju.

### L.1 Satu baris tabel: sebelum vs sesudah

**Sekarang** — kolom Actions kosong di posisi kedua, UUID pecah 4 baris, tinggi baris tak menentu:

```
 ┌───┬──────────┬────────────────┬─────────┬──────────────┬──────────┬─────────────┐
 │ ☐ │ ACTIONS  │ ASSET BOOK     │ SUBSID. │ ASSET NUMBER │ ASSET D… │ ASSET COST  │
 ├───┼──────────┼────────────────┼─────────┼──────────────┼──────────┼─────────────┤
 │ ☐ │          │ 18832dbf-      │ EHK     │ 05608003A    │ Tambahan │  $2,734.00  │
 │   │ (kosong  │ de1f-464e-     │         │              │ Tanah KP │             │
 │   │  sampai  │ 9043-          │         │              │ 11.900   │             │
 │   │  hover)  │ 34991ff0414f   │         │              │          │             │
 └───┴──────────┴────────────────┴─────────┴──────────────┴──────────┴─────────────┘
   ↑ 4 baris tinggi untuk 1 aset · hanya ~4 aset muat di layar dari 10 per halaman
```

**Sesudah** — identitas di depan, satu baris = satu tinggi baris, aksi di kanan:

```
 ┌───┬──────────────┬──────────────────────────╥───────────┬──────────────┬─────────────┬─────┐
 │ ☐ │ 5608003      │ Tanah KP 11.900 / Stasi… ║ EHK       │    12,766.00 │   12,766.00 │  ⋮  │
 └───┴──────────────┴──────────────────────────╨───────────┴──────────────┴─────────────┴─────┘
   └──────── beku saat scroll kanan ────────┘   └──── ikut bergeser ke kiri/kanan ────┘
```

### L.2 Tampilan utama (default)

```
──────────────────────────────────────────────────────────────────────────────────────────────
  Asset Inventory                             [⊞ Columns ③]  [▤ Data ▾]  [ + Add New Asset ]
  Manage and track enterprise assets across all subsidiaries.
──────────────────────────────────────────────────────────────────────────────────────────────
  [🔍 Search ID / Description............]  [Subsidiary: EHK ▾] [All Classes ▾] [All Status ▾]
  [⚙ More filters ②]                                                     Clear filters  ✕
  ┈ Subsidiary: EHK ✕ ┈ ┈ Cost: 10.000 – ∞ ✕ ┈
──────────────────────────────────────────────────────────────────────────────────────────────

 ┌───┬──────────────┬──────────────────────────╥───────────┬──────────────┬─────────────┬─────┐
 │ ▣ │ ASSET NUMBER⇅│ ASSET DESCRIPTION      ⇅ ║ SUBSID.  ⇅│ ASSET COST ▼ │ BOOK VALUE ⇅│  ⋮  │
 ├───┼──────────────┼──────────────────────────╫───────────┼──────────────┼─────────────┼─────┤
 │ ☑ │ N/A          │ Land MS Grobogan         ║ EHK       │ 1,152,379.00 │1,152,379.00 │  ⋮  │
 │ ☑ │ XXXXX0102    │ Bangunan Kantor Jambi    ║ EHK       │   225,722.00 │   98,441.20 │  ⋮  │
 │ ☐ │ 5608003      │ Tanah KP 11.900 / Stasi… ║ EHK       │    12,766.00 │   12,766.00 │  ⋮  │
 │ ☐ │ 05608003A    │ Tambahan Tanah KP 11.900 ║ EHK       │     2,734.00 │    2,734.00 │  ⋮  │
 │ ☐ │ 5608110      │ Pipa Km 12 — Metering    ║ EHK       │     1,908.00 │      636.00 │  ⋮  │
 │ ☐ │ 5608111      │ Genset 250 kVA           ║ EHK       │       842.00 │        0.00 │  ⋮  │
 │ ☐ │ 5608112      │ Kendaraan Operasional    ║ EHK       │       610.00 │      152.50 │  ⋮  │
 │ ☐ │ 5608113      │ Perangkat Telemetri      ║ EHK       │       498.00 │      124.50 │  ⋮  │
 │ ☐ │ 5608114      │ AC Split 2 PK            ║ EHK       │       231.00 │       38.50 │  ⋮  │
 │ ☐ │ 5608115      │ Meja Kantor              ║ EHK       │       114.00 │        0.00 │  ⋮  │
 ├───┴──────────────┴──────────────────────────╨───────────┼──────────────┼─────────────┼─────┤
 │  TOTAL · 214 aset · 318 unit                            │ 4,182,904.00 │2,910,447.10 │     │
 └─────────────────────────────────────────────────────────┴──────────────┴─────────────┴─────┘
  Menampilkan 1–10 dari 214 aset       Baris: [ 10 ▾ ]    ⏮  ◀  Hal [  1 ] / 22  ▶  ⏭
```

Yang berubah dibanding sekarang:

| Elemen | Sekarang | Sesudah |
|---|---|---|
| Header kolom | teks mati | `⇅` bisa diklik, `▼`/`▲` menandai kolom aktif, tersimpan di URL |
| Kolom pertama | UUID `18832dbf-…` | Asset Number (identitas nyata) |
| Kolom Actions | posisi 2, kosong sampai hover | menu `⋮` di ujung kanan, selalu terlihat |
| Garis `║` | tidak ada | batas beku — 3 kolom kiri bertahan saat scroll kanan |
| Baris TOTAL | tidak ada | agregat dari **seluruh** hasil filter, bukan 10 baris terlihat |
| Pagination | `◀ Page 1 of 289 ▶` | rentang baris + ukuran halaman + lompat halaman + First/Last |
| Toolbar | 5 tombol sejajar | Import/Template/Export dilebur ke `[▤ Data ▾]` |
| Filter bar | 12 kontrol, 2 baris permanen | 4 kontrol utama + `[⚙ More filters ②]` |

### L.3 Filter lanjutan (saat `More filters` dibuka)

```
  [🔍 Search ID / Description............]  [Subsidiary: EHK ▾] [All Classes ▾] [All Status ▾]
  [⚙ More filters ② ▴]                                                    Clear filters  ✕
 ┌────────────────────────────────────────────────────────────────────────────────────────┐
 │  Location         [ All Locations ▾ ]          Listed        [ All Listed ▾ ]           │
 │  Verification     [ All Verification ▾ ]       Item Status   [ All Item Statuses ▾ ]    │
 │                                                                                        │
 │  Date in service  [ 01/01/2020 ]  →  [ 31/12/2026 ]     format DD/MM/YYYY               │
 │  Asset cost       [ Min ............ ]  –  [ Max ............ ]                        │
 │                                                                                        │
 │                                                        [ Reset ]   [ Terapkan filter ]  │
 └────────────────────────────────────────────────────────────────────────────────────────┘
```

Catatan penting: input tanggal memakai komponen sendiri dengan format DD/MM/YYYY yang dijamin konsisten dengan kolom tabel — bukan `<input type="date">` bawaan yang formatnya ditentukan setelan browser (CONS-2).

### L.4 Saat memuat data (menggantikan tabel kosong yang menyesatkan)

```
──────────────────────────────────────────────────────────────────────────────────────────────
  Asset Inventory                             [⊞ Columns ③]  [▤ Data ▾]  [ + Add New Asset ]
──────────────────────────────────────────────────────────────────────────────────────────────
  [▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒]  [▒▒▒▒▒▒▒▒▒▒▒▒] [▒▒▒▒▒▒▒▒▒▒] [▒▒▒▒▒▒▒▒▒▒]
 ┌───┬──────────────┬──────────────────────────╥───────────┬──────────────┬─────────────┬─────┐
 │ ░ │ ▒▒▒▒▒▒▒▒     │ ▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒       ║ ▒▒▒▒      │    ▒▒▒▒▒▒▒▒▒ │   ▒▒▒▒▒▒▒▒▒ │  ░  │
 │ ░ │ ▒▒▒▒▒▒▒      │ ▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒  ║ ▒▒▒▒      │      ▒▒▒▒▒▒▒ │     ▒▒▒▒▒▒▒ │  ░  │
 │ ░ │ ▒▒▒▒▒▒▒▒▒    │ ▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒          ║ ▒▒▒▒      │     ▒▒▒▒▒▒▒▒ │    ▒▒▒▒▒▒▒▒ │  ░  │
 └───┴──────────────┴──────────────────────────╨───────────┴──────────────┴─────────────┴─────┘
```

**Saat gagal memuat** (sekarang: tidak ada sama sekali, tampilannya sama dengan tabel kosong):

```
 ┌──────────────────────────────────────────────────────────────────────────────────────┐
 │                                                                                      │
 │                                        ⚠                                             │
 │                            Gagal memuat data aset                                    │
 │                   Failed to fetch assets: network timeout                            │
 │                                                                                      │
 │                                 [  Coba lagi  ]                                      │
 │                                                                                      │
 └──────────────────────────────────────────────────────────────────────────────────────┘
```

### L.5 Seleksi lintas halaman (menutup ST-2 dan ST-3)

Saat pengguna klik checkbox header, seleksi tidak lagi terjadi diam-diam:

```
 ╭──────────────────────────────────────────────────────────────────────────────────────────╮
 │ ✔ 214 aset terpilih — seluruh hasil filter, termasuk 21 halaman yang tidak terlihat.     │
 │   [ Pilih halaman ini saja (10) ]   [ Batalkan seleksi ]     [ ✎ Edit ]   [ 🗑 Hapus ]    │
 ╰──────────────────────────────────────────────────────────────────────────────────────────╯
```

Tiga perubahan perilaku yang menyertainya:
- Checkbox header punya tiga keadaan: `☐` kosong · `▨` sebagian · `▣` semua — sekarang hanya dua.
- Tombol Edit/Hapus pindah **ke dalam banner ini**, jadi tidak lagi muncul-hilang di toolbar dan menggeser tombol lain (VD-3).
- Mengganti filter apa pun akan **mengosongkan seleksi**, sehingga tidak mungkin lagi menghapus baris yang tidak terlihat.

### L.6 Tidak ada hasil — dua pesan berbeda untuk dua situasi berbeda

**Ada filter aktif tapi nol hasil:**

```
 ┌──────────────────────────────────────────────────────────────────────────────────────┐
 │                                        🔍                                            │
 │                 Tidak ada aset yang cocok dengan 4 filter ini                         │
 │                Coba longgarkan filter, atau bersihkan semuanya.                       │
 │                              [ Clear filters ]                                        │
 └──────────────────────────────────────────────────────────────────────────────────────┘
```

**Database memang belum berisi aset:**

```
 ┌──────────────────────────────────────────────────────────────────────────────────────┐
 │                                        📦                                            │
 │                            Belum ada aset di sini                                     │
 │                Tambahkan aset pertama, atau import dari file CSV.                     │
 │                   [ + Add New Asset ]    [ ▤ Import CSV ]                             │
 └──────────────────────────────────────────────────────────────────────────────────────┘
```

Sekarang keduanya menampilkan kalimat yang sama persis, tanpa jalan keluar.

### L.7 Panel detail aset (Fase 3) — klik baris, bukan buka form Edit

```
 ┌───┬──────────────┬───────────────╥──╮ ╭─ Detail Aset ──────────────────────────────╮
 │ ☐ │ N/A          │ Land MS Grob… ║  │ │  5608003                              ✕    │
 │ ☐ │ XXXXX0102    │ Bangunan Kan… ║  │ │  Tanah KP 11.900 / Stasiun Meter Gas       │
 │ ▶ │ 5608003      │ Tanah KP 11.… ║  │ ├────────────────────────────────────────────┤
 │ ☐ │ 05608003A    │ Tambahan Tan… ║  │ │  IDENTITAS                                 │
 │ ☐ │ 5608110      │ Pipa Km 12 —… ║  │ │  Asset Book        —                       │
 │ ☐ │ 5608111      │ Genset 250 k… ║  │ │  Subsidiary        EHK                     │
 │ ☐ │ 5608112      │ Kendaraan Op… ║  │ │  Asset Class       FA Land                 │
 └───┴──────────────┴───────────────╨──╯ │  Location          Jambi                   │
                                         ├────────────────────────────────────────────┤
                                         │  NILAI                                     │
                                         │  Asset Cost        $12,766.00              │
                                         │  Book Value        $12,766.00              │
                                         │  Depreciation      Straight Line           │
                                         │  Life in Months    Unlimited               │
                                         │  In Service        01/01/2008              │
                                         ├────────────────────────────────────────────┤
                                         │  STATUS                                    │
                                         │  Status            ● Active                │
                                         │  Listed            Audited                 │
                                         │  Verification      ● Yes · 04/09/2026      │
                                         │  Item Status       Asset                   │
                                         ├────────────────────────────────────────────┤
                                         │             [ Tutup ]   [ ✎ Edit Asset ]   │
                                         ╰────────────────────────────────────────────╯
```

Seluruh 17 field terbaca dalam satu layar, terformat, **tanpa membuka antarmuka yang bisa mengubah data** — dan tanpa scroll horizontal 17 kolom. Tombol Edit tetap ada sebagai jalan sengaja menuju mode tulis.

### L.8 Modal Add / Edit Asset saat menyimpan (menutup ST-4)

```
 ╭─ Add New Asset ──────────────────────────────────────────────╮
 │                                                          ✕   │
 │  Asset Book *        [ Corporate................. ]          │
 │  Subsidiary *        [ EHK...................... ▾]          │
 │  ...                                                         │
 ├──────────────────────────────────────────────────────────────┤
 │  ⚠ Gagal menyimpan: duplicate key on asset_number            │
 │                                                              │
 │                    [ Cancel ]     [ ⟳ Menyimpan… ]           │
 ╰──────────────────────────────────────────────────────────────╯
                                       ↑ tombol nonaktif selama request
                                         modal TIDAK menutup saat gagal
                                         isian form tetap utuh
```

Sekarang: tombol tetap bisa diklik berulang, dan modal menutup + form ter-reset bahkan ketika simpan gagal.

### L.9 Layar sempit (Fase 4)

Tabel 17 kolom berubah jadi kartu per aset:

```
 ┌──────────────────────────────────┐
 │  Asset Inventory            [⋮]  │
 │  [🔍 Search.................. ]  │
 │  [⚙ Filters ③]        [ + Add ]  │
 ├──────────────────────────────────┤
 │  214 aset · $4,182,904.00        │
 ├──────────────────────────────────┤
 │  ☐  5608003                  ⋮   │
 │     Tanah KP 11.900 / Stasiun…   │
 │     EHK · FA Land · ● Active     │
 │     Cost   $12,766.00            │
 │     Book   $12,766.00            │
 ├──────────────────────────────────┤
 │  ☐  05608003A                ⋮   │
 │     Tambahan Tanah KP 11.900     │
 │     EHK · FA Land · ● Active     │
 │     Cost   $2,734.00             │
 │     Book   $2,734.00             │
 ├──────────────────────────────────┤
 │   ◀   Hal 1 / 22   ▶             │
 └──────────────────────────────────┘
```

