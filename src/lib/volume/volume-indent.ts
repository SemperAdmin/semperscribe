import { SERIF_EM_WIDTHS } from '@/lib/font-metrics';

export const LEFT_MARGIN_PT = 72;
export const LADDER_STEP_PT = 36;
export const RUNOVER_X = LEFT_MARGIN_PT;
const DEFAULT_SIZE = 11;

export function designatorX(level: 1 | 2 | 3 | 4): number {
  return LEFT_MARGIN_PT + (level - 1) * LADDER_STEP_PT;
}

function textWidthPt(s: string, sizePt: number): number {
  let em = 0;
  for (const ch of s) em += SERIF_EM_WIDTHS[ch] ?? 0.5;
  return em * sizePt;
}

/**
 * Text starts at the next 36pt stop after the designator, i.e. at the
 * designator column + one step, unless the designator itself is wider
 * than a step (the 6-digit paragraph token), in which case text starts
 * just past the token plus two spaces.
 */
export function textStartX(level: 1 | 2 | 3 | 4, designator: string, sizePt = DEFAULT_SIZE): number {
  const start = designatorX(level);
  const oneStop = start + LADDER_STEP_PT;
  const spaceW = (SERIF_EM_WIDTHS[' '] ?? 0.25) * sizePt;
  const afterToken = start + textWidthPt(designator, sizePt) + 2 * spaceW;
  return Math.max(oneStop, afterToken);
}
