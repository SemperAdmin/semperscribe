'use client';

import React, { useState } from 'react';
import { SpellIssue } from '@/hooks/useSpellCheck';
import { cn } from '@/lib/utils';
import { BookOpen, X, ChevronDown, ChevronUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface SpellCheckBarProps {
  issues: SpellIssue[];
  className?: string;
}

/**
 * Acronyms found in one paragraph, with the expansion to write on first
 * use (SECNAV M-5216.5 paragraph 2-17.c). Reference material, not a
 * warning: the document-level checker is the one place a first-use
 * violation is reported. Hidden when there is nothing to show.
 */
export function SpellCheckBar({ issues, className }: SpellCheckBarProps) {
  const [expanded, setExpanded] = useState(false);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const visible = issues.filter(i => !dismissed.has(i.word));
  if (visible.length === 0) return null;

  const displayed = expanded ? visible : visible.slice(0, 5);

  return (
    <TooltipProvider delayDuration={200}>
      <div
        aria-label="Acronyms"
        className={cn(
          'flex flex-wrap items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs',
          'bg-blue-50/50 dark:bg-blue-950/20 border-blue-200/50 dark:border-blue-800/50',
          className,
        )}
      >
        <span className="flex items-center gap-1 text-blue-700 dark:text-blue-400 font-medium shrink-0">
          <BookOpen className="h-3 w-3" />
          <span>Acronyms</span>
        </span>

        <span className="text-blue-300 dark:text-blue-700">|</span>

        {displayed.map((issue) => (
          <Tooltip key={issue.word}>
            <TooltipTrigger asChild>
              <Badge
                variant="outline"
                className={cn(
                  'cursor-default text-[10px] px-1.5 py-0 h-5 font-mono gap-1 group',
                  'border-blue-400/60 text-blue-800 dark:text-blue-300 bg-blue-100/50 dark:bg-blue-900/30',
                )}
              >
                {issue.word}
                <button
                  type="button"
                  aria-label={`Dismiss ${issue.word}`}
                  className="ml-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDismissed(prev => new Set(prev).add(issue.word));
                  }}
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </Badge>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs text-xs">
              <p>
                Spell out on first use: <span className="font-semibold">{issue.suggestion}</span>
              </p>
            </TooltipContent>
          </Tooltip>
        ))}

        {visible.length > 5 && (
          <button
            type="button"
            className="flex items-center gap-0.5 text-blue-600 dark:text-blue-400 hover:underline text-[10px]"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? (
              <>Show less <ChevronUp className="h-2.5 w-2.5" /></>
            ) : (
              <>+{visible.length - 5} more <ChevronDown className="h-2.5 w-2.5" /></>
            )}
          </button>
        )}
      </div>
    </TooltipProvider>
  );
}
