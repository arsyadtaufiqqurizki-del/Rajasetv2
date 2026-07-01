# Notification Upgrade — Shared Activity Log

## Overview

Mengubah tombol bell (saat ini placeholder) menjadi sistem **Activity Log bersama** berbasis Supabase. Setiap aksi user (import CSV, tambah aset, hapus, dll) tercatat dan bisa dilihat semua user secara real-time.

---

## Database

### Tabel 1: `activity_logs`

```sql
CREATE TABLE activity_logs (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_name   TEXT NOT NULL,
  action_type TEXT NOT NULL,
  entity_type TEXT,         -- 'asset' | 'maintenance' | 'system'
  entity_id   UUID,         -- ID aset/maintenance terkait (nullable)
  details     JSONB,        -- data tambahan (lihat contoh di bawah)
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Index untuk query terbaru
CREATE INDEX idx_activity_logs_created_at ON activity_logs(created_at DESC);
```

### Tabel 2: `notification_reads`

```sql
CREATE TABLE notification_reads (
  user_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  last_read_at TIMESTAMPTZ DEFAULT NOW()
);
```

Badge count = jumlah baris `activity_logs` dengan `created_at > last_read_at` milik user.

---

## Action Types

| action_type | Trigger | Contoh `details` |
|---|---|---|
| `IMPORT_CSV` | User selesai import CSV di Inventory | `{ total: 145, success: 142, failed: 3 }` |
| `ADD_ASSET` | User tambah 1 aset baru | `{ assetName: "Kompresor GA-30", category: "Mesin" }` |
| `UPDATE_ASSET` | User edit data aset | `{ assetName: "Forklift 2", field: "status", from: "Aktif", to: "Rusak" }` |
| `DELETE_ASSET` | User hapus 1 aset | `{ assetName: "Generator 5KVA" }` |
| `BULK_DELETE` | User hapus massal | `{ count: 50, subsidiary: "Subsidiary B" }` |
| `ADD_MAINTENANCE` | User tambah jadwal maintenance | `{ assetName: "Mesin Bubut", scheduledDate: "2026-07-10" }` |
| `UPDATE_MAINTENANCE` | User ubah status maintenance | `{ assetName: "Kompresor", from: "Pending", to: "Completed" }` |
| `MAINTENANCE_OVERDUE` | Otomatis — query saat panel dibuka | `{ count: 3, assets: ["Forklift 2", "Mesin Bubut", "Generator"] }` |

---

## Arsitektur Komponen

```
Layout.tsx
└── NotificationBell.tsx        ← komponen baru (bell icon + badge + panel)
    ├── useActivityLog.ts        ← hook: fetch logs + Supabase Realtime subscription
    └── ActivityLogPanel.tsx     ← dropdown panel berisi daftar log

lib/
└── activityLogger.ts           ← fungsi helper: logActivity(action, details)
```

### `activityLogger.ts` — helper utama

```ts
// Dipanggil di mana saja saat aksi terjadi
logActivity({
  actionType: 'IMPORT_CSV',
  entityType: 'asset',
  details: { total: 145, success: 142, failed: 3 }
})
```

Helper ini otomatis mengambil `user_id` dan `user_name` dari Supabase auth session.

---

## UI Panel

```
┌──────────────────────────────────────────┐
│  Aktivitas Terbaru           [Tandai Dibaca] │
├──────────────────────────────────────────┤
│ 📥  Budi mengimpor 142 aset              │
│     3 baris gagal divalidasi             │
│     5 menit lalu                    🔵  │  ← belum dibaca
├──────────────────────────────────────────┤
│ ➕  Siti menambahkan aset baru           │
│     Kompresor Atlas Copco GA-30          │
│     1 jam lalu                           │
├──────────────────────────────────────────┤
│ 🗑️  Admin menghapus 50 aset             │
│     Bulk delete dari Subsidiary B        │
│     3 jam lalu                           │
├──────────────────────────────────────────┤
│ 🔴  3 maintenance overdue               │
│     Forklift 2, Mesin Bubut, +1          │
│     Hari ini                             │
└──────────────────────────────────────────┘
```

**Bell badge:** Angka merah = log baru sejak user terakhir buka panel.
**Real-time:** Supabase Realtime subscription — badge update otomatis saat user lain melakukan aksi.

---

## Rencana Implementasi (Bertahap)

### Fase 1 — Database & Helper (fondasi) ✅
- [x] Buat tabel `activity_logs` di Supabase
- [x] Buat tabel `notification_reads` di Supabase
- [x] Buat `src/lib/activityLogger.ts`

### Fase 2 — Komponen Bell ✅
- [x] Buat `src/components/NotificationBell.tsx`
- [x] Buat `src/hooks/useActivityLog.ts` dengan Supabase Realtime
- [x] Ganti button bell placeholder di `Layout.tsx` dengan komponen baru

### Fase 3 — Inject Log ke Fitur yang Ada ✅
- [x] Import CSV (`Inventory.tsx`) → log `IMPORT_CSV`
- [x] Tambah aset → log `ADD_ASSET`
- [x] Hapus aset / bulk delete → log `DELETE_ASSET` / `BULK_DELETE`
- [x] Tambah/update maintenance (`Maintenance.tsx`) → log `ADD_MAINTENANCE` / `UPDATE_MAINTENANCE`

### Fase 4 — Auto Notifikasi Sistem ✅
- [x] Query maintenance overdue saat panel dibuka → tampil sebagai notif sistem
- [x] Query aset rusak > 10% → tampil sebagai notif sistem

---

## Catatan

- **Auth**: Login sudah menggunakan Supabase Auth (`supabase.auth.signInWithPassword`). `user_id` dan email user bisa diambil langsung dari session — Fase 3 bisa langsung dijalankan.
- **RLS**: Tabel `activity_logs` perlu Row Level Security — semua authenticated user bisa `SELECT`, tapi hanya `INSERT` milik sendiri.
- **Retention**: Pertimbangkan hapus log > 90 hari agar tabel tidak membengkak.
