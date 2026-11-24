'use client';

import { useEffect } from 'react';

export type UndoShortcut = 'undo' | 'redo' | null;

/**
 * Ctrl/Cmd+Z undoes; Ctrl/Cmd+Shift+Z and Ctrl/Cmd+Y redo. Skipped while
 * typing in a text field - the browser's native text undo owns those until
 * blur (the letter editor's long-standing behaviour, kept for Volume too).
 */
export function undoShortcutFor(event: Pick<KeyboardEvent, 'ctrlKey' | 'metaKey' | 'shiftKey' | 'key' | 'target'>): UndoShortcut {
  if (!(event.ctrlKey || event.metaKey)) return null;
  const target = event.target as HTMLElement | null;
  const tag = target?.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable) return null;
  const key = event.key.toLowerCase();
  if (key === 'z' && !event.shiftKey) return 'undo';
  if (key === 'y' || (key === 'z' && event.shiftKey)) return 'redo';
  return null;
}

/** Binds the undo/redo shortcuts on window to whichever history is active. */
export function useUndoShortcuts(undo: () => void, redo: () => void) {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const action = undoShortcutFor(event);
      if (!action) return;
      event.preventDefault();
      (action === 'undo' ? undo : redo)();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undo, redo]);
}
