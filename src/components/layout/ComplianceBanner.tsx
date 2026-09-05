import React from 'react';
import { cn } from '@/lib/utils';
import { hasFixer } from '@/lib/autofix';

export interface PreviewIssue {
  /** Validator issue id - the autofix registry keys on it (R5). */
  id: string;
  severity: 'block' | 'fail' | 'warn';
  rule: string;
  detail: string;
  citation: string;
}

interface ComplianceBannerProps {
  /** Phase 2 validator issues. Nothing blocking or failing renders nothing. */
  issues?: PreviewIssue[];
  /** R5: opens the full compliance issue list. */
  onOpenIssues?: () => void;
  /**
   * D.2: the failures are announced from one place. The copy in the
   * shell owns `role="alert"`; the copy inside the mobile preview sheet
   * sets this false, so a screen reader hears them once, not twice.
   */
  live?: boolean;
  className?: string;
}

/**
 * D.2 (UX_POLICY_PLAN_2026-09): the compliance strip used to live inside
 * the preview aside, which is hidden below 1280 px, so a drafter on a
 * laptop or a phone exported a letter missing required M-5216.5 header
 * elements with nothing on screen saying so. It now renders above the
 * editor at every width, and inside the mobile preview sheet.
 */
export function ComplianceBanner({ issues = [], onOpenIssues, live = true, className }: ComplianceBannerProps) {
  const blocking = issues.filter((i) => i.severity === 'block');
  const failing = issues.filter((i) => i.severity === 'fail');
  if (blocking.length === 0 && failing.length === 0) return null;

  const named = [...blocking, ...failing];
  const rules = [...new Set(named.map((i) => i.rule))];

  return (
    <div
      role={live ? 'alert' : undefined}
      className={cn(
        'px-4 py-1.5 text-xs text-white shrink-0 flex items-center justify-between gap-3',
        blocking.length > 0 ? 'bg-red-900' : 'bg-amber-900',
        className,
      )}
      title={named.map((i) => `${i.rule} - ${i.detail} [${i.citation}]`).join('\n')}
    >
      <span className="min-w-0 truncate">
        <span className="font-semibold">
          {blocking.length > 0 ? 'EXPORT BLOCKED: ' : 'Compliance: '}
        </span>
        {rules.slice(0, 2).join(' | ')}
        {rules.length > 2 ? ` (+${rules.length - 2} more)` : ''}
      </span>
      {/* R5: the overflow pointer used to say "see Proofread" - a
          different check system which never listed these. This opens
          the real list, with autofix. */}
      {onOpenIssues && (
        <button
          type="button"
          onClick={onOpenIssues}
          className="shrink-0 underline font-semibold hover:no-underline focus:outline-none focus:ring-2 focus:ring-white/50 rounded"
        >
          Review{named.some((i) => hasFixer(i.id)) ? ' & fix' : ''}
        </button>
      )}
    </div>
  );
}
