/**
 * Cover End Items table (NSN / TAMCN / ID / MODEL) column sizing.
 *
 * Fixed split per the template owner's no-wrap ruling (2026-06-10):
 * MODEL gets half the table width so nomenclature never wraps, and the
 * remainder goes 22% / 15% / 13% to NSN / TAMCN / ID. Unit-agnostic,
 * so the DOCX export passes twips and the PDF export passes points.
 */

export interface CoverRow {
  nsn?: string;
  tamcn?: string;
  id?: string;
  model?: string;
}

const COLUMN_FRACTIONS = [0.22, 0.15, 0.13, 0.5] as const;

/** Returns the four column widths; they sum exactly to totalWidth. */
export function coverColumnWidths(totalWidth: number): [number, number, number, number] {
  const widths = COLUMN_FRACTIONS.map((fraction) => Math.round(totalWidth * fraction));
  // Absorb rounding drift into the MODEL column so the sum is exact.
  widths[3] += totalWidth - widths.reduce((a, b) => a + b, 0);
  return [widths[0], widths[1], widths[2], widths[3]];
}
