'use client';

/**
 * R2 (USER_DRIVEN_ROADMAP) - revision compare dialog.
 * Pick two saves of a document, see exactly what moved between them,
 * and restore either revision into the editor.
 */

import React, { useMemo } from 'react';
import { useSyncedState } from '@/hooks/useSyncedState';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { GitCompare, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SavedLetter } from '@/types';
import { diffRevisions, summarizeDiff, FieldDiff } from '@/lib/revision-diff';

interface RevisionCompareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  letters: SavedLetter[];
  onRestore: (id: string) => void;
}

function stamp(letter: SavedLetter): string {
  const iso = letter.updatedAt ?? (/^\d{4}-\d{2}-\d{2}T/.test(letter.id) ? letter.id : null);
  if (iso) {
    const d = new Date(iso);
    if (!Number.isNaN(d.getTime())) return d.toLocaleString();
  }
  return letter.savedAt;
}

function label(letter: SavedLetter): string {
  return `${letter.name || letter.subj || 'Untitled'} - ${stamp(letter)}`;
}

function DiffRow({ field }: { field: FieldDiff }) {
  const badge =
    field.kind === 'added' ? 'Added' : field.kind === 'removed' ? 'Removed' : 'Changed';
  const badgeClass =
    field.kind === 'added'
      ? 'text-green-700 dark:text-green-400 border-green-600/30'
      : field.kind === 'removed'
        ? 'text-red-700 dark:text-red-400 border-red-600/30'
        : 'text-amber-700 dark:text-amber-400 border-amber-600/30';

  return (
    <div className="rounded-md border border-border bg-background/50 p-3">
      <div className="flex items-center gap-2 mb-1.5">
        <p className="text-xs font-semibold text-foreground">{field.label}</p>
        <Badge variant="outline" className={cn('text-[10px]', badgeClass)}>{badge}</Badge>
      </div>
      {field.kind === 'changed' && field.tokens ? (
        <p className="text-xs leading-relaxed">
          {field.tokens.map((t, i) => (
            <span
              key={i}
              className={cn(
                t.kind === 'added' && 'bg-green-500/20 text-green-800 dark:text-green-300 rounded px-0.5',
                t.kind === 'removed' && 'bg-red-500/20 text-red-800 dark:text-red-300 line-through rounded px-0.5',
                t.kind === 'unchanged' && 'text-muted-foreground',
              )}
            >
              {t.text}
            </span>
          ))}
        </p>
      ) : (
        <p className={cn(
          'text-xs leading-relaxed',
          field.kind === 'removed' ? 'text-red-800 dark:text-red-300 line-through' : 'text-green-800 dark:text-green-300',
        )}>
          {field.kind === 'removed' ? field.before : field.after}
        </p>
      )}
    </div>
  );
}

type ComparePhase = 'closed' | 'open-waiting' | 'open-ready';
interface CompareSelection {
  beforeId: string;
  afterId: string;
  initialized: boolean;
}

export function RevisionCompareDialog({ open, onOpenChange, letters, onRestore }: RevisionCompareDialogProps) {
  // Selection keyed on the dialog phase. Opening with two or more saves
  // defaults to the two most recent, once per open; closing re-arms the
  // default for the next open. Derived during render, not in an effect.
  const phase: ComparePhase = open ? (letters.length >= 2 ? 'open-ready' : 'open-waiting') : 'closed';
  const [selection, setSelection] = useSyncedState(phase, (p, prev): CompareSelection => {
    const base = prev ?? { beforeId: '', afterId: '', initialized: false };
    if (p === 'closed') return base.initialized ? { ...base, initialized: false } : base;
    if (p === 'open-ready' && !base.initialized) {
      return { beforeId: letters[1].id, afterId: letters[0].id, initialized: true };
    }
    return base;
  });
  const { beforeId, afterId } = selection;
  const setBeforeId = (id: string) => setSelection((s) => ({ ...s, beforeId: id }));
  const setAfterId = (id: string) => setSelection((s) => ({ ...s, afterId: id }));

  const before = letters.find((l) => l.id === beforeId);
  const after = letters.find((l) => l.id === afterId);
  const diff = useMemo(
    () => (before && after ? diffRevisions(before, after) : null),
    [before, after],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[680px] h-[75vh] flex flex-col bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <GitCompare className="w-4 h-4" /> Compare Revisions
          </DialogTitle>
          <DialogDescription>
            {letters.length < 2
              ? 'Save a document at least twice to compare revisions.'
              : 'Pick two saves to see exactly what changed between them.'}
          </DialogDescription>
        </DialogHeader>

        {letters.length >= 2 && (
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Older</p>
              <Select value={beforeId} onValueChange={setBeforeId}>
                <SelectTrigger className="w-full text-xs h-9"><SelectValue placeholder="Select a revision" /></SelectTrigger>
                <SelectContent>
                  {letters.map((l) => (
                    <SelectItem key={l.id} value={l.id} className="text-xs">{label(l)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Newer</p>
              <Select value={afterId} onValueChange={setAfterId}>
                <SelectTrigger className="w-full text-xs h-9"><SelectValue placeholder="Select a revision" /></SelectTrigger>
                <SelectContent>
                  {letters.map((l) => (
                    <SelectItem key={l.id} value={l.id} className="text-xs">{label(l)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {diff && (
          <p className="text-xs text-muted-foreground">{summarizeDiff(diff)}</p>
        )}

        <div className="flex-1 min-h-0 overflow-y-auto -mx-2 px-2 native-scroll">
          {!diff ? (
            <div className="py-16 text-center text-sm text-muted-foreground">
              {letters.length < 2 ? 'Nothing to compare yet.' : 'Select two revisions.'}
            </div>
          ) : diff.identical ? (
            <div className="py-16 text-center text-sm text-muted-foreground">
              These revisions are identical.
            </div>
          ) : (
            <div className="space-y-2">
              {diff.fields.map((field, i) => <DiffRow key={`${field.label}-${i}`} field={field} />)}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          {before && (
            <Button variant="outline" onClick={() => { onRestore(before.id); onOpenChange(false); }}>
              <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Restore older
            </Button>
          )}
          {after && (
            <Button onClick={() => { onRestore(after.id); onOpenChange(false); }}>
              <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Restore newer
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
