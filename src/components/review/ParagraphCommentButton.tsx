'use client';

/**
 * R1 (USER_DRIVEN_ROADMAP) - per-paragraph comment pin.
 * Renders in the paragraph header: shows the open-comment count and
 * opens a popover to read, resolve, or add a comment anchored to THIS
 * paragraph. This is the anchoring that replaces "fix para 2b" prose.
 */

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { MessageSquare, Check, X, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ReviewComment, createComment, paragraphAnchor } from '@/lib/review-comments';

interface ParagraphCommentButtonProps {
  paragraphId: number;
  comments: ReviewComment[];
  onAdd: (comment: ReviewComment) => void;
  onToggleResolved: (id: string) => void;
  onRemove: (id: string) => void;
  authorName: string;
}

export function ParagraphCommentButton({
  paragraphId, comments, onAdd, onToggleResolved, onRemove, authorName,
}: ParagraphCommentButtonProps) {
  const [draft, setDraft] = useState('');
  const anchor = paragraphAnchor(paragraphId);
  const mine = comments.filter((c) => c.anchor === anchor);
  const open = mine.filter((c) => !c.resolved).length;

  const handleAdd = () => {
    if (!draft.trim()) return;
    onAdd(createComment(anchor, authorName, draft));
    setDraft('');
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            'h-7 px-1.5 gap-1 text-xs',
            open > 0 ? 'text-primary hover:text-primary' : 'text-muted-foreground hover:text-foreground',
          )}
          aria-label={open > 0 ? `${open} open comment${open === 1 ? '' : 's'} on this paragraph` : 'Comment on this paragraph'}
          title="Comments"
        >
          <MessageSquare className="h-3.5 w-3.5" />
          {mine.length > 0 && <span className="tabular-nums">{open > 0 ? open : mine.length}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-3 bg-card border-border">
        <div className="space-y-2">
          <p className="text-xs font-semibold text-foreground">Comments on this paragraph</p>

          {mine.length === 0 && (
            <p className="text-xs text-muted-foreground">None yet.</p>
          )}

          {mine.map((comment) => (
            <div
              key={comment.id}
              className={cn(
                'rounded border p-2',
                comment.resolved ? 'border-border bg-muted/30 opacity-60' : 'border-primary/30 bg-primary/5',
              )}
            >
              <div className="flex items-start justify-between gap-1">
                <div className="min-w-0">
                  <p className="text-[11px] font-medium text-foreground">{comment.author}</p>
                  <p className={cn('text-xs text-foreground', comment.resolved && 'line-through')}>{comment.text}</p>
                </div>
                <div className="flex shrink-0">
                  <Button
                    variant="ghost" size="icon" className="h-5 w-5"
                    onClick={() => onToggleResolved(comment.id)}
                    aria-label={comment.resolved ? 'Reopen comment' : 'Resolve comment'}
                  >
                    <Check className={cn('w-3 h-3', comment.resolved && 'text-green-600 dark:text-green-400')} />
                  </Button>
                  <Button
                    variant="ghost" size="icon" className="h-5 w-5 text-destructive hover:text-destructive"
                    onClick={() => onRemove(comment.id)}
                    aria-label="Delete comment"
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            </div>
          ))}

          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Add a comment..."
            className="text-xs min-h-[56px]"
            aria-label="New paragraph comment"
          />
          <Button size="sm" className="h-7 text-xs w-full" onClick={handleAdd} disabled={!draft.trim()}>
            <Plus className="w-3 h-3 mr-1" /> Add
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
