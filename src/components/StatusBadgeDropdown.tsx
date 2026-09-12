import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';

const STATUSES = ['Pending', 'In Progress', 'Completed', 'Overdue'] as const;

function badgeClass(status: string) {
  return cn(
    'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border transition-shadow hover:ring-2 hover:ring-primary/30 cursor-pointer',
    status === 'Completed' ? 'bg-primary-fixed text-on-primary-fixed border-transparent' :
    status === 'In Progress' ? 'bg-secondary-container text-on-secondary-container border-transparent' :
    status === 'Pending' ? 'bg-surface-variant text-on-surface-variant border-transparent' :
    'bg-error-container text-on-error-container border-error/20'
  );
}

function dotClass(status: string) {
  return cn(
    'w-1.5 h-1.5 rounded-full',
    status === 'Completed' ? 'bg-primary' :
    status === 'In Progress' ? 'bg-secondary' :
    status === 'Pending' ? 'bg-outline' : 'bg-error'
  );
}

interface StatusBadgeDropdownProps {
  recordId: string;
  currentStatus: string;
  onStatusChange: (id: string, newStatus: string) => Promise<void>;
  align?: 'left' | 'right';
}

export default function StatusBadgeDropdown({ recordId, currentStatus, onStatusChange, align = 'left' }: StatusBadgeDropdownProps) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [focusIndex, setFocusIndex] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open ]);

  const openMenu = () => {
    setFocusIndex(STATUSES.indexOf(currentStatus as (typeof STATUSES)[number]));
    setOpen(true);
  };

  const select = async (status: string) => {
    if (status === currentStatus || saving) {
      setOpen(false);
      return;
    }
    setSaving(true);
    try {
      await onStatusChange(recordId, status);
    } finally {
      setSaving(false);
      setOpen(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setOpen(false);
      return;
    }
    if (!open) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openMenu();
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusIndex(i => (i + 1) % STATUSES.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusIndex(i => (i - 1 + STATUSES.length) % STATUSES.length);
    } else if ((e.key === 'Enter' || e.key === ' ') && focusIndex >= 0) {
      e.preventDefault();
      select(STATUSES[focusIndex]);
    }
  };

  return (
    <div ref={rootRef} className="relative inline-block" onClick={e => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => {
          if (saving) return;
          if (open) setOpen(false);
          else openMenu();
        }}
        onKeyDown={onKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={saving}
        className={cn(badgeClass(currentStatus), saving && 'opacity-60 cursor-wait')}
      >
        {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <span className={dotClass(currentStatus)} />}
        {currentStatus}
      </button>
      {open && (
        <div
          role="listbox"
          aria-label="Change status"
          className={cn(
            'absolute z-30 mt-1 min-w-36 rounded-lg border border-outline-variant bg-surface-container-lowest shadow-lg p-1',
            align === 'right' ? 'right-0' : 'left-0'
          )}
        >
          {STATUSES.map((s, i) => (
            <button
              key={s}
              type="button"
              role="option"
              aria-selected={s === currentStatus}
              onClick={() => select(s)}
              onMouseEnter={() => setFocusIndex(i)}
              className={cn(
                'w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-surface-container-high transition-colors',
                i === focusIndex && 'bg-surface-container-high',
                s === currentStatus && 'font-semibold'
              )}
            >
              <span className={badgeClass(s)}>
                <span className={dotClass(s)} />
                {s}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
