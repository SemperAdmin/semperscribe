/**
 * PHASE 0 PARITY HARNESS — PDF golden file.
 *
 * Snapshots the positioned text layout (page, x, y, text) of the PDF
 * pipeline for the frozen fixture letter. Any change to PDF geometry
 * produces a reviewable diff keyed to point coordinates.
 *
 * Baseline: commit 82a6c52.
 */
import { describe, it, expect } from 'vitest';

import { generateBasePDFBlob } from '@/lib/pdf-generator';
import { extractPdfTextLayout, layoutToSnapshotText } from './helpers';
import {
  FIXTURE_FORM_DATA,
  FIXTURE_PARAGRAPHS,
  FIXTURE_VIAS,
  FIXTURE_REFERENCES,
  FIXTURE_ENCLOSURES,
  FIXTURE_COPY_TOS,
} from './fixture';

describe('PDF golden file (basic naval letter fixture)', () => {
  it('positioned text layout matches the committed golden file', async () => {
    const blob = await generateBasePDFBlob(
      FIXTURE_FORM_DATA,
      FIXTURE_VIAS,
      FIXTURE_REFERENCES,
      FIXTURE_ENCLOSURES,
      FIXTURE_COPY_TOS,
      FIXTURE_PARAGRAPHS,
      [],
    );
    const layout = await extractPdfTextLayout(blob);
    expect(layout.length).toBeGreaterThan(0);
    await expect(layoutToSnapshotText(layout)).toMatchFileSnapshot(
      '__snapshots__/basic-letter.pdf-layout.txt',
    );
  }, 30000);
});
