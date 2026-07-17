'use client';

/**
 * R3 (USER_DRIVEN_ROADMAP) - autosave hook.
 *
 * Debounced capture of the live document into the working-copy slot,
 * plus a one-time recovery check on mount. Suppressed until the caller
 * signals the initial document load is done, so profile defaults and a
 * blank form never overwrite a recoverable copy before the user sees
 * the prompt.
 */

import { useEffect, useRef, useState } from 'react';
import { FormData, ParagraphData } from '@/types';
import {
  WorkingCopy,
  writeWorkingCopy,
  readWorkingCopy,
  clearWorkingCopy,
  isRecoverable,
} from '@/lib/autosave';

interface UseAutosaveArgs {
  formData: FormData;
  paragraphs: ParagraphData[];
  vias: string[];
  references: string[];
  enclosures: string[];
  copyTos: string[];
  distList: string[];
  /** ENC: enclosure rows so recovery restores file bindings. */
  enclosureBindings?: { key: string; title: string; fileId?: string }[];
  /** Autosave writes only once this is true (after initial load). */
  ready: boolean;
}

const AUTOSAVE_DEBOUNCE_MS = 1500;

export function useAutosave({
  formData, paragraphs, vias, references, enclosures, copyTos, distList, enclosureBindings, ready,
}: UseAutosaveArgs) {
  const [recovery, setRecovery] = useState<WorkingCopy | null>(null);
  const suspended = useRef(false);

  // One-time recovery check on mount.
  useEffect(() => {
    let cancelled = false;
    readWorkingCopy().then((copy) => {
      if (!cancelled && isRecoverable(copy)) setRecovery(copy);
    });
    return () => { cancelled = true; };
  }, []);

  // Debounced autosave. Skips while a recovery prompt is open (so the
  // blank form behind the dialog does not clobber the copy) and until
  // the caller marks the initial load complete.
  useEffect(() => {
    if (!ready || suspended.current || recovery) return;
    const timer = setTimeout(() => {
      void writeWorkingCopy({ formData, paragraphs, vias, references, enclosures, copyTos, distList, enclosureBindings });
    }, AUTOSAVE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [ready, recovery, formData, paragraphs, vias, references, enclosures, copyTos, distList, enclosureBindings]);

  /** Discards the recovery offer and lets autosave resume. */
  const dismissRecovery = () => setRecovery(null);

  /** Clears the persisted copy (explicit save / clear form). */
  const clear = () => { void clearWorkingCopy(); };

  /** Temporarily halt autosave (e.g. during a bulk import). */
  const suspend = () => { suspended.current = true; };
  const resume = () => { suspended.current = false; };

  return { recovery, dismissRecovery, clear, suspend, resume };
}
