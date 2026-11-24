/**
 * DD 1561 (DEC 2017) fill and export (spec Q phase 4). Fills the real blank
 * for an FSA-T, FSA-R and FSA-S sample, reloads it with pdf-lib, and checks
 * the owner's rules: EDIPI never SSN, DDMMYY dates, one type box, was /
 * was-not exclusivity, both /Sig fields untouched, 15a-c / 16 only when
 * typed, unflattened, explicit font sizes, and the block 10 continuation page.
 */
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { PDFDocument, PDFName, PDFTextField, PDFCheckBox, PDFSignature, type PDFForm } from 'pdf-lib';
import type { FormData } from '@/types';
import { DD1561_FIELDS as F, DD1561_FSA_R as R, DD1561_FSA_T_ROWS as T, DD1561_ALL_FIELD_NAMES } from '@/lib/dd1561-fields';
import { exportDd1561Form, exportDd1561FormWithReport, dd1561ContinuationRows, DD1561_CONTINUATION_TITLE } from '@/lib/dd1561-export';
import { DD1561_SAMPLE_T, DD1561_SAMPLE_T5, DD1561_SAMPLE_R, DD1561_SAMPLE_S } from './fixtures/dd1561-samples';

const here = dirname(fileURLToPath(import.meta.url));
const loadAssetBytes = vi.hoisted(() => vi.fn());
vi.mock('@/lib/assets', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/assets')>()),
  loadAssetBytes,
}));
loadAssetBytes.mockImplementation(async (p: string) => new Uint8Array(readFileSync(resolve(here, '../public', p))));

async function fill(data: FormData) {
  const blob = await exportDd1561Form(data);
  expect(blob.type).toBe('application/pdf');
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const pdf = await PDFDocument.load(bytes);
  return { pdf, form: pdf.getForm(), bytes };
}

const text = (form: PDFForm, name: string) => form.getTextField(name).getText() ?? '';
const checked = (form: PDFForm, name: string) => form.getCheckBox(name).isChecked();
const TYPE_BOXES = [F.typeFsaT, F.typeFsaR, F.typeFsaS];

function commonAssertions(form: PDFForm) {
  // Not flattened: every mapped field is still there.
  for (const name of DD1561_ALL_FIELD_NAMES) expect(form.getFieldMaybe(name), name).toBeDefined();
  // Exactly one type box; each was / was-not pair at most one.
  expect(TYPE_BOXES.filter((n) => checked(form, n))).toHaveLength(1);
  expect([F.cert8fSpouseWas, F.cert8fSpouseWasNot].filter((n) => checked(form, n)).length).toBeLessThanOrEqual(1);
  expect([F.cert8gLastTdyWas, F.cert8gLastTdyWasNot].filter((n) => checked(form, n)).length).toBeLessThanOrEqual(1);
  // Signatures: still /Sig fields, no value, nothing signed.
  for (const name of [F.memberSignature, F.certifierSignature]) {
    const sig = form.getField(name);
    expect(sig).toBeInstanceOf(PDFSignature);
    expect(sig.acroField.dict.get(PDFName.of('V'))).toBeUndefined();
  }
  // Every text field has an explicit, non-zero font size in its /DA.
  for (const field of form.getFields()) {
    if (!(field instanceof PDFTextField)) continue;
    const da = field.acroField.getDefaultAppearance() ?? '';
    const size = /\/\S+\s+(\d*\.?\d+)\s+Tf/.exec(da);
    expect(size, `${field.getName()} DA "${da}"`).not.toBeNull();
    expect(Number(size![1])).toBeGreaterThanOrEqual(5);
    expect(Number(size![1])).toBeLessThanOrEqual(9);
  }
  // Nothing shaped like an SSN in any value.
  for (const field of form.getFields()) {
    if (!(field instanceof PDFTextField)) continue;
    expect(field.getText() ?? '', field.getName()).not.toMatch(/(?<!\d)(\d{3}-\d{2}-\d{4}|\d{9})(?!\d)/);
  }
}

describe('exportDd1561Form - FSA-T', () => {
  it('fills members blocks, block 10 rows 1-3 and the right boxes', async () => {
    const { pdf, form } = await fill(DD1561_SAMPLE_T);
    commonAssertions(form);
    expect(pdf.getPageCount()).toBe(1);
    expect(text(form, F.memberName)).toBe('MARINE, TEST A');
    expect(text(form, F.grade)).toBe('SGT');
    expect(text(form, F.dodId)).toBe('1234567890');
    expect(text(form, F.dependentAddresses)).toBe('123 MAIN ST, OCEANSIDE CA 92054\n45 ELM AVE, SAN DIEGO CA 92101');
    expect(text(form, F.memberSignedDate)).toBe('201126');
    expect(checked(form, F.typeFsaT)).toBe(true);
    expect(checked(form, F.cert8a)).toBe(true);
    expect(checked(form, F.cert8e)).toBe(false);
    expect(checked(form, F.cert8g)).toBe(true);
    expect(checked(form, F.cert8gLastTdyWasNot)).toBe(true);
    expect(checked(form, F.cert8gLastTdyWas)).toBe(false);
    expect(text(form, T[0].location)).toBe('MCAGCC TWENTYNINE PALMS CA');
    expect(text(form, T[0].inclusiveDates)).toBe('050126 - 310126');
    expect(text(form, T[0].days)).toBe('27');
    expect(text(form, T[2].inclusiveDates)).toBe('210226 - 100326');
    expect(text(form, F.ordersAuthority)).toBe('CG 1ST MARDIV TAD ORDERS 0456-26');
    expect(text(form, F.ordersDated)).toBe('020126');
    // Other types' blocks empty.
    expect(text(form, R.lastPermanentDutyStation)).toBe('');
    expect(text(form, F.fsaSShipUnit)).toBe('');
    // 15a-c / 16 were not typed: empty.
    for (const n of [F.certifierName, F.certifierTitle, F.certifierOrganization, F.certifiedDate]) expect(text(form, n)).toBe('');
  });

  it('keeps the form check-box appearance (the /1 cross), with no pdf-lib redraw', async () => {
    const { form } = await fill(DD1561_SAMPLE_T);
    const box = form.getField(F.typeFsaT) as PDFCheckBox;
    const w = box.acroField.getWidgets()[0];
    expect(w.getAppearanceState()?.toString()).toBe('/1');
    expect(box.acroField.dict.get(PDFName.of('V'))?.toString()).toBe('/1');
    const off = form.getField(F.typeFsaR) as PDFCheckBox;
    expect(off.acroField.getWidgets()[0].getAppearanceState()?.toString()).toBe('/Off');
  });

  it('sets a fixed size on block 7 (multi-line) small enough for two lines', async () => {
    const { form } = await fill(DD1561_SAMPLE_T);
    const f = form.getTextField(F.dependentAddresses);
    expect(f.isMultiline()).toBe(true);
    const size = Number(/(\d*\.?\d+)\s+Tf/.exec(f.acroField.getDefaultAppearance() ?? '')![1]);
    expect(size).toBeGreaterThanOrEqual(7);
    expect(size).toBeLessThanOrEqual(8);
  });

  it('joins three or more one-per-line addresses with "; " rather than print them at 5 pt', async () => {
    const addresses = '1234 PACIFIC COAST HWY APT 56, OCEANSIDE CA 92054\n45 ELM AVE, SAN DIEGO CA 92101\n789 OAK LN, TEMECULA CA 92590';
    const { form } = await fill({ ...DD1561_SAMPLE_T, dd1561DependentAddresses: addresses } as unknown as FormData);
    const f = form.getTextField(F.dependentAddresses);
    expect(f.getText()).toBe(addresses.split('\n').join('; '));
    expect(Number(/(\d*\.?\d+)\s+Tf/.exec(f.acroField.getDefaultAppearance() ?? '')![1])).toBeGreaterThanOrEqual(7);
  });

  it('adds no continuation page for three rows', async () => {
    const r = await exportDd1561FormWithReport(DD1561_SAMPLE_T);
    expect(r.continuationPages).toBe(0);
    expect(dd1561ContinuationRows(DD1561_SAMPLE_T)).toHaveLength(0);
  });

  it('appends one continuation page for rows 4 and 5, same page size, rows 1-3 on the form', async () => {
    const { pdf, form, bytes } = await fill(DD1561_SAMPLE_T5);
    commonAssertions(form);
    expect(pdf.getPageCount()).toBe(2);
    expect(pdf.getPage(1).getSize()).toEqual(pdf.getPage(0).getSize());
    expect(text(form, T[2].location)).toBe('FORT IRWIN CA');
    const contentText = await pageText(bytes, 2);
    expect(contentText).toContain(DD1561_CONTINUATION_TITLE);
    expect(contentText).toContain('MARINE, TEST A');
    expect(contentText).toContain('1234567890');
    expect(contentText).toContain('MCB CAMP LEJEUNE NC');
    expect(contentText).toContain('110326 - 300326');
    expect(contentText).toContain('MCAS BEAUFORT SC');
    expect(contentText).toContain('310326 - 150426');
    // Static text, not fields: the continuation adds no field.
    expect(form.getFields().length).toBe((await PDFDocument.load(new Uint8Array(readFileSync(resolve(here, '../public/forms/dd-1561-blank.pdf'))))).getForm().getFields().length);
    const r = await exportDd1561FormWithReport(DD1561_SAMPLE_T5);
    expect(r.continuationRows).toBe(2);
    expect(r.continuationPages).toBe(1);
  });

  it('paginates a long continuation', async () => {
    const rows = Array.from({ length: 60 }, (_, i) => {
      const d = (n: number) => new Date(Date.UTC(2026, 0, 1 + n)).toISOString().slice(0, 10);
      return { location: `SITE ${i + 1}`, from: d(i * 2), to: d(i * 2 + 1) };
    });
    const r = await exportDd1561FormWithReport({ ...DD1561_SAMPLE_T, dd1561FsaTRows: rows } as unknown as FormData);
    expect(r.continuationRows).toBe(57);
    expect(r.continuationPages).toBeGreaterThan(1);
  });

  it('never prints continuation rows for a non FSA-T type', () => {
    expect(dd1561ContinuationRows({ ...DD1561_SAMPLE_T5, dd1561FsaType: 'R' } as unknown as FormData)).toHaveLength(0);
  });
});

describe('exportDd1561Form - FSA-R', () => {
  it('fills block 11, 8f was, spouse EDIPI and the typed certifier blocks', async () => {
    const { pdf, form } = await fill(DD1561_SAMPLE_R);
    commonAssertions(form);
    expect(pdf.getPageCount()).toBe(1);
    expect(checked(form, F.typeFsaR)).toBe(true);
    expect(checked(form, F.cert8f)).toBe(true);
    expect(checked(form, F.cert8fSpouseWas)).toBe(true);
    expect(checked(form, F.cert8fSpouseWasNot)).toBe(false);
    expect(text(form, F.spouseDodId)).toBe('2345678901');
    expect(text(form, F.spouseBranchComponent)).toBe('USN ACTIVE');
    expect(text(form, R.lastPermanentDutyStation)).toBe('MCB CAMP PENDLETON CA');
    expect(text(form, R.departedDate)).toBe('010626');
    expect(text(form, R.leaveDates)).toBe('020626 - 110626');
    expect(text(form, R.proceedDates)).toBe('120626 - 150626');
    expect(text(form, R.reportedTo)).toBe('MCB CAMP BUTLER OKINAWA JA');
    expect(text(form, R.reportedDate)).toBe('170626');
    expect(text(form, F.certifierName)).toBe('J. A. SMITH');
    expect(text(form, F.certifierTitle)).toBe('ADJUTANT');
    expect(text(form, F.certifierOrganization)).toBe('1ST BN, 5TH MAR');
    expect(text(form, F.certifiedDate)).toBe('211126');
    for (const row of T) expect(text(form, row.location)).toBe('');
  });
});

describe('exportDd1561Form - FSA-S', () => {
  it('fills block 12 and 8g was', async () => {
    const { pdf, form } = await fill(DD1561_SAMPLE_S);
    commonAssertions(form);
    expect(pdf.getPageCount()).toBe(1);
    expect(checked(form, F.typeFsaS)).toBe(true);
    expect(checked(form, F.cert8gLastTdyWas)).toBe(true);
    expect(checked(form, F.cert8gLastTdyWasNot)).toBe(false);
    expect(text(form, F.fsaSCommencingDate)).toBe('010326');
    expect(text(form, F.fsaSShipUnit)).toBe('USS AMERICA (LHA 6) / 31ST MEU');
    expect(text(form, F.fsaSHomeport)).toBe('SASEBO JA');
    expect(text(form, F.certifierName)).toBe('');
  });
});

describe('exportDd1561Form refusals', () => {
  it('never prints an SSN typed as the EDIPI', async () => {
    const { form } = await fill({ ...DD1561_SAMPLE_T, dd1561Edipi: '123-45-6789' } as unknown as FormData);
    expect(text(form, F.dodId)).toBe('');
  });

  it('refuses an SSN-shaped value in free text', async () => {
    await expect(exportDd1561Form({ ...DD1561_SAMPLE_T, dd1561DependentAddresses: 'SSN 123-45-6789' } as unknown as FormData))
      .rejects.toThrow(/DD 1561 cannot be exported\. Block 7 Dependent address\(es\): .*Social Security number/);
  });

  it('refuses a character the form cannot print', async () => {
    await expect(exportDd1561Form({ ...DD1561_SAMPLE_T, dd1561MemberName: 'NGUYỄN, AN' } as unknown as FormData))
      .rejects.toThrow(/Block 1 Name: "Ễ" is not a character the form can print/);
  });

  it('shrinks a long value to fit, and refuses one that cannot fit', async () => {
    const { form } = await fill({ ...DD1561_SAMPLE_T, dd1561Grade: 'GYSGT E-7' } as unknown as FormData);
    expect(text(form, F.grade)).toBe('GYSGT E-7');
    await expect(exportDd1561Form({ ...DD1561_SAMPLE_T, dd1561Grade: 'G'.repeat(60) } as unknown as FormData))
      .rejects.toThrow(/Block 2 Grade: .*Shorten it/);
  });
});

/** Text drawn on a page, via pdf.js-free decoding of the content stream's literal strings. */
async function pageText(bytes: Uint8Array, pageNumber: number): Promise<string> {
  const { PDFDocument: Doc, PDFRawStream, PDFArray, decodePDFRawStream } = await import('pdf-lib');
  const pdf = await Doc.load(bytes);
  const page = pdf.getPage(pageNumber - 1);
  const contents = page.node.Contents();
  const streams = contents instanceof PDFArray
    ? contents.asArray().map((r) => pdf.context.lookup(r))
    : [contents];
  let out = '';
  for (const s of streams) {
    if (!(s instanceof PDFRawStream)) continue;
    const raw = new TextDecoder('latin1').decode(decodePDFRawStream(s).decode());
    // pdf-lib draws standard-font text as hex strings: <...> Tj
    for (const m of raw.matchAll(/<([0-9A-Fa-f]+)>\s*Tj/g)) {
      out += m[1].match(/../g)!.map((h) => String.fromCharCode(parseInt(h, 16))).join('') + '\n';
    }
  }
  return out;
}
