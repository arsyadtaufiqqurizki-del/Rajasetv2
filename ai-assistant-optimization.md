# AI Assistant — Rencana Optimasi

Status saat ini (per 2026-08-11): backend `server/index.js` (Cloud Run, Node http) + MiMo API, dengan agregat server-side dan format CSV sudah live (commit `213312b`). Response time: ~2.8s (ringkasan) – ~6.9s (agregasi). Dokumen ini adalah rencana lanjutan untuk optimasi tahap berikutnya.

## Masalah yang tersisa

1. **Setiap request fetch ulang seluruh tabel `assets` + `maintenance_records` dari Supabase**, lalu hitung agregat dari nol — meski data jarang berubah antar-request.
2. **CSV mentah seluruh dataset tetap dikirim** ke MiMo di setiap request (untuk pertanyaan "di luar agregat"), walau sebagian besar pertanyaan user sebenarnya terjawab oleh agregat saja.
3. **Tidak ada streaming** — user menunggu penuh sampai jawaban lengkap sebelum apa pun tampil (loading indicator hanya rotasi teks statis).
4. **`history` dikirim penuh (hingga 20 pesan) ke MiMo setiap kali** — menambah token cost & latency secara linear seiring percakapan makin panjang.
5. **Tidak ada request cancellation** — kalau user kirim pertanyaan baru sebelum yang lama selesai, tidak ada abort untuk request in-flight sebelumnya (saat ini `isTyping` disabled input, jadi risikonya kecil, tapi tetap tak ada `AbortController` untuk unmount/navigasi).
6. **`/chat` endpoint tidak reject saat `MIMO_API_KEY`/`MIMO_MODEL` kosong** dengan pesan jelas — gagal baru ketahuan setelah fetch ke MiMo gagal.

## Rencana Implementasi

### 1. Cache data Supabase di server (in-memory, TTL pendek) — ✅ SELESAI (2026-08-11)
**Dampak terbesar, effort kecil.**

> Implementasi: `getAssetData()` di `server/index.js` — cache module-scope dengan TTL 90 detik, menyimpan `{ assets, maintenance, agg }` sekaligus (agregat dihitung sekali per cache-refresh, bukan per-request).
- Simpan hasil `fetchFromSupabase('assets')` dan `fetchFromSupabase('maintenance_records')` di memory dengan TTL ~60–120 detik.
- Assets/maintenance tidak berubah tiap detik — cache TTL pendek aman dan langsung menghilangkan 2 network round-trip (biasanya kontributor terbesar ke latency) untuk request yang datang berdekatan.
- Precompute `computeAssetAggregates()` sekali per cache-refresh, bukan per-request.
- Implementasi: `let cache = { data: null, expiresAt: 0 }` sederhana di module scope — tidak perlu Redis/KV karena single Cloud Run instance dan TTL pendek.

### 2. Kirim CSV mentah hanya jika diperlukan (lazy / conditional context)
- Banyak pertanyaan user (lihat `quickSuggestions` di UI) terjawab penuh oleh bagian AGREGAT saja.
- Opsi A (simple): kirim ringkasan + agregat selalu, tapi potong CSV mentah ke subset relevan (mis. hanya kolom & baris yang match keyword sederhana dari pertanyaan) alih-alih seluruh tabel.
- Opsi B (lebih baik, lebih kompleks): 2-pass — panggil MiMo dulu tanpa CSV mentah (hanya ringkasan+agregat), minta model menyatakan apakah butuh data mentah tambahan; jika iya baru fetch & kirim ulang dengan CSV. Menambah 1 round-trip di kasus butuh data mentah, tapi menghemat token besar di kasus umum.
- Rekomendasi: mulai dengan Opsi A dulu (low risk), ukur berapa % pertanyaan sebenarnya butuh CSV mentah sebelum invest ke Opsi B.

### 3. Streaming response (SSE atau chunked) — ✅ SELESAI (2026-08-11)
- MiMo API (endpoint Anthropic-compatible) mendukung `stream: true`.
- Ubah `/chat` untuk stream token ke frontend via chunked HTTP response, dan frontend render progresif alih-alih menunggu jawaban penuh.
- Manfaat: **perceived latency turun drastis** meski total waktu sama — user mulai baca jawaban dalam ~1-2s alih-alih menunggu penuh 3-7s.
- Effort sedang: perlu ubah `http.createServer` handler untuk `res.write()` per chunk, dan frontend AIAssistant.tsx ganti `fetch` + `await response.text()` jadi `ReadableStream` reader + incremental state update ke `messages`.

> Implementasi: `server/index.js` memanggil MiMo dengan `stream: true`, parse SSE (`content_block_delta` / `text_delta`) dari `mimoRes.body.getReader()`, dan forward teks mentah via `res.write()` (bukan JSON) — respons `/chat` sukses sekarang `text/plain` chunked, bukan JSON. `AIAssistant.tsx` membaca `response.body.getReader()`, menampilkan bubble AI begitu chunk pertama datang, lalu update `content` progresif per chunk. Error mid-stream: bubble parsial dihapus dan pesan error ditampilkan (tidak coba pertahankan teks parsial, demi UX konsisten dengan behavior lama).

### 4. Pangkas history yang dikirim ke model — ✅ SELESAI (2026-08-11)
- Saat ini `MAX_HISTORY = 20` (10 pasang) selalu dikirim penuh.
- Opsi: kirim hanya N pasang terakhir yang relevan (mis. 4-6 pasang) via `history.slice(-8)` di frontend sebelum fetch, atau lakukan truncation di backend. Riwayat lama biasanya tidak relevan untuk pertanyaan lanjutan tentang data aset.
- Trade-off kecil: mengurangi kemampuan model mengingat konteks sangat lampau, tapi untuk use-case tanya-jawab data ini jarang dibutuhkan.

> Implementasi: `AIAssistant.tsx` tetap simpan & tampilkan sampai `MAX_HISTORY` (20 pesan / 10 pasang) di state & localStorage untuk kontinuitas UI, tapi hanya kirim `history.slice(-HISTORY_SEND_LIMIT)` (8 pesan / 4 pasang terakhir) ke backend saat request.

### 5. AbortController untuk request in-flight — ✅ SELESAI (2026-08-11)
- Tambahkan `AbortController` di `handleSend`, simpan di ref, `abort()` saat component unmount atau saat user kirim pesan baru (jaga-jaga kalau `isTyping` guard suatu saat dilonggarkan).
- Effort kecil, robustness improvement, bukan speed win langsung.

> Implementasi: `abortControllerRef` di `AIAssistant.tsx`, dibuat baru tiap `handleSend`, di-abort saat unmount (`useEffect` cleanup) dan saat request baru dimulai. `AbortError` di-catch secara diam (tidak menampilkan pesan error ke user).

### 6. Validasi env var di startup, bukan di-request — ✅ SELESAI (2026-08-11)
- Cek `MIMO_API_KEY` dan `MIMO_MODEL` saat `server.listen()`, log error & exit jika kosong — supaya gagal cepat & jelas di deploy time, bukan silent 502 saat user pertama kali chat.

> Implementasi: `server/index.js` cek `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `MIMO_API_KEY`, `MIMO_MODEL` sebelum `server.listen()`; log nama var yang hilang lalu `process.exit(1)` jika ada yang kosong. Sudah diverifikasi: dijalankan tanpa env var → keluar dengan pesan jelas, exit code 1.

## Prioritas & urutan pengerjaan

| # | Item | Dampak latency | Effort | Prioritas | Status |
|---|------|----------------|--------|-----------|--------|
| 1 | Cache Supabase fetch + agregat (TTL) | Tinggi | Kecil | **P0** | ✅ Selesai |
| 3 | Streaming response | Tinggi (perceived) | Sedang | **P0** | ✅ Selesai |
| 2 | CSV lazy/conditional | Sedang-Tinggi (token cost) | Sedang-Besar | P1 | ⏳ Belum — menunggu pengukuran production |
| 4 | Pangkas history | Kecil-Sedang | Kecil | P1 | ✅ Selesai |
| 5 | AbortController | - (robustness) | Kecil | P2 | ✅ Selesai |
| 6 | Validasi env var startup | - (DX) | Kecil | P2 | ✅ Selesai |

## Status

Item #1, #3, #4, #5, #6 sudah diimplementasikan dan lolos syntax/type-check lokal (2026-08-11). **Belum dites di browser/production dan belum di-deploy** — server perlu di-restart untuk cache & streaming aktif, dan frontend perlu di-build ulang untuk perubahan `AIAssistant.tsx`.

Item #2 (CSV lazy/conditional) sengaja ditunda — sesuai rencana awal, ukur dulu response time & token cost di production setelah #1+#3 live sebelum invest ke perubahan yang lebih kompleks ini.

## Bug ditemukan saat testing lokal (2026-08-11) — ✅ DIPERBAIKI

**Gejala:** Setelah user tes di localhost, pertanyaan "top 5 asset tahun 2023 berdasarkan asset cost apa?" menghasilkan jawaban AI berupa `{}` literal.

**Root cause (2 masalah bertumpuk):**
1. Server lokal yang jalan di port 8080 masih proses lama (belum di-restart setelah edit streaming) — kode lama punya bug `data.content[0].text` bisa `undefined` kalau `content[0]` bukan block bertipe `text`, dan `JSON.stringify({ answer: undefined })` = `"{}"`.
2. **Setelah restart dengan kode streaming baru, masalah sebenarnya baru kelihatan:** model `mimo-v2.5` pakai *extended thinking* — selalu mengirim `content_block` bertipe `"thinking"` (index 0) sebelum block `"text"` (index 1). Untuk pertanyaan "top N per tahun", tidak ada agregat yang cocok, jadi model terpaksa scan manual seluruh CSV mentah (1000 baris, ~102K karakter, ~52K input token) di dalam thinking-nya — dan kehabisan `max_tokens: 1024` sebelum sempat mulai menulis jawaban (`stop_reason: "max_tokens"`, `output_tokens: 1024`, tanpa text block sama sekali).

**Fix yang diterapkan di `server/index.js`:**
- Tambah agregat baru `top5ByYear` (top 5 aset termahal per tahun) di `computeAssetAggregates()` dan masukkan ke system prompt — menghilangkan kebutuhan model scan CSV mentah untuk pola pertanyaan ini.
- **Terverifikasi:** dengan agregat ini, input token turun dari **~47.000-52.000 → ~4.900** (turun ~90%), `stop_reason` normal (`end_turn`), dan jawaban benar & lengkap.
- Naikkan `max_tokens` dari 1024 → 2048 sebagai safety margin tambahan untuk pertanyaan lain yang belum tercakup agregat.
- Tambah fallback: kalau stream berakhir tanpa satu pun `text_delta` (kasus edge yang belum tercakup agregat manapun), kirim pesan "Maaf, pertanyaan ini terlalu kompleks..." alih-alih body kosong/`{}`.

**Catatan penting:** temuan ini memperkuat urgensi item **#2 (CSV lazy/conditional)** di atas — bukan cuma soal kecepatan/biaya, tapi CSV mentah yang besar bisa membuat model *gagal total* menjawab kalau pertanyaannya butuh agregasi yang belum di-precompute. Rekomendasi: pola serupa (precompute agregat untuk pertanyaan umum) sebaiknya terus ditambah seiring ditemukan pola pertanyaan baru yang butuh scan CSV mentah, daripada mengandalkan model untuk reasoning atas data mentah berukuran besar.

### Langkah selanjutnya sebelum deploy
1. Jalankan server lokal dengan env var lengkap (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `MIMO_API_KEY`, `MIMO_MODEL`) dan uji `/chat` end-to-end — pastikan streaming benar-benar mengalir dan cache tidak menyajikan data basi lebih dari TTL.
2. Uji UI di browser: kirim pertanyaan, pastikan bubble AI muncul progresif, cek `Hapus Chat` & trimming pesan lama masih benar.
3. Deploy backend ke Cloud Run, deploy frontend ke Cloudflare Workers, verifikasi production seperti biasa.
4. Setelah live, ukur response time baru vs baseline (2.8–6.9s) dan putuskan apakah #2 masih perlu.
