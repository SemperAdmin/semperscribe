/**
 * Cover End Items table (NSN / TAMCN / ID / MODEL) column sizing.
 *
 * The columns size to the data: each column gets at least the width its
 * longest value needs (so nothing wraps), and any leftover space is shared
 * out proportionally so the table still fills the page width. Unit-agnostic,
 * so the DOCX export passes twips and the PDF export passes points.
 */

export interface CoverRow {
  nsn?: string;
  tamcn?: string;
  id?: string;
  model?: string;
}

const HEADERS = ['NSN', 'TAMCN', 'ID', 'MODEL'] as const;
const KEYS: Array<keyof CoverRow> = ['nsn', 'tamcn', 'id', 'model'];

/**
 * Returns four column widths that sum exactly to totalWidth.
 * charUnit = width of one character in the caller's unit at the table size.
 * pad      = fixed per-column allowance (cell padding/margins) in that unit.
 */
export function coverColumnWidths(
  rows: CoverRow[],
  totalWidth: number,
  charUnit: number,
  pad: number
): [number, number, number, number] {
  const maxChars = KEYS.map((key, i) => {
    let longest = HEADERS[i].length;
    for (const row of rows) {
      const len = ((row?.[key] ?? '') as string).toString().length;
      if (len > longest) longest = len;
    }
    return longest;
  });

  const natural = maxChars.map((c) => c * charUnit + pad);
  const sumNatural = natural.reduce((a, b) => a + b, 0);

  let widths: number[];
  if (sumNatural >= totalWidth) {
    // Content needs more than the page allows: scale down proportionally.
    const scale = totalWidth / sumNatural;
    widths = natural.map((w) => w * scale);
  } else {
    // Give each column its content width, then share leftover to fill width.
    const leftover = totalWidth - sumNatural;
    widths = natural.map((w) => w + leftover * (w / sumNatural));
  }

  const rounded = widths.map((w) => Math.round(w));
  // Absorb rounding drift into the last (MODEL) column so the sum is exact.
  rounded[3] += totalWidth - rounded.reduce((a, b) => a + b, 0);
  return [rounded[0], rounded[1], rounded[2], rounded[3]];
}
