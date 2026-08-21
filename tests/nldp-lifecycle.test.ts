/**
 * Lifecycle on the working export.
 *
 * The Release step was retired on 2026-08-20 because the signed
 * artifact never reaches the policy-as-data side, which left its hash
 * unverifiable and its gates duplicating ingest validation. The Release
 * dialog was also the app's ONLY route to the 'signed' and
 * 'promulgated' lifecycle values, so removing it without a replacement
 * would have pinned every export to 'draft' and stripped the receiving
 * side of all signature signal. These tests are the regression guard on
 * that replacement.
 */
import { describe, it, expect } from 'vitest';
import { createNLDPFile } from '@/lib/nldp-utils';
import { LIFECYCLE_CHOICES } from '@/components/ExportNLDPDialog';
import type { NLDPLifecycle } from '@/lib/nldp-format';

const FORM = {
  documentType: 'mco',
  ssic: '5215.1',
  subj: 'LIFECYCLE FIXTURE',
  sig: 'F. IXTURE',
  date_signed: '2026-08-01',
};
const PARAGRAPHS = [{ id: 1, level: 1, content: 'Situation.' }];

const build = (config = {}) =>
  createNLDPFile(FORM, [], [], [], [], PARAGRAPHS, config);

const ALL: NLDPLifecycle[] =
  ['draft', 'review', 'final', 'signed', 'promulgated', 'cancelled'];

describe('working-export lifecycle', () => {
  it('defaults to draft when the caller supplies no status', async () => {
    const file = await build();
    expect(file.data.directiveMetadata?.status).toBe('draft');
  });

  it.each(ALL)('stamps directiveMetadata.status for %s', async (status) => {
    const file = await build({ status });
    expect(file.data.directiveMetadata?.status).toBe(status);
  });

  it('reaches signed and promulgated, the states no other path sets', async () => {
    const signed = await build({ status: 'signed' });
    const promulgated = await build({ status: 'promulgated' });
    expect(signed.data.directiveMetadata?.status).toBe('signed');
    expect(promulgated.data.directiveMetadata?.status).toBe('promulgated');
  });

  it('carries no release block: the Release step is retired', async () => {
    const file = await build({ status: 'promulgated' });
    expect(file).not.toHaveProperty('release');
  });

  it('offers every lifecycle value in the export dialog', () => {
    expect(LIFECYCLE_CHOICES.map(c => c.value)).toEqual(ALL);
  });

  it('warns in the dialog that final is not signed', () => {
    const final = LIFECYCLE_CHOICES.find(c => c.value === 'final');
    expect(final?.hint).toMatch(/NOT signed/);
  });
});
