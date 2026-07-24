# Reports — Rencana Implementasi (Full Integration)

Status saat ini (`src/pages/Reports.tsx`):
- Preview chart sudah pakai data asli dari `AssetContext` & `MaintenanceContext` — ini sudah OK.
- ~~Export PDF/Excel: **palsu**, cuma `alert("not yet implemented")`.~~ ✅ **SELESAI** (2026-07-24) — export PDF (`jspdf`) & Excel (`xlsx`) sudah generate file asli dari `previewData`. Build lolos; manual test klik-download di browser belum sempat dilakukan (sesi dihentikan sebelum tahap itu).
- ~~Recent Reports: **palsu**, cuma `useState` lokal — hilang saat refresh, tidak sinkron antar user.~~ ✅ **SELESAI** (2026-07-24) — sekarang persist ke tabel `report_history` via `ReportContext`, plus pagination (5/halaman) & delete per baris. Lihat bagian 1a.
- Depreciation Schedule: rumus kuartalan cuma mock kasar, tidak straight-line yang benar, tidak menghormati filter date range.
- Badge "Sync Complete": dekorasi, tidak mencerminkan apa pun yang nyata.

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

## 3. Perbaikan Rumus Depreciation Schedule

Masalah di kode sekarang (`generatePreview()`, cabang `Depreciation Schedule`):
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

## Urutan Pengerjaan

1. ✅ Migration `report_history` + `ReportContext.tsx` (fondasi untuk 2 area lain) — SELESAI
2. ✅ Wiring `Reports.tsx` ke `ReportContext` (ganti local state recentReports) — SELESAI
2a. ✅ Pagination (5/halaman) + delete pada Recent Reports, migration DELETE policy — SELESAI (di luar rencana awal, tambahan atas permintaan user)
3. ✅ Install `jspdf`, `jspdf-autotable`, `xlsx` → implementasi `handleExportPDF`/`handleExportExcel` — SELESAI (kode + build; belum di-klik manual di browser)
4. Fix rumus depreciation (`monthsBetween`, `getQuartersInRange` di `utils.ts`)
5. ✅ Tambah `'GENERATE_REPORT'` dan `'EXPORT_REPORT'` ke `ActionType` union di `activityLogger.ts` — SELESAI
6. `npm run build` sudah lolos di tiap langkah. **Belum dilakukan**: test manual di browser (generate 3 report type, klik export PDF & Excel, verifikasi file ke-download, cek pagination/delete) — sesi sempat terhenti sebelum tahap ini.
7. ✅ `graphify update .` — dijalankan tiap selesai satu langkah

## Di Luar Scope (belum dikerjakan putaran ini)

- Scheduled/recurring reports (generate otomatis tiap bulan)
- Email delivery hasil report
- Retention/purge policy untuk `report_history` (tambah kalau tabel membengkak, ikuti pola `activity log.md`)
- Chart-as-image di dalam PDF (pakai `html2canvas`) — export PDF sekarang tabel data saja, bukan gambar chart
