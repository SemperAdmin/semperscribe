'use client';

/**
 * R3 (USER_DRIVEN_ROADMAP) - crash-recovery prompt.
 * Shown on launch when a recoverable working copy exists. Restore loads
 * it into the editor; Discard drops it and starts fresh.
 *
 * P6-3 (remediation 2026-09): dismissing (Escape, outside click) used to
 * run Discard, which cleared the copy and deleted its write-through
 * files. Dismissing now keeps the copy for later. Discard is only the
 * explicit button, and it asks once, inside the dialog.
 *
 * P6-4: with one copy per tab session, several copies can be on offer
 * (other tabs, a crashed session); the prompt shows one at a time and
 * says how many wait behind it.
 *
 * P6-9: UnsavedWorkDialog, the confirmation shown before a draft, an
 * .nldp or a template replaces unsaved work, lives here as well.
 */

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle, History } from 'lucide-react';
import type { WorkingCopy } from '@/lib/autosave';

interface RecoveryDialogProps {
  copy: WorkingCopy | null;
  onRestore: () => void;
  /** Deletes the copy on offer (and its files). Confirmed inside the dialog. */
  onDiscard: () => void;
  /** Keeps the copy where it is and moves on. Also what dismissing does. */
  onLater: () => void;
  /** How many further copies wait behind this one. */
  remaining?: number;
}

export function RecoveryDialog({ copy, onRestore, onDiscard, onLater, remaining = 0 }: RecoveryDialogProps) {
  const open = copy !== null;
  const when = copy ? new Date(copy.savedAt) : null;
  const label = copy?.formData?.subj?.trim() || copy?.formData?.documentType || 'your document';
  // Keyed by the copy on offer, so a new copy starts back at the
  // three-way choice without an effect.
  const [confirmingFor, setConfirmingFor] = useState<WorkingCopy | null>(null);
  const confirmingDiscard = copy !== null && confirmingFor === copy;
  const setConfirmingDiscard = (on: boolean) => setConfirmingFor(on ? copy : null);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onLater(); }}>
      <DialogContent className="sm:max-w-[420px] bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <History className="w-4 h-4" /> Recover unsaved work?
          </DialogTitle>
          <DialogDescription>
            An in-progress document was found from another session.
            {when && !Number.isNaN(when.getTime()) && (
              <> Autosaved {when.toLocaleString()}.</>
            )}
            {remaining > 0 && (
              <> {remaining} more {remaining === 1 ? 'copy waits' : 'copies wait'} behind this one.</>
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm text-foreground truncate">
          {label}
        </div>
        {confirmingDiscard ? (
          <>
            <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 flex gap-2">
              <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground">
                Discard this copy for good? Its text and any attached files
                that were never saved to the library are deleted.
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmingDiscard(false)}>Cancel</Button>
              <Button variant="destructive" onClick={onDiscard}>Yes, discard</Button>
            </DialogFooter>
          </>
        ) : (
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={onLater}>Keep for later</Button>
            <Button variant="outline" onClick={() => setConfirmingDiscard(true)}>Discard</Button>
            <Button onClick={onRestore}>Restore</Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// P6-9: confirmation before unsaved work is replaced
// ---------------------------------------------------------------------------

export interface PendingReplace {
  /** The verb on the confirm button: "Load draft", "Import file", "Load template". */
  action: string;
  /** What the action replaces, in one sentence. */
  description: string;
}

interface UnsavedWorkDialogProps {
  pending: PendingReplace | null;
  onConfirm: () => void;
  onDismiss: () => void;
}

/**
 * Shown when a draft, an .nldp or a template is about to replace a
 * document with unsaved changes. Dismissing keeps the current document.
 */
export function UnsavedWorkDialog({ pending, onConfirm, onDismiss }: UnsavedWorkDialogProps) {
  return (
    <Dialog open={pending !== null} onOpenChange={(o) => { if (!o) onDismiss(); }}>
      <DialogContent className="sm:max-w-[420px] bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <AlertTriangle className="w-4 h-4 text-amber-500" /> Replace unsaved work?
          </DialogTitle>
          <DialogDescription>
            {pending?.description}
            {' '}Save Draft first if you want to keep it.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onDismiss}>Keep editing</Button>
          <Button onClick={onConfirm}>{pending?.action ?? 'Replace'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
