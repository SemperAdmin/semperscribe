import { SERIF_BOLD_ITALIC_EM_WIDTHS, SERIF_EM_WIDTHS } from '@/lib/font-metrics';
import type { Run } from '@/lib/schemas/volume-schema';

/**
 * Finding 9: a hyperlink run is PAINTED bold-italic (volumeGenerator.ts's
 * `fonts.link`, pdf-lib's TimesRomanBoldItalic - per the format standard,
 * LEGEND_TEXT: "Hyperlinks are denoted by bold, italic, blue and underlined
 * font"), but this used to measure EVERY run with the regular-weight table
 * regardless. Bold glyphs are wider than regular ones, so any text sharing a
 * line with a link segment could be positioned too far left of where it
 * actually paints - in the worst case, overrunning the right margin
 * (RIGHT_EDGE/540) because the line never wrapped where it should have.
 * `bold` selects the bold-italic-derived table (see font-metrics.ts's doc
 * comment on SERIF_BOLD_ITALIC_EM_WIDTHS for its own provenance/fallback).
 */
export function measureText(s: string, sizePt: number, bold = false): number {
  const table = bold ? SERIF_BOLD_ITALIC_EM_WIDTHS : SERIF_EM_WIDTHS;
  let em = 0;
  for (const ch of s) em += table[ch] ?? 0.5;
  return em * sizePt;
}

export interface WrappedSegment { text: string; run: Run }
export interface WrappedLine { segments: WrappedSegment[]; x: number }

export function wrapRuns(
  runs: Run[], firstLineX: number, runoverX: number, rightEdgeX: number, sizePt: number,
): WrappedLine[] {
  // Tokenize into words, each carrying its owning run (preserve trailing space).
  const words: { text: string; run: Run }[] = [];
  for (const run of runs) {
    const parts = run.text.split(/(\s+)/).filter(p => p.length > 0);
    for (const p of parts) words.push({ text: p, run });
  }
  const lines: WrappedLine[] = [];
  let curX = firstLineX;
  let line: WrappedSegment[] = [];
  let used = curX;
  const pushLine = () => { lines.push({ segments: line, x: curX }); line = []; };
  for (const w of words) {
    const isSpace = /^\s+$/.test(w.text);
    // Finding 9: matches volumeGenerator.ts's own `isLink` predicate
    // (paintItem) exactly, so a word wraps based on the same width it will
    // actually be painted at.
    //
    // Task 20: a run explicitly flagged `bold` (e.g. the title-page/divider
    // headings, CANCELLATION, or a boilerplate's styled "blue font"/"full
    // revision" phrase - see layout.ts's legendRuns/styleBoilerplateRuns)
    // must measure at the same bold-derived widths a link run already did,
    // for the same reason: bold glyphs are wider than regular ones, so
    // mismeasuring would let a bold segment overrun the right margin before
    // wrapRuns decided to wrap.
    const isBold = !!(w.run.link && w.run.href) || !!w.run.bold;
    const wWidth = measureText(w.text, sizePt, isBold);
    if (!isSpace && used + wWidth > rightEdgeX && line.length > 0) {
      pushLine();
      curX = runoverX; used = curX;
      // drop a leading space at the start of a wrapped line
      if (isSpace) continue;
    }
    line.push({ text: w.text, run: w.run });
    used += wWidth;
  }
  if (line.length > 0) pushLine();
  return lines;
}

/**
 * Word-wraps plain text to fit within `maxWidth` (a plain pixel/point width,
 * not tied to page coordinates like `wrapRuns`) - used by the table painter
 * so a cell's text wraps within its own column instead of overflowing into
 * the next column (Task 18 finding A).
 */
export function wrapPlainText(text: string, maxWidth: number, sizePt: number, bold = false): string[] {
  const words = text.split(/\s+/).filter(w => w.length > 0);
  if (words.length === 0) return [''];
  const lines: string[] = [];
  let current = '';
  for (const w of words) {
    const candidate = current ? `${current} ${w}` : w;
    if (current && measureText(candidate, sizePt, bold) > maxWidth) {
      lines.push(current);
      current = w;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines.length > 0 ? lines : [''];
}
