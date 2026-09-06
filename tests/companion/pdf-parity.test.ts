// @vitest-environment node
/**
 * The companion produces the same document as the browser.
 *
 * The golden test in tests/golden/pdf-golden.test.ts snapshots the
 * positioned text layout of the PDF pipeline for the frozen fixture
 * letter. This test takes the same fixture the long way round: it packs
 * it into an NLDP package the way an export does, hands the package to
 * the companion, and compares the positioned text of what comes back
 * against that same committed snapshot.
 *
 * A geometry change reaches both tests at once. A divergence between the
 * two, where the golden test still passes and this one does not, means
 * the companion's path through the pipeline is no longer the app's.
 */
import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { createNLDPFile } from '@/lib/nldp-utils';
import { renderDocument } from '../../companion/handler';
import { extractPdfTextLayout, layoutToSnapshotText } from '../golden/helpers';
import {
  FIXTURE_FORM_DATA,
  FIXTURE_PARAGRAPHS,
  FIXTURE_VIAS,
  FIXTURE_REFERENCES,
  FIXTURE_ENCLOSURES,
  FIXTURE_COPY_TOS,
} from '../golden/fixture';

const SNAPSHOT = path.join(
  process.cwd(),
  'tests',
  'golden',
  '__snapshots__',
  'basic-letter.pdf-layout.txt',
);

describe('companion PDF parity with the golden snapshot', () => {
  it('renders the fixture letter to the committed layout', async () => {
    const pkg = await createNLDPFile(
      FIXTURE_FORM_DATA,
      FIXTURE_VIAS,
      FIXTURE_REFERENCES,
      FIXTURE_ENCLOSURES,
      FIXTURE_COPY_TOS,
      FIXTURE_PARAGRAPHS,
    );
    const result = await renderDocument({ document: pkg, format: 'pdf' });
    const layout = await extractPdfTextLayout(
      new Blob([new Uint8Array(result.bytes)], { type: 'application/pdf' }),
    );
    expect(layout.length).toBeGreaterThan(0);

    const expected = await readFile(SNAPSHOT, 'utf8');
    expect(layoutToSnapshotText(layout).trimEnd()).toBe(expected.trimEnd());
  }, 60000);
});
