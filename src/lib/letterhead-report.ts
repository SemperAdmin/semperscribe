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

export interface LetterheadReportResult {
  copied: boolean;
  /** False when the browser blocked the new tab. */
  opened: boolean;
}

/**
 * Copies the report and opens the feedback form in a new tab, and says
 * which of the two worked so the caller tells the user what to do next.
 */
export async function sendLetterheadReport(input: LetterheadReportInput): Promise<LetterheadReportResult> {
  const copied = await copyToClipboard(buildLetterheadReport(input));
  // No 'noopener' feature here: with it, window.open returns null even
  // when the tab opens, so a blocked popup is undetectable. Cutting
  // opener by hand gives the same isolation and keeps the signal.
  const tab = window.open(FEEDBACK_URL, '_blank');
  if (tab) tab.opener = null;
  return { copied, opened: tab !== null };
}

/** Toast text for each outcome of a report. */
export function letterheadReportMessage({ copied, opened }: LetterheadReportResult): { title: string; description: string } {
  if (copied && opened) {
    return {
      title: 'Correction details copied',
      description: 'Paste them into the feedback form that just opened, then type the correct letterhead.',
    };
  }
  if (copied) {
    return {
      title: 'Correction details copied',
      description: 'Your browser blocked the feedback form. Open Send Feedback at the bottom of the page and paste them there.',
    };
  }
  if (opened) {
    return {
      title: 'Copy failed',
      description: 'The feedback form opened. Include your RUC, MCC, and the correct letterhead lines.',
    };
  }
  return {
    title: 'Report not sent',
    description: 'Your browser blocked the copy and the feedback form. Open Send Feedback at the bottom of the page and include your RUC, MCC, and the correct letterhead lines.',
  };
}
