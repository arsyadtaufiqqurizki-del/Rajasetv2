# Maintenance UI/UX Upgrade — Implementation Plan

> **Status**: Phase 1 done (2026-09-12) — Phase 2 & 3 pending  
> **Date**: 2026-09-12  
> **Scope**: Full redesign of `src/pages/Maintenance.tsx` and all Maintenance-specific components  
> **Reference**: `src/pages/Inventory.tsx` (patterns, hooks, components to mirror)  
> **Rollout**: 3 phases  
> **Grilling session**: Completed — decisions documented in §1

---

## Table of Contents

1. [Grilling Decisions Summary](#1-grilling-decisions-summary)
2. [Current State Assessment](#2-current-state-assessment)
3. [Target Architecture](#3-target-architecture)
4. [Design Principles](#4-design-principles)
5. [Phase 1 — Visual Refresh & Table UX](#5-phase-1--visual-refresh--table-ux)
6. [Phase 2 — Workflow Efficiency](#6-phase-2--workflow-efficiency)
7. [Phase 3 — Advanced Features](#7-phase-3--advanced-features)
8. [Component Inventory (New & Modified)](#8-component-inventory-new--modified)
9. [File-by-File Breakdown](#9-file-by-file-breakdown)
10. [Database & Migration Considerations](#10-database--migration-considerations)
11. [i18n Updates](#11-i18n-updates)
12. [Risk Assessment](#12-risk-assessment)
13. [Verification Checklist](#13-verification-checklist)

---

## 1. Grilling Decisions Summary

| Question | Decision |
|---|---|
| **Primary goals** | Visual refresh + Workflow efficiency + Data density & navigation + Schedule & calendar UX |
| **Design reference** | `Inventory.tsx` (consistency within app) |
| **Scope** | Full redesign |
| **Layout** | Multi-view switcher: Table view | Timeline view | Calendar view |
| **Timeline shape** | Best judgment (→ horizontal bar timeline, see §3.3) |
| **Phasing** | 3-phase rollout |
| **Auto-overdue** | **Dropped** — manual status change only |
| **Inline status change** | Click status badge → dropdown with 4 options, save directly to Supabase |
| **Cost analytics chart** | Mini sparkline chart embedded in one of the 4 stat cards |
| **Keyboard shortcuts** | Basic row navigation (arrows, Enter, Delete, Esc) |
| **Row detail** | Inline expand (asset info + cost breakdown + variance + service history for same asset) |
| **Features (all selected)** | Column toggle & sorting, row expansion, inline status change, bulk operations, CSV import/export, timeline/Gantt view, cost analytics chart, skeleton loading & empty states, keyboard shortcuts |
| **Mobile/responsive** | Not prioritized — desktop-first remains |

---

## 2. Current State Assessment

### 2.1 What exists today

| Component | File | Status |
|---|---|---|
| `Maintenance.tsx` | `src/pages/Maintenance.tsx` (206 lines) | Page shell — 4 stat cards + 8/4 grid (table + schedule panel) |
| `MaintenanceStats.tsx` | `src/components/MaintenanceStats.tsx` | 4 `StatCard`s: Active, Overdue, Total Cost (YTD), Upcoming |
| `MaintenanceTable.tsx` | `src/components/MaintenanceTable.tsx` (93 lines) | 12-column hard-coded table, no sorting, no column toggle, no row expansion |
| `MaintenanceSchedulePanel.tsx` | `src/components/MaintenanceSchedulePanel.tsx` (61 lines) | Right sidebar: list of upcoming records (this week) + "View Full Calendar" button |
| `MaintenanceCalendarModal.tsx` | `src/components/MaintenanceCalendarModal.tsx` (264 lines) | Month grid modal, status dots, click day → list of records with pagination |
| `AddMaintenanceModal.tsx` | `src/components/AddMaintenanceModal.tsx` (154 lines) | Form: asset picker + 5 fields (date, service type, status, estimate, actual) |
| `EditMaintenanceModal.tsx` | `src/components/EditMaintenanceModal.tsx` (122 lines) | Same 5 fields, asset identity read-only |
| `useMaintenanceFilters.ts` | `src/hooks/useMaintenanceFilters.ts` | Multi-select filters (subsidiary, asset book, status) + URL persistence + search |
| `MaintenanceContext.tsx` | `src/contexts/MaintenanceContext.tsx` (138 lines) | CRUD: `addRecord`, `updateRecord`, `deleteRecord`. No bulk operations. No `deleteMultiple`/`deleteAll`. No `bulkUpdate`. |

### 2.2 Gaps vs. Inventory.tsx (parity target)

| Feature | Inventory | Maintenance |
|---|---|---|
| Column definitions array | `ASSET_COLUMNS` (column toggle) | **Missing** — table is hard-coded |
| Column visibility toggle | `useColumnVisibility` + `ColumnVisibilityDropdown` | **Missing** |
| Sorting | `sortKey`/`sortDirection`/`toggleSort`/`sortableColumns` | **Missing** |
| Row selection (checkbox) | `useRowSelection` | **Missing** |
| Bulk delete | `useBulkDelete` + `DeleteConfirmModal` + `DeleteProgressModal` | **Missing** |
| Bulk edit | `BulkEditModal` + `BulkEditProgressModal` | **Missing** |
| CSV import/export | `Papa.parse` + `buildExportRows`/`mapCsvRowToAssetInput` | **Missing** |
| Skeleton loading | `InventorySkeleton` | **Missing** — no loading state shown |
| Detail panel | `AssetDetailPanel` (side drawer) | **Missing** — no row expansion |
| Page size config | `usePagination({ storageKey, pageSizeOptions })` | **Missing** — fixed 10/page, no localStorage |
| Import progress modal | `ImportProgressModal` | **Missing** |
| Notice toast | Success/error auto-dismiss toast | **Missing** — only error toast for delete |
| Filtered totals summary | `filteredTotals` (count, units, cost, bookValue) | **Missing** |
| `loading` from context | `loading: boolean` | **Missing** — `MaintenanceContext` has `loading` but `Maintenance.tsx` doesn't use it |

### 2.3 Table column inventory (current — all 12 always visible)

| # | Column | Sortable? | Notes |
|---|---|---|---|
| 1 | Action (edit/delete buttons) | — | Always first, not toggleable |
| 2 | Asset Book | No | |
| 3 | Subsidiaries | No | |
| 4 | Asset Number | No | Font-mono, colored by overdue status |
| 5 | Asset Description | No | |
| 6 | Asset Units | No | |
| 7 | Service Type | No | |
| 8 | Asset Class | No | `assetCategorySegment1` |
| 9 | Location | No | `assetCategorySegment2` |
| 10 | Estimate Cost | No | Font-mono |
| 11 | Actual Cost | No | Font-mono |
| 12 | Status | No | Badge with dot |

**Problem**: 12 columns at default zoom on 1080p overflows — table requires horizontal scroll. Users can't hide columns they don't need.

---

## 3. Target Architecture

### 3.1 Page Layout — Multi-View Switcher

```
┌─────────────────────────────────────────────────────────────┐
│  Header: "Maintenance Overview"          [Add Record] btn   │
│                                                             │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌───────┐│
│  │ Active       │ │ Overdue     │ │ Total Cost  │ │Upcoming││
│  │ ┌─────────┐  │ │             │ │ + sparkline  │ │       ││
│  │ │ chart   │  │ │             │ │ (6 months)   │ │       ││
│  └─────────────┘ └─────────────┘ └─────────────┘ └───────┘│
│                                                             │
│  ┌─ Toolbar ──────────────────────────────────────────────┐│
│  │ [Table] [Timeline] [Calendar]  ← view switcher          ││
│  │ [search] [subsidiary▾] [book▾] [status▾] [chips...]     ││
│  │ [columns▾] [export CSV] [import CSV]  [bulk: delete]    ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
│  ┌─ Active view content ───────────────────────────────────┐│
│  │                                                         ││
│  │  TABLE VIEW:    sortable, toggleable table + inline     ││
│  │                 expand rows                             ││
│  │                                                         ││
│  │  TIMELINE VIEW: horizontal bar timeline                 ││
│  │                                                         ││
│  │  CALENDAR VIEW: full month grid inline (not modal)      ││
│  │                 + side panel for selected day            ││
│  │                                                         ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
│  ┌─ Pagination + page-size selector ───────────────────────┐│
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

**Key decisions**:
- The old 8/4 grid is **removed** — table goes full-width. Schedule panel & calendar are **absorbed** into the Calendar view tab.
- View switcher is a segmented control (3 buttons: Table / Timeline / Calendar).
- View state persisted in URL (`?view=table|timeline|calendar`) for shareable links.
- Stats cards remain 4 across the top, but the "Total Cost" card gains a mini sparkline.

### 3.2 View Details

#### Table View (default)
- Full-width table with column toggle, sorting, checkbox selection
- Action column: edit + delete buttons (compact icon-only)
- Status column: **click badge → inline dropdown** to change status without opening edit modal
- Row click (anywhere except action/checkbox/status): **inline expand** → detail panel below the row
- Expanded content: asset identity info, cost breakdown (estimate vs actual + variance), service history for same asset (other maintenance records)

#### Timeline View
- Horizontal bar chart, one bar per record
- X-axis: time (default = current month ± 1 month, navigable like calendar)
- Y-axis: stacked by asset or service type (grouped)
- Bar start = `scheduledDate`, bar length = fixed 1 day (or proportional to estimated duration if we add an `estimatedDuration` field — **not in scope**, so 1 day)
- Color = status (same palette as badges)
- Hover → tooltip with asset description, service type, cost
- Click bar → same inline expand as table view (detail panel slides down)

#### Calendar View
- Same month-grid layout as current `MaintenanceCalendarModal`, but **inline in the page** (not a modal)
- Left: month grid (42 cells, status dots), right: selected day's records list
- Month navigation (prev/next/today) at top
- Click record in day list → opens edit modal

### 3.3 Timeline View — Design Rationale

Since the user chose "bebas / best judgment", here's the rationale for **horizontal bar timeline**:

| Option | Pros | Cons | Verdict |
|---|---|---|---|
| Horizontal bar (Gantt-like) | Familiar to maintenance managers, shows duration + overlap, natural for scheduling | Needs horizontal scroll for dense data | **Chosen** |
| Vertical feed (commit-graph) | Good for chronological reading, compact | Doesn't show duration/overlap well | Rejected |

**Bar design**: Each record = one horizontal bar. Width represents the scheduled date ± 1 day. Color follows status palette. Grouped by asset (collapsible groups) or flat list (toggle). Tooltip on hover. Click → detail panel.

---

## 4. Design Principles

1. **Mirror Inventory patterns** — same column-def array shape, same hooks (`useColumnVisibility`, `useRowSelection`, `useBulkDelete`, `usePagination` with `storageKey`), same skeleton pattern, same CSV import/export flow.
2. **No comments in code** (repo convention).
3. **Functional components + hooks only**.
4. **Export default** for all new page/component files.
5. **Tailwind CSS v4** — use existing theme tokens (`surface-*`, `on-surface-*`, `outline-*`, `primary`, `secondary`, `error`).
6. **motion (framer-motion)** for expand/collapse animations and view transitions.
7. **lucide-react** for all icons.
8. **No new dependencies** — everything achievable with existing `recharts`, `motion`, `papaparse`, `clsx`, `tailwind-merge`.

---

## 5. Phase 1 — Visual Refresh & Table UX

**Goal**: Bring Maintenance table to feature parity with Inventory, add skeleton loading, upgrade stat cards, and introduce the multi-view switcher shell.

### 5.1 Skeleton Loading

**New file**: `src/components/MaintenanceSkeleton.tsx`

Mirrors `InventorySkeleton.tsx` pattern:
- `aria-busy="true"`, `aria-live="polite"`
- 4 skeleton stat cards
- Skeleton toolbar (filter bar)
- 10 skeleton table rows

**Modified**: `Maintenance.tsx`
- Import `MaintenanceSkeleton`
- Show skeleton when `loading` from `useMaintenance()` is `true`
- Currently `MaintenanceContext` exposes `loading` but `Maintenance.tsx` doesn't use it — wire it up

### 5.2 Column Definitions Array

**New file**: `src/components/MaintenanceTable.tsx` (full rewrite — see §5.2.1)

Define a `MaintenanceColumnDef` interface and `MAINTENANCE_COLUMNS` array, exactly parallel to `AssetColumnDef` / `ASSET_COLUMNS` in `AssetTable.tsx`:

```typescript
export interface MaintenanceColumnDef {
  id: string;
  label: string;
  sortable: boolean;
  headerClassName?: string;
  cellClassName?: string | ((record: MaintenanceRecord) => string);
  render: (record: MaintenanceRecord) => ReactNode;
}
```

Proposed columns (default visible = 8 of 12):

| id | label | Sortable | Default Visible | Notes |
|---|---|---|---|---|
| `assetNumber` | Asset Number | Yes | Yes | Font-mono, colored red if overdue |
| `assetDescription` | Asset Description | Yes | Yes | Truncate + tooltip |
| `subsidiary` | Subsidiaries | Yes | Yes | |
| `serviceType` | Service Type | Yes | Yes | |
| `scheduledDate` | Scheduled Date | Yes | Yes | `formatDateDMY` |
| `estimateCost` | Estimate Cost | Yes (numeric) | No | Font-mono |
| `actualCost` | Actual Cost | Yes (numeric) | Yes | Font-mono |
| `status` | Status | Yes | Yes | Badge — becomes inline dropdown in Phase 2 |
| `assetBook` | Asset Book | Yes | No | |
| `assetUnits` | Asset Units | No | No | |
| `assetCategorySegment1` | Asset Class | Yes | No | |
| `assetCategorySegment2` | Location | Yes | No | |

Plus a non-toggleable leading **selection** column (checkbox) and trailing **action** column (edit/delete).

`DEFAULT_VISIBLE_COLUMNS` = the 8 "Yes" entries above.

### 5.3 Column Visibility Toggle

**Reuse**: `useColumnVisibility` hook (`src/hooks/useColumnVisibility.ts`)  
**Reuse**: `ColumnVisibilityDropdown` component (`src/components/ColumnVisibilityDropdown.tsx`)

```typescript
const { visibleColumns, toggleColumn, showAll } = useColumnVisibility(
  'rajaset:maintenance:columns',
  DEFAULT_VISIBLE_COLUMNS
);
```

No new code needed — just wire existing hook + component into the Maintenance toolbar.

### 5.4 Sorting

**Extend** `useMaintenanceFilters.ts` to add sorting (mirror `useAssetFilters`):
- `sortKey: string | null`
- `sortDirection: 'asc' | 'desc' | null`
- `toggleSort(key: string): void`
- `sortableColumns: string[]` — list of column ids that are sortable (see table above)

Sorting logic: numeric columns sort by parsed number; date columns by `Date.parse`; string columns by `localeCompare`. The `filteredRecords` output already applies sort before pagination.

**Modified**: `MaintenanceTable.tsx` — header cells for sortable columns get `onClick` + sort indicator icon (`ArrowUp`/`ArrowDown`/`ArrowUpDown` from lucide-react, same as `AssetTable.tsx`).

### 5.5 Stat Card Visual Upgrade

**Modified**: `MaintenanceStats.tsx`

Changes:
- Wrap each card in `motion.div` with `layout` for smooth reflow when value changes
- "Total Cost (YTD)" card gets a mini **sparkline** (recharts `<LineChart>` 50px tall, 6-month monthly cost trend)
  - Data: group all `maintenance_records` by month (based on `scheduledDate`), sum `actualCost || estimateCost` per month, last 6 months
  - Computed in `MaintenanceStats` via `useMemo` from `records` prop
  - If <2 data points, show footer text instead (no sparkline)
- Add subtle `border-l-4` accent color per card type (active=primary, overdue=error, cost=secondary, upcoming=primary-variant)
- Footer text improvements: show delta vs last period when available (e.g., "+2 vs last week")

**Modified**: `StatCard.tsx` — add optional `chart?: ReactNode` prop rendered below value, before footer. When `chart` is set, value font-size drops from `text-4xl` to `text-2xl` to make room.

### 5.6 Empty States

**New file**: `src/components/MaintenanceEmptyState.tsx`

Two variants (reuse `EmptyState` ui component patterns):
1. **No data at all**: Illustration (lucide `Wrench` icon large), "No maintenance records yet", CTA button "Add First Record"
2. **No filtered results**: "No records match your filters", CTA "Clear Filters"

### 5.7 View Switcher Shell

**New file**: `src/components/MaintenanceViewSwitcher.tsx`

Segmented control with 3 options:
- Table (icon: `Table`)
- Timeline (icon: `GanttChart` or `BarChart3`)
- Calendar (icon: `Calendar`)

Props: `activeView`, `onViewChange`, `counts` (optional badge: record count per view)

URL persistence: `?view=table|timeline|calendar` via `searchParams`.

In Phase 1, only "Table" is functional. Timeline and Calendar buttons are present but disabled with a tooltip "Coming in Phase 3" — OR they navigate to a placeholder. **Decision**: Render Timeline & Calendar as active tabs but show a "Coming soon" placeholder for Timeline; Calendar tab renders the full-month grid inline (absorbing `MaintenanceCalendarModal` logic into a page component).

**Revised**: To maximize Phase 1 value, Calendar view is **included in Phase 1** (it already exists as a modal — just inline it). Timeline is the Phase 3 feature.

### 5.8 Calendar View Inline (from existing modal)

**New file**: `src/components/MaintenanceCalendarView.tsx`

Extract the calendar grid logic from `MaintenanceCalendarModal.tsx` into a page-level component (not a modal). Layout:
- Left 60%: month grid (same 42-cell layout, status dots, prev/next/today)
- Right 40%: selected day's records list (same as modal's bottom section)

`MaintenanceCalendarModal.tsx` is **kept** for backward compatibility but the "View Full Calendar" button in the old schedule panel is removed (replaced by the Calendar tab).

### 5.9 Pagination Upgrade

**Modified**: `Maintenance.tsx`

Wire up `usePagination` with `storageKey` and `pageSizeOptions`:
```typescript
const pagination = usePagination({
  storageKey: 'rajaset:maintenance:pageSize',
  pageSizeOptions: [10, 25, 50, 100],
});
```

This enables the page-size selector in the `Pagination` component (already supports it via props).

### 5.10 Notice Toast (success + error)

**Modified**: `Maintenance.tsx`

Replace the error-only `Toast` with a dual `notice` state (matching Inventory's pattern):
```typescript
const [notice, setNotice] = useState<{ message: string; variant: 'success' | 'error' } | null>(null);
```
Auto-dismiss: 3s for success, 5s for error.

Wire to: successful add, edit, delete, CSV import/export, bulk operations.

### 5.11 Layout Restructure

**Modified**: `Maintenance.tsx` — full rewrite of the return JSX:

```
<div className="flex flex-col gap-6 w-full">
  {modals (add, edit, confirm delete)}

  {/* Header */}
  <header: title + Add button>

  {/* Stats */}
  <MaintenanceStats ... />

  {/* Main panel — full width */}
  <div className="rounded-xl border border-outline-variant bg-surface-container-lowest shadow-sm flex flex-col overflow-hidden">
    {/* Toolbar */}
    <div className="p-4 border-b ...">
      <MaintenanceViewSwitcher ... />
      <FilterBar ... >
        <MultiSelectDropdown ... />  x3 (subsidiary, book, status)
      </FilterBar>
      <div className="toolbar-right">
        <ColumnVisibilityDropdown ... />
        <button onClick={exportCSV}>Export</button>
        <button onClick={importCSV}>Import</button>
      </div>
    </div>

    {/* Active view */}
    {view === 'table' && <MaintenanceTable ... />}
    {view === 'calendar' && <MaintenanceCalendarView ... />}
    {view === 'timeline' && <MaintenanceTimelineView ... />}  {/* Phase 3 */}

    {/* Pagination */}
    <Pagination ... />
  </div>
</div>
```

The old `MaintenanceSchedulePanel` (right sidebar) is **removed** — its "upcoming this week" content moves into the Calendar view's day list and the stats card "Upcoming This Week".

### 5.12 Phase 1 Deliverables Checklist

| # | Task | New/Modified | Lines est. |
|---|---|---|---|
| 1 | `MaintenanceSkeleton.tsx` | New | ~30 |
| 2 | `MaintenanceEmptyState.tsx` | New | ~40 |
| 3 | `MaintenanceViewSwitcher.tsx` | New | ~50 |
| 4 | `MaintenanceCalendarView.tsx` (extracted from modal) | New | ~180 |
| 5 | `MaintenanceTable.tsx` (full rewrite with column defs + sorting + selection) | Modified | ~200 |
| 6 | `MaintenanceStats.tsx` (sparkline + visual upgrade) | Modified | ~80 |
| 7 | `StatCard.tsx` (add `chart` prop) | Modified | +5 |
| 8 | `Maintenance.tsx` (layout restructure + skeleton + notice + pagination upgrade) | Modified | ~250 |
| 9 | `useMaintenanceFilters.ts` (add sorting) | Modified | +30 |
| 10 | `MaintenanceContext.tsx` (expose `loading` — already exists, just wire it) | Modified | +2 |

---

## 6. Phase 2 — Workflow Efficiency

**Goal**: Inline status change, bulk operations (delete + bulk status update), row expansion detail panel.

### 6.1 Inline Status Change

**New file**: `src/components/StatusBadgeDropdown.tsx`

A self-contained component that renders the current status badge and, on click, opens a dropdown menu with all 4 status options. On select:
1. Optimistically update the record in local state (via `MaintenanceContext.updateRecord`)
2. Save to Supabase
3. Show success/error notice
4. Log activity (`UPDATE_MAINTENANCE` with `{ from, to }`)

```typescript
interface StatusBadgeDropdownProps {
  recordId: string;
  currentStatus: string;
  onStatusChange: (id: string, newStatus: string) => Promise<void>;
  align?: 'left' | 'right';
}
```

Design:
- Same visual as current status badge (pill with dot)
- On hover: subtle ring/halo to indicate interactivity
- On click: dropdown panel with 4 options (each a mini-badge matching the status color)
- Loading state: badge dims + spinner during save
- Keyboard: Enter to open, arrow keys to navigate, Enter to select, Esc to close

**Modified**: `MaintenanceTable.tsx` — status column `render` uses `<StatusBadgeDropdown>` instead of static badge.

**Modified**: `MaintenanceContext.tsx` — add `updateStatus(id: string, status: string): Promise<void>` as a lightweight single-field update method (avoids sending the whole record). This method:
1. `.update({ status }).eq('id', id).select().single()`
2. Updates local state
3. `logActivity({ actionType: 'UPDATE_MAINTENANCE', ... details: { from, to } })`

### 6.2 Row Selection (Checkbox)

**Reuse**: `useRowSelection` hook (`src/hooks/useRowSelection.ts`)

**Modified**: `MaintenanceTable.tsx`:
- Add leading checkbox column (header = select-all checkbox)
- Each row gets a checkbox
- `onSelectAll(checked)` covers all filtered records (not just current page)
- `onSelectOne(id, checked)` toggles individual

**Modified**: `Maintenance.tsx`:
- `const selection = useRowSelection();`
- Pass `selectedIds` + handlers to table
- Show bulk action bar when `selection.selectedIds.size > 0`

### 6.3 Bulk Action Bar

**New file**: `src/components/MaintenanceBulkBar.tsx`

Sticky bar that appears above the table when rows are selected:
```
[✓] 3 records selected    [Delete Selected] [Mark: Pending ▾] [Clear]
```

Contents:
- Selected count
- "Delete Selected" button → opens `DeleteConfirmModal` (reuse from Inventory)
- "Mark as..." dropdown → bulk status change (Pending / In Progress / Completed / Overdue)
- "Clear" button → deselect all

### 6.4 Bulk Delete

**Modified**: `MaintenanceContext.tsx` — add:
- `deleteMultipleRecords(ids: string[], onProgress?): Promise<void>` — batched delete (100/batch, mirror `AssetContext.deleteMultipleAssets`)
- `deleteAllRecords(onProgress?): Promise<void>` — delete all (with same DELETE-gate pattern as Inventory)

**Reuse**: `useBulkDelete` hook (`src/hooks/useBulkDelete.ts`)  
**Reuse**: `DeleteConfirmModal` (`src/components/DeleteConfirmModal.tsx`)  
**Reuse**: `DeleteProgressModal` (`src/components/DeleteProgressModal.tsx`)

### 6.5 Bulk Status Update

**New file**: `src/components/MaintenanceBulkStatusModal.tsx`

A modal that lets the user pick a target status and applies it to all selected records:
- Uses `FormModal` shell
- Single `<select>` for status
- Preview: "X records will be changed to [status]"
- On confirm: batched update via `MaintenanceContext.bulkUpdateStatus(ids, status, onProgress)`

**New file**: `src/components/BulkUpdateProgressModal.tsx` — progress modal for bulk updates (mirror `BulkEditProgressModal` pattern from Inventory).

**Modified**: `MaintenanceContext.tsx` — add:
- `bulkUpdateStatus(ids: string[], status: string, onProgress?): Promise<void>` — batched update (100/batch)

### 6.6 Row Expansion (Inline Detail)

**New file**: `src/components/MaintenanceRowDetail.tsx`

Expanded content shown below a row when it's clicked (not the action buttons or checkbox):

```
┌─────────────────────────────────────────────────────────────┐
│  Asset Info          │  Cost Breakdown      │  History     │
│  ───────────         │  ──────────────      │  ───────     │
│  Book: XYZ           │  Estimate: $500      │  [3 records  │
│  Subsidiary: Corp    │  Actual:   $450       │   for same   │
│  Class: Equipment    │  Variance: -$50 ✓     │   asset]     │
│  Location: Floor 3   │                      │              │
│  Units: 5            │                      │              │
└─────────────────────────────────────────────────────────────┘
```

Sections:
1. **Asset Identity** — read-only: asset book, subsidiary, category segments, units
2. **Cost Breakdown** — estimate, actual, variance (actual - estimate), colored green (under) / red (over)
3. **Service History** — list of other maintenance records for the same `assetNumber` (query from `records` prop), sorted by date desc. Each item: date, service type, status badge, cost. Click → opens that record's edit modal.

Expansion behavior:
- `motion.div` with `initial={{ height: 0, opacity: 0 }}` → `animate={{ height: 'auto', opacity: 1 }}`
- Chevron icon in the first column (or row click toggles)
- Only one row expanded at a time (clicking another collapses the first) — or multiple? **Decision**: Multiple expanded is fine (like accordion but not exclusive). Actually, for table UX, **one at a time** is cleaner — clicking a new row collapses the previous.
- Expanded state tracked in `MaintenanceTable` via `expandedId: string | null`.

### 6.7 Phase 2 Deliverables Checklist

| # | Task | New/Modified | Lines est. |
|---|---|---|---|
| 1 | `StatusBadgeDropdown.tsx` | New | ~100 |
| 2 | `MaintenanceBulkBar.tsx` | New | ~80 |
| 3 | `MaintenanceBulkStatusModal.tsx` | New | ~100 |
| 4 | `BulkUpdateProgressModal.tsx` | New | ~80 |
| 5 | `MaintenanceRowDetail.tsx` | New | ~150 |
| 6 | `MaintenanceTable.tsx` (checkbox col + expand row + status dropdown) | Modified | ~280 |
| 7 | `Maintenance.tsx` (selection wiring + bulk bar + bulk modals) | Modified | ~350 |
| 8 | `MaintenanceContext.tsx` (`updateStatus`, `deleteMultiple`, `deleteAll`, `bulkUpdateStatus`) | Modified | ~220 |

---

## 7. Phase 3 — Advanced Features

**Goal**: Timeline/Gantt view, CSV import/export, keyboard shortcuts, cost analytics chart (if sparkline not enough — mini chart section).

### 7.1 Timeline / Gantt View

**New file**: `src/components/MaintenanceTimelineView.tsx`

Horizontal bar timeline using **recharts** (already in dependencies):

```
Asset A ████████                              (Pending, 1 day)
Asset B           ████████                    (In Progress)
Asset C                    ████               (Completed)
Asset D                          ████████████ (Overdue, spans 2 days)
         Mon  Tue  Wed  Thu  Fri  Sat  Sun
```

Implementation:
- Use `recharts` `<BarChart>` with `layout="vertical"` (horizontal bars)
- X-axis type = `number` (timestamp), domain = [start of week, end of week]
- Y-axis type = `category` (asset description or service type)
- Each record = one `<Bar>` with `x = scheduledDate.getTime()`, width = 1 day in ms
- `Cell` colored by status (same palette as badges)
- Tooltip: custom component showing asset, service type, status, costs, scheduled date
- Week navigation: prev/next/today (like calendar)
- Click bar → opens edit modal for that record

Grouping toggle:
- By Asset (default): Y-axis = `assetDescription`, records grouped
- By Service Type: Y-axis = `serviceType`
- Flat: Y-axis = record index (1, 2, 3...)

**New hook**: `useTimelineRange(records, viewDate)` — computes the week range, filters records within range, groups by selected dimension.

Responsive: horizontal scroll if many records (set min width = 800px on chart container).

### 7.2 CSV Import/Export

**New file**: `src/lib/maintenanceCsv.ts`

Mirror `src/lib/assetCsv.ts` structure:

```typescript
export const MAX_IMPORT_ROWS = 5000;

export interface MaintenanceCsvRow {
  assetBook?: string;
  subsidiary?: string;
  assetNumber?: string;
  assetDescription?: string;
  assetUnits?: string;
  serviceType?: string;
  assetCategorySegment1?: string;
  assetCategorySegment2?: string;
  estimateCost?: string;
  actualCost?: string;
  status?: string;
  scheduledDate?: string;
}

export function buildExportRows(
  records: MaintenanceRecord[],
  columnIds: string[],
  sanitize: (val: string) => string,
): string[][] { ... }

export function mapCsvRowToMaintenanceInput(
  row: MaintenanceCsvRow,
): { ok: true; input: MaintenanceInput } | { ok: false; error: string } { ... }

export function partitionCsvRows(
  rows: MaintenanceCsvRow[],
): { valid: MaintenanceInput[]; invalid: { row: number; error: string; raw: MaintenanceCsvRow }[] } { ... }
```

Validation rules:
- `assetNumber` + `assetDescription` required
- `serviceType` required
- `status` must be one of: Pending, In Progress, Completed, Overdue (case-insensitive)
- `scheduledDate` must be valid date (or empty → defaults to today)
- `estimateCost` / `actualCost` must be numeric (or empty)
- Max 5000 rows (same as Inventory)

**Modified**: `Maintenance.tsx` — wire CSV import/export buttons:
- Export: scope = all filtered OR selected; columns = visible OR all (same options as Inventory)
- Import: file input → `Papa.parse` → `partitionCsvRows` → insert valid rows via `addRecord(record, skipLog=true)` per row → aggregate `logActivity({ actionType: 'IMPORT_CSV', ... })`
- Reuse `ImportProgressModal` component
- Export uses `sanitizeCell` for CSV injection prevention (currently `Inventory.tsx` export does; `Reclassification.tsx` has its own `sanitizeCsvField` — use the shared `sanitizeCell` from `lib/csv.ts`)

**Modified**: `MaintenanceContext.tsx` — `addRecord` needs `skipLog` parameter (mirror `AssetContext.addAsset(asset, skipLog?)`):
```typescript
addRecord: (record: MaintenanceInput, skipLog?: boolean) => Promise<void>;
```

### 7.3 Keyboard Shortcuts

**New hook**: `src/hooks/useMaintenanceKeyboard.ts`

Basic row navigation:
- `ArrowDown` / `ArrowUp`: move focused row index (within current page)
- `Enter`: open edit modal for focused row
- `Delete`: open delete confirm for focused row
- `Esc`: close any open modal / collapse expanded row / clear selection

Implementation:
- Track `focusedRowId: string | null` in `Maintenance.tsx`
- `useEffect` with `window.addEventListener('keydown', handler)` — active only when view = table and no modal is open
- Visual: focused row gets `ring-2 ring-primary ring-inset` class
- Skip shortcuts when: any modal open, typing in an input/select, or focused on a button

### 7.4 Phase 3 Deliverables Checklist

| # | Task | New/Modified | Lines est. |
|---|---|---|---|
| 1 | `MaintenanceTimelineView.tsx` | New | ~250 |
| 2 | `useTimelineRange.ts` | New | ~60 |
| 3 | `maintenanceCsv.ts` | New | ~150 |
| 4 | `useMaintenanceKeyboard.ts` | New | ~80 |
| 5 | `MaintenanceTable.tsx` (focus ring + keyboard handlers) | Modified | +30 |
| 6 | `Maintenance.tsx` (CSV import/export wiring + keyboard hook + timeline view) | Modified | ~450 |
| 7 | `MaintenanceContext.tsx` (`addRecord` skipLog param) | Modified | +5 |

---

## 8. Component Inventory (New & Modified)

### New files (all phases)

| File | Phase | Description |
|---|---|---|
| `src/components/MaintenanceSkeleton.tsx` | 1 | Loading skeleton mirroring page shape |
| `src/components/MaintenanceEmptyState.tsx` | 1 | Empty/no-results states with CTA |
| `src/components/MaintenanceViewSwitcher.tsx` | 1 | Segmented control: Table / Timeline / Calendar |
| `src/components/MaintenanceCalendarView.tsx` | 1 | Inline calendar (extracted from modal) |
| `src/components/StatusBadgeDropdown.tsx` | 2 | Click badge → dropdown status change |
| `src/components/MaintenanceBulkBar.tsx` | 2 | Sticky bulk action bar |
| `src/components/MaintenanceBulkStatusModal.tsx` | 2 | Bulk status change modal |
| `src/components/BulkUpdateProgressModal.tsx` | 2 | Progress modal for bulk updates |
| `src/components/MaintenanceRowDetail.tsx` | 2 | Inline expanded row detail panel |
| `src/components/MaintenanceTimelineView.tsx` | 3 | Horizontal bar timeline (recharts) |
| `src/hooks/useTimelineRange.ts` | 3 | Week range + grouping logic for timeline |
| `src/lib/maintenanceCsv.ts` | 3 | CSV import/export mapping + validation |
| `src/hooks/useMaintenanceKeyboard.ts` | 3 | Keyboard shortcuts hook |

### Modified files (all phases)

| File | Phases | Changes |
|---|---|---|
| `src/pages/Maintenance.tsx` | 1, 2, 3 | Full rewrite: layout restructure, skeleton, notice, pagination, view switcher, selection, bulk ops, CSV, keyboard, timeline |
| `src/components/MaintenanceTable.tsx` | 1, 2, 3 | Full rewrite: column defs array, sorting, column toggle, checkbox selection, inline expand, status dropdown, focus ring |
| `src/components/MaintenanceStats.tsx` | 1 | Sparkline in cost card, visual upgrade |
| `src/components/ui/StatCard.tsx` | 1 | Add `chart` prop |
| `src/hooks/useMaintenanceFilters.ts` | 1 | Add sorting (sortKey, sortDirection, toggleSort) |
| `src/contexts/MaintenanceContext.tsx` | 2, 3 | `updateStatus`, `deleteMultipleRecords`, `deleteAllRecords`, `bulkUpdateStatus`, `addRecord` skipLog param |
| `src/components/MaintenanceSchedulePanel.tsx` | 1 | **Deleted** — absorbed into Calendar view + stats |
| `src/components/MaintenanceCalendarModal.tsx` | 1 | Kept for backward compat but "View Full Calendar" button removed |

### Reused existing files (no modification needed)

| File | Used for |
|---|---|
| `src/hooks/useColumnVisibility.ts` | Column toggle state |
| `src/hooks/useRowSelection.ts` | Checkbox selection |
| `src/hooks/useBulkDelete.ts` | Bulk delete flow |
| `src/hooks/usePagination.ts` | Pagination with page-size config |
| `src/components/ColumnVisibilityDropdown.tsx` | Column toggle UI |
| `src/components/DeleteConfirmModal.tsx` | Delete confirmation |
| `src/components/DeleteProgressModal.tsx` | Delete progress |
| `src/components/ImportProgressModal.tsx` | CSV import progress |
| `src/components/ui/FilterBar.tsx` | Search + filter chips |
| `src/components/ui/MultiSelectDropdown.tsx` | Multi-select filters |
| `src/components/ui/Pagination.tsx` | Pagination UI |
| `src/components/ui/ConfirmModal.tsx` | Generic confirm dialog |
| `src/components/ui/Toast.tsx` | Notice toast |
| `src/components/ui/FormModal.tsx` | Modal form shell |
| `src/components/ui/Modal.tsx` | Generic modal |
| `src/components/ui/EmptyState.tsx` | Empty state base |
| `src/components/ui/Skeleton.tsx` | Skeleton primitive |
| `src/lib/csv.ts` | CSV helpers (sanitizeCell, toCsvBlob, downloadBlob) |
| `src/lib/money.ts` | Currency formatting |
| `src/lib/dates.ts` | Date formatting |
| `src/lib/activityLogger.ts` | Activity logging |

---

## 9. File-by-File Breakdown

### 9.1 `src/pages/Maintenance.tsx` (Phase 1-3)

Current: 206 lines. Target: ~450 lines (across all phases).

Key structure:
```typescript
export default function Maintenance() {
  const { records, loading, deleteRecord, updateStatus, deleteMultipleRecords, deleteAllRecords, bulkUpdateStatus, addRecord } = useMaintenance();
  const [searchParams, setSearchParams] = useSearchParams();
  const view = searchParams.get('view') ?? 'table';  // Phase 1

  const selection = useRowSelection();  // Phase 2
  const pagination = usePagination({ storageKey: 'rajaset:maintenance:pageSize', pageSizeOptions: [10, 25, 50, 100] });  // Phase 1
  const { visibleColumns, toggleColumn, showAll } = useColumnVisibility('rajaset:maintenance:columns', DEFAULT_VISIBLE_COLUMNS);  // Phase 1

  const { filterSubsidiary, ..., sortKey, sortDirection, toggleSort, filteredRecords } = useMaintenanceFilters(records, searchParams, setSearchParams, ...);  // Phase 1

  const [notice, setNotice] = useState<{...}>(null);  // Phase 1
  const [focusedRowId, setFocusedRowId] = useState<string | null>(null);  // Phase 3
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);  // Phase 2

  useMaintenanceKeyboard({ ... });  // Phase 3

  if (loading) return <MaintenanceSkeleton />;  // Phase 1

  return ( ... );
}
```

### 9.2 `src/components/MaintenanceTable.tsx` (Phase 1-3)

Current: 93 lines. Target: ~280 lines.

Key structure:
```typescript
export interface MaintenanceColumnDef { ... }
export const MAINTENANCE_COLUMNS: MaintenanceColumnDef[] = [ ... ];
export const DEFAULT_VISIBLE_COLUMNS = [ ... ];

interface MaintenanceTableProps {
  records: MaintenanceRecord[];
  visibleColumns: Set<string>;
  sortKey: string | null;
  sortDirection: 'asc' | 'desc' | null;
  onToggleSort: (key: string) => void;
  selectedIds: Set<string>;
  onSelectAll: (checked: boolean) => void;
  onSelectOne: (id: string, checked: boolean) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onStatusChange: (id: string, status: string) => Promise<void>;
  expandedRowId: string | null;
  onToggleExpand: (id: string) => void;
  focusedRowId: string | null;
  hasAnyRecords: boolean;
}
```

### 9.3 `src/contexts/MaintenanceContext.tsx` (Phase 2-3)

Current: 138 lines. Target: ~220 lines.

New methods:
```typescript
interface MaintenanceContextType {
  records: MaintenanceRecord[];
  loading: boolean;
  error: string | null;
  addRecord: (record: MaintenanceInput, skipLog?: boolean) => Promise<void>;  // +skipLog (Phase 3)
  updateRecord: (id: string, record: MaintenanceInput) => Promise<void>;
  updateStatus: (id: string, status: string) => Promise<void>;  // Phase 2
  deleteRecord: (id: string) => Promise<void>;
  deleteMultipleRecords: (ids: string[], onProgress?: (p: { processed: number; total: number }) => void) => Promise<void>;  // Phase 2
  deleteAllRecords: (onProgress?: (p: { processed: number; total: number }) => void) => Promise<void>;  // Phase 2
  bulkUpdateStatus: (ids: string[], status: string, onProgress?: ...) => Promise<void>;  // Phase 2
}
```

Batched operations mirror `AssetContext`:
- `deleteMultipleRecords`: batch 100/batch, `supabase.from('maintenance_records').delete().in('id', batch)`
- `deleteAllRecords`: same DELETE-gate pattern as `useBulkDelete` (type "DELETE ALL" to confirm)
- `bulkUpdateStatus`: batch 100/batch, `.update({ status }).in('id', batch)`

### 9.4 `src/hooks/useMaintenanceFilters.ts` (Phase 1)

Current: 51 lines. Target: ~80 lines.

Add sorting state (mirror `useAssetFilters`):
- Accept `sortKey`, `sortDirection`, `toggleSort` from `useListFilters` (if it supports it) or add local state
- Apply sort to `filteredRecords` before returning
- Numeric columns: `parseCost` then numeric compare
- Date columns: `Date.parse` then numeric compare
- String columns: `localeCompare`

### 9.5 `src/lib/maintenanceCsv.ts` (Phase 3)

Mirror `src/lib/assetCsv.ts` (~150 lines):

```typescript
export const MAX_IMPORT_ROWS = 5000;
export const MAINTENANCE_CSV_FIELDS: { header: string; key: keyof MaintenanceCsvRow }[] = [ ... ];
export function buildExportRows(records, columnIds, sanitize): string[][] { ... }
export function mapCsvRowToMaintenanceInput(row): { ok: true; input } | { ok: false; error } { ... }
export function partitionCsvRows(rows): { valid; invalid } { ... }
```

---

## 10. Database & Migration Considerations

### 10.1 No schema changes needed

The existing `maintenance_records` table schema supports all planned features:
- Status field already accepts string values (Pending/In Progress/Completed/Overdue)
- No new columns needed (timeline uses existing `scheduledDate` + `status`)
- No new tables needed (bulk operations work on existing table)

### 10.2 RLS considerations

Bulk operations use the same Supabase RLS policies as single operations. No new policies needed.

### 10.3 Activity logging

New action types for activity log:
- `BULK_DELETE_MAINTENANCE` (Phase 2) — or reuse `BULK_DELETE` with `entityType: 'maintenance'`
- `BULK_UPDATE_MAINTENANCE` (Phase 2) — or reuse `UPDATE_MAINTENANCE` with details `{ bulk: true, count, from, to }`

**Decision**: Reuse existing action types with `entityType: 'maintenance'` and `details.bulk = true` to avoid changing the activity log schema. The `activity_logs` table already accepts freeform `details` JSONB.

### 10.4 pg_cron

No new cron jobs needed (auto-overdue was dropped).

---

## 11. i18n Updates

**Modified**: `src/i18n/en.ts`

Add new keys under `maintenance`:

```typescript
maintenance: {
  // existing keys...
  viewSwitcher: {
    table: 'Table',
    timeline: 'Timeline',
    calendar: 'Calendar',
  },
  bulk: {
    selected: (n: number) => `${n} record${n === 1 ? '' : 's'} selected`,
    deleteSelected: 'Delete Selected',
    markAs: 'Mark as',
    clear: 'Clear',
    confirmDelete: 'Are you sure you want to delete {count} maintenance records?',
    confirmBulkStatus: '{count} records will be changed to "{status}". Continue?',
  },
  csv: {
    exportAll: 'Export All',
    exportSelected: 'Export Selected',
    import: 'Import CSV',
    importSuccess: 'Imported {success} record(s)',
    importFailed: 'Imported {success}, skipped {failed} invalid row(s)',
    importTooLarge: 'File exceeds the maximum limit of {max} rows.',
  },
  timeline: {
    groupByAsset: 'Group by Asset',
    groupByService: 'Group by Service Type',
    flat: 'Flat List',
    prevWeek: 'Previous Week',
    nextWeek: 'Next Week',
    thisWeek: 'This Week',
    empty: 'No maintenance scheduled in this period.',
  },
  rowDetail: {
    assetInfo: 'Asset Information',
    costBreakdown: 'Cost Breakdown',
    variance: 'Variance',
    history: 'Service History',
    noHistory: 'No other maintenance records for this asset.',
  },
  empty: {
    noData: 'No maintenance records yet. Add your first record to get started.',
    noFiltered: 'No records match your filters.',
  },
  keyboard: {
    hint: '↑↓ navigate, Enter to edit, Delete to remove, Esc to close',
  },
}
```

---

## 12. Risk Assessment

| Risk | Impact | Mitigation |
|---|---|---|
| **Table rewrite breaks existing functionality** | High | Phase 1 rewrite is the biggest risk. Test: ensure add/edit/delete still works, filters + URL persistence intact, calendar still navigable. |
| `MaintenanceContext` method signature changes (`addRecord` gets `skipLog`) | Medium | `skipLog` defaults to `false` — all existing callers pass no second arg, so no breaking change. Only Phase 3 CSV import uses `skipLog=true`. |
| Timeline view with recharts may have rendering issues with many bars | Low | Cap visible bars to current week (7 days), paginate if needed. Performance test with 50+ records. |
| `StatCard.tsx` `chart` prop change may affect Inventory | Low | `chart` is optional, defaults to `undefined`, existing `Inventory.tsx` usage unaffected. |
| `MaintenanceSchedulePanel.tsx` deletion leaves orphaned imports | Low | Search for all imports of `MaintenanceSchedulePanel` before deletion — only `Maintenance.tsx` uses it. |
| `MaintenanceCalendarModal.tsx` kept but "View Full Calendar" trigger removed | Low | Modal is still rendered if `isCalendarModalOpen` is true, but no button opens it. Safe to keep dead code for now, or remove the modal entirely in Phase 1. **Decision**: Remove the modal in Phase 1 and inline the calendar — cleaner. |
| Keyboard shortcuts interfering with form inputs | Medium | `useMaintenanceKeyboard` checks `document.activeElement` — skip if `tagName` is INPUT/SELECT/TEXTAREA or `isContentEditable`. |
| Bulk operations on large datasets (1000+ records) | Medium | Batched operations (100/batch) with progress modal — same pattern as Inventory. `fetchAllRows` chunking already exists in `lib/supabase/fetchAllRows.ts`. |

---

## 13. Verification Checklist

### Phase 1
- [ ] `npm run lint` passes (tsc --noEmit)
- [ ] `npm run dev` — Maintenance page loads with skeleton during fetch
- [ ] Table shows correct columns; column toggle persists in localStorage
- [ ] Sorting works: click header → asc/desc/none cycle; numeric columns sort numerically
- [ ] Calendar view: month grid renders, prev/next/today work, day click shows records
- [ ] View switcher: URL persists `?view=table|calendar`, refresh restores view
- [ ] Stat cards render; cost card shows sparkline when ≥2 months of data
- [ ] Empty states show correctly (no data vs. no filtered results)
- [ ] Pagination: page-size selector works, persists in localStorage
- [ ] Notice toast: success on add/edit, auto-dismisses
- [ ] Filters: multi-select + search + chips work, URL persists

### Phase 2
- [ ] Status badge dropdown: click → 4 options → select saves to Supabase → badge updates → activity log written
- [ ] Checkbox: select-all covers all filtered (not just page), individual toggle works
- [ ] Bulk bar appears when ≥1 selected, disappears on clear
- [ ] Bulk delete: confirm modal → progress modal → records removed → notice
- [ ] Bulk status: modal → progress → all selected updated → notice
- [ ] Row expansion: click row → detail panel slides in → shows asset info + cost breakdown + history
- [ ] Only one row expanded at a time (clicking another collapses first)
- [ ] `npm run lint` passes

### Phase 3
- [ ] Timeline view: bars render for current week, colored by status, tooltip on hover
- [ ] Timeline: prev/next/this week navigation works
- [ ] Timeline: grouping toggle (by asset / by service type / flat)
- [ ] Timeline: click bar → opens edit modal
- [ ] CSV export: all/selected × visible/all columns → correct file downloaded
- [ ] CSV import: valid rows imported, invalid rows skipped, progress modal shows counts
- [ ] CSV import: >5000 rows rejected with error notice
- [ ] CSV injection prevention: `sanitizeCell` applied to all exported values
- [ ] Keyboard: ↑/↓ moves focus ring, Enter opens edit, Delete opens confirm, Esc closes
- [ ] Keyboard: disabled when typing in inputs/selects or when modal open
- [ ] `npm run lint` passes

---

## Appendix A: Estimated Effort

| Phase | New files | Modified files | Estimated lines | Est. hours |
|---|---|---|---|---|
| Phase 1 | 4 | 6 | ~830 | 12-16 |
| Phase 2 | 5 | 3 | ~810 | 10-14 |
| Phase 3 | 4 | 3 | ~1020 | 14-18 |
| **Total** | **13** | **12** | **~2660** | **36-48** |

---

## Appendix B: Dependency Graph

```
Phase 1 (must be first):
  ├── MaintenanceSkeleton.tsx (no deps)
  ├── MaintenanceEmptyState.tsx (depends on ui/EmptyState)
  ├── MaintenanceViewSwitcher.tsx (no deps)
  ├── MaintenanceCalendarView.tsx (extracts from MaintenanceCalendarModal)
  ├── MaintenanceTable.tsx rewrite (depends on useColumnVisibility, column defs)
  ├── MaintenanceStats.tsx upgrade (depends on StatCard chart prop)
  ├── StatCard.tsx (add chart prop)
  ├── useMaintenanceFilters.ts (add sorting)
  └── Maintenance.tsx rewrite (depends on all above)

Phase 2 (depends on Phase 1):
  ├── StatusBadgeDropdown.tsx (depends on MaintenanceContext.updateStatus)
  ├── MaintenanceBulkBar.tsx (depends on useRowSelection)
  ├── MaintenanceBulkStatusModal.tsx (depends on MaintenanceContext.bulkUpdateStatus)
  ├── BulkUpdateProgressModal.tsx (no deps)
  ├── MaintenanceRowDetail.tsx (depends on MaintenanceContext records)
  ├── MaintenanceTable.tsx (add checkbox + expand + status dropdown)
  ├── MaintenanceContext.tsx (add updateStatus, deleteMultiple, deleteAll, bulkUpdateStatus)
  └── Maintenance.tsx (wire selection + bulk bar + modals + row detail)

Phase 3 (depends on Phase 1 + 2):
  ├── MaintenanceTimelineView.tsx (depends on recharts, records)
  ├── useTimelineRange.ts (no deps)
  ├── maintenanceCsv.ts (depends on types/maintenance)
  ├── useMaintenanceKeyboard.ts (depends on Maintenance page state)
  ├── MaintenanceTable.tsx (add focus ring)
  ├── MaintenanceContext.tsx (addRecord skipLog)
  └── Maintenance.tsx (wire CSV + keyboard + timeline view)
```

---

*End of plan. Review and adjust before implementation.*
