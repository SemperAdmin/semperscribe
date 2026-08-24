// ---------------------------------------------------------------------------
// NAVMC 10132 (Unit Punishment Book), Item 21 remarks composer.
// Rule source: the item 21 instruction printed on page 3 of the form, which
// prescribes ten remark formats plus free text. This module renders
// structured remarks into that instruction's exact wording and offers a
// matching validator so a caller can flag hand-edited lines that drift from
// the required format.
// ---------------------------------------------------------------------------

/** The ten remark formats prescribed by the item 21 instruction, plus free text. */
// The remark types are canonical in the data model. Redeclaring them here
// would let the two drift silently.
import type { Navmc10132Remark, Navmc10132RemarkKind } from '@/types/navmc';
export type { Navmc10132Remark, Navmc10132RemarkKind };

/**
 * Number of spaces the form's own instruction uses to indent the lettered
 * continuation lines under "Additional Offenses:" and "Additional Victims:".
 */
const CONTINUATION_INDENT = '            '; // 12 spaces, matches the instruction verbatim

/**
 * Renders one remark to its prescribed line or lines, without the trailing
 * newline that joins it to any remark that follows.
 *
 * The two ITEM 13 kinds are handled as fixed sentences per the instruction.
 * Their detail carries only the "d Mmm yy" submission date that sits in the
 * middle of the sentence, never a full punishment description.
 */
function renderRemark(remark: Navmc10132Remark): string {
  const { date, kind, detail } = remark;
  switch (kind) {
    case 'additional-offenses':
      return renderContinuationBlock(date, 'ITEM 1: Additional Offenses:', detail);
    case 'forwarded':
      return `${date} ITEM 2: Fwd to Bn/Sqn CO recom ${detail}.`;
    case 'suspension-vacated-njp':
      return `${date} ITEM 7: ${detail} vacated.`;
    case 'appeal-stayed-restriction':
      return `${date} ITEM 13: Appeal submitted ${detail}, five days elapsed with no action. Punishment of restriction stayed.`;
    case 'appeal-stayed-extra-duties':
      return `${date} ITEM 13: Appeal submitted ${detail}, five days elapsed with no action. Punishment of extra duties stayed.`;
    case 'appeal-denied':
      return `${date} ITEM 14: Appeal denied, ${detail}.`;
    case 'appeal-granted':
      return `${date} ITEM 14: Appeal granted, ${detail}.`;
    case 'suspension-vacated-appeal':
      return `${date} ITEM 14: ${detail} vacated.`;
    case 'set-aside':
      return `${date} ITEM 14: ${detail}, is set aside. All rights, privileges and property affected will be restored.`;
    case 'additional-victims':
      return renderContinuationBlock(date, 'ITEM 22: Additional Victims:', detail);
    default: {
      // Exhaustiveness guard. TypeScript flags any Navmc10132RemarkKind left
      // unhandled above, since an unreachable branch cannot be assigned to
      // the never type.
      const exhaustive: never = kind;
      return exhaustive;
    }
  }
}

/**
 * Renders a header line followed by the lettered continuation lines carried
 * in detail, one per newline-separated entry in detail, each indented the
 * way the form's own instruction shows.
 */
function renderContinuationBlock(date: string, header: string, detail: string): string {
  const lines = detail
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => `${CONTINUATION_INDENT}${line}`);
  return [`${date} ${header}`, ...lines].join('\n');
}

/**
 * Composes the full item 21 text block from structured remarks plus optional
 * free text.
 *
 * Remarks are sorted into chronological order by date before rendering.
 * Entries sharing a date keep their original relative order, since the sort
 * is stable. Free text, when present, is appended after the structured
 * block separated by a blank line. When there is no structured block the
 * separator is omitted and free text stands alone.
 */
export function composeRemarks(remarks: Navmc10132Remark[], freeText?: string): string {
  const sorted = [...remarks].sort((a, b) => {
    if (a.date < b.date) return -1;
    if (a.date > b.date) return 1;
    return 0;
  });

  const structuredBlock = sorted.map(renderRemark).join('\n');
  const trimmedFreeText = freeText ?? '';

  if (trimmedFreeText.length === 0) {
    return structuredBlock;
  }
  if (structuredBlock.length === 0) {
    return trimmedFreeText;
  }
  return `${structuredBlock}\n\n${trimmedFreeText}`;
}

const DATE_PATTERN = '\\d{4}-\\d{2}-\\d{2}';

/**
 * Every single-line shape composeRemarks can emit, expressed as a regular
 * expression over one line of text. A validator uses these to warn on
 * hand-edited item 21 lines that drift from the required wording.
 */
const PRESCRIBED_LINE_PATTERNS: RegExp[] = [
  // ITEM 1 and ITEM 22 headers.
  new RegExp(`^${DATE_PATTERN} ITEM 1: Additional Offenses:$`),
  new RegExp(`^${DATE_PATTERN} ITEM 22: Additional Victims:$`),
  // Lettered continuation lines under either header.
  /^ {12}[A-Z]\. .+$/,
  // ITEM 2, forwarding recommendation.
  new RegExp(`^${DATE_PATTERN} ITEM 2: Fwd to Bn/Sqn CO recom .+\\.$`),
  // ITEM 7, NJP suspension vacated.
  new RegExp(`^${DATE_PATTERN} ITEM 7: .+ susp on .+ vacated\\.$`),
  // ITEM 13, the two fixed appeal-stayed sentences.
  new RegExp(
    `^${DATE_PATTERN} ITEM 13: Appeal submitted .+, five days elapsed with no action\\. Punishment of restriction stayed\\.$`
  ),
  new RegExp(
    `^${DATE_PATTERN} ITEM 13: Appeal submitted .+, five days elapsed with no action\\. Punishment of extra duties stayed\\.$`
  ),
  // ITEM 14, all four variants.
  new RegExp(`^${DATE_PATTERN} ITEM 14: Appeal denied, .+\\.$`),
  new RegExp(`^${DATE_PATTERN} ITEM 14: Appeal granted, .+\\.$`),
  new RegExp(`^${DATE_PATTERN} ITEM 14: .+ susp on .+ vacated\\.$`),
  new RegExp(
    `^${DATE_PATTERN} ITEM 14: .+, is set aside\\. All rights, privileges and property affected will be restored\\.$`
  ),
];

/**
 * Reports whether a single line matches one of the ten prescribed item 21
 * formats, in the exact shape composeRemarks would emit it.
 *
 * Intended for a validator that warns when a hand-edited item 21 line has
 * drifted from the form's required wording. Both fixed ITEM 13 sentences
 * are accepted, since they are prescribed formats even though they carry no
 * free parameter besides the submission date.
 */
export function isPrescribedFormat(line: string): boolean {
  return PRESCRIBED_LINE_PATTERNS.some((pattern) => pattern.test(line));
}
