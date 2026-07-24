# Reports — Rencana Implementasi (Full Integration)

Status saat ini (`src/pages/Reports.tsx`):
- Preview chart sudah pakai data asli dari `AssetContext` & `MaintenanceContext` — ini sudah OK.
- ~~Export PDF/Excel: **palsu**, cuma `alert("not yet implemented")`.~~ ✅ **SELESAI** (2026-07-24) — export PDF (`jspdf`) & Excel (`xlsx`) sudah generate file asli dari `previewData`. Build lolos; manual test klik-download di browser belum sempat dilakukan (sesi dihentikan sebelum tahap itu).
- ~~Recent Reports: **palsu**, cuma `useState` lokal — hilang saat refresh, tidak sinkron antar user.~~ ✅ **SELESAI** (2026-07-24) — sekarang persist ke tabel `report_history` via `ReportContext`, plus pagination (5/halaman) & delete per baris. Lihat bagian 1a.
- ~~Depreciation Schedule: rumus kuartalan cuma mock kasar, tidak straight-line yang benar, tidak menghormati filter date range.~~ ✅ **SELESAI** (2026-07-24) — straight-line yang benar (`monthsBetween`, `getQuartersInRange`), kuartal ikut `dateStart`/`dateEnd` user. Lihat bagian 3.
- Badge "Sync Complete": dekorasi, tidak mencerminkan apa pun yang nyata. (belum dikerjakan — di luar scope tiga area awal)

Tiga area dikerjakan sekaligus, urutan pengerjaan tetap disusun karena saling bergantung (DB dulu → export pakai data yang sama → depreciation fix independen tapi kecil).

---

## 1. Riwayat Report Tersimpan di Database — ✅ SELESAI (2026-07-24)

Migration `report_history` sudah di-apply ke project Supabase live (`kuvuylohuhuyjpzbkitp`), tabel & RLS aktif. `src/contexts/ReportContext.tsx` dibuat, `ReportProvider` di-wire ke `App.tsx`, dan `Reports.tsx` dipindah dari state lokal `recentReports` ke `useReport()`. Action type `GENERATE_REPORT` ditambahkan ke `activityLogger.ts`. Build (`npm run build`) sukses.

### Skema baru — migration `supabase/migrations/20260724000000_create_report_history.sql`

Mengikuti pola `activity_logs` yang sudah ada (lihat migration `20260701000000_create_activity_logs.sql`):

```sql
CREATE TABLE IF NOT EXISTS report_history (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_name     TEXT NOT NULL,
  report_type   TEXT NOT NULL,        -- 'Asset Valuation Summary' | 'Depreciation Schedule' | 'Maintenance Cost Analysis'
  subsidiary    TEXT,                 -- 'All Divisions' atau nama subsidiary
  date_start    DATE,
  date_end      DATE,
  report_data   JSONB NOT NULL,       -- snapshot hasil generate (chart data), dipakai untuk re-render tanpa query ulang & untuk export
  status        TEXT NOT NULL DEFAULT 'Generated',
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_report_history_created_at ON report_history(created_at DESC);

ALTER TABLE report_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated users can read report history"
  ON report_history FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "users can insert own report history"
  ON report_history FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);
```

Catatan desain:
- `report_data JSONB` menyimpan snapshot chart (bukan hanya metadata) supaya "View All" / klik row bisa render ulang chart tanpa re-fetch assets, dan supaya export PDF/Excel bisa dipicu dari riwayat lama.
- Read policy `USING (true)` disamakan dengan `activity_logs` — semua user login bisa lihat semua report (tim kecil, transparansi antar divisi). Insert dibatasi ke `auth.uid() = user_id`.
- Tidak pakai retention/purge otomatis dulu (beda dari `activity_logs` yang punya purge 3 bulan) — laporan biasanya perlu disimpan lebih lama untuk audit. Bisa ditambah belakangan kalau tabel membengkak.

### Perubahan kode

**`src/contexts/ReportContext.tsx` (baru)** — mengikuti pola `AssetContext`/`MaintenanceContext` (fromDb/toDb converter, fetch on mount):
- `reportHistory: ReportRecord[]`
- `fetchReportHistory()` — SELECT dari `report_history`, order by `created_at desc`, limit 20
- `saveReport(params)` — INSERT ke `report_history`, lalu prepend ke state lokal (optimistic, sama pola dengan context lain di project ini)

**`src/pages/Reports.tsx`**:
- Ganti `recentReports` local state → pakai `useReport()` dari context baru
- `generatePreview()` setelah berhasil generate → panggil `saveReport()` alih-alih `setRecentReports`
- Tombol "View All" → arahkan ke halaman baru atau modal daftar penuh (scope minimal: modal sederhana yang list semua row dari `reportHistory`)
- Panggil `logActivity({ actionType: 'GENERATE_REPORT', entityType: 'system', details: { reportType, subsidiary } })` — perlu tambah `'GENERATE_REPORT'` ke union `ActionType` di `src/lib/activityLogger.ts`

### 1a. Pagination & Delete pada Recent Reports — ✅ SELESAI (2026-07-24)

Ditambahkan di luar rencana awal, atas permintaan user: Recent Reports tadinya nampilin semua row (maks 20 dari `.limit(20)`) tanpa cara menghapus. Sekarang:

- **Migration `supabase/migrations/20260724010000_add_delete_policy_to_report_history.sql`** — tambah RLS policy `FOR DELETE` di `report_history`, pola sama dengan `asset_reclassifications` (semua authenticated user boleh hapus, `USING (true)`). Sudah di-apply ke DB live.
- **`ReportContext.tsx`** — diganti dari fetch sekali `limit(20)` jadi pagination server-side: `.select('*', { count: 'exact' }).range(from, to)`, page size **5**. State baru: `page`, `totalPages`, `totalCount`, `setPage`. Fungsi baru `deleteReport(id)` — DELETE ke Supabase, lalu refetch halaman aktif (atau mundur satu halaman kalau item terakhir di halaman itu yang dihapus). `saveReport()` sekarang lompat ke halaman 1 setelah generate report baru supaya report terbaru langsung kelihatan.
- **`Reports.tsx`** — tombol "View All" (dulu non-fungsional, tanpa `onClick`) dihapus, diganti footer pagination bergaya sama dengan tabel Inventory (`ChevronLeft`/`ChevronRight` + "Page X of Y"). Tiap baris dapat tombol trash icon dengan `window.confirm` sebelum delete, konsisten dengan pola `handleDeleteAsset` di Inventory.tsx.

Build (`npm run build`) sukses.

---

## 2. Export PDF & Excel Beneran — ✅ SELESAI (2026-07-24, kode; manual browser test pending)

### Dependencies baru

```
npm install jspdf jspdf-autotable xlsx
```

- `jspdf` + `jspdf-autotable` → PDF dengan tabel data laporan (bukan screenshot chart, lebih ringan & reliable daripada `html2canvas`)
- `xlsx` (SheetJS) → generate `.xlsx` asli, bukan CSV yang di-rename

### Perubahan kode — `src/pages/Reports.tsx`

Ganti `handleExport(type)` yang sekarang cuma `alert(...)`:

```ts
const handleExportPDF = () => {
  if (!previewData) return;
  const doc = new jsPDF();
  doc.text(previewData.title, 14, 16);
  doc.text(`${subsidiary} | ${dateStart} – ${dateEnd}`, 14, 23);
  autoTable(doc, {
    startY: 30,
    head: [Object.keys(previewData.data[0])],
    body: previewData.data.map((row: any) => Object.values(row)),
  });
  doc.save(`${reportType.replace(/\s+/g, '_')}.pdf`);
};

const handleExportExcel = () => {
  if (!previewData) return;
  const ws = XLSX.utils.json_to_sheet(previewData.data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, reportType.slice(0, 31)); // sheet name max 31 char
  XLSX.writeFile(wb, `${reportType.replace(/\s+/g, '_')}.xlsx`);
};
```

Catatan implementasi aktual (beda kecil dari draft di atas):
- Kedua tombol export sekarang `disabled={!previewData}` (bukan alert) — user harus generate preview dulu. Style abu-abu otomatis via `disabled:opacity-40`.
- Export memakai `previewData.data` yang sama dengan yang dipakai chart — satu sumber kebenaran, tidak query ulang.
- Nama file pakai helper `exportFileName()` = `${reportType}_${dateStart}_to_${dateEnd}`, bukan cuma nama report type.
- Setelah export sukses, log activity `EXPORT_REPORT` — action type ini sudah ditambahkan ke `ActionType` union di `activityLogger.ts`.
- `npm install jspdf jspdf-autotable xlsx` sudah dijalankan. **Catatan keamanan**: `npm audit` menandai `xlsx` severity high (Prototype Pollution + ReDoS, CVE lama yang belum di-patch di npm registry — SheetJS pindah distribusi ke CDN mereka sendiri). Risikonya rendah di sini karena kita cuma *menulis* file (`json_to_sheet` + `writeFile`) dari data kita sendiri, tidak pernah `XLSX.read()` file upload dari user — beda dengan skenario yang biasanya dieksploitasi CVE ini. Kalau nanti ada fitur import `.xlsx` dari user, perlu di-review ulang.

---

## 3. Perbaikan Rumus Depreciation Schedule — ✅ SELESAI (2026-07-24)

`monthsBetween()` dan `getQuartersInRange()` ditambahkan ke `src/lib/utils.ts`. Cabang `Depreciation Schedule` di `generatePreview()` (`Reports.tsx`) diganti total: kuartal sekarang dihasilkan dari `dateStart`/`dateEnd` yang dipilih user (bukan hardcode Q1–Q4 "sekarang"), dan tiap kuartal menghitung `depreciatedValue = max(0, cost * (1 - min(ageMonths, life) / life))` per asset berdasarkan `datePlaceInService` aset itu — otomatis floor di 0 begitu `ageMonths >= lifeInMonths`. Aset tanpa `datePlaceInService` dianggap belum terdepresiasi (nilai penuh), sama seperti sebelumnya. Label ringkasan "Net Book Value" sekarang memakai label kuartal terakhir yang sesungguhnya (bukan hardcode "(Q4)"), karena jumlah kuartal kini mengikuti panjang date range. Build (`npm run build`) sukses.

Masalah di kode lama (`generatePreview()`, cabang `Depreciation Schedule`) — sudah diperbaiki:
- `depPerQuarter` dihitung dari `lifeInMonths` tapi tidak pernah dikurangi akumulasi umur aset yang sudah berjalan sejak `datePlaceInService`
- Q1–Q4 selalu dihitung dari titik "sekarang", tidak selaras dengan `dateStart`/`dateEnd` yang dipilih user
- Tidak ada floor di masa pakai habis (`lifeInMonths` terlampaui → nilai harusnya 0, bukan terus dikurangi)

### Rumus straight-line yang benar

Untuk tiap asset, per titik waktu `t` (akhir tiap kuartal dalam range terpilih):

```
ageInMonths(t)     = months between datePlaceInService and t (floor di 0)
depreciatedValue(t) = max(0, assetCost * (1 - ageInMonths(t) / lifeInMonths))
```

Ganti implementasi:

```ts
const quarters = getQuartersInRange(start, end); // helper baru: array {label, endDate}

const data = quarters.map(q => {
  const totalValue = filteredAssets.reduce((sum, a) => {
    const cost = parseFloat(a.assetCost.replace(/[^0-9.-]+/g, "")) || 0;
    const life = parseInt(a.lifeInMonths) || 60;
    const placedInService = a.datePlaceInService ? new Date(a.datePlaceInService) : null;
    if (!placedInService) return sum + cost; // no service date → assume undepreciated
    const ageMonths = monthsBetween(placedInService, q.endDate);
    const remaining = Math.max(0, cost * (1 - Math.min(ageMonths, life) / life));
    return sum + remaining;
  }, 0);
  return { name: q.label, value: totalValue };
});
```

`getQuartersInRange` dan `monthsBetween` jadi helper kecil baru di `src/lib/utils.ts` (dekat `cn()`), dipakai murni untuk kalkulasi ini.

---

## 4. PDF Export — Peningkatan Kualitas Laporan (4.1–4.6 ✅ SELESAI)

Hasil diskusi (2026-07-24): PDF sekarang (`handleExportPDF`, `Reports.tsx:151-170`) cuma judul + baris filter + satu tabel mentah dari `previewData.data` (agregat level kategori). Dari sudut pandang manager asset management yang mau bawa laporan ini ke rapat atau lampiran audit, ini masih terasa "data dump" — tidak ada ringkasan angka, tidak ada chart, tidak ada identitas/footer dokumen. Rencana perbaikan dipecah jadi beberapa bagian, diurutkan dari yang paling murah/dampak besar ke yang butuh perubahan struktur data.

### 4.1 Quick wins — tidak butuh dependency baru atau ubah struktur data — ✅ SELESAI (2026-07-24)

- **Grand total / subtotal row** di akhir tabel `autoTable` (`Asset Valuation`, `Maintenance Cost` — jumlahkan kolom numerik dari `previewData.data`). ✅ diimplementasi via opsi `foot` di `autoTable`, dihitung generik dari `numericHeaders` (kolom bertipe `number` di baris pertama data) supaya jalan untuk ketiga jenis report tanpa hardcode nama kolom.
- **Currency formatting per kolom** — sekarang angka tampil mentah (`50000.5`), harus `Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })` sebelum masuk ke `body` di `autoTable`, sama seperti formatter yang sudah dipakai di tooltip chart. ✅ diimplementasi via `formatCurrency()` + `formatCell()`, hanya diterapkan ke kolom numerik (kolom label seperti `name` tidak diformat).
- **Footer berulang tiap halaman** — nomor halaman ("Page X of Y") + timestamp generate. ✅ diimplementasi dengan loop `doc.setPage(i)` setelah `autoTable` selesai (pola lebih sederhana daripada hook `didDrawPage`, karena `pageCount` final baru diketahui setelah tabel selesai dirender).
- **Header dokumen** — tambah "Generated by {user} on {timestamp}" di bawah judul. ✅ diimplementasi, memakai `reportHistory[0]?.userName` (baris paling atas Recent Reports = report yang baru saja disimpan oleh `generatePreview()`) dan waktu saat tombol export diklik (bukan `createdAt` report, supaya mencerminkan kapan file PDF-nya benar-benar dibuat).

Catatan implementasi: perubahan hanya di `handleExportPDF` (`Reports.tsx`), tidak menyentuh `handleExportExcel` — untuk `.xlsx` angka mentah sengaja dipertahankan (bukan string currency) supaya tetap bisa di-sort/dihitung ulang di Excel. Build (`npm run build`) sukses. **Belum dilakukan**: klik manual di browser untuk verifikasi visual (grand total row, footer, currency format) — sama seperti item export PDF/Excel sebelumnya, manual browser test masih pending.

### 4.2 Executive summary di atas tabel — ✅ SELESAI (2026-07-24)

Sebelum tabel detail, render 3-4 angka ringkas dalam baris kotak (mirip stat card di preview browser): total nilai, jumlah aset/record, rata-rata, dan untuk Depreciation Schedule tambahan Net Book Value akhir periode. ✅ diimplementasi: tiap cabang `generatePreview()` (`Reports.tsx`) sekarang menghitung array `summary: { label, value }[]` sekali saat data digenerate, disimpan bareng `previewData` (jadi juga otomatis tersimpan ke `report_history.report_data` lewat `saveReport()`, tanpa perlu ubah skema). `handleExportPDF` menggambar tiap item summary sebagai grid label/value pakai `doc.text()` di baris y=40-46, sebelum `autoTable` — `startY` tabel disesuaikan otomatis (54 kalau ada summary, 34 kalau tidak).

Metrik per jenis report:
- **Asset Valuation Summary**: Total Asset Value, Total Assets, Categories, Avg Value / Asset
- **Depreciation Schedule**: Total Original Cost, Net Book Value (Q4), Total Depreciation, Total Assets
- **Maintenance Cost Analysis**: Total Estimated, Total Actual, Variance, Records

Build (`npm run build`) sukses. Manual browser test masih pending (sama seperti item 4.1).

### 4.3 Chart sebagai gambar di PDF — ✅ SELESAI (2026-07-24)

Chart preview (bar/line) jauh lebih cepat dibaca daripada tabel angka, tapi PDF sebelumnya membuangnya sama sekali. ✅ diimplementasi: `npm install html2canvas` (ternyata sudah ada di `package.json` dari langkah sebelumnya). Div container chart (`Reports.tsx`, sekitar baris 368) diberi `ref={chartRef}` (`useRef<HTMLDivElement>`) dan class `bg-white` tambahan — supaya capture-nya selalu berlatar putih di PDF, terlepas dari tema gelap/terang aplikasi. `handleExportPDF` diubah jadi `async`: setelah header + summary boxes digambar, `html2canvas(chartRef.current, { backgroundColor: '#ffffff', scale: 2 })` meng-capture chart Recharts yang sedang tampil ke canvas, lalu `doc.addImage(canvas.toDataURL('image/png'), 'PNG', 14, cursorY, 180, imgHeight)` menyisipkannya sebelum `autoTable` (aspect ratio dijaga dari rasio canvas asli). `cursorY` untuk `autoTable.startY` sekarang dihitung dinamis (34 → 54 kalau ada summary → + tinggi gambar + 10 kalau chart berhasil di-capture), bukan konstanta hardcode seperti sebelumnya.

Perubahan tambahan:
- State baru `exportingPdf` — tombol "Download as PDF" menampilkan teks "Rendering chart..." dan disabled selama `html2canvas` bekerja (proses capture DOM bisa makan waktu beberapa ratus ms, terutama chart dengan banyak data point).
- `scale: 2` dipakai supaya gambar chart tidak pecah/blur di PDF (html2canvas default capture di resolusi CSS pixel, bukan device pixel ratio).
- Tidak menyentuh `handleExportExcel` — chart-as-image cuma relevan untuk PDF, Excel tetap tabel data mentah.

Build (`npm run build`) sukses. Manual browser test masih pending (sama seperti item 4.1/4.2) — perlu verifikasi visual bahwa chart ter-render dengan benar di PDF hasil download untuk ketiga jenis report (bar, line, composed bar).

### 4.4 Tabel detail per-asset, bukan cuma agregat kategori — ✅ SELESAI (2026-07-24)

Sebelumnya `previewData.data` cuma hasil `reduce()` per kategori — level detail per-aset (Asset ID, Description, Acquisition Date, Cost, Net Book Value) hilang sebelum sempat masuk PDF. ✅ diimplementasi: tiap cabang `generatePreview()` (`Reports.tsx`) sekarang juga menghasilkan `detailColumns` (definisi kolom eksplisit `{ key, label, currency? }`, bukan auto-derive dari nama field mentah supaya header di PDF tetap human-readable) dan `detailData` (array raw row dari `filteredAssets`/`filteredRecords`, satu row = satu asset/record, bukan agregat). Keduanya ikut tersimpan ke `report_data` JSONB lewat `saveReport()` tanpa perlu ubah skema (sama seperti `summary` di 4.2).

Kolom detail per jenis report:
- **Asset Valuation Summary**: Asset Number, Description, Category, Subsidiary, Acquisition Date, Cost.
- **Depreciation Schedule**: Asset Number, Description, Cost, Accumulated Depreciation, Net Book Value, Remaining Life (Months) — dihitung per-asset di titik `dateEnd` (bukan per-kuartal), pakai rumus straight-line yang sama dari bagian 3 (`monthsBetween` dari `datePlaceInService` ke `end`, floor di 0/`lifeInMonths`). Ini otomatis memenuhi requirement format fixed-asset register yang tadinya direncanakan di 4.5.
- **Maintenance Cost Analysis**: Asset Number, Description, Service Type, Scheduled Date, Estimated Cost, Actual Cost, Variance (`actual - estimated`).

`handleExportPDF` (`Reports.tsx`) menambah `doc.addPage()` + tabel `autoTable` kedua setelah tabel ringkasan kategori — judul "Detail Records" + jumlah row, lalu tabel detail dengan `styles: { fontSize: 8 }` (lebih kecil karena kolomnya lebih banyak). Nilai kolom `currency: true` diformat via `formatCurrency()`, kolom lain ditampilkan apa adanya — **tidak** dilewatkan ke `sanitizeForSpreadsheet()` seperti di path Excel, karena mitigasi formula-injection itu cuma relevan untuk file yang dibuka spreadsheet app; menerapkannya di teks PDF cuma akan menambah karakter `'` yang tidak perlu di depan description yang kebetulan diawali `=`/`+`/`-`/`@`.

Build (`npm run build`) sukses. Manual browser test masih pending (sama seperti item sebelumnya).

### 4.5 Penyesuaian khusus per jenis report — ✅ SELESAI (2026-07-24)

- **Depreciation Schedule**: ✅ terpenuhi sebagai efek samping 4.4 — tabel detail sudah Asset ID, Cost, Accumulated Depreciation, Net Book Value, Remaining Useful Life per-asset (bukan cuma total per kuartal).
- **Maintenance Cost Analysis**: ✅ diimplementasi. Kolom variance sudah ada dari 4.4; sekarang tabel detail (`handleExportPDF`, `Reports.tsx`) menambah `didParseCell` di `autoTable` kedua yang mencari index kolom `variance` via `detailColumns.findIndex(c => c.key === 'variance')`, lalu untuk tiap cell body di kolom itu, kalau `detailData[row].variance > 0` (actual > estimated, over-budget) teks cell diwarnai merah (`[220, 38, 38]`) dan bold. Hook ini otomatis no-op untuk Asset Valuation & Depreciation Schedule karena `detailColumns` mereka tidak punya key `variance` (`varianceColIndex` jadi `-1`), jadi tidak perlu percabangan eksplisit per jenis report.

Build (`npm run build`) sukses. Manual browser test masih pending (sama seperti item sebelumnya) — perlu generate Maintenance Cost Analysis dengan record yang actual cost > estimate untuk memverifikasi baris merah muncul di PDF.

### 4.6 Approval section — ✅ SELESAI (2026-07-24)

Kolom "Prepared by / Reviewed by / Approved by" di halaman terakhir, untuk laporan yang butuh sign-off formal. ✅ diimplementasi di `handleExportPDF` (`Reports.tsx`), setelah tabel detail (atau tabel ringkasan kalau tidak ada tabel detail):

- Posisi Y dihitung dari `(doc as any).lastAutoTable?.finalY` (properti yang di-attach `jspdf-autotable` ke instance `doc`, di-cast `any` karena tidak ada di type declaration `jsPDF`) + jarak 20. Kalau ruang tersisa di halaman itu tidak cukup (`approvalY + 40 > pageHeight - 15`), `doc.addPage()` dulu supaya blok sign-off tidak terpotong di tengah halaman.
- 3 kolom sejajar (`Prepared by`, `Reviewed by`, `Approved by`), tiap kolom: label bold, garis tanda tangan kosong (`doc.line()`), lalu placeholder teks statis "Name: ___" dan "Date: ___" — bukan input form yang bisa diisi ulang di PDF, murni untuk diisi manual dengan pena/tanda tangan basah setelah print, sesuai kebutuhan compliance yang biasanya masih manual.
- Label kecil "Sign-off" di atas blok sebagai penanda section, gaya sama dengan heading "Detail Records" di 4.4.

Build (`npm run build`) sukses. Manual browser test masih pending (sama seperti item sebelumnya) — perlu verifikasi visual bahwa blok sign-off tidak terpotong halaman untuk laporan dengan data pendek (1 halaman) maupun panjang (banyak asset/record, blok detail meluber ke beberapa halaman).

---

## Urutan Pengerjaan

1. ✅ Migration `report_history` + `ReportContext.tsx` (fondasi untuk 2 area lain) — SELESAI
2. ✅ Wiring `Reports.tsx` ke `ReportContext` (ganti local state recentReports) — SELESAI
2a. ✅ Pagination (5/halaman) + delete pada Recent Reports, migration DELETE policy — SELESAI (di luar rencana awal, tambahan atas permintaan user)
3. ✅ Install `jspdf`, `jspdf-autotable`, `xlsx` → implementasi `handleExportPDF`/`handleExportExcel` — SELESAI (kode + build; belum di-klik manual di browser)
4. ✅ Fix rumus depreciation (`monthsBetween`, `getQuartersInRange` di `utils.ts`) — SELESAI
5. ✅ Tambah `'GENERATE_REPORT'` dan `'EXPORT_REPORT'` ke `ActionType` union di `activityLogger.ts` — SELESAI
6. `npm run build` sudah lolos di tiap langkah. **Belum dilakukan**: test manual di browser (generate 3 report type, klik export PDF & Excel, verifikasi file ke-download, cek pagination/delete) — sesi sempat terhenti sebelum tahap ini.
7. ✅ `graphify update .` — dijalankan tiap selesai satu langkah
8. PDF quality improvements (bagian 4). Urutan disarankan: 4.1 (quick wins) → 4.2 (executive summary) → 4.4 (tabel detail, tergantung `generatePreview()` simpan raw rows) → 4.5 (penyesuaian per jenis report, tergantung 4.4 & fix depreciation di langkah 4) → 4.3 (chart-as-image, effort paling besar) → 4.6 (approval section, opsional).
   - 8a. ✅ 4.1 Quick wins (grand total row, currency formatting, footer/page number, header "Generated by") — SELESAI (2026-07-24, kode + build; manual browser test pending)
   - 8b. ✅ 4.2 Executive summary (angka ringkas per jenis report di atas tabel PDF) — SELESAI (2026-07-24, kode + build; manual browser test pending)
   - 8c. ✅ 4.3 Chart sebagai gambar di PDF (`html2canvas` capture chart container → `doc.addImage`) — SELESAI (2026-07-24, kode + build; manual browser test pending)
   - 8d. ✅ 4.4 Tabel detail per-asset (halaman kedua PDF, `detailColumns`/`detailData` per jenis report) — SELESAI (2026-07-24, kode + build; manual browser test pending). Sekaligus memenuhi requirement 4.5 untuk Depreciation Schedule.
   - 8e. ✅ 4.5 Pewarnaan merah baris over-budget di tabel detail Maintenance Cost Analysis (`didParseCell` pada kolom variance) — SELESAI (2026-07-24, kode + build; manual browser test pending)
   - 8f. ✅ 4.6 Approval section (Prepared by / Reviewed by / Approved by di halaman terakhir) — SELESAI (2026-07-24, kode + build; manual browser test pending). Semula opsional/backlog, dikerjakan atas permintaan user.

## Di Luar Scope (belum dikerjakan putaran ini)

- Scheduled/recurring reports (generate otomatis tiap bulan)
- Email delivery hasil report
- Retention/purge policy untuk `report_history` (tambah kalau tabel membengkak, ikuti pola `activity log.md`)
