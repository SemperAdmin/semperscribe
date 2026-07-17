'use client';

/**
 * R5 (USER_DRIVEN_ROADMAP) - compliance issues with one-click fixes.
 *
 * The full listing for runLetterValidators output. Before this, the
 * only surface was the two-rule strip on the live preview, which
 * pointed overflow at "Proofread" - a DIFFERENT check system
 * (proofread-checks.ts) that never showed these issues. This is their
 * real home.
 *
 * Issues with a registered fixer render a Fix button. Fixes apply
 * through the parent's normal setters, so each is one undo step.
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
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { BadgeCheck, Wand2, XCircle, AlertTriangle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ValidationIssue, ValidatorSeverity } from '@/lib/letter-validators';
import { getFixer, hasFixer } from '@/lib/autofix';

interface ComplianceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  issues: ValidationIssue[];
  /** Applies the fixer for a single issue id. */
  onFix: (issueId: string) => void;
  /** Applies every fixable issue in one step. */
  onFixAll: (issueIds: string[]) => void;
}

const SEVERITY: Record<ValidatorSeverity, { label: string; icon: React.ComponentType<{ className?: string }>; className: string }> = {
  block: { label: 'Blocks export', icon: XCircle, className: 'text-red-600 dark:text-red-400' },
  fail: { label: 'Non-compliant', icon: AlertTriangle, className: 'text-amber-600 dark:text-amber-400' },
  warn: { label: 'Advisory', icon: Info, className: 'text-muted-foreground' },
};

export function ComplianceDialog({ open, onOpenChange, issues, onFix, onFixAll }: ComplianceDialogProps) {
  const order: ValidatorSeverity[] = ['block', 'fail', 'warn'];
  const sorted = [...issues].sort((a, b) => order.indexOf(a.severity) - order.indexOf(b.severity));
  const fixable = sorted.filter((i) => hasFixer(i.id));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[620px] h-[70vh] flex flex-col bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <BadgeCheck className="w-4 h-4" /> Compliance Issues
          </DialogTitle>
          <DialogDescription>
            Live checks against SECNAV M-5216.5, MCO 5215.1K, and DoD marking rules.
            {fixable.length > 0 && ` ${fixable.length} can be fixed automatically.`}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 -mx-2 px-2">
          {sorted.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <BadgeCheck className="w-10 h-10 text-green-600 dark:text-green-400 mb-2" />
              <p className="text-sm font-medium text-foreground">No compliance issues</p>
              <p className="text-xs text-muted-foreground mt-1">Every automated check passes.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {sorted.map((issue) => {
                const meta = SEVERITY[issue.severity];
                const Icon = meta.icon;
                const fixer = getFixer(issue.id);
                return (
                  <div key={issue.id} className="rounded-md border border-border bg-background/50 p-3">
                    <div className="flex items-start gap-2">
                      <Icon className={cn('w-4 h-4 mt-0.5 shrink-0', meta.className)} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium text-foreground">{issue.rule}</p>
                          <Badge variant="outline" className="text-[10px] shrink-0">{meta.label}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{issue.detail}</p>
                        <p className="text-[10px] text-muted-foreground/70 mt-1">{issue.citation}</p>
                      </div>
                      {fixer && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs shrink-0"
                          onClick={() => onFix(issue.id)}
                        >
                          <Wand2 className="w-3 h-3 mr-1" /> {fixer.label}
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          {fixable.length > 1 && (
            <Button onClick={() => onFixAll(fixable.map((i) => i.id))}>
              <Wand2 className="w-4 h-4 mr-1.5" /> Fix all {fixable.length}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
