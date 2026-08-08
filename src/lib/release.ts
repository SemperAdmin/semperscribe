/**
 * Release step for NLDP packages (docs/POLICY_AS_DATA_HANDOFF.md
 * section 5).
 *
 * Release is the human act SemperScribe CAN perform: the drafter or
 * signing authority affirms "this package corresponds to the document
 * that was signed", evidenced by the signed artifact's hash. It is NOT
 * verification — confirming the encoding against the issuing
 * authority's copy happens on the policy-as-data side, and no UI for
 * it belongs here.
 *
 * The release block is not tamper-proof: anyone can hand-edit JSON.
 * That is an accepted proof-of-concept shortcut. The real control is
 * on the receiving side, where a human verifies against the
 * authoritative source and the artifact hash is checked independently.
 *
 * No egress: hashing is crypto.subtle in the browser. The signed file
 * is read, hashed, and discarded — never embedded, never uploaded.
 */

import type {
  NLDPLifecycle,
  NLDPParagraph,
  NLDPRelease,
  NLDPSignedArtifact,
} from './nldp-format';

/**
 * The exact text the human accepts. Shown in full, recorded verbatim in
 * the package. Any wording change MUST bump RELEASE_AFFIRMATION_VERSION
 * so the receiving side can detect which text was accepted.
 */
export const RELEASE_AFFIRMATION =
  'I confirm this package corresponds to the document that was signed and ' +
  'promulgated, that the attached file is that signed document, and that the text ' +
  'in this package matches it. I understand this package may be ingested into a ' +
  'policy corpus and rendered as policy after independent verification.';

export const RELEASE_AFFIRMATION_VERSION = '1';

/** Lifecycles eligible for release. Everything else fails G1. */
export const RELEASABLE_LIFECYCLES: ReadonlyArray<NLDPLifecycle> = [
  'signed',
  'promulgated',
];

export type ReleaseGateId = 'G1' | 'G2' | 'G3' | 'G4' | 'G5' | 'G6' | 'G7';

export interface ReleaseGateFailure {
  gate: ReleaseGateId;
  reason: string;
}

/** Everything the gate evaluates. Collected by the Release dialog. */
export interface ReleaseGateInput {
  /** Lifecycle the user asserts for the document (becomes
   *  directiveMetadata.status on the Release export). */
  status: NLDPLifecycle | undefined;
  /** Hash of the signed file, or null when none has been supplied. */
  signedArtifact: NLDPSignedArtifact | null;
  /** formData.date_signed */
  dateSigned: string | undefined;
  /** formData.sig */
  sig: string | undefined;
  /** Paragraphs as they will be exported, designators populated. */
  paragraphs: Array<Pick<NLDPParagraph, 'designator'>>;
  /** formData.distributionStatement?.code */
  distributionStatementCode: string | undefined;
  /** The affirmation checkbox state. */
  affirmationAccepted: boolean;
}

/**
 * Evaluates every gate and returns ALL failures, each naming its gate,
 * so the dialog can list every problem at once rather than the first.
 * An empty array means the package may be released.
 */
export function evaluateReleaseGates(input: ReleaseGateInput): ReleaseGateFailure[] {
  const failures: ReleaseGateFailure[] = [];

  if (!input.status || !RELEASABLE_LIFECYCLES.includes(input.status)) {
    failures.push({
      gate: 'G1',
      reason: `G1: lifecycle must be "signed" or "promulgated" (currently "${input.status ?? 'unset'}"). "final" means drafting is complete, not that the document was signed.`,
    });
  }

  if (!input.signedArtifact) {
    failures.push({
      gate: 'G2',
      reason: 'G2: supply the signed PDF or DOCX so its SHA-256 can be computed in this browser.',
    });
  }

  if (!input.dateSigned) {
    failures.push({
      gate: 'G3',
      reason: 'G3: the document carries no signature date (date_signed).',
    });
  } else {
    const signed = new Date(input.dateSigned);
    if (Number.isNaN(signed.getTime())) {
      failures.push({
        gate: 'G3',
        reason: `G3: the signature date "${input.dateSigned}" is not a readable date.`,
      });
    } else if (signed.getTime() > Date.now()) {
      failures.push({
        gate: 'G3',
        reason: 'G3: the signature date is in the future. A document cannot be released before it is signed.',
      });
    }
  }

  if (!input.sig || !input.sig.trim()) {
    failures.push({
      gate: 'G4',
      reason: 'G4: the document carries no signature block (sig).',
    });
  }

  if (input.paragraphs.length === 0) {
    failures.push({
      gate: 'G5',
      reason: 'G5: the paragraph tree is empty.',
    });
  } else if (input.paragraphs.some(p => !p.designator)) {
    failures.push({
      gate: 'G5',
      reason: 'G5: not every paragraph carries a designator.',
    });
  }

  if (!input.distributionStatementCode) {
    failures.push({
      gate: 'G6',
      reason: 'G6: no distribution statement code is present. The receiving side cannot decide release authority without one.',
    });
  }

  if (!input.affirmationAccepted) {
    failures.push({
      gate: 'G7',
      reason: 'G7: the release affirmation has not been accepted.',
    });
  }

  return failures;
}

/** Maps a chosen signed-artifact file to its NLDP format tag. */
function artifactFormat(filename: string): 'pdf' | 'docx' | null {
  if (/\.pdf$/i.test(filename)) return 'pdf';
  if (/\.docx$/i.test(filename)) return 'docx';
  return null;
}

/**
 * Reads and hashes the signed file in-browser. The bytes are used for
 * the digest and then discarded — the hash is the evidence and the
 * file remains the user's.
 */
export async function hashSignedArtifact(file: File): Promise<NLDPSignedArtifact> {
  const format = artifactFormat(file.name);
  if (!format) {
    throw new Error('The signed artifact must be a .pdf or .docx file.');
  }
  // Copy into a local-realm view before digesting: jsdom's
  // File.arrayBuffer() returns a buffer from another JS realm, and
  // Node 20's WebCrypto rejects cross-realm buffers (browsers and
  // Node 22 accept them).
  const bytes = new Uint8Array(await file.arrayBuffer()).slice();
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const sha256 = Array.from(new Uint8Array(digest))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  return {
    filename: file.name,
    format,
    sha256,
    byteLength: bytes.byteLength,
    hashedAt: new Date().toISOString(),
  };
}

/**
 * Builds the release block after the gates have passed. Callers must
 * run evaluateReleaseGates first; this throws rather than emit a
 * half-attested block.
 */
export function buildRelease(
  input: ReleaseGateInput,
  releasedBy: string
): NLDPRelease {
  const failures = evaluateReleaseGates(input);
  if (failures.length > 0) {
    throw new Error(`Release refused: ${failures.map(f => f.reason).join(' ')}`);
  }
  const billet = releasedBy.trim();
  if (!billet) {
    throw new Error('Release refused: releasedBy (role or billet) is required.');
  }
  return {
    released: true,
    releasedAt: new Date().toISOString(),
    releasedBy: billet,
    lifecycle: input.status as NLDPRelease['lifecycle'],
    signedArtifact: input.signedArtifact as NLDPSignedArtifact,
    affirmation: RELEASE_AFFIRMATION,
    affirmationVersion: RELEASE_AFFIRMATION_VERSION,
  };
}
