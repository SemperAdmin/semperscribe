import { FEEDBACK_URL } from './app-links';
import { copyToClipboard } from './url-state';

/**
 * Letterhead correction reports. The app makes no network calls, so a
 * report is a block of text copied to the clipboard for the user to
 * paste into the external feedback form. RUC and MCC lead the block
 * because one RUC covers many directory entries; without the MCC the
 * report does not identify which entry to fix.
 */

export interface LetterheadReportInput {
  ruc?: string;
  mcc?: string;
  /** The heading and address lines exactly as they print. Empty when
   *  the unit is missing from the directory. */
  lines: string[];
}

export function buildLetterheadReport({ ruc, mcc, lines }: LetterheadReportInput): string {
  const printed = lines.map(l => l.trim()).filter(Boolean);
  return [
    'UNIT LETTERHEAD CORRECTION',
    `RUC: ${ruc || '(ENTER RUC)'}  MCC: ${mcc || '(ENTER MCC)'}`,
    '',
    'CURRENT LETTERHEAD IN SEMPERSCRIBE:',
    ...(printed.length ? printed : ['(UNIT NOT FOUND IN DIRECTORY)']),
    '',
    'CORRECT LETTERHEAD (ONE LINE PER LINE, AS IT PRINTS):',
    '',
    '',
    'SOURCE (FOR EXAMPLE CURRENT COMMAND CORRESPONDENCE):',
    '',
  ].join('\n');
}

/**
 * Copies the report and opens the feedback form in a new tab. Returns
 * whether the copy succeeded so the caller tells the user what to do.
 */
export async function sendLetterheadReport(input: LetterheadReportInput): Promise<boolean> {
  const copied = await copyToClipboard(buildLetterheadReport(input));
  window.open(FEEDBACK_URL, '_blank', 'noopener,noreferrer');
  return copied;
}
