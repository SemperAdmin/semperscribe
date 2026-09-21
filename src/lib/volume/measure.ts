import { SERIF_EM_WIDTHS } from '@/lib/font-metrics';
import type { Run } from '@/lib/schemas/volume-schema';

export function measureText(s: string, sizePt: number): number {
  let em = 0;
  for (const ch of s) em += SERIF_EM_WIDTHS[ch] ?? 0.5;
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
    const wWidth = measureText(w.text, sizePt);
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
