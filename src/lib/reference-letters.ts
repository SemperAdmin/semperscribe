/**
 * Reference lettering, one source for the validator and both emitters.
 *
 * SECNAV M-5216.5 9-2.3 tells an endorser to "assign a letter to all
 * references you add by continuing the sequence of letters from the
 * basic letter and previous endorsements", so an endorsement's own
 * list starts wherever the document before it stopped.
 *
 * Two implementations used to disagree past (z). A character-code walk
 * from the starting letter emits "{" for the 27th reference, while the
 * validator's Excel-style walk emits "aa". Every caller now goes
 * through the functions below, so the preview, the Word export and the
 * compliance dialog letter a list the same way.
 */

/** Excel-style letters: 1 -> a, 26 -> z, 27 -> aa (audit line 147). */
export function indexToRefLetter(num: number): string {
  let result = '';
  while (num > 0) {
    const remainder = (num - 1) % 26;
    result = String.fromCharCode(97 + remainder) + result;
    num = Math.floor((num - 1) / 26);
  }
  return result;
}

/**
 * Inverse of indexToRefLetter: a -> 1, z -> 26, aa -> 27. Anything
 * which is not a run of a to z reads as 1, so an empty or malformed
 * saved value falls back to the basic letter's own start at (a).
 */
export function refLetterToIndex(letter: string | undefined): number {
  const clean = (letter ?? '').trim().toLowerCase();
  if (!/^[a-z]+$/.test(clean)) return 1;
  let index = 0;
  for (const char of clean) {
    index = index * 26 + (char.charCodeAt(0) - 96);
  }
  return index;
}

/**
 * The letter a zero-based offset past startLetter. refLetterAt('c', 0)
 * is "c", refLetterAt('z', 1) is "aa".
 */
export function refLetterAt(startLetter: string | undefined, offset: number): string {
  return indexToRefLetter(refLetterToIndex(startLetter) + offset);
}

/**
 * The starting reference letter a document renders from. Only an
 * endorsement continues another document's sequence (9-2.3), so every
 * other type starts at (a) whatever a saved draft or a shared link
 * carries in the field.
 */
export function startingRefLetterFor(
  documentType: string | undefined,
  startingReferenceLevel: string | undefined,
): string {
  if (documentType !== 'endorsement') return 'a';
  return startingReferenceLevel?.trim() ? startingReferenceLevel : 'a';
}

/**
 * The starting enclosure number a document renders from, scoped the
 * same way as the reference letter (9-2.4).
 */
export function startingEnclosureNumberFor(
  documentType: string | undefined,
  startingEnclosureNumber: string | undefined,
): number {
  if (documentType !== 'endorsement') return 1;
  const parsed = parseInt(startingEnclosureNumber ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}
