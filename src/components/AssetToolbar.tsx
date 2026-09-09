import { useEffect, useRef, useState, useId, type ChangeEvent, type KeyboardEvent, type ReactNode } from 'react';
import { Check, ChevronDown, Database, FileDown, Loader2, Plus, Upload } from 'lucide-react';
import { cn } from '../lib/utils';
import { useListNav } from '../hooks/useListNav';
import DownloadTemplateModal from './DownloadTemplateModal';
import ImportCsvInfoModal from './ImportCsvInfoModal';

interface AssetToolbarProps {
  onImportCSV: (event: ChangeEvent<HTMLInputElement>) => void;
  isImporting: boolean;
  onAddNew: () => void;
  selectedCount: number;
  filteredCount: number;
  isExporting: boolean;
  onExport: (scope: 'all' | 'selected', columnsScope: 'visible' | 'all') => void;
}

interface MenuItem {
  key: string;
  role: 'menuitem' | 'menuitemcheckbox';
  label: ReactNode;
  icon?: ReactNode;
  badge?: number;
  checked?: boolean;
  disabled?: boolean;
  onActivate: () => void;
}

export default function AssetToolbar({
  onImportCSV,
  isImporting,
  onAddNew,
  selectedCount,
  filteredCount,
  isExporting,
  onExport,
}: AssetToolbarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dataMenuRef = useRef<HTMLDivElement>(null);
  const [isDataMenuOpen, setIsDataMenuOpen] = useState(false);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [isImportInfoModalOpen, setIsImportInfoModalOpen] = useState(false);
  const [exportAllColumns, setExportAllColumns] = useState(false);
  const menuId = useId();

  const closeDataMenu = () => setIsDataMenuOpen(false);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dataMenuRef.current && !dataMenuRef.current.contains(event.target as Node)) {
        closeDataMenu();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const columnsScope = exportAllColumns ? 'all' : 'visible';

  const menuItems: MenuItem[] = [
    {
      key: 'import',
      role: 'menuitem',
      icon: <Upload className="h-4 w-4" />,
      label: 'Import CSV',
      disabled: isImporting,
      onActivate: () => { closeDataMenu(); setIsImportInfoModalOpen(true); },
    },
    {
      key: 'template',
      role: 'menuitem',
      icon: <FileDown className="h-4 w-4" />,
      label: 'Download Template',
      onActivate: () => { closeDataMenu(); setIsTemplateModalOpen(true); },
    },
    {
      key: 'export-all-columns',
      role: 'menuitemcheckbox',
      label: 'Export all columns (ignore column visibility)',
      checked: exportAllColumns,
      onActivate: () => setExportAllColumns(v => !v),
    },
    {
      key: 'export-filtered',
      role: 'menuitem',
      label: 'Export All (Filtered)',
      badge: filteredCount,
      onActivate: () => { closeDataMenu(); onExport('all', columnsScope); },
    },
    {
      key: 'export-selected',
      role: 'menuitem',
      label: 'Export Selected',
      badge: selectedCount,
      disabled: selectedCount === 0,
      onActivate: () => { closeDataMenu(); onExport('selected', columnsScope); },
    },
  ];

  const activateItem = (index: number) => {
    const item = menuItems[index];
    if (item.disabled) return;
    item.onActivate();
  };

  const { activeIndex, setActiveIndex, handleKeyDown, reset } = useListNav(menuItems.length, activateItem, closeDataMenu);

  useEffect(() => {
    if (isDataMenuOpen) reset();
  }, [isDataMenuOpen, reset]);

  const optionId = (index: number) => `${menuId}-item-${index}`;

  const onTriggerKeyDown = (e: KeyboardEvent) => {
    if (!isDataMenuOpen) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setIsDataMenuOpen(true);
      }
      return;
    }
    handleKeyDown(e);
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <input
        type="file"
        accept=".csv"
        ref={fileInputRef}
        className="hidden"
        onChange={onImportCSV}
      />
      <div ref={dataMenuRef} className="relative">
        <button
          type="button"
          onClick={() => setIsDataMenuOpen(prev => !prev)}
          onKeyDown={onTriggerKeyDown}
          disabled={isImporting}
          aria-haspopup="menu"
          aria-expanded={isDataMenuOpen}
          aria-controls={menuId}
          aria-activedescendant={isDataMenuOpen && activeIndex >= 0 ? optionId(activeIndex) : undefined}
          className="flex items-center gap-2 px-4 py-2 bg-surface border border-outline-variant text-on-surface-variant rounded-md hover:text-primary hover:border-primary font-medium text-sm transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isExporting || isImporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
          Data
          <ChevronDown className="h-4 w-4" />
        </button>

        {isDataMenuOpen && (
          <ul id={menuId} role="menu" className="absolute z-50 mt-1 min-w-[260px] w-max overflow-hidden rounded-md bg-surface border border-outline-variant py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
            {menuItems.map((item, index) => (
              <li key={item.key} role="presentation">
                {item.key === 'export-all-columns' && <div className="my-1 border-t border-outline-variant" role="separator" />}
                <div
                  id={optionId(index)}
                  role={item.role}
                  aria-checked={item.role === 'menuitemcheckbox' ? item.checked : undefined}
                  aria-disabled={item.disabled}
                  onClick={() => activateItem(index)}
                  onMouseEnter={() => setActiveIndex(index)}
                  className={cn(
                    "flex items-center justify-between gap-4 select-none py-2 px-3 text-sm transition-colors",
                    item.disabled
                      ? "cursor-not-allowed text-on-surface-variant opacity-50"
                      : cn("cursor-pointer text-on-surface", index === activeIndex ? "bg-surface-container-low" : "hover:bg-surface-container-low")
                  )}
                >
                  <span className="flex items-center gap-2">
                    {item.role === 'menuitemcheckbox' ? (
                      <span className={cn(
                        "flex items-center justify-center h-4 w-4 rounded border shrink-0",
                        item.checked ? "bg-primary border-primary text-on-primary" : "border-outline-variant"
                      )}>
                        {item.checked && <Check className="h-3 w-3" />}
                      </span>
                    ) : item.icon}
                    {item.label}
                  </span>
                  {item.badge !== undefined && <span className="text-on-surface-variant text-xs">{item.badge}</span>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      <ImportCsvInfoModal
        isOpen={isImportInfoModalOpen}
        onClose={() => setIsImportInfoModalOpen(false)}
        onConfirm={() => {
          setIsImportInfoModalOpen(false);
          fileInputRef.current?.click();
        }}
      />
      <DownloadTemplateModal
        isOpen={isTemplateModalOpen}
        onClose={() => setIsTemplateModalOpen(false)}
      />
      <button
        onClick={onAddNew}
        className="flex items-center gap-2 px-4 py-2 bg-primary text-on-primary rounded-md hover:opacity-90 font-medium text-sm transition-opacity shadow-sm"
      >
        <Plus className="h-4 w-4" />
        Add New Asset
      </button>
    </div>
  );
}
