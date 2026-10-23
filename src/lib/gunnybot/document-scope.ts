/**
 * What GunnyBot does with the open document, stated per document type.
 *
 * Handoff of 22 Oct 26, D-10: the tester opened a Counseling Worksheet,
 * saw the GunnyBot button, and had no statement of what the assistant
 * does with counseling content. The facts, from the three egress paths:
 *
 * - The panel chat sends the typed question and the conversation so
 *   far. The open document is never part of that payload.
 * - Draft and Rewrite exist only in the letter paragraph editor, which
 *   a Counseling Worksheet does not render.
 * - Review, inside the Proofread checklist, sends the document type,
 *   the subject line and the letter paragraphs. A Counseling Worksheet
 *   has no subject and no paragraphs of its own, and its fields (the
 *   Marine's name, EDIPI, targets, duties, marks) never pass through
 *   context-builder.ts. Paragraphs left over from a letter the drafter
 *   switched away from would, so the review is closed on the worksheet
 *   rather than left to send a stale letter under the counseling label.
 *
 * Both functions are pure so the wording is testable and shared between
 * the panel, the review section and the unit tests.
 */

const WORKSHEET_TYPES = new Set(['counseling']);

/** The line under the panel's title. Says what leaves the browser from here. */
export function panelScopeNote(documentType: string | undefined): string {
  if (documentType !== undefined && WORKSHEET_TYPES.has(documentType)) {
    return 'The Counseling Worksheet is not sent. Only the text you type in the box below leaves the browser, after the SSN and EDIPI scan.';
  }
  return 'The open document is not sent from this panel. Only the text you type in the box below leaves the browser, after the SSN and EDIPI scan.';
}

/**
 * Why the proofread review is closed for a document type, or null when
 * the review is available. Shown in place of the Run button.
 */
export function reviewUnavailableReason(documentType: string | undefined): string | null {
  if (documentType !== undefined && WORKSHEET_TYPES.has(documentType)) {
    return 'GunnyBot review reads letter paragraphs. A Counseling Worksheet has none, and none of its fields are sent. Nothing leaves the browser from this checklist.';
  }
  return null;
}
