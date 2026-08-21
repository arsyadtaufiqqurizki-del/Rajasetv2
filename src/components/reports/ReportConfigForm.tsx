import { ChevronRight, Play } from 'lucide-react';
import type { ReportType } from '../../types/report';

const REPORT_TYPES: ReportType[] = [
  'Asset Valuation Summary',
  'Depreciation Schedule',
  'Maintenance Cost Analysis',
];

interface ReportConfigFormProps {
  reportType: ReportType;
  setReportType: (value: ReportType) => void;
  subsidiary: string;
  setSubsidiary: (value: string) => void;
  subsidiaries: string[];
  dateStart: string;
  setDateStart: (value: string) => void;
  dateEnd: string;
  setDateEnd: (value: string) => void;
  generating: boolean;
  onGenerate: () => void;
}

export default function ReportConfigForm({
  reportType, setReportType,
  subsidiary, setSubsidiary, subsidiaries,
  dateStart, setDateStart, dateEnd, setDateEnd,
  generating, onGenerate,
}: ReportConfigFormProps) {
  return (
    <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-on-surface border-b border-outline-variant pb-3 mb-5">Report Configuration</h3>
      <form className="flex flex-col gap-5">

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-on-surface-variant">Report Type</label>
          <div className="relative">
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value as ReportType)}
              className="w-full bg-surface-container-lowest border border-outline-variant text-on-surface rounded-lg py-2.5 px-3 appearance-none focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors"
            >
              {REPORT_TYPES.map(type => (
                <option key={type}>{type}</option>
              ))}
            </select>
            <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-on-surface-variant rotate-90 pointer-events-none" />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-on-surface-variant">Subsidiary / Division</label>
          <div className="relative">
            <select
              value={subsidiary}
              onChange={(e) => setSubsidiary(e.target.value)}
              className="w-full bg-surface-container-lowest border border-outline-variant text-on-surface rounded-lg py-2.5 px-3 appearance-none focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors"
            >
              <option>All Divisions</option>
              {subsidiaries.map(sub => (
                <option key={sub} value={sub}>{sub}</option>
              ))}
            </select>
            <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-on-surface-variant rotate-90 pointer-events-none" />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-on-surface-variant">Date Range</label>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={dateStart}
              onChange={(e) => setDateStart(e.target.value)}
              className="w-full bg-surface-container-lowest border border-outline-variant text-on-surface rounded-lg py-2 px-3 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
            />
            <span className="text-on-surface-variant">-</span>
            <input
              type="date"
              value={dateEnd}
              onChange={(e) => setDateEnd(e.target.value)}
              className="w-full bg-surface-container-lowest border border-outline-variant text-on-surface rounded-lg py-2 px-3 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
            />
          </div>
        </div>

        <button
          type="button"
          onClick={onGenerate}
          disabled={generating}
          className="mt-2 bg-primary text-on-primary font-medium text-sm py-2.5 px-4 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-60 disabled:cursor-not-allowed w-full flex justify-center items-center gap-2"
        >
          <Play className="h-4 w-4 fill-current" /> {generating ? 'Generating...' : 'Generate Preview'}
        </button>
      </form>
    </div>
  );
}
