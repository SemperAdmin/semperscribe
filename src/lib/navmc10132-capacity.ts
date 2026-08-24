/**
 * NAVMC 10132 field capacity checker.
 *
 * WHY WIDTH AND NOT CHARACTER COUNT
 *
 * Every text widget on this form is set to Arial 8pt and none of them
 * auto-shrink to fit their content. When a value is wider than the box,
 * the PDF viewer clips it silently, there is no warning and no visual
 * cue in the saved file. The field map's `capacity` number is only an
 * average-character estimate meant as a UI meter hint (how many typical
 * characters might fit). It is not a real limit. A validator that only
 * counts characters will happily pass "WWWWWWWWWW" and fail "iiiiiiiiii"
 * even though the W string is roughly four times as wide, because Arial
 * (like almost every real font) is proportional, not monospaced. The
 * only correct check is to measure the actual rendered width of the
 * actual string and compare it against the usable width of the box.
 *
 * This module does that. It embeds Helvetica advance widths (Helvetica
 * is metric compatible with Arial, so the two report identical widths
 * for the same string, and Helvetica is one of the 14 standard PDF
 * fonts so its metrics are well known and do not require an embedded
 * font program) and uses them to measure strings the same way a PDF
 * viewer would lay them out.
 *
 * Field geometry comes from navmc10132-field-metrics.ts, a small
 * generated table carrying only the four numbers a width check needs
 * for the form's 32 text fields. It intentionally omits choice fields,
 * buttons and signature widgets, and it omits the decoded PDF
 * JavaScript that the full field map carries, none of which belongs in
 * a client bundle.
 */

import {
  NAVMC_10132_FIELD_METRICS,
  type Navmc10132FieldMetric,
} from "@/lib/navmc10132-field-metrics";

/**
 * Helvetica advance widths for printable ASCII 32 to 126, in 1/1000 em
 * units (the standard PDF glyph space). Values are taken from the
 * published Adobe AFM metrics for Helvetica, which Arial matches
 * character for character under Windows metric compatibility rules.
 * Index into this table with the character's code point.
 */
const HELVETICA_ADVANCE_WIDTHS_PER_1000_EM: Readonly<Record<number, number>> = {
  32: 278, 33: 278, 34: 355, 35: 556, 36: 556, 37: 889, 38: 667, 39: 191,
  40: 333, 41: 333, 42: 389, 43: 584, 44: 278, 45: 333, 46: 278, 47: 278,
  48: 556, 49: 556, 50: 556, 51: 556, 52: 556, 53: 556, 54: 556, 55: 556,
  56: 556, 57: 556, 58: 278, 59: 278, 60: 584, 61: 584, 62: 584, 63: 556,
  64: 1015, 65: 667, 66: 667, 67: 722, 68: 722, 69: 667, 70: 611, 71: 778,
  72: 722, 73: 278, 74: 500, 75: 667, 76: 556, 77: 833, 78: 722, 79: 778,
  80: 667, 81: 778, 82: 722, 83: 667, 84: 611, 85: 722, 86: 667, 87: 944,
  88: 667, 89: 667, 90: 611, 91: 278, 92: 278, 93: 278, 94: 469, 95: 556,
  96: 333, 97: 556, 98: 556, 99: 500, 100: 556, 101: 556, 102: 278, 103: 556,
  104: 556, 105: 222, 106: 222, 107: 500, 108: 222, 109: 833, 110: 556,
  111: 556, 112: 556, 113: 556, 114: 333, 115: 500, 116: 278, 117: 556,
  118: 500, 119: 722, 120: 500, 121: 500, 122: 500, 123: 334, 124: 260,
  125: 334, 126: 584,
};

/**
 * Fallback advance width, in 1/1000 em, used for any character outside
 * the embedded printable ASCII 32 to 126 range (for example curly
 * quotes, em dashes typed by a user, or non Latin script). The value
 * chosen is 556, which is the width Helvetica gives every digit 0 to 9
 * and is close to the overall average width across the embedded table.
 * This keeps an out of range character from being under measured, but
 * it is still an approximation. A future revision could widen the
 * embedded table (for example to WinAnsiEncoding 128 to 255) if this
 * form starts collecting values with extended characters often.
 */
const DEFAULT_ADVANCE_WIDTH_PER_1000_EM = 556;

/**
 * Padding subtracted from each side of a field's box width before text
 * is allowed to render, in points. This is Acrobat's default widget
 * text inset, it is not read from the field metrics table because that
 * table only carries geometry, but it is the same figure the full
 * NAVMC 10132 field map records under capacityMethod.paddingPerSide.
 */
const PADDING_PER_SIDE_PT = 2.0;

/**
 * Measure the rendered width of a string set in Helvetica (metric
 * compatible with Arial) at the given point size.
 *
 * Each character's advance width is looked up in the embedded table.
 * A character outside printable ASCII 32 to 126 uses the documented
 * default width instead of throwing, so a caller can still get a
 * (slightly approximate) measurement for values containing unusual
 * characters.
 *
 * @param text the string to measure
 * @param fontSize the point size the string is set at
 * @returns the width of the string in points
 */
export function measureText(text: string, fontSize: number): number {
  let totalPer1000Em = 0;
  for (const char of text) {
    const codePoint = char.codePointAt(0) ?? 0;
    const width =
      HELVETICA_ADVANCE_WIDTHS_PER_1000_EM[codePoint] ??
      DEFAULT_ADVANCE_WIDTH_PER_1000_EM;
    totalPer1000Em += width;
  }
  return (totalPer1000Em / 1000) * fontSize;
}

/**
 * Look up a field's entry in NAVMC_10132_FIELD_METRICS, or throw.
 *
 * An unknown field name is treated as an error rather than a silent
 * true or false, because a typo in a field name is a programming bug
 * in the caller, not a value that happens to fit. Failing loudly here
 * surfaces that bug immediately instead of letting a mistyped field
 * name quietly pass every check.
 *
 * The metrics table holds text fields only, choice fields (comboboxes
 * like "1A ARTICLE"), checkboxes and signature widgets are absent by
 * design because they have no rendered text width to check. A name
 * that belongs to one of those non-text fields is therefore
 * indistinguishable here from a typo, and throws the same error.
 */
function getTextField(fieldName: string): Navmc10132FieldMetric {
  const field = NAVMC_10132_FIELD_METRICS[fieldName];
  if (!field) {
    throw new Error(
      `"${fieldName}" is not a NAVMC 10132 text field. Choice fields ` +
        `and signature widgets are absent from NAVMC_10132_FIELD_METRICS ` +
        `by design, and a plain typo in the name lands here too.`,
    );
  }
  return field;
}

/**
 * The usable width of a field, in points, after subtracting the
 * per side padding used by the form's renderer.
 *
 * For a multiline field this is the usable width of a single line,
 * not the field's total character budget. Use linesOf to find how
 * many lines the field has room for.
 *
 * @param fieldName the field's name as it appears in the field metrics table
 * @returns usable width in points
 * @throws if the field name is not a known NAVMC 10132 text field
 */
export function usableWidthOf(fieldName: string): number {
  const field = getTextField(fieldName);
  return field.width - 2 * PADDING_PER_SIDE_PT;
}

/**
 * The number of lines a field offers, as recorded in the field metrics
 * table. Single line fields report 1. This is exposed separately from
 * usableWidthOf because a multiline field's real capacity is closer
 * to usable width times this number of lines, not usable width alone.
 *
 * @param fieldName the field's name as it appears in the field metrics table
 * @returns the field's line count
 * @throws if the field name is not a known NAVMC 10132 text field
 */
export function linesOf(fieldName: string): number {
  const field = getTextField(fieldName);
  return field.lines ?? 1;
}

/**
 * Split a value into the lines that will actually lay out on the page.
 * A field is only treated as multiline if the metrics table marked it
 * multiline. A single line field is always treated as one line, even
 * if the value happens to contain a newline character, because a
 * single line text widget cannot start a second visual line.
 */
function linesForField(
  field: Navmc10132FieldMetric,
  value: string,
): string[] {
  if (!field.multiline) {
    return [value];
  }
  return value.split("\n");
}

/**
 * Check whether a value fits inside a field without clipping.
 *
 * For a single line field the whole value is measured against the
 * field's usable width. For a multiline field (currently "21 REMARKS"
 * on this form) the value is split on newline characters and each
 * resulting line is measured on its own against the same usable
 * width. The value fits only if every line fits. This module does not
 * word wrap on the caller's behalf, if the caller wants automatic
 * wrapping it must break the string into lines itself before calling.
 * A value with more newline separated lines than the field's line
 * count is not flagged here, this function only checks horizontal
 * (per line) overflow, not vertical overflow from too many lines.
 *
 * @param fieldName the field's name as it appears in the field metrics table
 * @param value the text that would be entered into the field
 * @returns true if every line of the value fits within usable width
 * @throws if the field name is not a known NAVMC 10132 text field
 */
export function fitsInField(fieldName: string, value: string): boolean {
  const field = getTextField(fieldName);
  const usableWidth = field.width - 2 * PADDING_PER_SIDE_PT;
  const lines = linesForField(field, value);
  return lines.every(
    (line) => measureText(line, field.fontSize) <= usableWidth,
  );
}

/**
 * Report how far over the usable width a value runs.
 *
 * For a single line field this is measured width minus usable width.
 * For a multiline field it is the largest such overrun across all
 * newline separated lines. A value that fits returns 0, it never
 * returns a negative number.
 *
 * @param fieldName the field's name as it appears in the field metrics table
 * @param value the text that would be entered into the field
 * @returns points of overflow past the usable width, 0 if it fits
 * @throws if the field name is not a known NAVMC 10132 text field
 */
export function overflowBy(fieldName: string, value: string): number {
  const field = getTextField(fieldName);
  const usableWidth = field.width - 2 * PADDING_PER_SIDE_PT;
  const lines = linesForField(field, value);
  let worstOverflow = 0;
  for (const line of lines) {
    const overflow = measureText(line, field.fontSize) - usableWidth;
    if (overflow > worstOverflow) {
      worstOverflow = overflow;
    }
  }
  return worstOverflow;
}
