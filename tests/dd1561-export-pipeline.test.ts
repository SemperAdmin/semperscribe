/**
 * The DD 1561 pipeline entry fills the real form for the live preview and
 * the export, and has the NAVMC 11106 failure contract: a failed fill throws
 * on the export path and degrades to the notice page only in preview mode.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { PDFDocument } from 'pdf-lib';
import type { FormData } from '@/types';
import { DD1561_FIELDS } from '@/lib/dd1561-fields';
import { generatePdfForDocType } from '@/services/export/pdfPipelineService';
import { DD1561_SAMPLE_T, DD1561_SAMPLE_T5 } from './fixtures/dd1561-samples';

const here = dirname(fileURLToPath(import.meta.url));
const loadAssetBytes = vi.hoisted(() => vi.fn());
vi.mock('@/lib/assets', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/assets')>()),
  loadAssetBytes,
}));
// Pin the registration this pipeline relies on, whether or not the guided
// UI's DOCUMENT_TYPES entry is in place yet.
vi.mock('@/lib/schemas', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/schemas')>();
  const entry = (real.DOCUMENT_TYPES as Record<string, { features?: object }>).dd1561 ?? {};
  return {
    ...real,
    DOCUMENT_TYPES: { ...real.DOCUMENT_TYPES, dd1561: { ...entry, features: { ...entry.features, pdfPipeline: 'dd1561' } } },
  };
});

const realBlank = async (p: string) => new Uint8Array(readFileSync(resolve(here, '../public', p)));
const ctx = (formData: FormData, mode?: 'preview' | 'export') => ({
  formData, vias: [], references: [], enclosures: [], copyTos: [], paragraphs: [], ...(mode ? { mode } : {}),
});

beforeEach(() => {
  loadAssetBytes.mockReset();
  loadAssetBytes.mockImplementation(realBlank);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('DD 1561 pipeline', () => {
  it('previews the real filled form, not the notice page', async () => {
    const blob = await generatePdfForDocType(ctx(DD1561_SAMPLE_T, 'preview'));
    const pdf = await PDFDocument.load(new Uint8Array(await blob.arrayBuffer()));
    expect(pdf.getPageCount()).toBe(1);
    const form = pdf.getForm();
    expect(form.getFields().length).toBeGreaterThan(40);
    expect(form.getTextField(DD1561_FIELDS.memberName).getText()).toBe('MARINE, TEST A');
    expect(loadAssetBytes).toHaveBeenCalledWith('forms/dd-1561-blank.pdf');
  });

  it('exports the form plus the continuation page past three FSA-T rows', async () => {
    const blob = await generatePdfForDocType(ctx(DD1561_SAMPLE_T5, 'export'));
    const pdf = await PDFDocument.load(new Uint8Array(await blob.arrayBuffer()));
    expect(pdf.getPageCount()).toBe(2);
  });

  it('throws on the default path and in export mode when the fill fails', async () => {
    loadAssetBytes.mockRejectedValue(new Error('blank missing'));
    await expect(generatePdfForDocType(ctx(DD1561_SAMPLE_T))).rejects.toThrow(/blank missing/);
    await expect(generatePdfForDocType(ctx(DD1561_SAMPLE_T, 'export'))).rejects.toThrow(/blank missing/);
  });

  it('returns the one-page notice in preview mode when the fill fails', async () => {
    loadAssetBytes.mockRejectedValue(new Error('blank missing'));
    const blob = await generatePdfForDocType(ctx(DD1561_SAMPLE_T, 'preview'));
    const pdf = await PDFDocument.load(new Uint8Array(await blob.arrayBuffer()));
    expect(pdf.getPageCount()).toBe(1);
    expect(pdf.getForm().getFields()).toHaveLength(0);
  });
});
