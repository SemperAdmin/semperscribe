/**
 * R2 (USER_DRIVEN_ROADMAP) - revision compare.
 *
 * Pure diff between two saved snapshots. The library already stores
 * complete documents, so this reads them - it adds no storage and
 * changes nothing about how documents are saved.
 *
 * Two levels:
 * - Document level: which fields, paragraphs, and list entries changed.
 * - Word level: inside a changed text value, which words moved, via a
 *   longest-common-subsequence walk (no dependency, and the inputs are
 *   paragraph-sized so the O(n*m) table is cheap).
 */

import { SavedLetter } from '@/types';

export type ChangeKind = 'added' | 'removed' | 'changed' | 'unchanged';

export interface WordToken {
  text: string;
  kind: 'added' | 'removed' | 'unchanged';
}

export interface FieldDiff {
  /** Human label, e.g. "Subject" or "Paragraph 2". */
  label: string;
  kind: ChangeKind;
  before: string;
  after: string;
  /** Word-level tokens, present when kind === 'changed'. */
  tokens?: WordToken[];
}

export interface RevisionDiff {
  fields: FieldDiff[];
  /** True when nothing differs. */
  identical: boolean;
}

/** Header fields worth comparing, in reading order. */
const COMPARED_FIELDS: Array<{ key: string; label: string }> = [
  { key: 'documentType', label: 'Document type' },
  { key: 'ssic', label: 'SSIC' },
  { key: 'originatorCode', label: 'Originator code' },
  { key: 'date', label: 'Date' },
  { key: 'from', label: 'From' },
  { key: 'to', label: 'To' },
  { key: 'subj', label: 'Subject' },
  { key: 'sig', label: 'Signature' },
  { key: 'delegationText', label: 'Delegation line' },
  { key: 'line1', label: 'Letterhead line 1' },
  { key: 'line2', label: 'Letterhead line 2' },
  { key: 'line3', label: 'Letterhead line 3' },
];

const LIST_FIELDS: Array<{ key: 'vias' | 'references' | 'enclosures' | 'copyTos' | 'distList'; label: string }> = [
  { key: 'vias', label: 'Via' },
  { key: 'references', label: 'Reference' },
  { key: 'enclosures', label: 'Enclosure' },
  { key: 'copyTos', label: 'Copy to' },
  { key: 'distList', label: 'Distribution' },
];

/**
 * Word-level diff via longest common subsequence. Splits on spaces and
 * keeps them attached so re-joining reproduces the text.
 */
export function diffWords(before: string, after: string): WordToken[] {
  const a = before.split(/(\s+)/).filter((s) => s !== '');
  const b = after.split(/(\s+)/).filter((s) => s !== '');

  // LCS table
  const lcs: number[][] = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }

  const tokens: WordToken[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      tokens.push({ text: a[i], kind: 'unchanged' });
      i++; j++;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      tokens.push({ text: a[i], kind: 'removed' });
      i++;
    } else {
      tokens.push({ text: b[j], kind: 'added' });
      j++;
    }
  }
  while (i < a.length) tokens.push({ text: a[i++], kind: 'removed' });
  while (j < b.length) tokens.push({ text: b[j++], kind: 'added' });
  return tokens;
}

function textDiff(label: string, before: string, after: string): FieldDiff | null {
  const b = (before ?? '').trim();
  const a = (after ?? '').trim();
  if (b === a) return null;
  if (!b) return { label, kind: 'added', before: '', after: a };
  if (!a) return { label, kind: 'removed', before: b, after: '' };
  return { label, kind: 'changed', before: b, after: a, tokens: diffWords(b, a) };
}

/**
 * Compares two snapshots. `before` is the older revision.
 */
export function diffRevisions(before: SavedLetter, after: SavedLetter): RevisionDiff {
  const fields: FieldDiff[] = [];

  for (const { key, label } of COMPARED_FIELDS) {
    const diff = textDiff(label, String(before[key] ?? ''), String(after[key] ?? ''));
    if (diff) fields.push(diff);
  }

  // Body paragraphs, positionally.
  const beforeParas = before.paragraphs ?? [];
  const afterParas = after.paragraphs ?? [];
  const maxParas = Math.max(beforeParas.length, afterParas.length);
  for (let i = 0; i < maxParas; i++) {
    const diff = textDiff(
      `Paragraph ${i + 1}`,
      beforeParas[i]?.content ?? '',
      afterParas[i]?.content ?? '',
    );
    if (diff) fields.push(diff);
  }

  // Lists, positionally.
  for (const { key, label } of LIST_FIELDS) {
    const beforeList = (before[key] as string[] | undefined) ?? [];
    const afterList = (after[key] as string[] | undefined) ?? [];
    const max = Math.max(beforeList.length, afterList.length);
    for (let i = 0; i < max; i++) {
      const diff = textDiff(`${label} ${i + 1}`, beforeList[i] ?? '', afterList[i] ?? '');
      if (diff) fields.push(diff);
    }
  }

  return { fields, identical: fields.length === 0 };
}

/** Short summary line, e.g. "3 changed, 1 added". */
export function summarizeDiff(diff: RevisionDiff): string {
  if (diff.identical) return 'No differences';
  const counts = { added: 0, removed: 0, changed: 0 };
  for (const f of diff.fields) {
    if (f.kind === 'added') counts.added++;
    else if (f.kind === 'removed') counts.removed++;
    else if (f.kind === 'changed') counts.changed++;
  }
  return [
    counts.changed ? `${counts.changed} changed` : '',
    counts.added ? `${counts.added} added` : '',
    counts.removed ? `${counts.removed} removed` : '',
  ].filter(Boolean).join(', ');
}
