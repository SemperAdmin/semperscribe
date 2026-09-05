// @vitest-environment node
/**
 * E.1 - the same-page endorsement (SECNAV M-5216.5 9-1, 9-2.1.a,
 * 9-2.1.b, 9-2.2 and Figure 9-1).
 *
 * The fit decision IS the feature, so it is measured here against real
 * rendered geometry rather than asserted from constants: render the
 * golden fixture letter, render an endorsement block, compose, and read
 * the positions back out of the composed PDF.
 */
import { describe, it, expect, beforeAll } from 'vitest';

import { registerNodeAssets } from './node-assets';
import { generateBasePDFBlob } from '@/lib/pdf-generator';
import { generateDocxBlob } from '@/lib/docx-generator';
import { extractPdfTextLayout } from './golden/helpers';
import { LINE_HEIGHT_12PT } from '@/lib/pdf-settings';
import {
  composeSamePage,
  measureBlockExtent,
  measureLastContent,
  endorsementLineText,
  omitsIdentification,
  isSamePageEndorsement,
  SAME_PAGE_GAP_LINES,
  CONTENT_FLOOR,
} from '@/lib/same-page-endorsement';
import type { FormData, ParagraphData } from '@/types';
import {
  FIXTURE_FORM_DATA,
  FIXTURE_PARAGRAPHS,
  FIXTURE_VIAS,
  FIXTURE_REFERENCES,
  FIXTURE_ENCLOSURES,
  FIXTURE_COPY_TOS,
} from './golden/fixture';

const GAP = SAME_PAGE_GAP_LINES * LINE_HEIGHT_12PT;

/**
 * The node environment, not jsdom. Two reasons. It is the environment
 * the headless companion runs the same code in, so a browser-only
 * dependency creeping into the composer fails here. And @react-pdf
 * 4.9.0 does not render under jsdom in this repo at all: it resolves
 * pdfkit's node build while taking its own browser branch, which
 * corrupts every deflate stream it writes and leaves the seal image
 * unreadable. That breakage arrived with the dependency bump on main
 * and is not E.1's to carry.
 */
beforeAll(() => {
  registerNodeAssets();
});

/**
 * The basic letter being endorsed. The golden fixture's own body runs
 * eight paragraph levels and ends 146 pt from the foot of the page,
 * which leaves 74 pt of usable space, and the shortest possible
 * endorsement block measures 207 pt. So a fixture letter with the full
 * body is the case 9-1 sends to a new page, and a fixture letter with
 * a short body is the case it keeps on the signature page. Both are
 * built here from the same frozen fixture.
 */
async function hostBytes(paragraphs: ParagraphData[] = SHORT_HOST_BODY): Promise<Uint8Array> {
  const blob = await generateBasePDFBlob(
    FIXTURE_FORM_DATA, FIXTURE_VIAS, FIXTURE_REFERENCES,
    FIXTURE_ENCLOSURES, FIXTURE_COPY_TOS, paragraphs, [],
  );
  return new Uint8Array(await blob.arrayBuffer());
}

const SHORT_HOST_BODY: ParagraphData[] = [
  { id: 1, level: 1, content: 'Request approval of the action described below.', isMandatory: true },
  { id: 2, level: 1, content: 'The point of contact is the unit adjutant.' },
];

/** One paragraph shorter again, for the block that keeps its identification. */
const SHORTER_HOST_BODY: ParagraphData[] = [SHORT_HOST_BODY[0]];

function endorsement(overrides: Partial<FormData> = {}): FormData {
  return {
    ...FIXTURE_FORM_DATA,
    documentType: 'endorsement',
    endorsementPlacement: 'same-page',
    // E.4: the block for composition. Rendered without this flag a
    // same-page endorsement is a page of its own with the letterhead.
    samePageRenderAsBlock: true,
    endorsementLevel: 'FIRST',
    basicLetterReference: 'CO, Golden Unit ltr 1000 Ser CODE/1 of 10 Feb 26',
    basicLetterSsic: '1000',
    ssic: '5216',
    originatorCode: 'Ser 019/870',
    date: '23 Apr 26',
    from: 'Commanding Officer, Intermediate Unit, Camp Pendleton, CA 92055',
    to: 'Commanding Officer, Destination Unit, City, State Zip',
    sig: 'R. L. GABEL',
    delegationText: '',
    startingReferenceLevel: 'c',
    startingEnclosureNumber: '3',
    ...overrides,
  };
}

const SHORT_BODY: ParagraphData[] = [
  { id: 1, level: 1, content: 'Forwarded, recommending approval.', isMandatory: true },
];

/** Long enough that no signature page has room for it (9-1). */
const LONG_BODY: ParagraphData[] = Array.from({ length: 14 }, (_, i) => ({
  id: i + 1,
  level: 1,
  content: `Paragraph ${i + 1} of a long endorsement. It carries enough substantive comment that the whole endorsement cannot be added to the signature page of the basic letter, which is the condition paragraph 9-1 tests before it allows a same-page endorsement.`,
  isMandatory: i === 0,
}));

async function blockBytes(
  formData: FormData,
  paragraphs: ParagraphData[] = SHORT_BODY,
  vias: string[] = ['Commanding General, Higher Headquarters'],
  copyTos: string[] = ['NAS Meridian (Code 11)'],
): Promise<Uint8Array> {
  const blob = await generateBasePDFBlob(
    formData, vias, [], [], copyTos, paragraphs, [],
  );
  return new Uint8Array(await blob.arrayBuffer());
}

describe('placement predicates', () => {
  it('reads an unset placement as a new-page endorsement (9-1)', () => {
    expect(isSamePageEndorsement({ documentType: 'endorsement' })).toBe(false);
    expect(isSamePageEndorsement({ documentType: 'endorsement', endorsementPlacement: 'new-page' })).toBe(false);
    expect(isSamePageEndorsement({ documentType: 'endorsement', endorsementPlacement: 'same-page' })).toBe(true);
    expect(isSamePageEndorsement({ documentType: 'basic', endorsementPlacement: 'same-page' })).toBe(false);
  });

  it('omits identification by default on a same-page endorsement (9-2.1.a)', () => {
    expect(omitsIdentification({ documentType: 'endorsement', endorsementPlacement: 'same-page' })).toBe(true);
    expect(omitsIdentification({
      documentType: 'endorsement', endorsementPlacement: 'same-page', samePageOmitsIdentification: false,
    })).toBe(false);
    // A new-page endorsement never omits it (Figure 9-1, second endorsement).
    expect(omitsIdentification({
      documentType: 'endorsement', endorsementPlacement: 'new-page', samePageOmitsIdentification: true,
    })).toBe(false);
  });

  it('drops the "on ..." clause only when identification is omitted (9-2.1.b)', () => {
    expect(endorsementLineText(endorsement())).toBe('FIRST ENDORSEMENT');
    expect(endorsementLineText(endorsement({ samePageOmitsIdentification: false })))
      .toBe('FIRST ENDORSEMENT on CO, Golden Unit ltr 1000 Ser CODE/1 of 10 Feb 26');
    expect(endorsementLineText(endorsement({ endorsementPlacement: 'new-page' })))
      .toBe('FIRST ENDORSEMENT on CO, Golden Unit ltr 1000 Ser CODE/1 of 10 Feb 26');
  });
});

describe('a short endorsement added to the signature page (9-1)', () => {
  it('adds no page and lands two lines below the last line of the basic letter', async () => {
    const host = await hostBytes();
    const block = await blockBytes(endorsement());
    const hostLayout = await extractPdfTextLayout(new Blob([new Uint8Array(host)]));
    const hostPages = Math.max(...hostLayout.map((i) => i.page));
    const hostLast = await measureLastContent(host, hostPages - 1);
    expect(hostLast).not.toBeNull();

    const extent = await measureBlockExtent(block);
    expect(extent.pages).toBe(1);

    const result = await composeSamePage(host, block);
    expect(result.fits).toBe(true);
    if (!result.fits) return;

    // 9-1: no new page.
    expect(result.pages).toBe(hostPages);
    const composed = await extractPdfTextLayout(new Blob([new Uint8Array(result.bytes)]));
    expect(Math.max(...composed.map((i) => i.page))).toBe(hostPages);

    // The block's first line sits exactly two line heights below the
    // basic letter's last content baseline.
    expect(result.hostLastBaseline).toBeCloseTo(hostLast!, 1);
    expect(result.hostLastBaseline - result.blockFirstBaseline).toBeCloseTo(GAP, 1);

    // And the whole block clears the bottom margin.
    expect(result.blockLastBaseline).toBeGreaterThanOrEqual(CONTENT_FLOOR);

    // The endorsement line reached the composed page.
    const lastPage = composed.filter((i) => i.page === hostPages);
    const joined = lastPage.map((i) => i.text).join('');
    expect(joined).toContain('FIRST ENDORSEMENT');
  }, 60000);

  it('carries no Subj and no SSIC of its own when identification is omitted (9-2.1.a)', async () => {
    const block = await blockBytes(endorsement());
    const layout = await extractPdfTextLayout(new Blob([new Uint8Array(block)]));
    const joined = layout.map((i) => i.text).join('');
    expect(joined).not.toContain('Subj:');
    expect(joined).not.toContain('5216');
    // Figure 9-1: the Ser line and the date are the whole ID block.
    expect(joined).toContain('Ser 019/870');
    expect(joined).toContain('23 Apr 26');
    expect(joined).toContain('FIRST ENDORSEMENT');
    expect(joined).not.toContain('FIRST ENDORSEMENT on');
    // No letterhead and no page number.
    expect(joined).not.toContain('UNITED STATES MARINE CORPS');
    expect(layout.every((i) => i.y >= CONTENT_FLOOR)).toBe(true);
  }, 60000);

  it('numbers the remaining Via addressees the way 9-2.2 does', async () => {
    const one = await blockBytes(endorsement(), SHORT_BODY, ['Commanding General, I MEF']);
    const oneJoined = (await extractPdfTextLayout(new Blob([new Uint8Array(one)])))
      .map((i) => i.text).join('');
    // A single remaining via is not numbered.
    expect(oneJoined).toContain('Commanding General, I MEF');
    expect(oneJoined).not.toContain('(1) Commanding General, I MEF');

    const two = await blockBytes(endorsement(), SHORT_BODY, [
      'Commanding General, I MEF', 'Commander, Fleet Forces Command',
    ]);
    const twoJoined = (await extractPdfTextLayout(new Blob([new Uint8Array(two)])))
      .map((i) => i.text).join('');
    expect(twoJoined).toContain('(1) ');
    expect(twoJoined).toContain('(2) ');
  }, 60000);

  it('follows Figure 9-1 line for line down the block', async () => {
    const block = await blockBytes(endorsement());
    const layout = (await extractPdfTextLayout(new Blob([new Uint8Array(block)])))
      .filter((i) => i.page === 1);
    const at = (needle: string) => layout.find((i) => i.text.includes(needle))!.y;

    const ser = at('Ser 019/870');
    const date = at('Apr 26');
    const line = at('FIRST ENDORSEMENT');
    const from = at('From:');
    const to = at('To:');
    const via = at('Via:');
    const body = at('Forwarded, recommending approval.');

    // The identification symbols run single spaced.
    expect(ser - date).toBeCloseTo(LINE_HEIGHT_12PT, 0);
    // 9-2.1.a: the endorsement line starts at the left margin on the
    // second line below the date line.
    expect(date - line).toBeCloseTo(2 * LINE_HEIGHT_12PT, 0);
    expect(layout.find((i) => i.text.includes('FIRST ENDORSEMENT'))!.x).toBeCloseTo(72, 0);
    // From on the second line below it, then To and Via single spaced,
    // then the body on the second line below the last heading line.
    expect(line - from).toBeCloseTo(2 * LINE_HEIGHT_12PT, 0);
    expect(from - to).toBeCloseTo(LINE_HEIGHT_12PT, 0);
    expect(to - via).toBeCloseTo(LINE_HEIGHT_12PT, 0);
    expect(via - body).toBeCloseTo(2 * LINE_HEIGHT_12PT, 0);
  }, 60000);

  it('keeps the signature four lines down and Copy to two lines below it (7-2.14, 7-2.15.b)', async () => {
    const block = await blockBytes(endorsement());
    const layout = await extractPdfTextLayout(new Blob([new Uint8Array(block)]))
      .then((items) => items.filter((i) => i.page === 1));

    const sig = layout.find((i) => i.text.includes('R. L. GABEL'));
    expect(sig).toBeDefined();
    const above = layout.filter((i) => i.y > sig!.y).sort((a, b) => a.y - b.y)[0];
    expect(above.y - sig!.y).toBeGreaterThanOrEqual(4 * LINE_HEIGHT_12PT - 2);
    expect(above.y - sig!.y).toBeLessThanOrEqual(4 * LINE_HEIGHT_12PT + 2);

    const copyTo = layout.find((i) => i.text.includes('Copy to:'));
    expect(copyTo).toBeDefined();
    expect(sig!.y - copyTo!.y).toBeGreaterThanOrEqual(2 * LINE_HEIGHT_12PT - 2);
    expect(sig!.y - copyTo!.y).toBeLessThanOrEqual(2 * LINE_HEIGHT_12PT + 2);
  }, 60000);
});

describe('an endorsement that does not fit the signature page (9-1)', () => {
  it('reports the shortfall instead of composing a long endorsement', async () => {
    const host = await hostBytes();
    const block = await blockBytes(endorsement(), LONG_BODY);
    const result = await composeSamePage(host, block);
    expect(result.fits).toBe(false);
    if (result.fits) return;
    expect(result.reason).toContain('9-1');
    expect(result.blockHeight).toBeGreaterThan(0);
  }, 60000);

  it('refuses a full signature page even for the shortest endorsement', async () => {
    // The golden fixture letter's own body fills the page: its last
    // line sits 146 pt up, so 74 pt remain and the shortest block is
    // 207 pt. This is the everyday case 9-1 sends to a new page.
    const host = await hostBytes(FIXTURE_PARAGRAPHS);
    const block = await blockBytes(endorsement());
    const result = await composeSamePage(host, block);
    expect(result.fits).toBe(false);
    if (result.fits) return;
    expect(result.hostLastBaseline).not.toBeNull();
    expect(result.hostLastBaseline! - CONTENT_FLOOR).toBeLessThan(result.blockHeight + GAP);
  }, 60000);

  it('falls back to a new-page endorsement carrying the SSIC, the "on" line and the subject', async () => {
    // Figure 9-1's second endorsement: every new-page endorsement
    // repeats the basic letter's SSIC, identifies it in the
    // endorsement line, and uses its subject.
    const fallback = endorsement({ endorsementPlacement: 'new-page', startingPageNumber: 2 });
    const bytes = await blockBytes(fallback, LONG_BODY);
    const layout = await extractPdfTextLayout(new Blob([new Uint8Array(bytes)]));
    const page1 = layout.filter((i) => i.page === 1).map((i) => i.text).join('');
    expect(page1).toContain('5216');
    expect(page1).toContain('FIRST ENDORSEMENT on');
    expect(page1).toContain('Subj:');
    expect(page1).toContain('UNITED STATES MARINE CORPS');
  }, 60000);
});

describe('identification kept (9-2.1.a, the option not taken)', () => {
  it('prints the SSIC, the subject and the full endorsement line', async () => {
    const block = await blockBytes(endorsement({ samePageOmitsIdentification: false }));
    const layout = await extractPdfTextLayout(new Blob([new Uint8Array(block)]));
    const joined = layout.map((i) => i.text).join('');
    expect(joined).toContain('5216');
    expect(joined).toContain('Subj:');
    expect(joined).toContain('FIRST ENDORSEMENT on');
    // Still a block: no letterhead.
    expect(joined).not.toContain('UNITED STATES MARINE CORPS');
  }, 60000);

  it('still composes onto the signature page when it fits', async () => {
    // Keeping the SSIC, the subject and the "on ..." line costs the
    // block 55 pt, so this case needs a shorter signature page under it
    // than the omitted-identification case does.
    const host = await hostBytes(SHORTER_HOST_BODY);
    const block = await blockBytes(endorsement({ samePageOmitsIdentification: false }), SHORT_BODY,
      ['Commanding General, Higher Headquarters'], []);
    const result = await composeSamePage(host, block);
    expect(result.fits).toBe(true);
    if (!result.fits) return;
    expect(result.hostLastBaseline - result.blockFirstBaseline).toBeCloseTo(GAP, 1);
  }, 60000);
});

describe('the Courier body font', () => {
  it('composes under the same rule', async () => {
    const host = await hostBytes();
    const block = await blockBytes(endorsement({ bodyFont: 'courier' }));
    const extent = await measureBlockExtent(block);
    expect(extent.pages).toBe(1);
    const result = await composeSamePage(host, block);
    expect(result.fits).toBe(true);
    if (!result.fits) return;
    expect(result.hostLastBaseline - result.blockFirstBaseline).toBeCloseTo(GAP, 1);
    const composed = await extractPdfTextLayout(new Blob([new Uint8Array(result.bytes)]));
    expect(composed.filter((i) => i.page === result.pages).map((i) => i.text).join(''))
      .toContain('FIRST ENDORSEMENT');
  }, 60000);
});

describe('the page on its own (E.4)', () => {
  it('renders a same-page endorsement with the letterhead and the 9-2.1.a omission when no letter is under it', async () => {
    const page = await blockBytes(endorsement({ samePageRenderAsBlock: undefined }));
    const layout = await extractPdfTextLayout(new Blob([new Uint8Array(page)]));
    const joined = layout.map((i) => i.text).join('');
    expect(joined).toContain('UNITED STATES MARINE CORPS');
    expect(joined).toContain('FIRST ENDORSEMENT');
    expect(joined).not.toContain('FIRST ENDORSEMENT on');
    expect(joined).not.toContain('Subj:');
    expect(joined).toContain('Ser 019/870');
  }, 60000);

  it('the DOCX is always the page, letterhead included, with the omission taken', async () => {
    const JSZip = (await import('jszip')).default;
    const blob = await generateDocxBlob(
      endorsement({ samePageRenderAsBlock: undefined }), ['Commanding General, Higher Headquarters'], [], [],
      ['NAS Meridian (Code 11)'], SHORT_BODY, [],
    );
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const xml = await zip.file('word/document.xml')!.async('string');
    expect(xml).toContain('FIRST ENDORSEMENT');
    expect(xml).not.toContain('Subj:');
    expect(xml).toContain('Ser 019/870');
    expect(xml).not.toContain('>5216<');
    const header = await zip.file('word/header1.xml')?.async('string');
    expect((header ?? '') + xml).toContain('UNITED STATES MARINE CORPS');
  }, 60000);
});
