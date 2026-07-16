'use client';

/**
 * P3.2 (DONDOCS_PARITY_PLAN) - undo/redo over the document state.
 *
 * Snapshot-based history instead of the zustand+zundo rewrite the plan
 * sketched: the seven state slices stay exactly where they are, this
 * hook watches them, debounces snapshots, and restores all seven
 * setters on undo/redo. Zero component API churn, capped memory,
 * replaceable by a store-level history later without UI changes.
 *
 * Restores bump formKey so uncontrolled form internals (DynamicForm)
 * remount on the restored values - the same contract the import path
 * uses.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { FormData, ParagraphData } from '@/types';

export interface DocumentSnapshot {
  formData: FormData;
  paragraphs: ParagraphData[];
  vias: string[];
  references: string[];
  enclosures: string[];
  copyTos: string[];
  distList: string[];
}

interface UseUndoHistoryArgs extends DocumentSnapshot {
  setFormData: React.Dispatch<React.SetStateAction<FormData>>;
  setParagraphs: React.Dispatch<React.SetStateAction<ParagraphData[]>>;
  setVias: React.Dispatch<React.SetStateAction<string[]>>;
  setReferences: React.Dispatch<React.SetStateAction<string[]>>;
  setEnclosures: React.Dispatch<React.SetStateAction<string[]>>;
  setCopyTos: React.Dispatch<React.SetStateAction<string[]>>;
  setDistList: React.Dispatch<React.SetStateAction<string[]>>;
  setFormKey: React.Dispatch<React.SetStateAction<number>>;
}

const MAX_HISTORY = 50;
const SNAPSHOT_DEBOUNCE_MS = 700;

export function useUndoHistory({
  formData, paragraphs, vias, references, enclosures, copyTos, distList,
  setFormData, setParagraphs, setVias, setReferences, setEnclosures, setCopyTos, setDistList,
  setFormKey,
}: UseUndoHistoryArgs) {
  // Non-reactive history storage; counters drive button enablement.
  const past = useRef<DocumentSnapshot[]>([]);
  const future = useRef<DocumentSnapshot[]>([]);
  const restoring = useRef(false);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const current: DocumentSnapshot = { formData, paragraphs, vias, references, enclosures, copyTos, distList };
  const currentRef = useRef(current);
  currentRef.current = current;

  const syncFlags = () => {
    setCanUndo(past.current.length > 0);
    setCanRedo(future.current.length > 0);
  };

  // Debounced snapshot on any document change.
  useEffect(() => {
    if (restoring.current) {
      // The change came from undo/redo itself - not a new edit.
      restoring.current = false;
      return;
    }
    const timer = setTimeout(() => {
      const last = past.current[past.current.length - 1];
      const snapshot = structuredClone(currentRef.current);
      if (last && JSON.stringify(last) === JSON.stringify(snapshot)) return;
      past.current.push(snapshot);
      if (past.current.length > MAX_HISTORY) past.current.shift();
      future.current = [];
      syncFlags();
    }, SNAPSHOT_DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // Serialize-compare inside; deps are the slices themselves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData, paragraphs, vias, references, enclosures, copyTos, distList]);

  const applySnapshot = useCallback((snapshot: DocumentSnapshot) => {
    restoring.current = true;
    setFormData(snapshot.formData);
    setParagraphs(snapshot.paragraphs);
    setVias(snapshot.vias);
    setReferences(snapshot.references);
    setEnclosures(snapshot.enclosures);
    setCopyTos(snapshot.copyTos);
    setDistList(snapshot.distList);
    setFormKey(prev => prev + 1);
  }, [setFormData, setParagraphs, setVias, setReferences, setEnclosures, setCopyTos, setDistList, setFormKey]);

  const undo = useCallback(() => {
    const snapshot = past.current.pop();
    if (!snapshot) return;
    future.current.push(structuredClone(currentRef.current));
    applySnapshot(snapshot);
    syncFlags();
  }, [applySnapshot]);

  const redo = useCallback(() => {
    const snapshot = future.current.pop();
    if (!snapshot) return;
    past.current.push(structuredClone(currentRef.current));
    applySnapshot(snapshot);
    syncFlags();
  }, [applySnapshot]);

  // Ctrl+Z / Ctrl+Y (and Ctrl+Shift+Z). Skipped while typing in text
  // fields - the browser's native text undo owns those until blur.
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable) return;
      const key = event.key.toLowerCase();
      if (key === 'z' && !event.shiftKey) {
        event.preventDefault();
        undo();
      } else if (key === 'y' || (key === 'z' && event.shiftKey)) {
        event.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undo, redo]);

  return { undo, redo, canUndo, canRedo };
}
