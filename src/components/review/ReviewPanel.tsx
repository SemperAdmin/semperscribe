'use client';

/**
 * R1 (USER_DRIVEN_ROADMAP) - review comment panel.
 * Lists every comment on the document, grouped open-first, with
 * resolve and delete. Sits above the form so a returning drafter sees
 * the kickback list immediately.
 */

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { MessageSquare, Check, X, Plus, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  ReviewComment,
  DOCUMENT_ANCHOR,
  anchorLabel,
  createComment,
  openCount,
} from '@/lib/review-comments';
import { ParagraphData } from '@/types';

interface ReviewPanelProps {
  comments: ReviewComment[];
  paragraphs: ParagraphData[];
  /** Review mode: the reviewer is annotating rather than drafting. */
  reviewMode: boolean;
  onReviewModeChange: (value: boolean) => void;
  onAdd: (comment: ReviewComment) => void;
  onToggleResolved: (id: string) => void;
  onRemove: (id: string) => void;
  /** Reviewer name, defaulted from the user profile. */
  authorName: string;
}

export function ReviewPanel({
  comments, paragraphs, reviewMode, onReviewModeChange,
  onAdd, onToggleResolved, onRemove, authorName,
}: ReviewPanelProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [draft, setDraft] = useState('');
  const [author, setAuthor] = useState(authorName);

  const open = openCount(comments);
  const sorted = [...comments].sort((a, b) => Number(a.resolved ?? false) - Number(b.resolved ?? false));

  const paragraphIndexOf = (anchor: string): number | undefined => {
    if (!anchor.startsWith('paragraph:')) return undefined;
    const id = Number(anchor.slice('paragraph:'.length));
    const index = paragraphs.findIndex((p) => p.id === id);
    return index === -1 ? undefined : index;
  };

  const handleAdd = () => {
    if (!draft.trim()) return;
    onAdd(createComment(DOCUMENT_ANCHOR, author, draft));
    setDraft('');
  };

  if (comments.length === 0 && !reviewMode) {
    return (
      <div className="mb-6 flex items-center justify-between rounded-lg border border-border bg-card px-4 py-2.5">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <MessageSquare className="w-4 h-4" />
          Reviewing someone else&apos;s draft?
        </div>
        <Button variant="outline" size="sm" onClick={() => onReviewModeChange(true)}>
          Start review
        </Button>
      </div>
    );
  }

  return (
    <div className="mb-6 rounded-lg border border-border bg-card shadow-sm">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Review comments</h3>
          {open > 0 && <Badge variant="outline" className="text-[10px]">{open} open</Badge>}
          {comments.length > open && (
            <Badge variant="outline" className="text-[10px] text-muted-foreground">
              {comments.length - open} resolved
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          {reviewMode ? (
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => onReviewModeChange(false)}>
              Done reviewing
            </Button>
          ) : (
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => onReviewModeChange(true)}>
              Add comments
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? 'Expand comments' : 'Collapse comments'}
          >
            {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      {!collapsed && (
        <div className="p-3 space-y-2">
          {sorted.length === 0 && (
            <p className="text-xs text-muted-foreground py-2">
              No comments yet. Add one below, or use the comment button on any paragraph.
            </p>
          )}

          {sorted.map((comment) => (
            <div
              key={comment.id}
              className={cn(
                'rounded-md border p-2.5',
                comment.resolved ? 'border-border bg-muted/30 opacity-60' : 'border-primary/30 bg-primary/5',
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Badge variant="outline" className="text-[10px]">
                      {anchorLabel(comment.anchor, paragraphIndexOf(comment.anchor))}
                    </Badge>
                    <span className="text-[11px] font-medium text-foreground">{comment.author}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(comment.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <p className={cn('text-xs mt-1 text-foreground', comment.resolved && 'line-through')}>
                    {comment.text}
                  </p>
                </div>
                <div className="flex items-center shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => onToggleResolved(comment.id)}
                    aria-label={comment.resolved ? 'Reopen comment' : 'Resolve comment'}
                    title={comment.resolved ? 'Reopen' : 'Resolve'}
                  >
                    <Check className={cn('w-3.5 h-3.5', comment.resolved && 'text-green-600 dark:text-green-400')} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-destructive hover:text-destructive"
                    onClick={() => onRemove(comment.id)}
                    aria-label="Delete comment"
                    title="Delete"
                  >
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          ))}

          {reviewMode && (
            <div className="space-y-2 pt-1">
              <Input
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                placeholder="Your name"
                className="h-8 text-xs"
                aria-label="Reviewer name"
              />
              <Textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Comment on the document as a whole..."
                className="text-xs min-h-[60px]"
                aria-label="New comment"
              />
              <Button size="sm" className="h-7 text-xs" onClick={handleAdd} disabled={!draft.trim()}>
                <Plus className="w-3 h-3 mr-1" /> Add comment
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
