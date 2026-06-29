# Asset Inventory System

Aplikasi web berbasis React untuk manajemen aset perusahaan dan pelacakan inventaris serta pemeliharaan aset. Aplikasi ini dibangun menggunakan ekosistem modern dengan fokus pada performa dan antarmuka pengguna yang interaktif.

## Tech Stack & Dependensi Utama

- **Framework & Build Tool**: React 19, Vite, dan TypeScript.
- **Routing**: React Router DOM v7.
- **Styling**: Tailwind CSS v4, `clsx`, dan `tailwind-merge`.
- **Ikon & Animasi**: `lucide-react` untuk ikon dan `motion` untuk animasi transisi halus.
- **Visualisasi Data**: `recharts` untuk komponen grafik interaktif pada Dashboard.
- **Utility**: `date-fns` untuk pemrosesan tanggal, dan `@google/genai` untuk kapabilitas Artificial Intelligence (jika diaktifkan).

## Struktur "Database" (State Management)

Aplikasi berjalan sepenuhnya di sisi klien (Client-Side). Manajemen *state* atau "database" in-memory dikelola secara terpusat menggunakan **React Context** melalui dua konteks utama:

### 1. AssetContext (`AssetContext.tsx`)
Mengelola data utama aset dan master data referensi pendukung.

**Skema Tabel Aset (`Asset`)**:
- `id` (string): *Primary Key* unik.
- `assetBook` (string): Jenis buku aset / pembukuan.
- `subsidiary` (string): Entitas anak perusahaan / cabang kepemilikan.
- `assetNumber` (string): Nomor seri identifikasi unik.
- `assetDescription` (string): Deskripsi aset.
- `assetCost` (string): Nilai / harga beli awal aset.
- `datePlaceInService` (string): Tanggal mulai digunakan.
- `assetUnits` (string): Jumlah item / unit.
- `categorySegment1` (string): Kategori Utama (Contoh: *Vehicles*, *Buildings*).
- `categorySegment2` (string): Kategori Turunan / Tambahan.
- `depreciationMethod` (string): Metode penyusutan.
- `lifeInMonths` (string): Umur ekonomis dalam bulan.
- `listed` (string): Status listing.
- `status` (string): Status kondisional (*Active*, *In Maintenance*, *Broken*).
- `statusLevel` (`'success' | 'warning' | 'error' | 'default'`): Kolom komputasi untuk penentuan warna badge (badge UI).

**Tabel Referensi (Master Data)**:
Disimpan sebagai array string dan mendukung fitur *auto-upsert* saat input aset baru.
- `subsidiaries` (string[]): Daftar cabang/perusahaan.
- `categories1` (string[]): Master data Kategori 1.
- `categories2` (string[]): Master data Kategori 2.

### 2. MaintenanceContext (`MaintenanceContext.tsx`)
Mengelola seluruh jadwal dan log perbaikan (maintenance) aset. Memiliki skema mandiri dan mendukung operasi CRUD terpisah khusus untuk entitas *Maintenance*.

## Fitur & Peningkatan Sistem

- **Modul Pemeliharaan (Maintenance)**: Fitur pelacakan Maintenance yang komprehensif, didukung konteks terpisah beserta modal khusus penambahan dan pengeditan tiket perbaikan (`AddMaintenanceModal.tsx`, `EditMaintenanceModal.tsx`).
- **Dashboard & Analitik Visual**: Menyajikan metrik aset menggunakan pustaka diagram interaktif (`recharts`).
- **Input Autocomplete**: Komponen input pintar (`AutocompleteInput.tsx`) yang terhubung dengan tabel referensi (Master Data) agar input lebih cepat dan konsisten tanpa perlu ketik ulang dari awal.
- **Pagination & Debounce Search**: Pengalaman interaksi tabel (*Inventory*) dikelola secara optimal menggunakan mekanisme halaman dan pemfilteran anti-lag (debounce search).
- **Animasi Komponen**: Penggunaan *motion* untuk feedback visual modern pada transisi modal dan interaksi tombol.

## Arsitektur Halaman (Views)

Aplikasi memecah fitur menjadi rute halaman terpisah:
- **Dashboard (`/`)**: Antarmuka ringkasan statistik dan analitik interaktif aset.
- **Inventory (`/inventory`)**: Antarmuka tabular utama daftar aset lengkap dengan operasi pencarian dan CRUD.
- **Maintenance (`/maintenance`)**: Pemantauan spesifik dan pencatatan riwayat aset yang rusak atau dalam perawatan berkala.
- **Master Data (`/master-data`)**: Manajemen terpusat untuk daftar entitas referensi pendukung (Kategori, Subsidiary, dll).
- **Reports (`/reports`)**: Antarmuka khusus untuk rekapitulasi pelaporan periodik.
- **Settings (`/settings`)**: Konfigurasi umum aplikasi.
