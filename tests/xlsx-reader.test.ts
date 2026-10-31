/**
 * Excel (.xlsx) rosters for Batch Generate. The two fixtures come from two
 * producers (tests/fixtures/xlsx/make-fixtures.py): openpyxl, with inline
 * strings, real date cells, a Text-formatted EDIPI and a second sheet, and
 * LibreOffice Calc, with shared strings and an office suite's own styles.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import JSZip from 'jszip';
import { parseXlsx } from '@/lib/xlsx-reader';
import { applyMergeRecord, defaultMergeFormKeys, detectMergeFields, mergedRowProblems, validateCsvColumns } from '@/lib/merge-utils';
import { useBatchGenerate } from '@/hooks/useBatchGenerate';
import { renderHook } from '@testing-library/react';
import type { FormData } from '@/types';

const FIXTURES = join(__dirname, 'fixtures', 'xlsx');
// Copied into this realm's ArrayBuffer: a Node Buffer's backing store is a
// different realm's ArrayBuffer, which jszip under jsdom does not accept
// (a browser File's arrayBuffer() has no such mismatch).
const fixture = (name: string) => new Uint8Array(readFileSync(join(FIXTURES, name))).buffer as ArrayBuffer;

/** A minimal workbook built part by part, for the cases the fixtures do not cover. */
async function workbook(sheetXml: string, extra: Record<string, string> = {}): Promise<ArrayBuffer> {
  const zip = new JSZip();
  zip.file('xl/workbook.xml',
    '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
    + (extra.workbookPr ?? '') + '<sheets><sheet name="S" sheetId="1" r:id="rId1"/></sheets></workbook>');
  zip.file('xl/_rels/workbook.xml.rels',
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="worksheet" Target="worksheets/sheet1.xml"/></Relationships>');
  zip.file('xl/worksheets/sheet1.xml',
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${sheetXml}</sheetData></worksheet>`);
  if (extra.styles) zip.file('xl/styles.xml', extra.styles);
  return zip.generateAsync({ type: 'arraybuffer' });
}

let page11: Awaited<ReturnType<typeof parseXlsx>>;
let counseling: Awaited<ReturnType<typeof parseXlsx>>;
beforeAll(async () => {
  page11 = await parseXlsx(fixture('page11-roster.xlsx'));
  counseling = await parseXlsx(fixture('counseling-roster.xlsx'));
});

describe('Excel roster written by openpyxl (Page 11)', () => {
  it('reads the first sheet\'s header and skips the blank row and the second sheet', () => {
    expect(page11.errors).toEqual([]);
    expect(page11.headers).toEqual(['NAME', 'EDIPI', 'DATE', 'ENTRY']);
    expect(page11.rows.map((r) => r.NAME)).toEqual(['DOE, JOHN M.', 'SMITH, JANE A.', 'ROE, RICHARD']);
  });

  it('reads a General-cell EDIPI as its digits and keeps a Text-cell EDIPI\'s leading zero', () => {
    expect(page11.rows[0].EDIPI).toBe('1234567890');
    expect(page11.rows[1].EDIPI).toBe('0987654321');
  });

  it('passes an EDIPI that lost its leading zero through for the row check to refuse', () => {
    expect(page11.rows[2].EDIPI).toBe('987654321');
    const template = { documentType: 'page11', name: '', edipi: '', remarksLeft: 'Entry.', remarksRight: '' } as FormData;
    const fields = detectMergeFields(template, [], defaultMergeFormKeys('page11'));
    const { formData } = applyMergeRecord(template, [], page11.rows[2], fields);
    expect(mergedRowProblems(formData).join(' ')).toMatch(/EDIPI "987654321" is not a 10-digit DoD ID/);
  });

  it('reads date cells as the app\'s naval date', () => {
    expect(page11.rows.map((r) => r.DATE)).toEqual(['1 Mar 26', '2 Mar 26', '31 Dec 26']);
  });

  it('keeps a multi-line cell whole and an empty cell empty', () => {
    expect(page11.rows[0].ENTRY).toBe('First paragraph.\n\nSecond paragraph.');
    expect(page11.rows[2].ENTRY).toBe('');
  });
});

describe('Excel roster saved by LibreOffice Calc (Counseling)', () => {
  it('reads shared strings and numbers into the counseling columns', () => {
    expect(counseling.errors).toEqual([]);
    expect(counseling.headers).toEqual(['LAST_NAME', 'FIRST_NAME', 'MI', 'GRADE', 'EDIPI', 'DOR']);
    expect(counseling.rows[0]).toEqual({
      LAST_NAME: 'DOE', FIRST_NAME: 'JOHN', MI: 'M', GRADE: 'LCpl', EDIPI: '1234567890', DOR: '06/01/2026',
    });
    const template = { documentType: 'counseling', date: '2 Nov 26', counselingOccasion: 'initial' } as FormData;
    const fields = detectMergeFields(template, [], defaultMergeFormKeys('counseling'));
    expect(validateCsvColumns(counseling.headers, fields).valid).toBe(true);
    const { formData } = applyMergeRecord(template, [], counseling.rows[1], fields);
    expect(formData.counselingMarineGrade).toBe('E-5');
    expect(mergedRowProblems(formData)).toEqual([]);
  });
});

describe('Excel edge cases', () => {
  it('fills a skipped cell with empty text and keeps later columns in place', async () => {
    const result = await parseXlsx(await workbook(
      '<row r="1"><c r="A1" t="inlineStr"><is><t>NAME</t></is></c><c r="B1" t="inlineStr"><is><t>EDIPI</t></is></c><c r="C1" t="inlineStr"><is><t>RANK</t></is></c></row>'
      + '<row r="2"><c r="A2" t="inlineStr"><is><t>DOE</t></is></c><c r="C2" t="inlineStr"><is><t>Cpl</t></is></c></row>',
    ));
    expect(result.rows).toEqual([{ NAME: 'DOE', EDIPI: '', RANK: 'Cpl' }]);
  });

  it('reports and skips a row with a value past the last header', async () => {
    const result = await parseXlsx(await workbook(
      '<row r="1"><c r="A1" t="inlineStr"><is><t>NAME</t></is></c></row>'
      + '<row r="2"><c r="A2" t="inlineStr"><is><t>DOE</t></is></c><c r="B2"><v>5</v></c></row>'
      + '<row r="3"><c r="A3" t="inlineStr"><is><t>ROE</t></is></c></row>',
    ));
    expect(result.rows).toEqual([{ NAME: 'ROE' }]);
    expect(result.errors).toEqual(['Row 2: has values past the last column header. Skipping.']);
  });

  it('reads a built-in date format and the 1904 date system', async () => {
    const styles = '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cellXfs count="2"><xf numFmtId="0"/><xf numFmtId="14"/></cellXfs></styleSheet>';
    const sheet = '<row r="1"><c r="A1" t="inlineStr"><is><t>DATE</t></is></c></row><row r="2"><c r="A2" s="1"><v>46082</v></c></row>';
    expect((await parseXlsx(await workbook(sheet, { styles }))).rows[0].DATE).toBe('1 Mar 26');
    const in1904 = await parseXlsx(await workbook(sheet.replace('46082', String(46082 - 1462)), { styles, workbookPr: '<workbookPr date1904="1"/>' }));
    expect(in1904.rows[0].DATE).toBe('1 Mar 26');
  });

  it('refuses a file that is not a workbook, with a way forward', async () => {
    const result = await parseXlsx(new TextEncoder().encode('NAME,EDIPI\nDOE,1234567890\n').buffer as ArrayBuffer);
    expect(result.rows).toEqual([]);
    expect(result.errors[0]).toMatch(/not a readable \.xlsx file.*CSV UTF-8/);
  });

  it('needs a header row and a data row', async () => {
    const result = await parseXlsx(await workbook('<row r="1"><c r="A1" t="inlineStr"><is><t>NAME</t></is></c></row>'));
    expect(result.errors).toEqual(['The first sheet must have a header row and at least one data row.']);
  });
});

describe('Batch Generate import', () => {
  it('routes an .xlsx file to the workbook reader and refuses an old .xls', async () => {
    const { result } = renderHook(() => useBatchGenerate());
    const bytes = readFileSync(join(FIXTURES, 'page11-roster.xlsx'));
    const xlsx = await result.current.importCsv(new File([bytes], 'Roster.XLSX'));
    expect(xlsx.rows).toHaveLength(3);
    const xls = await result.current.importCsv(new File([bytes], 'roster.xls'));
    expect(xls.errors[0]).toMatch(/\.xls\) is not read/);
    const csv = await result.current.importCsv(new File(['NAME,EDIPI\nDOE,1234567890\n'], 'roster.csv'));
    expect(csv.rows).toEqual([{ NAME: 'DOE', EDIPI: '1234567890' }]);
  });
});
