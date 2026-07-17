'use client';

/**
 * R3 (USER_DRIVEN_ROADMAP) - crash-recovery prompt.
 * Shown on launch when a recoverable working copy exists. Restore
 * loads it into the editor; Discard drops it and starts fresh.
 */

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { History } from 'lucide-react';
import type { WorkingCopy } from '@/lib/autosave';

interface RecoveryDialogProps {
  copy: WorkingCopy | null;
  onRestore: () => void;
  onDiscard: () => void;
}

export function RecoveryDialog({ copy, onRestore, onDiscard }: RecoveryDialogProps) {
  const open = copy !== null;
  const when = copy ? new Date(copy.savedAt) : null;
  const label = copy?.formData?.subj?.trim() || copy?.formData?.documentType || 'your document';

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onDiscard(); }}>
      <DialogContent className="sm:max-w-[420px] bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <History className="w-4 h-4" /> Recover unsaved work?
          </DialogTitle>
          <DialogDescription>
            An in-progress document was found from your last session.
            {when && !Number.isNaN(when.getTime()) && (
              <> Autosaved {when.toLocaleString()}.</>
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm text-foreground truncate">
          {label}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onDiscard}>Discard</Button>
          <Button onClick={onRestore}>Restore</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
