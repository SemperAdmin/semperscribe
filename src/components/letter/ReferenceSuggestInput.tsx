'use client';

/**
 * P3.4 (DONDOCS_PARITY_PLAN) - reference input with library suggestions.
 * Standard input plus a dropdown of curated citations matching the
 * typed fragment. Selecting fills the citation text; anything not in
 * the library types through unchanged.
 */

import React, { useMemo, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { searchReferences } from '@/lib/reference-library';

interface ReferenceSuggestInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  'aria-label'?: string;
}

export function ReferenceSuggestInput({ value, onChange, placeholder, className, 'aria-label': ariaLabel }: ReferenceSuggestInputProps) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const suggestions = useMemo(() => searchReferences(value), [value]);
  const show = open && suggestions.length > 0;

  const pick = (citation: string) => {
    onChange(citation);
    setOpen(false);
  };

  return (
    <div className="relative flex-1">
      <Input
        className={className}
        type="text"
        placeholder={placeholder}
        value={value}
        aria-label={ariaLabel}
        onChange={(e) => { onChange(e.target.value); setOpen(true); setHighlight(0); }}
        onFocus={() => setOpen(true)}
        onBlur={() => { blurTimer.current = setTimeout(() => setOpen(false), 150); }}
        onKeyDown={(e) => {
          if (!show) return;
          if (e.key === 'ArrowDown') { e.preventDefault(); setHighlight((h) => Math.min(h + 1, suggestions.length - 1)); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlight((h) => Math.max(h - 1, 0)); }
          else if (e.key === 'Enter') { e.preventDefault(); pick(suggestions[highlight].citation); }
          else if (e.key === 'Escape') { setOpen(false); }
        }}
      />
      {show && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-popover text-popover-foreground shadow-md max-h-56 overflow-y-auto">
          {suggestions.map((s, i) => (
            <button
              key={s.citation}
              type="button"
              className={`w-full text-left px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground ${i === highlight ? 'bg-accent text-accent-foreground' : ''}`}
              onMouseDown={(e) => { e.preventDefault(); pick(s.citation); }}
            >
              <span className="font-medium">{s.citation}</span>
              <span className="text-muted-foreground"> - {s.title}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
