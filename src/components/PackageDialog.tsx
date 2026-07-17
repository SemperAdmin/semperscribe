'use client';

/**
 * R4 (USER_DRIVEN_ROADMAP) - package assembly dialog.
 * Build the chain from library documents, see the computed continuation
 * sequences, fix chain-integrity issues, and export the whole package
 * as one PDF with continuous page/reference/enclosure numbering.
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
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Layers, Plus, ChevronUp, ChevronDown, X, Download, RefreshCw, AlertTriangle, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SavedLetter } from '@/types';
import { PackageMember, ComputedSequence, PackageIssue, totalPages } from '@/lib/package-assembly';

interface PackageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  savedLetters: SavedLetter[];
  members: PackageMember[];
  sequences: ComputedSequence[];
  issues: PackageIssue[];
  busy: boolean;
  onAdd: (id: string) => void;
  onRemove: (id: string) => void;
  onMove: (index: number, direction: -1 | 1) => void;
  onClear: () => void;
  onMeasure: () => void;
  onExport: () => void;
}

export function PackageDialog({
  open, onOpenChange, savedLetters, members, sequences, issues, busy,
  onAdd, onRemove, onMove, onClear, onMeasure, onExport,
}: PackageDialogProps) {
  const [pick, setPick] = useState('');
  const memberIds = new Set(members.map((m) => m.id));
  const available = savedLetters.filter((l) => !memberIds.has(l.id));
  const failures = issues.filter((i) => i.severity === 'fail');
  const warnings = issues.filter((i) => i.severity === 'warn');
  const pages = totalPages(members);

  const handleAdd = () => {
    if (!pick) return;
    onAdd(pick);
    setPick('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[680px] h-[75vh] flex flex-col bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <Layers className="w-4 h-4" /> Assemble Package
          </DialogTitle>
          <DialogDescription>
            Chain a basic letter with its endorsements. Page numbers, reference letters,
            and enclosure numbers continue automatically across the package.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2">
          <Select value={pick} onValueChange={setPick}>
            <SelectTrigger className="flex-1 text-xs h-9">
              <SelectValue placeholder={available.length ? 'Add a saved document...' : 'No more saved documents'} />
            </SelectTrigger>
            <SelectContent>
              {available.map((l) => (
                <SelectItem key={l.id} value={l.id} className="text-xs">
                  {(l.name || l.subj || 'Untitled')} - {l.documentType}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" onClick={handleAdd} disabled={!pick}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Add
          </Button>
        </div>

        {issues.length > 0 && (
          <div className="space-y-1">
            {[...failures, ...warnings].map((issue) => (
              <div
                key={issue.id}
                className={cn(
                  'flex items-start gap-2 rounded-md border px-2.5 py-1.5 text-xs',
                  issue.severity === 'fail'
                    ? 'border-destructive/30 bg-destructive/5 text-destructive'
                    : 'border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-400',
                )}
              >
                <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span><strong>{issue.rule}.</strong> {issue.detail}</span>
              </div>
            ))}
          </div>
        )}

        <ScrollArea className="flex-1 -mx-2 px-2">
          {members.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground">
              Add the basic letter first, then its endorsements in order.
            </div>
          ) : (
            <div className="space-y-2">
              {members.map((member, index) => {
                const seq = sequences.find((s) => s.id === member.id);
                return (
                  <div key={member.id} className="rounded-md border border-border bg-background/50 p-3">
                    <div className="flex items-start gap-2">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
                        {index + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium text-foreground truncate">{member.name}</p>
                          <Badge variant="outline" className="text-[10px]">
                            {member.endorsementLevel ? `${member.endorsementLevel} END` : member.documentType}
                          </Badge>
                          {member.pageCount > 0 && (
                            <Badge variant="outline" className="text-[10px] text-muted-foreground">
                              {member.pageCount} pg
                            </Badge>
                          )}
                        </div>
                        {seq && (
                          <p className="text-[11px] text-muted-foreground mt-1 tabular-nums">
                            Starts: page {seq.startingPageNumber} &middot; ref ({seq.startingReferenceLevel}) &middot; encl ({seq.startingEnclosureNumber})
                          </p>
                        )}
                      </div>
                      <div className="flex items-center shrink-0">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onMove(index, -1)} disabled={index === 0} aria-label="Move up">
                          <ChevronUp className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onMove(index, 1)} disabled={index === members.length - 1} aria-label="Move down">
                          <ChevronDown className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => onRemove(member.id)} aria-label="Remove from package">
                          <X className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}

              {pages > 0 && (
                <p className="text-xs text-muted-foreground pt-1 flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
                  {pages} page{pages === 1 ? '' : 's'} total across {members.length} document{members.length === 1 ? '' : 's'}.
                </p>
              )}
            </div>
          )}
        </ScrollArea>

        <DialogFooter className="gap-2">
          {members.length > 0 && (
            <Button variant="ghost" onClick={onClear} disabled={busy}>Clear</Button>
          )}
          <Button variant="outline" onClick={onMeasure} disabled={busy || members.length === 0}>
            <RefreshCw className={cn('w-3.5 h-3.5 mr-1.5', busy && 'animate-spin')} />
            Measure pages
          </Button>
          <Button onClick={onExport} disabled={busy || members.length === 0 || failures.length > 0}>
            <Download className="w-3.5 h-3.5 mr-1.5" /> Export package PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
