'use client';

/**
 * P3.3 (DONDOCS_PARITY_PLAN) - document type guidance browser.
 * Type list on the left, what/when/when-not/example on the right.
 * Opens preselected on the active document type.
 */

import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { BookOpen, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { GUIDANCE, GuidanceEntry } from '@/lib/guidance-data';

interface GuidanceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Active document type - preselects its entry when present. */
  documentType?: string;
}

export function GuidanceDialog({ open, onOpenChange, documentType }: GuidanceDialogProps) {
  const [selected, setSelected] = useState<GuidanceEntry>(GUIDANCE[0]);

  useEffect(() => {
    if (open && documentType) {
      const match = GUIDANCE.find((g) => g.type === documentType);
      if (match) setSelected(match);
    }
  }, [open, documentType]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[680px] h-[70vh] flex flex-col bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <BookOpen className="w-4 h-4" /> Correspondence Guide
          </DialogTitle>
          <DialogDescription>
            What each document type is for, and when a different one serves better.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-1 gap-3 min-h-0">
          <ScrollArea className="w-[210px] shrink-0 border border-border rounded-md">
            <div className="p-1">
              {GUIDANCE.map((entry) => (
                <button
                  key={entry.type}
                  type="button"
                  onClick={() => setSelected(entry)}
                  className={cn(
                    'w-full text-left text-sm rounded px-2 py-1.5 hover:bg-accent hover:text-accent-foreground',
                    selected.type === entry.type && 'bg-accent text-accent-foreground font-medium',
                  )}
                >
                  {entry.label}
                </button>
              ))}
            </div>
          </ScrollArea>

          <ScrollArea className="flex-1 min-h-0">
            <div className="space-y-4 pr-3">
              <div>
                <h3 className="text-base font-semibold text-foreground">{selected.label}</h3>
                <Badge variant="outline" className="text-[10px] mt-1">{selected.citation}</Badge>
              </div>
              <p className="text-sm text-foreground">{selected.what}</p>

              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">When to use</h4>
                <ul className="space-y-1">
                  {selected.whenToUse.map((item, i) => (
                    <li key={i} className="text-sm text-foreground flex gap-2">
                      <Check className="w-3.5 h-3.5 mt-0.5 shrink-0 text-green-600 dark:text-green-400" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">When not to use</h4>
                <ul className="space-y-1">
                  {selected.whenNotToUse.map((item, i) => (
                    <li key={i} className="text-sm text-foreground flex gap-2">
                      <X className="w-3.5 h-3.5 mt-0.5 shrink-0 text-destructive" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Example subject</h4>
                <p className="text-sm text-muted-foreground italic">{selected.example}</p>
              </div>
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
