import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

interface AutocompleteInputProps {
  name: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  options: string[];
  placeholder?: string;
  required?: boolean;
}

export default function AutocompleteInput({ name, value, onChange, options, placeholder, required }: AutocompleteInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setIsTyping(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [wrapperRef]);

  const handleSelect = (option: string) => {
    const event = {
      target: { name, value: option }
    } as React.ChangeEvent<HTMLInputElement>;
    onChange(event);
    setIsOpen(false);
    setIsTyping(false);
  };

  const displayOptions = isTyping 
    ? options.filter(opt => opt.toLowerCase().includes(value.toLowerCase()))
    : options;

  return (
    <div ref={wrapperRef} className="relative w-full">
      <input
        type="text"
        name={name}
        value={value}
        onChange={(e) => {
          onChange(e);
          setIsTyping(true);
          setIsOpen(true);
        }}
        onFocus={() => {
          setIsTyping(false);
          setIsOpen(true);
        }}
        placeholder={placeholder}
        required={required}
        className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary pr-10"
        autoComplete="off"
      />
      <button 
        type="button"
        onClick={() => {
          setIsTyping(false);
          setIsOpen(!isOpen);
        }}
        className="absolute inset-y-0 right-0 flex items-center pr-3 text-on-surface-variant hover:text-on-surface"
      >
        <ChevronDown className="h-4 w-4" />
      </button>
      
      {isOpen && displayOptions.length > 0 && (
        <ul className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md bg-surface border border-outline-variant py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm">
          {displayOptions.map((option) => (
            <li
              key={option}
              onClick={() => handleSelect(option)}
              className="relative cursor-pointer select-none py-2 px-4 text-on-surface hover:bg-surface-container-low transition-colors"
            >
              <span className="block truncate">{option}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
