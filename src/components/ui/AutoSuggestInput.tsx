'use client';

import React, { useState } from 'react';
import { Input, InputProps } from '@/components/ui/input';
import { useMilitaryDictionary } from '@/hooks/useReferenceData';
import { useDebounce } from '@/hooks/useDebounce';
import { findSuggestions } from '@/lib/dictionary-display';
import { useListboxNavigation } from '@/hooks/useListboxNavigation';
import { cn } from '@/lib/utils';

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

/**
 * D.8 (UX audit finding 10): the dictionary auto-suggest as a WAI-ARIA
 * combobox. Same defect as the SSIC picker - a plain div list selecting
 * on `onPointerDown` alone, with no role, no expanded state and no
 * keyboard path to an option.
 */
export function AutoSuggestInput({ value, onChange, preserveCase = false, ...props }: AutoSuggestInputProps) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listboxId = React.useId();
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

  const handleSelect = React.useCallback((index: number) => {
    const suggestion = suggestions[index];
    if (suggestion === undefined) return;
    onChange(suggestion);
    setSuggestions([]);
    setOpen(false);
    inputRef.current?.blur();
  }, [suggestions, onChange]);

  const nav = useListboxNavigation({
    idPrefix: listboxId,
    count: suggestions.length,
    open,
    setOpen,
    onSelect: handleSelect,
  });

  const expanded = open && suggestions.length > 0;

  return (
    <div className="relative">
      <Input
        ref={inputRef}
        {...props}
        role="combobox"
        aria-expanded={expanded}
        aria-controls={expanded ? listboxId : undefined}
        aria-activedescendant={nav.activeId}
        aria-autocomplete="list"
        value={value}
        onChange={handleChange}
        onKeyDown={nav.onKeyDown}
        onFocus={() => {
          if (suggestions.length > 0) setOpen(true);
        }}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
        autoComplete="off"
      />
      {expanded && (
        <ul
          id={listboxId}
          role="listbox"
          aria-label="Suggestions"
          className="absolute z-50 mt-1 w-full max-h-48 overflow-y-auto rounded-md border bg-popover text-popover-foreground shadow-md"
        >
          {suggestions.map((suggestion, index) => (
            <li
              key={suggestion}
              id={nav.optionId(index)}
              role="option"
              aria-selected={index === nav.activeIndex}
              className={cn(
                'px-3 py-1.5 text-sm cursor-pointer hover:bg-accent hover:text-accent-foreground',
                index === nav.activeIndex && 'bg-accent text-accent-foreground',
              )}
              onMouseMove={() => nav.setActiveIndex(index)}
              // Pointer down beats the input's blur, which would close
              // the list before a click landed. Click stays wired for
              // pointer types and harnesses which emit no pointer event.
              onPointerDown={(e) => { e.preventDefault(); handleSelect(index); }}
              onClick={() => handleSelect(index)}
            >
              {suggestion}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
