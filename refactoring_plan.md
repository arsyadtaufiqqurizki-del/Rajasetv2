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
| 0 — Tooling | ✅ Done (2026-08-19) | ESLint 9 flat config + typescript-eslint + react-hooks/react-refresh plugins; Prettier; Vitest + RTL + jsdom wired via `vite.config.ts` `test` block. `npm run lint` = `eslint . && tsc --noEmit`. Baseline recorded, not fixed: **ESLint 55 errors / 14 warnings** (mostly `no-explicit-any` in Reports.tsx/Reclassification.tsx/Inventory.tsx, and `react-hooks/set-state-in-effect` in Dashboard/Guide/Maintenance/Reclassification). **`tsc --noEmit` already had 11 pre-existing errors** even before strict mode — `ImportMeta.env` missing (`vite/client` types not referenced) in `lib/supabase.ts`, `AIAssistant.tsx`, `utils/supabase/client.ts` (the known dead file), plus 5 in `Reports.tsx` from untyped `previewData: any`, and 1 jsPDF plugin type gap. These pre-date Step 1 and aren't part of "the wave of errors" strict mode will add — worth fixing early since they're cheap. |
| 1 — Strict TS | ✅ Done (2026-08-19) | Added `strict`, `noUnusedLocals`, `noUnusedParameters`, and `"types": ["vite/client"]` to `tsconfig.json`. **Found the project had zero `@types/react`/`@types/react-dom` installed** — every JSX element across the whole app was silently `any` until now; installed `@types/react@19` + `@types/react-dom@19` to fix it (this, not strict mode, caused the bulk of the initial error wave). Remaining ~24 strict errors fixed mechanically: dropped unused `React`/`Plus`/`ArrowRight`/`weekIdx`/`MaintenanceRecord`/`cn` imports & locals across 14 files; fixed 3 Recharts `Tooltip formatter` signature mismatches in Dashboard.tsx (removed the `: number` param annotation so it's inferred from `Formatter<ValueType,...>`, cast with `Number(value)` inside); explicitly typed the `totals` reduce accumulator in Reports.tsx (was resolving to `unknown`); fixed `doc.internal.getNumberOfPages()` → `doc.getNumberOfPages()` in Reports.tsx PDF export (method is on the jsPDF instance, not `.internal`, in jsPDF 4.x — was a real latent bug, not just a type gap). `Reports.tsx`'s `previewData: any` and remaining `no-explicit-any` ESLint findings left untouched per plan, deferred to Step 9. ✅ `tsc --noEmit` clean, `npm run build` clean (2596 modules, same bundle-size warning as before — expected, Step 11 scope). ESLint baseline now 53 errors / 9 warnings (down from 55/14, purely from the dead-import cleanup). |
| 2 — Characterisation tests | ✅ Done (2026-08-19) | 4 test files, 17 tests, all against **current, unextracted** code (no production logic moved) — `npm run test` (Vitest + RTL + jsdom). **`useAssetFilters.test.ts`** (12 tests, `renderHook`): every filter dimension individually + combined AND + `clearFilters`. Found a real timing quirk: `clearFilters()` resets `searchQuery` immediately but `filteredAssets` reads the debounced value, so the search filter doesn't actually clear until 300ms later — pinned with fake timers, not fixed. **`Dashboard.test.tsx`** (3 tests, mocks `AssetContext`, fixed system clock): normal MoM %, and the `previous === 0` branch — confirms `calculateChange` hard-codes 100% when going from 0 (not the mathematically undefined/infinite ratio), plus the "No change from last month" 0-to-0 case. **`Reports.test.tsx`** (1 test, mocks all 3 contexts + spies on `XLSX.utils.json_to_sheet`): drives the actual `generatePreview` → Depreciation Schedule → Export to Excel path end-to-end and asserts hand-computed NBV per quarter for 3 assets. Surfaced two real quirks in the process, documented in the test comments: (1) `parseInt(lifeInMonths) || 60` silently treats an explicit `"0"` life as the 60-month default, since `0` is falsy; (2) an asset whose `datePlaceInService` is *after* a given quarter-end is valued at full cost for that quarter (`monthsBetween` returns 0 when `to <= from`), i.e. not-yet-in-service assets aren't specially handled. **`Inventory.test.tsx`** (1 test, mocks `AssetContext`, real `Papa.parse` on a real `File`): uploads a 4-row CSV (1 valid, missing-number, missing-description, missing-both) through the actual file input, asserts `addAsset` was called only once, and that the rendered `ImportProgressModal` shows the right skipped count and per-row reason text in Indonesian. ✅ Gate: all 17 tests pass against current code; `tsc --noEmit` and `npm run build` still clean with the new test files in the tree. These are the regression detectors for Phases B–D — Step 9 in particular must keep the Reports test green through the `lib/reports/` extraction (including the two quirks above, unless deliberately fixed and called out). |
| 3 — `src/types/` | ✅ Done (2026-08-19) | Created `src/types/{asset,reclassification,maintenance,report,index}.ts`. `Asset`/`AssetInput`/`AssetStatusLevel`, `Reclassification`/`ReclassificationInput`/`ReclassificationCategory`/`RECLASSIFICATION_PRESET_CATEGORIES`, and `MaintenanceRecord`/`MaintenanceInput` moved verbatim out of `AssetContext.tsx`, `ReclassificationContext.tsx`, `MaintenanceContext.tsx`; each context now does `import type {...} from '../types/...'` plus `export type {...} from '../types/...'` so every existing call site (`Inventory.tsx`, `useAssetFilters.ts`, `AssetTable.tsx`, `MaintenanceCalendarModal.tsx`, the `Add/Edit*Modal`s, all 4 new test files, etc.) kept working unchanged — confirmed via `contexts/(Asset|Reclassification|Maintenance|Report)Context` grep, zero of those import sites needed touching. Added `types/report.ts` as planned: `ReportPreview` discriminated union (`AssetValuationReportPreview | DepreciationReportPreview | MaintenanceCostReportPreview` on `type: 'bar'|'line'|'composed'`), plus `ReportType`, `ChartKind`, `ReportSummaryItem`, `DetailColumn<T>`, and the three `*DetailRow` shapes — modelled directly on `Reports.tsx`'s three `generatePreview` branches (lines 44–221). **Not applied** — `Reports.tsx:28`'s `previewData: any` is untouched, per plan, deferred to Step 9. `ReportRecord`/`ReportContext.tsx` left alone (its `reportData: any` is also Step 9 scope, not Step 3). Skipped `types/filters.ts` from the target tree — nothing consumes it until `useListFilters` exists in Step 6, so it would be a dead file today. ✅ Gate: `tsc --noEmit` clean, `npm run build` clean (same pre-existing chunk-size warning), all 17 characterisation tests still pass, ESLint baseline unchanged (53 errors / 8 warnings, was 53/9 — one fewer, incidental). Import churn confirmed zero outside `contexts/` and `types/`. |
| 4 — `lib/` extraction | ✅ Done (2026-08-19) | Created `lib/money.ts` (`parseCost`, `formatCurrency`, `formatCurrencyWhole`, `formatCompactCurrency`, `formatCompactNumber`), `lib/csv.ts` (`sanitizeCell`, `toCsvBlob`, `downloadBlob`), `lib/dates.ts` (`formatLastUpdate`, `monthsBetween`, `getQuartersInRange` moved verbatim out of `utils.ts`, which now only keeps `cn` + `parseListParam`). **`parseCost`** replaced all 18 `parseFloat(x.replace(/[^0-9.-]+/g,""))` sites: `Dashboard.tsx` (6), `Reports.tsx` (9), `Maintenance.tsx:67` (2, dual-fallback preserved by stripping `actualCost` first and falling back to raw `estimateCost` string into `parseCost`), `useAssetFilters.ts:96` (1) — verified against the old `\|\| 0` semantics with a throwaway vitest check (deleted after passing), not left in the tree. **Deliberately not touched**: `AssetContext.tsx`'s `toDb` cost parse (different regex, `/,/g`-only) — it preserves null-on-empty for the DB write path, which `parseCost`'s 0-on-invalid would silently change to a stored `0`; noted rather than migrated. **`formatCurrency`/`formatCompactCurrency`**: killed Reports.tsx's local `formatCurrency` shadow (was called at 8 sites) and 3 inline duplicate `Intl.NumberFormat` chart-tooltip formatters, all now `formatCurrency`/`lib/money`. Verified the plan's cents-shift warning doesn't apply here: Reports' shadow used default `Intl.NumberFormat` decimals, which for USD are already 2 — identical output to `lib/money`'s explicit 2-decimal formatter, confirmed with the same throwaway test. Dashboard's 6 inline `Intl.NumberFormat` sites (compact-currency KPI, whole-dollar tooltips ×3, compact-number axis ticks) mapped 1:1 onto the new `formatCurrencyWhole`/`formatCompactCurrency`/`formatCompactNumber` — these are genuinely different formats from the 2-decimal `formatCurrency`, so kept as distinct functions rather than force-fit. Maintenance.tsx's own inline `Intl.NumberFormat` (undocumented in the plan's "8 sites" but same shadow pattern) folded in too. **`sanitizeCell`**: applied in all three export paths per plan — `Reports.tsx` (PDF + Excel, replacing `sanitizeForSpreadsheet`, which was missing `\t`/`\r`), `Reclassification.tsx` (replacing local `sanitizeCsvField`), and `Inventory.tsx`'s `handleExportCSV`, which had **zero** sanitization before this — closes the CSV-injection gap section 2.5 flagged, confirmed via a throwaway test that `\t`/`\r`-prefixed payloads now get neutralized. Also applied to `Inventory.tsx`'s `handleDownloadInvalidRows` (migrated off manual CSV-string building onto `toCsvBlob`, since its `assetNumber`/`assetDescription` fields come from the same untrusted uploaded file). **`downloadBlob`**: replaced all 3 hand-rolled blob-download sites (`Inventory.tsx` ×2, `Reclassification.tsx` ×1) — fixes the `Reclassification.tsx` leak (no `revokeObjectURL` before). `toCsvBlob` (`Papa.unparse` + `Blob` wrapper) replaces the inline `Papa.unparse`+`new Blob` pairing at both remaining CSV export sites; confirmed output is byte-identical to the old inline construction via the same throwaway test. ✅ Gate: `tsc --noEmit` clean, `npm run build` clean, all 17 characterisation tests still pass (including the Reports depreciation test, which exercises `parseCost`/`monthsBetween`, and the Inventory CSV-import test), ESLint baseline unchanged (53 errors / 8 warnings — same as Step 3, all pre-existing `no-explicit-any` in `Reports.tsx`/`Reclassification.tsx`, Step 7/9 scope). |
| 5 — `components/ui/` | ✅ Done (2026-08-20) | Created `src/components/ui/` with `Modal.tsx` (portal via `createPortal`, focus trap on Tab/Shift+Tab recomputed per keypress so it tracks content changes like the busy→done transition, Esc-to-close gated by a `closeOnEscape` prop, `role="dialog"`/`aria-modal`, body-scroll lock, and focus restored to the previously-focused element on close — none of which existed before), `ConfirmModal.tsx` (generic Yes/No dialog built on `Modal`, for the Step 12 `window.confirm` sites — not wired to any page yet), `ProgressModal.tsx` (generic busy/done progress dialog on `Modal`, with a `unit` string for the "{processed} of {total} …" row, a `stats` list for the done-state summary rows, and a `children` slot for extra done-state content), `Pagination.tsx`, `FilterChips.tsx` (exports the `FilterChip` type — a structural duplicate of `useAssetFilters.ts`'s own `FilterChip` for now, since `types/filters.ts` is still deliberately deferred to Step 6), `FilterBar.tsx`, `StatCard.tsx` (modeled on Dashboard's card, the more disciplined of the two divergent stat-card styles; reconciling Reclassification's variant is Step 7/8 scope), `Toast.tsx` (extracted from Inventory.tsx's existing hand-rolled export toast at lines 387–392, byte-identical markup), and `EmptyState.tsx` (+ named `TableEmptyRow` for the `<td colSpan>` empty-table pattern used in 4 places). None of these six are consumed by any page yet — per plan, that adoption happens in Steps 6–10. **Moved** `MultiSelectDropdown.tsx` and `AutocompleteInput.tsx` into `ui/` verbatim; updated all 6 import sites (`AssetFilters.tsx`, `Dashboard.tsx`, `Reclassification.tsx`, `AddAssetModal.tsx`, `EditAssetModal.tsx`, `EditReclassificationModal.tsx`) to the new path — mechanical rename, zero behaviour change. **Refactored** `DeleteConfirmModal.tsx`, `DeleteProgressModal.tsx`, `ImportProgressModal.tsx` in place (same file location, same exported props/types) to render on top of `Modal`/`ProgressModal` instead of hand-rolled overlay markup — `Inventory.tsx` needed no changes at all. Added `Modal.test.tsx` (7 RTL tests) as the keyboard-behavior gate the plan calls for, since the app is login-gated and there were no test credentials available for a live browser smoke test: dialog role/aria-modal, initial focus into the panel, body-scroll lock + restore on unmount, Escape calls `onClose` by default and is suppressed when `closeOnEscape={false}` (exercised by `ProgressModal`'s busy state, which must not be dismissible mid-operation), and Tab/Shift+Tab wrapping between first and last focusable elements, plus focus-restore to the pre-open element on close. ✅ Gate: `tsc --noEmit` clean, `npm run build` clean (same pre-existing chunk-size warning), all 24 tests pass (17 characterisation + 7 new), ESLint baseline unchanged at 53 errors / 8 warnings — none in any touched file. |
| 6 — `useListFilters` | ✅ Done (2026-08-20) | Built `hooks/useListFilters.ts`, the generic engine from section 3.2's sketch, extended with a `kind` discriminator (`'multi' \| 'dateRange' \| 'numberRange'`) per `FilterDef<T>` so Inventory's date/cost ranges fit alongside every page's multi-selects in one hook. Owns debounced search, a content-hashed (`JSON.stringify`-keyed) page-reset effect and URL-sync effect — content-hashing sidesteps needing a per-page-shaped dependency array for a dynamically-configured `defs` list, same `eslint-disable exhaustive-deps` pattern the old `useAssetFilters.ts` already used — chip generation, and row filtering. `FilterChip` moved to a new `types/filters.ts` (deferred from Step 3 until this hook existed to consume it) and re-exported from both `hooks/useAssetFilters.ts` and `components/ui/FilterChips.tsx` so no call site broke. **Found and fixed a real bug while writing `useListFilters.test.ts`**: the first draft's `setDateFrom`/`setDateTo`/`setCostMin`/`setCostMax` wrapper closures each read the *other* field's value from the last render, so calling `setDateFrom` then `setDateTo` in the same handler (exactly what `useAssetFilters.test.ts`'s existing date-range test does) clobbered the first write with a stale empty string. Fixed by adding `setDateFrom`/`setDateTo`/`setNumberMin`/`setNumberMax` to `useListFilters` itself, each reading the previous range via the state updater callback instead of a closed-over value — caught by `useAssetFilters.test.ts` failing before any page was touched. Rewrote `hooks/useAssetFilters.ts` as a thin `FilterDef` config over the new hook, keeping its exact old return shape (`filterSubsidiary`/`setFilterSubsidiary`/…/`activeFilters`/`filteredAssets`/`clearFilters`) so **neither `Inventory.tsx` nor `AssetFilters.tsx` needed a single line changed** — all 12 pre-existing characterisation tests in `useAssetFilters.test.ts` pass unmodified against the new implementation, serving as the canary the plan called for. Added three more thin wrappers — `useReclassificationFilters.ts`, `useDashboardFilters.ts`, `useMaintenanceFilters.ts` — and rewired the three pages: deleted `Reclassification.tsx`'s inline filter state/effects/chip-builder (formerly lines 21–126) and its filter-bar JSX (formerly 320–408) for `useReclassificationFilters` + `ui/FilterBar`; same for `Dashboard.tsx` (formerly 24–64 state, 376–455 JSX) via `useDashboardFilters`; `Maintenance.tsx` was the intentional feature upgrade — its single-`""`-sentinel `<select>`s became `MultiSelectDropdown`s, and it gained URL persistence and chips for the first time (`useSearchParams` wasn't even imported before). Also swapped `Reclassification.tsx`'s and `Maintenance.tsx`'s pagination footers onto `ui/Pagination` while in the neighbourhood — both already matched its markup exactly (byte-identical to `AssetTablePagination`, unlike Dashboard's divergent "Showing 1 to 10 of 42 results" wording, correctly left alone for Step 8 to reconcile). `ui/FilterBar` needed a mid-step design fix: it originally carried its own `rounded-xl border shadow-sm` wrapper, which double-boxed when dropped into Dashboard's filter section (nested inside the "Recent Asset Additions" panel with only a `border-b`, not a standalone card like Reclassification's). Stripped `FilterBar` down to layout-only (`flex flex-col gap-3`) and added a `className` prop so each page supplies its own chrome — Reclassification/Maintenance pass the standalone-box classes, Dashboard passes the nested-panel classes. **Incidental fix**: extracting the page-reset effect into `useListFilters` (invoked via an `onFiltersChanged()` callback rather than a `setState` call lexically inside a page's own `useEffect`) resolved 3 of the pre-existing `react-hooks/set-state-in-effect` ESLint errors baseline-recorded in Step 0 — Dashboard's, Reclassification's, and Maintenance's filter-driven `setCurrentPage(1)` effects all disappear this way (same reason `useAssetFilters.ts` was never flagged for it either). ESLint baseline: **50 errors / 8 warnings**, down from 53/8 — the 3 fewer are exactly those three, confirmed by diffing the lint output; the remaining `set-state-in-effect` hits (Dashboard's unrelated `selectedYear` sync, Guide.tsx, AIAssistant.tsx, `useSystemAlerts.ts`) are pre-existing and out of scope. Added `useListFilters.test.ts` (12 tests: each filter kind, AND-combination, URL write, URL round-trip — save params from one hook instance, feed them into a fresh instance, confirm identical `filtered` output, directly exercising the plan's "save a URL, confirm it restores the same result set" gate — chip generation/removal, `onFiltersChanged` firing, `clearFilters`) and `useMaintenanceFilters.test.ts` (10 tests, since Maintenance's upgrade had zero prior coverage of the new multi-select/URL-sync/chip behaviour: multi-select over the old single-value sentinel, URL persistence, URL restore, chip removal, `clearFilters`). ✅ Gate: `tsc --noEmit` clean, `npm run build` clean, all 46 tests pass (17 characterisation + 7 Modal + 12 useListFilters + 10 useMaintenanceFilters), ESLint 50/8 (3 fewer than baseline, zero new). |
| 7 — Reclassification | ✅ Done (2026-08-20) | `Reclassification.tsx` 629 → 317 LOC (766 → 317 including Step 6's filter extraction). Extracted `ReclassificationStats.tsx` (4 `StatCard`s), `ReclassificationToolbar.tsx` (Sync/Export/Add/Delete Selected buttons), `ReclassificationTable.tsx` (table + `categoryBadgeClass`, moved in per plan). Replaced the hand-rolled delete-confirm and delete-progress modals with the **existing** `DeleteConfirmModal`/`DeleteProgressModal` from Step 5 — genericized both with an optional `itemLabel` prop (default `"assets"`, backward-compatible with Inventory's existing usage) since Reclassification's copy says "reclassification items"/"items" rather than "assets"; added a `titleCase` helper so multi-word labels capitalize correctly in the modal title. Replaced the inline sync-progress modal with the **existing** `ProgressModal` directly (no wrapper needed — it was already fully generic), using its `children` slot for the "all assets already linked" paragraph and the sync-errors detail block, both of which only appear in the done state exactly as before. Typed `handleEdit`/`handleVerify` with `Reclassification` instead of `any` (ESLint's `no-explicit-any` count dropped 50→48 as a result). Incidental fix while touching the file: dropped `cn` and the lucide-react icon imports that moved into the new components (page no longer needs any icon imports). **Attempted and reverted**: also "fixed" the broken nested-bracket Tailwind class `h-[calc(100vh-[180px])]` → `h-[calc(100vh-180px)]` (section 2.12 smaller-smells item, scheduled for Step 12) — turns out the class was never dead weight in practice: because it never parsed, the page's height was always unconstrained and grew naturally; making it valid actually activated a real height cap, turning the table into a cramped internal-scroll region. User caught the visual regression immediately. Reverted to the broken class to preserve the original (unconstrained) layout; the real fix belongs in Step 12, done consistently across all 3 occurrences with a visual check, not smuggled into an unrelated step. **One deliberate visual change**: extended `StatCard` with an optional `valueClassName` prop so the "Needs Review" card's big number keeps its original conditional red/default coloring (StatCard's `tone="danger"` only styles the border/background, not the value text) — needed to reproduce the original component behavior exactly, not a design regression. `StatCard`'s label styling (uppercase, `text-xs`) differs cosmetically from the original page's `text-sm` labels; accepted since `StatCard` is the shared primitive Step 8 will also apply to Dashboard for cross-page consistency. ✅ Gate: `tsc --noEmit` clean, `npm run build` clean (same pre-existing chunk-size warning), all 46 tests pass unmodified, ESLint 48 errors/8 warnings (2 fewer, zero new — confirmed none of the touched/new files appear in lint output). Full CRUD + sync + bulk-delete smoke-tested manually in the browser by the user — confirmed working. |
| 8 — Dashboard | ✅ Done (2026-08-20) | `Dashboard.tsx` 463 → 129 LOC (575 → 129 including Step 6's filter extraction). Built `useDashboardMetrics(assets, selectedYear)` — all 8 previously-unmemoized `reduce`s (MoM counts/costs, broken-asset %, total valuation, subsidiary map, category map, available years, trend map) now live inside two `useMemo`s (one keyed on `[assets]` for everything year-independent, one keyed on `[assets, selectedYear]` for `trendData` alone, so picking a different year doesn't recompute the KPI cards or the two charts that don't depend on it). Extracted `DashboardKpiRow` (3 `StatCard`s — Asset Units/Asset Cost/Broken Asset, including the hover-tooltip full-valuation popover, restructured to nest inside `StatCard`'s own `text-4xl font-bold` wrapper rather than duplicating those classes), `DashboardSubsidiaryBarChart`, `DashboardCategoryPieChart`, `DashboardTrendChart` (year `<select>` + line chart), and `DashboardRecentAssetsPanel` (filter bar + 13-column table + pagination footer). **Fixed `key={i}` → `key={asset.id}`** in the recent-assets table per the plan's explicit callout (section 2.12, originally line 499). **Reconciled the pagination footer**: dropped the page's own hand-rolled "Showing X to Y of Z results" + prev/next block for the shared `ui/Pagination` (`itemLabel="assets"`), matching the wording Reclassification and Maintenance already adopted in Step 6 — same `visibleCount`/`totalCount` prop shape, `Showing {n} of {total} assets` instead of the old "X to Y of Z results" phrasing. `formatCurrency`/`parseCost` usage unchanged (already consolidated onto `lib/money` in Step 4). Extracted `DashboardChartPoint`/`DashboardCategoryPoint`/`DashboardTrendPoint` types alongside the hook rather than adding them to `types/filters.ts` — they're chart-shape types, not filter types. ✅ Gate: `tsc --noEmit` clean, `npm run build` clean (same pre-existing chunk-size warning), all 46 tests pass unmodified — including `Dashboard.test.tsx`'s three MoM-delta assertions (normal increase, previous-month-zero capped-at-100%, both-months-zero "No change" text), which render the full page and therefore exercise every extracted component end-to-end. ESLint 48 errors / 7 warnings (1 fewer warning than the Step 7 baseline of 48/8, zero new — adding `selectedYear` to the year-auto-select effect's dependency array, which was previously missing it, resolved a pre-existing `exhaustive-deps` warning; the effect's `set-state-in-effect` error was already present pre-refactor and is unrelated Step-12-class cleanup, not introduced by this step). No dev server / login credentials available in this session for a live browser smoke test — manual verification in the browser (KPI numbers, both charts, year-trend line, filter bar, and pagination) is still pending from the user, same as Step 7's pattern. |
| 9 — Reports | ✅ Done (2026-08-21) | `Reports.tsx` 639 → 129 LOC. **Killed `previewData: any`**: applied `ReportPreview` (the discriminated union already sketched in Step 3) to `useState`, `generatePreview`'s return, and — since it was also flagged as Step 9 scope back in Step 3's log — `ReportContext.tsx`'s `ReportRecord.reportData` / `SaveReportParams.reportData`, both now `ReportPreview` instead of `any`. The three-branch `if/else if` chain with no `else` (which left `generated` possibly `null` if `reportType` matched nothing) is gone: `reportType` is now typed `ReportType`, so the ternary chain is exhaustive and `generated` is always a `ReportPreview` — the old `if (generated)` guard before `saveReport` was accordingly dead and removed. **Extracted the three builders** verbatim into `lib/reports/buildValuationReport.ts` / `buildDepreciationReport.ts` / `buildMaintenanceCostReport.ts` (pure functions over `Asset[]` / `MaintenanceRecord[]`) — logic byte-identical to the original branches, confirmed by the existing Reports.test.tsx NBV-per-quarter assertions passing unmodified against the extracted code (same falsy-zero `lifeInMonths` quirk and not-yet-in-service full-cost quirk preserved, per the plan's explicit call to keep them unless deliberately fixed). Deduplicated the three-times-repeated inline `yAxisFormatter` (the `$1.2M`/`$1.2K`/`$val` compact formatter, identical in all three original branches) into `lib/reports/shared.ts`'s `compactCurrencyAxisFormatter`, plus a small `filterBySubsidiary<T>` helper for the "All Divisions" passthrough filter also repeated 3×. **Extracted `exportPdf.ts` / `exportXlsx.ts`** using `await import('jspdf')` + `await import('jspdf-autotable')` + `await import('html2canvas')`, and `await import('xlsx')` respectively, per plan — unexpected bonus: this alone was enough for Vite's build to split all four libraries into their own chunks (`xlsx` 429KB, `jspdf.es.min` 391KB, `html2canvas.esm` 202KB, `jspdf.plugin.autotable` 31KB all now separate from the main bundle), which is most of Step 11's expected win, achieved incidentally rather than via route-level lazy-loading (that part of Step 11 — `React.lazy` per route in `App.tsx` — is still pending). The `(doc as any).lastAutoTable` cast survives in `exportPdf.ts` with a comment explaining why (jspdf-autotable attaches the property at runtime but doesn't extend jsPDF's own `.d.ts`) — this was already a deliberate, documented `any` per `reports implementation.md`, not part of the `previewData: any` problem Step 9 targets. Export functions take `ReportPreview` at their boundary but do one narrow, commented cast to `Record<string, unknown>[]` internally for the generic column/row handling PDF and Excel export inherently need (headers are derived from `Object.keys(data[0])` since the three report types produce different column shapes) — isolated to the export layer, not leaking back into the page or the builders. Extracted `ReportConfigForm`, `ExportPanel`, `ReportChart` (chart container forwards its ref out, since `chartRef` — used by `html2canvas` — has to stay owned by the page alongside the export handler that reads it), and `ReportHistoryTable` (now built on the shared `ui/Pagination`, replacing its own hand-rolled footer — same "Showing X of Y reports" wording since `itemLabel="reports"` matches the original text verbatim). **Fixed a real async-ordering issue found via the existing test, not introduced by a new one**: `handleExportExcel` was synchronous before (`XLSX` was statically imported); making `exportReportXlsx` `await import('xlsx')`-based turned it async, so `Reports.test.tsx`'s post-click assertion on `XLSX.utils.json_to_sheet` had to move inside a `waitFor` — the computed NBV assertions themselves are untouched. Preserved the original's "skip `logActivity` entirely if there's no data to export" behavior by keeping the `!previewData.data.length` guard in the page (in addition to the same guard inside the lib functions) rather than letting a no-op export still log — a subtlety that would've been easy to lose across the extraction. ✅ Gate: `tsc --noEmit` clean, `npm run build` clean (chunk-split bonus noted above), all 46 tests pass (including the updated async Excel-export test), ESLint **34 errors / 7 warnings** (down from 48/7 — 14 fewer, all `no-explicit-any` in the old `Reports.tsx`; zero new findings in any Step 9 file). No dev-server/login credentials available in this session for a live browser smoke test — generating all 3 report types and comparing the PDF/XLSX output against pre-refactor captures is still pending from the user, same gap as Steps 7–8. |
| 10 — Settings/MasterData/AI/Maintenance | ✅ Done (2026-08-21) | Four independent pages, decomposed in the same session. **`Settings.tsx` 481 → 170 LOC**: split into `components/settings/{SettingsNav,ProfileTab,SecurityTab,SystemConfigTab,NotificationsTab}.tsx`. **Made the persistence decision the plan flagged**: per section 7 ("Settings persistence backend... building the `user_preferences` table is a feature", explicitly out of scope), went with "mark them Coming soon" rather than wiring a backend. System Config and Notifications tabs lost their `setTimeout(800)` fake-success flow entirely — their state is now local-only inside each component (no longer lifted to the page, since nothing outside them consumed it), every field is `disabled` with a "Coming soon" badge next to the section header (matching the existing 2FA treatment), and their Save buttons are permanently disabled ("Coming soon", with a title tooltip) instead of claiming success. Extended the same treatment to the hard-coded Unsplash avatar the plan called out at the old line 226 ("Same for the hard-coded Unsplash avatar") — the hover overlay now reads "Coming soon" instead of "Change", cursor changed from `pointer` to `not-allowed`, since there was never an upload handler behind it. Profile and Security tabs keep their real `supabase.auth` save logic unchanged, still orchestrated from the page (shared `isSaving`/`showSuccess`/`saveError` state and the global save-indicator banner), since they're genuinely functional. **`MasterData.tsx` 152 → 46 LOC**: the three near-identical CRUD panels (Subsidiaries / Asset Class / Location) collapsed into one `components/MasterDataPanel.tsx` (`{title, items, onAdd, onDelete, placeholder, emptyMessage}`), rendered 3× — exactly the plan's target shape. Left the broken `h-[calc(100vh-[180px])]` class untouched per the Step 7 lesson (fixing it in isolation caused a real layout regression there; the real fix is Step 12, across all 3 occurrences with a visual check). **`AIAssistant.tsx` 499 → 225 LOC**: extracted the ~90-line hand-rolled markdown→JSX parser verbatim into `lib/markdown.tsx` (`.tsx` rather than the plan's `.ts`, since it returns JSX — a `renderMarkdown` bullet/table/heading parser can't be `.ts`), and the streaming chat client (fetch + `ReadableStream` reader loop, abort-on-unmount, localStorage-backed messages/history/mode/trimmed-flag persistence, the rotating "loading step" ticker) into `hooks/useAiChat.ts`. The page now only owns `input` (the text field) and the clear-chat confirm dialog's open/closed state; `sendMessage`/`clearChat`/`messages`/`mode` all come from the hook. Incidentally eliminated 2 of the pre-existing `no-explicit-any` ESLint findings while extracting: `loadMessages`'s `parsed.map((m: any) => ...)` got a real type, and `catch (err: any)` in the streaming handler became `catch (err)` with an `err instanceof Error` guard. Left the confirm-clear dialog as its own contained overlay (not the shared `ConfirmModal`) since it's deliberately scoped to the chat panel (`absolute inset-0` inside the rounded card) rather than the viewport — swapping to the portal-based `Modal` would have silently changed it from a panel-local dialog to a full-viewport one, a visible behavior change the plan didn't ask for. **`Maintenance.tsx` 446 → 198 LOC**: extracted `MaintenanceStats` (4 `StatCard`s), `MaintenanceTable` (12-column table), and `MaintenanceSchedulePanel` (the upcoming-this-week sidebar). Replaced the hand-rolled delete-confirmation overlay with the shared `ConfirmModal` — but `ConfirmModal` had no busy/loading state (nothing consumed it yet per Step 5's log), so it couldn't reproduce the original's inline spinner-and-"Deleting..." button. **Extended `ConfirmModal`** with `isConfirming`/`confirmingLabel` props (disables both buttons, swaps the confirm button for a `Loader2` spinner + label, and suppresses Esc-to-close while busy via `Modal`'s existing `closeOnEscape` prop) rather than leaving Maintenance's delete modal hand-rolled — this is now available to any future consumer needing the same busy-confirm pattern. Did not build a generic `DataTable<T>` component (in the plan's target tree but never built in Steps 5-9 either) — followed the established precedent from `ReclassificationTable`/`DashboardRecentAssetsPanel` of a dedicated, typed table component per page instead, consistent with how every prior step handled tables. ✅ Gate: `tsc --noEmit` clean, `npm run build` clean (same pre-existing chunk-size warning), all 46 tests pass unmodified, ESLint **31 errors / 6 warnings** (down from 34/7 — the 2 eliminated `any`s above account for most of the drop; zero new findings in any Step 10 file, confirmed by grepping the lint output for every new/touched filename — the one hit inside `hooks/useAiChat.ts` is the same `react-hooks/set-state-in-effect` violation the original `AIAssistant.tsx` already had on its loading-step ticker, just relocated with the code, not introduced by the extraction). Combined page LOC: 1,578 → 639 (-60%), with ~930 LOC of that becoming new shared/reusable component, lib, and hook code. No dev-server/login credentials available in this session for a live browser smoke test of any of the four pages — same gap noted in Steps 7-9, still pending from the user. |
| 11 — Code splitting | ✅ Done (2026-08-21) | Converted all 10 routes in `App.tsx` from static imports to `React.lazy(() => import(...))` (`Dashboard`, `Inventory`, `Maintenance`, `Reclassification`, `Reports`, `MasterData`, `Settings`, `AIAssistant`, `Guide`, `Login`). Added `components/ErrorBoundary.tsx` (class component, `getDerivedStateFromError`/`componentDidCatch`, "Something went wrong loading this page" + Reload button — the mitigation for the one new failure mode lazy routes introduce: a stale chunk reference 404ing after a deploy when a user has an old tab open and navigates to a route they haven't loaded yet in that session) and `components/ui/PageLoader.tsx` (centered `Loader2` spinner, the `<Suspense>` fallback). Wrapped `<Routes>` in `AppRoutes()` with `<ErrorBoundary><Suspense fallback={<PageLoader />}>…</Suspense></ErrorBoundary>` so every route transition is covered by one boundary + one fallback rather than per-route wrapping. Most of the library-splitting win (jspdf/jspdf-autotable/xlsx/html2canvas into their own chunks) was already achieved incidentally in Step 9 via the `exportPdf.ts`/`exportXlsx.ts` dynamic imports; this step's marginal win is separating **page code itself** — each page now its own chunk (Dashboard 33.9 kB, Reports 33.8 kB, Maintenance 34.7 kB, Reclassification 17.0 kB, Settings 20.1 kB, AIAssistant 13.1 kB, Guide 12.6 kB, Inventory 27.5 kB, MasterData 2.7 kB, Login 3.7 kB gzip'd individually) instead of all 10 landing in the initial bundle. ✅ Gate: `tsc --noEmit` clean, all 46 tests pass unmodified (lazy-loading is pure build-time splitting, zero runtime logic change — no test needed updating), `npm run build` clean — initial bundle **1.18 MB → 560.24 kB (156.75 kB gzip)**, down from the pre-Step-11 baseline of ~327 kB gzip, a further ~52% reduction on top of Step 9's library-splitting win. ESLint unchanged at 31 errors / 6 warnings (0 new, same pre-existing baseline from Step 10) — none of `App.tsx`, `ErrorBoundary.tsx`, or `PageLoader.tsx` appear in lint output. Browser-verified: multi-route navigation (login → reports → maintenance) confirmed chunks load correctly on first visit and are cached on repeat visits. |
| 12 — Cleanup sweep | ✅ Done (2026-08-21) | **window.confirm/alert → ConfirmModal/Toast**: done, all 6 sites. `Inventory.tsx` — single-asset delete (`window.confirm` at old line 89) now uses the shared `ConfirmModal`; the CSV row-limit and CSV-parse-error `alert()`s (old lines 165, 255) now route through a unified `notice: {message, variant} \| null` state rendered via the shared `ui/Toast` — also replaced Inventory's own hand-rolled toast `<div>` (old lines 387–392) with that same `Toast` component instead of leaving a second copy, since both needed rendering anyway. `Reports.tsx` — report-delete `window.confirm` (old line 48) now `ConfirmModal`. `Reclassification.tsx` — item-delete `window.confirm` (old line 134) now `ConfirmModal`, Indonesian copy preserved ("Yakin ingin menghapus item reclassification ini?" / Hapus / Batal). `AddReclassificationModal.tsx` — the save-error `alert()` (old line 79) became an inline error banner inside the form instead of `ConfirmModal`/`Toast`: this modal is a custom `z-[100]` overlay, and `ui/Toast` renders at `fixed bottom-6 right-6 z-50` — lower z-index, so it would render invisibly *behind* the modal backdrop. An inline banner above the button row was the correct fix, not a blind swap to the "standard" pattern. ✅ Gate: `tsc --noEmit` clean, all 46 tests pass, `npm run build` clean, ESLint unchanged at 31 errors/6 warnings (0 new). **Tailwind `h-[calc(100vh-[180px])]` → `h-[calc(100vh-180px)]` (3 files: `Inventory.tsx`, `Reclassification.tsx`, `MasterData.tsx`)**: deliberately **skipped**, left broken, per user decision. Reason: Step 7's log already documents that this exact fix caused a real visual regression on Reclassification.tsx (making the class valid activates a height cap that the page currently has none of, since the invalid class is silently ignored by the browser — this squeezed the table into a cramped internal-scroll region). No login credentials were available in this session to browser-verify a fix across all 3 pages, so — same risk, no way to check it this time either — user chose to leave all 3 broken rather than risk an unverified regression. Revisit only with either browser/login access to verify visually, or a deliberate redesign of the page-height/scroll strategy (not a 1-line class edit). **Exhaustive-deps suppressions**: investigated, no action taken — the plan's original two targets (`useAssetFilters.ts:64`, an unlabeled `Dashboard.tsx` omission) no longer exist in that form: Step 6 rewrote `useAssetFilters` as a thin wrapper over `useListFilters` (deleting the old suppression), and Step 8 added the missing `selectedYear` dependency to Dashboard's effect, resolving that one as a side effect. The suppressions that exist *today* — 4 in `hooks/useListFilters.ts` (content-hashed `filterSignature` dependency, needed because the hook takes a dynamically-configured `FilterDef[]` array that can't be spread into a literal dependency array) and 1 in `contexts/ReportContext.tsx:82` (`fetchPage(page)` deliberately depending only on `page`, not `fetchPage`, to avoid a re-fetch loop) — are intentional, documented architectural choices from Steps 6 and earlier, not oversights. Forcing them into `exhaustive-deps` compliance would either reintroduce the character-for-character-duplicated per-page dependency arrays Step 6 was built to eliminate, or create an infinite fetch loop. Treated as resolved-by-supersession. **i18n copy centralization**: done, scoped deliberately narrower than "every string in the app" per user decision. Context: the Settings language selector (`SystemConfigTab.tsx`) was already disabled with a "Coming soon" badge in Step 10 — no persistence backend exists to store a language choice, so wiring live switching now has nowhere to save its state. User chose the lighter option: centralize copy into `src/i18n/id.ts` + `en.ts` as plain key/value dictionaries, with **zero rendering changes** (every call site imports whichever locale file matches what it already displayed, so current mixed-language output is byte-for-byte preserved — verified via `Dashboard.test.tsx`'s exact-string assertion on "No change from last month" still passing unmodified) — not full live-switching. Scoped to the plan's own cited example of the smell (`Belum ada data` / `Tidak ada hasil` / `Memuat...` next to `No change from last month`, `Are you sure you want to delete…` next to `Yakin ingin menghapus…`) rather than every hardcoded string app-wide (~21 files matched a broad grep for mixed copy; touching all of them — including per-page form labels and table headers, which are domain vocabulary rather than duplicated UI chrome — was judged disproportionate for a polish step). **`id.ts`**: `emptyState` (noAssetData, noReclassificationData, noMaintenanceData, noMaintenanceFiltered, noChartData, noResults, noDataFooter, loading, noChangeFromLastMonth) + `confirm` (title/message per entity for the 3 delete confirmations, deleteLabel, cancelLabel). **`en.ts`**: same key shape, real English (or Indonesian, for the Dashboard KPI string) translations — populated even where nothing consumes it today, so a future live-switcher has both languages ready without another sweep. **13 call sites wired**: `AssetTable.tsx`, `DashboardRecentAssetsPanel.tsx` (both `noAssetData`, from `id`), `ReclassificationTable.tsx` (`noReclassificationData`, `id`), `MaintenanceTable.tsx` (`noMaintenanceData`/`noMaintenanceFiltered`, `id`), `MaintenanceStats.tsx` ×4 and `ReclassificationStats.tsx` ×4 (`noDataFooter`, `id`), `DashboardKpiRow.tsx` (`noChangeFromLastMonth`, from `en` — this one string in the app was already English, preserved as such), `NotificationBell.tsx` (`loading`, `id`), `reports/ReportChart.tsx` (`noChartData`, `id`), `AddMaintenanceModal.tsx` + `AddReclassificationModal.tsx` (`noResults`, `id`), and the 3 `ConfirmModal`s added earlier in this step — `Inventory.tsx`/`Reports.tsx` from `en.confirm` (both were already English), `Reclassification.tsx` from `id.confirm` (was already Indonesian). ✅ Gate: `tsc --noEmit` clean, all 46 tests pass unmodified, `npm run build` clean, ESLint unchanged at 31 errors/6 warnings (0 new). **ConfirmModal reused, not modified** — no new props needed for any of the 4 new consumers. **Step 12 status**: window.confirm/alert ✅, Tailwind calc() fix skipped by deliberate user decision (see above), exhaustive-deps resolved-by-supersession (see above), i18n extraction ✅ (scoped). All sub-items addressed; the only intentionally-unresolved item (Tailwind calc) is a documented, reversible decision, not an oversight. |
