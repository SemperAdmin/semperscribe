// @vitest-environment node
/**
 * E.3 - the letter a same-page endorsement is added to (SECNAV
 * M-5216.5 9-1, Figure 9-1).
 *
 * Figure 9-1 draws the same-page endorsement below the basic letter's
 * signature, under that letter's letterhead. So the endorsed document
 * is the letter with the block on its last page when the block fits,
 * and the letter with a new-page endorsement appended when it does
 * not. Both are measured here against real rendered geometry.
 */
import { describe, it, expect, beforeAll } from 'vitest';

import { registerNodeAssets } from './node-assets';
import { generateBasePDFBlob } from '@/lib/pdf-generator';
import { extractPdfTextLayout } from './golden/helpers';
import {
  hostLabel,
  resolveHostBytes,
  newPageFallback,
  renderSamePageWithHost,
  describePlacement,
  type EndorsementRenderContext,
} from '@/lib/same-page-host';
import type { FormData, ParagraphData, SavedLetter } from '@/types';
import {
  FIXTURE_FORM_DATA,
  FIXTURE_VIAS,
  FIXTURE_REFERENCES,
  FIXTURE_ENCLOSURES,
  FIXTURE_COPY_TOS,
} from './golden/fixture';

beforeAll(() => {
  registerNodeAssets();
});

const render = (ctx: EndorsementRenderContext) => generateBasePDFBlob(
  ctx.formData, ctx.vias, ctx.references, ctx.enclosures, ctx.copyTos, ctx.paragraphs, ctx.distList,
);

const SHORT_HOST_BODY: ParagraphData[] = [
  { id: 1, level: 1, content: 'Request approval of the action described below.', isMandatory: true },
  { id: 2, level: 1, content: 'The point of contact is the unit adjutant.' },
];

async function hostBytes(): Promise<Uint8Array> {
  const blob = await generateBasePDFBlob(
    FIXTURE_FORM_DATA, FIXTURE_VIAS, FIXTURE_REFERENCES, FIXTURE_ENCLOSURES, FIXTURE_COPY_TOS, SHORT_HOST_BODY, [],
  );
  return new Uint8Array(await blob.arrayBuffer());
}

function endorsement(overrides: Partial<FormData> = {}): FormData {
  return {
    ...FIXTURE_FORM_DATA,
    documentType: 'endorsement',
    endorsementPlacement: 'same-page',
    endorsementLevel: 'FIRST',
    basicLetterReference: 'CO, Golden Unit ltr 1000 Ser CODE/1 of 10 Feb 26',
    ssic: '5216',
    originatorCode: 'Ser 019/870',
    date: '23 Apr 26',
    from: 'Commanding Officer, Intermediate Unit',
    to: 'Commanding Officer, Destination Unit',
    sig: 'R. L. GABEL',
    samePageHost: { kind: 'file', fileId: 'f1', fileName: 'letter.pdf' },
    ...overrides,
  };
}

const SHORT_BODY: ParagraphData[] = [
  { id: 1, level: 1, content: 'Forwarded, recommending approval.', isMandatory: true },
];

const LONG_BODY: ParagraphData[] = Array.from({ length: 14 }, (_, i) => ({
  id: i + 1,
  level: 1,
  content: `Paragraph ${i + 1} of a long endorsement. It carries enough substantive comment that the whole endorsement cannot be added to the signature page of the basic letter, which is the condition paragraph 9-1 tests before it allows a same-page endorsement.`,
  isMandatory: i === 0,
}));

function ctx(formData: FormData, paragraphs: ParagraphData[]): EndorsementRenderContext {
  return { formData, vias: [], references: [], enclosures: [], copyTos: [], paragraphs, distList: [] };
}

const asBlob = (bytes: Uint8Array) => new Blob([new Uint8Array(bytes)], { type: 'application/pdf' });

async function pageText(bytes: Uint8Array, page: number): Promise<string> {
  const items = await extractPdfTextLayout(asBlob(bytes));
  return items.filter((i) => i.page === page).map((i) => i.text).join(' ');
}

async function pageCount(bytes: Uint8Array): Promise<number> {
  const { PDFDocument } = await import('pdf-lib');
  return (await PDFDocument.load(bytes)).getPageCount();
}

describe('hostLabel', () => {
  it('names the file or the library letter', () => {
    expect(hostLabel(undefined)).toBeNull();
    expect(hostLabel({ kind: 'file', fileId: 'f', fileName: 'ltr.pdf' })).toBe('ltr.pdf');
    expect(hostLabel({ kind: 'draft', letterId: 'd', title: 'Training request' })).toBe('Training request');
    expect(hostLabel({ kind: 'draft', letterId: 'd', title: '' })).toBe('Saved letter');
  });
});

describe('resolveHostBytes', () => {
  const letter = { ...FIXTURE_FORM_DATA, id: 'd1', savedAt: '', vias: [], references: [], enclosures: [], copyTos: [], paragraphs: SHORT_HOST_BODY } as SavedLetter;

  it('reads a file host from the store and reports a missing file as null', async () => {
    const stored = new Uint8Array([37, 80, 68, 70]).buffer;
    const deps = { savedLetters: [], loadFile: async (id: string) => (id === 'f1' ? stored : null), renderLetter: async () => new Blob() };
    expect(await resolveHostBytes({ kind: 'file', fileId: 'f1', fileName: 'a.pdf' }, deps)).toEqual(new Uint8Array(stored));
    expect(await resolveHostBytes({ kind: 'file', fileId: 'gone', fileName: 'b.pdf' }, deps)).toBeNull();
    expect(await resolveHostBytes(undefined, deps)).toBeNull();
  });

  it('renders a library letter through the supplied pipeline and reports a deleted one as null', async () => {
    let rendered: SavedLetter | null = null;
    const deps = {
      savedLetters: [letter],
      loadFile: async () => null,
      renderLetter: async (l: SavedLetter) => { rendered = l; return new Blob([new Uint8Array([1, 2, 3])]); },
    };
    expect(await resolveHostBytes({ kind: 'draft', letterId: 'd1', title: 't' }, deps)).toEqual(new Uint8Array([1, 2, 3]));
    expect(rendered).toBe(letter);
    expect(await resolveHostBytes({ kind: 'draft', letterId: 'nope', title: 't' }, deps)).toBeNull();
  });
});

describe('newPageFallback', () => {
  it('restores the identification and continues the page count (Figure 9-1, second endorsement)', () => {
    const fd = newPageFallback(endorsement({ samePageOmitsIdentification: true }), 3);
    expect(fd.endorsementPlacement).toBe('new-page');
    expect(fd.samePageOmitsIdentification).toBe(false);
    expect(fd.startingPageNumber).toBe(4);
    expect(fd.previousPackagePageCount).toBe(3);
  });
});

describe('renderSamePageWithHost', () => {
  it('composes a fitting block onto the letter and adds no page', async () => {
    const host = await hostBytes();
    const endorsed = await renderSamePageWithHost(ctx(endorsement(), SHORT_BODY), render, host);
    expect(endorsed.placement).toEqual({ status: 'fits', page: 1, pages: 1 });
    expect(await pageCount(endorsed.bytes)).toBe(1);
    const text = await pageText(endorsed.bytes, 1);
    // The letter's own header and the endorsement line share the page.
    expect(text).toContain('FIRST ENDORSEMENT');
    expect(text).toContain('Forwarded, recommending approval.');
    expect(text).toContain(FIXTURE_FORM_DATA.subj);
  }, 60_000);

  it('appends a new-page endorsement with the identification restored when the block does not fit', async () => {
    const host = await hostBytes();
    const endorsed = await renderSamePageWithHost(ctx(endorsement(), LONG_BODY), render, host);
    expect(endorsed.placement.status).toBe('new-page');
    if (endorsed.placement.status !== 'new-page') return;
    expect(endorsed.placement.startsOnPage).toBe(2);
    expect(endorsed.placement.pages).toBeGreaterThanOrEqual(3);
    expect(await pageCount(endorsed.bytes)).toBe(endorsed.placement.pages);
    const page2 = await pageText(endorsed.bytes, 2);
    expect(page2).toContain('FIRST ENDORSEMENT on');
    expect(page2).toContain('Subj:');
  }, 60_000);
});

describe('describePlacement', () => {
  it('says where the endorsement landed', () => {
    expect(describePlacement({ status: 'no-host' })).toContain('block alone');
    expect(describePlacement({ status: 'fits', page: 1, pages: 1 })).toContain('page 1 of 1');
    expect(describePlacement({ status: 'new-page', reason: 'r', startsOnPage: 2, pages: 3 })).toContain('starting on page 2 of 3');
    expect(describePlacement(null)).toBe('');
  });
});
