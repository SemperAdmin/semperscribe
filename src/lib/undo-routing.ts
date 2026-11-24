/**
 * Which undo history the header Undo/Redo and the Ctrl+Z / Ctrl+Y shortcuts
 * drive. A Volume is authored in its own store (useVolumeStore) with its own
 * history; every other document type uses the letter-slice snapshot history
 * (useUndoHistory). Without this, a Volume's edits could not be undone and
 * the controls silently rewound the hidden letter slices instead.
 */
export interface UndoControls {
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

export function routeUndo(documentType: string | undefined, letter: UndoControls, volume: UndoControls): UndoControls {
  return documentType === 'volume' ? volume : letter;
}
