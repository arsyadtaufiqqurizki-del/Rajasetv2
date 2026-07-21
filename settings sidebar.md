# Settings Sidebar — Rencana Implementasi

## Kondisi Saat Ini

`src/pages/Settings.tsx` sudah punya UI lengkap (4 tab: Profile, System Configuration,
Notifications, Security) tapi **100% frontend-only**. Semua state pakai `useState` lokal,
dan `handleSave()` cuma `setTimeout` 800ms lalu tampilkan centang hijau — tidak ada yang
benar-benar tersimpan. Refresh halaman, semua balik ke default.

Yang sudah tersedia untuk dipakai:
- `AuthContext.tsx` (`src/contexts/AuthContext.tsx`) — sudah terhubung ke Supabase Auth,
  tapi baru expose `isAuthenticated`, `login`, `logout`. Belum ada `updateUser`.
- Tidak ada tabel `profiles` atau `settings` di Supabase — hanya `asset_reclassifications`
  dan `activity_logs`.
- Pola `localStorage` untuk preferensi client-side sudah ada presedennya di
  `src/pages/AIAssistant.tsx`.
- Toggle notifikasi (`emailAlerts`, `lowStock`, `maintenance`, `systemUpdates`) saat ini
  **tidak dibaca oleh logic apa pun** di codebase — murni kosmetik.

## Rencana Per Tab

### 1. ✅ Security — ganti password (prioritas tinggi, effort kecil) — SELESAI
- Panggil `supabase.auth.updateUser({ password: newPassword })` di dalam `handleSave`
  saat `activeTab === 'security'`.
- Validasi `newPassword === confirmPassword` sebelum submit.
- Tidak perlu tabel baru — Supabase Auth sudah menangani hashing & storage.
- Two-Factor Authentication: **di luar scope simple** — butuh setup MFA Supabase yang
  lebih kompleks. Untuk versi simple, bisa disembunyikan dulu atau dibiarkan non-fungsional
  dengan label "Coming soon".
- **Implementasi**: `handleSave` di `Settings.tsx` sekarang verifikasi `currentPassword` via
  `signInWithPassword` sebelum `updateUser({ password })`. Validasi match & panjang minimal
  ditambahkan. Toggle 2FA di-disable dengan label "Coming soon" (checkbox sebelumnya cosmetic,
  sekarang jelas belum fungsional).

### 2. ✅ Profile — nama & email (prioritas tinggi, effort kecil) — SELESAI
- Email: `supabase.auth.updateUser({ email: newEmail })` (akan trigger email konfirmasi
  dari Supabase secara default).
- Nama: simpan di `user_metadata` lewat `supabase.auth.updateUser({ data: { name } })`.
- Saat mount, load nilai awal dari `supabase.auth.getUser()` (`user.email`,
  `user.user_metadata.name`) alih-alih hardcode `'Admin User'` / `'admin@perusahaanraja.com'`.
- Tidak perlu tabel `profiles` baru.
- **Implementasi**: form di-load dari `supabase.auth.getUser()` saat mount (bukan hardcode
  lagi). Save men-diff email/nama terhadap user saat ini, panggil `updateUser()` hanya untuk
  field yang berubah. Ganti email memicu pesan khusus "Check your inbox to confirm the new
  email address" karena Supabase butuh konfirmasi (lihat catatan "Secure email change" di
  bawah — belum dicek settingnya, perlu verifikasi manual di Dashboard → Authentication).

### 3. System Configuration — bahasa, timezone, currency, rows per page (effort kecil)
- Ini preferensi tampilan, bukan data bisnis penting → simpan ke `localStorage`, bukan
  Supabase.
- Pola: ikuti `AIAssistant.tsx` (`localStorage.getItem` saat init state,
  `localStorage.setItem` saat save).
- Tidak perlu tabel baru, tidak perlu RLS.

### 4. Notifications — toggle alert (effort kecil, tapi cosmetic-only)
- Simpan ke `localStorage` juga, supaya tombol Save tidak "bohong" (ada persist beneran).
- **Catatan penting:** toggle ini belum menggerakkan logic notifikasi apa pun (tidak ada
  job/cron yang mengecek preferensi ini). Kalau ingin toggle ini benar-benar mengontrol
  pengiriman notifikasi (misal email low-stock), itu pekerjaan terpisah yang butuh backend
  job — di luar scope "simple version" ini.

## Urutan Pengerjaan yang Disarankan

1. ✅ Security (ganti password) — data paling penting, effort kecil. **SELESAI**
2. ✅ Profile (nama & email) — data penting, effort kecil. **SELESAI**
3. ⬜ System Configuration → localStorage.
4. ⬜ Notifications → localStorage (dengan catatan cosmetic-only di atas).

## Catatan Terbuka

- Setting "Secure email change" di Supabase Dashboard (Authentication) belum diverifikasi —
  menentukan apakah ganti email butuh konfirmasi dari email lama & baru, atau cukup email
  baru saja. Tidak bisa dicek lewat MCP tools (bukan data tabel Postgres), harus cek manual
  di Dashboard project `kuvuylohuhuyjpzbkitp`.

## Yang Tidak Perlu Dibuat

- Tabel `profiles` atau `user_settings` baru di Supabase — tidak dibutuhkan untuk versi
  simple, karena Supabase Auth `user_metadata` sudah cukup untuk nama, dan preferensi
  tampilan cukup di `localStorage`.
- Sistem MFA/2FA penuh — di luar scope "simple", butuh perencanaan terpisah.
- Backend job untuk notifikasi email — di luar scope "simple", butuh perencanaan terpisah.
