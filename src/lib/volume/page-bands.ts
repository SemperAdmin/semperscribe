const ROMAN: [number, string][] = [
  [1000, 'm'], [900, 'cm'], [500, 'd'], [400, 'cd'], [100, 'c'], [90, 'xc'],
  [50, 'l'], [40, 'xl'], [10, 'x'], [9, 'ix'], [5, 'v'], [4, 'iv'], [1, 'i'],
];

export function toRoman(n: number): string {
  let out = ''; let v = n;
  for (const [num, sym] of ROMAN) { while (v >= num) { out += sym; v -= num; } }
  return out;
}

export function refPageLabel(n: number): string { return `REF-${n}`; }

export function bodyPageLabel(opts: {
  chapter: number; page: number; multiChapter: boolean;
  band: 'auto' | 'chapter-page' | 'sequential';
}): string {
  const useChapterPage =
    opts.band === 'chapter-page' || (opts.band === 'auto' && opts.multiChapter);
  return useChapterPage ? `${opts.chapter}-${opts.page}` : `${opts.page}`;
}
