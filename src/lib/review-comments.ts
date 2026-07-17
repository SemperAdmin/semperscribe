/**
 * R1 (USER_DRIVEN_ROADMAP) - review comments.
 *
 * The kickback loop, closed inside the tool. Today a chief writes
 * "fix para 2b, wrong ref" in an email; the drafter maps prose back
 * onto the document by hand. Here the comment is ATTACHED to the
 * paragraph or field, and travels on the same encrypted share link -
 * no server, no accounts, no new transport. The link IS the routing.
 *
 * Anchors are stable within a share round trip:
 * - paragraph:<id> - the ParagraphData id, preserved across edits
 * - field:<name>   - a header field key (subj, from, to, sig...)
 * - document       - a general comment on the whole document
 */

export type CommentAnchor = string;

export interface ReviewComment {
  id: string;
  /** What the comment is attached to. */
  anchor: CommentAnchor;
  /** Reviewer's display name (free text - no accounts exist). */
  author: string;
  text: string;
  /** ISO timestamp. */
  createdAt: string;
  resolved?: boolean;
}

export function paragraphAnchor(paragraphId: number): CommentAnchor {
  return `paragraph:${paragraphId}`;
}

export function fieldAnchor(fieldName: string): CommentAnchor {
  return `field:${fieldName}`;
}

export const DOCUMENT_ANCHOR: CommentAnchor = 'document';

/** Human label for an anchor, for listing comments outside their pin. */
export function anchorLabel(anchor: CommentAnchor, paragraphIndex?: number): string {
  if (anchor === DOCUMENT_ANCHOR) return 'Document';
  if (anchor.startsWith('paragraph:')) {
    return paragraphIndex !== undefined ? `Paragraph ${paragraphIndex + 1}` : 'Paragraph';
  }
  if (anchor.startsWith('field:')) {
    const key = anchor.slice('field:'.length);
    const labels: Record<string, string> = {
      subj: 'Subject', from: 'From', to: 'To', sig: 'Signature',
      ssic: 'SSIC', date: 'Date', originatorCode: 'Originator code',
    };
    return labels[key] ?? key;
  }
  return anchor;
}

export function createComment(anchor: CommentAnchor, author: string, text: string): ReviewComment {
  return {
    id: `c-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    anchor,
    author: author.trim() || 'Reviewer',
    text: text.trim(),
    createdAt: new Date().toISOString(),
  };
}

export function commentsFor(comments: ReviewComment[], anchor: CommentAnchor): ReviewComment[] {
  return comments.filter((c) => c.anchor === anchor);
}

export function openCount(comments: ReviewComment[]): number {
  return comments.filter((c) => !c.resolved).length;
}

export function toggleResolved(comments: ReviewComment[], id: string): ReviewComment[] {
  return comments.map((c) => (c.id === id ? { ...c, resolved: !c.resolved } : c));
}

export function removeComment(comments: ReviewComment[], id: string): ReviewComment[] {
  return comments.filter((c) => c.id !== id);
}

export function addComment(comments: ReviewComment[], comment: ReviewComment): ReviewComment[] {
  return [...comments, comment];
}

/**
 * Drops comments whose paragraph anchor no longer exists - a paragraph
 * deleted after review would otherwise strand its comments invisibly.
 */
export function pruneOrphans(comments: ReviewComment[], paragraphIds: number[]): ReviewComment[] {
  const live = new Set(paragraphIds.map((id) => `paragraph:${id}`));
  return comments.filter((c) => !c.anchor.startsWith('paragraph:') || live.has(c.anchor));
}
