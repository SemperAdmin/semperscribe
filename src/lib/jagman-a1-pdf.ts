/**
 * Renders a JAGMAN Appendix A-1 form to PDF.
 *
 * These appendices are FIXED WIDTH. Their column alignment and their
 * underscore rules only line up in a monospace face, so this renders in
 * Courier and never in the proportional faces the letter pipeline uses.
 * Handing this text to a Times renderer produces a page where the CO, ACC,
 * and WIT column drifts and the signature rules stop meeting their labels.
 *
 * THE LAYOUT ITSELF NOW LIVES IN monospace-pdf.ts, extracted 2026-08-26 when
 * the unit diary worksheet became a second caller with the same needs and
 * none of the JAGMAN vocabulary. What is left here is the appendix half:
 * which citation goes in the head, which designator goes in the foot, and
 * which instruction is the source. The generic names are re-exported so a
 * caller reaching for the layout through this module still finds it.
 *
 * Page furniture. The extractor stripped the instruction's own running head
 * and page footers, because its pagination has nothing to do with this
 * one. Equivalents go back on here: a reader holding a printed copy needs to
 * know which appendix it is and which edition it came from, and the original
 * carried exactly that.
 */

import type { JagmanAppendix } from '@/lib/jagman-appendix-a1';
import { JAGMAN_A1_SOURCE, jagmanCitation } from '@/lib/jagman-appendix-a1';
import {
  MonospaceRenderError,
  renderMonospacePdf,
  type MonospacePdfResult,
} from '@/lib/monospace-pdf';

export {
  deriveBodySize,
  linesPerPage,
  sanitizeForCourier,
} from '@/lib/monospace-pdf';

export interface RenderAppendixPdfOptions {
  /** Overrides the derived body size. Use only to match an existing print. */
  bodySize?: number;
  /** Adds a line above the citation, for instance the accused's name. */
  caption?: string;
}

/**
 * KEPT AS A NAME rather than replaced by MonospaceRenderError, because the
 * error a caller catches is part of this module's contract and three test
 * files import it. It IS the generic error: an alias, not a subclass, so a
 * `catch (e) { if (e instanceof JagmanA1RenderError) }` still fires on what
 * the layout throws.
 */
export const JagmanA1RenderError = MonospaceRenderError;
export type JagmanA1RenderError = MonospaceRenderError;

export type AppendixPdfResult = MonospacePdfResult;

/**
 * Renders `lines` as the given appendix.
 *
 * `lines` is what a generator returned, NOT `appendix.text`. The appendix
 * carries the designator, the title, and the citation for the furniture.
 */
export async function renderAppendixPdf(
  appendix: JagmanAppendix,
  lines: readonly string[],
  options?: RenderAppendixPdfOptions,
): Promise<AppendixPdfResult> {
  return renderMonospacePdf(lines, {
    title: `${appendix.designator} ${appendix.title}`,
    subject: jagmanCitation(appendix.designator),
    header: jagmanCitation(appendix.designator),
    footerLeft: appendix.designator,
    footerRight: JAGMAN_A1_SOURCE.instruction,
    caption: options?.caption,
    bodySize: options?.bodySize,
  });
}
