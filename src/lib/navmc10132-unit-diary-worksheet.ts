/**
 * The unit diary worksheet: the MCTFS transactions for one NJP, laid out as
 * a page a clerk works from at the diary terminal.
 *
 * STEPHEN, 2026-08-26: the Unit Diary Handoff panel keeps its preview, and
 * there is an export "that will have the transactions completed with the
 * proper data based on the PRIUM". This is that export's content. The
 * transactions themselves are NOT built here: navmc10132-mctfs.ts derives
 * them from MCTFSPRIUM 70502, 70503, 70504, 70507 and 70508, and this module
 * only arranges what that one returns. Two modules deriving MCTFS
 * statements would be two modules to keep in step with the PRIUM.
 *
 * SO THE PANEL AND THE SHEET CANNOT DISAGREE. Both read
 * `mctfsNjpStatements` and `unitDiaryBlock`. A clerk who checks the screen
 * against the print is checking two renderings of one derivation, which is
 * the only arrangement where "the preview matches the export" is a property
 * rather than a coincidence.
 *
 * WHAT IS DELIBERATELY NOT ON THE SHEET. A case identity header, Stephen's
 * ruling the same day when it was offered. Note what that does and does not
 * achieve: the HIST statement block IS on the sheet, at his direction and
 * because MCTFSPRIUM 70503 wants that text on the TTC 268, and that block
 * opens with the Marine's name, grade and EDIPI. So the printed sheet
 * carries personally identifying information either way. Declining the
 * header removed a second, redundant statement of it, not the information.
 * Handle the printout accordingly.
 *
 * NO CONTROL MARKINGS. The app adds none to anything it generates, per
 * Stephen's standing ruling, and tests/navmc10132-cui-guard.test.ts scans
 * this module for one.
 *
 * BLOCKERS PRINT, THEY DO NOT STOP THE EXPORT. A blocker means "do not
 * enter what is below", and the clerk needs to be holding the sheet to know
 * why. Refusing to produce it would leave them with the screen only, which
 * is the thing they walked away from. The panel's own alreadyReported branch
 * makes the same choice for the same reason.
 */

import type { FormData } from '@/types';
import { unitDiaryBlock } from '@/lib/navmc10132-unit-diary';
import { mctfsNjpStatements, type MctfsStatement } from '@/lib/navmc10132-mctfs';
import { wrapHanging } from '@/lib/jagman-a1-wrap';
import {
  deriveBodySize,
  linesPerPage,
  renderMonospacePdf,
  type MonospacePdfResult,
} from '@/lib/monospace-pdf';

/**
 * The sheet's measure, in characters.
 *
 * NOT A ROUND NUMBER PICKED FOR TIDINESS. The renderer derives its type size
 * from the longest line and refuses to go below 7pt, so the measure decides
 * the type size: 90 columns lands at 8.6pt Courier, which prints legibly and
 * still fits the longest transaction this app emits. A TTC 212 carrying
 * three articles and four punishments runs past 110 characters unwrapped,
 * which would have forced 6.7pt and thrown.
 */
export const WORKSHEET_WIDTH = 90;

/** A run of lines that must not be split across a page break. */
export interface WorksheetBlock {
  lines: string[];
}

export interface UnitDiaryWorksheet {
  /** The page content, already paginated. */
  lines: string[];
  /** Hard stops, repeated here so a caller can warn before downloading. */
  blockers: string[];
  /** Data the form does not carry, repeated for the same reason. */
  missing: string[];
  /** How many transactions the sheet carries. Zero is possible and printed. */
  statementCount: number;
}

/** A full-measure rule, the sheet's only division. */
function rule(): string {
  return '-'.repeat(WORKSHEET_WIDTH);
}

/**
 * A numbered section heading with its rule.
 *
 * RETURNED AS LINES TO PREPEND, never pushed as a block of its own. A
 * heading that is its own block lands at the foot of a page with its content
 * pushed to the next one, which is exactly what happened to section 3 the
 * first time this ran: "3. TRANSACTIONS, IN THE ORDER TO ENTER THEM" printed
 * as the last thing on page 1 with no transaction under it. A heading is
 * part of the thing it heads.
 */
function heading(number: number, title: string): string[] {
  return [rule(), `${number}. ${title.toUpperCase()}`, rule(), ''];
}

/**
 * One transaction, as a block.
 *
 * THE CHECK BOX IS THE POINT OF A PRINTED SHEET. A clerk enters these one at
 * a time over a session that a phone call interrupts, and the failure this
 * guards is entering one twice, which for a TTC 283 moves money twice.
 *
 * The statement wraps with a hanging indent under its own first character
 * rather than being cut. It is a single statement however many lines it
 * takes, and the indent is what says so.
 */
export function statementBlock(statement: MctfsStatement, index: number): WorksheetBlock {
  const lines: string[] = [];
  // THE TRANSACTION NUMBER IS NOT REPEATED HERE. It used to head this line
  // as well, back when `statement.text` began at the date and the number had
  // nowhere else to go. Since 2026-08-26 the text IS the whole line, TTC and
  // sequence included, per the template in MCTFSPRIUM 70507.4, so printing
  // it twice on a page whose purpose is the keyable string is noise. The
  // number is still the first thing on the statement line below.
  const label = `[ ] ${index}.`;
  const gap = WORKSHEET_WIDTH - label.length - statement.authority.length;
  lines.push(gap > 1 ? `${label}${' '.repeat(gap)}${statement.authority}` : label);
  if (gap <= 1) lines.push(`    ${statement.authority}`);
  lines.push('');
  for (const line of wrapHanging(statement.text, WORKSHEET_WIDTH, '      ')) {
    lines.push(line);
  }
  if (statement.notes.length > 0) {
    lines.push('');
    for (const note of statement.notes) {
      for (const line of wrapHanging(note, WORKSHEET_WIDTH, '    - ')) lines.push(line);
    }
  }
  lines.push('');
  return { lines };
}

/**
 * One line of the transcription aid, brought inside the sheet's measure.
 *
 * FOUND BY LOOKING AT A PRINTED SAMPLE, not by a test. The aid is built for
 * the clipboard, where nothing bounds a line, so an N11 restriction whose
 * limits a commander wrote out in full runs past ninety columns and, far
 * enough past, takes the whole download down: the renderer sizes type from
 * the longest line and throws below seven point. Every other line on this
 * sheet is wrapped by its own builder; these were passed through verbatim.
 *
 * THE HANGING INDENT IS THE LINE'S OWN LABEL COLUMN, because the aid is a
 * two-column layout and wrapping a value back to column zero would put it
 * under the labels. The label is whatever precedes the first run of two or
 * more spaces near the start of the line, which is the shape every labelled
 * line in that block has. A line with no such run wraps under a plain
 * four-space indent.
 */
export function fitProseLine(line: string): string[] {
  if (line.length <= WORKSHEET_WIDTH) return [line];
  const labelled = /^(\s*\S+\s{2,})(.+)$/.exec(line);
  if (!labelled) return wrapHanging(line.trim(), WORKSHEET_WIDTH, '    ');
  const [, prefix, rest] = labelled;
  // wrapHanging opens line one with the prefix and indents the rest to match.
  return wrapHanging(rest, WORKSHEET_WIDTH, prefix);
}

/**
 * Lays blocks out so none is split across a page break.
 *
 * The renderer paginates by line count alone and cannot know which of a
 * caller's lines belong together, so the padding happens here. A block
 * longer than a whole page is emitted as-is and WILL split: padding it would
 * push a full page of blank paper ahead of it and still split it.
 */
export function paginateBlocks(blocks: readonly WorksheetBlock[], perPage: number): string[] {
  const out: string[] = [];
  let used = 0;
  for (const block of blocks) {
    const height = block.lines.length;
    if (height <= perPage && used > 0 && used + height > perPage) {
      while (used < perPage) {
        out.push('');
        used += 1;
      }
      used = 0;
    }
    out.push(...block.lines);
    used = (used + height) % perPage;
  }
  return out;
}

/**
 * Builds the worksheet.
 *
 * `perPage` comes from the renderer, so the caller passes what the page
 * actually holds rather than this module guessing at it.
 */
export function unitDiaryWorksheet(formData: FormData, perPage: number): UnitDiaryWorksheet {
  const block = unitDiaryBlock(formData);
  const mctfs = mctfsNjpStatements(formData);
  const blocks: WorksheetBlock[] = [];

  const title: string[] = [
    'MCTFS UNIT DIARY WORKSHEET',
    'Nonjudicial punishment recorded on NAVMC 10132',
    '',
    'Built by SemperScribe from the form. There is no MCTFS connection: nothing',
    'below has been entered, checked against the master file, or reserved. Read',
    'each transaction before you enter it.',
    '',
  ];
  blocks.push({ lines: title });

  if (mctfs.blockers.length > 0) {
    const lines = ['*** DO NOT ENTER THE TRANSACTIONS BELOW ***', ''];
    for (const item of mctfs.blockers) {
      for (const line of wrapHanging(item, WORKSHEET_WIDTH, '    - ')) lines.push(line);
    }
    lines.push('');
    blocks.push({ lines });
  }

  if (block.appealPending) {
    const lines = wrapHanging(
      'Item 12 records an intent to appeal and item 14 carries no decision. The ' +
        'reviewing authority can still set aside, mitigate, remit or suspend this ' +
        'punishment, so an entry made now may have to be corrected once item 14 is signed.',
      WORKSHEET_WIDTH,
      'PENDING APPEAL. ',
    );
    blocks.push({ lines: [...lines, ''] });
  }

  if (block.alreadyReported) {
    const dated =
      block.alreadyReported.dtd === '' ? '' : `, dated ${block.alreadyReported.dtd}`;
    const lines = wrapHanging(
      `This NJP has already been reported as unit diary UD ${block.alreadyReported.ud}` +
        `${dated}, per item 16. Entering it again creates a duplicate.`,
      WORKSHEET_WIDTH,
      'ALREADY REPORTED. ',
    );
    blocks.push({ lines: [...lines, ''] });
  }

  // The two kinds of blank are not the same kind of problem, and a clerk
  // holding the sheet has to be able to tell them apart: one is filled in at
  // the terminal, the other means going back to the form.
  const legendLines = [
    'A value in [SQUARE BRACKETS] is not on this sheet. Either MCTFS assigns it at',
    'the terminal, such as a statement sequence, or the form does not carry it yet.',
    'Section 2 lists the ones the form is missing.',
    '',
  ];
  blocks.push({ lines: legendLines });

  // --- 1. The HIST text -------------------------------------------------
  const histLines = [
    ...heading(1, 'HIST statement text'),
    'MCTFSPRIUM 70503 wants the statistical information and all punishment awarded',
    'on the TTC 268 history statement. This is that text.',
    '',
    ...block.text.split('\n').flatMap(fitProseLine),
    '',
  ];
  blocks.push({ lines: histLines });

  // --- 2. What the form is missing --------------------------------------
  const missingLines = [...heading(2, 'Data the form does not carry')];
  if (mctfs.missing.length === 0 && block.missing.length === 0) {
    missingLines.push('None. Every value the transactions need is on the form.', '');
  } else {
    for (const item of [...mctfs.missing, ...block.missing]) {
      for (const line of wrapHanging(item, WORKSHEET_WIDTH, '    - ')) missingLines.push(line);
    }
    missingLines.push('');
  }
  blocks.push({ lines: missingLines });

  // --- 3. The transactions ----------------------------------------------
  const sectionThree = heading(3, 'Transactions, in the order to enter them');
  if (mctfs.statements.length === 0) {
    blocks.push({ lines: [...sectionThree, 'None. See section 2 and the blockers above.', ''] });
  } else {
    mctfs.statements.forEach((statement, i) => {
      const block = statementBlock(statement, i + 1);
      blocks.push(i === 0 ? { lines: [...sectionThree, ...block.lines] } : block);
    });
  }

  // --- 4. Follow-on entries ---------------------------------------------
  if (mctfs.reminders.length > 0) {
    const lines = [...heading(4, 'Follow-on entries this NJP requires')];
    for (const item of mctfs.reminders) {
      for (const line of wrapHanging(item, WORKSHEET_WIDTH, '[ ] ')) lines.push(line);
      lines.push('');
    }
    // ONE BLOCK, not one per reminder. These are short and there are two of
    // them, so keeping them together costs at most a few lines of padding
    // and stops "follow-on entries" heading an empty page foot.
    blocks.push({ lines });
  }

  // --- The round trip ----------------------------------------------------
  // Item 16 IS the unit diary entry (docs/NAVMC_10132_SPEC.md 11.6), so the
  // UD number this sheet produces goes back onto the form. Asking for it
  // here is what closes that loop rather than leaving it to memory.
  blocks.push({
    lines: [
      rule(),
      'Entered by ____________________________  Date ______________',
      '',
      'UD number ____________________  Enter this and the date in item 16 of the',
      'NAVMC 10132, which is what records that this NJP has been reported.',
      rule(),
    ],
  });

  return {
    lines: paginateBlocks(blocks, perPage),
    blockers: mctfs.blockers,
    missing: [...mctfs.missing, ...block.missing],
    statementCount: mctfs.statements.length,
  };
}

/**
 * The type size this sheet prints at, and the lines a page then holds.
 *
 * DERIVED FROM THE MEASURE, NOT FROM THE CONTENT, and that is the whole
 * reason it is computed here rather than left to the renderer. The renderer
 * sizes type from the longest line it is given, so a sparse case with short
 * transactions would print larger than a full one and hold fewer lines per
 * page. Two sheets for two Marines would then paginate differently, and the
 * block-keeping below is computed against a page height. Fixing the size to
 * the measure makes every worksheet the same document.
 */
export function worksheetMetrics(): { bodySize: number; perPage: number } {
  const bodySize = deriveBodySize(['x'.repeat(WORKSHEET_WIDTH)]);
  return { bodySize, perPage: linesPerPage(bodySize) };
}

export interface UnitDiaryWorksheetPdf extends MonospacePdfResult {
  blockers: string[];
  missing: string[];
  statementCount: number;
  /** Suggested download name. */
  filename: string;
}

/**
 * The download name.
 *
 * NAMED FOR THE MARINE, because a clerk downloads one of these per case and
 * a folder of files all called the same thing is how the wrong sheet gets
 * printed. This is the same PII the sheet itself already carries through the
 * HIST block, so it adds no exposure the file does not already have.
 */
function worksheetFilename(formData: FormData): string {
  const raw = formData.accusedName;
  const name = (typeof raw === 'string' ? raw : '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return `unit-diary-worksheet-${name || 'njp'}.pdf`;
}

/**
 * Renders the worksheet to PDF.
 *
 * Returns the blockers alongside the bytes rather than refusing to render
 * on them. See this module's header: a blocker is something the clerk needs
 * to be holding the sheet to read.
 */
export async function renderUnitDiaryWorksheetPdf(
  formData: FormData,
): Promise<UnitDiaryWorksheetPdf> {
  const { bodySize, perPage } = worksheetMetrics();
  const sheet = unitDiaryWorksheet(formData, perPage);
  const result = await renderMonospacePdf(sheet.lines, {
    title: 'MCTFS unit diary worksheet',
    subject: 'MCTFSPRIUM 70502, 70503, 70504, 70507, 70508',
    header: 'MCTFS UNIT DIARY WORKSHEET',
    footerLeft: 'Unit diary worksheet',
    footerRight: 'MCTFSPRIUM',
    bodySize,
  });
  return {
    ...result,
    blockers: sheet.blockers,
    missing: sheet.missing,
    statementCount: sheet.statementCount,
    filename: worksheetFilename(formData),
  };
}
