import { LetterFormData } from '@/lib/schemas';

// FormData is a permissive type covering all document form fields.
// The strict discriminated union is LetterFormData; FormData is used
// throughout the codebase as a loose bag of optional properties.
export type FormData = {
  documentType: string;
  [key: string]: any;
};

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
