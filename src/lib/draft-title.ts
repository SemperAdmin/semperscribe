import type { FormData, SavedLetter } from '@/types';
import { counselingDraftTitle } from './counseling';

/**
 * The title a document gets when it is saved without one: its subject,
 * or for a form with no subject line, what identifies it. Empty when the
 * document holds nothing to name it by.
 */
export function defaultDraftTitle(formData: Partial<FormData>): string {
  if (formData.documentType === 'counseling') return counselingDraftTitle(formData as FormData);
  return (formData.subj ?? '').trim();
}

/**
 * The name every library list shows. A title the user set wins. A save
 * stored as "Untitled" (every counseling draft before handoff N-04) is
 * treated as unnamed, so it shows what its contents identify instead.
 */
export function savedLetterTitle(letter: SavedLetter): string {
  const name = (letter.name ?? '').trim();
  if (name && name !== 'Untitled') return name;
  return defaultDraftTitle(letter) || 'Untitled';
}
