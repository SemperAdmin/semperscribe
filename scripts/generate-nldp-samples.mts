/**
 * Regenerates the committed NLDP sample files through the real export
 * module, so their integrity hashes are genuine and their shape always
 * matches src/lib/nldp-format.ts (the specification):
 *
 *   - sample-directive.nldp            working export, no release block
 *   - examples/sample-directive.release.nldp
 *                                      Release export with a FAKE but
 *                                      well-formed signed-artifact hash
 *
 * Run from the repository root:
 *   npx vite-node --config vitest.config.ts scripts/generate-nldp-samples.mts
 */

import { readFileSync, writeFileSync } from 'fs';
import { createNLDPFile } from '../src/lib/nldp-utils';
import type { NLDPRelease } from '../src/lib/nldp-format';
import { RELEASE_AFFIRMATION, RELEASE_AFFIRMATION_VERSION } from '../src/lib/release';

/** Fixed timestamp so a committed sample does not churn on every regen. */
const SAMPLE_CREATED_AT = '2026-08-08T12:00:00.000Z';

const existing = JSON.parse(readFileSync('sample-directive.nldp', 'utf8'));
const d = existing.data;
const texts = (arr: Array<{ text: string }>) => arr.map(x => x.text);

// --- working export -------------------------------------------------
const working = await createNLDPFile(
  d.formData,
  texts(d.vias),
  texts(d.references),
  texts(d.enclosures),
  texts(d.copyTos),
  d.paragraphs.map((p: any) => ({
    id: p.id, level: p.level, content: p.content,
    isMandatory: p.isMandatory, title: p.title,
  })),
  { package: existing.metadata.package }
);
working.metadata.createdAt = SAMPLE_CREATED_AT;
writeFileSync('sample-directive.nldp', JSON.stringify(working, null, 2) + '\n');
console.log('wrote sample-directive.nldp', working.version, working.integrity);

// --- Release export -------------------------------------------------
// The artifact hash is fake (no signed PDF exists for sample data) but
// well-formed: 64 lowercase hex characters, as a real SHA-256 prints.
const fakeArtifactSha256 = 'deadbeef'.repeat(8);
const release: NLDPRelease = {
  released: true,
  releasedAt: SAMPLE_CREATED_AT,
  releasedBy: 'Adjutant, Training Demo Command (sample data)',
  lifecycle: 'promulgated',
  signedArtifact: {
    filename: 'sample-directive-signed.pdf',
    format: 'pdf',
    sha256: fakeArtifactSha256,
    byteLength: 123456,
    hashedAt: SAMPLE_CREATED_AT,
  },
  affirmation: RELEASE_AFFIRMATION,
  affirmationVersion: RELEASE_AFFIRMATION_VERSION,
};
const released = await createNLDPFile(
  d.formData,
  texts(d.vias),
  texts(d.references),
  texts(d.enclosures),
  texts(d.copyTos),
  d.paragraphs.map((p: any) => ({
    id: p.id, level: p.level, content: p.content,
    isMandatory: p.isMandatory, title: p.title,
  })),
  { package: existing.metadata.package, status: 'promulgated' },
  release
);
released.metadata.createdAt = SAMPLE_CREATED_AT;
writeFileSync('examples/sample-directive.release.nldp', JSON.stringify(released, null, 2) + '\n');
console.log('wrote examples/sample-directive.release.nldp', released.integrity);
