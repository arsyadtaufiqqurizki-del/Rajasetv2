// The real shape of Reports.tsx's `previewData: any` (see refactoring_plan.md
// Step 3 / Step 9). Modelled on `generatePreview`'s three branches but not yet
// applied there — Step 9 swaps the `any` for this and fixes whatever the
// compiler then surfaces.

export type ReportType = 'Asset Valuation Summary' | 'Depreciation Schedule' | 'Maintenance Cost Analysis';

export type ChartKind = 'bar' | 'line' | 'composed';

export type ReportSummaryItem = {
  label: string;
  value: string;
};

export type DetailColumn<T> = {
  key: keyof T & string;
  label: string;
  currency?: boolean;
};

type ReportPreviewBase<TDetail> = {
  title: string;
  yAxisFormatter: (value: number) => string;
  summary: ReportSummaryItem[];
  detailColumns: DetailColumn<TDetail>[];
  detailData: TDetail[];
};

export type AssetValuationDetailRow = {
  assetNumber: string;
  description: string;
  category: string;
  subsidiary: string;
  acquisitionDate: string;
  cost: number;
};

export type DepreciationDetailRow = {
  assetNumber: string;
  description: string;
  cost: number;
  accumulatedDepreciation: number;
  netBookValue: number;
  remainingLifeMonths: number;
};

export type MaintenanceCostDetailRow = {
  assetNumber: string;
  description: string;
  serviceType: string;
  scheduledDate: string;
  estimated: number;
  actual: number;
  variance: number;
};

export type AssetValuationReportPreview = ReportPreviewBase<AssetValuationDetailRow> & {
  type: 'bar';
  data: { name: string; value: number }[];
  dataKey: 'value';
  color: string;
};

export type DepreciationReportPreview = ReportPreviewBase<DepreciationDetailRow> & {
  type: 'line';
  data: { name: string; value: number }[];
  dataKey: 'value';
  color: string;
};

export type MaintenanceCostReportPreview = ReportPreviewBase<MaintenanceCostDetailRow> & {
  type: 'composed';
  data: { name: string; estimated: number; actual: number }[];
};

export type ReportPreview =
  | AssetValuationReportPreview
  | DepreciationReportPreview
  | MaintenanceCostReportPreview;
