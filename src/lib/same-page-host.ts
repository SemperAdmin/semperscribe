/**
 * E.3 - the letter a same-page endorsement is added to.
 *
 * SECNAV M-5216.5 9-1 puts a same-page endorsement on the signature
 * page of the basic letter or the preceding endorsement, and Figure
 * 9-1 draws it there: below the signature, under that page's own
 * letterhead and seal. The endorsement adds no letterhead of its own.
 * So a same-page endorsement previewed or exported by itself is the
 * block alone, and to see the page it lands on the app needs the
 * letter. This module resolves the letter from where the drafter
 * pointed (a PDF in the file store, or a letter in the library) and
 * renders the endorsed document: the letter with the block composed
 * onto its last page when 9-1's fit test passes, or with a new-page
 * endorsement appended when it does not.
 *
 * Pure over bytes and callbacks, like the composer it wraps, so the
 * browser, the tests and a headless caller run the same code.
 */
import type { FormData, ParagraphData, SamePageHost, SavedLetter } from '@/types';
import { composeSamePage } from '@/lib/same-page-endorsement';

/** What the drafter sees naming the attached letter. */
export function hostLabel(host: SamePageHost | undefined | null): string | null {
  if (!host) return null;
  if (host.kind === 'file') return host.fileName;
  return host.title || 'Saved letter';
}

export interface HostResolverDeps {
  savedLetters: SavedLetter[];
  /** Bytes for a file-kind host, by fileId. Null when the file is gone. */
  loadFile: (fileId: string) => Promise<ArrayBuffer | null>;
  /** A library letter through the same pipeline its own export uses. */
  renderLetter: (letter: SavedLetter) => Promise<Blob>;
}

/**
 * The letter's PDF bytes, or null when the host cannot be found: a
 * file missing from this browser's store, or a library letter since
 * deleted. Callers treat null as "no letter attached" and say so.
 */
export async function resolveHostBytes(
  host: SamePageHost | undefined | null,
  deps: HostResolverDeps,
): Promise<Uint8Array | null> {
  if (!host) return null;
  if (host.kind === 'file') {
    const bytes = await deps.loadFile(host.fileId);
    return bytes ? new Uint8Array(bytes) : null;
  }
  const letter = deps.savedLetters.find((l) => l.id === host.letterId);
  if (!letter) return null;
  const blob = await deps.renderLetter(letter);
  return new Uint8Array(await blob.arrayBuffer());
}

/** The slices a PDF render takes. Structural, so lib/ stays clear of services/. */
export interface EndorsementRenderContext {
  formData: FormData;
  vias: string[];
  references: string[];
  enclosures: string[];
  copyTos: string[];
  paragraphs: ParagraphData[];
  distList: string[];
}

export type RenderPdf = (ctx: EndorsementRenderContext) => Promise<Blob>;

/** Where the endorsement landed. */
export type EndorsedPlacement =
  | { status: 'fits'; page: number; pages: number }
  | { status: 'new-page'; reason: string; startsOnPage: number; pages: number };

/** The placement, or the absence of a letter to place against. */
export type SamePageStatus = EndorsedPlacement | { status: 'no-host' };

export interface EndorsedDocument {
  bytes: Uint8Array;
  placement: EndorsedPlacement;
}

/**
 * 9-1's other branch. When the block does not fit, the endorsement
 * goes on a new page, and a new-page endorsement carries the SSIC,
 * the subject and the "on ..." clause whatever the 9-2.1.a checkbox
 * said (Figure 9-1, second endorsement). Its pages continue the
 * letter's count.
 */
export function newPageFallback(formData: FormData, hostPages: number): FormData {
  return {
    ...formData,
    endorsementPlacement: 'new-page',
    samePageOmitsIdentification: false,
    startingPageNumber: hostPages + 1,
    previousPackagePageCount: hostPages,
  };
}

async function pageCount(bytes: Uint8Array): Promise<number> {
  const { PDFDocument } = await import('pdf-lib');
  const doc = await PDFDocument.load(bytes);
  return doc.getPageCount();
}

async function appendPages(hostBytes: Uint8Array, tailBytes: Uint8Array): Promise<Uint8Array> {
  const { PDFDocument } = await import('pdf-lib');
  const host = await PDFDocument.load(hostBytes);
  const tail = await PDFDocument.load(tailBytes);
  const pages = await host.copyPages(tail, tail.getPageIndices());
  for (const page of pages) host.addPage(page);
  return host.save();
}

/**
 * The endorsed document: the letter with the endorsement on it.
 *
 * The block is rendered from the context as given (same-page, with
 * whatever omission the drafter chose) and composed onto the letter's
 * last page. When 9-1's fit test fails, the endorsement is rendered
 * again as a new-page endorsement numbered after the letter's pages
 * and appended, which is the assembly Figure 9-1 shows for its second
 * endorsement.
 */
export async function renderSamePageWithHost(
  ctx: EndorsementRenderContext,
  render: RenderPdf,
  hostBytes: Uint8Array,
): Promise<EndorsedDocument> {
  const blockBlob = await render(ctx);
  const blockBytes = new Uint8Array(await blockBlob.arrayBuffer());
  const result = await composeSamePage(hostBytes, blockBytes);
  if (result.fits) {
    return {
      bytes: result.bytes,
      placement: { status: 'fits', page: result.pages, pages: result.pages },
    };
  }
  const hostPages = await pageCount(hostBytes);
  const tailBlob = await render({ ...ctx, formData: newPageFallback(ctx.formData, hostPages) });
  const tailBytes = new Uint8Array(await tailBlob.arrayBuffer());
  const bytes = await appendPages(hostBytes, tailBytes);
  return {
    bytes,
    placement: {
      status: 'new-page',
      reason: result.reason,
      startsOnPage: hostPages + 1,
      pages: hostPages + (await pageCount(tailBytes)),
    },
  };
}

/** One sentence for the details card and the export toast. */
export function describePlacement(status: SamePageStatus | null | undefined): string {
  if (!status) return '';
  switch (status.status) {
    case 'no-host':
      return 'No letter attached. The preview and the export show the endorsement block alone.';
    case 'fits':
      return `Fits on the signature page. The endorsement is on page ${status.page} of ${status.pages} and adds no page (9-1).`;
    case 'new-page':
      return `Does not fit on the signature page, so it exports as a new-page endorsement starting on page ${status.startsOnPage} of ${status.pages} (9-1). ${status.reason}`;
  }
}
