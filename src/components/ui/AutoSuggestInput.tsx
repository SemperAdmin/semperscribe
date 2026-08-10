
'use client';

import React, { useState } from 'react';
import { Input, InputProps } from '@/components/ui/input';
import { useMilitaryDictionary } from '@/hooks/useReferenceData';
import { useDebounce } from '@/hooks/useDebounce';
import { findSuggestions } from '@/lib/dictionary-display';

interface AutoSuggestInputProps extends Omit<InputProps, 'onChange'> {
  value: string;
  onChange: (value: string) => void;
  /**
   * Keep dictionary suggestions in the source ALL CAPS instead of
   * converting them to natural case. Set this on fields the schema
   * validates as all-caps, such as the naval letter subject line.
   */
  preserveCase?: boolean;
}

export function AutoSuggestInput({ value, onChange, preserveCase = false, ...props }: AutoSuggestInputProps) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const { dictionary } = useMilitaryDictionary();

  const debouncedSearch = useDebounce((query: string) => {
    const found = findSuggestions(dictionary, query, { limit: 10, preserveCase });
    setSuggestions(found);
    setOpen(found.length > 0);
  }, 300);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onChange(newValue);
    debouncedSearch(newValue);
  };

  const handleSelect = (suggestion: string) => {
    onChange(suggestion);
    setSuggestions([]);
    setOpen(false);
    inputRef.current?.blur();
  };

  return (
    <div className="relative">
      <Input
        ref={inputRef}
        {...props}
        value={value}
        onChange={handleChange}
        onFocus={() => {
          if (suggestions.length > 0) setOpen(true);
        }}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
        autoComplete="off"
      />
      {open && suggestions.length > 0 && (
        <div className="absolute z-50 mt-1 w-full max-h-48 overflow-y-auto rounded-md border bg-popover text-popover-foreground shadow-md">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              className="w-full text-left px-3 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground cursor-pointer"
              onPointerDown={(e) => {
                e.preventDefault();
                handleSelect(suggestion);
              }}
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
