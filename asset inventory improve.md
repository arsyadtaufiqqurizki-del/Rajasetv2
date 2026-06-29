# Rencana Peningkatan (Improvement Plan) - Asset Inventory

Berdasarkan struktur dan kebutuhan umum pada sistem manajemen aset, berikut adalah daftar hal-hal yang dapat di-improve lebih lanjut pada modul Asset Inventory. Rencana ini dibagi menjadi beberapa aspek utama:

## 1. Performa dan Skalabilitas (Performance) [SELESAI]
- [x] **Pagination & Virtualization:** Jika data aset mencapai ribuan, me-render seluruh baris tabel secara bersamaan akan membuat aplikasi terasa berat. Implementasikan *pagination* (halaman) atau *table virtualization* (seperti `react-window` atau `@tanstack/react-virtual`) agar DOM tidak kelebihan muatan.
- [x] **Debounce pada Pencarian:** Tambahkan mekanisme *debounce* pada fitur *search*. Ini mencegah aplikasi melakukan *re-render* atau *re-filtering* setiap kali user mengetik 1 huruf, melainkan menunggu sekian milidetik setelah user berhenti mengetik.
- [x] **Memoization:** Gunakan `useMemo` untuk hasil data yang difilter dan `useCallback` untuk fungsi *handlers* (seperti edit/delete) untuk mencegah *re-render* komponen anak yang tidak perlu.

## 2. Pengalaman Pengguna (User Experience / UX)
- **Advanced Filtering & Multi-Sorting:** Kembangkan filter agar pengguna bisa menyaring data berdasarkan beberapa kriteria sekaligus (misalnya: filter Kategori "Elektronik" dengan Status "Aktif" secara bersamaan), serta kemampuan *sorting* di setiap header kolom tabel.
- **Bulk Actions (Aksi Massal):** Tambahkan fitur checkbox di tiap baris agar pengguna dapat melakukan aksi massal seperti *Bulk Delete*, *Bulk Update Status*, atau *Bulk Export*.
- **Export & Import Data:** Sediakan opsi untuk mengekspor data aset ke format CSV/Excel untuk kebutuhan pelaporan, serta opsi Import via CSV untuk memudahkan *mass-upload* aset baru.
- **Visualisasi/Foto Aset:** Tambahkan dukungan upload gambar agar setiap entri aset memiliki foto aslinya atau lampiran dokumen (seperti *invoice* atau *manual book*).

## 3. Manajemen State & Pengolahan Form
- **Form Validation yang Lebih Baik:** Pada komponen `AddAssetModal` dan `EditAssetModal`, pertimbangkan penggunaan kombinasi `react-hook-form` dan `zod`/`yup` untuk memberikan validasi *field* yang lebih kuat, error yang lebih rapi, dan menekan *re-renders* dibandingkan state bawaan React.
- **State Management Skala Besar:** Saat ini Anda menggunakan `AssetContext`. Jika sistem semakin kompleks dan melibatkan pengambilan data dari API (Backend), mempertimbangkan alat *server-state management* seperti React Query (TanStack Query) akan jauh lebih efisien untuk menangani *caching*, *loading state*, dan sinkronisasi.

## 4. Keamanan dan Integritas Data
- **Audit Trail (Riwayat Perubahan):** Untuk aplikasi inventaris berskala perusahaan, setiap aksi Edit dan Delete harus tercatat historinya. Tambahkan log riwayat yang merekam siapa yang mengubah data, kapan diubah, dan perubahan apa yang dilakukan.
- **Role-Based Access Control (RBAC):** Pastikan aksi-aksi destruktif (seperti hapus data atau edit nilai penyusutan) disembunyikan atau dinonaktifkan jika pengguna yang sedang *login* bukan administrator.

## 5. Kualitas Kode (Code Maintainability)
- **Pemecahan Komponen (Refactoring):** Jika `Inventory.tsx` mulai terasa terlalu besar (ratusan baris kode), pecah menjadi komponen-komponen kecil seperti `AssetTable`, `AssetFilters`, dan `AssetTablePagination`.
- **Unit Testing:** Tambahkan *test cases* (dengan Jest atau React Testing Library) khusus untuk logika-logika kritis seperti perhitungan nilai aset, fungsi filter pencarian, dan validasi tambah data.
