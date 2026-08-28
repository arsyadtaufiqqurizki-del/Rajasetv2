# Rencana Upgrade UI/UX — Reports & Analytics

**Tanggal:** 27 Agustus 2026
**Scope:** Halaman `/reports` — `src/pages/Reports.tsx`, 4 komponen di `src/components/reports/`, `src/contexts/ReportContext.tsx`, 5 modul di `src/lib/reports/`, `src/types/report.ts`
**Status:** Fase 1–4 selesai (27 Agustus 2026), kecuali GOV-1 (perketat RLS) yang sengaja ditunda — Fase 5 belum dikerjakan (backlog)
**Dokumen terkait:** `reports implementation.md` (riwayat implementasi fungsional), `dashboard ui ux upgrade.md` (pola & standar yang jadi acuan)

---

## 1. Ringkasan Eksekutif

Fitur Reports **fungsinya sudah lengkap, tapi produknya terbalik**: hasil kerja terbaiknya tersembunyi di dalam file yang harus di-download dulu.

Tiga builder report (`buildValuationReport`, `buildDepreciationReport`, `buildMaintenanceCostReport`) sudah menghasilkan empat hal: data chart, **empat angka ringkasan**, **definisi kolom detail**, dan **baris detail per-aset**. Dari empat itu, layar hanya menampilkan **satu** — chart. Angka ringkasan dan tabel detail hanya keluar di PDF (`exportPdf.ts:60`, `exportPdf.ts:99`). Artinya pengguna harus mengunduh PDF untuk melihat angka yang sebenarnya sudah selesai dihitung di browser-nya, sepersekian detik sebelumnya.

Tiga masalah terbesar:

1. **Layar menampilkan lebih sedikit daripada file ekspor.** Empat KPI (`Total Asset Value`, `Total Assets`, `Categories`, `Avg Value / Asset`) dan tabel detail ratusan baris dihitung, disimpan ke database, lalu dibuang dari tampilan. Yang tersisa di layar cuma bar chart 5 batang.
2. **Riwayat report adalah kuburan data.** Kolom `report_data JSONB` menyimpan snapshot penuh tiap report (`ReportContext.tsx:100`), tapi tidak ada satu baris kode pun yang membacanya kembali. Baris riwayat hanya bisa **dihapus** — tidak bisa dibuka, di-download ulang, atau di-generate ulang. Setiap klik "Generate Preview" menulis satu baris permanen ke database yang selamanya tidak berguna.
3. **Angka di PDF resmi bisa salah nama.** `generatedBy` diambil dari `reportHistory[0]?.userName` (`Reports.tsx:68`) — itu nama pembuat report **sebelumnya**, bukan pengguna aktif. Pada PDF yang punya blok tanda tangan "Prepared by / Reviewed by / Approved by", atribusi yang salah bukan masalah kosmetik.

Ditambah: rentang tanggal default masih hardcoded **2023-01-01 s/d 2023-12-31** (`Reports.tsx:26-27`) — pengguna yang membuka halaman ini hari ini dan langsung klik Generate akan mendapat laporan kosong tanpa penjelasan. Ekspor Excel dan PDF menghasilkan isi yang berbeda dari nama file yang sama. Dan seluruh halaman belum ikut migrasi design token yang sudah selesai di Dashboard bulan ini.

Dokumen ini memetakan **39 temuan** (10 dampak tinggi, 17 sedang, 12 rendah), lalu menyusunnya jadi **5 fase** yang bisa dikerjakan berurutan.

---

## 2. Konteks Pengguna

Siapa yang membuka `/reports`, dan untuk apa (perlu dikonfirmasi ke pemilik produk):

| Persona | Yang dicari di Reports | Frekuensi |
|---|---|---|
| **Finance / Akuntansi** | Daftar depresiasi per aset untuk tutup buku; net book value per periode; bukti perhitungan yang bisa dilampirkan | Bulanan–kuartalan |
| **Manajer Aset** | Valuasi per kategori/subsidiary; biaya maintenance estimasi vs aktual; mana yang over-budget | Mingguan–bulanan |
| **Auditor / Manajemen** | Dokumen ber-tanda tangan untuk arsip; snapshot yang bisa dibuka lagi 6 bulan kemudian | Kuartalan–tahunan |

**Job-to-be-done utama Reports:** *"Beri saya angka yang bisa saya pertanggungjawabkan, dalam bentuk yang bisa saya kirim ke orang lain, dan yang bisa saya buka lagi nanti."*

Tiga bagian kalimat itu memetakan tiga kegagalan yang berbeda:

- *"angka yang bisa saya pertanggungjawabkan"* → gagal, karena angkanya tidak terlihat di layar sebelum di-download (IA-1, IA-2), dan atribusinya bisa salah (DATA-3).
- *"bentuk yang bisa saya kirim"* → separuh berhasil; PDF sudah bagus, Excel-nya isinya beda (DATA-1).
- *"yang bisa saya buka lagi nanti"* → gagal total; riwayat hanya bisa dihapus (IA-3).

**Perbedaan penting dari Dashboard:** Dashboard dipakai untuk *melihat sekilas*. Reports dipakai untuk *memproduksi artefak*. Konsekuensinya, kecepatan bukan prioritas utama di sini — **keterlacakan** dan **kepercayaan pada angka** yang utama. Setiap keputusan desain di bawah mengikuti prinsip ini.

---

## 3. Inventaris Fitur Saat Ini

Supaya audit di bagian 4 punya dasar yang jelas, ini yang benar-benar ada sekarang:

| Kemampuan | Status | Lokasi |
|---|---|---|
| 3 jenis report (Valuation / Depreciation / Maintenance Cost) | ✅ Berjalan | `src/lib/reports/build*.ts` |
| Filter subsidiary | ✅ Berjalan | `shared.ts:8` |
| Filter rentang tanggal | ⚠️ Berjalan tapi tidak konsisten antar report | `build*.ts` |
| Preview chart (bar / line / grouped bar) | ✅ Berjalan | `ReportChart.tsx` |
| Ringkasan 4 angka | ⚠️ Dihitung, tidak ditampilkan di layar | `build*.ts` → hanya `exportPdf.ts:60` |
| Tabel detail per-aset | ⚠️ Dihitung, tidak ditampilkan di layar | `build*.ts` → hanya `exportPdf.ts:99` |
| Export PDF (chart + ringkasan + detail + sign-off + nomor halaman) | ✅ Berjalan, kualitas bagus | `exportPdf.ts` |
| Export Excel | ⚠️ Berjalan, tapi hanya data agregat | `exportXlsx.ts:16` |
| Export CSV | ❌ Tidak ada (padahal `src/lib/csv.ts` sudah tersedia) | — |
| Riwayat report tersimpan di DB | ✅ Berjalan | `ReportContext.tsx` |
| Buka kembali report lama | ❌ Tidak ada | — |
| Hapus report | ✅ Berjalan + konfirmasi | `ReportHistoryTable.tsx:51` |
| Pagination riwayat (5/halaman) | ✅ Berjalan | `Pagination.tsx` |
| Activity log (`GENERATE_REPORT`, `EXPORT_REPORT`) | ✅ Berjalan | `activityLogger.ts` |
| State di URL (bisa di-share/bookmark) | ❌ Tidak ada — satu-satunya halaman utama tanpa ini | — |
| Loading / error state di UI | ❌ Ada di context, tidak dipakai | `ReportContext.tsx:125` |

---

## 4. Temuan Audit

Kode temuan: `IA` = arsitektur informasi, `DATA` = kebenaran & konsistensi data, `ST` = state & feedback, `A11Y` = aksesibilitas, `VD` = visual design, `RSP` = responsif, `GOV` = tata kelola/akses.

### 4.1 Arsitektur Informasi & Konten

**IA-1 · Ringkasan 4 angka dihitung tapi tidak pernah dirender — DAMPAK TINGGI**
Ketiga builder mengembalikan `summary: ReportSummaryItem[]` berisi empat angka paling penting dari report (`buildValuationReport.ts:34-39`, `buildDepreciationReport.ts:34-39`, `buildMaintenanceCostReport.ts:43-48`). Satu-satunya konsumen adalah `exportPdf.ts:60`. Di layar, angka-angka itu tidak ada. Pengguna yang cuma ingin tahu "berapa total nilai aset TIP tahun ini" harus men-download PDF untuk membaca satu baris.

**IA-2 · Tabel detail per-aset juga tidak pernah dirender — DAMPAK TINGGI**
`detailColumns` + `detailData` (6–7 kolom, satu baris per aset/record) hanya dipakai di `exportPdf.ts:99-130`. Ini adalah isi report yang sebenarnya — dan tidak bisa diverifikasi sebelum di-download. Pengguna tidak bisa mengecek "apakah aset X masuk?" tanpa mengunduh, membuka PDF, dan mencari manual.

**IA-3 · Riwayat report tidak bisa dibuka kembali — DAMPAK TINGGI**
`report_data` (snapshot penuh, JSONB) disimpan di `ReportContext.tsx:100` dan dipetakan ke `ReportRecord.reportData` (`ReportContext.tsx:49`), lalu tidak pernah dibaca oleh komponen mana pun. `ReportHistoryTable` hanya menyediakan tombol hapus. Konsekuensinya: satu-satunya cara mendapatkan report bulan lalu adalah men-generate ulang — yang hasilnya **belum tentu sama**, karena data aset sudah berubah sejak itu. Untuk fitur yang PDF-nya punya blok "Approved by", ketidakmampuan membuka arsip adalah kegagalan mendasar.

**IA-4 · Setiap klik Generate menulis permanen ke database — DAMPAK SEDANG**
`generatePreview` (`Reports.tsx:46`) selalu memanggil `saveReport`. Tidak ada cara mencoba-coba konfigurasi tanpa mengotori riwayat. Dengan pagination 5 baris/halaman, tiga kali eksperimen sudah mendorong report yang benar ke halaman 2. Preview dan penyimpanan adalah dua niat yang berbeda dan harus jadi dua aksi.

**IA-5 · Filter jauh lebih miskin daripada halaman lain — DAMPAK SEDANG**
Reports hanya punya subsidiary + rentang tanggal. Dashboard dan Inventory sudah punya multi-select 4 dimensi (subsidiary, kategori, lokasi, status) lewat `FilterBar` + `MultiSelectDropdown` yang sudah jadi. Pengguna tidak bisa membuat report "aset IT Equipment yang statusnya Needs Review" — padahal komponen dan datanya sudah tersedia gratis.

**IA-6 · Tidak ada preset rentang tanggal — DAMPAK SEDANG**
Dua date picker manual untuk kebutuhan yang 90% berulang: YTD, kuartal berjalan, kuartal lalu, tahun lalu. Untuk laporan tutup buku bulanan, mengetik tanggal tiap kali adalah gesekan yang tidak perlu — dan sumber kesalahan (lihat DATA-4).

**IA-7 · Konfigurasi report tidak tersimpan di URL — DAMPAK SEDANG**
`Dashboard.tsx`, `Inventory.tsx`, `Maintenance.tsx`, dan `Reclassification.tsx` semuanya memakai `useSearchParams`. Reports tidak. Akibatnya: report tidak bisa di-bookmark, tidak bisa dikirim sebagai link ke kolega ("coba lihat yang ini"), dan refresh halaman mengembalikan semua ke default 2023.

**IA-8 · Tidak ada export CSV — DAMPAK RENDAH**
`src/lib/csv.ts` sudah ada dan `sanitizeCell` sudah dipakai oleh kedua exporter. CSV adalah format yang paling sering diminta tim finance untuk diolah lanjut, dan biayanya kecil sekali dari posisi sekarang.

**IA-9 · "Export Options" jadi kartu tersendiri untuk dua tombol — DAMPAK RENDAH**
`ExportPanel` (34 baris) memakan satu kartu penuh di kolom kiri untuk dua tombol yang secara konseptual milik hasil, bukan milik konfigurasi. Aksi ekspor seharusnya menempel pada apa yang diekspor.

### 4.2 Kebenaran & Konsistensi Data

**DATA-1 · Export Excel dan PDF menghasilkan isi yang berbeda — DAMPAK TINGGI**
`exportXlsx.ts:16` mengekspor `previewData.data` — data **agregat chart** (misalnya 5 baris: satu per kategori). `exportPdf.ts` mengekspor agregat **plus** `detailData` (bisa ratusan baris per-aset). Nama file keduanya identik (`Asset_Valuation_Summary_2023-01-01_to_2023-12-31`). Pengguna yang memilih Excel karena ingin mengolah data justru mendapat versi yang paling sedikit isinya, tanpa peringatan apa pun.

**DATA-2 · Rentang tanggal default masih 2023 — DAMPAK TINGGI**
`Reports.tsx:26-27` menetapkan `'2023-01-01'` dan `'2023-12-31'`. Tiga tahun setelah tanggal itu ditulis, alur pertama seorang pengguna baru adalah: buka halaman → klik Generate → dapat report kosong atau tidak relevan → tidak tahu kenapa. Default harus dihitung dari tanggal hari ini.

**DATA-3 · Nama pembuat di PDF diambil dari report orang lain — DAMPAK TINGGI**
`Reports.tsx:68`: `generatedBy: reportHistory[0]?.userName ?? 'Unknown User'`. Ini nama pembuat report **terbaru di riwayat**, bukan pengguna yang sedang menekan tombol. Jika riwayat kosong, atau pengguna sedang di halaman 2 pagination, hasilnya `'Unknown User'` tercetak di dokumen yang di bawahnya ada garis tanda tangan. Data yang benar sudah tersedia lewat `useAuth()` (`AuthContext.tsx:51`) dan sudah dipakai dengan benar di `ReportContext.tsx:86-89`.

**DATA-4 · Tidak ada validasi rentang tanggal — DAMPAK SEDANG**
Membalik urutan (`dateStart` > `dateEnd`) menghasilkan report kosong tanpa pesan. Tidak ada batas atas (bisa memilih 2099), tidak ada peringatan untuk rentang yang tidak masuk akal.

**DATA-5 · Data tanpa tanggal selalu lolos filter periode — DAMPAK SEDANG**
`buildValuationReport.ts:13-14` dan `buildMaintenanceCostReport.ts:13`: `if (!a.datePlaceInService) return true;`. Aset tanpa tanggal masuk ke **setiap** periode yang dipilih. Ini keputusan yang mungkin disengaja, tapi tidak terkomunikasikan sama sekali di UI maupun di PDF — sehingga total di judul "1 Jan – 31 Des 2026" bisa memuat aset yang tidak punya tanggal apa pun. Untuk laporan finansial, asumsi tersembunyi seperti ini harus dinyatakan.

**DATA-6 · Depreciation Schedule mengabaikan rentang tanggal untuk seleksi aset — DAMPAK SEDANG**
`buildDepreciationReport.ts:14` hanya memfilter subsidiary; rentang tanggal hanya dipakai untuk menentukan kuartal di sumbu X (`getQuartersInRange`). Jadi label "Subsidiary: TIP · 2026" pada report ini berarti sesuatu yang berbeda dari dua report lainnya. Perilaku ini masuk akal secara akuntansi, tapi UI-nya identik untuk ketiganya — pengguna tidak punya cara tahu.

**DATA-7 · Dua sumber kebenaran untuk format sumbu — DAMPAK RENDAH**
`shared.ts:2` menulis ulang secara manual apa yang sudah dilakukan `formatCompactCurrency` di `money.ts:33`. Keduanya menghasilkan format yang mirip tapi tidak identik, dan akan menyimpang begitu salah satunya diubah.

### 4.3 State & Feedback

**ST-1 · `loading` dan `error` diekspor tapi tidak pernah dipakai — DAMPAK TINGGI**
`ReportContext.tsx:125` menyediakan keduanya; `Reports.tsx:21` tidak mengambilnya. Akibatnya: gagal simpan report (`ReportContext.tsx:106`) dan gagal hapus (`ReportContext.tsx:115`) hanya mengisi state `error` yang tidak pernah dirender. Dari sisi pengguna, kegagalan terlihat persis seperti keberhasilan.

**ST-2 · Ekspor gagal secara senyap — DAMPAK TINGGI**
`exportPdf.ts:23` dan `exportXlsx.ts:12` melakukan `return` tanpa efek ketika data kosong. `Reports.tsx:62` dan `:78` juga `return` diam-diam. Tidak ada toast sukses maupun gagal. Pengguna menekan "Download as PDF", tidak terjadi apa-apa, dan tidak ada informasi apakah itu bug, file sudah ter-download di suatu tempat, atau memang tidak ada data. `Toast` (`ui/Toast.tsx`) sudah ada di codebase tapi baru dipakai di Inventory.

**ST-3 · Tidak ada skeleton saat riwayat dimuat — DAMPAK SEDANG**
`fetchPage` berjalan saat mount (`ReportContext.tsx:81`); selama itu tabel menampilkan baris "Belum ada report yang dibuat" — pesan yang salah, karena reportnya ada, cuma belum sampai. `Skeleton.tsx` sudah tersedia dan sudah dipakai oleh `DashboardSkeleton`.

**ST-4 · Badge "Sync Complete" adalah dekorasi — DAMPAK SEDANG**
`ReportChart.tsx:22-26` menampilkan centang hijau "Sync Complete" setiap kali `previewData` tidak null. Tidak ada sinkronisasi apa pun yang sedang terjadi. Indikator status palsu lebih berbahaya daripada tidak ada indikator, karena melatih pengguna mengabaikan area itu. (Sudah dicatat sebagai utang di `reports implementation.md`.)

**ST-5 · Kolom Status di riwayat selalu bernilai sama — DAMPAK SEDANG**
`ReportContext.tsx:101` selalu menulis `status: 'Generated'`. Tabel riwayat mengalokasikan satu kolom penuh (`ReportHistoryTable.tsx:45-49`) untuk badge hijau yang isinya tidak pernah berubah, di tabel yang sudah memaksa scroll horizontal di mobile (RSP-3).

**ST-6 · Indikator "Generating..." tidak mencakup bagian yang lambat — DAMPAK RENDAH**
`setGenerating(true)` (`Reports.tsx:45`) baru dipanggil **setelah** builder selesai berjalan. Untuk ~2.900 aset, `buildDepreciationReport` menjalankan `computeBookValue` untuk setiap aset × setiap kuartal secara sinkron — memblokir UI tanpa indikator apa pun. Yang ditunjukkan sebagai "Generating..." justru bagian yang cepat (INSERT ke Supabase).

**ST-7 · Hapus report tidak memberi konfirmasi hasil — DAMPAK RENDAH**
`ConfirmModal` menanyakan sebelum menghapus, lalu setelah berhasil tidak ada apa-apa selain baris yang hilang. Tidak ada undo, tidak ada toast. Untuk aksi destruktif pada arsip, minimal perlu konfirmasi hasil.

### 4.4 Aksesibilitas

**A11Y-1 · Label form tidak terhubung ke input — DAMPAK TINGGI**
`ReportConfigForm.tsx:36`, `:52`, `:69` memakai `<label>` polos tanpa `htmlFor`, dan tidak ada `id` di `<select>`/`<input>` pasangannya. Pembaca layar mengumumkan ketiga kontrol tanpa nama. Ini seluruh antarmuka konfigurasi halaman ini.

**A11Y-2 · Tombol hapus hanya punya `title` — DAMPAK SEDANG**
`ReportHistoryTable.tsx:51-57`: isinya hanya ikon `Trash2`, tanpa `aria-label` maupun teks tersembunyi. `title` tidak diumumkan konsisten oleh pembaca layar, dan tidak menyebut report mana yang akan dihapus.

**A11Y-3 · Tidak ada pengumuman saat preview selesai — DAMPAK SEDANG**
Setelah "Generate Preview", konten kolom kanan berubah total tanpa `aria-live` maupun perpindahan fokus. Pengguna pembaca layar tidak punya cara tahu bahwa aksi mereka berhasil.

**A11Y-4 · Chart tidak punya alternatif teks — DAMPAK SEDANG**
`ReportChart` merender SVG Recharts tanpa `role`, `aria-label`, atau tabel padanan. Karena chart adalah **satu-satunya** representasi hasil di layar saat ini, halaman ini praktis tidak bisa dipakai tanpa penglihatan. (Memperbaiki IA-1 dan IA-2 sekaligus menyelesaikan sebagian besar masalah ini — tabel detail adalah alternatif teks yang paling baik.)

**A11Y-5 · Enter tidak men-generate report — DAMPAK RENDAH**
`ReportConfigForm.tsx:33` membungkus kontrol dalam `<form>` tanpa `onSubmit`, dan tombolnya `type="button"` (`:88`). Menekan Enter di dalam form tidak melakukan apa-apa — perilaku yang bertentangan dengan ekspektasi dasar sebuah form.

**A11Y-6 · Tabel riwayat tanpa `scope` dan `caption` — DAMPAK RENDAH**
`ReportHistoryTable.tsx:27-31`: `<th>` tanpa `scope="col"`, tabel tanpa `<caption>`. Navigasi tabel dengan pembaca layar kehilangan konteks kolom.

**A11Y-7 · Dua input tanggal tidak dikelompokkan — DAMPAK RENDAH**
`ReportConfigForm.tsx:70-84`: dua `<input type="date">` dipisah teks `-` polos, tanpa `<fieldset>`/`<legend>` dan tanpa label masing-masing ("Dari" / "Sampai"). Hubungan keduanya hanya terbaca secara visual.

### 4.5 Visual Design & Konsistensi

**VD-1 · Halaman ini belum ikut migrasi design token — DAMPAK TINGGI**
Dashboard sudah selesai migrasi ke token pada commit `541072c` dan `4abf242` (nol hex hardcoded). Reports masih penuh nilai mentah:

| Lokasi | Nilai hardcoded | Token yang seharusnya |
|---|---|---|
| `ExportPanel.tsx:19` | `bg-[#0F172A] text-white` | `bg-primary text-on-primary` |
| `ReportChart.tsx:29` | `bg-white` | `bg-surface-container-lowest` |
| `ReportChart.tsx:39,51,62` | grid `#e5e7eb` | `--color-chart-grid` |
| `ReportChart.tsx:40-41` dst | tick `#6b7280` | `--color-chart-axis` |
| `ReportChart.tsx:71-72` | `#94a3b8`, `#f59e0b` | `--color-chart-*` |
| `ReportChart.tsx:23` | `text-emerald-600` | `text-positive` |
| `buildValuationReport.ts:32` | `#3b82f6` | `--color-chart-4` |
| `buildDepreciationReport.ts:32` | `#8b5cf6` | `--color-chart-5` |
| `ReportHistoryTable.tsx:46` | `bg-emerald-100 text-emerald-800` | token positive |
| `ReportHistoryTable.tsx:53` | `hover:text-red-600 hover:bg-red-50` | token error |

Efek sampingnya bukan cuma estetika: warna chart ditentukan di dalam **builder** (lapisan data), bukan di komponen presentasi — pemisahan tanggung jawab yang salah dan menyulitkan penggantian tema.

**VD-2 · Bahasa campur dalam satu layar — DAMPAK SEDANG**
`Reports.tsx:16` mengimpor `en as copy`; `ReportChart.tsx:9` mengimpor `id as copy`; `ReportHistoryTable.tsx:37` menaruh string Indonesia langsung di JSX ("Belum ada report yang dibuat"); judul halaman dan seluruh label form berbahasa Inggris. Satu halaman, tiga sumber bahasa yang berbeda.

**VD-3 · Hierarki visual tidak mencerminkan prioritas — DAMPAK SEDANG**
Kolom kanan didominasi placeholder chart setinggi 350px (`ReportChart.tsx:29`) dengan pola titik-titik dekoratif, yang muncul bahkan sebelum ada data. Sementara itu angka ringkasan — hal yang paling dicari pengguna — tidak punya tempat sama sekali. Ruang layar terbesar diberikan pada elemen yang informasinya paling sedikit.

**VD-4 · Tidak ada aturan hierarki tombol — DAMPAK RENDAH**
Tombol Generate memakai `bg-primary`; tombol PDF memakai warna gelap kustom `#0F172A`; tombol Excel memakai outline `text-primary`. Tiga gaya untuk tiga tombol, tanpa logika primary/secondary/tertiary yang bisa dijelaskan.

**VD-5 · Judul chart menjanjikan data yang belum ada — DAMPAK RENDAH**
`ReportChart.tsx:20` menampilkan "Live Preview: Asset Valuation Summary" sebagai default meski `previewData` masih `null` dan yang tampil adalah empty state. Judul dan isi saling bertentangan.

### 4.6 Responsif

**RSP-1 · Hasil terdorong jauh ke bawah di layar kecil — DAMPAK SEDANG**
Di bawah breakpoint `lg`, grid 12 kolom (`Reports.tsx:94`) menumpuk: `ReportConfigForm` (form 3 field) lalu `ExportPanel` (2 tombol) menempati seluruh viewport pertama. Pengguna harus scroll melewati dua kartu konfigurasi sebelum melihat hasil apa pun — setiap kali men-generate ulang.

**RSP-2 · Tinggi chart tetap 350px di semua breakpoint — DAMPAK RENDAH**
`ReportChart.tsx:29`. Di layar sempit, label sumbu X (nama kategori/service type) bertumpuk dan terpotong.

**RSP-3 · Tabel riwayat memaksa scroll horizontal untuk kolom mati — DAMPAK RENDAH**
`min-w-[600px]` (`ReportHistoryTable.tsx:24`) untuk 5 kolom, salah satunya kolom Status yang isinya selalu sama (ST-5).

### 4.7 Tata Kelola & Akses

**GOV-1 · Semua pengguna bisa membaca dan menghapus report siapa pun — DAMPAK SEDANG**
`20260724000000_create_report_history.sql`: policy SELECT `USING (true)`. `20260724010000_add_delete_policy_to_report_history.sql`: policy DELETE `USING (true)`. Artinya setiap pengguna terautentikasi bisa membaca snapshot keuangan **semua subsidiary** (karena `report_data` menyimpan detail per-aset), dan bisa menghapus arsip milik orang lain tanpa jejak selain activity log. Untuk fitur yang menghasilkan dokumen ber-tanda tangan, model kepercayaan ini terlalu longgar. Perlu keputusan produk, bukan sekadar perbaikan teknis.

---

## 5. Ringkasan Temuan

| Kategori | Tinggi | Sedang | Rendah | Total |
|---|---|---|---|---|
| IA — Arsitektur Informasi | 3 | 4 | 2 | 9 |
| DATA — Kebenaran Data | 3 | 3 | 1 | 7 |
| ST — State & Feedback | 2 | 3 | 2 | 7 |
| A11Y — Aksesibilitas | 1 | 3 | 3 | 7 |
| VD — Visual Design | 1 | 2 | 2 | 5 |
| RSP — Responsif | 0 | 1 | 2 | 3 |
| GOV — Tata Kelola | 0 | 1 | 0 | 1 |
| **Total** | **10** | **17** | **12** | **39** |

---

## 6. Arah Desain

Tiga prinsip yang memandu seluruh rencana di bagian 7:

**1. Layar tidak boleh menampilkan lebih sedikit daripada file ekspor.**
Semua yang muncul di PDF harus bisa dilihat di layar lebih dulu. PDF adalah *salinan* dari apa yang pengguna sudah lihat dan setujui, bukan sesuatu yang baru terbuka setelah di-download.

**2. Report adalah artefak, bukan tampilan.**
Konsekuensinya: report punya identitas (siapa, kapan, konfigurasi apa), bisa dibuka lagi, bisa dibagikan lewat link, dan penyimpanannya adalah keputusan sadar — bukan efek samping dari menekan tombol preview.

**3. Ikuti Dashboard, jangan menciptakan pola baru.**
`FilterBar`, `MultiSelectDropdown`, `StatCard`, `Skeleton`, `Pagination`, `EmptyState`, dan design token semuanya sudah ada dan sudah terbukti di Dashboard. Upgrade ini seharusnya lebih banyak *memakai* daripada *membangun*.

### Layout target

Dari grid 4/8 kolom (konfigurasi di kiri, hasil di kanan) menjadi tumpukan penuh-lebar — mengikuti pola Dashboard, karena konfigurasi hanya 3–5 kontrol yang muat di satu bar horizontal, dan hasil report butuh lebar penuh untuk tabel detail.

```
┌──────────────────────────────────────────────────────────────────────┐
│ Laporan & Analitik                                                   │
│ Susun, tinjau, dan ekspor data aset, depresiasi, dan perawatan.      │
├──────────────────────────────────────────────────────────────────────┤
│ [Jenis Report ▾] [Periode ▾ preset] [Subsidiary ▾] [Kategori ▾] ⋯    │
│ Chip aktif: Subsidiary: TIP ×   2026 YTD ×          [Hapus semua]    │
│                                        [Tinjau]  [Simpan ke Riwayat] │
├──────────────────────────────────────────────────────────────────────┤
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  ← summary[]    │
│  │ Total    │ │ Jumlah   │ │ Kategori │ │ Rata-rata│    (IA-1)       │
│  │ $12.4M   │ │ 2.901    │ │ 14       │ │ $4.276   │                 │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘                 │
├──────────────────────────────────────────────────────────────────────┤
│  Valuasi Aset per Kategori          [PDF] [Excel] [CSV]  ← IA-9      │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │   ▇▇▇     ▇▇        ▇▇▇▇                                       │  │
│  └────────────────────────────────────────────────────────────────┘  │
├──────────────────────────────────────────────────────────────────────┤
│  Rincian Data · 2.901 baris          [cari…]            ← IA-2       │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │ No. Aset │ Deskripsi │ Kategori │ Subsidiary │ Tanggal │ Biaya │  │
│  │ ...                                                            │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                          ◀ Halaman 1 dari 59 ▶       │
├──────────────────────────────────────────────────────────────────────┤
│  Riwayat Report            (klik baris → buka snapshot)   ← IA-3     │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │ Nama │ Dibuat oleh │ Tanggal │ Baris │ [buka] [ekspor] [hapus] │  │
│  └────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
```

Perubahan struktural yang perlu dicatat:

- `ExportPanel` sebagai kartu terpisah **dihapus** (IA-9); tombolnya pindah ke header kartu chart.
- Kolom **Status** di riwayat diganti **Jumlah Baris** (ST-5) — informasi yang benar-benar berbeda antar baris.
- Aksi utama di bar konfigurasi jadi **dua**: "Tinjau" (tidak menyimpan) dan "Simpan ke Riwayat" (IA-4).

---

## 7. Rencana Upgrade — 5 Fase

Fase disusun berdasarkan **dampak per satuan usaha**, dan tiap fase berdiri sendiri (bisa di-deploy tanpa menunggu fase berikutnya).

### Fase 1 — Tampilkan hasilnya di layar

**Menyelesaikan:** IA-1, IA-2, DATA-2, DATA-3, ST-1, ST-2 · **6 temuan (5 tinggi)**
**Perkiraan usaha:** Sedang (1–2 sesi) · **Nilai:** Tertinggi — ini yang mengubah halaman dari "generator file" jadi "alat analisis"

1. **Komponen baru `ReportSummaryCards.tsx`** — merender `previewData.summary` sebagai 4 `StatCard` (pola yang sama dengan `DashboardKpiRow`). Tidak perlu perhitungan baru; datanya sudah ada.
2. **Komponen baru `ReportDetailTable.tsx`** — merender `detailColumns` + `detailData` dengan pagination sisi-klien (25/halaman, pakai `Pagination` yang sudah ada), header sticky, format currency lewat `formatCurrency` untuk kolom bertanda `currency: true`, dan pewarnaan untuk kolom `variance` (paritas dengan `exportPdf.ts:122-129`).
3. **Perbaiki rentang tanggal default** — hitung dari `new Date()`: awal tahun berjalan s/d hari ini. Hapus literal `'2023-01-01'`/`'2023-12-31'`.
4. **Perbaiki `generatedBy`** — ambil dari `useAuth()`, memakai logika yang sama persis dengan `ReportContext.tsx:87-89`. Sebaiknya diangkat jadi helper bersama supaya nama di PDF dan nama di riwayat dijamin sama.
5. **Tampilkan `loading` dan `error`** — ambil keduanya dari `useReport()`, render banner error di atas hasil dan skeleton pada tabel riwayat.
6. **Toast untuk ekspor** — sukses ("PDF tersimpan") dan gagal ("Tidak ada data untuk diekspor"), memakai `ui/Toast.tsx`. Ubah `exportPdf`/`exportXlsx` supaya mengembalikan hasil, bukan `return` senyap.

> **Catatan urutan:** langkah 1 dan 2 juga menyelesaikan sebagian besar A11Y-4 — tabel detail adalah alternatif teks terbaik untuk chart.

### Fase 2 — Kontrol & alur kerja

**Menyelesaikan:** IA-4, IA-5, IA-6, IA-7, IA-9, DATA-1, DATA-4, ST-4, ST-5, ST-6, VD-3 · **11 temuan (1 tinggi)**
**Perkiraan usaha:** Sedang–besar (2 sesi) · **Nilai:** Tinggi — mengubah alur dari "sekali tembak" jadi eksploratif

1. **Pisahkan Tinjau dari Simpan** — `generatePreview` berhenti memanggil `saveReport`. Tombol kedua "Simpan ke Riwayat" muncul setelah preview ada, dan nonaktif setelah snapshot yang sama tersimpan.
2. **Konfigurasi jadi `FilterBar` penuh-lebar** — pakai `FilterBar` + `MultiSelectDropdown` yang sudah ada, tambah dimensi kategori, lokasi, dan status. Chip filter aktif memakai `FilterChips`. `ReportConfigForm` dan `ExportPanel` dalam bentuk kartu kiri dihapus.
3. **Preset periode** — dropdown: Tahun Berjalan (YTD), Kuartal Berjalan, Kuartal Lalu, Tahun Lalu, Kustom. Kustom membuka dua date picker.
4. **Validasi tanggal** — `dateEnd` tidak boleh sebelum `dateStart`; tampilkan pesan inline dan nonaktifkan tombol Tinjau, jangan biarkan menghasilkan report kosong.
5. **State di URL** — `useSearchParams` untuk `type`, `sub`, `from`, `to`, dan filter tambahan; mengikuti pola `Dashboard.tsx`. Report jadi bisa di-bookmark dan dikirim sebagai link.
6. **Samakan isi Excel dengan PDF** — `exportXlsx` menulis dua sheet: `Ringkasan` (agregat + `summary`) dan `Rincian` (`detailColumns`/`detailData`), sehingga file Excel dan PDF berisi hal yang sama.
7. **Buang indikator palsu** — hapus badge "Sync Complete"; ganti dengan metadata nyata: "2.901 baris · dibuat 27 Agu 2026, 14:03". Ganti kolom Status di riwayat dengan Jumlah Baris.
8. **Perbaiki indikator generating** — set state sebelum builder berjalan, dan pindahkan komputasi keluar dari jalur render sinkron (minimal `requestIdleCallback`/`setTimeout` supaya spinner sempat tampil).

### Fase 3 — Riwayat jadi berguna ✅ (kecuali GOV-1)

**Menyelesaikan:** IA-3, IA-8, ST-3, ST-7 · GOV-1 ditunda atas permintaan — butuh keputusan produk dulu · **5 temuan (1 tinggi)**
**Perkiraan usaha:** Sedang (1–2 sesi) · **Nilai:** Tinggi — memenuhi sepertiga JTBD yang sekarang gagal total

> **Implementasi aktual (27 Agustus 2026):** IA-3 (buka + ekspor snapshot) diselesaikan dengan pendekatan yang sedikit berbeda dari wireframe di bagian 6 — alih-alih tombol PDF/Excel/CSV terpisah per baris riwayat, tombol "Open" (ikon mata) memuat snapshot ke area hasil (dengan banner mode-arsip + "Kembali ke data terkini"), lalu tombol ekspor yang sudah ada di header chart dipakai apa adanya. Ini persis mengikuti catatan teknis di rencana ini (html2canvas butuh elemen DOM chart yang sudah ter-render) sambil menghindari duplikasi tiga handler ekspor per baris. Tombol "Run again" (ikon refresh) mengisi Report Type/Period/Subsidiary dari baris riwayat lalu pengguna klik Review — restorasi Subsidiary bersifat best-effort karena hanya label tampilan yang tersimpan, bukan array filter mentah.



1. **Buka snapshot** — klik baris riwayat memuat `report.reportData` ke `previewData`, dengan banner mode-arsip yang jelas: "Menampilkan snapshot dari 24 Jul 2026 — angka mungkin berbeda dari data saat ini" plus tombol "Kembali ke data terkini".
2. **Ekspor dari riwayat** — tombol PDF/Excel per baris riwayat, tanpa perlu men-generate ulang. Karena snapshot menyimpan `summary` dan `detailData`, hasil ekspornya identik dengan aslinya. *(Catatan teknis: chart di PDF membutuhkan elemen DOM untuk `html2canvas` (`exportPdf.ts:81`), jadi ekspor dari riwayat sebaiknya memuat snapshot ke preview lebih dulu, bukan mengekspor langsung dari baris.)*
3. **Generate ulang dengan konfigurasi sama** — tombol "Jalankan ulang" yang mengisi bar filter dari `reportType`/`subsidiary`/`dateStart`/`dateEnd` milik baris itu. Ini yang menjawab "laporan bulan lalu, tapi dengan data terbaru".
4. **Export CSV** — tambah `exportReportCsv` di `src/lib/reports/`, memakai `sanitizeCell` dari `src/lib/csv.ts` yang sudah ada.
5. **Skeleton + toast** — `Skeleton` saat `loading`, toast setelah hapus berhasil.
6. **Perketat RLS** — keputusan produk dulu, lalu migration. Opsi minimum: DELETE hanya untuk `user_id = auth.uid()`. Opsi lebih kuat: SELECT dibatasi per subsidiary pengguna. Ini perlu konfirmasi pemilik produk sebelum dikerjakan.

### Fase 4 — Konsistensi visual & aksesibilitas ✅

**Menyelesaikan:** VD-1, VD-2, VD-4, VD-5, A11Y-1 s/d A11Y-7, RSP-1, RSP-2, RSP-3 · **14 temuan (2 tinggi)**
**Perkiraan usaha:** Sedang (1 sesi) · **Nilai:** Sedang–tinggi — menyelesaikan utang yang sudah dibayar Dashboard

> **Implementasi aktual (27 Agustus 2026):** A11Y-1, A11Y-2, A11Y-7, dan RSP-1 sudah selesai sebagai efek samping dari refactor Fase 2 (label form, aria-label tombol hapus, fieldset tanggal, dan layout tumpukan penuh-lebar) — diverifikasi ulang di sini, tidak dikerjakan ulang. VD-2 (bahasa) sengaja dibatasi ke *layar* `/reports`: label, tombol, banner, toast, dan header tabel dipindah ke `src/i18n/id.ts` (namespace `reports`), sedangkan label kolom yang berasal dari builder (`detailColumns[].label`, `summary[].label`) dan isi dokumen ekspor (`exportPdf.ts`) sengaja dibiarkan berbahasa Inggris — keduanya mengalir langsung ke PDF/Excel/CSV yang sudah ada dan bukan bagian dari temuan VD-2. `src/components/ui/Pagination.tsx` juga dibiarkan (primitive bersama lintas halaman, di luar scope dokumen ini). VD-1: warna chart dipindah dari builder (`buildValuationReport.ts`, `buildDepreciationReport.ts`) ke `ReportChart.tsx`, dipetakan lewat `type` chart ke `var(--color-chart-N)` yang sudah ada di `index.css` — field `color` dihapus total dari `ReportPreview`. A11Y-3 diimplementasikan dengan region `aria-live="polite"` tersembunyi plus heading hasil yang di-fokus otomatis setelah Review/buka snapshot. Reports.test.tsx diperbarui mengikuti label baru (`Periode`, `Tinjau`, `ekspor ke excel`).



1. **Migrasi design token** — habiskan seluruh tabel di VD-1. Pindahkan `color` keluar dari builder (lapisan data) ke pemetaan di `ReportChart` (lapisan presentasi), pakai `--color-chart-1..8`, `--color-chart-grid`, `--color-chart-axis`.
2. **Satukan bahasa** — pilih satu (`id`, konsisten dengan arah Dashboard), pindahkan seluruh string halaman ke `src/i18n/id.ts`, termasuk yang sekarang hardcoded di `ReportHistoryTable.tsx:37` dan seluruh label form.
3. **Perbaiki label form** — `htmlFor` + `id` untuk setiap kontrol; bungkus dua input tanggal dalam `<fieldset>` + `<legend>`, beri label "Dari"/"Sampai".
4. **`aria-live` untuk hasil** — region sopan yang mengumumkan "Preview siap: 2.901 baris" setelah generate; pindahkan fokus ke heading hasil.
5. **`aria-label` pada aksi ikon** — tombol hapus menyebut report yang dituju; tambah `scope="col"` dan `<caption>` pada tabel riwayat.
6. **Enter men-generate** — `onSubmit` pada form, tombol jadi `type="submit"`.
7. **Hierarki tombol** — Tinjau = primary, Simpan = secondary, ekspor = tertiary/outline. Hapus `bg-[#0F172A]`.
8. **Responsif** — bar filter jadi dapat diciutkan di bawah `lg` sehingga hasil terlihat tanpa scroll panjang; tinggi chart responsif (`h-[260px] sm:h-[320px] lg:h-[380px]`); tabel riwayat menjatuhkan kolom sekunder di layar sempit alih-alih memaksa scroll horizontal.
9. **Judul chart jujur** — hilangkan judul default saat `previewData` masih `null`; empty state berbicara sendiri.

### Fase 5 — Kedalaman analitik (backlog)

**Menyelesaikan:** DATA-5, DATA-6, DATA-7 + kemampuan baru · **3 temuan (0 tinggi)**
**Perkiraan usaha:** Besar · **Nilai:** Sedang — kerjakan setelah 1–4 stabil dan ada permintaan nyata

1. **Nyatakan asumsi metodologi** — catatan kecil di UI dan di PDF: perilaku aset tanpa tanggal (DATA-5) dan cakupan rentang tanggal pada Depreciation Schedule (DATA-6). Alternatif yang lebih baik: jadikan pilihan eksplisit ("Sertakan aset tanpa tanggal: ya/tidak").
2. **Konsolidasi formatter** — hapus `compactCurrencyAxisFormatter` (`shared.ts:2`), pakai `formatCompactCurrency` dari `money.ts` (DATA-7).
3. **Jenis report baru** — kandidat berdasarkan modul yang sudah ada: *Reclassification Audit Trail*, *Maintenance Compliance* (jadwal vs realisasi), *Asset Register* (daftar lengkap untuk stock opname).
4. **Mode perbandingan** — periode vs periode pada report yang sama, mengikuti pola dual-metric yang sudah dipakai di `DashboardSubsidiaryBarChart` (commit `4abf242`).
5. **Report terjadwal** — sudah tercatat di luar scope pada `reports implementation.md`; butuh Edge Function + kebijakan retensi `report_history`.

---

## 8. Metrik Keberhasilan

Cara menilai apakah upgrade ini berhasil, tanpa perlu instrumentasi baru yang rumit:

| Metrik | Sekarang | Target |
|---|---|---|
| Angka yang terlihat di layar setelah Generate | 1 chart | 4 KPI + 1 chart + tabel detail |
| Klik untuk melihat nilai total sebuah report | 3 (generate → export → buka PDF) | 1 (generate) |
| Report lama yang bisa dibuka kembali | 0% | 100% |
| Rasio `EXPORT_REPORT` : `GENERATE_REPORT` di activity log | tinggi (ekspor sebagai satu-satunya cara membaca) | turun (ekspor jadi tindakan sadar untuk berbagi) |
| Baris riwayat per report yang benar-benar dipakai | banyak (tiap eksperimen tersimpan) | 1 |
| Warna hardcoded di `src/components/reports/` + `src/lib/reports/` | 10+ | 0 |
| Kontrol form dengan nama yang terbaca pembaca layar | 0 dari 4 | 4 dari 4 |
| Halaman utama tanpa state di URL | 1 (Reports) | 0 |

---

## 9. Risiko & Catatan

- **Snapshot lama tidak punya field baru.** `report_data` yang tersimpan sebelum upgrade sudah berisi `summary` dan `detailData` (keduanya sudah ada di builder sejak Juli), jadi fitur "buka snapshot" di Fase 3 seharusnya kompatibel mundur. Tetap perlu pembacaan defensif — snapshot lama tidak punya jaminan skema.
- **Ukuran `report_data`.** Satu snapshot Asset Valuation untuk 2.901 aset berisi 2.901 baris detail di dalam JSONB. Dengan riwayat yang tumbuh, tabel bisa membengkak cepat. Fase 3 sebaiknya dibarengi keputusan retensi (ikuti pola di `activity log.md`), atau menyimpan `detailData` hanya untuk report yang disimpan secara sadar — yang justru jadi lebih murah setelah Fase 2 memisahkan Tinjau dari Simpan.
- **Performa tabel detail.** Merender 2.901 baris di DOM akan berat. Fase 1 memakai pagination sisi-klien 25 baris/halaman; jika nanti butuh scroll penuh, pertimbangkan virtualisasi.
- **GOV-1 butuh keputusan, bukan cuma kode.** Memperketat RLS bisa mengunci pengguna dari report yang selama ini mereka lihat. Konfirmasi ke pemilik produk sebelum migration.
- **`html2canvas` dan token warna.** Setelah Fase 4 memindahkan warna chart ke CSS custom property, pastikan `html2canvas` di `exportPdf.ts:81` masih menangkap warna yang benar — beberapa versi bermasalah dengan `var()` yang belum ter-resolve.
- **Test yang ada bergantung pada perilaku lama.** `src/pages/Reports.test.tsx` menggerakkan komponen sampai "Export to Excel" untuk memeriksa payload `XLSX.utils.json_to_sheet`. Fase 1 (label/tombol berubah) dan Fase 2 (isi Excel berubah jadi dua sheet) akan memecahkan test ini — perlu diperbarui, bukan dilewati.

## 10. Di Luar Scope Dokumen Ini

- Perubahan pada engine depresiasi (`src/lib/depreciation.ts`) — sudah selesai dan dipakai bersama Dashboard.
- Pengiriman report lewat email.
- Report terjadwal/berulang (dicatat di Fase 5 sebagai backlog, bukan rencana).
- Kebijakan retensi/purge `report_history` (disinggung di bagian 9, perlu dokumen sendiri).
- Mode gelap — belum ada di seluruh aplikasi (`src/index.css` tidak punya blok `prefers-color-scheme`); jangan diperkenalkan hanya di halaman ini.

---

## 11. Urutan Pengerjaan yang Disarankan

```
Fase 1  ██████████  6 temuan  · 5 TINGGI · usaha sedang        ✅
Fase 2  ██████████  11 temuan · 1 TINGGI · usaha sedang-besar  ✅
Fase 3  ██████      5 temuan  · 1 TINGGI · usaha sedang        ✅ (kecuali GOV-1)
Fase 4  ████████    14 temuan · 2 TINGGI · usaha sedang        ✅
Fase 5  ███         3 temuan  · 0 TINGGI · usaha besar (backlog)  ← berikutnya
```

Fase 1 dan 2 bersama-sama menyelesaikan 8 dari 10 temuan dampak tinggi dan mengubah karakter halaman secara fundamental. Fase 4 bisa disisipkan lebih awal jika ada tekanan konsistensi visual — isinya tidak bergantung pada fase mana pun.

Setelah setiap fase: `npm run build`, `npm test`, lalu `graphify update .`.
