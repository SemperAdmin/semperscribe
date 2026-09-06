'use client';

import { useCallback, type KeyboardEvent } from 'react';
import { useSyncedState } from '@/hooks/useSyncedState';

/**
 * D.8 (UX audit finding 10, "Custom comboboxes with no ARIA: 2
 * patterns"): the SSIC picker and the auto-suggest input were plain div
 * lists whose entries fired on `onPointerDown` alone. A keyboard user
 * had no way to reach an option, and a screen reader was told nothing
 * about the list at all. SSIC is required on every naval letter and the
 * picker is the only lookup, so this was the required field a new join
 * could not fill.
 *
 * This hook carries the shared half of the WAI-ARIA combobox pattern:
 * which option is active, how the arrow keys move it, and what Enter
 * and Escape do. The two components own their own markup and supply the
 * option ids, so the ARIA attributes sit where the pattern wants them.
 */
export interface ListboxNavigation {
  /** Index of the active option, or -1 when none is active. */
  activeIndex: number;
  setActiveIndex: (index: number) => void;
  /** The id of the active option, for aria-activedescendant. */
  activeId: string | undefined;
  /** Builds the id of option `index`, for the option element itself. */
  optionId: (index: number) => string;
  onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
}

interface Options {
  /** Base for the generated option ids. Stable per component instance. */
  idPrefix: string;
  /** How many options the list currently holds. */
  count: number;
  /** Whether the list is showing. */
  open: boolean;
  setOpen: (open: boolean) => void;
  /** Commits the option at `index`. */
  onSelect: (index: number) => void;
}

export function useListboxNavigation({ idPrefix, count, open, setOpen, onSelect }: Options): ListboxNavigation {
  // The active option resets whenever the list opens, closes, or
  // changes length: an index into a list which no longer has that many
  // entries would point at nothing. Derived during render rather than
  // in an effect, so no frame ever paints a stale highlight.
  const [activeIndex, setActiveIndex] = useSyncedState(
    `${open}:${count}`,
    () => -1,
  );

  const optionId = useCallback((index: number) => `${idPrefix}-option-${index}`, [idPrefix]);

  const onKeyDown = useCallback((event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      if (!open) return;
      event.preventDefault();
      setOpen(false);
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (count === 0) return;
      event.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setActiveIndex(prev => {
        const next = prev + step;
        if (next < 0) return count - 1;
        if (next >= count) return 0;
        return next;
      });
      return;
    }
    if (event.key === 'Enter') {
      if (!open || activeIndex < 0 || activeIndex >= count) return;
      // The form has no submit handler, but a bare Enter in a text
      // field still counts as an implicit submit in some browsers.
      event.preventDefault();
      onSelect(activeIndex);
    }
  }, [open, count, activeIndex, setOpen, setActiveIndex, onSelect]);

  return {
    activeIndex,
    setActiveIndex,
    activeId: open && activeIndex >= 0 ? optionId(activeIndex) : undefined,
    optionId,
    onKeyDown,
  };
}
