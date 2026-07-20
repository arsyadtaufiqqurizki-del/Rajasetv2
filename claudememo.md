# claudememo.md — Raja Project Dashboard

## Identitas Project
- **Nama**: Raja Project Dashboard (Asset Inventory System)
- **Client/Owner**: Perusahaan Raja
- **Working Dir**: `C:\Users\widia\OneDrive\Desktop\Rajaset v2`
- **Stack**: React 19 + TypeScript + Vite 6 + Tailwind CSS v4 + React Router v7 + Supabase

## State Management
- Data utama (assets, maintenance_records, subsidiaries, categories, activity_logs, notification_reads) **persisten di Supabase Postgres** — migrasi dari in-memory sudah **selesai**.
- Context (`AssetContext`, `MaintenanceContext`) fetch on-mount dan menulis langsung ke Supabase; data tidak hilang saat refresh.

## Autentikasi Saat Ini
- **Sudah pakai Supabase Auth** (`supabase.auth.signInWithPassword`, email/password) — bukan access code lagi.
- Session dicek via `supabase.auth.getSession()` + `onAuthStateChange` di `AuthContext.tsx`.

## Supabase Integration
- **URL**: `https://kuvuylohuhuyjpzbkitp.supabase.co` (lihat `.env` → `VITE_SUPABASE_URL`)
- **Packages**: `@supabase/supabase-js`, `@supabase/ssr` — terinstall, tapi hanya `@supabase/supabase-js` (browser client) yang dipakai
- **Client aktif**: `src/lib/supabase.ts` — ini yang diimport di semua contexts/hooks/components
- **Client mati (JANGAN DIPAKAI)**: `src/utils/supabase/client.ts` — duplikat lama, tidak pernah diimport, dan salah nama env var (`VITE_SUPABASE_PUBLISHABLE_KEY` bukan `VITE_SUPABASE_ANON_KEY`). Kandidat dihapus.
- **Env vars**: `.env` dengan prefix `VITE_` (bukan `NEXT_PUBLIC_` karena Vite, bukan Next.js): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_AI_SERVER_URL`
- **Migrasi tabel**: sudah dilakukan — `assets`, `maintenance_records`, `subsidiaries`, `category_segments_1`, `category_segments_2`, `activity_logs`, `notification_reads` (lihat `supabase/migrations/`)

## Konteks Penting
- Project ini adalah **React + Vite**, BUKAN Next.js
  - Jangan pakai `next/headers`, `next/server`, `process.env` di kode frontend — gunakan `import.meta.env`
  - Tidak ada server components, middleware Next.js, atau App Router
- `@supabase/ssr` terinstall tapi hanya pakai browser client (`createClient` dari `@supabase/supabase-js`)
- Ada server Node terpisah di `server/` (`server/index.js`) untuk AI Assistant — punya env var sendiri tanpa prefix `VITE_` (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `MIMO_API_KEY`, `MIMO_BASE_URL`, `MIMO_MODEL`). Tidak jalan otomatis lewat `npm run dev` di root.

## Struktur Konteks React
| Context | File | Isi |
|---|---|---|
| AuthContext | `src/contexts/AuthContext.tsx` | isAuthenticated, loading, login (Supabase), logout |
| AssetContext | `src/contexts/AssetContext.tsx` | assets[] (Supabase), subsidiaries[], categories, CRUD |
| MaintenanceContext | `src/contexts/MaintenanceContext.tsx` | records[] (Supabase), CRUD |

## Fitur Lain yang Sudah Jalan
- **Activity Log & Notification Bell**: real-time via Supabase Realtime, lihat `notification-upgrade.md` (semua fase sudah `[x]`). Helper: `src/lib/activityLogger.ts`, hooks: `useActivityLog.ts` + `useSystemAlerts.ts`, UI: `NotificationBell.tsx`.
- **AI Assistant**: bukan simulasi, chat betulan ke LLM lewat `server/index.js` yang fetch data Supabase + forward ke endpoint Anthropic-compatible.

## Halaman
| Route | File |
|---|---|
| `/` | Dashboard.tsx |
| `/inventory` | Inventory.tsx |
| `/maintenance` | Maintenance.tsx |
| `/master-data` | MasterData.tsx |
| `/reports` | Reports.tsx |
| `/ai-assistant` | AIAssistant.tsx |
| `/guide` | Guide.tsx |
| `/settings` | Settings.tsx (UI-only, belum persist ke Supabase) |

## Commands
```bash
npm run dev      # dev server port 3000
npm run build    # production build
npm run lint     # tsc --noEmit
```

## Skills Terinstall
- `supabase` — `.agents/skills/supabase`
- `supabase-postgres-best-practices` — `.agents/skills/supabase-postgres-best-practices`

## Roadmap / Next Steps
- [x] Buat tabel di Supabase (assets, maintenance_records, subsidiaries, categories)
- [x] Migrasi AssetContext & MaintenanceContext ke Supabase
- [x] Ganti login access code dengan Supabase Auth
- [x] Data persistent (tidak hilang saat refresh)
- [x] Activity log & notification bell real-time
- [ ] Hapus dead code `src/utils/supabase/client.ts`
- [ ] Sinkronkan `.env.example` dengan env var yang benar-benar dipakai (saat ini masih `GEMINI_API_KEY`/`APP_URL` sisa template lama)
- [ ] Persist Settings.tsx ke Supabase (profile, preferences) — saat ini murni UI state
- [ ] Lihat `asset inventory improve.md` untuk item lain yang belum dikerjakan (RBAC, form validation react-hook-form+zod, unit testing, dll)
