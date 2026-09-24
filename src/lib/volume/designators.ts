const pad2 = (n: number) => String(n).padStart(2, '0');

/** 1 -> "A", 26 -> "Z", 27 -> "AA" (repeated-letter style used by refs). */
function repeatedAlpha(seq: number): string {
  const letter = String.fromCharCode(97 + ((seq - 1) % 26));
  const count = Math.floor((seq - 1) / 26) + 1;
  return letter.repeat(count);
}
/** 1 -> "a", 26 -> "z", 27 -> "aa", 28 -> "ab" (spreadsheet style). */
function spreadsheetAlpha(seq: number): string {
  let s = ''; let n = seq;
  while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(97 + r) + s; n = Math.floor((n - 1) / 26); }
  return s;
}

export function sectionDesignator(chapter: number, sectionSeq: number, period: boolean): string {
  return `${pad2(chapter)}${pad2(sectionSeq)}${period ? '.' : ''}`;
}
export function paragraphDesignator(chapter: number, sectionSeq: number, paraSeq: number): string {
  return `${pad2(chapter)}${pad2(sectionSeq)}${pad2(paraSeq)}.`;
}
export function subParaDesignator(style: 'upper' | 'arabic', seq: number): string {
  if (style === 'arabic') return `${seq}.`;
  return `${repeatedAlpha(seq).toUpperCase()}.`;
}
/** depth 0 = a., depth 1 = (1), depth 2 = (a), depth 3 = (i-style not used) */
export function correspondenceDesignator(depth: number, seq: number): string {
  switch (depth) {
    case 0: return `${spreadsheetAlpha(seq)}.`;
    case 1: return `(${seq})`;
    default: return `(${spreadsheetAlpha(seq)})`;
  }
}
/** References use repeated-letter parens: (a) … (z) (aa) (bb). index is 0-based. */
export function referenceDesignator(index: number): string {
  return `(${repeatedAlpha(index + 1)})`;
}
