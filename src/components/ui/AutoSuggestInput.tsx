
'use client';

import React, { useState } from 'react';
import { Input, InputProps } from '@/components/ui/input';
import type { DictionaryEntry } from '@/lib/military-dictionary';
import { useMilitaryDictionary } from '@/hooks/useReferenceData';
import { useDebounce } from '@/hooks/useDebounce';

interface AutoSuggestInputProps extends Omit<InputProps, 'onChange'> {
  value: string;
  onChange: (value: string) => void;
}

export function AutoSuggestInput({ value, onChange, ...props }: AutoSuggestInputProps) {
  const [suggestions, setSuggestions] = useState<DictionaryEntry[]>([]);
  const [open, setOpen] = useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const { dictionary } = useMilitaryDictionary();

  const debouncedSearch = useDebounce((query: string) => {
    if (query.length < 2) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    const lowerCaseQuery = query.toLowerCase();
    const filtered = dictionary.filter(
      ({ term, meaning }) =>
        term.toLowerCase().includes(lowerCaseQuery) ||
        meaning.toLowerCase().includes(lowerCaseQuery)
    );
    setSuggestions(filtered.slice(0, 10));
    setOpen(filtered.length > 0);
  }, 300);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onChange(newValue);
    debouncedSearch(newValue);
  };

  const handleSelect = (suggestion: DictionaryEntry) => {
    onChange(suggestion.term);
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
              key={suggestion.term}
              type="button"
              className="w-full text-left px-3 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground cursor-pointer"
              onPointerDown={(e) => {
                e.preventDefault();
                handleSelect(suggestion);
              }}
            >
              <span className="font-semibold">{suggestion.term}</span>
              <span className="ml-2 text-xs text-muted-foreground">{suggestion.meaning}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
