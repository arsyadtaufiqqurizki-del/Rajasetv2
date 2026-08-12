# Deploy Automation — Rencana CI/CD

Status (per 2026-08-12): **otomatis via GitHub Actions**, live di `main`.
- Backend (`server/**`) → `.github/workflows/deploy-backend.yml`, auth via Workload Identity Federation (pool `github-actions-pool`, provider `github-actions-provider`, service account `github-actions-deployer@raja-dashboard-ai.iam.gserviceaccount.com`, dibatasi ke repo `arsyadtaufiqqurizki-del/Rajasetv2`), lalu `gcloud run deploy raja-ai-server --source server/ --region asia-southeast1 --allow-unauthenticated`
- Frontend (path lain, exclude `server/**`, `*.md`, `graphify-out/**`) → `.github/workflows/deploy-frontend.yml`, `npm ci && npm run build` lalu `wrangler deploy` via `CLOUDFLARE_API_TOKEN` (scope Workers Scripts: Edit)
- Deploy manual (fallback/darurat) tetap bisa dipakai kalau perlu:
  - Backend: `gcloud run deploy raja-ai-server --source server/ --region asia-southeast1 --allow-unauthenticated`
  - Frontend: `npm run deploy` (`vite build && wrangler deploy`)

## Masalah yang mendorong rencana ini

Pada 2026-08-12, perubahan streaming di `server/index.js` sudah di-commit & push ke GitHub, tapi Cloud Run **tidak ikut ter-redeploy** (deploy manual terakhir sebelum perubahan itu). Akibatnya user sempat melihat bug production: jawaban AI Assistant balik dalam format JSON lama (`{"answer":...}`) alih-alih teks streaming, padahal kode di repo sudah benar. Root cause: tidak ada mekanisme yang menjamin production selalu sinkron dengan `main` branch.

## Rencana Implementasi

Dua GitHub Actions workflow terpisah, supaya backend dan frontend bisa deploy independen (tidak perlu redeploy frontend kalau cuma backend yang berubah, dan sebaliknya).

### 1. Workflow backend → Cloud Run
- Trigger: `push` ke `main` dengan path filter `server/**`.
- Steps: `google-github-actions/auth` (pakai Workload Identity Federation, bukan service account key JSON) → `google-github-actions/deploy-cloudrun` atau langsung `gcloud run deploy --source server/ --region asia-southeast1`.
- Secret yang dibutuhkan: konfigurasi WIF (`GCP_WORKLOAD_IDENTITY_PROVIDER`, `GCP_SERVICE_ACCOUNT`) di GitHub Secrets/Variables project ini.
- Env vars runtime (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `MIMO_API_KEY`, `MIMO_MODEL`) sudah terpasang di service Cloud Run itu sendiri — tidak perlu di-set ulang tiap deploy selama tidak pakai `--set-env-vars`.

### 2. Workflow frontend → Cloudflare Workers
- Trigger: `push` ke `main`, path filter di luar `server/**` (atau exclude `server/**`, `*.md`, `graphify-out/**`).
- Steps: `npm ci` → `npm run build` (vite build) → `cloudflare/wrangler-action` untuk `wrangler deploy`.
- Secret yang dibutuhkan: `CLOUDFLARE_API_TOKEN` (scope: Workers Edit untuk account/zone terkait) sebagai GitHub Secret.

## Trade-off

- **Kredensial di GitHub Secrets**: perlu setup sekali (WIF untuk GCP lebih aman daripada service account key statis; Cloudflare API token dibatasi scope-nya). Risiko kebocoran kalau repo/CI diakses pihak tak berwenang — mitigasi: least-privilege scope pada token/service account.
- **Tidak ada gate manual**: setiap push ke `main` langsung live di production tanpa jeda review/approval. Kalau nanti butuh staging, bisa tambah `environment` + required reviewers di GitHub Actions, atau branch `staging` terpisah dengan Cloud Run revision/Workers preview URL sendiri.
- **Build time**: setiap push men-trigger build (Docker build untuk Cloud Run source deploy, vite build untuk Workers) — untuk repo skala saat ini masih murah & cepat (build lokal barusan: backend build ~2 menit, frontend build ~25 detik).

## Prioritas

Bukan blocking untuk fitur, tapi **quick win** — effort kecil (2 file workflow, sekali setup secret), langsung menghilangkan kelas bug "lupa redeploy" yang sudah kejadian sekali (lihat [[ai-assistant-optimization.md]] untuk histori perubahan yang memicu insiden ini).

## Langkah implementasi (selesai, 2026-08-12)

1. ✅ Workload Identity Federation dibuat di GCP project `raja-dashboard-ai` (pool + provider + service account + IAM bindings, dibatasi ke repo ini saja).
2. ✅ Cloudflare API Token dibuat manual via dashboard (scope Workers Scripts: Edit), disimpan sebagai GitHub Secret.
3. ✅ `.github/workflows/deploy-backend.yml` dan `.github/workflows/deploy-frontend.yml` ditulis sesuai rencana di atas.
4. ✅ Tervalidasi via push nyata: backend sukses di percobaan pertama (revisi `raja-ai-server-00016-mvg`); frontend awalnya gagal karena `deploy-frontend.yml` pakai Node 20 sementara project butuh Wrangler ^4.112.0 (minimal Node 22) — wrangler-action fallback ke versi 3.90.0 yang gak support config `assets`-only, error "Missing entry-point". Fix: node-version dinaikkan ke 22, deploy sukses. Path filter juga terkonfirmasi: push yang cuma ubah `deploy-frontend.yml` hanya men-trigger workflow frontend.
5. ✅ Rollback manual didokumentasikan di bawah.

## Rollback darurat

Kalau auto-deploy membawa bug ke production:

**Backend (Cloud Run)** — arahkan traffic balik ke revisi sebelumnya:
```
gcloud run revisions list --service raja-ai-server --region asia-southeast1 --project raja-dashboard-ai
gcloud run services update-traffic raja-ai-server --region asia-southeast1 --project raja-dashboard-ai --to-revisions=REVISION_NAME=100
```

**Frontend (Cloudflare Workers)** — rollback ke deployment sebelumnya:
```
wrangler deployments list
wrangler rollback [deployment-id]
```

Setelah rollback darurat, tetap perbaiki root cause di `main` supaya auto-deploy berikutnya tidak membawa bug yang sama lagi (jangan biarkan production menyimpang dari `main` dalam jangka panjang — itu justru masalah yang mau dihindari CI/CD ini).
