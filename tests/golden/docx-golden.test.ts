/**
 * PHASE 0 PARITY HARNESS — DOCX golden file.
 *
 * Snapshots word/document.xml for the frozen fixture letter.
 * Purpose: any change to DOCX geometry (tab stops, indents, spacing,
 * margins, signature offsets) produces a reviewable line diff that must
 * be justified with a policy citation before the snapshot is updated.
 *
 * Baseline: commit 82a6c52. A failing test here means generator output
 * changed — that is the test doing its job.
 */
import { describe, it, expect } from 'vitest';
import { generateDocxBlob } from '@/lib/docx-generator';
import { docxToDocumentXml } from './helpers';
import {
  FIXTURE_FORM_DATA,
  FIXTURE_PARAGRAPHS,
  FIXTURE_VIAS,
  FIXTURE_REFERENCES,
  FIXTURE_ENCLOSURES,
  FIXTURE_COPY_TOS,
} from './fixture';

describe('DOCX golden file (basic naval letter fixture)', () => {
  it('word/document.xml matches the committed golden file', async () => {
    const blob = await generateDocxBlob(
      FIXTURE_FORM_DATA,
      FIXTURE_VIAS,
      FIXTURE_REFERENCES,
      FIXTURE_ENCLOSURES,
      FIXTURE_COPY_TOS,
      FIXTURE_PARAGRAPHS,
      [],
    );
    const xml = await docxToDocumentXml(blob);
    await expect(xml).toMatchFileSnapshot('__snapshots__/basic-letter.document.xml');
  });

  it('generation is deterministic (two runs, identical document.xml)', async () => {
    const args = [
      FIXTURE_FORM_DATA,
      FIXTURE_VIAS,
      FIXTURE_REFERENCES,
      FIXTURE_ENCLOSURES,
      FIXTURE_COPY_TOS,
      FIXTURE_PARAGRAPHS,
      [],
    ] satisfies Parameters<typeof generateDocxBlob>;
    const a = await docxToDocumentXml(await generateDocxBlob(...args));
    const b = await docxToDocumentXml(await generateDocxBlob(...args));
    expect(a).toBe(b);
  });
});
