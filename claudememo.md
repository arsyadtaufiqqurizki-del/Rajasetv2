# claudememo.md — Raja Project Dashboard

## Identitas Project
- **Nama**: Raja Project Dashboard (Asset Inventory System)
- **Client/Owner**: Perusahaan Raja
- **Working Dir**: `C:\Users\widia\OneDrive\Desktop\Raja Project dashboard`
- **Stack**: React 19 + TypeScript + Vite 6 + Tailwind CSS v4 + React Router v7

## State Management
- Semua data **in-memory** via React Context (tidak ada backend/database permanen)
- Data hilang saat page refresh — ini sedang dalam proses migrasi ke Supabase

## Autentikasi Saat Ini
- Login pakai **access code `123456`** (hardcoded di `AuthContext.tsx`)
- Belum pakai Supabase Auth

## Supabase Integration (WIP)
- **URL**: `https://kuvuylohuhuyjpzbkitp.supabase.co`
- **Packages**: `@supabase/supabase-js`, `@supabase/ssr` — sudah terinstall
- **Client**: `src/utils/supabase/client.ts`
- **Env vars**: `.env.local` dengan prefix `VITE_` (bukan `NEXT_PUBLIC_` karena Vite, bukan Next.js)
- **Belum dilakukan**: migrasi data aset/maintenance ke Supabase, setup tabel, auth integration

## Konteks Penting
- Project ini adalah **React + Vite**, BUKAN Next.js
  - Jangan pakai `next/headers`, `next/server`, `process.env` — gunakan `import.meta.env`
  - Tidak ada server components, middleware Next.js, atau App Router
- `@supabase/ssr` terinstall tapi hanya pakai browser client (`createClient` dari `@supabase/supabase-js`)

## Struktur Konteks React
| Context | File | Isi |
|---|---|---|
| AuthContext | `src/contexts/AuthContext.tsx` | isAuthenticated, login, logout |
| AssetContext | `src/contexts/AssetContext.tsx` | assets[], subsidiaries[], categories, CRUD |
| MaintenanceContext | `src/contexts/MaintenanceContext.tsx` | records[], CRUD |

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
| `/settings` | Settings.tsx |

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
- [ ] Buat tabel di Supabase (assets, maintenance_records, subsidiaries, categories)
- [ ] Migrasi AssetContext & MaintenanceContext ke Supabase
- [ ] Ganti login access code dengan Supabase Auth
- [ ] Data persistent (tidak hilang saat refresh)
