/**
 * Regenerates the committed NLDP sample files through the real export
 * module, so their integrity hashes are genuine and their shape always
 * matches src/lib/nldp-format.ts (the specification):
 *
 *   - sample-directive.nldp            working export
 *
 * Run from the repository root:
 *   npx vite-node --config vitest.config.ts scripts/generate-nldp-samples.mts
 */

import { readFileSync, writeFileSync } from 'fs';
import { createNLDPFile } from '../src/lib/nldp-utils';

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
