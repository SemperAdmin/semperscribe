/**
 * Paragraph-heading typography, shared by both emitters.
 *
 * SECNAV M-5216.5 Ch.7 para 2.d: "Underline any heading and capitalize
 * its key words using the Title Case format." MCO 5216.20B carries the
 * same rule for the five-paragraph (SMEAC) order, and
 * docs/POLICY_COMPLIANCE_AUDIT.md line 168 records it as "Underlined
 * Title Case runs".
 *
 * This module exists because the rule used to be spelled out twice, once
 * in NavalLetterPDF and once in docx-generator. Commit 309c2aa dropped
 * the forced uppercase for directives in the PDF only, so Word shouted
 * SMEAC headings the preview rendered in Title Case for seven months.
 * One authority, two consumers: the pair cannot drift again.
 */

/** Types whose headings carry no bold run. */
const NO_BOLD = ['mco', 'moa', 'mou', 'information-paper', 'position-paper', 'volume'];

/**
 * Types whose headings render as authored. Directives (MCO 5216.20B)
 * and the paper formats use Title Case; everything else keeps the
 * long-standing all-caps heading of the standard letter.
 */
const NO_UPPERCASE = [
  'mco', 'bulletin', 'change-transmittal',
  'moa', 'mou', 'information-paper', 'position-paper', 'volume',
];

/** Types whose headings carry no underline. */
const NO_UNDERLINE = ['volume'];

export interface HeadingStyle {
  bold: boolean;
  uppercase: boolean;
  underline: boolean;
}

export function getHeadingStyle(documentType: string | undefined): HeadingStyle {
  const type = documentType ?? '';
  return {
    bold: !NO_BOLD.includes(type),
    uppercase: !NO_UPPERCASE.includes(type),
    // M-5216.5 7-2.d underlines "any heading" - no type is excepted,
    // except the manual/volume format, which uses plain regular-weight headings.
    underline: !NO_UNDERLINE.includes(type),
  };
}
