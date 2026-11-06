import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { PDFDocument } from 'pdf-lib';
import type { FormData } from '@/types';
import { NAVMC_11106_EMPTY_DEPENDENT } from '@/types/navmc';
import { DOCUMENT_TYPES } from '@/lib/schemas';
import { exportNavmc11106Form } from '@/lib/navmc11106-export';

const here = dirname(fileURLToPath(import.meta.url));
vi.mock('@/lib/assets', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/assets')>()),
  loadAssetBytes: vi.fn(async () => new Uint8Array(readFileSync(resolve(here, '../public/forms/navmc-11106-blank.pdf')))),
}));

const P = 'topmostSubform[0].Page1[0].';
const blobBytes = async (b: Blob) => new Uint8Array(await b.arrayBuffer());
const form = (o: Record<string, unknown>) =>
  ({ documentType: 'navmc11106', nameOfMarine: 'MARINE, TEST', grade: 'SGT', edipi: '1234567890', dutyStation: 'OKINAWA JP', ...o }) as unknown as FormData;

describe('exportNavmc11106Form', () => {
  it('fills text and radios and leaves signatures open', async () => {
    const blob = await exportNavmc11106Form(form({
      navmc11106Spouse: { ...NAVMC_11106_EMPTY_DEPENDENT, name: 'MARINE, ALEX', eventDate: '2019-05-04', sponsorshipBasis: 'installation-approval', sponsoredOn: '2026-04-01' },
      dependentsArrived: '2026-06-10',
      d1Quarters: 'y',
      effectiveDate: '2026-06-10',
    }));
    const pdf = await PDFDocument.load(await blobBytes(blob));
    const f = pdf.getForm();
    expect(f.getTextField(`${P}SocSecNoApplc[0]`).getText()).toBe('1234567890');
    expect(f.getTextField(`${P}NameSps1[0]`).getText()).toBe('MARINE, ALEX');
    expect(f.getTextField(`${P}DateDepComnd[0]`).getText()).toBe('2026-04-01');
    expect(f.getRadioGroup(`${P}RadA1[0]`).getSelected()).toBe('both');
    expect(f.getRadioGroup(`${P}RadD1AvailNot[0]`).getSelected()).toBe('y');
    expect(f.getRadioGroup(`${P}RadD2B1[0]`).getSelected()).toBeUndefined();
    expect(f.getSignature(`${P}SigMem[0]`).acroField.getWidgets()).toHaveLength(1);
    expect(f.getSignature(`${P}SigCO[0]`).acroField.getWidgets()).toHaveLength(1);
  });

  it('checks Member Only when no dependents are entered', async () => {
    const pdf = await PDFDocument.load(await blobBytes(await exportNavmc11106Form(form({}))));
    expect(pdf.getForm().getRadioGroup(`${P}RadA1[0]`).getSelected()).toBe('mem');
  });

  it('throws rather than deliver a form missing a value', async () => {
    await expect(exportNavmc11106Form(form({ edipi: '1'.repeat(40) }))).rejects.toThrow(/SocSecNoApplc/);
  });
});

describe('NAVMC 11106 registration', () => {
  it('is a form on the AcroForm pipeline with PDF export only', () => {
    const def = DOCUMENT_TYPES.navmc11106;
    expect(def.features.pdfPipeline).toBe('navmc11106');
    expect(def.features.exportFormats).toEqual(['pdf']);
    expect(def.features.showSignature).toBe(false);
  });

  it('does not put custom-component keys in a DynamicForm section', () => {
    const names = DOCUMENT_TYPES.navmc11106.sections.flatMap((s) => s.fields.map((f) => f.name));
    for (const key of ['navmc11106Spouse', 'navmc11106Dependents', 'dependentsOnly', 'effectiveDate', 'navmc11106Remarks', 'd1Quarters']) {
      expect(names).not.toContain(key);
    }
  });
});
