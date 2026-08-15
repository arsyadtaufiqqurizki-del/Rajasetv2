# Rencana Peningkatan (Improvement Plan) - Asset Inventory

Berdasarkan struktur dan kebutuhan umum pada sistem manajemen aset, berikut adalah daftar hal-hal yang dapat di-improve lebih lanjut pada modul Asset Inventory. Rencana ini dibagi menjadi beberapa aspek utama:

## 1. Performa dan Skalabilitas (Performance) [SELESAI]
- [x] **Pagination & Virtualization:** Jika data aset mencapai ribuan, me-render seluruh baris tabel secara bersamaan akan membuat aplikasi terasa berat. Implementasikan *pagination* (halaman) atau *table virtualization* (seperti `react-window` atau `@tanstack/react-virtual`) agar DOM tidak kelebihan muatan.
- [x] **Debounce pada Pencarian:** Tambahkan mekanisme *debounce* pada fitur *search*. Ini mencegah aplikasi melakukan *re-render* atau *re-filtering* setiap kali user mengetik 1 huruf, melainkan menunggu sekian milidetik setelah user berhenti mengetik.
- [x] **Memoization:** Gunakan `useMemo` untuk hasil data yang difilter dan `useCallback` untuk fungsi *handlers* (seperti edit/delete) untuk mencegah *re-render* komponen anak yang tidak perlu.

## 2. Pengalaman Pengguna (User Experience / UX)
- [x] **Advanced Filtering:** Filter multi-kriteria sekaligus (Subsidiary, Asset Class, Location, Status, Verification, Item Status — multi-select, bisa gabung beberapa nilai per kategori), plus filter Date Place in Service (range) dan Asset Cost (range). Dilengkapi active filter chips (removable per nilai), badge jumlah filter aktif, dan persistence ke URL query params. Lihat `inventory filter system.md`. *(Multi-Sorting di header kolom tabel belum dikerjakan.)*
- [x] **Bulk Actions (Aksi Massal) — sebagian:** Checkbox per baris + select-all sudah ada, dengan *Bulk Delete* (dan *Delete All*) yang jalan berbatch beserta progress modal. *Bulk Update Status* dan *Bulk Export* (export khusus baris terpilih) belum ada — export CSV saat ini selalu mengekspor seluruh hasil filter, bukan hanya yang dicentang.
- [x] **Export & Import Data:** CSV export (mengikuti hasil filter aktif) dan CSV import (dengan validasi baris wajib, batas 5000 baris, progress modal, dan laporan baris gagal/invalid) sudah berjalan penuh.
- [x] **Physical Verification Tracking:** Tiga kolom baru setelah Status — **Verification** (Yes/No), **Verification Date** (auto-terisi tanggal hari ini saat Verification diubah ke Yes, tetap bisa diedit manual, dikosongkan/disabled saat No), dan **Item Status** (autocomplete: Asset/Inventory/Needs Review + custom text, tersimpan ke tabel lookup `item_statuses` seperti Asset Class/Location). Sudah terintegrasi ke filter, CSV export, dan CSV import.
- **Visualisasi/Foto Aset:** Tambahkan dukungan upload gambar agar setiap entri aset memiliki foto aslinya atau lampiran dokumen (seperti *invoice* atau *manual book*).

## 3. Manajemen State & Pengolahan Form
- **Form Validation yang Lebih Baik:** Pada komponen `AddAssetModal` dan `EditAssetModal`, pertimbangkan penggunaan kombinasi `react-hook-form` dan `zod`/`yup` untuk memberikan validasi *field* yang lebih kuat, error yang lebih rapi, dan menekan *re-renders* dibandingkan state bawaan React.
- **State Management Skala Besar:** Saat ini Anda menggunakan `AssetContext`. Jika sistem semakin kompleks dan melibatkan pengambilan data dari API (Backend), mempertimbangkan alat *server-state management* seperti React Query (TanStack Query) akan jauh lebih efisien untuk menangani *caching*, *loading state*, dan sinkronisasi.

## 4. Keamanan dan Integritas Data
- [x] **Audit Trail (Riwayat Perubahan) — sebagian:** `logActivity` (`src/lib/activityLogger.ts`) sudah merekam ADD/UPDATE/DELETE/BULK_DELETE asset (siapa via `created_by`, kapan, dan detail perubahan) ke tabel `activity_logs`, disurfacekan lewat `NotificationBell`. Belum ada halaman *audit log* khusus yang bisa difilter/dicari untuk kebutuhan investigasi historis.
- **Role-Based Access Control (RBAC):** Pastikan aksi-aksi destruktif (seperti hapus data atau edit nilai penyusutan) disembunyikan atau dinonaktifkan jika pengguna yang sedang *login* bukan administrator.

## 5. Kualitas Kode (Code Maintainability)
- **Pemecahan Komponen (Refactoring):** Jika `Inventory.tsx` mulai terasa terlalu besar (ratusan baris kode), pecah menjadi komponen-komponen kecil seperti `AssetTable`, `AssetFilters`, dan `AssetTablePagination`.
- **Unit Testing:** Tambahkan *test cases* (dengan Jest atau React Testing Library) khusus untuk logika-logika kritis seperti perhitungan nilai aset, fungsi filter pencarian, dan validasi tambah data.
