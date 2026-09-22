const ROMAN: [number, string][] = [
  [1000, 'm'], [900, 'cm'], [500, 'd'], [400, 'cd'], [100, 'c'], [90, 'xc'],
  [50, 'l'], [40, 'xl'], [10, 'x'], [9, 'ix'], [5, 'v'], [4, 'iv'], [1, 'i'],
];

export function toRoman(n: number): string {
  let out = ''; let v = n;
  for (const [num, sym] of ROMAN) { while (v >= num) { out += sym; v -= num; } }
  return out;
}

/**
 * The References band's page label: `REF-{n}` (hyphen). Vol 17's own TOC
 * entry measures with a space (fontmap.py, page index 1, y=656.4: raw
 * content-stream operand `['R', 5, 'E', 4, 'F', -8, ' 1']`), while that same
 * document's References page footer prints the hyphen form (`REF-1`) - an
 * internal inconsistency in the source between its own footer and its own
 * TOC. Task 24: the user explicitly ratified KEEPING the hyphen form here
 * (2026-09-21), since it matches the wider volume set and Vol 17's spaced
 * TOC form is the outlier - see format spec §14's "Accepted canonical
 * deltas vs. Vol 17". Do not change this to match Vol 17's TOC spelling.
 */
export function refPageLabel(n: number): string { return `REF-${n}`; }

/** Task 22: an appendix's own "{LETTER}-{n}" band, restarting at 1 per
 * appendix - the divider is always page 1 (e.g. "A-1"), content follows
 * ("A-2", "A-3", ...), matching Vol 17's own Appendix A footers. */
export function appendixPageLabel(letter: string, n: number): string { return `${letter}-${n}`; }

export function bodyPageLabel(opts: {
  chapter: number; page: number; multiChapter: boolean;
  band: 'auto' | 'chapter-page' | 'sequential';
}): string {
  const useChapterPage =
    opts.band === 'chapter-page' || (opts.band === 'auto' && opts.multiChapter);
  return useChapterPage ? `${opts.chapter}-${opts.page}` : `${opts.page}`;
}
