'use client';

/**
 * P3.1 (DONDOCS_PARITY_PLAN) - find and replace dialog.
 * Live match counts per field group, scope checkboxes, case toggle,
 * replace-all. The parent applies results through its normal setters,
 * so a replace lands in undo history as one step.
 */

import React, { useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Replace } from 'lucide-react';
import {
  FindReplaceInput,
  FindReplaceOptions,
  FindReplaceScope,
  DEFAULT_SCOPE,
  countMatches,
  replaceAll,
  FindReplaceResult,
} from '@/lib/find-replace';

interface FindReplaceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  input: FindReplaceInput;
  onApply: (result: FindReplaceResult) => void;
}

const SCOPE_LABELS: Array<{ key: keyof FindReplaceScope; label: string }> = [
  { key: 'subject', label: 'Subject' },
  { key: 'body', label: 'Body paragraphs' },
  { key: 'references', label: 'References' },
  { key: 'enclosures', label: 'Enclosures' },
  { key: 'addresses', label: 'Addresses (From/To/Via/Copy to)' },
];

export function FindReplaceDialog({ open, onOpenChange, input, onApply }: FindReplaceDialogProps) {
  const [find, setFind] = useState('');
  const [replace, setReplace] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [scope, setScope] = useState<FindReplaceScope>(DEFAULT_SCOPE);
  const [lastResult, setLastResult] = useState<number | null>(null);

  const options: FindReplaceOptions = { find, replace, caseSensitive, scope };
  const counts = useMemo(
    () => (find ? countMatches(input, options) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [input, find, replace, caseSensitive, scope],
  );
  const total = counts.reduce((sum, c) => sum + c.count, 0);

  const handleReplaceAll = () => {
    if (!find || total === 0) return;
    const result = replaceAll(input, options);
    onApply(result);
    setLastResult(result.replaced);
  };

  const reset = () => {
    setFind('');
    setReplace('');
    setLastResult(null);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="sm:max-w-[440px] bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <Replace className="w-4 h-4" /> Find and Replace
          </DialogTitle>
          <DialogDescription>
            Replaces across the selected parts of the document. One undo step reverses it.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="fr-find">Find</Label>
            <Input id="fr-find" value={find} onChange={(e) => { setFind(e.target.value); setLastResult(null); }} autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fr-replace">Replace with</Label>
            <Input id="fr-replace" value={replace} onChange={(e) => setReplace(e.target.value)} />
          </div>

          <div className="flex items-center gap-2">
            <Checkbox id="fr-case" checked={caseSensitive} onCheckedChange={(c) => setCaseSensitive(c === true)} />
            <Label htmlFor="fr-case" className="cursor-pointer text-sm">Match case</Label>
          </div>

          <div className="rounded-md border border-border p-2 space-y-1">
            {SCOPE_LABELS.map(({ key, label }) => {
              const count = counts.find((c) => c.field.startsWith(label.split(' ')[0]))?.count;
              return (
                <div key={key} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id={`fr-scope-${key}`}
                      checked={scope[key]}
                      onCheckedChange={(c) => setScope((s) => ({ ...s, [key]: c === true }))}
                    />
                    <Label htmlFor={`fr-scope-${key}`} className="cursor-pointer text-xs">{label}</Label>
                  </div>
                  {find && scope[key] && (
                    <span className="text-xs text-muted-foreground tabular-nums">{count ?? 0}</span>
                  )}
                </div>
              );
            })}
          </div>

          {find && (
            <p className="text-xs text-muted-foreground">
              {total} match{total === 1 ? '' : 'es'} in scope.
            </p>
          )}
          {lastResult !== null && (
            <p className="text-xs text-foreground">
              Replaced {lastResult} occurrence{lastResult === 1 ? '' : 's'}.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { reset(); onOpenChange(false); }}>Close</Button>
          <Button onClick={handleReplaceAll} disabled={!find || total === 0}>
            Replace All
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
