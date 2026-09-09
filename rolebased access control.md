# Role-Based Access Control & Row-Level Security per Anak Usaha

Rencana implementasi **RBAC** (Super Admin vs Subsidiary Admin) + **RLS** berbasis anak usaha
untuk Rajaset v2.

Status: **rencana** — belum ada satu baris pun yang diimplementasikan.
Tanggal: 2026-09-07.
Project Supabase: `kuvuylohuhuyjpzbkitp` — **skema, policy, dan data sudah diverifikasi langsung
terhadap database produksi** (lihat [§0](#0-temuan-database-produksi) dan
[Lampiran A](#lampiran-a--kondisi-terverifikasi-2026-09-07)).

Tujuan akhir: seorang **Admin APE** yang login hanya melihat aset APE — di Dashboard, di
Inventory, di Reports, di AI Assistant, dan **juga kalau dia membuka DevTools dan memanggil
`supabase.from('assets').select('*')` langsung**. Isolasi terjadi di database, bukan di UI.

---

## 0. Temuan database produksi

> ### 🚨 Tabel `assets` terbuka untuk `anon` — bisa dibaca **dan dihapus** tanpa login
>
> Verifikasi `pg_policies` menemukan policy ini pada **lima tabel**:
>
> ```
> assets, subsidiaries, category_segments_1, category_segments_2, maintenance_records
>   policyname : "allow all"
>   cmd        : ALL          -- SELECT + INSERT + UPDATE + DELETE
>   roles      : {public}     -- public mencakup anon, bukan hanya authenticated
>   qual       : true
>   with_check : true
> ```
>
> `TO public` **termasuk role `anon`**. Artinya `VITE_SUPABASE_ANON_KEY` — yang memang harus ikut
> terkirim ke browser dan bisa dibaca siapa pun dari bundle JS yang sudah dideploy — sudah cukup
> untuk:
>
> ```
> GET    /rest/v1/assets?select=*     → 2.881 baris, tanpa login
> DELETE /rest/v1/assets?id=eq.<uuid> → berhasil, tanpa login
> ```
>
> Ini **bukan** risiko yang muncul setelah RBAC dipasang. Ini kondisi hari ini. Halaman login
> yang ada sekarang melindungi *tampilan* aplikasi, bukan *data*-nya.
>
> Rencana ini menutupnya di Fase 5, tapi kalau ada alasan untuk tidak menunggu sampai RBAC
> selesai, satu statement ini menghentikan akses anon **sekarang** tanpa mengubah perilaku user
> yang sudah login:
>
> ```sql
> -- Langkah darurat, bisa dijalankan lepas dari rencana RBAC.
> -- Menyempitkan dari `public` (termasuk anon) ke `authenticated` saja.
> drop policy "allow all" on public.assets;
> create policy assets_authenticated_all on public.assets
>   for all to authenticated using (true) with check (true);
> ```
>
> **Tapi jangan jalankan sebelum membaca [§7.3](#73-backend-ai-cloud-run--wajib-forward-jwt).**
> AI Assistant hari ini berfungsi *justru karena* policy `TO public` ini — `server/index.js`
> mengakses Supabase sebagai `anon`. Menyempitkan ke `authenticated` akan membuat AI Assistant
> menjawab "tidak ada data" sampai JWT forwarding dipasang. Urutan amannya: Fase 4 dulu, baru ini.

Empat tabel lain (`asset_reclassifications`, `activity_logs`, `report_history`,
`notification_reads`) sudah `TO authenticated` — tidak terekspos ke anon. `item_statuses` juga
`TO authenticated`, tapi dengan nama policy yang berbeda dari kelompok "allow all"; namanya
tercatat di [§6.5](#65-tabel-master-baca-semua-tulis-super-admin).

**Temuan sekunder dari Security Advisor** (bukan penghalang RBAC, tapi layak dibereskan
sekalian): lima fungsi trigger yang sudah ada — `snapshot_reclassification_before_asset_delete`,
`set_assets_updated_at`, `sync_category_from_asset_item_status`,
`sync_asset_verification_from_category`, `sync_category_from_asset_verification` — punya
`search_path` yang mutable. Fungsi-fungsi baru di rencana ini semuanya sudah memakai
`set search_path = ''`. Selain itu `purge_old_activity_logs()` dan `rls_auto_enable()` bisa
dipanggil `anon` lewat `/rest/v1/rpc/…` dan sebaiknya di-`revoke`. Leaked-password protection
juga masih mati di Auth settings.

---

> ## ⚠️ Baca dulu: tiga hal yang akan rusak begitu RLS dinyalakan
>
> Mengaktifkan RLS ketat pada `assets` **bukan** perubahan aditif. Tiga bagian aplikasi hari ini
> bergantung pada fakta bahwa semua orang bisa membaca semua baris:
>
> | # | Yang rusak | Kenapa | Ditangani di |
> |---|---|---|---|
> | **1** | **AI Assistant mati total** | `server/index.js` menembak Supabase REST pakai **anon key tanpa JWT user** (`server/index.js:9-18`). Itu berhasil hari ini semata-mata karena policy `"allow all" TO public` di [§0](#0-temuan-database-produksi). Begitu dibatasi `TO authenticated`, request itu dapat **0 baris** — bukan error, cuma kosong. AI akan menjawab "tidak ada data". | [§7.3](#73-backend-ai-cloud-run--wajib-forward-jwt) |
> | **2** | **Tambah/Edit Asset gagal untuk Subsidiary Admin** | `addAsset()` dan `updateAsset()` selalu memanggil `addSubsidiary()`/`addCategory1()` dst., yang melakukan `upsert` ke tabel master (`src/contexts/AssetContext.tsx:204-207, 226-229`). Upsert tetap butuh izin INSERT walau barisnya sudah ada. Kalau tabel master dikunci super-admin-only, insert aset ikut gagal — **dan gagalnya senyap**. | [§8.4](#84-assetcontext--jangan-upsert-master-data-kalau-bukan-super-admin) |
> | **3** | **Reclassification bocor / baris yatim hilang** | `asset_reclassifications` tidak punya kolom subsidiary sama sekali — hanya `ownership` (teks) dan `asset_id` (nullable, di-`SET NULL` saat aset dihapus). Baris yatim tidak punya jejak subsidiary apa pun. | [§6.2](#62-asset_reclassifications) |
>
> Karena itu urutan fase di [§10](#10-urutan-eksekusi) **tidak boleh dibalik**. Fase 1–4 menyiapkan
> data, role, dan backend tanpa mengunci apa pun; penguncian baru terjadi di Fase 5.

---

## 1. Keputusan desain

### 1.1 `subsidiary_id` (UUID) sebagai kunci keamanan, `subsidiary` (teks) tetap ada

Hari ini `assets.subsidiary` adalah kolom **TEXT** berisi nama anak usaha, sementara tabel master
`subsidiaries` **sudah punya `id uuid primary key`** di samping `name text unique` — tapi tidak
ada satu pun kolom di `assets` yang menunjuk ke `id` itu. Hubungan keduanya murni pencocokan
string lewat `onConflict: 'name'` (`src/contexts/AssetContext.tsx:166`).

Mencocokkan RLS pada teks bebas itu rapuh: satu typo, satu spasi di ujung, satu perbedaan
kapitalisasi → aset "hilang" dari pemiliknya atau, lebih buruk, muncul di anak usaha lain.

**Keputusan:**

| Kolom | Peran | Status |
|---|---|---|
| `subsidiaries.id` (UUID) | **kunci RLS** — satu-satunya yang dipakai policy | **sudah ada** (PK) |
| `subsidiaries.name` (TEXT) | nama yang tampil di dropdown | **sudah ada** (unique) |
| `assets.subsidiary_id` (UUID FK) | **kunci RLS di sisi aset** | **perlu ditambah** |
| `assets.subsidiary` (TEXT) | denormalisasi, dijaga sinkron oleh trigger | sudah ada, dipertahankan |

> **Tidak perlu kolom `subsidiary_code`.** Nilai `name` di produksi sudah berupa kode pendek —
> `EHK`, `TIP`, `APE`, `TCM`, `MUI`, `HEMA`, `REC`, `PPN`, `PDPDE`, `KMJ`. Menambah kolom `code`
> hanya menciptakan dua sumber kebenaran yang harus dijaga sinkron, tanpa memberi apa pun yang
> belum dilakukan `name`. Kalau suatu saat ada anak usaha bernama panjang, tambahkan `code` saat
> itu — bukan sekarang.

Kolom teks **sengaja dipertahankan**: seluruh frontend (`fromDb`/`toDb`, filter, CSV, chart,
report builder) membacanya. Membuangnya berarti menyentuh ~20 file sekaligus dengan migrasi
database — risiko yang tidak sebanding. Trigger di [§4.4](#44-trigger-sinkronisasi-nama--id)
menjaga keduanya konsisten dua arah, jadi frontend boleh tetap menulis nama.

> **Alternatif yang ditolak.** Mencocokkan RLS langsung pada
> `assets.subsidiary = profiles.subsidiary_name` memang menghemat satu migrasi, tapi menjadikan
> *keamanan* bergantung pada *string matching*. Satu `UPDATE assets SET subsidiary = 'APE '`
> (dengan spasi di ujung) sudah cukup untuk memindahkan aset keluar dari jangkauan pemiliknya
> tanpa error apa pun.

### 1.2 Role disimpan di tabel `profiles`, dibaca lewat helper `SECURITY DEFINER`

Dua cara umum menaruh role agar bisa dibaca policy:

| Pendekatan | Kelebihan | Kekurangan |
|---|---|---|
| **A. Tabel `profiles` + helper `SECURITY DEFINER`** ← dipilih | perubahan role langsung berlaku; tidak perlu logout | satu lookup per statement (bukan per baris — lihat catatan performa) |
| B. Custom claim di JWT (Custom Access Token Hook) | nol query, role ada di token | **basi sampai token refresh** (≤1 jam). Mencabut akses admin tidak langsung berlaku |

Dipilih **A**. Untuk sistem inventaris internal, "cabut akses sekarang juga" lebih berharga
daripada menghemat satu InitPlan per query. B bisa ditambahkan belakangan sebagai optimasi
tanpa mengubah struktur tabel.

**Catatan performa (penting).** Helper dipanggil dengan pola `(select public.is_super_admin())`,
**bukan** `public.is_super_admin()` telanjang. Bungkus `select` membuat Postgres mengangkatnya
menjadi *InitPlan* — dievaluasi **sekali per statement**, bukan sekali per baris. Pada tabel
`assets` yang di-fetch 1000 baris per chunk (`src/contexts/AssetContext.tsx:124-137`), selisihnya
1 pemanggilan vs 1000.

Helper dibuat `SECURITY DEFINER` supaya bisa membaca `profiles` **tanpa memicu RLS `profiles`
itu sendiri** — inilah yang mencegah rekursi tak hingga ketika policy `profiles` memanggil
`is_super_admin()`.

### 1.3 Pembuatan user butuh backend — tidak bisa dari browser

`supabase.auth.admin.createUser()` menuntut **service_role key**. Key itu tidak boleh pernah
menyentuh bundle frontend (siapa pun bisa membacanya di DevTools dan mendapat akses penuh ke
database, mengabaikan seluruh RLS).

Hari ini tidak ada satu pun pemakaian service_role di repo — sudah diverifikasi. Jadi ini
komponen baru.

| Opsi | Catatan |
|---|---|
| **Supabase Edge Function `admin-create-user`** ← dipilih | sejalur dengan database, verifikasi JWT bawaan, tidak menambah permukaan deploy baru |
| Endpoint baru di Cloud Run (`server/index.js`) | mungkin, tapi menaruh service_role key di service yang tugasnya proxy AI mencampur dua domain kepercayaan yang berbeda |

Daftar user **tidak** butuh Admin API — Super Admin cukup `select * from profiles`, RLS yang
mengizinkan. Yang butuh service_role hanya: **create**, **reset password**, **ban/unban**.

---

## 2. Matriks izin

| Aksi | Super Admin | Subsidiary Admin |
|---|---|---|
| Lihat aset | semua anak usaha | **hanya anak usahanya** |
| Tambah aset | bebas pilih anak usaha | **dipaksa ke anak usahanya** |
| Ubah aset | semua | hanya miliknya; **tidak boleh memindahkan** aset ke anak usaha lain |
| Hapus aset | semua | hanya miliknya |
| Maintenance / Reclassification / Reports | semua | hanya miliknya |
| Master Data (subsidiaries, kategori, item status) | **tulis** | **baca saja** |
| Activity log | semua | hanya log user se-anak-usaha |
| Settings › User Management | **ya** | **tidak** (tab disembunyikan + ditolak DB) |
| Dropdown "All Subsidiaries" di Dashboard | aktif | **terkunci** ke anak usahanya |

Dua aturan yang gampang terlewat:

- Subsidiary Admin **tidak boleh menaikkan role dirinya sendiri**. Policy `UPDATE` pada `profiles`
  saja tidak cukup — dia berhak mengubah barisnya sendiri (ganti nama di Settings › Profile), dan
  `WITH CHECK` tidak bisa membedakan kolom mana yang berubah karena tidak punya akses ke nilai
  lama. Dijaga oleh trigger di [§5.3](#53-guard-anti-eskalasi-privilege).
- User berstatus `inactive` → `current_app_role()` mengembalikan `NULL` → **semua policy menolak**.
  Dia masih bisa login, tapi melihat aplikasi kosong. Untuk memblokir login sekalian, Edge
  Function juga memanggil `admin.updateUserById({ ban_duration })`
  ([§7.2](#72-edge-function-admin-update-user)).

---

## 3. Skema baru

```
auth.users ──1:1──▶ public.profiles
                        │ role: app_role ('super_admin' | 'subsidiary_admin')
                        │ subsidiary_id ──┐
                        │ status          │
                        └─────────────────┤
                                          ▼
                              public.subsidiaries (id, code, name)
                                          ▲
                     ┌────────────────────┼────────────────────┐
                     │                    │                    │
              assets.subsidiary_id   maintenance_records   asset_reclassifications
                                      .subsidiary_id         .subsidiary_id
```

Invarian: `role = 'super_admin'` ⟹ `subsidiary_id IS NULL`;
`role = 'subsidiary_admin'` ⟹ `subsidiary_id IS NOT NULL`. Ditegakkan CHECK constraint di
database, bukan hanya validasi form.

---

## 4. Migrasi — Fase 1: struktur (belum mengunci apa pun)

File: `supabase/migrations/20260907000000_rbac_schema.sql`

### 4.1 Tabel `subsidiaries` — tidak perlu diubah

Verifikasi produksi: `subsidiaries` sudah berbentuk `id uuid primary key default gen_random_uuid()`
+ `name text unique`, berisi 10 baris. Itu persis yang dibutuhkan sebagai target FK.

**Tidak ada DDL di langkah ini.** Bagian ini sengaja dipertahankan sebagai catatan bahwa
pengecekannya sudah dilakukan — bukan langkah yang terlewat.

### 4.2 Enum role + tabel `profiles`

```sql
do $$
begin
  if not exists (select 1 from pg_type where typname = 'app_role') then
    create type public.app_role as enum ('super_admin', 'subsidiary_admin');
  end if;
end $$;

create table if not exists public.profiles (
  id                   uuid primary key references auth.users(id) on delete cascade,
  full_name            text not null default '',
  email                text,
  role                 public.app_role not null default 'subsidiary_admin',
  subsidiary_id        uuid references public.subsidiaries(id) on delete restrict,
  status               text not null default 'active',
  must_change_password boolean not null default false,
  created_by           uuid references auth.users(id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),

  constraint profiles_status_ck check (status in ('active', 'inactive')),

  -- Invarian §3: super admin lintas anak usaha, subsidiary admin wajib punya satu
  constraint profiles_role_subsidiary_ck check (
       (role = 'super_admin'      and subsidiary_id is null)
    or (role = 'subsidiary_admin' and subsidiary_id is not null)
  )
);

-- Dipakai policy activity_logs (§6.4) dan tabel di halaman User Management
create index if not exists idx_profiles_subsidiary_id on public.profiles (subsidiary_id);
create index if not exists idx_profiles_role          on public.profiles (role);
```

> **Catatan: RLS akan menyala sendiri di tabel ini.** Database punya event trigger `ensure_rls`
> (`ddl_command_end` → `public.rls_auto_enable()`) yang otomatis menjalankan
> `enable row level security` pada setiap tabel baru di skema `public`. Fungsinya tidak membuat
> policy apa pun.
>
> Konsekuensinya: begitu `create table public.profiles` selesai, tabelnya **RLS aktif dengan nol
> policy** — yang berarti menolak semua akses dari `anon` dan `authenticated` sampai
> [§5.2](#52-rls-profiles) dijalankan. Ini aman (belum ada yang membaca `profiles` di antara Fase 1
> dan Fase 2), dan migrasi sendiri berjalan sebagai pemilik tabel sehingga backfill di
> [§4.6](#46-backfill-user-yang-sudah-ada) tidak terhalang. Tapi jangan kaget kalau mencoba
> `select * from profiles` lewat REST di antara kedua fase itu dan mendapat array kosong.

### 4.3 Kolom `subsidiary_id` di `assets` + backfill

```sql
alter table public.assets
  add column if not exists subsidiary_id uuid references public.subsidiaries(id) on delete restrict;

update public.assets a
   set subsidiary_id = s.id
  from public.subsidiaries s
 where trim(a.subsidiary) = s.name
   and a.subsidiary_id is null;

create index if not exists idx_assets_subsidiary_id on public.assets (subsidiary_id);
```

**Backfill ini sudah diverifikasi akan bersih 100%.** Dijalankan terhadap produksi sebagai
`select`, hasilnya:

| Pemeriksaan | Hasil |
|---|---|
| Total aset | 2.881 |
| Aset yang namanya tidak cocok baris `subsidiaries` mana pun | **0** |
| Aset dengan `subsidiary` kosong/null | **0** |
| Selisih antara cocok-persis dan cocok-setelah-`trim()` | **0** (tidak ada masalah spasi) |

Karena itu langkah "insert nama yang belum ada ke tabel master" yang biasanya diperlukan di
migrasi seperti ini **tidak dibutuhkan** — semua 10 nama sudah terdaftar.

Tetap jalankan verifikasi ini lagi tepat sebelum Fase 5, karena data bisa bertambah di antara
sekarang dan saat eksekusi. Kalau hasilnya bukan 0, aset itu akan **tidak terlihat oleh siapa pun
kecuali Super Admin** begitu RLS aktif:

```sql
select count(*) as yatim from public.assets where subsidiary_id is null;
select distinct subsidiary from public.assets where subsidiary_id is null;  -- kalau > 0
```

### 4.4 Trigger sinkronisasi nama ⇄ id

Frontend menulis **nama** (`toDb()` di `src/contexts/AssetContext.tsx:74-90`). Trigger ini
menerjemahkannya ke `subsidiary_id` sebelum RLS `WITH CHECK` dievaluasi — urutan ini penting dan
memang dijamin Postgres: **BEFORE trigger berjalan lebih dulu, `WITH CHECK` menilai baris hasil
trigger.** Artinya frontend tidak perlu diubah sama sekali untuk lolos RLS.

```sql
create or replace function public.sync_asset_subsidiary()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE'
     and new.subsidiary is distinct from old.subsidiary
     and new.subsidiary_id is not distinct from old.subsidiary_id then
    -- User mengganti nama lewat form; id belum ikut. Nama yang menang.
    select s.id into new.subsidiary_id
      from public.subsidiaries s where s.name = trim(new.subsidiary);

  elsif new.subsidiary_id is not null then
    -- id eksplisit (mis. dari import, atau klien yang sudah id-aware). Id yang menang,
    -- dan nama ditulis ulang dari master supaya tidak bisa dipalsukan.
    select s.name into new.subsidiary
      from public.subsidiaries s where s.id = new.subsidiary_id;

  elsif coalesce(trim(new.subsidiary), '') <> '' then
    select s.id into new.subsidiary_id
      from public.subsidiaries s where s.name = trim(new.subsidiary);
  end if;

  return new;
end $$;

drop trigger if exists trg_sync_asset_subsidiary on public.assets;
create trigger trg_sync_asset_subsidiary
  before insert or update of subsidiary, subsidiary_id on public.assets
  for each row execute function public.sync_asset_subsidiary();
```

Cabang kedua adalah yang menutup celah pemalsuan: kalau Subsidiary Admin mengirim
`subsidiary_id` milik orang lain sambil menulis nama anak usahanya sendiri, trigger menimpa nama
itu dengan nama asli dari master, lalu `WITH CHECK` menolak berdasarkan `subsidiary_id`.

> Setelah backfill bersih (angka yatim = 0) dan aplikasi berjalan normal beberapa hari,
> jadikan kolomnya wajib:
> `alter table public.assets alter column subsidiary_id set not null;`
> Jangan lakukan ini di migrasi yang sama — kalau ada satu baris yatim, seluruh migrasi rollback.

### 4.5 Auto-provision `profiles` saat user dibuat

```sql
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, email, role, subsidiary_id, must_change_password)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''),
    new.email,
    coalesce((new.raw_user_meta_data ->> 'role')::public.app_role, 'subsidiary_admin'),
    nullif(new.raw_user_meta_data ->> 'subsidiary_id', '')::uuid,
    coalesce((new.raw_user_meta_data ->> 'must_change_password')::boolean, true)
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
```

> **Perhatikan.** Kalau metadata mengirim `role = 'subsidiary_admin'` tanpa `subsidiary_id`,
> `profiles_role_subsidiary_ck` gagal → trigger gagal → **`createUser` gagal**, dan user tidak
> pernah terbentuk (bukan setengah jadi — ini justru perilaku yang benar). Validasi di Edge
> Function ([§7.1](#71-edge-function-admin-create-user)) harus menolak kombinasi itu lebih dulu
> supaya pesan errornya manusiawi, bukan "violates check constraint".

### 4.6 Backfill user yang sudah ada

Verifikasi produksi: **hanya ada 1 user di `auth.users`** — `admin@rajaproject.com`
(`raw_user_meta_data.name = "kacang"`, terakhir login 2026-09-04). Jadi tidak ada keputusan
migrasi yang perlu diambil di sini: satu-satunya akun yang ada menjadi Super Admin pertama, dan
semua Subsidiary Admin dibuat dari nol lewat User Management.

```sql
insert into public.profiles (id, full_name, email, role, subsidiary_id, must_change_password)
select u.id,
       coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name', ''),
       u.email,
       'super_admin',
       null,
       false
  from auth.users u
on conflict (id) do nothing;
```

Query ditulis untuk semua baris `auth.users`, bukan di-hardcode ke satu UUID, supaya tetap benar
kalau ada akun tambahan dibuat sebelum migrasi dijalankan. Konsekuensinya semua akun yang ada saat
migrasi berjalan menjadi Super Admin — untuk kondisi 1 user itu persis yang diinginkan.

Verifikasi sesudahnya, harus mengembalikan tepat 1 baris:

```sql
select id, email, role, status from public.profiles;
```

---

## 5. Migrasi — Fase 2: helper & RLS pada `profiles`

File: `supabase/migrations/20260907010000_rbac_helpers_and_profiles_rls.sql`

### 5.1 Helper

```sql
create or replace function public.current_app_role()
returns public.app_role
language sql
stable
security definer
set search_path = ''
as $$
  select p.role
    from public.profiles p
   where p.id = (select auth.uid())
     and p.status = 'active'
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.current_app_role() = 'super_admin', false)
$$;

create or replace function public.current_subsidiary_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.subsidiary_id
    from public.profiles p
   where p.id = (select auth.uid())
     and p.status = 'active'
$$;

revoke execute on function public.current_app_role(),
                          public.is_super_admin(),
                          public.current_subsidiary_id()
  from public, anon;

grant execute on function public.current_app_role(),
                         public.is_super_admin(),
                         public.current_subsidiary_id()
  to authenticated;
```

Tiga properti yang semuanya wajib, bukan sekadar gaya penulisan:

- `stable` — memberi tahu planner hasilnya konstan dalam satu statement; prasyarat agar bungkus
  `(select …)` benar-benar menjadi InitPlan.
- `security definer` — membaca `profiles` tanpa memicu RLS `profiles`; ini yang mencegah rekursi.
- `set search_path = ''` — tanpa ini, fungsi `SECURITY DEFINER` bisa dibajak lewat `search_path`
  yang dimanipulasi pemanggil. Konsekuensinya semua nama **harus** ditulis lengkap
  (`public.profiles`, bukan `profiles`) — sudah dilakukan di atas.

### 5.2 RLS `profiles`

```sql
alter table public.profiles enable row level security;

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using (
    id = (select auth.uid())
    or (select public.is_super_admin())
  );

-- INSERT normal lewat trigger handle_new_user (SECURITY DEFINER, lolos RLS).
-- Policy ini untuk perbaikan manual oleh super admin.
drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles
  for insert to authenticated
  with check ((select public.is_super_admin()));

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
  for update to authenticated
  using (
    id = (select auth.uid())
    or (select public.is_super_admin())
  )
  with check (
    id = (select auth.uid())
    or (select public.is_super_admin())
  );

drop policy if exists profiles_delete on public.profiles;
create policy profiles_delete on public.profiles
  for delete to authenticated
  using ((select public.is_super_admin()) and id <> (select auth.uid()));
```

`profiles_delete` sengaja melarang menghapus diri sendiri — mencegah Super Admin terakhir
menghapus barisnya dan meninggalkan sistem tanpa siapa pun yang bisa mengelola user.

### 5.3 Guard anti-eskalasi privilege

`profiles_update` mengizinkan user mengubah **barisnya sendiri** (untuk ganti nama di
Settings › Profile). Tanpa guard, dia juga bisa mengubah `role`-nya menjadi `super_admin`.

```sql
create or replace function public.guard_profile_privilege_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select public.is_super_admin()) then
    if new.role          is distinct from old.role
    or new.subsidiary_id is distinct from old.subsidiary_id
    or new.status        is distinct from old.status then
      raise exception 'Tidak berwenang mengubah role, subsidiary, atau status'
        using errcode = '42501';
    end if;
  end if;

  new.updated_at := now();
  return new;
end $$;

drop trigger if exists trg_guard_profile_privilege on public.profiles;
create trigger trg_guard_profile_privilege
  before update on public.profiles
  for each row execute function public.guard_profile_privilege_change();
```

---

## 6. Migrasi — Fase 5: RLS pada tabel data

File: `supabase/migrations/20260907020000_rbac_data_rls.sql`

> **Nama policy lama sudah diverifikasi** — tidak perlu ditebak lagi. Policy `assets` tidak pernah
> masuk `supabase/migrations/` (dibuat lewat dashboard), jadi daftar di bawah berasal dari
> `pg_policies` produksi, bukan dari repo:
>
> | Tabel | Policy lama | cmd | roles |
> |---|---|---|---|
> | `assets` | `"allow all"` | ALL | **public** |
> | `subsidiaries` | `"allow all"` | ALL | **public** |
> | `category_segments_1` | `"allow all"` | ALL | **public** |
> | `category_segments_2` | `"allow all"` | ALL | **public** |
> | `maintenance_records` | `"allow all"` | ALL | **public** |
> | `asset_reclassifications` | 4 policy `"…reclassifications"` | per-cmd | authenticated |
> | `activity_logs` | `"authenticated users can read activity logs"` | SELECT | authenticated |
> | `report_history` | 3 policy `"…report history"` | per-cmd | authenticated |
> | `item_statuses` | 4 policy `"…item statuses"` | per-cmd | authenticated |
>
> **Menghapus yang lama adalah inti dari fase ini, bukan kebersihan.** Policy permisif digabung
> dengan `OR`: satu `"allow all"` yang tertinggal membatalkan seluruh isolasi tanpa error apa pun.
>
> Jalankan ulang query ini tepat sebelum eksekusi untuk memastikan tidak ada policy baru yang
> ditambahkan lewat dashboard sejak 2026-09-07:
>
> ```sql
> select tablename, policyname, cmd, roles::text, qual, with_check
>   from pg_policies where schemaname = 'public' order by tablename, cmd, policyname;
> ```

### 6.1 `assets`

RLS **sudah aktif** di semua tabel `public` (event trigger `ensure_rls`), jadi baris
`enable row level security` di bawah adalah no-op yang sengaja dipertahankan agar migrasi tetap
benar kalau dijalankan di database lain (mis. branch atau staging).

```sql
alter table public.assets enable row level security;

-- Inilah policy yang membuka assets ke anon hari ini (§0)
drop policy if exists "allow all" on public.assets;

drop policy if exists assets_select on public.assets;
create policy assets_select on public.assets
  for select to authenticated
  using (
    (select public.is_super_admin())
    or subsidiary_id = (select public.current_subsidiary_id())
  );

drop policy if exists assets_insert on public.assets;
create policy assets_insert on public.assets
  for insert to authenticated
  with check (
    (select public.is_super_admin())
    or subsidiary_id = (select public.current_subsidiary_id())
  );

-- USING = baris mana yang boleh disentuh; WITH CHECK = boleh jadi apa setelah diubah.
-- Keduanya wajib: tanpa WITH CHECK, Subsidiary Admin bisa memindahkan asetnya sendiri
-- ke anak usaha lain — menyusupkan data ke pihak lain sekaligus kehilangan aksesnya.
drop policy if exists assets_update on public.assets;
create policy assets_update on public.assets
  for update to authenticated
  using (
    (select public.is_super_admin())
    or subsidiary_id = (select public.current_subsidiary_id())
  )
  with check (
    (select public.is_super_admin())
    or subsidiary_id = (select public.current_subsidiary_id())
  );

drop policy if exists assets_delete on public.assets;
create policy assets_delete on public.assets
  for delete to authenticated
  using (
    (select public.is_super_admin())
    or subsidiary_id = (select public.current_subsidiary_id())
  );
```

`current_subsidiary_id()` mengembalikan `NULL` untuk Super Admin dan untuk user nonaktif.
Karena `subsidiary_id = NULL` selalu bernilai `NULL` (bukan `true`), cabang kedua tidak pernah
lolos sendirian — Super Admin lolos lewat cabang pertama, user nonaktif tidak lolos sama sekali.
Itu perilaku yang diinginkan; jangan "perbaiki" dengan `IS NOT DISTINCT FROM`.

### 6.2 `asset_reclassifications`

Tabel ini tidak punya jejak subsidiary sendiri. Kolom `ownership` diisi dari aset tertaut saat
dibaca (`src/contexts/ReclassificationContext.tsx:55`), dan `asset_id` di-`SET NULL` ketika aset
sumbernya dihapus (migrasi `20260906000000_flag_reclassification_on_asset_delete.sql`) — jadi
baris yatim kehilangan satu-satunya jalur ke anak usaha.

Menulis policy berbasis `EXISTS (… join assets …)` akan **menyembunyikan baris yatim dari semua
Subsidiary Admin**, persis baris yang fitur deteksi-aset-terhapus (commit `a15a555`) dibuat untuk
ditampilkan.

Solusinya: beri tabel ini kolom `subsidiary_id` sendiri, diisi trigger dari aset tertaut, dan
**dibiarkan bertahan** saat asetnya dihapus.

```sql
alter table public.asset_reclassifications
  add column if not exists subsidiary_id uuid references public.subsidiaries(id) on delete restrict;

update public.asset_reclassifications r
   set subsidiary_id = a.subsidiary_id
  from public.assets a
 where r.asset_id = a.id and r.subsidiary_id is null;

-- Sisanya (yatim / entri manual): pakai teks ownership
update public.asset_reclassifications r
   set subsidiary_id = s.id
  from public.subsidiaries s
 where trim(r.ownership) = s.name and r.subsidiary_id is null;

create index if not exists idx_reclass_subsidiary_id
  on public.asset_reclassifications (subsidiary_id);
```

Verifikasi produksi: **2.881 baris, semuanya `asset_id IS NOT NULL`, nol baris yatim, nol
`asset_deleted_at` terisi.** Artinya `update` pertama sudah mengisi 100% baris dan `update`
kedua (fallback lewat teks `ownership`) tidak akan menyentuh apa pun hari ini.

Fallback itu tetap ditulis: begitu ada aset yang dihapus setelah migrasi, barisnya menjadi yatim,
dan tanpa fallback baris hasil entri manual di masa depan akan lahir tanpa `subsidiary_id` — yaitu
tidak terlihat oleh pemiliknya sendiri.

```sql

create or replace function public.sync_reclass_subsidiary()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.asset_id is not null then
    select a.subsidiary_id into new.subsidiary_id
      from public.assets a where a.id = new.asset_id;
  elsif new.subsidiary_id is null and coalesce(trim(new.ownership), '') <> '' then
    select s.id into new.subsidiary_id
      from public.subsidiaries s where s.name = trim(new.ownership);
  end if;
  return new;
end $$;

drop trigger if exists trg_sync_reclass_subsidiary on public.asset_reclassifications;
create trigger trg_sync_reclass_subsidiary
  before insert or update of asset_id, ownership on public.asset_reclassifications
  for each row execute function public.sync_reclass_subsidiary();
```

Saat aset dihapus dan `asset_id` di-set `NULL`, trigger ini memang ikut jalan (`asset_id` ada di
klausa `update of`) — tapi cabang pertama tidak jalan karena `asset_id` sudah `NULL`, dan cabang
kedua hanya mengisi kalau `subsidiary_id` masih `NULL`. **Nilai lama bertahan.** Itulah yang
membuat baris yatim tetap terlihat oleh pemiliknya.

Policy-nya mengikuti pola `assets`, dengan satu tambahan pada INSERT: jejak audit `created_by`
yang sudah ada tetap dipertahankan.

```sql
alter table public.asset_reclassifications enable row level security;

drop policy if exists "authenticated users can read reclassifications"   on public.asset_reclassifications;
drop policy if exists "users can insert own reclassifications"           on public.asset_reclassifications;
drop policy if exists "authenticated users can update reclassifications" on public.asset_reclassifications;
drop policy if exists "authenticated users can delete reclassifications" on public.asset_reclassifications;

create policy reclass_select on public.asset_reclassifications
  for select to authenticated
  using ((select public.is_super_admin())
         or subsidiary_id = (select public.current_subsidiary_id()));

create policy reclass_insert on public.asset_reclassifications
  for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and ((select public.is_super_admin())
         or subsidiary_id = (select public.current_subsidiary_id()))
  );

create policy reclass_update on public.asset_reclassifications
  for update to authenticated
  using ((select public.is_super_admin())
         or subsidiary_id = (select public.current_subsidiary_id()))
  with check ((select public.is_super_admin())
              or subsidiary_id = (select public.current_subsidiary_id()));

create policy reclass_delete on public.asset_reclassifications
  for delete to authenticated
  using ((select public.is_super_admin())
         or subsidiary_id = (select public.current_subsidiary_id()));
```

### 6.3 `maintenance_records` & `report_history`

`maintenance_records` sudah punya kolom teks `subsidiary` (`src/contexts/MaintenanceContext.tsx:28`).
Perlakuannya sama persis dengan `assets`: tambah `subsidiary_id`, backfill dari nama, pasang
trigger sinkronisasi (fungsi `sync_asset_subsidiary` bisa dipakai ulang apa adanya — ia hanya
menyentuh `NEW.subsidiary` dan `NEW.subsidiary_id`), lalu empat policy dengan pola yang sama,
setelah `drop policy if exists "allow all" on public.maintenance_records`.

Verifikasi produksi: tabel ini **berisi 0 baris**. Backfill-nya tidak ada risiko sama sekali —
tapi policy `"allow all" TO public`-nya tetap harus dihapus, karena tabel kosong hari ini tidak
berarti kosong besok.

`report_history` juga punya `subsidiary TEXT` (`20260724000000_create_report_history.sql`), tapi
isinya adalah **parameter report**, bukan kepemilikan baris — nilainya bisa `'All'`. Karena itu
isolasinya diikat ke pembuatnya, bukan ke teks itu:

```sql
alter table public.report_history
  add column if not exists subsidiary_id uuid references public.subsidiaries(id) on delete set null;

-- Report milik siapa = anak usaha pembuatnya
update public.report_history r
   set subsidiary_id = p.subsidiary_id
  from public.profiles p
 where r.user_id = p.id and r.subsidiary_id is null;

drop policy if exists "authenticated users can read report history" on public.report_history;
create policy report_history_select on public.report_history
  for select to authenticated
  using ((select public.is_super_admin())
         or subsidiary_id = (select public.current_subsidiary_id()));
```

Policy INSERT yang sudah ada (`auth.uid() = user_id`) tetap benar; tambahkan syarat agar
`subsidiary_id` yang ditulis sama dengan milik pembuat. Policy DELETE dari
`20260724010000_add_delete_policy_to_report_history.sql` perlu diberi syarat yang sama.

### 6.4 `activity_logs`

Log tidak punya subsidiary; yang punya adalah **pemilik log**. Join ke `profiles`:

```sql
drop policy if exists "authenticated users can read activity logs" on public.activity_logs;
create policy activity_logs_select on public.activity_logs
  for select to authenticated
  using (
    (select public.is_super_admin())
    or user_id = (select auth.uid())
    or exists (
      select 1 from public.profiles p
       where p.id = activity_logs.user_id
         and p.subsidiary_id = (select public.current_subsidiary_id())
    )
  );
```

`EXISTS` di sini per-baris, tapi lookup-nya lewat primary key `profiles` dan tabelnya sudah
dipangkas berkala (`20260721000000_purge_old_activity_logs.sql`), jadi biayanya kecil.

### 6.5 Tabel master: baca semua, tulis super admin

Empat tabel master, tapi policy lamanya **tidak seragam** — tiga memakai `"allow all" TO public`,
sementara `item_statuses` punya empat policy per-command `TO authenticated`. Hapus keduanya
dulu, baru pasang pola yang sama:

```sql
drop policy if exists "allow all" on public.subsidiaries;
drop policy if exists "allow all" on public.category_segments_1;
drop policy if exists "allow all" on public.category_segments_2;

drop policy if exists "authenticated users can read item statuses"   on public.item_statuses;
drop policy if exists "authenticated users can insert item statuses" on public.item_statuses;
drop policy if exists "authenticated users can update item statuses" on public.item_statuses;
drop policy if exists "authenticated users can delete item statuses" on public.item_statuses;

do $$
declare t text;
begin
  foreach t in array array['subsidiaries', 'category_segments_1', 'category_segments_2', 'item_statuses']
  loop
    execute format('alter table public.%I enable row level security', t);

    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format(
      'create policy %I on public.%I for select to authenticated using (true)',
      t || '_select', t);

    execute format('drop policy if exists %I on public.%I', t || '_write', t);
    execute format(
      'create policy %I on public.%I for all to authenticated
         using ((select public.is_super_admin()))
         with check ((select public.is_super_admin()))',
      t || '_write', t);
  end loop;
end $$;
```

SELECT sengaja `true`: Subsidiary Admin **harus** bisa membaca daftar kategori dan lokasi untuk
mengisi form aset, dan membaca nama anak usahanya sendiri. Yang dilarang hanya menulis.

Konsekuensinya adalah masalah #2 di kotak peringatan — ditangani di
[§8.4](#84-assetcontext--jangan-upsert-master-data-kalau-bukan-super-admin).

### 6.6 Setelah semua migrasi jalan

```sql
-- tidak boleh ada tabel public tanpa RLS
select c.relname
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;
```

Lalu jalankan Supabase **Security Advisor** (`get_advisors`, tipe `security`) dan bereskan temuan
`rls_disabled_in_public` / `function_search_path_mutable` sebelum menyentuh frontend.

---

## 7. Backend

### 7.1 Edge Function `admin-create-user`

`supabase/functions/admin-create-user/index.ts`

Alur, berurutan — tiap langkah menutup satu celah:

1. Baca header `Authorization`. Kalau kosong → 401.
2. Buat klien **anon** dengan token itu, panggil `getUser()`. Ini memverifikasi tanda tangan JWT.
   Jangan pernah percaya `user_id` yang dikirim di body.
3. Buat klien **service_role**, baca `profiles` milik pemanggil. Tolak kalau
   `role <> 'super_admin'` atau `status <> 'active'` → 403.
   Pengecekan ini di server, bukan di UI — menyembunyikan tab bukan otorisasi.
4. Validasi payload: `email` valid, `password` ≥ 12 karakter,
   `role ∈ {super_admin, subsidiary_admin}`, dan **`subsidiary_id` wajib ada bila
   `role = 'subsidiary_admin'`, wajib `null` bila `super_admin`** — mencerminkan
   `profiles_role_subsidiary_ck` supaya errornya terbaca, bukan pesan constraint mentah
   ([§4.5](#45-auto-provision-profiles-saat-user-dibuat)). Verifikasi juga `subsidiary_id`
   benar-benar ada di tabel `subsidiaries`.
5. `admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name, role, subsidiary_id, must_change_password: true } })`.
   `email_confirm: true` karena ini akun yang dibuatkan admin — tidak ada alur verifikasi email.
6. Trigger `handle_new_user` membentuk baris `profiles`. Set `created_by` sesudahnya lewat klien
   service_role.
7. Balas `{ id, email }` saja. **Jangan pernah** mengembalikan password di response body.

Env: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (ketiganya otomatis
tersedia di runtime Edge Functions; service_role key **tidak pernah** masuk `.env` frontend
maupun `wrangler.jsonc`).

### 7.2 Edge Function `admin-update-user`

Tiga aksi, verifikasi pemanggil identik langkah 1–3 di atas:

| Aksi | Yang dikerjakan |
|---|---|
| `reset_password` | `admin.updateUserById(id, { password })` + set `profiles.must_change_password = true` |
| `deactivate` | `profiles.status = 'inactive'` **dan** `admin.updateUserById(id, { ban_duration: '876000h' })` |
| `activate` | `profiles.status = 'active'` **dan** `ban_duration: 'none'` |

Keduanya harus dilakukan bersamaan. `status = 'inactive'` saja membuat user melihat aplikasi
kosong tapi tetap bisa login; ban saja membuat baris `profiles`-nya berbohong.

Tambahan: **tolak** kalau `id` sama dengan pemanggil, dan tolak menonaktifkan Super Admin
terakhir yang masih aktif.

### 7.3 Backend AI (Cloud Run) — wajib forward JWT

Ini masalah #1 di kotak peringatan, dan yang paling mudah terlewat karena tidak memunculkan
error apa pun.

`server/index.js:9-18` memanggil Supabase REST dengan anon key sebagai `apikey` **dan** sebagai
`Authorization`. Setelah policy dibatasi `TO authenticated`, request itu berjalan sebagai `anon`
dan mendapat **nol baris** — AI Assistant akan menjawab "tidak ada data" alih-alih gagal.

Perbaikannya kecil dan menyelesaikan keamanan sekaligus fungsionalitas:

**Klien** — `src/hooks/useAiChat.ts:126-128`:

```ts
const { data: { session } } = await supabase.auth.getSession();
const response = await fetch(`${CLOUD_RUN_URL}/chat`, {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    authorization: `Bearer ${session?.access_token ?? ''}`,
  },
  // ...
});
```

**Server** — `server/index.js`:

```js
async function fetchFromSupabase(table, userJwt) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=*`, {
    headers: {
      apikey: SUPABASE_KEY,               // tetap anon key
      Authorization: `Bearer ${userJwt}`, // JWT user, bukan anon key
    },
  });
  // ...
}
```

Teruskan `userJwt` dari header request ke setiap pemanggilan. Tolak dengan 401 kalau header-nya
kosong. Setelah ini RLS berlaku otomatis: Admin APE bertanya "aset termahal tahun 2024?" dan
agregat yang dihitung `computeAssetAggregates()` hanya berisi aset APE — tanpa satu pun baris
logika filter tambahan di sisi AI.

Juga longgarkan CORS: `Access-Control-Allow-Headers` saat ini hanya `'Content-Type'`
(`server/index.js:23`), jadi preflight akan menolak header `authorization`. Ubah menjadi
`'Content-Type, Authorization'`.

---

## 8. Frontend

### 8.1 Tipe & AuthContext

`src/types/rbac.ts` (baru):

```ts
export type AppRole = 'super_admin' | 'subsidiary_admin';

export type UserProfile = {
  id: string;
  fullName: string;
  email: string;
  role: AppRole;
  subsidiaryId: string | null;
  subsidiaryName: string | null;
  status: 'active' | 'inactive';
  mustChangePassword: boolean;
  createdAt: string;
};
```

`src/contexts/AuthContext.tsx` — tambahkan `profile`, dimuat bersamaan dengan sesi:

```ts
interface AuthContextType {
  // ...yang sudah ada
  profile: UserProfile | null;
  isSuperAdmin: boolean;
  /** nama anak usaha yang mengunci semua filter, atau null untuk Super Admin */
  lockedSubsidiary: string | null;
  refreshProfile: () => Promise<void>;
}
```

Query-nya satu kali per sesi:
`supabase.from('profiles').select('*, subsidiary:subsidiaries(id, name, code)').eq('id', userId).single()`.

**`loading` harus mencakup pemuatan profil, bukan hanya sesi.** `PrivateRoute` dan `AppRoutes`
sudah `return null` selama `loading` (`src/App.tsx:29-31, 35-36`) — kalau profil dimuat *setelah*
`loading` menjadi `false`, akan ada satu render di mana `isSuperAdmin === false` untuk Super
Admin: tab User Management berkedip hilang, dan dropdown Dashboard sempat terkunci ke `null`.

Kasus tepi yang harus ditangani eksplisit: **baris `profiles` tidak ditemukan** (user dibuat
langsung dari dashboard Supabase, melewati trigger). Perlakukan sebagai tidak berwenang —
tampilkan layar "Akun Anda belum dikonfigurasi, hubungi administrator". Jangan diam-diam
menganggapnya Super Admin.

### 8.2 Mengunci dropdown Dashboard

Kunci diterapkan **dua lapis**:

1. `useDashboardFilters` menerima `lockedSubsidiary`. Kalau terisi, `filterSubsidiary` selalu
   mengembalikan `[lockedSubsidiary]` dan setter-nya no-op. Ini juga menutup manipulasi URL —
   filter dibaca dari `searchParams` (`src/hooks/useListFilters.ts`), jadi mengetik
   `?subsidiary=EHK` di address bar tidak boleh mengubah apa pun.
2. `DashboardFilterBar` menerima `subsidiaryLocked?: string | null`; saat terisi, render
   `MultiSelectDropdown` dalam keadaan `disabled` bertuliskan nama anak usaha (bukan
   "All Subsidiaries") — user tahu kenapa pilihannya tidak bisa diubah, bukan mengira UI-nya
   rusak.

Keduanya **kosmetik**. Isolasi sesungguhnya ada di [§6.1](#61-assets): array `assets` yang sampai
ke `AssetContext` sudah tersaring RLS, jadi seluruh metrik turunan — `useDashboardMetrics`, KPI
row, `subsidiaryComparisonData`, trend chart, panel recent assets, sampai export CSV di
`Dashboard.tsx:120` — otomatis ikut tersaring **tanpa perubahan kode sama sekali**. Itu sebabnya
RLS dikerjakan lebih dulu, bukan sesudah UI.

Perlakuan yang sama untuk `useAssetFilters` (Inventory), `useMaintenanceFilters`,
`useReclassificationFilters`, dan `useReportFilters`.

> Untuk Subsidiary Admin, pertimbangkan menyembunyikan `DashboardSubsidiaryBarChart` sepenuhnya —
> grafik perbandingan antar anak usaha dengan satu batang tidak menyampaikan apa pun.

### 8.3 Menu & rute

- `SettingsNav` (`src/components/settings/SettingsNav.tsx`): tambah tab `users` dengan ikon
  `Users`, **hanya kalau `isSuperAdmin`**. `SettingsTab` menjadi
  `'profile' | 'config' | 'notif' | 'security' | 'users'`.
- `Settings.tsx`: render `<UserManagementTab />` untuk tab itu, dengan penjaga kedua — kalau
  `activeTab === 'users'` tapi bukan super admin, paksa balik ke `'profile'` (menutup jalur
  deep-link).
- `Layout.tsx`: sembunyikan item nav **Master Data** untuk Subsidiary Admin (`NAV_ITEMS` sekitar
  `src/components/Layout.tsx:24`) — halamannya hanya berisi tombol tambah/hapus yang akan ditolak
  database. Lebih baik tidak ditampilkan daripada gagal senyap.
- `App.tsx`: tambahkan komponen `<RequireSuperAdmin>` dan bungkus rute `master-data`.

### 8.4 `AssetContext` — jangan upsert master data kalau bukan super admin

Ini masalah #2 di kotak peringatan. `addAsset()` dan `updateAsset()` selalu memanggil
`addSubsidiary()` / `addCategory1()` / `addCategory2()` / `addItemStatus()`
(`src/contexts/AssetContext.tsx:204-207` dan `226-229`), yang meng-`upsert` ke tabel master.
Setelah [§6.5](#65-tabel-master-baca-semua-tulis-super-admin), upsert itu ditolak untuk
Subsidiary Admin — dan karena hasilnya di-`.then()` tanpa penanganan error
(`src/contexts/AssetContext.tsx:166`), kegagalannya **tidak terlihat di mana pun**.

Perbaikan: beri `AssetProvider` akses ke `isSuperAdmin`, dan jadikan keempat fungsi itu no-op
untuk Subsidiary Admin. Nilai yang mereka pilih di form tetap datang dari dropdown master yang
sudah ada, jadi tidak ada yang hilang secara fungsional — yang hilang hanya kemampuan
*menciptakan* nilai master baru, yang memang tidak diinginkan.

Selagi di sana: tambahkan penanganan error pada `.then()` di keempat fungsi itu. Kegagalan tulis
yang tidak pernah dilaporkan adalah persis bagaimana bug seperti ini lolos ke produksi tanpa
disadari.

### 8.5 Halaman User Management

Komponen baru di `src/components/settings/`:

| File | Isi |
|---|---|
| `UserManagementTab.tsx` | header + tombol "Add User" + `UserTable` |
| `UserTable.tsx` | Nama, Email, Role (badge), Subsidiary, Status, Dibuat, aksi |
| `AddUserModal.tsx` | form pembuatan akun |

Sumber data tabel:
`supabase.from('profiles').select('*, subsidiary:subsidiaries(name, code)').order('created_at', { ascending: false })`.
Tidak perlu Admin API — RLS `profiles_select` sudah mengizinkan Super Admin membaca semuanya.

**`AddUserModal` — perilaku field:**

| Field | Aturan |
|---|---|
| Nama | wajib |
| Email | wajib, format valid |
| Password sementara | wajib, **minimal 12 karakter**. Sediakan tombol "Generate" + "Copy" — ini satu-satunya kesempatan admin melihat password itu |
| Role | dropdown: Super Admin / Subsidiary Admin |
| Subsidiary | dropdown dari `subsidiaries`. **`disabled` + nilai dikosongkan** saat Role = Super Admin; **wajib** saat Role = Subsidiary Admin |

Perhatikan: mengubah Role ke Super Admin harus **mengosongkan** nilai `subsidiary`, bukan sekadar
men-`disable` field-nya. Field yang disabled tapi masih menyimpan nilai lama akan mengirim
`subsidiary_id` untuk Super Admin dan ditolak `profiles_role_subsidiary_ck` di database.

Alur submit: panggil Edge Function lewat `supabase.functions.invoke('admin-create-user', { body })`
— SDK otomatis melampirkan JWT sesi ke header `Authorization`, yang persis dibutuhkan
[§7.1](#71-edge-function-admin-create-user) langkah 1. Setelah sukses, refetch tabel dan tampilkan
password sementara satu kali dengan tombol salin.

> Ambang 12 karakter dipilih sadar sebagai perbaikan dari yang berlaku di `SecurityTab` hari ini.
> Menyamakan `SecurityTab` ke ambang yang sama masuk akal dikerjakan bersamaan, tapi berada di
> luar cakupan RBAC — catat sebagai pekerjaan terpisah.

### 8.6 Paksa ganti password sementara

`profiles.must_change_password = true` dari akun yang baru dibuat. Setelah login, kalau flag itu
menyala, arahkan ke Settings › Security dan blokir navigasi lain sampai password diganti.
Ubah `handleSaveSecurity` di `src/pages/Settings.tsx` agar ikut menge-set flag itu menjadi `false`
setelah `updateUser` berhasil.

---

## 9. Yang **tidak** dikerjakan rencana ini

Supaya jelas batasnya:

- **Role ketiga** (viewer / read-only, approver). Enum `app_role` gampang ditambah, tapi tiap role
  baru berarti satu dimensi baru di setiap policy. Dua role dulu.
- **Satu user, banyak anak usaha.** `profiles.subsidiary_id` tunggal. Kalau nanti dibutuhkan,
  bentuknya tabel `profile_subsidiaries` dan policy berubah dari `=` menjadi `IN (select …)` —
  perubahan mekanis, tapi menyentuh setiap policy sekaligus.
- **Audit log untuk aksi user management.** `activity_logs` sudah ada dan pola `logActivity()`
  sudah mapan — mencatat `CREATE_USER` / `DEACTIVATE_USER` layak dikerjakan, tapi setelah alur
  utamanya jalan.
- **MFA dan rate limiting di login.** Keduanya tercatat sebagai temuan terbuka dan tidak berubah
  oleh RBAC — akun yang berhasil di-brute-force tetap memberi akses penuh sesuai role-nya.
  Terpisah, dan tetap perlu.

---

## 10. Urutan eksekusi

| Fase | Isi | Bisa di-rollback? | Aplikasi terpengaruh? |
|---|---|---|---|
| **1** | [§4](#4-migrasi--fase-1-struktur-belum-mengunci-apa-pun) — kolom, tabel `profiles`, backfill, trigger sinkronisasi | ya, drop kolom | tidak — semua aditif |
| **2** | [§5](#5-migrasi--fase-2-helper--rls-pada-profiles) — helper + RLS `profiles` | ya | tidak |
| **3** | [§8.1](#81-tipe--authcontext), [§8.5](#85-halaman-user-management) — AuthContext + User Management; **role belum menegakkan apa-apa** | ya | tambahan saja |
| **4** | [§7.3](#73-backend-ai-cloud-run--wajib-forward-jwt) — JWT forwarding AI **(sebelum Fase 5, bukan sesudah)** | ya | tidak, JWT masih setara anon |
| **5** | [§6](#6-migrasi--fase-5-rls-pada-tabel-data) — **RLS ketat. Titik tanpa balik.** | sulit — lihat §12 | **ya, semuanya** |
| **6** | [§8.2](#82-mengunci-dropdown-dashboard)–[§8.4](#84-assetcontext--jangan-upsert-master-data-kalau-bukan-super-admin), [§8.6](#86-paksa-ganti-password-sementara) — kunci UI | ya | kosmetik |

Fase 4 mendahului Fase 5 dengan sengaja: memforward JWT saat policy masih `USING (true)` tidak
mengubah perilaku apa pun, jadi bisa dites tenang. Membalik urutannya berarti AI Assistant mati
di antara dua deploy.

Sebelum Fase 5, **verifikasi keempatnya**:

```sql
select count(*) from public.assets                  where subsidiary_id is null;  -- harus 0
select count(*) from public.asset_reclassifications where subsidiary_id is null;  -- harus 0
select count(*) from public.profiles
 where role = 'super_admin' and status = 'active';                                -- harus >= 1

-- tidak boleh ada policy TO public yang tersisa
select tablename, policyname, roles::text from pg_policies
 where schemaname = 'public' and 'public' = any(roles);                           -- harus kosong
```

Kalau salah satu meleset, Fase 5 akan menyembunyikan data dari pemiliknya, mengunci semua orang
keluar dari User Management, atau — untuk query keempat — **terlihat berhasil padahal tidak
mengunci apa pun**.

Dua yang pertama sudah bernilai 0 per 2026-09-07; yang perlu dicek adalah apakah masih 0 saat
eksekusi.

---

## 11. Rencana pengujian

Buat dua akun uji: `super@test` (Super Admin) dan `ape@test` (Subsidiary Admin → APE).

**Isolasi database** — jalankan dari SQL editor dengan menyamar sebagai user, bukan lewat UI.
Menguji lewat UI hanya membuktikan UI-nya menyembunyikan sesuatu, bukan bahwa database menolak:

```sql
set local role authenticated;
set local request.jwt.claims = '{"sub":"<uuid-ape@test>","role":"authenticated"}';

select count(*) from public.assets;                            -- harus 330, bukan 2881
select count(*) from public.assets where subsidiary <> 'APE';  -- 0

-- pindahkan aset APE ke EHK: harus 0 baris terpengaruh
update public.assets set subsidiary = 'EHK' where subsidiary = 'APE';

-- selipkan aset untuk EHK: harus gagal
insert into public.assets (asset_number, asset_description, subsidiary)
values ('X', 'X', 'EHK');

-- naikkan role diri sendiri: harus gagal dengan 42501
update public.profiles set role = 'super_admin' where id = '<uuid-ape@test>';

reset role;
```

**Uji akses anon** — ini yang membuktikan [§0](#0-temuan-database-produksi) benar-benar tertutup.
Jalankan dari terminal **tanpa login**, pakai anon key dari `.env`:

```bash
curl "https://kuvuylohuhuyjpzbkitp.supabase.co/rest/v1/assets?select=id&limit=5" \
  -H "apikey: $VITE_SUPABASE_ANON_KEY"
```

| Kapan | Hasil |
|---|---|
| **Sebelum** Fase 5 | 5 baris — inilah lubangnya |
| **Sesudah** Fase 5 | `[]` (array kosong) |

Ulangi untuk `subsidiaries`, `category_segments_1`, `category_segments_2`,
`maintenance_records` — kelima tabel itu yang punya policy `TO public`.

**Perilaku aplikasi:**

| Skenario | Hasil yang benar |
|---|---|
| `ape@test` buka Dashboard | dropdown terkunci "APE"; KPI menunjukkan 330 aset, bukan 2.881 |
| `ape@test` ketik `?subsidiary=EHK` di URL Dashboard | tidak berubah; tetap APE |
| `ape@test` buka Settings | tidak ada tab User Management |
| `ape@test` buka `/master-data` langsung | dialihkan / ditolak |
| `ape@test` tambah aset baru | berhasil, subsidiary terkunci APE, **tidak ada error senyap** dari upsert master data |
| `ape@test` tanya AI "berapa total aset semua anak usaha?" | jawabannya hanya mencakup APE |
| `ape@test` buka Reclassification | baris yatim (aset sumbernya dihapus) milik APE **tetap terlihat** |
| `super@test` buka Dashboard | dropdown aktif, semua anak usaha |
| Super Admin menonaktifkan `ape@test`, lalu `ape@test` refresh | aplikasi kosong / ditolak login |
| Super Admin mencoba menonaktifkan dirinya sendiri | ditolak |

Baris "baris yatim tetap terlihat" adalah alasan [§6.2](#62-asset_reclassifications) memberi
`asset_reclassifications` kolomnya sendiri alih-alih menempel pada join ke `assets`. Kalau tes ini
gagal, fitur deteksi aset terhapus dari commit `a15a555` menjadi tidak berguna bagi Subsidiary
Admin.

---

## 12. Rollback

Fase 1–4 aman: drop kolom, drop tabel, revert commit.

Fase 5 tidak. Setelah policy lama dihapus, tidak ada catatan definisi aslinya di repo — policy
`assets` tidak pernah masuk `supabase/migrations/`. Definisi lengkapnya sekarang tercatat di
[Lampiran A](#lampiran-a--kondisi-terverifikasi-2026-09-07), jadi rollback ke kondisi semula
mungkin dilakukan.

Meski begitu, **rollback ke `"allow all" TO public` sebaiknya tidak pernah dipilih** — itu
mengembalikan lubang di [§0](#0-temuan-database-produksi). Kalau Fase 5 harus dibatalkan, mundur
ke `TO authenticated using (true)` (setara perilaku sebelum RBAC untuk user yang login, tanpa
membuka akses anon), bukan ke policy aslinya.

Pintu darurat kalau ada yang terkunci keluar di produksi — kembalikan akses baca sambil
mendiagnosis, tanpa mematikan RLS:

```sql
create policy assets_emergency_read on public.assets
  for select to authenticated using (true);
-- setelah beres: drop policy assets_emergency_read on public.assets;
```

Ini lebih baik daripada `alter table public.assets disable row level security`, yang mematikan
guard INSERT/UPDATE/DELETE sekaligus dan gampang lupa dinyalakan lagi.

---

## Lampiran A — Kondisi terverifikasi (2026-09-07)

Diambil langsung dari project `kuvuylohuhuyjpzbkitp` lewat Supabase MCP. Semua angka dan nama di
rencana ini bersumber dari sini, bukan dari pembacaan kode.

**Volume data**

| Tabel | Baris | RLS | Policy lama |
|---|---|---|---|
| `assets` | 2.881 | aktif | `"allow all"` ALL **TO public** |
| `asset_reclassifications` | 2.881 | aktif | 4 policy TO authenticated |
| `activity_logs` | 696 | aktif | SELECT `true` TO authenticated |
| `category_segments_2` | 181 | aktif | `"allow all"` ALL **TO public** |
| `subsidiaries` | 10 | aktif | `"allow all"` ALL **TO public** |
| `category_segments_1` | 9 | aktif | `"allow all"` ALL **TO public** |
| `item_statuses` | 3 | aktif | 4 policy TO authenticated |
| `report_history` | 2 | aktif | 3 policy TO authenticated |
| `notification_reads` | 1 | aktif | 3 policy own-row |
| `maintenance_records` | **0** | aktif | `"allow all"` ALL **TO public** |

**Anak usaha dan sebaran aset**

| Nama | Aset | | Nama | Aset |
|---|---:|---|---|---:|
| EHK | 1.370 | | HEMA | 86 |
| TIP | 681 | | REC | 39 |
| APE | 330 | | PPN | 36 |
| TCM | 189 | | PDPDE | 18 |
| MUI | 132 | | KMJ | 0 |

**Kesiapan migrasi**

| Pemeriksaan | Hasil | Artinya |
|---|---|---|
| Aset dengan `subsidiary` tak cocok tabel master | 0 | backfill `subsidiary_id` bersih 100% |
| Aset dengan `subsidiary` kosong/null | 0 | tidak ada baris yatim |
| Selisih cocok-persis vs cocok-setelah-`trim()` | 0 | tidak ada masalah spasi/kapitalisasi |
| Reclassification dengan `asset_id` null | 0 | backfill lewat join bersih 100% |
| Reclassification dengan `asset_deleted_at` terisi | 0 | belum ada aset terhapus |
| User di `auth.users` | **1** | `admin@rajaproject.com` (meta `name` = "kacang") |
| Tabel `profiles` / enum `app_role` | belum ada | greenfield, tidak ada konflik |
| Pemakaian service_role di repo | tidak ada | Edge Function benar-benar komponen baru |

**Struktur yang sudah memenuhi kebutuhan RBAC**

- `subsidiaries` = `id uuid primary key default gen_random_uuid()` + `name text unique` →
  target FK sudah siap, tidak perlu DDL ([§4.1](#41-tabel-subsidiaries--tidak-perlu-diubah)).
- `category_segments_1` / `_2` juga `id` + `name unique`. `item_statuses` hanya `name` (PK).
- Event trigger `ensure_rls` → `public.rls_auto_enable()` menyalakan RLS otomatis di setiap tabel
  baru skema `public`; tidak membuat policy ([§4.2](#42-enum-role--tabel-profiles)).

**Temuan Security Advisor yang belum ditangani**

| Temuan | Objek |
|---|---|
| `function_search_path_mutable` | `snapshot_reclassification_before_asset_delete`, `set_assets_updated_at`, `sync_category_from_asset_item_status`, `sync_asset_verification_from_category`, `sync_category_from_asset_verification` |
| SECURITY DEFINER bisa dipanggil `anon` | `purge_old_activity_logs()`, `rls_auto_enable()` |
| Leaked password protection mati | Auth settings |
