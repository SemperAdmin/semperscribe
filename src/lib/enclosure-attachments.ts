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
 * - Default: "Enclosure (N)" stamped in the lower right corner of
 *   EVERY page of the file (the manual: mark the first page, marking
 *   all pages permitted - Stephen's 2026-07-16 ruling picks all pages
 *   so a separated sheet still names its enclosure).
 * - Cover page ON (the manual's attach-a-paper fallback, for files
 *   whose corners are unusable): the generated cover carries the mark
 *   and the stamps are omitted - substitution, not duplication.
 * - Generated cover pages carry the classification banner when the
 *   marking engine is active. Uploaded pages are NEVER overprinted
 *   with classification markings - the user owns their content.
 */

import { PDFDocument, PDFFont, StandardFonts, rgb } from 'pdf-lib';
import type { EnclosureAttachment, MergeItem } from '@/lib/enclosure-rows';

// The row model, the file reader and the merge schedule live in
// enclosure-rows.ts, which has no pdf-lib dependency, so page.tsx and
// the section components import them statically without pulling
// pdf-lib into the initial load (B.4, HARDENING_PLAN_2026-09).
// Re-exported here so the dynamic importers keep one module to await.
export * from '@/lib/enclosure-rows';

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
      pages.forEach((page) => {
        merged.addPage(page);
        if (!options.coverPages) stampEnclosureNumber(page, font, number);
      });
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
