/**
 * R2 (USER_DRIVEN_ROADMAP) - revision compare.
 */
import { describe, it, expect } from 'vitest';
import { diffRevisions, diffWords, summarizeDiff } from '@/lib/revision-diff';
import type { SavedLetter } from '@/types';

function letter(overrides: Partial<SavedLetter> = {}): SavedLetter {
  return {
    documentType: 'basic', id: '2026-07-15T01:00:00.000Z', savedAt: 'x',
    subj: 'ORIGINAL SUBJECT', from: 'CO', to: 'CMC', sig: 'J. SMITH',
    vias: [], references: [], enclosures: [], copyTos: [], distList: [],
    paragraphs: [{ id: 1, level: 1, content: 'The quick brown fox.' }],
    ...overrides,
  } as SavedLetter;
}

describe('diffWords', () => {
  it('marks removals, additions, and common words', () => {
    const tokens = diffWords('The quick brown fox', 'The quick red fox');
    expect(tokens.some((t) => t.text === 'brown' && t.kind === 'removed')).toBe(true);
    expect(tokens.some((t) => t.text === 'red' && t.kind === 'added')).toBe(true);
    expect(tokens.some((t) => t.text === 'quick' && t.kind === 'unchanged')).toBe(true);
  });

  it('reconstructs both sides losslessly', () => {
    const tokens = diffWords('The quick brown fox', 'The quick red fox');
    expect(tokens.filter((t) => t.kind !== 'added').map((t) => t.text).join('')).toBe('The quick brown fox');
    expect(tokens.filter((t) => t.kind !== 'removed').map((t) => t.text).join('')).toBe('The quick red fox');
  });

  it('handles empty sides', () => {
    expect(diffWords('', 'new text').every((t) => t.kind === 'added')).toBe(true);
    expect(diffWords('old text', '').every((t) => t.kind === 'removed')).toBe(true);
  });
});

describe('diffRevisions', () => {
  it('reports identical snapshots', () => {
    const diff = diffRevisions(letter(), letter());
    expect(diff.identical).toBe(true);
    expect(diff.fields).toHaveLength(0);
  });

  it('detects a changed header field with word tokens', () => {
    const diff = diffRevisions(letter(), letter({ subj: 'REVISED SUBJECT' }));
    const field = diff.fields.find((f) => f.label === 'Subject');
    expect(field?.kind).toBe('changed');
    expect(field?.tokens).toBeDefined();
  });

  it('classifies added and removed values', () => {
    expect(diffRevisions(letter({ subj: '' }), letter({ subj: 'NEW' })).fields[0].kind).toBe('added');
    expect(diffRevisions(letter({ subj: 'GONE' }), letter({ subj: '' })).fields[0].kind).toBe('removed');
  });

  it('detects paragraph changes and additions', () => {
    const changed = diffRevisions(letter(), letter({ paragraphs: [{ id: 1, level: 1, content: 'The quick red fox.' }] }));
    expect(changed.fields.some((f) => f.label === 'Paragraph 1' && f.kind === 'changed')).toBe(true);

    const added = diffRevisions(letter(), letter({
      paragraphs: [
        { id: 1, level: 1, content: 'The quick brown fox.' },
        { id: 2, level: 1, content: 'New paragraph.' },
      ],
    }));
    expect(added.fields.some((f) => f.label === 'Paragraph 2' && f.kind === 'added')).toBe(true);
  });

  it('detects list entry changes', () => {
    const diff = diffRevisions(letter(), letter({ references: ['(a) MCO 5216.20B'] }));
    expect(diff.fields.some((f) => f.label === 'Reference 1' && f.kind === 'added')).toBe(true);
  });

  it('ignores whitespace-only differences', () => {
    expect(diffRevisions(letter({ subj: 'SAME' }), letter({ subj: '  SAME  ' })).identical).toBe(true);
  });
});

describe('summarizeDiff', () => {
  it('summarizes counts', () => {
    expect(summarizeDiff(diffRevisions(letter(), letter()))).toBe('No differences');
    expect(summarizeDiff(diffRevisions(letter(), letter({ subj: 'NEW SUBJECT' })))).toContain('changed');
  });
});
