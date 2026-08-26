# Rencana Upgrade UI/UX — Overview Dashboard

**Tanggal:** 26 Agustus 2026
**Scope:** Halaman `/dashboard` (`src/pages/Dashboard.tsx` + 5 komponen `Dashboard*.tsx` + `useDashboardMetrics` / `useDashboardFilters`)
**Status:** Rencana — belum ada kode yang diubah

---

## 1. Ringkasan Eksekutif

Dashboard saat ini **secara teknis rapi tapi secara produk belum jadi dashboard**. Hasil refactor bulan lalu sudah bagus: halaman tinggal 140 baris, komponen terpisah bersih, filter tersimpan di URL. Masalahnya ada di lapisan di atasnya — apa yang ditampilkan, dalam urutan apa, dan apa yang terjadi saat pengguna berinteraksi.

Tiga masalah terbesar:

1. **Filter berbohong.** Pengguna memfilter `Subsidiary: TIP`, tabel berubah, tapi ketiga kartu KPI dan ketiga chart tetap menampilkan angka global (2.901 aset / $299,9M). Ini melanggar mental model paling dasar dari sebuah dashboard: "yang saya lihat adalah yang saya filter."
2. **Dashboard adalah Asset Inventory kedua.** Panel bawah punya 14 kolom, `min-w-[1000px]`, filter bar 4 dropdown — duplikat penuh halaman Inventory. Ruang layar paling berharga dipakai untuk hal yang sudah ada di menu lain.
3. **Angka terpenting justru tidak ada.** Engine depresiasi (`src/lib/depreciation.ts`) baru selesai dibangun hari ini, tapi dashboard tidak menampilkan **total Net Book Value**, **akumulasi depresiasi**, atau **rasio NBV terhadap cost** — padahal itu metrik nomor satu untuk manajemen fixed asset, dan datanya sudah tersedia gratis.

Ditambah: tidak ada loading state (pengguna melihat "0" dan "$0" selama data 2.900 aset di-fetch), bahasa campur Inggris–Indonesia dalam satu layar, dan warna chart hardcoded di luar design token.

Dokumen ini memetakan 31 temuan (6 dampak tinggi, 16 sedang, 9 rendah), lalu menyusunnya jadi 4 fase kerja yang bisa dikerjakan berurutan.

---

## 2. Konteks Pengguna

Sebelum masuk temuan, asumsi tentang siapa yang memakai halaman ini (perlu dikonfirmasi ke pemilik produk):

| Persona | Yang dicari di dashboard | Frekuensi |
|---|---|---|
| **Manajer Aset / Finance** | Berapa nilai buku aset kami sekarang? Berapa yang sudah habis disusutkan? Anak perusahaan mana yang paling besar? | Harian–mingguan |
| **Staf Operasional** | Aset mana yang rusak / butuh servis? Apa yang baru masuk? | Harian |
| **Auditor / Manajemen** | Snapshot untuk rapat, tren belanja modal per tahun | Bulanan–kuartalan |

**Job-to-be-done utama dashboard:** *"Dalam 10 detik, beri tahu saya apakah ada yang perlu saya tangani hari ini, dan berapa nilai portofolio aset kami."*

Dashboard sekarang gagal di bagian "10 detik" — pengguna harus scroll melewati 3 chart untuk sampai ke tabel, dan angka nilai buku tidak ada sama sekali.

---

## 3. Temuan Audit

Setiap temuan diberi kode (`IA` = arsitektur informasi, `VD` = visual design, `ST` = state & feedback, `A11Y` = aksesibilitas, `RSP` = responsif, `PERF` = performa persepsi) dan tingkat dampak.

### 3.1 Arsitektur Informasi & Konten

**IA-1 · Filter tidak memengaruhi KPI dan chart — DAMPAK TINGGI**
`Dashboard.tsx:90-104` meneruskan `assets` (array mentah, belum difilter) ke `DashboardKpiRow` dan `useDashboardMetrics`, sementara `DashboardRecentAssetsPanel` menerima `currentAssets` yang berasal dari `filteredAssets`. Akibatnya filter hanya mengubah tabel.
Pengguna yang memilih "Subsidiary: TIP" wajar mengira KPI ikut menyempit. Ini bukan sekadar ketidaknyamanan — angka yang dibaca bisa salah dikutip ke rapat.

**IA-2 · "Recent Asset Additions" tidak menampilkan aset terbaru — DAMPAK TINGGI**
`useDashboardFilters` → `useListFilters` mengembalikan `filtered` **tanpa sort apa pun** (dicek di `useListFilters.ts:207`). Panel menampilkan aset dalam urutan apa pun yang dikirim context, lalu dipotong 10 pertama. Judulnya menjanjikan "recent"; isinya tidak. Aset yang ditambahkan hari ini bisa jadi ada di halaman 137.

**IA-3 · Book Value tidak ada di level agregat — DAMPAK TINGGI**
Kolom Book Value sudah ditambahkan ke tabel (`DashboardRecentAssetsPanel.tsx:111`), tapi hanya per baris. Dashboard tidak pernah menjawab "berapa total nilai buku kita?". Padahal `computeBookValue` sudah dipanggil untuk **semua** 2.900 aset di `Dashboard.tsx:64-67` — komputasinya sudah dibayar, hasilnya dibuang untuk 10 baris saja.

**IA-4 · Panel tabel menduplikasi halaman Asset Inventory — DAMPAK SEDANG**
14 kolom, filter bar 4 dropdown, pagination — identik dengan `/inventory`. Dashboard kehilangan identitasnya sebagai ringkasan. Konsekuensi: pengguna tidak punya alasan membuka Inventory, dan dashboard jadi berat & lambat dibaca.

**IA-5 · Donut chart mencampur dua satuan — DAMPAK SEDANG**
`DashboardCategoryPieChart.tsx`: segmen donut dihitung dari **valuasi rupiah** (`categoryData` = penjumlahan `assetCost`), tapi angka besar di tengah donut adalah `totalAssets` = **jumlah unit** (2901), dengan label "Asset Class". Tiga hal berbeda dalam satu grafik. Pembaca akan menyimpulkan proporsi segmen = proporsi jumlah aset, padahal itu proporsi nilai.

**IA-6 · Tidak ada quick action — DAMPAK SEDANG**
Tidak ada tombol "Tambah Aset", "Export", atau "Lihat semua di Inventory". Setiap tindakan mengharuskan pengguna kembali ke sidebar. Filter yang sudah disusun di dashboard juga tidak bisa dibawa ke halaman Inventory meski keduanya menyimpan state di URL.

**IA-7 · Kartu status hanya menampilkan satu status pada satu waktu — DAMPAK RENDAH**
Dropdown status di kartu ketiga (`DashboardKpiRow.tsx:77-85`) adalah solusi cerdas untuk keterbatasan ruang, tapi memaksa pengguna mengklik 5 kali untuk melihat sebaran lengkap. Distribusi status adalah informasi sekilas — seharusnya terlihat sekaligus.

**IA-8 · Chart tren tidak punya pembanding — DAMPAK RENDAH**
`DashboardTrendChart` menampilkan satu garis untuk satu tahun. Tanpa garis tahun sebelumnya atau rata-rata, pengguna tidak bisa menilai apakah lonjakan November itu normal atau anomali.

### 3.2 Visual Design

**VD-1 · Bahasa campur dalam satu layar — DAMPAK SEDANG**
Dalam satu viewport: "Overview Dashboard", "Asset Units", "Recent Asset Additions", "Top 5 Subsidiaries by Valuation" (Inggris) berdampingan dengan "Terakhir diperbarui", "Tren Pembelian Aset Tahunan" (Indonesia). Di level kode, `DashboardKpiRow.tsx:3` mengimpor `i18n/en` sementara `DashboardRecentAssetsPanel.tsx:7` mengimpor `i18n/id` — dua bahasa dirender berdampingan.

**VD-2 · Warna chart di luar design system — DAMPAK SEDANG**
- Bar chart & line chart: `fill="#0F172A"` / `stroke="#0F172A"` hardcoded, bukan token
- Pie chart: `CHART_COLORS` (`useDashboardMetrics.ts:5`) = biru/hijau/amber/merah/ungu/pink/cyan bersaturasi tinggi
- Sumbu & grid: `#e0e3e5`, `#76777d`, `#45464d`, `#c6c6cd` hardcoded di 4 file

Hasilnya dua bahasa visual: palet korporat netral (hitam/abu) untuk UI, dan palet pelangi untuk pie chart. Merah `#ef4444` di pie chart juga bertabrakan makna dengan merah error (`#ba1a1a`) yang dipakai kartu status — pembaca bisa mengira segmen merah = kategori bermasalah.

**VD-3 · Bar chart jadi "dinding hitam" — DAMPAK SEDANG**
Terlihat di screenshot: 5 batang `#0F172A` pekat berjajar tanpa nilai tertulis. Pengguna tahu KMJ paling besar, tapi tidak tahu **seberapa** besar tanpa hover satu per satu. Batang tanpa label nilai + tanpa sumbu X (`<XAxis type="number" hide />`) = grafik yang tidak bisa dibaca tanpa interaksi.

**VD-4 · Hierarki visual rata — DAMPAK SEDANG**
Semua judul panel identik: `text-lg font-semibold text-primary`. Semua kartu identik: `rounded-xl border border-outline-variant bg-surface-container-lowest shadow-sm`. Tidak ada yang menonjol, jadi mata tidak tahu harus mulai dari mana. `--color-primary: #000000` (hitam murni) dipakai untuk semua judul membuat halaman terasa keras dan monoton.

**VD-5 · Legend pie chart tidak dibatasi — DAMPAK SEDANG**
`DashboardCategoryPieChart.tsx:42-49` merender **semua** kategori sebagai legend chip dengan `flex-wrap`. Di screenshot sudah terlihat "FA Pipe Line & Metering System" pecah dua baris dan legend meluber. Kalau kategori bertambah jadi 15, kartu akan memanjang tak terkendali dan merusak grid.

**VD-6 · Ritme vertikal tidak konsisten — DAMPAK RENDAH**
Container pakai `gap-6`, tapi header punya `mb-2` tambahan dan `DashboardRecentAssetsPanel` punya `mt-2` sendiri (`:65`). Jarak antar-blok jadi 24px, 32px, 24px, 32px — tidak beraturan. Spacing sebaiknya dikelola sepenuhnya oleh parent.

**VD-7 · Tooltip Asset Cost tidak punya afordansi — DAMPAK RENDAH**
`DashboardKpiRow.tsx:62-70`: tooltip nilai penuh muncul saat hover, tapi elemennya `cursor-default` tanpa penanda visual apa pun. Tidak ada yang memberi tahu pengguna bahwa "$299.9M" bisa di-hover untuk melihat angka lengkap. Border tooltip juga hardcoded `style={{ borderColor: '#c6c6cd' }}`.

### 3.3 State & Feedback

**ST-1 · Tidak ada loading state — DAMPAK TINGGI**
`AssetContext` mengekspos `loading` (`AssetContext.tsx:91, 265`) tapi `Dashboard.tsx:19` tidak mengambilnya. Selama fetch ~2.900 aset dari Supabase, pengguna melihat dashboard yang tampak **selesai dimuat tapi kosong**: "0 Asset Units", "$0", chart kosong, tabel kosong — lalu semuanya melompat sekaligus. Ini pola paling merusak kepercayaan: pengguna sempat percaya datanya hilang.
(`PageLoader` hanya dipakai untuk Suspense route-level di `App.tsx:40`, bukan untuk data.)

**ST-2 · Tidak ada error state — DAMPAK TINGGI**
`error` juga diekspos context tapi tidak dipakai di Dashboard. Kalau fetch gagal, dashboard menampilkan nol — tidak terbedakan dari "database memang kosong". Tidak ada tombol retry.

**ST-3 · "100.0% vs last month" menyesatkan — DAMPAK SEDANG**
`calculateChange` (`useDashboardMetrics.ts:26`) mengembalikan `100` ketika `previous === 0`. Di screenshot, **kedua** kartu menampilkan "↗ 100.0% vs last month" dengan panah hijau — padahal artinya sebenarnya "tidak ada data bulan lalu untuk dibandingkan". Pertumbuhan 100% yang dilaporkan ke manajemen adalah kesalahan yang mahal.

**ST-4 · Chart tidak punya empty state — DAMPAK SEDANG**
Kalau tahun terpilih tidak punya data, `DashboardTrendChart` merender garis datar di nol — terlihat seperti "belanja modal nol", bukan "tidak ada data". Sama untuk bar & pie chart saat filter mengosongkan hasil.

**ST-5 · Perubahan filter tidak diumumkan — DAMPAK RENDAH**
Saat filter berubah, tabel berganti isi tanpa transisi atau pengumuman ke assistive tech. Tidak ada `aria-live` pada jumlah hasil.

### 3.4 Aksesibilitas

**A11Y-1 · Dropdown status tanpa label aksesibel — DAMPAK TINGGI**
`DashboardKpiRow.tsx:77-85`: `<select>` berdiri sendiri tanpa `<label>`, `aria-label`, atau `id`. Screen reader membacakan "Broken, combo box" tanpa konteks bahwa ini memilih *jenis status yang ditampilkan kartu*.

**A11Y-2 · Dropdown status tidak terlihat sebagai dropdown — DAMPAK SEDANG**
Dengan `bg-transparent`, `text-xs`, `uppercase`, dan tanpa ikon chevron, select tersebut tampil persis seperti label kartu statis lainnya ("ASSET UNITS", "ASSET COST"). Di screenshot, "BROKEN ASSET" tidak terlihat interaktif sama sekali. Fitur yang tidak ditemukan sama saja dengan fitur yang tidak ada.

**A11Y-3 · Kontras di bawah standar untuk nilai buku nol — DAMPAK SEDANG**
`text-on-surface-variant/60` (`DashboardRecentAssetsPanel.tsx:145`) ≈ `#45464d` pada opacity 60% di atas putih → rasio kontras sekitar **3:1**, di bawah minimum WCAG AA 4.5:1 untuk teks normal. Nilai buku nol justru informasi penting (aset sudah habis disusutkan) — jangan disamarkan sampai sulit dibaca.

**A11Y-4 · Chart tidak punya alternatif non-visual — DAMPAK SEDANG**
Tiga chart Recharts tanpa `role`, `aria-label`, atau tabel data alternatif. Bagi pengguna screen reader, sepertiga halaman ini kosong.

**A11Y-5 · Tooltip hanya bisa diakses lewat mouse — DAMPAK SEDANG**
Tooltip nilai valuasi penuh memakai `group-hover:opacity-100` murni CSS. Pengguna keyboard tidak akan pernah melihat angka lengkapnya.

**A11Y-6 · Struktur tabel belum semantik — DAMPAK RENDAH**
`<th>` tanpa `scope="col"`, tabel tanpa `<caption>`. Ikon `lucide-react` di kartu KPI tidak punya `aria-hidden="true"`, jadi berpotensi dibacakan sebagai konten.

**A11Y-7 · Focus state tidak konsisten — DAMPAK RENDAH**
Beberapa elemen pakai `focus:ring-1 focus:ring-primary`, select di KpiRow pakai `focus:outline-none` **tanpa** pengganti — fokus keyboard hilang total di elemen itu.

### 3.5 Responsif

**RSP-1 · Tabel selalu horizontal scroll — DAMPAK SEDANG**
`min-w-[1000px]` di dalam `max-w-7xl` dengan sidebar ~256px berarti di layar < 1400px tabel selalu ter-scroll horizontal, tanpa indikator visual bahwa ada kolom tersembunyi. Di layar mobile, panel ini praktis tak terpakai.

**RSP-2 · KPI 3 kolom terlalu sempit di tablet — DAMPAK RENDAH**
`md:grid-cols-3` aktif dari 768px. Tiga kartu berisi `text-4xl font-bold` seperti "$299.9M" di lebar ~230px per kartu akan terasa sesak.

**RSP-3 · Tinggi chart tetap di semua ukuran — DAMPAK RENDAH**
`h-72` dan `h-64` tidak menyesuaikan. Di mobile, chart batang horizontal dengan 5 label jadi terlalu padat.

### 3.6 Performa Persepsi

**PERF-1 · Book value dihitung untuk semua aset, dipakai 10 — DAMPAK SEDANG**
`Dashboard.tsx:64-67` memanggil `computeBookValue` untuk seluruh 2.900 aset setiap kali `assets` berubah, padahal hanya 10 baris yang dirender. Ini bukan bug (memoized), tapi pemborosan — dan sekaligus peluang: hasil komputasi yang sama seharusnya dipakai untuk KPI Net Book Value agregat (lihat IA-3), sehingga biayanya jadi sepadan.

---

## 4. Prinsip Desain yang Diusulkan

Lima aturan yang jadi dasar semua keputusan di rencana ini:

1. **Satu konteks, satu kebenaran.** Apa pun yang tampil di layar mematuhi filter aktif yang sama. Kalau sebuah angka sengaja global, beri label eksplisit ("dari seluruh portofolio").
2. **Ringkasan, bukan pengganti.** Dashboard menjawab "apa yang terjadi", Inventory menjawab "tunjukkan detailnya". Setiap blok dashboard punya jalan keluar menuju halaman detail yang membawa konteksnya.
3. **Piramida terbalik.** Angka paling penting paling atas dan paling besar. Urutan membaca: KPI → yang butuh tindakan → distribusi → tren → detail.
4. **Setiap state punya tampilan.** Loading, error, kosong, terisi — keempatnya dirancang, bukan hanya yang terakhir.
5. **Token, bukan hex.** Tidak ada warna hardcoded baru. Warna chart masuk ke `@theme` di `index.css` supaya rebrand dan dark mode nanti mungkin dilakukan.

---

## 5. Rencana Bertahap

### FASE 1 — Perbaikan Kebenaran & Kepercayaan
*Fokus: hentikan dashboard menampilkan hal yang menyesatkan. Ini prasyarat semua pekerjaan kosmetik.*

| # | Pekerjaan | Temuan | File |
|---|---|---|---|
| 1.1 | Sambungkan filter ke KPI dan seluruh chart | IA-1 | `Dashboard.tsx`, `useDashboardMetrics.ts` |
| 1.2 | Urutkan "Recent Assets" berdasarkan `createdAt` menurun | IA-2 | `useDashboardFilters.ts` atau `Dashboard.tsx` |
| 1.3 | Perbaiki label perubahan saat basis nol | ST-3 | `useDashboardMetrics.ts`, `DashboardKpiRow.tsx` |
| 1.4 | Tambah loading skeleton | ST-1 | `Dashboard.tsx` + komponen `ui/Skeleton.tsx` baru |
| 1.5 | Tambah error state dengan tombol retry | ST-2 | `Dashboard.tsx` |
| 1.6 | Beri `aria-label` + chevron pada dropdown status | A11Y-1, A11Y-2 | `DashboardKpiRow.tsx` |
| 1.7 | Naikkan kontras nilai buku nol | A11Y-3 | `DashboardRecentAssetsPanel.tsx` |

**Detail 1.1 — pola yang diusulkan:**
```
Dashboard.tsx
  filteredAssets  ──┬──> useDashboardMetrics(filteredAssets, selectedYear)  // KPI + semua chart
                    └──> currentAssets (paginated) ──> RecentAssetsPanel
```
`useDashboardMetrics` sudah menerima array aset sebagai argumen, jadi perubahannya satu baris di sisi pemanggil. Tambahkan indikator di header ketika filter aktif — misalnya subjudul *"Menampilkan 412 dari 2.901 aset"* — supaya pengguna tahu KPI sedang menyempit.

**Detail 1.3 — perilaku baru `calculateChange`:**
Kembalikan `null` (bukan `100`) ketika `previous === 0`, dan render sebagai *"Tidak ada data bulan lalu"* dalam warna netral, bukan panah hijau.

**Detail 1.4 — skeleton, bukan spinner:**
Skeleton yang mereplikasi bentuk akhir (3 kotak KPI, 2 blok chart, 8 baris tabel) mengurangi *layout shift* dan terasa lebih cepat daripada spinner. Cukup satu komponen `<Skeleton className="..." />` dengan `animate-pulse` + `bg-surface-container`.

**Hasil yang diharapkan:** dashboard tidak lagi menampilkan angka yang salah, dan pengguna selalu tahu apakah sistem sedang bekerja, gagal, atau selesai.

---

### FASE 2 — Restrukturisasi Layout & Konten
*Fokus: ubah dashboard dari "inventory kedua" jadi ringkasan sesungguhnya.*

**Layout target:**

```
┌──────────────────────────────────────────────────────────────┐
│  Overview Dashboard                     [Export] [+ Aset]    │  ← header + quick action
│  Terakhir diperbarui: … · Menampilkan 412 dari 2.901 aset     │
├──────────────────────────────────────────────────────────────┤
│  [ Filter global: Subsidiary · Class · Location · Status ]    │  ← dipindah ke atas
├──────────────┬──────────────┬──────────────┬─────────────────┤
│ Asset Units  │ Asset Cost   │ Net Book Val │ Depresiasi      │  ← 4 KPI
│ 2.901        │ $299,9M      │ $184,2M      │ $115,7M (38,6%) │
├──────────────┴──────────────┴──────────────┴─────────────────┤
│  Perlu Perhatian                                             │  ← baris status
│  [Broken 12] [Needs Service 34] [In Maintenance 8]  →detail  │
├────────────────────────────────┬─────────────────────────────┤
│  Top Subsidiaries by Valuation │  Komposisi Asset Class      │
│  (bar + label nilai)           │  (donut + legend top 6)     │
├────────────────────────────────┴─────────────────────────────┤
│  Tren Pembelian Aset — 2026 vs 2025            [Tahun ▾]     │
├──────────────────────────────────────────────────────────────┤
│  Aset Terbaru (10)                       Lihat semua →       │  ← 6 kolom saja
└──────────────────────────────────────────────────────────────┘
```

| # | Pekerjaan | Temuan | Catatan |
|---|---|---|---|
| 2.1 | Tambah KPI **Net Book Value** dan **Akumulasi Depresiasi** | IA-3, PERF-1 | Pakai ulang `bookValues` Map yang sudah dihitung; jadikan `totalBookValue` di `useDashboardMetrics` |
| 2.2 | Naikkan grid KPI jadi 4 kolom | IA-3, RSP-2 | `grid-cols-1 sm:grid-cols-2 xl:grid-cols-4` — hindari 3 kolom sempit di tablet |
| 2.3 | Ganti dropdown status jadi baris "Perlu Perhatian" | IA-7, A11Y-2 | Semua status terlihat sekaligus; tiap chip klikabel → menerapkan filter status |
| 2.4 | Pindahkan FilterBar ke atas sebagai filter global | IA-1 | Menegaskan bahwa filter berlaku untuk seluruh halaman, bukan hanya tabel |
| 2.5 | Rampingkan tabel jadi 6 kolom | IA-4, RSP-1 | Asset Number · Description · Subsidiary · Cost · Book Value · Status. Hilangkan `min-w-[1000px]` |
| 2.6 | Tambah tautan "Lihat semua →" ke Inventory dengan filter terbawa | IA-6 | Kedua halaman sudah menyimpan filter di URL — tinggal teruskan `searchParams` |
| 2.7 | Tambah quick action Export & Tambah Aset di header | IA-6 | |
| 2.8 | Perbaiki angka tengah donut | IA-5 | Ganti jadi total valuasi (satuan sama dengan segmen), atau ubah data donut jadi hitungan unit — pilih satu satuan |

**Catatan penting untuk 2.5:** merampingkan tabel adalah keputusan produk, bukan sekadar estetika. Kalau ada pengguna yang benar-benar memakai 14 kolom di dashboard (bukan di Inventory), konfirmasi dulu sebelum memotong. Alternatif yang lebih aman: sediakan toggle "Tampilan ringkas / lengkap" dengan default ringkas.

---

### FASE 3 — Bahasa Visual & Konsistensi
*Fokus: satu sistem visual, satu bahasa.*

| # | Pekerjaan | Temuan |
|---|---|---|
| 3.1 | Putuskan bahasa antarmuka (rekomendasi: **Indonesia** untuk semua), migrasikan seluruh string ke satu file i18n | VD-1 |
| 3.2 | Pindahkan palet chart ke `@theme` di `index.css` sebagai `--color-chart-1` … `--color-chart-6` | VD-2 |
| 3.3 | Ganti `CHART_COLORS` pelangi dengan skala yang selaras palet korporat | VD-2 |
| 3.4 | Ganti semua hex hardcoded di 4 file chart dengan token | VD-2 |
| 3.5 | Tambah label nilai di ujung batang bar chart | VD-3 |
| 3.6 | Batasi legend donut ke 6 teratas + "+N lainnya" | VD-5 |
| 3.7 | Bangun hierarki tipografi bertingkat | VD-4 |
| 3.8 | Bersihkan `mb-2` / `mt-2` ad-hoc, serahkan spacing ke parent | VD-6 |
| 3.9 | Beri afordansi & akses keyboard pada tooltip valuasi | VD-7, A11Y-5 |

**Detail 3.3 — usulan palet chart.**
Palet sekarang (biru/hijau/amber/merah/ungu/pink/cyan) bertabrakan dengan makna semantik warna status. Dua pilihan:

- **Opsi A — monokrom bertingkat (rekomendasi):** satu hue (biru keabuan `--color-secondary` #515f74) dengan 6 tingkat terang. Netral, korporat, tidak pernah bentrok dengan merah/kuning status, dan urutan terangnya otomatis menandakan urutan besaran. Kelemahan: sulit membedakan >6 kategori.
- **Opsi B — kategorikal teredam:** 6 hue berbeda dengan saturasi diturunkan agar duduk berdampingan dengan palet netral, dan **merah dikeluarkan dari palet** karena sudah dipakai untuk status error.

Apa pun yang dipilih, warna harus lolos kontras terhadap latar putih dan bisa dibedakan pada simulasi buta warna deuteranopia.

**Detail 3.7 — skala tipografi:**

| Level | Sekarang | Usulan |
|---|---|---|
| Judul halaman | `text-3xl font-bold text-primary` | tetap |
| Nilai KPI | `text-4xl font-bold text-primary` | `text-3xl font-semibold` — jangan lebih besar dari judul halaman |
| Judul panel | `text-lg font-semibold text-primary` | `text-base font-semibold text-on-surface` — lebih lembut dari hitam murni |
| Label KPI | `text-xs uppercase tracking-wider` | tetap |

---

### FASE 4 — Aksesibilitas & Pemolesan
*Fokus: bisa dipakai semua orang, di semua ukuran layar.*

| # | Pekerjaan | Temuan |
|---|---|---|
| 4.1 | Tambah `role="img"` + `aria-label` deskriptif pada tiap chart | A11Y-4 |
| 4.2 | Sediakan tabel data alternatif via modal "Lihat data" pada tiap chart | A11Y-4 |
| 4.3 | Tambah `scope="col"` pada `<th>` dan `<caption>` sr-only pada tabel | A11Y-6 |
| 4.4 | Tambah `aria-hidden="true"` pada ikon dekoratif | A11Y-6 |
| 4.5 | Terapkan `focus-visible:ring-2 ring-primary ring-offset-2` konsisten di seluruh elemen interaktif | A11Y-7 |
| 4.6 | Tambah `aria-live="polite"` pada jumlah hasil filter | ST-5 |
| 4.7 | Tambah empty state untuk ketiga chart | ST-4 |
| 4.8 | Indikator scroll pada tabel (gradien tepi) jika masih ada kolom tersembunyi | RSP-1 |
| 4.9 | Tinggi chart responsif: `h-56 md:h-64 lg:h-72` | RSP-3 |
| 4.10 | Uji keyboard end-to-end: Tab melewati seluruh halaman tanpa jebakan fokus | A11Y-7 |

---

## 6. Perubahan Design Token yang Diperlukan

Tambahan pada blok `@theme` di `src/index.css`:

```css
/* Palet chart — jangan pakai hex langsung di komponen chart */
--color-chart-1: …;
--color-chart-2: …;
--color-chart-3: …;
--color-chart-4: …;
--color-chart-5: …;
--color-chart-6: …;
--color-chart-grid: #e0e3e5;   /* menggantikan hex hardcoded di CartesianGrid */
--color-chart-axis: #76777d;   /* menggantikan hex hardcoded di tick sumbu */

/* Warna semantik untuk delta KPI — sekarang pakai emerald-600 / red-600 Tailwind mentah */
--color-positive: …;
--color-negative: …;
--color-neutral: …;
```

Catatan: Recharts tidak membaca kelas Tailwind pada prop `fill`/`stroke`, jadi token perlu dibaca lewat `var(--color-chart-1)` sebagai string CSS — didukung Recharts karena nilainya diteruskan langsung ke atribut SVG.

Pertimbangkan juga menurunkan `--color-primary` dari `#000000` ke sekitar `#0F172A` (nilai yang sudah dipakai chart) — hitam murni pada teks besar terasa keras dan menyulitkan membangun tingkatan abu di bawahnya.

---

## 7. Kriteria Penerimaan

Fase dianggap selesai bila:

**Fase 1**
- [ ] Memilih filter `Subsidiary: TIP` mengubah keempat KPI **dan** ketiga chart, bukan hanya tabel
- [ ] Baris pertama "Aset Terbaru" adalah aset dengan `createdAt` paling baru
- [ ] Tidak ada teks "100.0% vs last month" saat bulan sebelumnya tidak punya data
- [ ] Refresh halaman menampilkan skeleton, bukan angka nol
- [ ] Mematikan koneksi menampilkan pesan error + tombol coba lagi
- [ ] Screen reader membacakan konteks dropdown status dengan benar

**Fase 2**
- [ ] Total Net Book Value tampil di KPI dan cocok dengan penjumlahan kolom Book Value di Inventory (dengan filter sama)
- [ ] Semua status terlihat sekaligus tanpa perlu membuka dropdown
- [ ] Klik "Lihat semua →" membuka Inventory dengan filter yang sama masih aktif
- [ ] Tabel dashboard muat tanpa horizontal scroll di layar 1366px

**Fase 3**
- [ ] Tidak ada string bahasa Inggris tersisa di halaman dashboard (atau sebaliknya, bila dipilih Inggris)
- [ ] `grep` untuk pola hex `#[0-9a-fA-F]{6}` di `src/components/Dashboard*.tsx` tidak menghasilkan apa-apa
- [ ] Nilai setiap batang terbaca tanpa hover
- [ ] Legend donut tidak pernah melebihi 2 baris

**Fase 4**
- [ ] Audit Lighthouse Accessibility ≥ 95 pada halaman dashboard
- [ ] Semua teks lolos kontras WCAG AA 4.5:1
- [ ] Seluruh halaman bisa dioperasikan dengan keyboard saja

---

## 8. Metrik Keberhasilan

Cara mengukur apakah upgrade ini berhasil, bukan sekadar "terlihat lebih bagus":

| Metrik | Cara ukur | Target |
|---|---|---|
| Waktu menemukan aset rusak | Uji koridor dengan 5 pengguna: "berapa aset rusak sekarang?" | < 5 detik (sekarang: perlu buka dropdown) |
| Kepercayaan angka | Tanyakan: "kalau Anda memfilter TIP, angka $299,9M itu untuk TIP atau semua?" | 5/5 menjawab benar |
| Kunjungan lanjutan ke Inventory | Apakah pengguna memakai "Lihat semua →" | Naik — tanda dashboard berhasil jadi titik awal, bukan tujuan akhir |
| Keluhan "data hilang" saat loading | Hitung laporan | Nol |

---

## 9. Risiko & Pertimbangan

| Risiko | Dampak | Mitigasi |
|---|---|---|
| **Merampingkan tabel dari 14 → 6 kolom** menghapus alur kerja yang dipakai seseorang | Sedang | Konfirmasi ke pengguna dulu; sediakan toggle ringkas/lengkap sebagai jalan tengah |
| **Menghitung metrik dari data terfilter** mengubah arti angka yang selama ini dikutip di laporan | Sedang | Beri label eksplisit "412 dari 2.901 aset"; pertimbangkan menampilkan angka global sebagai pembanding kecil |
| **Total Net Book Value** mengekspos kualitas data yang buruk (aset tanpa `lifeInMonths` atau `datePlaceInService`) | Sedang | Sudah teridentifikasi saat perencanaan Book Value — lakukan audit data sebelum menampilkan agregat, dan tampilkan catatan "N aset dikecualikan karena data tidak lengkap" |
| **Mengganti palet chart** mengubah warna yang sudah dikenal pengguna | Rendah | Perubahan sekali, umumkan di catatan rilis |
| **Menurunkan `--color-primary`** dari hitam murni memengaruhi seluruh aplikasi, bukan hanya dashboard | Sedang | Uji lintas halaman sebelum merge, atau batasi ke token khusus dashboard dulu |

---

## 10. Pertanyaan Terbuka

Perlu jawaban sebelum Fase 2 dimulai:

1. **Bahasa antarmuka final** — Indonesia atau Inggris? Saat ini ada dua file i18n dan keduanya dipakai bersamaan.
2. **Mata uang** — semua angka diformat sebagai USD (`en-US`, `currency: 'USD'`). Apakah data aset memang dalam dolar, atau ini format yang perlu diubah ke IDR?
3. **Apakah tabel 14 kolom di dashboard benar-benar dipakai**, atau warisan sebelum halaman Inventory ada?
4. **Siapa pengguna utama dashboard** — finance, operasional, atau manajemen? Ini menentukan KPI mana yang naik ke posisi pertama.
5. **Apakah dark mode ada di peta jalan?** Kalau ya, migrasi token di Fase 3 harus dirancang berpasangan terang/gelap sejak awal, bukan ditambal belakangan.

---

## 11. Urutan Eksekusi yang Disarankan

Fase 1 berdiri sendiri dan aman dikerjakan sekarang — semuanya perbaikan kebenaran, tidak ada keputusan produk yang tertunda. Fase 2 menunggu jawaban pertanyaan 3 dan 4. Fase 3 menunggu pertanyaan 1 dan 5. Fase 4 bisa dikerjakan kapan saja secara paralel.

Kalau waktu terbatas dan hanya bisa mengerjakan tiga hal: **1.1 (filter→KPI)**, **1.4 (loading state)**, dan **2.1 (KPI Net Book Value)**. Ketiganya memberi perubahan paling terasa per satuan usaha.
