/**
 * Policy-as-Data (USLM) canonical export.
 *
 * Converts the SemperScribe authoring model (a FLAT paragraph list plus
 * form metadata) into the policy-as-data canonical record (schema
 * 0.4.0) consumed by the policy-as-data pipeline. Mirrors the structure
 * of the NLDP export path (see lib/nldp-utils.ts + hooks/useNLDP.ts):
 * a pure builder, a Blob serializer, and a filename helper.
 *
 * Level -> depth mapping: SemperScribe paragraphs carry a 1-based
 * `level`; canonical provisions use a 0-based `depth`, so depth =
 * level - 1. The flat list is walked with a stack — a paragraph's
 * parent is the nearest preceding paragraph with a SMALLER level.
 *
 * Numbering: useParagraphs.getUiCitation is the UI ladder and is bound
 * inside a React hook; its label ladder differs from the policy-as-data
 * contract (e.g. UI level 2 -> "a" with no separator). The path/label
 * ladder emitted here is the canonical contract and is authoritative,
 * so it is produced independently below. numberToLetter mirrors the
 * Excel-style helper in useParagraphs.ts.
 */

import { ParagraphData, FormData } from '@/types';

export type PolicyDataDocType = 'MCO' | 'MARADMIN' | 'MCBUL' | 'SECNAV' | 'NAVMC';

export interface PolicyDataProvision {
  path: string;
  label: string;
  number: string;
  depth: number;
  parent: string | null;
  text: string;
  raw_marker: string;
  uslm_identifier: string;
  verification: 'UNVERIFIED';
}

export interface PolicyDataSection {
  anchor: string;
  heading: string | null;
  number: string | null;
  // Flat body text - the concatenated provision text. Required by the
  // 0.4.0 schema and read by the pipeline's USLM exporter and renderer,
  // which expect every section to carry its text alongside provisions.
  text: string;
  uslm_identifier: string;
  verification: 'UNVERIFIED';
  provisions: PolicyDataProvision[];
}

export interface PolicyDataRecord {
  schema_version: '0.4.0';
  id: string;
  doc_type: PolicyDataDocType;
  native_number: string;
  uslm_identifier: string;
  verification: 'UNVERIFIED';
  corrections: unknown[];
  title: string | null;
  subject: string | null;
  status: string;
  dates: {
    signed: string | null;
    effective: string | null;
    cancelled: string | null;
    archived: string | null;
  };
  issuing_authority: string | null;
  relationships: {
    cancels: unknown[];
    cancelled_by: unknown[];
    supersedes: unknown[];
    superseded_by: unknown[];
    references: string[];
    edge_meta: unknown[];
  };
  publication: {
    publishable: boolean;
    reason: string | null;
    distribution_statement: string | null;
    adjudication_ref: string | null;
  };
  provenance: {
    source_path: string;
    source_hash: string;
    source_site: string | null;
    extraction_engine: string;
    extracted_at: string | null;
    cleaned_at: string | null;
    converted_at: string;
  };
  pocs: unknown[];
  sections: PolicyDataSection[];
  conversion_notes: string[];
}

/**
 * Converts a number to Excel-style letters (1=a, 2=b... 26=z, 27=aa).
 * Mirrors numberToLetter() in hooks/useParagraphs.ts.
 */
function numberToLetter(num: number): string {
  let result = '';
  while (num > 0) {
    const remainder = (num - 1) % 26;
    result = String.fromCharCode(97 + remainder) + result;
    num = Math.floor((num - 1) / 26);
  }
  return result;
}

/**
 * Converts a positive integer (1-based) to a lowercase Roman numeral.
 */
function numberToRoman(num: number): string {
  const table: Array<[number, string]> = [
    [1000, 'm'], [900, 'cm'], [500, 'd'], [400, 'cd'],
    [100, 'c'], [90, 'xc'], [50, 'l'], [40, 'xl'],
    [10, 'x'], [9, 'ix'], [5, 'v'], [4, 'iv'], [1, 'i'],
  ];
  let n = num;
  let result = '';
  for (const [value, symbol] of table) {
    while (n >= value) {
      result += symbol;
      n -= value;
    }
  }
  return result;
}

/**
 * Path segment for a provision, by depth and 0-based sibling index.
 * depth 0 -> "p"+(n); 1 -> letter; 2 -> digits; 3 -> letter; 4+ -> roman.
 */
function pathSegment(depth: number, siblingIndex: number): string {
  const n = siblingIndex + 1;
  switch (depth) {
    case 0: return `p${n}`;
    case 1: return numberToLetter(n);
    case 2: return `${n}`;
    case 3: return numberToLetter(n);
    default: return numberToRoman(n);
  }
}

/**
 * Printed label for a provision, by depth and 0-based sibling index.
 * depth 0 -> "N."; 1 -> "a."; 2 -> "(1)"; 3 -> "(a)"; 4+ -> "(i)".
 */
function provisionLabel(depth: number, siblingIndex: number): string {
  const n = siblingIndex + 1;
  switch (depth) {
    case 0: return `${n}.`;
    case 1: return `${numberToLetter(n)}.`;
    case 2: return `(${n})`;
    case 3: return `(${numberToLetter(n)})`;
    default: return `(${numberToRoman(n)})`;
  }
}

interface DocIdentity {
  docType: PolicyDataDocType;
  nativeNumber: string;
  documentRoot: string;
  id: string;
}

/** Maps a SemperScribe documentType to a canonical doc_type. */
function mapDocType(documentType: string | undefined): PolicyDataDocType {
  switch ((documentType || '').toLowerCase()) {
    case 'bulletin':
    case 'mcbul':
      return 'MCBUL';
    case 'secnav-instruction':
    case 'secnav-notice':
    case 'secnav':
      return 'SECNAV';
    case 'maradmin':
      return 'MARADMIN';
    case 'navmc':
    case 'navmc10922':
    case 'aa-form':
      return 'NAVMC';
    case 'mco':
    default:
      return 'MCO';
  }
}

/**
 * Derives the canonical id, native number, and USLM document root from
 * the form data. Roots follow the policy-as-data identifier scheme:
 *   MARADMIN -> /us/dod/don/usmc/maradmin/<year>/<3-digit number>
 *   MCO      -> /us/dod/don/usmc/mco/<native-number lowercased>
 *   MCBUL    -> /us/dod/don/usmc/mcbul/<n>
 *   SECNAV   -> /us/dod/don/secnavinst/<n lowercased>
 */
function deriveDocIdentity(formData: FormData): DocIdentity {
  const docType = mapDocType(formData.documentType);
  // ssic is used as-entered by the app (e.g. "5215.1K"); older
  // packages carry the number under ssic_code instead.
  const ssic = String(formData.ssic ?? formData.ssic_code ?? '').trim();

  if (docType === 'MARADMIN') {
    // Number may arrive pre-split (year + number) or as printed
    // (e.g. "026/26"). Fall back to whatever number field exists.
    const rawNum = String(
      formData.maradminNumber ?? formData.number ?? ssic ?? ''
    ).trim();
    let year = String(formData.maradminYear ?? formData.year ?? '').trim();
    let seq = rawNum;
    // Accept "NNN/YY" printed form.
    const printed = rawNum.match(/^(\d{1,4})\s*\/\s*(\d{2,4})$/);
    if (printed) {
      seq = printed[1];
      if (!year) year = printed[2];
    }
    if (year.length === 2) year = `20${year}`;
    const paddedSeq = seq.replace(/\D/g, '').padStart(3, '0') || '000';
    const fullYear = year || 'UNKNOWN';
    const nativeNumber = `MARADMIN ${seq || paddedSeq}/${(year || '').slice(-2)}`.trim();
    const documentRoot = `/us/dod/don/usmc/maradmin/${fullYear}/${paddedSeq}`;
    return {
      docType,
      nativeNumber,
      documentRoot,
      id: `MARADMIN-${fullYear}-${paddedSeq}`,
    };
  }

  if (docType === 'MCBUL') {
    const num = ssic || 'UNKNOWN';
    return {
      docType,
      nativeNumber: `MCBul ${num}`,
      documentRoot: `/us/dod/don/usmc/mcbul/${num}`,
      id: `MCBUL-${num}`,
    };
  }

  if (docType === 'SECNAV') {
    const num = ssic || 'UNKNOWN';
    return {
      docType,
      nativeNumber: `SECNAVINST ${num}`,
      documentRoot: `/us/dod/don/secnavinst/${num.toLowerCase()}`,
      id: `SECNAV-${num}`,
    };
  }

  if (docType === 'NAVMC') {
    const num = ssic || 'UNKNOWN';
    return {
      docType,
      nativeNumber: `NAVMC ${num}`,
      documentRoot: `/us/dod/don/usmc/navmc/${num.toLowerCase()}`,
      id: `NAVMC-${num}`,
    };
  }

  // MCO (default)
  const prefix = String(formData.orderPrefix ?? 'MCO').trim() || 'MCO';
  const num = ssic || 'UNKNOWN';
  return {
    docType,
    nativeNumber: `${prefix} ${num}`,
    documentRoot: `/us/dod/don/usmc/mco/${num.toLowerCase()}`,
    id: `MCO-${num}`,
  };
}

/**
 * Walks the flat paragraph list into canonical provisions. Maintains a
 * stack of ancestors; a paragraph's parent is the nearest preceding
 * paragraph with a smaller level. Sibling index is counted per
 * (parent path, level).
 */
function buildProvisions(
  paragraphs: ParagraphData[],
  documentRoot: string
): PolicyDataProvision[] {
  interface Frame {
    level: number;
    path: string;
    number: string;
  }

  const provisions: PolicyDataProvision[] = [];
  const stack: Frame[] = [];
  const counters = new Map<string, number>();

  for (const para of paragraphs) {
    const level = para.level;
    const depth = level - 1;

    // Pop ancestors that are not strictly above this paragraph.
    while (stack.length > 0 && stack[stack.length - 1].level >= level) {
      stack.pop();
    }
    const parent = stack.length > 0 ? stack[stack.length - 1] : null;
    const parentPath = parent ? parent.path : '';

    const counterKey = `${parentPath}|${level}`;
    const siblingIndex = counters.get(counterKey) ?? 0;
    counters.set(counterKey, siblingIndex + 1);

    const segment = pathSegment(depth, siblingIndex);
    const label = provisionLabel(depth, siblingIndex);
    const path = parent ? `${parent.path}/${segment}` : segment;
    const number = parent ? `${parent.number}${label}` : label;

    provisions.push({
      path,
      label,
      number,
      depth,
      parent: parent ? parent.path : null,
      text: para.content ?? '',
      raw_marker: label,
      uslm_identifier: `${documentRoot}/${path}`,
      verification: 'UNVERIFIED',
    });

    stack.push({ level, path, number });
  }

  return provisions;
}

/**
 * Builds a policy-as-data canonical record (schema 0.4.0) from the
 * current SemperScribe document.
 */
export function createPolicyDataRecord(
  formData: FormData,
  paragraphs: ParagraphData[],
  references: string[] = [],
  // enclosures are part of the authoring model but are not represented
  // in the 0.4.0 canonical schema; accepted for signature parity with
  // the NLDP export and reserved for future use.
  enclosures: string[] = []
): PolicyDataRecord {
  void enclosures;

  const identity = deriveDocIdentity(formData);
  const provisions = buildProvisions(paragraphs, identity.documentRoot);

  const distCode = formData.distributionStatement?.code;
  const distributionStatement = distCode
    ? `DISTRIBUTION STATEMENT ${distCode}`
    : null;

  const title = formData.subj || formData.title || null;

  return {
    schema_version: '0.4.0',
    id: identity.id,
    doc_type: identity.docType,
    native_number: identity.nativeNumber,
    uslm_identifier: identity.documentRoot,
    verification: 'UNVERIFIED',
    corrections: [],
    title,
    subject: formData.subj || null,
    status: 'active',
    dates: {
      signed: formData.date_signed || null,
      effective: null,
      cancelled: null,
      archived: null,
    },
    issuing_authority: formData.from || null,
    relationships: {
      cancels: [],
      cancelled_by: [],
      supersedes: [],
      superseded_by: [],
      references: [...references],
      edge_meta: [],
    },
    publication: {
      publishable: true,
      reason: null,
      distribution_statement: distributionStatement,
      adjudication_ref: null,
    },
    provenance: {
      source_path: 'SemperScribe authoring',
      source_hash: 'AUTHORED',
      source_site: null,
      extraction_engine: 'SemperScribe',
      extracted_at: null,
      cleaned_at: null,
      converted_at: new Date().toISOString(),
    },
    pocs: [],
    sections: [
      {
        anchor: 'body',
        heading: null,
        number: null,
        // Reassemble body text as label + text per provision, in order,
        // so a section carries its text as the schema and exporter require.
        text: provisions
          .map((p) => `${p.label} ${p.text}`.trim())
          .join('\n'),
        uslm_identifier: `${identity.documentRoot}/body`,
        verification: 'UNVERIFIED',
        provisions,
      },
    ],
    conversion_notes: [
      'Authored in SemperScribe; provisions UNVERIFIED until confirmed.',
    ],
  };
}

/**
 * Serializes a canonical record to a downloadable JSON Blob.
 */
export function createPolicyDataBlob(record: PolicyDataRecord): Blob {
  const jsonString = JSON.stringify(record, null, 2);
  return new Blob([jsonString], { type: 'application/json' });
}

/**
 * Generates a filename for a policy-as-data export: "<id>.policy.json".
 */
export function generatePolicyDataFilename(record: PolicyDataRecord): string {
  return `${record.id}.policy.json`;
}
