import { useMemo } from 'react';
import type { MaintenanceRecord } from '../types/maintenance';

export type TimelineGroupMode = 'asset' | 'service' | 'flat';

export interface TimelineGroup {
  key: string;
  label: string;
  sublabel: string;
  records: MaintenanceRecord[];
}

function startOfWeekSunday(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function toDayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

export function useTimelineRange(
  records: MaintenanceRecord[],
  viewDate: Date,
  groupBy: TimelineGroupMode,
) {
  return useMemo(() => {
    const weekStart = startOfWeekSunday(viewDate);
    const weekEnd = addDays(weekStart, 6);
    const days: Date[] = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
    const dayKeys = new Set(days.map(toDayKey));

    const inRange = records.filter(r => {
      if (!r.scheduledDate) return false;
      const d = new Date(r.scheduledDate);
      if (isNaN(d.getTime())) return false;
      return dayKeys.has(toDayKey(d));
    });

    const groups: TimelineGroup[] = [];
    if (groupBy === 'service') {
      const byService = new Map<string, MaintenanceRecord[]>();
      inRange.forEach(r => {
        const key = r.serviceType || '(no service type)';
        const list = byService.get(key) ?? [];
        list.push(r);
        byService.set(key, list);
      });
      Array.from(byService.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .forEach(([key, list]) => {
          list.sort((x, y) => new Date(x.scheduledDate).getTime() - new Date(y.scheduledDate).getTime());
          groups.push({ key, label: key, sublabel: `${list.length} record${list.length === 1 ? '' : 's'}`, records: list });
        });
    } else if (groupBy === 'flat') {
      const sorted = [...inRange].sort(
        (a, b) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime(),
      );
      sorted.forEach((r, i) => {
        groups.push({
          key: r.id,
          label: r.assetDescription || r.assetNumber || `#${i + 1}`,
          sublabel: r.assetNumber,
          records: [r],
        });
      });
    } else {
      const byAsset = new Map<string, MaintenanceRecord[]>();
      inRange.forEach(r => {
        const key = r.assetNumber || r.assetDescription || r.id;
        const list = byAsset.get(key) ?? [];
        list.push(r);
        byAsset.set(key, list);
      });
      Array.from(byAsset.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .forEach(([key, list]) => {
          list.sort((x, y) => new Date(x.scheduledDate).getTime() - new Date(y.scheduledDate).getTime());
          const first = list[0];
          groups.push({
            key,
            label: first.assetDescription || key,
            sublabel: first.assetNumber,
            records: list,
          });
        });
    }

    return { weekStart, weekEnd, days, inRange, groups };
  }, [records, viewDate, groupBy]);
}
