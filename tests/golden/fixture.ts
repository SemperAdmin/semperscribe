/**
 * Frozen golden-file fixture for Phase 0 parity harness.
 *
 * DO NOT EDIT casually. Snapshots in tests/golden/__snapshots__ are
 * keyed to this exact content. Any change here invalidates the golden
 * files and must be justified with a citation in the commit message
 * (workflow rule: no functional change without approval).
 *
 * Content mirrors src/lib/templates/basic-letter.ts as of baseline
 * commit 82a6c52, but is intentionally a frozen copy so template edits
 * do not silently churn the golden files.
 */
import type { FormData, ParagraphData } from '@/types';

export const FIXTURE_FORM_DATA: FormData = {
  documentType: 'basic',
  ssic: '1000',
  originatorCode: 'CODE',
  date: '10 Feb 26',
  from: 'Commanding Officer, Unit Name, City, State Zip',
  to: 'Commanding Officer, Destination Unit, City, State Zip',
  subj: 'GOLDEN FILE FIXTURE LETTER',
  sig: 'I. M. MARINE',
  delegationText: 'By direction',
  line1: '',
  line2: '',
  line3: '',
  endorsementLevel: '',
  basicLetterReference: '',
  referenceWho: '',
  referenceType: '',
  referenceDate: '',
  startingReferenceLevel: '',
  startingEnclosureNumber: '',
  startingPageNumber: 1,
  previousPackagePageCount: 0,
  headerType: 'USMC',
  bodyFont: 'times',
  accentColor: 'black',
};

export const FIXTURE_PARAGRAPHS: ParagraphData[] = [
  { id: 1, level: 1, content: 'This is the first paragraph. Paragraphs are numbered 1, 2, 3, and so on.', isMandatory: true },
  { id: 2, level: 1, content: 'This is the second paragraph. It introduces sub-paragraphs.' },
  { id: 3, level: 2, content: 'This is a sub-paragraph (a).' },
  { id: 4, level: 3, content: 'This is a sub-sub-paragraph (1).' },
  { id: 5, level: 4, content: 'This is a sub-sub-sub-paragraph (a).' },
  { id: 6, level: 5, content: 'This is the fifth level <u>1</u>. The designator is underlined.' },
  { id: 7, level: 6, content: 'This is the sixth level <u>a</u>. The designator is underlined.' },
  { id: 8, level: 7, content: 'This is the seventh level (<u>1</u>). Parenthesized, designator underlined.' },
  { id: 9, level: 8, content: 'This is the eighth level (<u>a</u>). Parenthesized, designator underlined.' },
];

export const FIXTURE_VIAS: string[] = [
  'Commanding Officer, Intermediate Unit, Camp Pendleton, CA 92055',
];

export const FIXTURE_REFERENCES: string[] = [
  '(a) MCO 5216.20B',
  '(b) SECNAVINST 5216.5E',
];

export const FIXTURE_ENCLOSURES: string[] = [
  '(1) Supporting Document A',
  '(2) Supporting Document B',
];

export const FIXTURE_COPY_TOS: string[] = [
  'Commanding General, I MEF',
  'Inspector General of the Marine Corps',
];

/**
 * Page-fill fixture for the pagination parity test.
 * Long enough to force a break onto page 2 in both pipelines.
 * The final paragraph carries a unique marker string used to locate
 * the page it lands on in each pipeline's output.
 */
export const PARITY_MARKER = 'PARITYMARKER-PAGE-BREAK-SENTINEL';

const FILLER =
  'This paragraph exists to consume vertical space so the letter ' +
  'spills onto a second page. The wording is fixed and must not be ' +
  'altered because the parity snapshot depends on the exact line count ' +
  'this sentence produces at twelve point type on an eight and one half ' +
  'inch sheet with one inch side margins.';

export const PARITY_PARAGRAPHS: ParagraphData[] = [
  ...Array.from({ length: 14 }, (_, i) => ({
    id: i + 1,
    level: 1,
    content: FILLER,
  })),
  { id: 15, level: 1, content: `Final paragraph. ${PARITY_MARKER}` },
];
