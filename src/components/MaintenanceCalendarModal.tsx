import { useState, useMemo } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../lib/utils';
import { MaintenanceRecord } from '../contexts/MaintenanceContext';

interface MaintenanceCalendarModalProps {
  isOpen: boolean;
  onClose: () => void;
  records: MaintenanceRecord[];
  onSelectRecord: (id: string) => void;
}

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function toDateKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function statusDotClass(status: string) {
  switch (status) {
    case 'Completed': return 'bg-primary';
    case 'In Progress': return 'bg-secondary';
    case 'Pending': return 'bg-outline';
    default: return 'bg-error';
  }
}

const RECORDS_PER_PAGE = 5;

export default function MaintenanceCalendarModal({ isOpen, onClose, records, onSelectRecord }: MaintenanceCalendarModalProps) {
  const [viewDate, setViewDate] = useState(() => new Date());
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
  const [dayPage, setDayPage] = useState(1);

  const recordsByDay = useMemo(() => {
    const map = new Map<string, MaintenanceRecord[]>();
    records.forEach(record => {
      if (!record.scheduledDate) return;
      const d = new Date(record.scheduledDate);
      if (isNaN(d.getTime())) return;
      const key = toDateKey(d);
      const list = map.get(key) ?? [];
      list.push(record);
      map.set(key, list);
    });
    return map;
  }, [records]);

  const weeks = useMemo(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const firstOfMonth = new Date(year, month, 1);
    const startOffset = firstOfMonth.getDay();
    const gridStart = new Date(year, month, 1 - startOffset);

    const days: Date[] = [];
    for (let i = 0; i < 42; i++) {
      days.push(new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i));
    }

    const result: Date[][] = [];
    for (let i = 0; i < days.length; i += 7) {
      result.push(days.slice(i, i + 7));
    }
    return result;
  }, [viewDate]);

  if (!isOpen) return null;

  const today = new Date();
  const monthLabel = viewDate.toLocaleString('default', { month: 'long', year: 'numeric' });
  const selectedRecords = selectedDateKey ? recordsByDay.get(selectedDateKey) ?? [] : [];
  const dayTotalPages = Math.max(1, Math.ceil(selectedRecords.length / RECORDS_PER_PAGE));
  const paginatedDayRecords = selectedRecords.slice((dayPage - 1) * RECORDS_PER_PAGE, dayPage * RECORDS_PER_PAGE);

  const selectDay = (key: string) => {
    setSelectedDateKey(prev => prev === key ? null : key);
    setDayPage(1);
  };

  const goToMonth = (offset: number) => {
    setViewDate(prev => new Date(prev.getFullYear(), prev.getMonth() + offset, 1));
    setSelectedDateKey(null);
    setDayPage(1);
  };

  const goToToday = () => {
    setViewDate(new Date());
    setSelectedDateKey(toDateKey(new Date()));
    setDayPage(1);
  };

  const handleClose = () => {
    setSelectedDateKey(null);
    setDayPage(1);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-surface-container-lowest rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-outline-variant">
          <h2 className="text-xl font-bold text-on-surface">Maintenance Calendar</h2>
          <button onClick={handleClose} className="p-2 hover:bg-surface-container-low rounded-full transition-colors">
            <X className="h-5 w-5 text-on-surface-variant" />
          </button>
        </div>

        <div className="p-6 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <button
                onClick={() => goToMonth(-1)}
                className="p-1.5 rounded text-on-surface-variant hover:text-primary hover:bg-surface-container-highest transition-colors"
                aria-label="Previous month"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <h3 className="text-lg font-semibold text-on-surface w-44 text-center">{monthLabel}</h3>
              <button
                onClick={() => goToMonth(1)}
                className="p-1.5 rounded text-on-surface-variant hover:text-primary hover:bg-surface-container-highest transition-colors"
                aria-label="Next month"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
            <button
              onClick={goToToday}
              className="text-sm font-medium text-primary hover:underline"
            >
              Today
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1">
            {WEEKDAY_LABELS.map(label => (
              <div key={label} className="text-center text-xs font-semibold text-on-surface-variant uppercase py-1">
                {label}
              </div>
            ))}
            {weeks.map((week, weekIdx) => (
              week.map(day => {
                const key = toDateKey(day);
                const dayRecords = recordsByDay.get(key) ?? [];
                const isCurrentMonth = day.getMonth() === viewDate.getMonth();
                const isToday = toDateKey(day) === toDateKey(today);
                const isSelected = key === selectedDateKey;

                return (
                  <button
                    key={key}
                    onClick={() => selectDay(key)}
                    disabled={dayRecords.length === 0}
                    className={cn(
                      "flex flex-col items-center gap-1 rounded-lg p-2 min-h-[64px] border transition-colors text-left",
                      isSelected ? "border-primary bg-primary/10" : "border-transparent",
                      dayRecords.length > 0 ? "hover:bg-surface-container-low cursor-pointer" : "cursor-default",
                      !isCurrentMonth && "opacity-40"
                    )}
                  >
                    <span className={cn(
                      "text-sm w-6 h-6 flex items-center justify-center rounded-full",
                      isToday ? "bg-primary text-on-primary font-semibold" : "text-on-surface"
                    )}>
                      {day.getDate()}
                    </span>
                    {dayRecords.length > 0 && (
                      <div className="flex items-center gap-0.5 flex-wrap justify-center">
                        {dayRecords.slice(0, 3).map(r => (
                          <span key={r.id} className={cn("w-1.5 h-1.5 rounded-full", statusDotClass(r.status))} />
                        ))}
                        {dayRecords.length > 3 && (
                          <span className="text-[10px] text-on-surface-variant leading-none">+{dayRecords.length - 3}</span>
                        )}
                      </div>
                    )}
                  </button>
                );
              })
            ))}
          </div>

          {selectedDateKey && (
            <div className="border-t border-outline-variant pt-4 flex flex-col gap-2">
              <h4 className="text-sm font-semibold text-on-surface-variant uppercase tracking-wide">
                {new Date(weeks.flat().find(d => toDateKey(d) === selectedDateKey)!).toLocaleDateString('default', { weekday: 'long', month: 'long', day: 'numeric' })}
              </h4>
              {selectedRecords.length === 0 ? (
                <p className="text-sm text-on-surface-variant">Tidak ada jadwal maintenance pada tanggal ini.</p>
              ) : (
                <>
                  {paginatedDayRecords.map(record => (
                    <button
                      key={record.id}
                      onClick={() => {
                        onSelectRecord(record.id);
                        handleClose();
                      }}
                      className="flex items-center justify-between gap-3 p-3 rounded-lg border border-outline-variant/50 hover:bg-surface-container-low transition-colors text-left"
                    >
                      <div className="flex flex-col min-w-0">
                        <span className="font-semibold text-on-surface truncate" title={record.assetDescription}>
                          {record.assetDescription}
                        </span>
                        <span className="text-sm text-on-surface-variant truncate">{record.serviceType}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs font-mono text-primary bg-primary/10 px-2 py-0.5 rounded">
                          {record.assetNumber}
                        </span>
                        <span className="inline-flex items-center gap-1.5 text-xs text-on-surface-variant">
                          <span className={cn("w-1.5 h-1.5 rounded-full", statusDotClass(record.status))} />
                          {record.status}
                        </span>
                      </div>
                    </button>
                  ))}
                  {dayTotalPages > 1 && (
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-xs text-on-surface-variant">
                        Showing {paginatedDayRecords.length} of {selectedRecords.length} entries
                      </span>
                      <div className="flex items-center gap-1 text-sm font-medium">
                        <button
                          onClick={() => setDayPage(prev => Math.max(1, prev - 1))}
                          disabled={dayPage === 1}
                          className="p-1 rounded text-on-surface-variant hover:text-primary hover:bg-surface-container-highest disabled:opacity-50 disabled:hover:text-on-surface-variant"
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </button>
                        <span className="px-3 py-1 rounded bg-surface-container-high text-on-surface font-semibold text-xs">
                          Page {dayPage} of {dayTotalPages}
                        </span>
                        <button
                          onClick={() => setDayPage(prev => Math.min(dayTotalPages, prev + 1))}
                          disabled={dayPage === dayTotalPages}
                          className="p-1 rounded text-on-surface-variant hover:text-primary hover:bg-surface-container-highest disabled:opacity-50 disabled:hover:text-on-surface-variant"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
