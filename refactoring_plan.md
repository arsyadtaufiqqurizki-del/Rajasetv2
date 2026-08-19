# Refactoring Plan — Rajaset v2 (`src/pages`)

> Scope: the 10 page components under `src/pages` and the shared layer they depend on
> (`src/components`, `src/hooks`, `src/contexts`, `src/lib`).
> Status: **accepted 2026-08-19 — executing step by step. No code changed yet.**

---

## 1. Executive Summary

### Current state

| File | LOC | Health |
|---|---:|---|
| `Reclassification.tsx` | 766 | 🔴 Fat component — filters + table + 3 inline modals |
| `Reports.tsx` | 639 | 🔴 Fat component — untyped report engine + PDF/XLSX writers |
| `Dashboard.tsx` | 575 | 🟠 Fat component — 8 unmemoized aggregations + duplicated filter bar |
| `AIAssistant.tsx` | 499 | 🟠 Hand-rolled markdown renderer + streaming client inline |
| `Settings.tsx` | 481 | 🟠 4 tabs in one file; 2 tabs don't actually persist |
| `Maintenance.tsx` | 446 | 🟠 Stale filter pattern (single-select, no URL sync) |
| `Inventory.tsx` | 404 | 🟢 **Reference implementation** — recently decomposed |
| `Guide.tsx` | 336 | 🟢 Static content, but content is inlined in the component |
| `MasterData.tsx` | 152 | 🟠 Same CRUD panel written 3× |
| `Login.tsx` | 104 | 🟢 Fine |

**The good news:** the Inventory refactor (`useAssetFilters` + `AssetFilters` / `AssetTable` /
`AssetTablePagination` / `AssetToolbar` / 3 modal components) already established the *exact* target
architecture. It works, it type-checks, and it cut that file by 58%. This plan is mostly about
**propagating a pattern that already exists in the repo** rather than inventing one.

**The bad news:** that pattern was applied to exactly one of four list pages. `Dashboard`,
`Reclassification`, and `Maintenance` each carry their own hand-rolled copy of the same filter
engine — at three different levels of sophistication. Every new filter feature currently has to be
written three or four times, and `Maintenance` has already fallen behind (no URL persistence, no
chips, no multi-select).

**Structural gaps beyond duplication:**

- **No `src/types/`.** Domain types (`Asset`, `Reclassification`) live inside provider modules, so
  every consumer imports a React context file just to get a type.
- **`strict` is off.** `tsconfig.json` has no `strict`, `noUnusedLocals`, `noImplicitAny`, or
  `noUncheckedIndexedAccess`. `npm run lint` is `tsc --noEmit` against a permissive config.
- **No ESLint, no Prettier, no test runner.** Zero automated safety net for a refactor of this size.
- **No code splitting.** `App.tsx` eagerly imports all 10 pages; `Reports.tsx` drags `jspdf`,
  `jspdf-autotable`, `xlsx`, and `html2canvas` into the initial bundle for every user.

### Verdict

Architecture is **sound at the data layer** (contexts are clean, `fromDb`/`toDb` mapping is
disciplined) and **weak at the presentation layer**. This is a *consolidation* refactor, not a
rewrite: ~1,900 of the ~4,400 page LOC are duplicates of code that already exists elsewhere in the
repo.

---

## 2. Global Code Smells

### 2.1 🔴 The filter engine exists four times

The same five-part machine — debounced search, page reset, URL sync, `activeFilters` chip builder,
`clearFilters` — is reimplemented in four places:

| Location | Multi-select | URL sync | Chips | Date/Cost range |
|---|:-:|:-:|:-:|:-:|
| `hooks/useAssetFilters.ts` | ✅ | ✅ | ✅ | ✅ |
| `Dashboard.tsx:22–62` | ✅ | ✅ | ✅ | ❌ |
| `Reclassification.tsx:28–126` | ✅ | ✅ | ✅ | ❌ |
| `Maintenance.tsx:18–54` | ❌ `""` sentinel | ❌ | ❌ | ❌ |

The three `useEffect`s (debounce / reset / URL-sync) are **character-for-character identical**
across `useAssetFilters.ts:54–82`, `Dashboard.tsx:43–62`, and `Reclassification.tsx:74–93` apart
from the filter names. The `activeFilters` reducer is the same shape in all three
(`useAssetFilters.ts:33–51`, `Dashboard.tsx:31–41`, `Reclassification.tsx:115–126`).

**Cost:** the reclassification filter parity work (commit `674db52`) was a manual port of Inventory's
filter code. The next filter feature costs 4× again.

### 2.2 🔴 Filter-bar and pagination JSX copy-pasted

- **Filter bar** (Filter icon + count badge + search input + `MultiSelectDropdown`s + "Clear Filters"
  + chip row): `AssetFilters.tsx` (correct home), `Dashboard.tsx:396–477`, `Reclassification.tsx:335–423`.
  The chip `<span>` markup is byte-identical in all three.
- **Pagination footer** ("Showing X of Y" + prev/next + "Page N of M"): `AssetTablePagination.tsx`
  (correct home), `Reclassification.tsx:535–556`, `Maintenance.tsx:371–392`, `Reports.tsx:611–632`,
  plus a *slightly divergent* variant in `Dashboard.tsx:546–571` ("Showing 1 to 10 of 42 results").

### 2.3 🔴 Modal chrome hand-rolled in 8 files

The overlay `fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm
animate-in fade-in duration-200` is repeated in `Maintenance.tsx`, `Reclassification.tsx` (×3),
`AddMaintenanceModal`, `EditMaintenanceModal`, `MaintenanceCalendarModal`, `DeleteConfirmModal`,
`DeleteProgressModal`, `ImportProgressModal`.

Worse, **`Reclassification.tsx:638–763` is a near-verbatim reimplementation of the already-extracted
`DeleteConfirmModal.tsx` and `DeleteProgressModal.tsx`** — the same "type DELETE to confirm" flow and
the same progress bar, just not imported. `Reclassification.tsx:560–635` (sync progress) is
structurally identical to `ImportProgressModal.tsx`.

None of these modals have: a portal, focus trap, `Esc` to close, `role="dialog"`/`aria-modal`, or
scroll lock.

### 2.4 🔴 Money handling is scattered and inconsistent

`parseFloat(value.replace(/[^0-9.-]+/g, ""))` — the cost-parsing incantation — appears **19 times**:
`Dashboard.tsx` (89, 94, 104, 122, 137, 178), `Reports.tsx` (53, 91, 101, 112, 141, 165, 166, 205, 206),
`Maintenance.tsx:67`, `useAssetFilters.ts:96`, `AssetContext.tsx:94`.

Currency formatting exists in **three incompatible flavours**:
- `lib/utils.ts:14` `formatCurrency` — 2 decimals, returns `'-'` on invalid
- `Reports.tsx:32` a *local* `formatCurrency` that shadows it — default decimals, `NaN` on invalid
- Raw `new Intl.NumberFormat(...)` inline at `Dashboard.tsx` (108, 115, 309, 331, 376) and
  `Reports.tsx` (527, 539, 550)

Result: the same asset cost renders differently depending on which page you're on.

### 2.5 🟠 CSV-injection sanitiser forked, with a real gap

`Reclassification.tsx:12` `sanitizeCsvField` guards `/^[=+\-@\t\r]/`.
`Reports.tsx:237` `sanitizeForSpreadsheet` guards `/^[=+\-@]/` — **missing `\t` and `\r`**.

And `Inventory.tsx:113–157` (`handleExportCSV`) sanitises *nothing at all* — user-controlled asset
descriptions go straight into the CSV. Three implementations, three different security postures.

### 2.6 🟠 Blob-download boilerplate ×3, one leaks

`createElement('a')` → `setAttribute` → `appendChild` → `click` → `removeChild` appears at
`Inventory.tsx:143–152`, `Inventory.tsx:272–278`, `Reclassification.tsx:172–179`.
**`Reclassification.tsx` never calls `URL.revokeObjectURL`** — every export leaks the blob for the
lifetime of the tab.

### 2.7 🔴 Weak typing

- `tsconfig.json` sets no `strict` family flag. Implicit `any` is legal today.
- **`Reports.tsx:28` `previewData: any`** is the worst offender — it's the *entire report engine's*
  return type. That single `any` propagates through 13 sites (`previewData.data`, `.title`,
  `.detailColumns`, `.yAxisFormatter`, …) with zero compile-time protection over PDF/XLSX writers.
  A typo in `previewData.summry` fails silently at runtime.
- `Reclassification.tsx:198,203` — `handleEdit(item: any)` / `handleVerify(item: any)`, even though
  `Reclassification` is a fully-defined exported type two files away.
- `Inventory.tsx:167,175,176` — `results.data as any[]`, `validRows: any[]`.
- Domain types are trapped in provider modules: `Asset` in `AssetContext.tsx:5`,
  `Reclassification` in `ReclassificationContext.tsx:9`. Importing a type pulls in a React context.

### 2.8 🟠 Business logic embedded in render functions

None of the following is reachable from a test without mounting React:

- **Depreciation math** — `Reports.tsx:100–155` (straight-line NBV, quarterly roll-forward)
- **MoM deltas + chart aggregation** — `Dashboard.tsx:64–187` (8 separate `reduce`s)
- **CSV import validation + batching** — `Inventory.tsx:159–263` (~100 lines inside a `useCallback`)
- **Maintenance date windows** — `Maintenance.tsx:93–104`
- **Markdown → JSX parser** — `AIAssistant.tsx:219–307` (~90 lines, incl. a table parser)

### 2.9 🟠 Native dialogs mixed with the design system

`window.confirm` at `Inventory.tsx:88`, `Reclassification.tsx:209`, `Reports.tsx:230`;
`alert()` at `Inventory.tsx:170,260` and `AddReclassificationModal.tsx:79`.
The app has a perfectly good `DeleteConfirmModal` — it just isn't used for single-row deletes.

### 2.10 🟠 Prop drilling

`AssetFilters` takes **30 props** — 12 `value`/`setValue` pairs plus 6 option arrays. `Inventory.tsx`
destructures 18 values out of `useAssetFilters` (lines 49–66) purely to re-assemble them into props
(lines 324–354). The hook already returns a cohesive object; splitting and re-merging it is pure noise.

### 2.11 🟠 Performance & bundle

- **No lazy routes.** `App.tsx` imports all 10 pages statically. `Reports` alone pulls in `jspdf` +
  `jspdf-autotable` + `xlsx` + `html2canvas` — well over 1 MB — for a user who only opens the Dashboard.
- **`Dashboard.tsx:64–150` runs unmemoized on every render**: `currentMonthAssets`, `lastMonthAssets`,
  `totalValuation`, `subsidiaryDataMap`, `categoryDataMap`, plus 2 `Intl.NumberFormat` constructions.
  Only 4 of ~12 derived values use `useMemo`.
- **Client-side everything.** `AssetContext.tsx:127–140` pages the whole `assets` table into memory in
  1000-row chunks; all four list pages then filter, sort, and paginate in the browser. Fine at 5k rows,
  a cliff beyond that.

### 2.12 🟡 Smaller but real

- **Index keys on a paginated list** — `Dashboard.tsx:499` `currentAssets.map((asset, i) => <tr key={i}>`.
  Keys `0..9` are reused across pages and filter changes; React will mis-reconcile row state.
  `asset.id` is available.
- **Invalid Tailwind class** — `h-[calc(100vh-[180px])]` (nested brackets) at `Reclassification.tsx:242`,
  `Inventory.tsx:306`, `MasterData.tsx:35`. Tailwind emits nothing; the class is dead.
- **Unused import** — `Plus` in `Dashboard.tsx:7`. (`noUnusedLocals` would catch this class of issue.)
- **`React` imported but unused** as a value in `Login.tsx`, `MasterData.tsx`, `Reclassification.tsx`
  (react-jsx transform is on).
- **Suppressed dependency arrays** — `useAssetFilters.ts:64` disables `exhaustive-deps`;
  `Dashboard.tsx:166–170` omits `selectedYear` with no comment.
- **Mixed-language UI strings**, hard-coded: "Belum ada data" next to "No change from last month",
  "Yakin ingin menghapus…" next to "Are you sure you want to delete…". `Settings.tsx:298` offers a
  language selector that is wired to nothing.
- **`Settings.tsx:141–148`** — the System Config and Notifications tabs `setTimeout(800)` and then
  claim "Changes saved successfully". Nothing is persisted. Also a hard-coded Unsplash avatar at line 226.
- **`MasterData.tsx`** — the same 70-line CRUD panel written three times (subsidiaries / class / location).

---

## 3. Proposed Architecture

### 3.1 Target tree

```
src/
├─ types/                          ← NEW: framework-free domain contracts
│  ├─ asset.ts                     Asset, AssetInput, AssetStatusLevel
│  ├─ reclassification.ts          Reclassification, ReclassificationInput
│  ├─ maintenance.ts               MaintenanceRecord, MaintenanceStatus
│  ├─ report.ts                    ReportPreview, ReportType, ReportSummaryItem,
│  │                               DetailColumn<T>, ChartKind   ← kills Reports' `any`
│  ├─ filters.ts                   FilterChip, FilterConfig<T>, ListFilterState
│  └─ index.ts                     barrel
│
├─ hooks/
│  ├─ useListFilters.ts            ← NEW: generic engine (see 3.2). Replaces the 4 copies.
│  ├─ useAssetFilters.ts           thin config wrapper over useListFilters
│  ├─ useReclassificationFilters.ts   ← NEW
│  ├─ useMaintenanceFilters.ts        ← NEW (also upgrades Maintenance to parity)
│  ├─ useDashboardFilters.ts          ← NEW
│  ├─ usePagination.ts             ← NEW: page/totalPages/slice/reset
│  ├─ useRowSelection.ts           ← NEW: Set<string> select-one / select-all
│  ├─ useBulkDelete.ts             ← NEW: confirm-text + progress + all-vs-selected branch
│  ├─ useCsvExport.ts              ← NEW: sanitise → unparse → download → toast
│  ├─ useCsvImport.ts              ← NEW: parse → validate → batch → progress
│  ├─ useDashboardMetrics.ts       ← NEW: all Dashboard aggregations, memoized
│  ├─ useToast.ts                  ← NEW
│  ├─ useActivityLog.ts            (unchanged)
│  └─ useSystemAlerts.ts           (unchanged)
│
├─ lib/
│  ├─ utils.ts                     cn, parseListParam (keep)
│  ├─ money.ts                     ← NEW: parseCost, formatCurrency, formatCompactCurrency
│  ├─ csv.ts                       ← NEW: sanitizeCell (ONE regex), toCsv, downloadBlob
│  ├─ dates.ts                     ← NEW: monthsBetween, getQuartersInRange, formatLastUpdate
│  ├─ reports/                     ← NEW: the report engine, extracted from Reports.tsx
│  │  ├─ buildValuationReport.ts
│  │  ├─ buildDepreciationReport.ts
│  │  ├─ buildMaintenanceCostReport.ts
│  │  ├─ exportPdf.ts              (dynamic-imports jspdf)
│  │  └─ exportXlsx.ts             (dynamic-imports xlsx)
│  ├─ markdown.ts                  ← NEW: AIAssistant's renderer, extracted + testable
│  ├─ activityLogger.ts            (unchanged)
│  └─ supabase.ts                  (unchanged)
│
├─ components/
│  ├─ ui/                          ← NEW: primitives, zero domain knowledge
│  │  ├─ Modal.tsx                 portal + focus trap + Esc + aria-modal + scroll lock
│  │  ├─ ConfirmModal.tsx          (built on Modal; absorbs window.confirm sites)
│  │  ├─ ProgressModal.tsx         (absorbs delete/import/sync progress modals)
│  │  ├─ DataTable.tsx             generic <T> table: columns, selection, empty state
│  │  ├─ Pagination.tsx            the one true footer
│  │  ├─ FilterBar.tsx             icon + badge + search + slot for dropdowns + chips
│  │  ├─ FilterChips.tsx
│  │  ├─ StatCard.tsx              the 4-up KPI card (Dashboard, Maintenance, Reclassification)
│  │  ├─ MultiSelectDropdown.tsx   (moved)
│  │  ├─ AutocompleteInput.tsx     (moved)
│  │  ├─ Toast.tsx
│  │  └─ EmptyState.tsx
│  │
│  ├─ inventory/                   AssetToolbar, AssetFilters, AssetTable, AssetImport*
│  ├─ reclassification/            Add/Edit/Verify modals, ReclassificationTable, …Filters
│  ├─ maintenance/                 Add/Edit modals, Calendar, MaintenanceTable, …Filters
│  ├─ dashboard/                   KpiRow, SubsidiaryBarChart, CategoryPieChart, TrendChart,
│  │                               RecentAssetsPanel
│  ├─ reports/                     ReportConfigForm, ReportChart, ReportHistoryTable, ExportPanel
│  ├─ settings/                    ProfileTab, SystemConfigTab, NotificationsTab, SecurityTab
│  ├─ masterdata/                  MasterDataPanel (one component, rendered 3×)
│  └─ Layout.tsx, NotificationBell.tsx
│
├─ contexts/                       unchanged behaviour; re-export types from src/types
└─ pages/                          thin: layout + wiring only, target ≤200 LOC each
```

### 3.2 The keystone: `useListFilters<T>`

One generic engine, configured per page. Sketch:

```ts
// src/types/filters.ts
export interface FilterDef<T> {
  key: string;                          // URL param name
  label: string;                        // chip prefix, e.g. "Subsidiary"
  kind: 'multi' | 'text' | 'dateRange' | 'numberRange';
  accessor: (row: T) => string | number | boolean;
}

// src/hooks/useListFilters.ts
export function useListFilters<T>(
  rows: T[],
  defs: FilterDef<T>[],
  searchFields: (keyof T)[],
  searchParams: URLSearchParams,
  setSearchParams: SetURLSearchParams,
): {
  values:  Record<string, string[] | string>;
  setValue(key: string, v: string[] | string): void;
  chips:   FilterChip[];
  filtered: T[];
  searchQuery: string;
  setSearchQuery(q: string): void;
  clear(): void;
};
```

Debounce, URL sync, chip generation, and reset all live here **once**. Each page then declares
*data*, not *machinery*:

```ts
const filters = useListFilters(assets, ASSET_FILTER_DEFS, ['assetDescription','assetNumber'], sp, setSp);
```

This is the single change that removes the most duplication and is the prerequisite for
`Maintenance` reaching feature parity for free.

### 3.3 Consolidation targets

| Today | Becomes | Removes |
|---|---|---|
| 4 filter engines | `useListFilters` + 4 configs | ~300 LOC |
| 5 pagination footers | `ui/Pagination` | ~120 LOC |
| 8 modal overlays | `ui/Modal` + 2 presets | ~350 LOC |
| 3 blob downloaders | `lib/csv.downloadBlob` | ~40 LOC + a leak |
| 19 cost parses / 3 formatters | `lib/money` | ~60 LOC + inconsistency |
| 2 CSV sanitisers, 1 missing | `lib/csv.sanitizeCell` | a security gap |
| 3 MasterData panels | `MasterDataPanel` ×3 | ~110 LOC |
| `previewData: any` | `ReportPreview` union | 13 unchecked accesses |

---

## 4. Actionable Roadmap

Ordered so that **every step is independently shippable and independently verifiable**. Steps 0–3
are pure moves with no behaviour change; risk rises from step 5 onward.

Each step ends with the same gate unless noted:
`npx tsc --noEmit` → clean · `npm run build` → clean · manual smoke of the touched page(s).

---

### Phase A — Safety net (do this first; it protects everything after)

**Step 0 — Tooling.** *(~1h, zero behaviour risk)*
- Add ESLint + `eslint-plugin-react-hooks` + `@typescript-eslint`, and Prettier.
- Add Vitest + React Testing Library. Wire `npm run test`.
- Change `lint` from `tsc --noEmit` to `eslint . && tsc --noEmit`.
- ✅ Gate: lint runs and reports the existing violations (don't fix them yet — record the baseline).

**Step 1 — Turn on strict TypeScript, incrementally.** *(~2–4h)*
- Add `"strict": true`, `"noUnusedLocals": true`, `"noUnusedParameters": true` to `tsconfig.json`.
- Expect a wave of errors. Fix mechanically: annotate implicit `any`, add null guards, delete unused
  imports (`Plus` in `Dashboard.tsx:7`, unused `React` value imports).
- Leave `Reports.tsx`'s `previewData: any` explicitly annotated as `any` for now — Step 6 removes it.
- ✅ Gate: `tsc --noEmit` clean with strict on.

**Step 2 — Characterisation tests for the logic you're about to move.** *(~3h)*
Before extracting anything, pin its behaviour:
- `Reports` depreciation math (feed 3 assets, assert NBV per quarter)
- `Dashboard` MoM delta + `calculateChange` edge cases (previous = 0)
- `Inventory` CSV import row validation (missing number / missing description / both)
- `useAssetFilters.filteredAssets` across each filter dimension
- ✅ Gate: tests pass against the *current* code. These are your regression detector for Phases B–D.

---

### Phase B — Foundations (pure extraction, no behaviour change)

**Step 3 — `src/types/`.** *(~2h)*
- Move `Asset` → `types/asset.ts`, `Reclassification` → `types/reclassification.ts`, etc.
- Contexts import from `types/` and **re-export** (`export type { Asset } from '../types/asset'`) so
  no call site breaks in this step.
- Add `types/report.ts` — the real shape of `previewData`, as a discriminated union on
  `type: 'bar' | 'line' | 'composed'`. Don't apply it yet.
- ✅ Gate: `tsc --noEmit` clean; zero import churn outside `contexts/` and `types/`.

**Step 4 — `lib/money.ts` + `lib/csv.ts` + `lib/dates.ts`.** *(~3h)*
- `parseCost(value: string | number): number` — replace all 19 sites.
- `formatCurrency` / `formatCompactCurrency` — replace `Reports.tsx:32`'s shadow and all 8 inline
  `Intl.NumberFormat` sites. **Note:** `Reports`'s local formatter uses default decimals while
  `lib/utils`' uses 2 — pick one deliberately; report figures will shift by cents. Recommend the
  2-decimal version for consistency, and call it out in the PR.
- `sanitizeCell` — one regex `/^[=+\-@\t\r]/`, applied in **all three** export paths including
  `Inventory`'s, which currently has none. *(This closes a real CSV-injection gap.)*
- `downloadBlob(filename, blob)` — with `revokeObjectURL`, fixing the `Reclassification` leak.
- Move `monthsBetween`, `getQuartersInRange`, `formatLastUpdate` out of `utils.ts` into `dates.ts`.
- ✅ Gate: Step-2 tests still green; export a CSV from Inventory + Reclassification and diff against
  a pre-refactor capture.

**Step 5 — `components/ui/` primitives.** *(~5h)*
- `Modal` (portal, focus trap, Esc, `aria-modal`, scroll lock) → then rebuild `ConfirmModal` and
  `ProgressModal` on it.
- `Pagination`, `FilterBar`, `FilterChips`, `StatCard`, `Toast`, `EmptyState`.
- Migrate `MultiSelectDropdown` and `AutocompleteInput` into `ui/`.
- Refactor the *existing* `DeleteConfirmModal` / `DeleteProgressModal` / `ImportProgressModal` to sit
  on top of `Modal`. **Do not touch pages yet.**
- ✅ Gate: Inventory (the only current consumer) behaves identically; keyboard test — Esc closes, Tab
  is trapped.

---

### Phase C — The big win

**Step 6 — `useListFilters<T>` and retire the four copies.** *(~8h — the highest-value step)*

Order matters; go easiest→hardest so the generic hook is proven before it meets the ugly cases:

1. Build `useListFilters` alongside the existing hooks (nothing consumes it yet).
2. Rewrite `useAssetFilters` as a thin config over it. **Inventory is the safest canary** — it's the
   only page already fully decomposed. Ship and verify.
3. `Reclassification` → `useReclassificationFilters`. Delete `Reclassification.tsx:28–126` and the
   inline filter JSX at 335–423, replacing with `FilterBar`.
4. `Dashboard` → `useDashboardFilters`. Delete lines 22–62 and the filter JSX at 396–477.
5. `Maintenance` → `useMaintenanceFilters`. **This is a feature upgrade, not just a refactor** —
   Maintenance gains multi-select, URL persistence, and chips. Flag it as user-visible.

- ✅ Gate: for each page, save a URL with filters applied *before* the change and confirm the same URL
  restores the same result set *after*. Chip removal, Clear Filters, and page-reset all still work.

**Step 7 — Decompose `Reclassification.tsx` (766 → ~180).** *(~5h)*
- Replace the inline delete-confirm + delete-progress modals (lines 638–763) with the **existing**
  `DeleteConfirmModal` / `DeleteProgressModal` — they are already equivalent.
- Replace the sync modal (560–635) with `ProgressModal`.
- Extract `ReclassificationStats` (287–333 → `StatCard` ×4), `ReclassificationTable` (425–533),
  `Pagination` (535–556), `ReclassificationToolbar` (248–284).
- Type `handleEdit` / `handleVerify` with `Reclassification` instead of `any` (lines 198, 203).
- Move `categoryBadgeClass` (234–239) into the table component.
- ✅ Gate: full CRUD + sync + bulk-delete pass on the page.

---

### Phase D — Remaining pages

**Step 8 — `Dashboard.tsx` (575 → ~150).** *(~4h)*
- Extract all aggregation into `useDashboardMetrics(assets, selectedYear)` — every value memoized,
  including the 8 currently-unmemoized `reduce`s at lines 64–150.
- Extract `KpiRow`, `SubsidiaryBarChart`, `CategoryPieChart`, `TrendChart`, `RecentAssetsPanel`.
- **Fix `key={i}` → `key={asset.id}`** at line 499.
- Reconcile the divergent pagination label with `ui/Pagination` (pick one wording).
- ✅ Gate: Step-2 metric tests green; chart values identical to a pre-refactor screenshot.

**Step 9 — `Reports.tsx` (639 → ~150).** *(~6h — highest logic risk, hence late)*
- Apply `ReportPreview` from `types/report.ts`; **delete `previewData: any`**. Expect the compiler to
  surface latent bugs in the PDF writer — that's the point.
- Extract the three builders into `lib/reports/build*.ts` (pure functions over `Asset[]` /
  `MaintenanceRecord[]`).
- Extract `exportPdf.ts` / `exportXlsx.ts`, using `await import('jspdf')` / `await import('xlsx')`.
- Extract `ReportConfigForm`, `ReportChart`, `ReportHistoryTable`, `ExportPanel`.
- ✅ Gate: Step-2 depreciation tests green; generate all 3 report types and byte-compare the XLSX and
  visually compare the PDF against pre-refactor captures.

**Step 10 — `Settings.tsx`, `MasterData.tsx`, `AIAssistant.tsx`, `Maintenance.tsx`.** *(~5h)*
- `Settings` → one component per tab under `components/settings/`.
  ⚠️ **Also decide what to do about the fake saves** at `Settings.tsx:141–148`: System Config and
  Notifications report success but persist nothing. Either wire them to a `user_preferences` table or
  mark them "Coming soon" like the 2FA toggle already is. *Refactoring around a lie makes it harder to
  spot later.* Same for the hard-coded Unsplash avatar at line 226.
- `MasterData` → single `MasterDataPanel` with `{ title, items, onAdd, onDelete, placeholder }`,
  rendered three times. 152 → ~50 LOC.
- `AIAssistant` → move the markdown renderer (219–307) to `lib/markdown.ts` (now unit-testable) and
  the streaming client to `hooks/useAiChat.ts`.
- `Maintenance` → adopt `DataTable`, `Pagination`, `StatCard`, `ConfirmModal` (replacing the inline
  delete dialog at 124–156).
- ✅ Gate: per-page smoke test.

---

### Phase E — Polish

**Step 11 — Route-level code splitting.** *(~1h)*
- `React.lazy` + `<Suspense>` for all 10 routes in `App.tsx`. Biggest win: `Reports` (jspdf + xlsx +
  html2canvas) and `AIAssistant` leave the initial bundle.
- Add an `<ErrorBoundary>` around the route outlet.
- ✅ Gate: `npm run build` — compare chunk sizes before/after; initial JS should drop substantially.

**Step 12 — Cleanup sweep.** *(~2h)*
- Replace remaining `window.confirm` / `alert` (Inventory 88/170/260, Reclassification 209,
  Reports 230, AddReclassificationModal 79) with `ConfirmModal` / `Toast`.
- Fix `h-[calc(100vh-[180px])]` → `h-[calc(100vh-180px)]` in 3 files.
- Resolve the two `exhaustive-deps` suppressions properly.
- Centralise UI copy in `src/i18n/id.ts` + `en.ts` — even without a full i18n library this stops the
  Indonesian/English mixing and gives `Settings`' language selector something real to switch.
- ✅ Gate: `npm run lint` clean, zero warnings.

---

## 5. Sequencing at a glance

```
A: 0 Tooling ─► 1 Strict TS ─► 2 Characterisation tests
                                      │
B: 3 types/ ─► 4 lib/ (money,csv,dates) ─► 5 components/ui/
                                      │
C: 6 useListFilters ══► Inventory ► Reclassification ► Dashboard ► Maintenance
                                      │
   7 Reclassification decomposition
                                      │
D: 8 Dashboard ─► 9 Reports ─► 10 Settings / MasterData / AIAssistant / Maintenance
                                      │
E: 11 Code splitting ─► 12 Cleanup sweep
```

**Effort:** ~45–50 focused hours. **Expected outcome:** ~4,400 page LOC → ~1,500, with the removed
volume becoming ~1,200 LOC of shared, reused, tested code.

---

## 6. Risk register

| Risk | Where | Mitigation |
|---|---|---|
| Silent report-number changes | Step 4 (currency decimals), Step 9 (typing the engine) | Step-2 characterisation tests + byte-compare exports |
| URL filter links break for users | Step 6 | Keep param names identical; test save-URL → restore-URL |
| Maintenance filters change behaviour visibly | Step 6.5 | It's an intentional upgrade — announce it, don't bury it |
| Modal focus/Esc regressions | Step 5 | Keyboard-test each modal; `Modal` is used everywhere after |
| Strict mode surfaces latent runtime bugs | Step 1 | Good — fix them; that's the value, not the cost |
| Refactoring in parallel with feature work | Throughout | Ship one step per PR; never combine a step with a feature |

---

## 7. Explicitly out of scope

Called out so they aren't mistaken for oversights:

- **Server-side pagination/filtering.** The client-side approach will hit a wall past ~10k assets
  (`AssetContext.tsx:127–140` loads the entire table). Real fix, wrong refactor — track separately.
- **Form validation library** (react-hook-form + zod) for the Add/Edit modals. Worth doing, but it
  changes form behaviour and belongs in its own effort.
- **Settings persistence backend.** Step 10 surfaces the gap and forces a decision; building the
  `user_preferences` table is a feature.
- **Design-token cleanup.** Hard-coded hexes (`#0F172A`, `#45464d`, the `COLORS` array in
  `Dashboard.tsx:134`) sit alongside the Material token classes. Cosmetic; separate pass.

---

## 8. Progress log

| Step | Status | Notes |
|---|---|---|
| 0 — Tooling | ⬜ Not started | |
| 1 — Strict TS | ⬜ Not started | |
| 2 — Characterisation tests | ⬜ Not started | |
| 3 — `src/types/` | ⬜ Not started | |
| 4 — `lib/` extraction | ⬜ Not started | |
| 5 — `components/ui/` | ⬜ Not started | |
| 6 — `useListFilters` | ⬜ Not started | |
| 7 — Reclassification | ⬜ Not started | |
| 8 — Dashboard | ⬜ Not started | |
| 9 — Reports | ⬜ Not started | |
| 10 — Settings/MasterData/AI/Maintenance | ⬜ Not started | |
| 11 — Code splitting | ⬜ Not started | |
| 12 — Cleanup sweep | ⬜ Not started | |
