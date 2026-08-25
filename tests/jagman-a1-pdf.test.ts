/**
 * The fixed-width renderer.
 *
 * The assertion worth the most here is the size derivation, because the
 * failure it prevents is invisible in a substring check: type too large
 * pushes the appendix's own columns off the page, and the text is all still
 * "present."
 */

import { describe, it, expect } from 'vitest';
import { APPENDIX_A_1_C, APPENDIX_A_1_D, APPENDIX_A_1_F } from '@/lib/jagman-appendix-a1';
import {
  deriveBodySize,
  linesPerPage,
  sanitizeForCourier,
  renderAppendixPdf,
  JagmanA1RenderError,
} from '@/lib/jagman-a1-pdf';

const CONTENT_WIDTH = 612 - 72 * 2;
const COURIER_ADVANCE = 0.6;

describe('deriveBodySize keeps the longest line on the page', () => {
  it('fits every real appendix at a readable size', () => {
    for (const appendix of [APPENDIX_A_1_C, APPENDIX_A_1_D, APPENDIX_A_1_F]) {
      const size = deriveBodySize(appendix.text);
      const widest = appendix.text.reduce((m, l) => Math.max(m, l.length), 0);
      expect(widest * size * COURIER_ADVANCE).toBeLessThanOrEqual(CONTENT_WIDTH);
      expect(size).toBeGreaterThanOrEqual(7);
    }
  });

  it('never exceeds the readable maximum', () => {
    expect(deriveBodySize(['short'])).toBe(11);
    expect(deriveBodySize([])).toBe(11);
  });

  // A line this long means a caller wrapped past the appendix measure, which
  // is a bug in the caller rather than a layout problem to shrink around.
  it('throws rather than shrinking past legibility', () => {
    expect(() => deriveBodySize(['x'.repeat(400)])).toThrow(JagmanA1RenderError);
  });

  it('shrinks for a line wider than the maximum size allows', () => {
    const size = deriveBodySize(['x'.repeat(90)]);
    expect(size).toBeLessThan(11);
    expect(90 * size * COURIER_ADVANCE).toBeLessThanOrEqual(CONTENT_WIDTH);
  });
});

describe('linesPerPage', () => {
  it('leaves room for the head and the foot', () => {
    const perPage = linesPerPage(11);
    expect(perPage).toBeGreaterThan(30);
    expect(perPage).toBeLessThan(60);
  });
});

describe('sanitizeForCourier', () => {
  // The instruction's own text carries a curly apostrophe in ACCUSED'S.
  it('keeps the typographic marks WinAnsi carries, reporting nothing', () => {
    const out = sanitizeForCourier(['ACCUSED’S NOTIFICATION', 'a – b …']);
    expect(out.replaced).toEqual([]);
    expect(out.lines[0]).toBe('ACCUSED’S NOTIFICATION');
  });

  it('leaves every real appendix untouched', () => {
    for (const appendix of [APPENDIX_A_1_C, APPENDIX_A_1_D, APPENDIX_A_1_F]) {
      expect(sanitizeForCourier(appendix.text).replaced).toEqual([]);
    }
  });

  // Losing one glyph beats pdf-lib throwing and taking the preview down.
  it('reports anything it has to replace', () => {
    const out = sanitizeForCourier(['temp is 20℃']);
    expect(out.replaced).toHaveLength(1);
    expect(out.lines[0]).toBe('temp is 20?');
  });
});

describe('renderAppendixPdf', () => {
  it('produces a real PDF of the whole appendix', async () => {
    const result = await renderAppendixPdf(APPENDIX_A_1_F, APPENDIX_A_1_F.text);
    expect(result.pageCount).toBeGreaterThan(1);
    expect(result.replaced).toEqual([]);
    const header = new TextDecoder('latin1').decode(result.bytes.slice(0, 5));
    expect(header).toBe('%PDF-');
  });

  it('paginates by the derived size, so every line reaches a page', async () => {
    const result = await renderAppendixPdf(APPENDIX_A_1_C, APPENDIX_A_1_C.text);
    const capacity = result.pageCount * linesPerPage(result.bodySize);
    expect(capacity).toBeGreaterThanOrEqual(APPENDIX_A_1_C.text.length);
    // And not wastefully more than one page of slack.
    expect(capacity - APPENDIX_A_1_C.text.length).toBeLessThan(
      linesPerPage(result.bodySize),
    );
  });

  it('renders an empty document as one page rather than none', async () => {
    const result = await renderAppendixPdf(APPENDIX_A_1_F, []);
    expect(result.pageCount).toBe(1);
  });
});
