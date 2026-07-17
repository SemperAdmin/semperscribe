/**
 * R1 (USER_DRIVEN_ROADMAP) - review comments, including the round trip
 * through the encrypted share link (the whole point: the link is the
 * routing, so comments must survive it intact).
 */
import { describe, it, expect } from 'vitest';
import {
  createComment, paragraphAnchor, fieldAnchor, DOCUMENT_ANCHOR, anchorLabel,
  addComment, toggleResolved, removeComment, pruneOrphans, openCount, commentsFor,
} from '@/lib/review-comments';
import { generateEncryptedShareUrl, decryptSharedState, ShareableState } from '@/lib/url-state';
import type { FormData } from '@/types';

describe('anchors', () => {
  it('builds and labels anchors', () => {
    expect(paragraphAnchor(2)).toBe('paragraph:2');
    expect(fieldAnchor('subj')).toBe('field:subj');
    expect(anchorLabel(DOCUMENT_ANCHOR)).toBe('Document');
    expect(anchorLabel(fieldAnchor('subj'))).toBe('Subject');
    expect(anchorLabel(paragraphAnchor(5), 4)).toBe('Paragraph 5');
  });
});

describe('comment operations', () => {
  it('creates a comment with a trimmed author fallback', () => {
    const comment = createComment(paragraphAnchor(2), 'GySgt Jones', 'Wrong reference.');
    expect(comment.anchor).toBe('paragraph:2');
    expect(comment.author).toBe('GySgt Jones');
    expect(createComment(DOCUMENT_ANCHOR, '   ', 'x').author).toBe('Reviewer');
  });

  it('adds, resolves, reopens, and removes', () => {
    const first = createComment(paragraphAnchor(1), 'A', 'one');
    let list = addComment([], first);
    list = addComment(list, createComment(DOCUMENT_ANCHOR, 'B', 'two'));
    expect(list).toHaveLength(2);
    expect(openCount(list)).toBe(2);

    list = toggleResolved(list, first.id);
    expect(openCount(list)).toBe(1);
    expect(openCount(toggleResolved(list, first.id))).toBe(2);

    expect(removeComment(list, first.id)).toHaveLength(1);
  });

  it('filters by anchor', () => {
    const list = [
      createComment(paragraphAnchor(1), 'A', 'one'),
      createComment(paragraphAnchor(2), 'B', 'two'),
    ];
    expect(commentsFor(list, 'paragraph:1')).toHaveLength(1);
  });
});

describe('pruneOrphans', () => {
  it('drops comments on deleted paragraphs and keeps the rest', () => {
    const list = [
      createComment(paragraphAnchor(1), 'A', 'lives'),
      createComment(paragraphAnchor(99), 'B', 'orphan'),
      createComment(DOCUMENT_ANCHOR, 'C', 'document-level'),
    ];
    const pruned = pruneOrphans(list, [1, 2]);
    expect(pruned).toHaveLength(2);
    expect(pruned.some((c) => c.anchor === 'paragraph:99')).toBe(false);
    expect(pruned.some((c) => c.anchor === DOCUMENT_ANCHOR)).toBe(true);
  });
});

describe('encrypted link round trip', () => {
  it('carries comments intact through encryption', async () => {
    const comment = createComment(paragraphAnchor(2), 'GySgt Jones', 'Wrong reference here.');
    const resolved = { ...createComment(DOCUMENT_ANCHOR, 'Chief', 'Fix para 1.'), resolved: true };
    const state: ShareableState = {
      formData: { documentType: 'basic', subj: 'TEST' } as FormData,
      paragraphs: [{ id: 1, level: 1, content: 'Body.' }],
      comments: [comment, resolved],
      version: 2,
    };

    const { url } = await generateEncryptedShareUrl(state, 'password123', 'https://example.mil');
    const result = await decryptSharedState(url.split('#es=')[1], 'password123');

    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.state.comments).toHaveLength(2);
    expect(result.state.comments?.[0].anchor).toBe('paragraph:2');
    expect(result.state.comments?.[0].author).toBe('GySgt Jones');
    expect(result.state.comments?.[0].text).toBe('Wrong reference here.');
    expect(result.state.comments?.[1].resolved).toBe(true);
  });

  it('omits the field entirely when there are no comments', async () => {
    const { url } = await generateEncryptedShareUrl(
      { formData: { documentType: 'basic' } as FormData, version: 2 },
      'password123',
      'https://example.mil',
    );
    const result = await decryptSharedState(url.split('#es=')[1], 'password123');
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.state.comments).toBeUndefined();
  });
});
