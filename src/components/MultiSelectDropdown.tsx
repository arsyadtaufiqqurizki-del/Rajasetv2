import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { cn } from '../lib/utils';

interface MultiSelectDropdownProps {
  placeholder: string;
  options: string[];
  selected: string[];
  onChange: (values: string[]) => void;
  className?: string;
}

export default function MultiSelectDropdown({ placeholder, options, selected, onChange, className }: MultiSelectDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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

  return (
    <div ref={wrapperRef} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center justify-between gap-2 bg-surface border border-outline-variant rounded-md text-sm py-1.5 px-3 min-w-[160px] focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer",
          selected.length > 0 ? "text-on-surface" : "text-on-surface-variant"
        )}
      >
        <span className="truncate">{label}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-on-surface-variant" />
      </button>

      {isOpen && (
        <ul className="absolute z-50 mt-1 max-h-60 min-w-full w-max overflow-auto rounded-md bg-surface border border-outline-variant py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
          {options.length === 0 ? (
            <li className="px-4 py-2 text-sm text-on-surface-variant">No options</li>
          ) : options.map((option) => {
            const isSelected = selected.includes(option);
            return (
              <li
                key={option}
                onClick={() => toggleOption(option)}
                className="flex items-center gap-2 cursor-pointer select-none py-2 px-3 text-sm text-on-surface hover:bg-surface-container-low transition-colors"
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
