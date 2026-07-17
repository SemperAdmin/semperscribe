/**
 * ENC (docs/ENCLOSURE_UPLOAD_PLAN.md) - enclosure file merge engine.
 * Supersedes the P3.6 v1, which kept uploads in a second list and
 * GUESSED their numbers (startingNumber + max(0, typed - files)) -
 * silently wrong the moment the lists diverged.
 *
 * The v2 model: each typed enclosure row optionally binds one file.
 * The row's position IS the number - no arithmetic guess exists.
 *
 * Marking (SECNAV M-5216.5, para on enclosure identification):
 * - Default: "Enclosure (N)" stamped in the lower right corner of the
 *   file's first page - the doctrinal mark.
 * - Cover page ON (the manual's attach-a-paper fallback, for files
 *   whose corner is unusable): the generated cover carries the mark
 *   and the stamp is omitted - substitution, not duplication.
 * - Generated cover pages carry the classification banner when the
 *   marking engine is active. Uploaded pages are NEVER overprinted
 *   with classification markings - the user owns their content.
 */

import { PDFDocument, PDFFont, StandardFonts, rgb } from 'pdf-lib';
import { MAX_ENCLOSURE_FILE_BYTES } from '@/lib/document-library';

export type EnclosureMimeType = 'application/pdf' | 'image/jpeg' | 'image/png';

export interface EnclosureAttachment {
  id: string;
  fileName: string;
  /** Title used on the enclosure line and cover page. */
  title: string;
  mimeType: EnclosureMimeType;
  /** Raw file bytes. */
  bytes: ArrayBuffer;
}

/**
 * One typed enclosure line, optionally bound to a file. Position in
 * the row array determines the enclosure number.
 */
export interface EnclosureRow {
  /** Stable key - survives reorder and delete. */
  key: string;
  /** The enclosure line text. */
  title: string;
  /** Bound file id, or undefined for a physical enclosure. */
  fileId?: string;
}

/** A file scheduled into the merge, carrying its row-derived number. */
export interface MergeItem {
  number: number;
  attachment: EnclosureAttachment;
}

let rowCounter = 0;
/** A fresh unbound row with a stable key. */
export function newRow(title = ''): EnclosureRow {
  rowCounter += 1;
  return { key: `row-${Date.now()}-${rowCounter}`, title };
}

/**
 * Reconciles a plain title list onto existing rows, POSITION-based:
 * row i keeps its key and file binding, its title becomes titles[i].
 * Extra titles become fresh unbound rows; extra rows drop (their
 * bindings with them). This is the adapter that lets every legacy
 * `setEnclosures(string[])` caller (undo, find-replace, import,
 * recovery) keep working against the row model. Known limit, recorded
 * in the plan: a caller that REMOVES a bound row through this path
 * drops the binding, and undo restores the title only.
 */
export function reconcileRows(prev: EnclosureRow[], titles: string[]): EnclosureRow[] {
  return titles.map((title, i) =>
    i < prev.length
      ? (prev[i].title === title ? prev[i] : { ...prev[i], title })
      : newRow(title),
  );
}

export interface MergeOptions {
  /** Insert a generated cover page carrying the mark (stamp omitted). */
  coverPages: boolean;
  /** Classification banner for GENERATED pages only, e.g. "CUI". */
  bannerText?: string;
}

/** Letter-size page and the one-inch margin box for image placement. */
const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN = 72;

function detectMime(head: Uint8Array): EnclosureMimeType | null {
  if (head.length >= 5 && String.fromCharCode(...head.slice(0, 5)) === '%PDF-') return 'application/pdf';
  if (head.length >= 3 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return 'image/jpeg';
  if (head.length >= 8 && head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47) return 'image/png';
  return null;
}

/**
 * Reads a File into an attachment. Accepts PDF, JPG, PNG by magic
 * bytes; refuses everything else and files over the size cap.
 */
export async function fileToAttachment(file: File): Promise<EnclosureAttachment> {
  if (file.size > MAX_ENCLOSURE_FILE_BYTES) {
    const mb = (MAX_ENCLOSURE_FILE_BYTES / (1024 * 1024)).toFixed(0);
    throw new Error(`"${file.name}" is ${(file.size / (1024 * 1024)).toFixed(1)} MB. The per-file limit is ${mb} MB.`);
  }
  const bytes = await file.arrayBuffer();
  const mimeType = detectMime(new Uint8Array(bytes.slice(0, 8)));
  if (!mimeType) {
    throw new Error(`"${file.name}" is not a PDF, JPG, or PNG. For Word documents, save as PDF first.`);
  }
  return {
    id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    fileName: file.name,
    title: file.name.replace(/\.(pdf|jpe?g|png)$/i, ''),
    mimeType,
    bytes,
  };
}

/**
 * Derives the merge schedule from the rows - the ONLY place enclosure
 * numbers attach to files. Row i carries number startingNumber + i.
 * Rows without a bound file consume their number and contribute
 * nothing (a physical enclosure sent separately).
 */
export function computeMergeItems(
  rows: EnclosureRow[],
  files: ReadonlyMap<string, EnclosureAttachment>,
  startingNumber: number,
): MergeItem[] {
  const items: MergeItem[] = [];
  rows.forEach((row, index) => {
    if (!row.fileId) return;
    const attachment = files.get(row.fileId);
    if (attachment) items.push({ number: startingNumber + index, attachment });
  });
  return items;
}

/** Draws the M-5216.5 mark in the lower right corner of a page. */
function stampEnclosureNumber(
  page: { getWidth(): number; drawText(text: string, opts: object): void },
  font: PDFFont,
  enclosureNumber: number,
): void {
  const text = `Enclosure (${enclosureNumber})`;
  const size = 12;
  const width = font.widthOfTextAtSize(text, size);
  page.drawText(text, {
    x: page.getWidth() - MARGIN - width,
    y: 36, // half an inch up - below the one-inch text area
    size,
    font,
    color: rgb(0, 0, 0),
  });
}

/** Draws the classification banner top and bottom of a generated page. */
function drawBanners(
  page: { getWidth(): number; getHeight(): number; drawText(text: string, opts: object): void },
  font: PDFFont,
  bannerText: string,
): void {
  const size = 12;
  const width = font.widthOfTextAtSize(bannerText, size);
  const x = (page.getWidth() - width) / 2;
  page.drawText(bannerText, { x, y: page.getHeight() - 40, size, font, color: rgb(0, 0, 0) });
  page.drawText(bannerText, { x, y: 28, size, font, color: rgb(0, 0, 0) });
}

/**
 * Appends bound enclosure files to a base letter PDF, in row order,
 * each starting on a new page. Returns merged bytes. Throws with the
 * enclosure number and file name when an attachment fails to parse.
 */
export async function mergeAttachmentsIntoPdf(
  baseBytes: ArrayBuffer | Uint8Array,
  items: MergeItem[],
  options: MergeOptions,
): Promise<Uint8Array> {
  const merged = await PDFDocument.load(baseBytes);
  const font = await merged.embedFont(StandardFonts.TimesRoman);
  const fontBold = await merged.embedFont(StandardFonts.TimesRomanBold);

  for (const { number, attachment } of items) {
    if (options.coverPages) {
      // The manual's fallback: the cover carries the mark, so the
      // file itself is not stamped.
      const cover = merged.addPage([PAGE_W, PAGE_H]);
      const heading = `Enclosure (${number})`;
      const headingWidth = fontBold.widthOfTextAtSize(heading, 16);
      cover.drawText(heading, {
        x: (PAGE_W - headingWidth) / 2,
        y: PAGE_H / 2 + 20,
        size: 16,
        font: fontBold,
        color: rgb(0, 0, 0),
      });
      const titleWidth = font.widthOfTextAtSize(attachment.title, 12);
      cover.drawText(attachment.title, {
        x: Math.max(MARGIN, (PAGE_W - titleWidth) / 2),
        y: PAGE_H / 2 - 8,
        size: 12,
        font,
        color: rgb(0, 0, 0),
        maxWidth: PAGE_W - 2 * MARGIN,
      });
      if (options.bannerText) drawBanners(cover, fontBold, options.bannerText);
    }

    if (attachment.mimeType === 'application/pdf') {
      let source: PDFDocument;
      try {
        source = await PDFDocument.load(attachment.bytes, { ignoreEncryption: true });
      } catch {
        throw new Error(`Enclosure (${number}) "${attachment.fileName}" failed to parse as a PDF.`);
      }
      const pages = await merged.copyPages(source, source.getPageIndices());
      pages.forEach((page) => merged.addPage(page));
      if (!options.coverPages && pages.length > 0) {
        stampEnclosureNumber(pages[0], font, number);
      }
    } else {
      // JPG/PNG: one generated letter-size page, image fit inside the
      // one-inch margin box, never upscaled past natural size.
      let image;
      try {
        image = attachment.mimeType === 'image/jpeg'
          ? await merged.embedJpg(attachment.bytes)
          : await merged.embedPng(attachment.bytes);
      } catch {
        throw new Error(`Enclosure (${number}) "${attachment.fileName}" failed to parse as an image.`);
      }
      const page = merged.addPage([PAGE_W, PAGE_H]);
      const boxW = PAGE_W - 2 * MARGIN;
      const boxH = PAGE_H - 2 * MARGIN;
      const fit = Math.min(boxW / image.width, boxH / image.height, 1);
      const w = image.width * fit;
      const h = image.height * fit;
      page.drawImage(image, {
        x: (PAGE_W - w) / 2,
        y: (PAGE_H - h) / 2,
        width: w,
        height: h,
      });
      if (!options.coverPages) stampEnclosureNumber(page, font, number);
    }
  }

  return merged.save();
}
