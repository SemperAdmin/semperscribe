/**
 * Release gates G1–G7 (docs/POLICY_AS_DATA_HANDOFF.md section 5).
 *
 * Each gate must fail independently and by name, and the all-pass input
 * must produce a release block. The 'final'-fails-G1 case is the
 * regression guard for the draft-leakage defect: 1.0's lifecycle had no
 * signed state, so a never-signed draft could export as active policy.
 */
import { describe, it, expect } from 'vitest';
import {
  RELEASE_AFFIRMATION,
  RELEASE_AFFIRMATION_VERSION,
  buildRelease,
  evaluateReleaseGates,
  type ReleaseGateInput,
} from '@/lib/release';
import type { NLDPSignedArtifact } from '@/lib/nldp-format';

const artifact: NLDPSignedArtifact = {
  filename: 'signed.pdf',
  format: 'pdf',
  sha256: 'ab'.repeat(32),
  byteLength: 1024,
  hashedAt: '2026-08-08T12:00:00.000Z',
};

/** Passes every gate. Tests break exactly one field at a time. */
function passingInput(): ReleaseGateInput {
  return {
    status: 'signed',
    signedArtifact: artifact,
    dateSigned: '2026-08-01',
    sig: 'E. M. SAMPLE',
    paragraphs: [{ designator: '1.' }, { designator: 'a.' }],
    distributionStatementCode: 'A',
    affirmationAccepted: true,
  };
}

const gatesOf = (input: ReleaseGateInput) =>
  evaluateReleaseGates(input).map(f => f.gate);

describe('release gates: each fails independently and by name', () => {
  it('passes with a fully-eligible package', () => {
    expect(evaluateReleaseGates(passingInput())).toEqual([]);
  });

  it('G1 fails for an unset lifecycle', () => {
    expect(gatesOf({ ...passingInput(), status: undefined })).toEqual(['G1']);
  });

  it('G1 fails for "final" — drafting complete is NOT signed (draft-leakage regression guard)', () => {
    const failures = evaluateReleaseGates({ ...passingInput(), status: 'final' });
    expect(failures.map(f => f.gate)).toEqual(['G1']);
    expect(failures[0].reason).toContain('G1');
    expect(failures[0].reason).toContain('final');
  });

  it('G1 fails for draft, review, and cancelled too', () => {
    for (const status of ['draft', 'review', 'cancelled'] as const) {
      expect(gatesOf({ ...passingInput(), status })).toEqual(['G1']);
    }
  });

  it('G2 fails without a hashed signed artifact', () => {
    expect(gatesOf({ ...passingInput(), signedArtifact: null })).toEqual(['G2']);
  });

  it('G3 fails without a signature date', () => {
    expect(gatesOf({ ...passingInput(), dateSigned: undefined })).toEqual(['G3']);
  });

  it('G3 fails for a future signature date', () => {
    const future = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
    expect(gatesOf({ ...passingInput(), dateSigned: future })).toEqual(['G3']);
  });

  it('G3 fails for an unreadable date', () => {
    expect(gatesOf({ ...passingInput(), dateSigned: 'not-a-date' })).toEqual(['G3']);
  });

  it('G4 fails without a signature block', () => {
    expect(gatesOf({ ...passingInput(), sig: undefined })).toEqual(['G4']);
    expect(gatesOf({ ...passingInput(), sig: '   ' })).toEqual(['G4']);
  });

  it('G5 fails for an empty paragraph tree', () => {
    expect(gatesOf({ ...passingInput(), paragraphs: [] })).toEqual(['G5']);
  });

  it('G5 fails when any paragraph lacks a designator', () => {
    expect(
      gatesOf({ ...passingInput(), paragraphs: [{ designator: '1.' }, { designator: undefined }] })
    ).toEqual(['G5']);
  });

  it('G6 fails without a distribution statement code', () => {
    expect(gatesOf({ ...passingInput(), distributionStatementCode: undefined })).toEqual(['G6']);
  });

  it('G7 fails while the affirmation is unaccepted', () => {
    expect(gatesOf({ ...passingInput(), affirmationAccepted: false })).toEqual(['G7']);
  });

  it('lists EVERY failure at once, not just the first', () => {
    const gates = gatesOf({
      status: 'final',
      signedArtifact: null,
      dateSigned: undefined,
      sig: undefined,
      paragraphs: [],
      distributionStatementCode: undefined,
      affirmationAccepted: false,
    });
    expect(gates).toEqual(['G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7']);
  });
});

describe('buildRelease', () => {
  it('produces a complete release block when all gates pass', () => {
    const release = buildRelease(passingInput(), '  Adjutant, 1st Marine Division  ');
    expect(release).toEqual({
      released: true,
      releasedAt: expect.any(String),
      releasedBy: 'Adjutant, 1st Marine Division',
      lifecycle: 'signed',
      signedArtifact: artifact,
      affirmation: RELEASE_AFFIRMATION,
      affirmationVersion: RELEASE_AFFIRMATION_VERSION,
    });
  });

  it('refuses when a gate fails', () => {
    expect(() => buildRelease({ ...passingInput(), status: 'final' }, 'Adjutant'))
      .toThrow(/G1/);
  });

  it('refuses without a releasing role or billet', () => {
    expect(() => buildRelease(passingInput(), '   ')).toThrow(/releasedBy/);
  });
});
