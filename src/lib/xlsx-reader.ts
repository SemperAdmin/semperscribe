/**
 * Excel (.xlsx) roster reader for Batch Generate.
 *
 * An .xlsx file is a ZIP of XML parts (ECMA-376 / ISO/IEC 29500). This
 * reads the first worksheet into the same shape parseCsv returns, with
 * jszip (already loaded by the batch) and the browser's DOMParser, so no
 * spreadsheet library ships with the app. Cell values come back as text:
 * shared and inline strings as written, numbers as stored (an EDIPI typed
 * into a General cell is the number 1234567890, which reads "1234567890",
 * and one that lost its leading zero reads as it is, for the row check to
 * refuse), and date cells in the app's "D Mmm YY".
 */

import type { CsvParseResult } from '@/lib/merge-utils';

const MAX_BYTES = 10 * 1024 * 1024;
const MAX_ROWS = 5000;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Built-in number formats that display a date (ECMA-376 Part 1, 18.8.30). */
const BUILTIN_DATE_FORMATS = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 45, 46, 47]);

const fail = (message: string): CsvParseResult => ({ headers: [], rows: [], errors: [message] });

/** Elements by local name, whatever namespace prefix the producer used. */
function elements(parent: Document | Element, name: string): Element[] {
  return Array.from(parent.getElementsByTagNameNS('*', name));
}

function parseXml(text: string): Document | null {
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  return doc.getElementsByTagName('parsererror').length > 0 ? null : doc;
}

/** The text of a shared or inline string: every <t>, phonetic runs (<rPh>) left out. */
function stringItemText(si: Element): string {
  return elements(si, 't')
    .filter(t => t.parentElement?.localName !== 'rPh')
    .map(t => t.textContent ?? '')
    .join('');
}

/** "AB12" -> 27 (zero-based column of the cell reference). */
function columnIndex(ref: string): number {
  const letters = /^[A-Z]+/i.exec(ref)?.[0].toUpperCase() ?? '';
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

/** A custom number format that shows a date or time (d, m, y, h or s outside quotes and brackets). */
function isDateFormatCode(code: string): boolean {
  const bare = code.replace(/"[^"]*"/g, '').replace(/\[[^\]]*\]/g, '').replace(/\\./g, '');
  return /[dmyhs]/i.test(bare) && !/^general$/i.test(bare.trim());
}

/** An Excel date serial as the app's naval date, "1 Mar 26". */
function serialToNavalDate(serial: number, date1904: boolean): string {
  // 1900 system: day 0 is 30 Dec 1899 once Excel's phantom 29 Feb 1900 is
  // behind it, which is every date a roster holds.
  const epoch = date1904 ? Date.UTC(1904, 0, 1) : Date.UTC(1899, 11, 30);
  const d = new Date(epoch + Math.floor(serial) * 86_400_000);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${String(d.getUTCFullYear()).slice(-2)}`;
}

/** Path of the first worksheet, resolved through the workbook's relationships. */
function firstSheetPath(workbook: Document, rels: Document | null): string {
  const sheet = elements(workbook, 'sheet')[0];
  const rid = sheet?.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id')
    ?? sheet?.getAttribute('r:id');
  const rel = rels ? elements(rels, 'Relationship').find(r => r.getAttribute('Id') === rid) : undefined;
  const target = rel?.getAttribute('Target');
  if (!target) return 'xl/worksheets/sheet1.xml';
  return target.startsWith('/') ? target.slice(1) : `xl/${target.replace(/^\.\//, '')}`;
}

/**
 * Read the first worksheet of an .xlsx file. The first non-empty row is
 * the header; empty rows are skipped; a row with values past the last
 * header is reported and skipped, as parseCsv does with a column count
 * that does not match. Row numbers in errors are the sheet's own.
 */
export async function parseXlsx(data: ArrayBuffer): Promise<CsvParseResult> {
  if (data.byteLength > MAX_BYTES) return fail('The Excel file is larger than 10 MB. Save the roster sheet on its own and try again.');

  const { default: JSZip } = await import('jszip');
  let zip: InstanceType<typeof JSZip>;
  try {
    zip = await JSZip.loadAsync(data);
  } catch {
    return fail('This is not a readable .xlsx file. In Excel, use File > Save As > Excel Workbook (.xlsx) or CSV UTF-8.');
  }
  const read = async (path: string) => {
    const file = zip.file(path);
    return file ? parseXml(await file.async('string')) : null;
  };

  const workbook = await read('xl/workbook.xml');
  if (!workbook) return fail('This .xlsx file has no workbook part. Save it again from Excel as an Excel Workbook (.xlsx).');
  const date1904 = ['1', 'true'].includes(elements(workbook, 'workbookPr')[0]?.getAttribute('date1904') ?? '');
  const sheet = await read(firstSheetPath(workbook, await read('xl/_rels/workbook.xml.rels')));
  if (!sheet) return fail('The first sheet of this .xlsx file could not be read.');

  const shared = (await read('xl/sharedStrings.xml'));
  const sharedStrings = shared ? elements(shared, 'si').map(stringItemText) : [];

  // Which cell styles (the s attribute) display a date.
  const styles = await read('xl/styles.xml');
  const dateStyles = new Set<number>();
  if (styles) {
    const custom = new Map(elements(styles, 'numFmt').map(f => [Number(f.getAttribute('numFmtId')), f.getAttribute('formatCode') ?? '']));
    const cellXfs = elements(styles, 'cellXfs')[0];
    const xfs = cellXfs ? Array.from(cellXfs.children).filter(x => x.localName === 'xf') : [];
    xfs.forEach((xf, i) => {
      const id = Number(xf.getAttribute('numFmtId') ?? 0);
      if (BUILTIN_DATE_FORMATS.has(id) || (custom.has(id) && isDateFormatCode(custom.get(id)!))) dateStyles.add(i);
    });
  }

  const cellText = (c: Element): string => {
    const type = c.getAttribute('t') ?? 'n';
    const v = elements(c, 'v')[0]?.textContent ?? '';
    if (type === 's') return sharedStrings[Number(v)] ?? '';
    if (type === 'inlineStr') {
      const is = elements(c, 'is')[0];
      return is ? stringItemText(is) : '';
    }
    if (type === 'b') return v === '1' ? 'TRUE' : 'FALSE';
    if (type === 'n' && v !== '' && dateStyles.has(Number(c.getAttribute('s') ?? 0))) {
      const serial = Number(v);
      if (Number.isFinite(serial)) return serialToNavalDate(serial, date1904);
    }
    return v; // number as stored, formula string (str), error (e)
  };

  const grid: { rowNumber: number; values: string[] }[] = [];
  for (const row of elements(sheet, 'row')) {
    const values: string[] = [];
    let next = 0;
    for (const c of Array.from(row.children).filter(e => e.localName === 'c')) {
      const ref = c.getAttribute('r');
      const col = ref ? columnIndex(ref) : next;
      values[col] = cellText(c);
      next = col + 1;
    }
    const filled = Array.from(values, v => v ?? '');
    if (filled.some(v => v.trim() !== '')) {
      grid.push({ rowNumber: Number(row.getAttribute('r')) || grid.length + 1, values: filled });
    }
    if (grid.length > MAX_ROWS + 1) return fail(`The roster has more than ${MAX_ROWS} rows. Split it into smaller batches.`);
  }

  if (grid.length < 2) {
    return fail('The first sheet must have a header row and at least one data row.');
  }

  const headerRow = grid[0].values;
  let width = headerRow.length;
  while (width > 0 && headerRow[width - 1].trim() === '') width--;
  const headers = headerRow.slice(0, width).map(h => h.trim().toUpperCase());

  const errors: string[] = [];
  const rows: Record<string, string>[] = [];
  for (const { rowNumber, values } of grid.slice(1)) {
    if (values.slice(width).some(v => v.trim() !== '')) {
      errors.push(`Row ${rowNumber}: has values past the last column header. Skipping.`);
      continue;
    }
    const record: Record<string, string> = {};
    headers.forEach((h, i) => { record[h] = values[i] ?? ''; });
    rows.push(record);
  }
  return { headers, rows, errors };
}
