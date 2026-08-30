import { AlertCircle, ChevronRight, Play } from 'lucide-react';
import { REPORT_TYPES, type ReportType } from '../../types/report';
import { DATE_PRESET_OPTIONS, type DatePreset } from '../../lib/reports/datePresets';
import { en as copy } from '../../i18n/en';
import MultiSelectDropdown from '../ui/MultiSelectDropdown';
import FilterChips, { type FilterChip } from '../ui/FilterChips';

interface ReportFilterBarProps {
  reportType: ReportType;
  onReportTypeChange: (value: ReportType) => void;

  subsidiaries: string[];
  filterSubsidiary: string[];
  onFilterSubsidiaryChange: (value: string[]) => void;
  categories: string[];
  filterCategory: string[];
  onFilterCategoryChange: (value: string[]) => void;
  locations: string[];
  filterLocation: string[];
  onFilterLocationChange: (value: string[]) => void;
  statuses: string[];
  filterStatus: string[];
  onFilterStatusChange: (value: string[]) => void;

  datePreset: DatePreset;
  onDatePresetChange: (value: DatePreset) => void;
  dateStart: string;
  onDateStartChange: (value: string) => void;
  dateEnd: string;
  onDateEndChange: (value: string) => void;
  dateError: string | null;

  chips: FilterChip[];
  onClearFilters: () => void;

  generating: boolean;
  onReview: () => void;
  canSave: boolean;
  saved: boolean;
  onSave: () => void;
}

const selectClass = 'bg-surface border border-outline-variant text-on-surface rounded-md text-sm py-1.5 pl-3 pr-8 appearance-none focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer min-w-[160px]';

export default function ReportFilterBar({
  reportType, onReportTypeChange,
  subsidiaries, filterSubsidiary, onFilterSubsidiaryChange,
  categories, filterCategory, onFilterCategoryChange,
  locations, filterLocation, onFilterLocationChange,
  statuses, filterStatus, onFilterStatusChange,
  datePreset, onDatePresetChange,
  dateStart, onDateStartChange, dateEnd, onDateEndChange, dateError,
  chips, onClearFilters,
  generating, onReview,
  canSave, saved, onSave,
}: ReportFilterBarProps) {
  const t = copy.reports.filterBar;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!generating && !dateError) onReview();
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5 shadow-sm flex flex-col gap-4"
    >
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative">
          <label className="sr-only" htmlFor="report-type-select">{t.reportTypeLabel}</label>
          <select
            id="report-type-select"
            value={reportType}
            onChange={(e) => onReportTypeChange(e.target.value as ReportType)}
            className={selectClass}
          >
            {REPORT_TYPES.map(type => (
              <option key={type}>{type}</option>
            ))}
          </select>
          <ChevronRight className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-on-surface-variant rotate-90 pointer-events-none" />
        </div>

        <div className="relative">
          <label className="sr-only" htmlFor="report-period-select">{t.periodLabel}</label>
          <select
            id="report-period-select"
            value={datePreset}
            onChange={(e) => onDatePresetChange(e.target.value as DatePreset)}
            className={selectClass}
          >
            {DATE_PRESET_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <ChevronRight className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-on-surface-variant rotate-90 pointer-events-none" />
        </div>

        {datePreset === 'custom' && (
          <fieldset className="flex items-center gap-2">
            <legend className="sr-only">{t.customRangeLegend}</legend>
            <label className="sr-only" htmlFor="report-date-start">{t.dateFromLabel}</label>
            <input
              id="report-date-start"
              type="date"
              value={dateStart}
              onChange={(e) => onDateStartChange(e.target.value)}
              className="bg-surface border border-outline-variant text-on-surface rounded-md py-1.5 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <span className="text-on-surface-variant text-sm">-</span>
            <label className="sr-only" htmlFor="report-date-end">{t.dateToLabel}</label>
            <input
              id="report-date-end"
              type="date"
              value={dateEnd}
              onChange={(e) => onDateEndChange(e.target.value)}
              className="bg-surface border border-outline-variant text-on-surface rounded-md py-1.5 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </fieldset>
        )}

        <MultiSelectDropdown
          placeholder={t.allSubsidiaries}
          options={subsidiaries}
          selected={filterSubsidiary}
          onChange={onFilterSubsidiaryChange}
        />
        <MultiSelectDropdown
          placeholder={t.allCategories}
          options={categories}
          selected={filterCategory}
          onChange={onFilterCategoryChange}
        />
        <MultiSelectDropdown
          placeholder={t.allLocations}
          options={locations}
          selected={filterLocation}
          onChange={onFilterLocationChange}
        />
        <MultiSelectDropdown
          placeholder={t.allStatuses}
          options={statuses}
          selected={filterStatus}
          onChange={onFilterStatusChange}
        />

        <button type="button" onClick={onClearFilters} className="text-sm font-medium text-secondary hover:text-primary transition-colors ml-auto">
          {t.clearFilters}
        </button>
      </div>

      {dateError && (
        <p className="flex items-center gap-1.5 text-sm text-error">
          <AlertCircle className="h-4 w-4 shrink-0" /> {dateError}
        </p>
      )}

      <FilterChips chips={chips} />

      <div className="flex items-center justify-end gap-3 border-t border-outline-variant pt-4">
        <button
          type="submit"
          disabled={generating || !!dateError}
          className="bg-primary text-on-primary font-medium text-sm py-2 px-4 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
        >
          <Play className="h-4 w-4 fill-current" /> {generating ? t.reviewing : t.review}
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={!canSave || saved}
          className="bg-surface border border-outline text-primary font-medium text-sm py-2 px-4 rounded-lg hover:bg-surface-container-low transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {saved ? t.saved : t.save}
        </button>
      </div>
    </form>
  );
}
