'use client';

import React, { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  CircleDot,
  Info,
  ClipboardCheck,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { FormData, ParagraphData } from '@/types';
import {
  runProofreadChecks,
  getProofreadSummary,
  ProofreadCheck,
  CheckCategory,
  CheckStatus,
} from '@/lib/proofread-checks';
import { GunnyBotReviewSection } from '@/components/gunnybot/GunnyBotReviewSection';

interface ProofreadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formData: FormData;
  paragraphs: ParagraphData[];
  enclosures: string[];
  references: string[];
  spellIssueCount?: number;
}

const CATEGORY_LABELS: Record<CheckCategory, { label: string; description: string }> = {
  format: { label: 'a. Format', description: 'Check format first — do not read for substance until everything else is right.' },
  framework: { label: 'b. Framework', description: 'Look at the framework of the correspondence.' },
  typography: { label: 'c. Typography & Grammar', description: 'Look for typographical errors, misspelled words, improper punctuation, spacing, and grammar.' },
  content: { label: 'd. Content', description: 'Lastly, read for content.' },
};

const STATUS_CONFIG: Record<CheckStatus, { icon: React.ComponentType<{ className?: string }>; color: string; bg: string; label: string }> = {
  pass: { icon: CheckCircle2, color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-950/20', label: 'Pass' },
  fail: { icon: XCircle, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-950/20', label: 'Issue' },
  warn: { icon: AlertTriangle, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/20', label: 'Warning' },
  manual: { icon: CircleDot, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-950/20', label: 'Manual' },
  info: { icon: Info, color: 'text-muted-foreground', bg: 'bg-muted/30', label: 'Info' },
};

export function ProofreadModal({
  open,
  onOpenChange,
  formData,
  paragraphs,
  enclosures,
  references,
  spellIssueCount,
}: ProofreadModalProps) {
  const [confirmedManual, setConfirmedManual] = useState<Set<string>>(new Set());
  const [expandedCategories, setExpandedCategories] = useState<Set<CheckCategory>>(
    new Set(['format', 'framework', 'typography', 'content'])
  );

  const checks = useMemo(
    () => runProofreadChecks(formData, paragraphs, enclosures, references, spellIssueCount),
    [formData, paragraphs, enclosures, references, spellIssueCount]
  );

  const summary = useMemo(() => getProofreadSummary(checks), [checks]);

  const toggleManual = (id: string) => {
    setConfirmedManual(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleCategory = (cat: CheckCategory) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const groupedChecks = useMemo(() => {
    const groups: Record<CheckCategory, ProofreadCheck[]> = {
      format: [],
      framework: [],
      typography: [],
      content: [],
    };
    for (const check of checks) {
      groups[check.category].push(check);
    }
    return groups;
  }, [checks]);

  const getEffectiveStatus = (check: ProofreadCheck): CheckStatus => {
    if (check.status === 'manual' && confirmedManual.has(check.id)) {
      return 'pass';
    }
    return check.status;
  };

  const getCategorySummary = (cat: CheckCategory) => {
    const catChecks = groupedChecks[cat];
    const fails = catChecks.filter(c => getEffectiveStatus(c) === 'fail').length;
    const warns = catChecks.filter(c => getEffectiveStatus(c) === 'warn').length;
    const manuals = catChecks.filter(c => getEffectiveStatus(c) === 'manual').length;
    const passes = catChecks.filter(c => ['pass', 'info'].includes(getEffectiveStatus(c))).length;
    return { total: catChecks.length, fails, warns, manuals, passes };
  };

  const allResolved = checks.every(c => {
    const eff = getEffectiveStatus(c);
    return eff === 'pass' || eff === 'info';
  });

  const handleClose = () => {
    setConfirmedManual(new Set());
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[680px] max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-primary" />
            Proofreading Checklist
          </DialogTitle>
          <DialogDescription>
            Per SECNAV M-5216.5, Ch 2, Para 19. Review each item before finalizing your document.
          </DialogDescription>
        </DialogHeader>

        {/* Summary bar */}
        <div className="flex items-center gap-3 text-xs border rounded-lg p-3 bg-muted/30">
          <Badge variant="outline" className="text-green-700 dark:text-green-400 border-green-300 dark:border-green-700">
            {summary.pass} passed
          </Badge>
          {summary.fail > 0 && (
            <Badge variant="destructive" className="text-xs">
              {summary.fail} issue{summary.fail !== 1 ? 's' : ''}
            </Badge>
          )}
          {summary.warn > 0 && (
            <Badge variant="outline" className="text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-700">
              {summary.warn} warning{summary.warn !== 1 ? 's' : ''}
            </Badge>
          )}
          {summary.manual - confirmedManual.size > 0 && (
            <Badge variant="outline" className="text-blue-700 dark:text-blue-400 border-blue-300 dark:border-blue-700">
              {summary.manual - confirmedManual.size} to confirm
            </Badge>
          )}
          <div className="ml-auto">
            {allResolved ? (
              <span className="text-green-600 dark:text-green-400 font-medium flex items-center gap-1">
                <CheckCircle2 className="h-4 w-4" /> All clear
              </span>
            ) : (
              <span className="text-muted-foreground">
                {summary.total} checks total
              </span>
            )}
          </div>
        </div>

        <ScrollArea className="flex-1 pr-2 max-h-[55vh] overflow-y-auto">
          <div className="space-y-4">
            {(Object.keys(CATEGORY_LABELS) as CheckCategory[]).map(cat => {
              const catInfo = CATEGORY_LABELS[cat];
              const catSummary = getCategorySummary(cat);
              const isExpanded = expandedCategories.has(cat);
              const catChecks = groupedChecks[cat];

              if (catChecks.length === 0) return null;

              return (
                <div key={cat} className="border rounded-lg overflow-hidden">
                  {/* Category header */}
                  <button
                    onClick={() => toggleCategory(cat)}
                    className="w-full flex items-center gap-2 p-3 bg-muted/50 hover:bg-muted/80 transition-colors text-left"
                  >
                    {isExpanded
                      ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                      : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    }
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold">{catInfo.label}</div>
                      <div className="text-xs text-muted-foreground truncate">{catInfo.description}</div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {catSummary.fails > 0 && (
                        <Badge variant="destructive" className="text-[10px] px-1.5 h-5">{catSummary.fails}</Badge>
                      )}
                      {catSummary.warns > 0 && (
                        <Badge variant="outline" className="text-[10px] px-1.5 h-5 text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-700">{catSummary.warns}</Badge>
                      )}
                      {catSummary.manuals > 0 && (
                        <Badge variant="outline" className="text-[10px] px-1.5 h-5 text-blue-600 dark:text-blue-400 border-blue-300 dark:border-blue-700">{catSummary.manuals}</Badge>
                      )}
                      {catSummary.fails === 0 && catSummary.warns === 0 && catSummary.manuals === 0 && (
                        <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                      )}
                    </div>
                  </button>

                  {/* Check items */}
                  {isExpanded && (
                    <div className="divide-y">
                      {catChecks.map(check => {
                        const effectiveStatus = getEffectiveStatus(check);
                        const config = STATUS_CONFIG[effectiveStatus];
                        const Icon = config.icon;
                        const isManual = check.status === 'manual';
                        const isConfirmed = confirmedManual.has(check.id);

                        return (
                          <div
                            key={check.id}
                            className={cn(
                              'flex items-start gap-3 p-3 transition-colors',
                              effectiveStatus === 'fail' && 'bg-red-50/50 dark:bg-red-950/10',
                              effectiveStatus === 'warn' && 'bg-amber-50/50 dark:bg-amber-950/10',
                            )}
                          >
                            {isManual ? (
                              <Checkbox
                                checked={isConfirmed}
                                onCheckedChange={() => toggleManual(check.id)}
                                className="mt-0.5"
                              />
                            ) : (
                              <Icon className={cn('h-4 w-4 mt-0.5 shrink-0', config.color)} />
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground font-mono">{check.reference}</span>
                                <span className={cn(
                                  'text-sm font-medium',
                                  isManual && isConfirmed && 'line-through text-muted-foreground'
                                )}>
                                  {check.label}
                                </span>
                              </div>
                              {check.detail && (
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {check.detail}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}

            <GunnyBotReviewSection
              documentType={formData.documentType}
              subject={typeof formData.subj === 'string' ? formData.subj : ''}
              body={paragraphs.map(p => p.content).join('\n\n')}
            />
          </div>
        </ScrollArea>

        <div className="flex gap-2 pt-2 border-t">
          <Button variant="outline" onClick={handleClose} className="flex-1">
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
