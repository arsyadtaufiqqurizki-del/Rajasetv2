import { MoreVertical } from 'lucide-react';
import type { MaintenanceRecord } from '../types/maintenance';

interface MaintenanceSchedulePanelProps {
  upcomingRecords: MaintenanceRecord[];
  onViewCalendar: () => void;
}

export default function MaintenanceSchedulePanel({ upcomingRecords, onViewCalendar }: MaintenanceSchedulePanelProps) {
  return (
    <div className="lg:col-span-4 rounded-xl border border-outline-variant bg-surface-container-lowest shadow-sm flex flex-col">
      <div className="p-4 border-b border-outline-variant bg-surface-bright flex justify-between items-center">
        <h3 className="text-lg font-semibold text-on-surface">Maintenance Schedule</h3>
        <button className="text-on-surface-variant hover:text-primary transition-colors">
          <MoreVertical className="h-5 w-5" />
        </button>
      </div>
      <div className="p-4 flex flex-col gap-4 overflow-y-auto max-h-[400px]">
        {upcomingRecords.length === 0 ? (
          <div className="text-on-surface-variant text-center my-auto min-h-[150px] flex items-center justify-center">
            Belum ada jadwal maintenance
          </div>
        ) : (
          upcomingRecords.map(record => (
            <div key={record.id} className="flex gap-4 items-start p-3 rounded-lg border border-outline-variant/50 hover:bg-surface-container-low transition-colors">
              <div className="flex flex-col items-center justify-center bg-primary-container text-on-primary-container rounded-lg p-2 min-w-[56px] text-center">
                <span className="text-xs font-medium uppercase">{new Date(record.scheduledDate).toLocaleString('default', { month: 'short' })}</span>
                <span className="text-lg font-bold leading-none">{new Date(record.scheduledDate).getDate()}</span>
              </div>
              <div className="flex flex-col flex-1 min-w-0">
                <h4 className="font-semibold text-on-surface truncate" title={record.assetDescription}>
                  {record.assetDescription}
                </h4>
                <p className="text-sm text-on-surface-variant truncate">
                  {record.serviceType}
                </p>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs font-mono text-primary bg-primary/10 px-2 py-0.5 rounded">
                    {record.assetNumber}
                  </span>
                  <span className="text-xs text-on-surface-variant">
                    {record.status}
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
      <div className="p-3 border-t border-outline-variant text-center mt-auto">
        <button
          onClick={onViewCalendar}
          className="text-sm font-semibold text-primary hover:underline py-1 w-full"
        >
          View Full Calendar
        </button>
      </div>
    </div>
  );
}
