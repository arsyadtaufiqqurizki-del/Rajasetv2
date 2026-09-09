import { useState, useRef, useEffect, useId, type KeyboardEvent } from 'react';
import { ChevronDown, Check, Search } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useListNav } from '../../hooks/useListNav';

interface MultiSelectDropdownProps {
  placeholder: string;
  options: string[];
  selected: string[];
  onChange: (values: string[]) => void;
  className?: string;
  searchable?: boolean;
}

export default function MultiSelectDropdown({ placeholder, options, selected, onChange, className, searchable }: MultiSelectDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  const close = () => {
    setIsOpen(false);
    setSearchTerm('');
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        close();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && searchable) {
      searchInputRef.current?.focus();
    }
  }, [isOpen, searchable]);

  const toggleOption = (option: string) => {
    if (selected.includes(option)) {
      onChange(selected.filter(v => v !== option));
    } else {
      onChange([...selected, option]);
    }
  };

  const label = selected.length === 0
    ? placeholder
    : selected.length === 1
      ? selected[0]
      : `${selected.length} selected`;

  const filteredOptions = searchable && searchTerm
    ? options.filter(o => o.toLowerCase().includes(searchTerm.toLowerCase()))
    : options;

  const { activeIndex, setActiveIndex, handleKeyDown, reset } = useListNav(
    filteredOptions.length,
    (index) => toggleOption(filteredOptions[index]),
    close,
  );

  useEffect(() => {
    if (isOpen) reset();
  }, [isOpen, searchTerm, reset]);

  const optionId = (index: number) => `${listId}-option-${index}`;

  const onTriggerKeyDown = (e: KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }
    handleKeyDown(e);
  };

  return (
    <div ref={wrapperRef} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={searchable ? undefined : onTriggerKeyDown}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listId}
        aria-activedescendant={isOpen && !searchable && activeIndex >= 0 ? optionId(activeIndex) : undefined}
        className={cn(
          "flex items-center justify-between gap-2 bg-surface border border-outline-variant rounded-md text-sm py-1.5 px-3 min-w-[160px] focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer",
          selected.length > 0 ? "text-on-surface" : "text-on-surface-variant"
        )}
      >
        <span className="truncate">{label}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-on-surface-variant" />
      </button>

      {isOpen && (
        <ul id={listId} role="listbox" aria-multiselectable="true" className="absolute z-50 mt-1 max-h-60 min-w-full w-max overflow-auto rounded-md bg-surface border border-outline-variant py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
          {searchable && (
            <li className="sticky top-0 bg-surface px-2 py-1.5 border-b border-outline-variant" role="presentation">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-on-surface-variant pointer-events-none" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={onTriggerKeyDown}
                  role="combobox"
                  aria-expanded={isOpen}
                  aria-controls={listId}
                  aria-activedescendant={activeIndex >= 0 ? optionId(activeIndex) : undefined}
                  placeholder="Search..."
                  className="w-full bg-surface border border-outline-variant rounded text-sm py-1 pl-7 pr-2 focus:outline-none focus:ring-1 focus:ring-primary text-on-surface"
                />
              </div>
            </li>
          )}
          {filteredOptions.length === 0 ? (
            <li className="px-4 py-2 text-sm text-on-surface-variant" role="presentation">
              {options.length === 0 ? "No options" : "No matches found"}
            </li>
          ) : filteredOptions.map((option, index) => {
            const isSelected = selected.includes(option);
            return (
              <li
                key={option}
                id={optionId(index)}
                role="option"
                aria-selected={isSelected}
                onClick={() => toggleOption(option)}
                onMouseEnter={() => setActiveIndex(index)}
                className={cn(
                  "flex items-center gap-2 cursor-pointer select-none py-2 px-3 text-sm text-on-surface transition-colors",
                  index === activeIndex ? "bg-surface-container-low" : "hover:bg-surface-container-low"
                )}
              >
                <span className={cn(
                  "flex items-center justify-center h-4 w-4 rounded border shrink-0",
                  isSelected ? "bg-primary border-primary text-on-primary" : "border-outline-variant"
                )}>
                  {isSelected && <Check className="h-3 w-3" />}
                </span>
                <span className="truncate">{option}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
