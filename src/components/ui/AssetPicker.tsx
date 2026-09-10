import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';
import { id as copy } from '../../i18n/id';

/** The picker only ever reads these three fields off an asset. */
export interface AssetPickerOption {
  id: string;
  assetNumber: string;
  assetDescription: string;
}

/**
 * How many rows the dropdown shows at once. Searching narrows the list rather than
 * paging it — the cap exists so a 5000-row inventory doesn't render 5000 <li>.
 */
export const ASSET_PICKER_LIMIT = 50;

interface AssetPickerProps {
  /**
   * Already filtered by the caller — Add-Maintenance passes every asset, while
   * Add-Reclassification passes only the ones without a reclassification row yet.
   * The picker just searches and caps.
   */
  assets: AssetPickerOption[];
  /** id of the picked asset, or '' */
  value: string;
  onChange: (assetId: string) => void;
  /** trigger label while nothing is picked */
  placeholder: string;
  /** classes for the trigger button — the two callers style theirs differently */
  triggerClassName: string;
  /** classes for the dropdown panel */
  panelClassName: string;
  /**
   * The "showing 50 of N" line, rendered only while the search box is empty and the
   * list is longer than the cap. Omitted callers get no line at all.
   */
  renderMoreHint?: (total: number) => string;
}

/**
 * Asset search-and-pick dropdown, lifted verbatim out of AddMaintenanceModal and
 * AddReclassificationModal in Step 7 of "refactoring v2.md" — the two held the same
 * ~30 lines of search + click-outside + slice(0, 50) markup.
 *
 * Search state lives here, so it resets whenever the surrounding modal unmounts,
 * which is what both callers used to do by hand on close.
 */
export default function AssetPicker({
  assets,
  value,
  onChange,
  placeholder,
  triggerClassName,
  panelClassName,
  renderMoreHint,
}: AssetPickerProps) {
  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return assets.slice(0, ASSET_PICKER_LIMIT);
    return assets
      .filter(a =>
        a.assetNumber?.toLowerCase().includes(q) ||
        a.assetDescription?.toLowerCase().includes(q)
      )
      .slice(0, ASSET_PICKER_LIMIT);
  }, [assets, search]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const selected = assets.find(a => a.id === value);
  const moreHint =
    renderMoreHint && !search && assets.length > ASSET_PICKER_LIMIT
      ? renderMoreHint(assets.length)
      : null;

  return (
    <div ref={dropdownRef} className="relative">
      <button type="button" onClick={() => setIsOpen(prev => !prev)} className={triggerClassName}>
        <span className={value ? 'text-on-surface' : 'text-on-surface-variant'}>
          {selected ? `${selected.assetNumber} - ${selected.assetDescription}` : placeholder}
        </span>
        <ChevronDown className="h-4 w-4 text-on-surface-variant shrink-0 ml-2" />
      </button>
      {/* hidden input to satisfy form required validation */}
      <input type="text" required className="sr-only" value={value} readOnly tabIndex={-1} />

      {isOpen && (
        <div className={panelClassName}>
          <div className="p-2 border-b border-outline-variant flex items-center gap-2">
            <Search className="h-4 w-4 text-on-surface-variant shrink-0" />
            <input
              autoFocus
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Cari asset number atau deskripsi..."
              className="flex-1 bg-transparent text-sm text-on-surface placeholder:text-on-surface-variant focus:outline-none"
            />
            {search && (
              <button type="button" onClick={() => setSearch('')} className="text-on-surface-variant hover:text-on-surface">
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
          <ul className="max-h-56 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-sm text-on-surface-variant">{copy.emptyState.noResults}</li>
            ) : (
              filtered.map(asset => (
                <li
                  key={asset.id}
                  onClick={() => {
                    onChange(asset.id);
                    setIsOpen(false);
                    setSearch('');
                  }}
                  className={`px-3 py-2 text-sm cursor-pointer hover:bg-surface-container-low ${value === asset.id ? 'bg-primary/10 text-primary font-medium' : 'text-on-surface'}`}
                >
                  <span className="font-medium">{asset.assetNumber}</span>
                  <span className="text-on-surface-variant"> — {asset.assetDescription}</span>
                </li>
              ))
            )}
          </ul>
          {moreHint && (
            <p className="px-3 py-2 text-xs text-on-surface-variant border-t border-outline-variant">
              {moreHint}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
