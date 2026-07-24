# User Guide Update v1 — Rencana Implementasi

## Overview

`src/pages/Guide.tsx` (menu "User Guide" di sidebar) saat ini basi — isinya cuma FAQ statis (`GUIDE_CONTENT`) untuk 4 section: Getting Started, Asset Management, Maintenance, AI Features. Sejak ditulis, aplikasi sudah bertambah 5 halaman/fitur besar yang sama sekali tidak terdokumentasi di guide: **Reclassification, Master Data, Reports, Settings, Notifications**, plus fitur baru di halaman yang sudah ada (last-update timestamp di Dashboard, PDF export lanjutan di Reports, dll).

Tujuan: sinkronkan `GUIDE_CONTENT` dengan kondisi aplikasi sekarang, tanpa mengubah struktur/UI komponen Guide.tsx (accordion + tab + table of contents tetap dipakai, cuma datanya yang diperbarui/ditambah).

---

## Gap Analysis (isi lama vs kondisi sekarang)

| Section di Guide saat ini | Status |
|---|---|
| Getting Started | Perlu update — deskripsi masih generik, belum sebut Reclassification/Master Data/Reports/Settings di nav |
| Asset Management | Perlu update kecil — cek ulang detail CSV (limit 5000 baris sudah benar, tapi belum sebut sanitasi formula-injection saat export) |
| Maintenance | Sudah cukup akurat, minor polish saja |
| AI Features | Perlu update — jawaban terlalu generik, AI Assistant sekarang chat UI nyata (Cloud Run `/chat`, riwayat percakapan, quick-suggestion chips) bukan sekadar "predict maintenance needs" |
| — | **Section baru: Reclassification** (belum ada sama sekali) |
| — | **Section baru: Master Data** (belum ada sama sekali) |
| — | **Section baru: Reports** (belum ada sama sekali — padahal ini fitur paling kompleks: PDF/Excel export, chart-as-image, detail records, signature block) |
| — | **Section baru: Settings & Notifications** (belum ada sama sekali) |

---

## Struktur Section Baru (GUIDE_CONTENT)

Urutan mengikuti urutan `NAV_ITEMS` di `Layout.tsx` supaya konsisten dengan sidebar:

1. **Getting Started** (update)
2. **Asset Management** — Inventory (update kecil)
3. **Maintenance** (polish minor)
4. **Reclassification** (baru)
5. **Master Data** (baru)
6. **Reports** (baru)
7. **AI Assistant** (update, rename dari "AI Features" biar konsisten sama label nav)
8. **Settings & Notifications** (baru)

Icon baru yang perlu di-import dari `lucide-react` (sudah dipakai di `Layout.tsx`, tinggal reuse): `ClipboardCheck` (Reclassification), `Database` (Master Data), `BarChart2` (Reports), `Settings` (Settings — perlu alias karena `Settings` juga nama komponen halaman, pakai `Settings as SettingsIcon`), `Bell` (Notifications, kalau mau icon terpisah — atau gabung ke section Settings pakai 1 icon saja).

---

## Draft Konten per Section Baru

### 4. Reclassification
- Apa itu Reclassification? → mencatat temuan audit fisik aset (kategori, lokasi, unit, kepemilikan, remarks) yang beda dari sistem
- Bagaimana verifikasi item? → klik badge Verified/Unverified per baris, buka VerifyReclassificationModal, tercatat tanggal + nama verifier
- Bisa import/export CSV? → ya, sama seperti Inventory (template, max 5000 baris, progress modal, invalid-row report)
- Bulk delete? → pilih banyak baris, ketik "DELETE" untuk konfirmasi
- Filter apa saja yang tersedia? → kategori, status verifikasi, kepemilikan, search

### 5. Master Data
- Apa fungsi Master Data? → kelola daftar dropdown yang dipakai di form lain: Subsidiaries, Category Segment 1, Category Segment 2
- Cara tambah/hapus entri? → form tambah di atas tiap daftar, ikon hapus (trash) muncul saat hover

### 6. Reports
- Jenis laporan apa saja? → Asset Valuation Summary, Depreciation Schedule (straight-line, quarter-aware), Maintenance Cost Analysis (estimasi vs aktual)
- Bagaimana generate laporan? → set filter subsidiary/divisi + rentang tanggal → "Generate Preview" → otomatis tersimpan ke riwayat
- Format export apa saja? → PDF (termasuk chart sebagai gambar, tabel detail per-aset, baris over-budget di-highlight merah, blok tanda tangan Prepared/Reviewed/Approved) dan Excel (.xlsx)
- Apakah export aman dari formula injection? → ya, sel yang diawali `=`, `+`, `-`, `@` disanitasi otomatis
- Bisa lihat/hapus laporan lama? → ya, tabel Recent Reports dengan pagination dan delete per baris

### 7. AI Assistant (update dari AI Features)
- Apa yang bisa ditanyakan ke AI Assistant? → pertanyaan seputar data aset & maintenance, dijawab lewat chat, ada quick-suggestion chips
- Apakah riwayat chat tersimpan? → ya di localStorage browser, bisa dihapus lewat "Hapus Chat"
- Apakah AI menyimpan konteks lama? → menyimpan sampai 21 pesan, memakai 10 pertukaran terakhir sebagai konteks

### 8. Settings & Notifications
- Apa saja yang bisa diubah di Settings? → tab Profile (nama/email — aktif), Security (ganti password — aktif; 2FA masih "Coming soon"), System Configuration & Notifications (UI tersedia, belum tersimpan permanen — jelaskan sebagai "coming soon" biar user tidak bingung)
- Apa itu ikon lonceng (bell) di header? → menampilkan System Alerts + Activity Log terbaru (import CSV, tambah/ubah/hapus aset, maintenance), badge jumlah belum dibaca

---

## Update Konten Section Existing

### Getting Started
- Perbarui jawaban "How do I navigate the dashboard?" → sebutkan semua menu sidebar sekarang (Dashboard, Asset Inventory, Maintenance, Reclassification, Master Data, Reports, AI Assistant, Settings), bukan cuma "Inventory, Maintenance, Reports"
- Tambahkan 1 FAQ baru: "Apa arti timestamp 'Terakhir diperbarui' di Dashboard?" → menunjukkan kapan data terakhir di-fetch/diubah (create/update/delete asset)

### Asset Management
- Update jawaban export CSV → sebut sanitasi formula-injection (`Fix CSV/Excel formula injection in Reports export`, commit 912bae2)

---

## Langkah Implementasi

1. Buka `src/pages/Guide.tsx`
2. Tambah import icon baru dari `lucide-react`: `ClipboardCheck`, `Database`, `BarChart2`, `Bell` (sesuaikan dengan icon final yang dipilih, cek konflik nama `Settings`)
3. Update array `GUIDE_CONTENT`:
   - Edit isi `getting-started` dan `asset-management` sesuai draft di atas
   - Rename id/title `ai-assistant` section dari "AI Features" → "AI Assistant" (title saja, id boleh tetap `ai-assistant` supaya tidak break kalau ada deep-link)
   - Sisipkan 4 object section baru: `reclassification`, `master-data`, `reports`, `settings` — taruh sebelum section AI Assistant supaya urutan match `NAV_ITEMS`
4. Tidak perlu ubah JSX render logic — komponen sudah generic terhadap `GUIDE_CONTENT.map(...)`, cukup tambah data
5. Jalankan `npm run build` untuk pastikan tidak ada type error / unused import
6. Test manual di browser: buka `/guide`, cek semua tab baru muncul di Table of Contents & horizontal tabs, accordion buka/tutup normal, tidak ada overflow teks aneh di section baru (terutama Reports yang paragrafnya lebih panjang)
7. `graphify update .` setelah selesai edit (sesuai project rule di CLAUDE.md)

## Estimasi Effort
Kecil — murni penambahan data ke satu file (`Guide.tsx`), tidak ada perubahan schema/API. Perkiraan ~150-200 baris tambahan di `GUIDE_CONTENT`.

## Next Step
Setelah rencana ini disetujui, eksekusi langsung ke `src/pages/Guide.tsx` sesuai draft konten di atas.
