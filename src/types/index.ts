
// FormData is a permissive type covering all document form fields.
// The strict discriminated union is LetterFormData; FormData is used
// throughout the codebase as a loose bag of optional properties.
export type FormData = {
  documentType: string;
  /**
   * E.1 (M-5216.5 9-1). Endorsement placement. Undefined reads as
   * 'new-page', so a document saved before the field existed keeps
   * the placement it was written with.
   */
  endorsementPlacement?: 'new-page' | 'same-page';
  /**
   * E.1 (M-5216.5 9-2.1.a). Omit the SSIC, the subject and the basic
   * letter's identification symbols on a same-page endorsement.
   * Undefined reads as true, which is what Figure 9-1 draws.
   */
  samePageOmitsIdentification?: boolean;
  /**
   * E.3 (M-5216.5 9-1, Figure 9-1). The letter a same-page endorsement
   * is added to: a PDF the drafter attached (bytes in the file store,
   * keyed by fileId) or a letter from the library, rendered when the
   * endorsement is previewed or exported. Absent means the endorsement
   * previews and exports as the block alone.
   */
  samePageHost?: SamePageHost;
  /**
   * E.4: render-time instruction, never persisted. True renders a
   * same-page endorsement as the bare block the composer draws onto
   * the signature page of the letter being endorsed: no letterhead, no
   * seal, no page number, no continuation header (Figure 9-1). Unset,
   * a same-page endorsement previews and exports as a page of its own
   * with the letterhead and seal, the 9-2.1.a omission still taken.
   */
  samePageRenderAsBlock?: boolean;
  /**
   * E.5: the second half of a same-page endorsement written from
   * scratch: the endorsement's own addressing, identification, body,
   * signer and lists. Shape in src/lib/same-page-composite.ts. Absent on
   * a same-page endorsement saved before E.5, which is migrated on load.
   */
  samePageEndorsement?: SamePageEndorsementPart;
  [key: string]: any;
};

/**
 * E.5: the endorsement half of a same-page endorsement written from
 * scratch. Kept inline; types/ does not import lib/.
 */
export interface SamePageEndorsementPart {
  from: string;
  to: string;
  vias: string[];
  /** Ser line of the endorsing command (9-2.1.a: Ser and date alone). */
  originatorCode: string;
  date: string;
  paragraphs: ParagraphData[];
  sig: string;
  delegationText: string;
  copyTos: string[];
  /** References the endorsement adds, lettered after the letter's (9-2.3). */
  references: string[];
  /** Enclosures the endorsement adds, numbered after the letter's (9-2.4). */
  enclosures: string[];
  /** True once the drafter has edited From, To or Via by hand. */
  addressingEdited?: boolean;
  /** The letter in reference style, for the new-page fallback's "on" line. */
  basicLetterReference?: string;
}

/** E.3: where the letter being endorsed comes from. */
export type SamePageHost =
  | { kind: 'file'; fileId: string; fileName: string }
  | { kind: 'draft'; letterId: string; title: string };

/**
 * Shared type definitions for the Naval Letter Formatter application
 */

export interface ParagraphData {
  id: number;
  level: number;
  content: string;
  acronymError?: string;
  title?: string;
  isMandatory?: boolean;
  /** P2: portion marking level (e.g. 'CUI'); absent = banner default. */
  marking?: string;
}

export type EndorsementLevel = 'FIRST' | 'SECOND' | 'THIRD' | 'FOURTH' | 'FIFTH' | 'SIXTH' | 'SEVENTH' | 'EIGHTH' | 'NINTH' | 'TENTH' | '';

export interface ReportData {
  id: string;
  title: string;
  controlSymbol: string;
  paragraphRef: string;
  exempt?: boolean;
}

// Distribution Statement Codes per DoD 5230.24
export type DistributionStatementCode = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'X' | '';

export interface DistributionData {
  type: 'none' | 'standard' | 'pcn' | 'pcn-with-copy';
  pcn?: string;
  copyTo?: Array<{ code: string; qty: number }>;
  recipients?: string[]; // For Multiple-Address Letter
  // Distribution Statement fields
  statementCode?: DistributionStatementCode;
  statementReason?: string;
  statementDate?: string;
  statementAuthority?: string;
}

export interface AdminSubsections {
  recordsManagement: { show: boolean; content: string; order: number };
  privacyAct: { show: boolean; content: string; order: number };
  reportsRequired: { show: boolean; content: string; order: number };
}



export type SavedLetter = FormData & {
  id: string;
  savedAt: string;
  /** P1.2: user-assigned document name (defaults to the subject). */
  name?: string;
  /** P1.2: ISO timestamp of the last save - sortable, unlike savedAt. */
  updatedAt?: string;
  vias: string[];
  references: string[];
  enclosures: string[];
  copyTos: string[];
  distList?: string[];
  paragraphs: ParagraphData[];
  /**
   * ENC: enclosure rows with optional file bindings. Structurally
   * mirrors EnclosureRow (kept inline - types/ does not import lib/).
   * File BYTES live in the enclosureFiles IndexedDB store, keyed by
   * fileId, so loading the library never pulls binaries.
   */
  enclosureBindings?: { key: string; title: string; fileId?: string }[];
};

export interface AMHSReference {
  id: string;
  letter: string;
  type: string;
  docId: string;
  title: string;
}

export interface ValidationState {
  ssic: { isValid: boolean; message: string; };
  subj: { isValid: boolean; message: string; };
  from: { isValid: boolean; message: string; };
  to: { isValid: boolean; message: string; };
}

export interface SignaturePosition {
  id: string;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  // Metadata
  signerName?: string;
  reason?: string;
  contactInfo?: string;
}
