/**
 * P3.6 (DONDOCS_PARITY_PLAN) - enclosure PDF attachments.
 *
 * V1 scope, recorded in the plan: attachments are SESSION-SCOPED
 * (not persisted to the document library or .nldp), merge into PDF
 * exports only, in list order, each starting on a new page, with an
 * optional generated cover page per attachment. In-PDF hyperlinks
 * from the enclosure list and DOCX merge are recorded follow-ups.
 */

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

export interface EnclosureAttachment {
  id: string;
  fileName: string;
  /** Title used on the enclosure line and cover page. */
  title: string;
  /** Raw PDF bytes. */
  bytes: ArrayBuffer;
}

export interface MergeOptions {
  /** Insert a generated cover page before each attachment. */
  coverPages: boolean;
  /** First enclosure number (endorsements continue sequences). */
  startingNumber: number;
}

/** Reads a File into an attachment. Rejects non-PDF payloads. */
export async function fileToAttachment(file: File): Promise<EnclosureAttachment> {
  const bytes = await file.arrayBuffer();
  const head = new Uint8Array(bytes.slice(0, 5));
  const magic = String.fromCharCode(...head);
  if (!magic.startsWith('%PDF-')) {
    throw new Error(`"${file.name}" is not a PDF. Only PDF attachments merge into the export.`);
  }
  return {
    id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    fileName: file.name,
    title: file.name.replace(/\.pdf$/i, ''),
    bytes,
  };
}

/**
 * Appends attachments to a base letter PDF. Returns merged bytes.
 * Throws when an attachment fails to parse - the caller reports which.
 */
export async function mergeAttachmentsIntoPdf(
  baseBytes: ArrayBuffer | Uint8Array,
  attachments: EnclosureAttachment[],
  options: MergeOptions,
): Promise<Uint8Array> {
  const merged = await PDFDocument.load(baseBytes);
  const font = await merged.embedFont(StandardFonts.TimesRoman);
  const fontBold = await merged.embedFont(StandardFonts.TimesRomanBold);

  for (let i = 0; i < attachments.length; i++) {
    const attachment = attachments[i];
    const enclosureNumber = options.startingNumber + i;

    if (options.coverPages) {
      const cover = merged.addPage([612, 792]); // LETTER
      const heading = `Enclosure (${enclosureNumber})`;
      const headingWidth = fontBold.widthOfTextAtSize(heading, 16);
      cover.drawText(heading, {
        x: (612 - headingWidth) / 2,
        y: 792 / 2 + 20,
        size: 16,
        font: fontBold,
        color: rgb(0, 0, 0),
      });
      const title = attachment.title;
      const titleWidth = font.widthOfTextAtSize(title, 12);
      cover.drawText(title, {
        x: Math.max(72, (612 - titleWidth) / 2),
        y: 792 / 2 - 8,
        size: 12,
        font,
        color: rgb(0, 0, 0),
        maxWidth: 612 - 144,
      });
    }

    let source: PDFDocument;
    try {
      source = await PDFDocument.load(attachment.bytes, { ignoreEncryption: true });
    } catch {
      throw new Error(`Enclosure (${enclosureNumber}) "${attachment.fileName}" failed to parse as a PDF.`);
    }
    const pages = await merged.copyPages(source, source.getPageIndices());
    pages.forEach((page) => merged.addPage(page));
  }

  return merged.save();
}

/** Moves an attachment within the list. Returns a new array. */
export function moveAttachment(list: EnclosureAttachment[], index: number, direction: -1 | 1): EnclosureAttachment[] {
  const target = index + direction;
  if (index < 0 || index >= list.length || target < 0 || target >= list.length) return list;
  const next = [...list];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}
