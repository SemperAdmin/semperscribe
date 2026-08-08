/**
 * NLDP (Naval Letter Data Package) Format Specification
 *
 * A standardized format for sharing Marine Corps Directive data between applications
 * Uses .nldp extension with JSON structure for broad compatibility
 *
 * THIS MODULE IS THE SPECIFICATION. docs/NLDP_FEATURE_GUIDE.md is derived
 * from it and must be updated when it changes, never the other way round.
 *
 * Version 1.1 (docs/POLICY_AS_DATA_HANDOFF.md): every 1.1 addition is
 * optional at the type level so a 1.0 reader still parses a 1.1 file;
 * the release validator (lib/release.ts) is what makes them required.
 */

/**
 * Lifecycle of the directive carried in the package. 1.0 stopped at
 * 'final', which meant "drafting complete" and was misread as "in
 * force" — none of the 1.0 states meant a commander signed it. The
 * signed and promulgated states exist so a Release package can say so
 * honestly; only those two are eligible for ingest.
 */
export type NLDPLifecycle =
  | 'draft'        // being written
  | 'review'       // in staffing
  | 'final'        // drafting complete, NOT signed
  | 'signed'       // signature applied
  | 'promulgated'  // released to the fleet
  | 'cancelled';

export interface NLDPMetadata {
  /** Package creation timestamp */
  createdAt: string;
  /** Format version for compatibility */
  formatVersion: string;
  /** Application that created the package */
  createdBy: string;
  /** 1.1 - build that produced the export, so a defective package is
   *  traceable to the build that wrote it. */
  generator?: {
    appVersion?: string;
    commit?: string;
  };
  /** Optional author information */
  author?: {
    name?: string;
    unit?: string;
    email?: string;
  };
  /** Package description */
  package?: {
    title?: string;
    description?: string;
    tags?: string[];
  };
}

export interface NLDPDataIntegrity {
  /** SHA-256 hash of the data section for integrity verification */
  dataHash: string;
  /** CRC32 checksum for additional verification */
  crc32: string;
  /** Number of records/items in the package */
  recordCount: number;
}

export interface NLDPFormData {
  documentType: string;
  ssic_code?: string;
  consecutive_point?: number;
  revision_suffix?: string;
  sponsor_code?: string;
  date_signed?: string;
  subj?: string;
  line1?: string;
  line2?: string;
  line3?: string;
  from?: string;
  to?: string;
  sig?: string;
  delegationText?: string;
  cancellationDate?: string;
  basicDirectiveReference?: string;
  changeNumber?: string;
  pageReplacements?: Array<{
    newPages: string;
    replacesPages: string;
  }>;
  distributionStatement?: {
    code: string;
    reason?: string;
    dateOfDetermination?: string;
    originatingCommand?: string;
  };
  [key: string]: any; // Allow additional fields
}

export interface NLDPParagraph {
  id: number;
  level: number;
  content: string;
  isMandatory?: boolean;
  title?: string;
  acronymError?: string;
  /** 1.1 - printed designator from lib/citation.ts, e.g. "1.", "a.", "(1)".
   *  Emitted so the numbering rule has exactly one implementation. */
  designator?: string;
}

/** 1.1 - best-effort structured citation for a reference line. */
export interface NLDPCitedIssuance {
  docType?: string;   // MCO, MARADMIN, SECNAVINST, DODI, USC, ...
  number?: string;    // as printed, periods intact: "1050.3J"
  year?: string;      // MARADMIN only
  edition?: string;   // change package or revision suffix
}

export interface NLDPReference {
  text: string;
  order?: number;
  /** 1.1 - null when the text could not be parsed. Never guess. */
  cited?: NLDPCitedIssuance | null;
  parsed?: boolean;
}

export interface NLDPEnclosure {
  text: string;
  order?: number;
}

export interface NLDPVia {
  text: string;
  order?: number;
}

export interface NLDPCopyTo {
  text: string;
  order?: number;
}

/** 1.1 - the signed artifact, which is what makes verification possible. */
export interface NLDPSignedArtifact {
  filename: string;
  format: 'pdf' | 'docx';
  sha256: string;
  byteLength: number;
  hashedAt: string;
}

/** 1.1 - the release block: present only on a Release export. */
export interface NLDPRelease {
  released: true;
  releasedAt: string;
  releasedBy: string;          // role or billet, NOT a personal name
  lifecycle: Extract<NLDPLifecycle, 'signed' | 'promulgated'>;
  signedArtifact: NLDPSignedArtifact;
  affirmation: string;         // the exact text the human accepted
  affirmationVersion: string;  // so a changed wording is detectable
}

export interface NLDPData {
  formData: NLDPFormData;
  paragraphs: NLDPParagraph[];
  references: NLDPReference[];
  enclosures: NLDPEnclosure[];
  vias: NLDPVia[];
  copyTos: NLDPCopyTo[];
  /** 1.1 - contacts carried explicitly so the receiver can mask them.
   *  The naval-letter authoring model holds no POC data today, so this
   *  stays empty; the field exists to honor the ingest contract. */
  pocs?: Array<{ role?: string; name?: string; phone?: string;
                 email?: string; isContact: true }>;
  /** Additional metadata about the directive */
  directiveMetadata?: {
    estimatedPageCount?: number;
    lastModified?: string;
    status?: NLDPLifecycle;
  };
}

export interface NLDPFile {
  /** File format identifier */
  format: 'NLDP';
  /** Format version */
  version: '1.0' | '1.1';
  /** Package metadata */
  metadata: NLDPMetadata;
  /** Data integrity verification */
  integrity: NLDPDataIntegrity;
  /** The actual directive data */
  data: NLDPData;
  /** 1.1 - absent on a working export. Ingest requires it. */
  release?: NLDPRelease;
}

// Export configuration interface
export interface NLDPExportConfig {
  /** Include personal information in export */
  includePersonalInfo?: boolean;
  /** Author information */
  author?: {
    name?: string;
    unit?: string;
    email?: string;
  };
  /** Package information */
  package?: {
    title?: string;
    description?: string;
    tags?: string[];
  };
  /** Lifecycle stamped into directiveMetadata.status. Defaults to 'draft'. */
  status?: NLDPLifecycle;
  /** Stamped into directiveMetadata.lastModified when provided. Left
   *  absent otherwise so re-export stays deterministic (round-trip). */
  lastModified?: string;
}

// Import result interface
export interface NLDPImportResult {
  success: boolean;
  data?: NLDPData;
  error?: string;
  warnings?: string[];
  metadata?: NLDPMetadata;
  /** 1.1 - release block, when the imported file carries one. */
  release?: NLDPRelease;
}

// Validation interfaces
export interface NLDPValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

// Constants
export const NLDP_CONSTANTS = {
  FORMAT_NAME: 'NLDP',
  CURRENT_VERSION: '1.1',
  FILE_EXTENSION: '.nldp',
  MIME_TYPE: 'application/json',
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  SUPPORTED_VERSIONS: ['1.0', '1.1'],
  CREATOR_APP: 'Marine Corps Directives Formatter'
} as const;
