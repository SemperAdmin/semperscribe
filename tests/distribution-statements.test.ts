/**
 * P3.6 — distribution statements and placement (MCO 5215.1K encl (1),
 * "Letterhead Stationery" section, statements block at pages 1-8/1-9;
 * audit lines 138, 149, 172).
 *
 * VERBATIM GUARD: the expected strings below were transcribed from
 * MCO 5215.1K W/ ADMIN CH-2 (10 May 2007), fetched 2026-06-10 from
 * https://www.mcieast.marines.mil/Portals/33/MCO%205215_1K%20W%20ADMIN%20CH-2_1.pdf
 * (PDF text layer, line-wrap whitespace normalized to single spaces).
 * Any edit to DISTRIBUTION_STATEMENTS must re-verify against the
 * source, not against this test.
 */
import { describe, it, expect, vi } from 'vitest';
import JSZip from 'jszip';

vi.mock('@/lib/pdf-fonts', () => import('./golden/pdf-fonts-mock'));

import { DISTRIBUTION_STATEMENTS } from '@/lib/constants';
import { resolveDistributionStatement } from '@/lib/naval-format-utils';
import { generateDocxBlob } from '@/lib/docx-generator';
import { generateBasePDFBlob } from '@/lib/pdf-generator';
import { extractPdfTextLayout } from './golden/helpers';
import { FIXTURE_FORM_DATA } from './golden/fixture';

const SOURCE_VERBATIM: Record<string, string> = {
  A: 'DISTRIBUTION STATEMENT A: Approved for public release; distribution is unlimited.',
  B: 'DISTRIBUTION STATEMENT B: Distribution authorized to U.S. Government agencies only; (fill in reason) (date of determination). Other requests for this document will be referred to (insert originating command).',
  C: 'DISTRIBUTION STATEMENT C: Distribution authorized to U.S. Government agencies and their contractors; (fill in reason) (date of determination). Other requests for this document will be referred to (insert originating command).',
  D: 'DISTRIBUTION STATEMENT D: Distribution authorized to DOD and DOD contractors only; (fill in reason) (date of determination). Other U.S. requests shall be referred to (insert originating command).',
  E: 'DISTRIBUTION STATEMENT E: Distribution authorized to DOD components only; (fill in reason) (date of determination). Other requests must be referred to (insert originating command).',
  F: 'DISTRIBUTION STATEMENT F: Further dissemination only as directed by (insert originating command) (date of determination) or higher DOD authority.',
  X: 'DISTRIBUTION STATEMENT X: Distribution authorized to U.S. Government agencies and private individuals or enterprises eligible to obtain export-controlled technical data in accordance with OPNAVINST 5510.161; (date of determination). Other requests shall be referred to (originating command).',
};

describe('DISTRIBUTION_STATEMENTS verbatim (MCO 5215.1K encl (1))', () => {
  it.each(Object.keys(SOURCE_VERBATIM))('statement %s matches the source character for character', (code) => {
    expect(DISTRIBUTION_STATEMENTS[code as keyof typeof DISTRIBUTION_STATEMENTS].text)
      .toBe(SOURCE_VERBATIM[code]);
  });

  it('covers exactly A-F and X, nothing else', () => {
    expect(Object.keys(DISTRIBUTION_STATEMENTS).sort())
      .toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'X']);
  });

  it('resolver fills reason, date, and command', () => {
    const text = resolveDistributionStatement({
      documentType: 'mco',
      distribution: {
        statementCode: 'B',
        statementReason: 'administrative/operational use',
        statementDate: '2026-02-10',
        statementAuthority: 'CMC (ARDB)',
      },
    } as never);
    expect(text).toContain('administrative/operational use');
    expect(text).toContain('Feb 2026');
    expect(text).toContain('CMC (ARDB)');
    expect(text).not.toContain('(fill in reason)');
  });
});

const BODY = [
  { id: 1, level: 1, content: 'Situation. Body paragraph one.', title: '' },
] as never[];

function mcoForm() {
  return {
    ...FIXTURE_FORM_DATA,
    documentType: 'mco',
    ssic: '5215.1K',
    orderPrefix: 'MCO',
    date: '10 Feb 26',
    sig: 'I. M. MARINE',
    distribution: { type: 'pcn', pcn: '10208490000', statementCode: 'A' },
  } as never;
}

describe('placement (audit lines 138, 149, 172)', () => {
  it('DOCX statement rides a bottom-margin-anchored frame, not the body flow', async () => {
    const blob = await generateDocxBlob(mcoForm(), [], [], [], [], BODY, []);
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const xml = await zip.file('word/document.xml')!.async('string');
    const paras = xml.match(/<w:p\b.*?<\/w:p>/gs) ?? [];
    const stmt = paras.find((p) => p.includes('DISTRIBUTION STATEMENT A'));
    expect(stmt, 'statement paragraph').toBeDefined();
    expect(stmt!.includes('<w:framePr'), 'framePr present').toBe(true);
    expect(stmt!.includes('w:yAlign="bottom"'), 'anchored bottom').toBe(true);
    // DISTRIBUTION line: caps, one blank after the signature.
    const texts = paras.map((p) => (p.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) ?? [])
      .map((t) => t.replace(/<[^>]+>/g, '')).join(''));
    const sigIdx = texts.findIndex((t) => t === 'I. M. MARINE');
    const distIdx = texts.findIndex((t) => t.startsWith('DISTRIBUTION: '));
    expect(distIdx, 'DISTRIBUTION line').toBeGreaterThan(sigIdx);
    expect(texts[distIdx]).toContain('PCN 10208490000');
  });

  it('PDF statement sits at the bottom of page 1 only', async () => {
    const blob = await generateBasePDFBlob(mcoForm(), [], [], [], [], BODY, []);
    const layout = await extractPdfTextLayout(blob);
    const hits = layout.filter((i) => i.text.includes('DISTRIBUTION STATEMENT A'));
    expect(hits.length).toBeGreaterThan(0);
    for (const h of hits) {
      expect(h.page, 'page 1 only').toBe(1);
      expect(h.y, 'bottom of the page').toBeLessThan(72);
    }
  });
});
