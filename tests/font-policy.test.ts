/**
 * P3.1 — archetype font policy (audit gap G7, matrix C1).
 *
 * USMC directives (MCO 5215.1K): Courier New only, 10 or 12 pt.
 * Correspondence (SECNAV M-5216.5): Times preferred, Courier allowed.
 * The resolver coerces at generation time so stale form state cannot
 * leak a non-Courier font into a directive export.
 */
import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import {
  getFontArchetype,
  getAllowedBodyFonts,
  getAllowedFontSizesPt,
  resolveBodyFont,
  resolveHeaderType,
} from '@/lib/font-policy';
import { generateDocxBlob } from '@/lib/docx-generator';
import { FIXTURE_FORM_DATA, FIXTURE_PARAGRAPHS } from './golden/fixture';

describe('font policy map (G7)', () => {
  it.each(['mco', 'bulletin', 'change-transmittal'])(
    '%s is a USMC directive locked to Courier',
    (t) => {
      expect(getFontArchetype(t)).toBe('usmc-directive');
      expect(getAllowedBodyFonts(t)).toEqual(['courier']);
      expect(getAllowedFontSizesPt(t)).toEqual([10, 12]);
    },
  );

  it.each(['basic', 'business-letter', 'executive-correspondence', 'mfr', 'endorsement', 'multiple-address'])(
    '%s is correspondence with free Times/Courier choice',
    (t) => {
      expect(getFontArchetype(t)).toBe('correspondence');
      expect(getAllowedBodyFonts(t)).toEqual(['times', 'courier']);
      expect(getAllowedFontSizesPt(t)).toEqual([12]);
    },
  );

  it('coerces directives to courier regardless of requested font', () => {
    expect(resolveBodyFont('mco', 'times')).toBe('courier');
    expect(resolveBodyFont('bulletin', undefined)).toBe('courier');
    expect(resolveBodyFont('mco', 'courier')).toBe('courier');
  });

  it('passes correspondence through unchanged with times default', () => {
    expect(resolveBodyFont('basic', 'times')).toBe('times');
    expect(resolveBodyFont('basic', 'courier')).toBe('courier');
    expect(resolveBodyFont('basic', undefined)).toBe('times');
    expect(resolveBodyFont('basic', 'comic-sans')).toBe('times');
  });
});

describe('generator-level coercion (stale form state defense)', () => {
  async function bodyFontsIn(extra: Record<string, unknown>): Promise<Set<string>> {
    const blob = await generateDocxBlob(
      { ...FIXTURE_FORM_DATA, ...extra }, [], [], [], [], FIXTURE_PARAGRAPHS, [],
    );
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const xml = await zip.file('word/document.xml')!.async('string');
    return new Set([...xml.matchAll(/w:ascii="([^"]+)"/g)].map((m) => m[1]));
  }

  it('MCO with stale bodyFont=times still emits Courier New only', async () => {
    const fonts = await bodyFontsIn({ documentType: 'mco', bodyFont: 'times', directiveTitle: 'TEST ORDER' });
    expect(fonts.has('Courier New')).toBe(true);
    expect(fonts.has('Times New Roman')).toBe(false);
  });

  it('basic letter with bodyFont=times still emits Times New Roman', async () => {
    const fonts = await bodyFontsIn({ documentType: 'basic', bodyFont: 'times' });
    expect(fonts.has('Times New Roman')).toBe(true);
  });
});

describe('directive letterhead rule (user ruling 2026-06-10)', () => {
  it('coerces DLA letterhead to USMC for directives', () => {
    expect(resolveHeaderType('mco', 'DLA')).toBe('USMC');
    expect(resolveHeaderType('bulletin', 'DLA')).toBe('USMC');
    expect(resolveHeaderType('mco', 'DON')).toBe('DON');
    expect(resolveHeaderType('mco', 'USMC')).toBe('USMC');
  });

  it('correspondence keeps DLA letterhead', () => {
    expect(resolveHeaderType('dla-memorandum', 'DLA')).toBe('DLA');
    expect(resolveHeaderType('basic', 'DLA')).toBe('DLA');
  });

  it('MCO with stale headerType=DLA emits Marine Corps letterhead text', async () => {
    const blob = await generateDocxBlob(
      { ...FIXTURE_FORM_DATA, documentType: 'mco', headerType: 'DLA', directiveTitle: 'TEST ORDER' } as never,
      [], [], [], [], FIXTURE_PARAGRAPHS, [],
    );
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const xml = await zip.file('word/document.xml')!.async('string');
    expect(xml.includes('MARINE CORPS')).toBe(true);
    expect(xml.includes('DEFENSE LOGISTICS AGENCY')).toBe(false);
  });
});
