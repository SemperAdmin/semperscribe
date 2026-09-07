import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import {
  writeNavmc10132Incremental,
  Navmc10132WriteError,
} from '@/lib/navmc10132-incremental-write';
import { readNavmc10132Pdf } from '@/lib/navmc10132-pdf-read';
import type { AcroFormFieldMeta } from '@/lib/acroform-fill';
import fieldMap from '../tools/aa-forms/navmc10132-map.json';

/**
 * Writing the next pass into an already-signed NAVMC 10132.
 *
 * WHAT THESE TESTS CAN AND CANNOT COVER. The mechanics are all here: the
 * delta is appended rather than returned as a document, the prefix survives
 * byte for byte, a written value reads back, and the refusal rules hold.
 * They run against the blank this repo ships, which has no signatures, so
 * nothing here proves a SIGNATURE survives. That cannot be tested from a
 * fixture: a real CAC signature cannot be regenerated, and the file that has
 * one is 5MB of a Marine's personal data.
 *
 * MEASURED BY HAND against the real signed UPB, 2026-08-26, and this is the
 * assertion to write if a signed fixture ever becomes committable:
 *
 *   original            5,144,151 bytes, 2 signatures, 45 fields locked
 *   wrote               items 6, 6-date, 7 and the 1A finding
 *   refused             items 17 and 18, both signature-closed
 *   skipped as empty    item 4
 *   delta                     974 bytes
 *   prefix identical          true
 *   after               2 signatures, 45 locked, still stage 3
 *   /ByteRange count    8 before, 8 after
 *   item 18 after       "THOMPSON, JAMAL R", untouched
 *   item 21 after       untouched, and it is a RichText field
 */

const BLANK = path.resolve(__dirname, '../public/forms/navmc-10132-blank.pdf');
const NO_LOCKS = new Set<string>();

function blank(): Uint8Array {
  return new Uint8Array(readFileSync(BLANK));
}

describe('the update is APPENDED, never a rewrite', () => {
  it('keeps every original byte and adds the delta after them', async () => {
    const original = blank();

    const result = await writeNavmc10132Incremental(
      original,
      { '6 PUNISHMENT IMPOSED': 'REDUCTION TO THE NEXT INFERIOR GRADE' },
      NO_LOCKS,
    );

    expect(result.bytes.length).toBeGreaterThan(original.length);
    // THE LOAD-BEARING ASSERTION. A CAC signature covers a byte range; move
    // one byte before it and the signature no longer covers what it signed,
    // which reads as tampering rather than as a bad export.
    expect(Buffer.compare(Buffer.from(original), Buffer.from(result.bytes.slice(0, original.length)))).toBe(0);
    expect(result.deltaBytes).toBe(result.bytes.length - original.length);
  }, 60000);

  // `saveIncremental` returns ONLY the delta. Returning it as the document
  // produces a sub-kilobyte file that opens as nothing, and the mistake is
  // invisible until someone tries to open it.
  it('returns a whole document, not the sub-kilobyte delta', async () => {
    const result = await writeNavmc10132Incremental(
      blank(),
      { '6 PUNISHMENT IMPOSED': 'RESTRICTION FOR 14 DAYS' },
      NO_LOCKS,
    );

    expect(result.deltaBytes).toBeLessThan(10_000);
    expect(result.bytes.length).toBeGreaterThan(100_000);
  }, 60000);

  it('writes nothing and grows the file by nothing when there is nothing to write', async () => {
    const original = blank();

    const result = await writeNavmc10132Incremental(original, {}, NO_LOCKS);

    expect(result.written).toEqual([]);
    expect(result.deltaBytes).toBe(0);
    expect(result.bytes.length).toBe(original.length);
  }, 60000);
});

describe('what comes back out of the written file', () => {
  it('reads back every field it wrote, across field kinds', async () => {
    const result = await writeNavmc10132Incremental(
      blank(),
      {
        '6 PUNISHMENT IMPOSED': 'REDUCTION TO THE NEXT INFERIOR GRADE',
        '6 PUNISHMENT IMPOSITION DATE': '2026-08-20',
        '1A FINDING': 'Guilty',
        '13 NOT APPEALED': true,
      },
      NO_LOCKS,
    );

    const after = await readNavmc10132Pdf(result.bytes);

    expect(after.values['6 PUNISHMENT IMPOSED']).toBe('REDUCTION TO THE NEXT INFERIOR GRADE');
    expect(after.values['6 PUNISHMENT IMPOSITION DATE']).toBe('2026-08-20');
    expect(after.values['1A FINDING']).toBe('Guilty');
    expect(after.values['13 NOT APPEALED']).toBe('true');
  }, 60000);

  // The failure mode markRefForSave exists to prevent: without it the delta
  // carries a font and an appearance stream and no value. The save succeeds,
  // the file opens, and the field is empty.
  it('does not silently write nothing', async () => {
    const result = await writeNavmc10132Incremental(
      blank(),
      { '8 NJP AUTHORITY NAME TITLE SERVICE': 'CARDENAS, ELENA V' },
      NO_LOCKS,
    );
    const after = await readNavmc10132Pdf(result.bytes);

    expect(after.values['8 NJP AUTHORITY NAME TITLE SERVICE']).toBe('CARDENAS, ELENA V');
  }, 60000);

  it('leaves every field it did not write exactly as it found it', async () => {
    const before = await readNavmc10132Pdf(blank());
    const result = await writeNavmc10132Incremental(
      blank(),
      { '6 PUNISHMENT IMPOSED': 'RESTRICTION FOR 14 DAYS' },
      NO_LOCKS,
    );
    const after = await readNavmc10132Pdf(result.bytes);

    for (const name of Object.keys(before.values)) {
      if (name === '6 PUNISHMENT IMPOSED') continue;
      expect(after.values[name], `${name} should not have moved`).toBe(before.values[name]);
    }
  }, 60000);
});

/**
 * Stephen's ruling: "We should not be updating the locked sections once that
 * are blocked with the signature." Writing one would break the signature that
 * closed it, so the refusal protects the document as well as obeying the rule.
 */
describe('what it refuses to write', () => {
  it('refuses every field a signature closed, and says which', async () => {
    const locked = new Set(['17 UNIT', '18 ACCUSED FULL NAME']);

    const result = await writeNavmc10132Incremental(
      blank(),
      {
        '17 UNIT': 'SHOULD NOT BE WRITTEN',
        '18 ACCUSED FULL NAME': 'ALSO NOT WRITTEN',
        '6 PUNISHMENT IMPOSED': 'THIS ONE SHOULD BE',
      },
      locked,
    );
    const after = await readNavmc10132Pdf(result.bytes);

    expect(result.refused.sort()).toEqual(['17 UNIT', '18 ACCUSED FULL NAME']);
    expect(result.written).toEqual(['6 PUNISHMENT IMPOSED']);
    expect(after.values['17 UNIT']).toBe('');
    expect(after.values['18 ACCUSED FULL NAME']).toBe('');
  }, 60000);

  // The same rule the loader applies in the other direction. Together they
  // mean a round trip never destroys what it did not collect.
  it('skips a field the app has no value for, rather than blanking the file', async () => {
    const first = await writeNavmc10132Incremental(
      blank(),
      { '6 PUNISHMENT IMPOSED': 'RESTRICTION FOR 14 DAYS' },
      NO_LOCKS,
    );

    const second = await writeNavmc10132Incremental(
      first.bytes,
      { '6 PUNISHMENT IMPOSED': '', '8A NJP AUTHORITY GRADE': 'LtCol, O5' },
      NO_LOCKS,
    );
    const after = await readNavmc10132Pdf(second.bytes);

    expect(second.skippedEmpty).toContain('6 PUNISHMENT IMPOSED');
    expect(after.values['6 PUNISHMENT IMPOSED']).toBe('RESTRICTION FOR 14 DAYS');
    expect(after.values['8A NJP AUTHORITY GRADE']).toBe('LtCol, O5');
  }, 60000);

  // A checkbox's false IS an answer, not an absence, so it is not skipped.
  it('lets a checkbox be turned off', async () => {
    const on = await writeNavmc10132Incremental(blank(), { '13 NOT APPEALED': true }, NO_LOCKS);
    const off = await writeNavmc10132Incremental(on.bytes, { '13 NOT APPEALED': false }, NO_LOCKS);
    const after = await readNavmc10132Pdf(off.bytes);

    expect(off.written).toContain('13 NOT APPEALED');
    expect(after.values['13 NOT APPEALED']).toBe('');
  }, 60000);

  // A no-op write still produces a delta, and a delta on every export grows
  // the document by a revision each time for nothing.
  it('skips a field the file already agrees with', async () => {
    const first = await writeNavmc10132Incremental(
      blank(),
      { '6 PUNISHMENT IMPOSED': 'RESTRICTION FOR 14 DAYS' },
      NO_LOCKS,
    );
    const second = await writeNavmc10132Incremental(
      first.bytes,
      { '6 PUNISHMENT IMPOSED': 'RESTRICTION FOR 14 DAYS' },
      NO_LOCKS,
    );

    expect(second.unchanged).toEqual(['6 PUNISHMENT IMPOSED']);
    expect(second.deltaBytes).toBe(0);
    expect(second.bytes.length).toBe(first.bytes.length);
  }, 60000);

  // A field this app knows and the file does not means the form was revised.
  // Reported, never thrown: one unknown field must not abort an export that
  // is otherwise correct.
  it('reports an unknown field instead of aborting the export', async () => {
    const result = await writeNavmc10132Incremental(
      blank(),
      { 'A FIELD THAT DOES NOT EXIST': 'x', '6 PUNISHMENT IMPOSED': 'RESTRICTION FOR 14 DAYS' },
      NO_LOCKS,
    );

    expect(result.refused).toContain('A FIELD THAT DOES NOT EXIST');
    expect(result.written).toContain('6 PUNISHMENT IMPOSED');
  }, 60000);
});

describe('stacking passes', () => {
  // The real lifecycle: each pass appends to what the last one produced, and
  // every earlier revision stays byte-identical underneath.
  it('appends a second pass on top of the first without disturbing it', async () => {
    const original = blank();
    const pass3 = await writeNavmc10132Incremental(
      original,
      { '6 PUNISHMENT IMPOSED': 'RESTRICTION FOR 14 DAYS' },
      NO_LOCKS,
    );
    const pass4 = await writeNavmc10132Incremental(
      pass3.bytes,
      { '11 APPEAL ADVISEMENT DATE_af_date': '2026-08-21' },
      NO_LOCKS,
    );

    expect(
      Buffer.compare(Buffer.from(pass3.bytes), Buffer.from(pass4.bytes.slice(0, pass3.bytes.length))),
    ).toBe(0);

    const after = await readNavmc10132Pdf(pass4.bytes);
    expect(after.values['6 PUNISHMENT IMPOSED']).toBe('RESTRICTION FOR 14 DAYS');
    expect(after.values['11 APPEAL ADVISEMENT DATE_af_date']).toBe('2026-08-21');
  }, 120000);
});

describe('bytes that are not a UPB', () => {
  it('fails with a named error rather than a parser stack trace', async () => {
    await expect(
      writeNavmc10132Incremental(new TextEncoder().encode('not a pdf'), {}, NO_LOCKS),
    ).rejects.toThrow(Navmc10132WriteError);
  });
});

// ---------------------------------------------------------------------------
// THE VALUE HAS TO BE VISIBLE, NOT ONLY PRESENT.
//
// Every test above reads values back through the PDF's object graph, which is
// how the app reads them and how Acrobat draws them. It is NOT how Chrome
// draws them. Chrome's engine renders a widget's appearance stream, and a
// base file that was filled once already carries one on every widget. Setting
// /V leaves that stream alone, so the delta ships a new value behind an old
// picture, and on a freshly written field the old picture is empty.
//
// That is exactly the shape of the defect Stephen reported on 2026-08-26:
// "item 6 is not generating in the preview but does in the download". The
// download opened in Acrobat, the preview is an iframe on Chrome's viewer.
//
// The blank above has no appearance streams, so it cannot reproduce this. The
// fixture here is the blank WITH appearances generated, which is what any
// once-filled form is, and is the only base the incremental path ever sees in
// production.
// ---------------------------------------------------------------------------

/** The blank, filled once, so every widget carries an appearance stream. */
async function filledOnce(): Promise<Uint8Array> {
  const { PDFDocument } = await import('pdf-lib');
  const doc = await PDFDocument.load(blank(), { ignoreEncryption: true });
  const form = doc.getForm();
  // Item 21 is RichText and empty here, and getText() throws on that
  // combination, which updateFieldAppearances() would hit. Same clearing the
  // blank-fill path does, for the same reason.
  const remarks = form.getTextField('21 REMARKS');
  remarks.acroField.setFlags(remarks.acroField.getFlags() & ~(1 << 25));
  form.updateFieldAppearances();
  return doc.save({ useObjectStreams: true });
}

/**
 * The decoded content stream of a field's normal appearance.
 *
 * `state` names the ON appearance of a checkbox or radio button, whose
 * `/AP /N` is a DICTIONARY of states rather than a single stream. Reading
 * the dictionary as a stream returns nothing, which made an earlier version
 * of the checkbox test below pass whether the appearance was regenerated or
 * not. Its differential caught that. Empty string means the appearance is
 * genuinely absent, so a test asserting on drawn output must also assert it
 * is not empty.
 */
async function appearanceStream(
  bytes: Uint8Array,
  fieldName: string,
  state?: string,
): Promise<string> {
  const { PDFDocument, PDFRawStream, PDFDict, PDFName, decodePDFRawStream } = await import(
    '@cantoo/pdf-lib'
  );
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
  const widget = doc.getForm().getField(fieldName).acroField.getWidgets()[0];
  let normal: unknown = widget.getAppearances()?.normal;
  if (normal instanceof PDFDict && state !== undefined) {
    normal = normal.lookup(PDFName.of(state));
  }
  if (!(normal instanceof PDFRawStream)) return '';
  return new TextDecoder().decode(decodePDFRawStream(normal).decode());
}

/**
 * The characters an appearance stream actually PAINTS.
 *
 * Asserting on the raw stream does not work: pdf-lib writes show-text
 * operands as hex, so "G" is `<47> Tj` and a substring check for the letter
 * finds nothing. This pulls the operands out and decodes them, so a test can
 * say what the field displays rather than how the bytes happen to encode it.
 */
function paintedText(stream: string): string {
  const out: string[] = [];
  const showText = /(\((?:[^()\\]|\\.)*\)|<([0-9A-Fa-f\s]*)>)\s*Tj/g;
  let match: RegExpExecArray | null;
  while ((match = showText.exec(stream)) !== null) {
    if (match[2] !== undefined) {
      const hex = match[2].replace(/\s+/g, '');
      for (let i = 0; i + 1 < hex.length; i += 2) {
        out.push(String.fromCharCode(parseInt(hex.slice(i, i + 2), 16)));
      }
    } else {
      out.push(match[1].slice(1, -1).replace(/\\(.)/g, '$1'));
    }
  }
  return out.join('');
}

/** The name of a checkbox's ON state, whatever the form happens to call it. */
async function checkedStateName(bytes: Uint8Array, fieldName: string): Promise<string> {
  const { PDFDocument, PDFDict } = await import('@cantoo/pdf-lib');
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
  const widget = doc.getForm().getField(fieldName).acroField.getWidgets()[0];
  const normal = widget.getAppearances()?.normal;
  if (!(normal instanceof PDFDict)) return '';
  const names = normal.keys().map((k) => k.asString().replace(/^\//, ''));
  return names.find((n) => n !== 'Off') ?? '';
}

/** What a field's normal appearance paints. */
async function appearanceText(bytes: Uint8Array, fieldName: string): Promise<string> {
  return paintedText(await appearanceStream(bytes, fieldName));
}

describe('the written value is DRAWN, not only stored', () => {
  it('regenerates item 6 appearance so a viewer that draws /AP shows the text', async () => {
    const base = await filledOnce();
    // The base draws item 6 as empty. This is the "before" the defect left in
    // place, and it is what the preview was showing.
    expect(await appearanceText(base, '6 PUNISHMENT IMPOSED')).not.toContain('RESTRICTION');

    const result = await writeNavmc10132Incremental(
      base,
      { '6 PUNISHMENT IMPOSED': 'RESTRICTION FOR 14 DAYS' },
      NO_LOCKS,
    );

    expect(result.written).toContain('6 PUNISHMENT IMPOSED');
    // The value is in the object graph, which was never the failing half.
    const read = await readNavmc10132Pdf(result.bytes);
    expect(read.values['6 PUNISHMENT IMPOSED']).toBe('RESTRICTION FOR 14 DAYS');
    // And now in the picture, which was.
    expect(await appearanceText(result.bytes, '6 PUNISHMENT IMPOSED')).toContain(
      'RESTRICTION FOR 14 DAYS',
    );
  }, 120000);

  it('still appends rather than rewrites once appearances are in the delta', async () => {
    const base = await filledOnce();
    const result = await writeNavmc10132Incremental(
      base,
      { '6 PUNISHMENT IMPOSED': 'RESTRICTION FOR 14 DAYS' },
      NO_LOCKS,
    );
    // Generating an appearance creates objects. If any of them landed before
    // the original bytes, every signature on a real file would break.
    expect(
      Buffer.compare(Buffer.from(base), Buffer.from(result.bytes.slice(0, base.length))),
    ).toBe(0);
  }, 120000);

  it('draws a two-step dropdown as its DISPLAY text and stores its EXPORT value', async () => {
    const base = await filledOnce();
    const fields = (fieldMap as { fields: AcroFormFieldMeta[] }).fields;

    const result = await writeNavmc10132Incremental(
      base,
      { '1A FINDING': 'Guilty' },
      NO_LOCKS,
      fields,
    );

    // /V carries the export value, which is what the loader and MCTFS read.
    const read = await readNavmc10132Pdf(result.bytes);
    expect(read.values['1A FINDING']).toBe('Guilty');

    // The widget is 23.76pt wide. Drawing "Guilty" into it clips to a
    // meaningless "G"-and-a-bit, so the appearance carries the form's own
    // display string instead.
    const drawn = await appearanceText(result.bytes, '1A FINDING');
    expect(drawn).toBe('G');
    expect(drawn).not.toContain('Guilty');
  }, 120000);

  it('leaves a checkbox appearance exactly as the form drew it', async () => {
    const base = await filledOnce();
    const onState = await checkedStateName(base, '13 NOT APPEALED');
    const before = await appearanceStream(base, '13 NOT APPEALED', onState);
    // Guards the guard: an empty string compares equal to an empty string, so
    // without this the assertion below holds no matter what the writer does.
    expect(before).not.toBe('');

    const result = await writeNavmc10132Incremental(base, { '13 NOT APPEALED': true }, NO_LOCKS);

    expect(result.written).toContain('13 NOT APPEALED');
    // A checkbox picks among states the FORM drew, through /AS, so it needs
    // no appearance pass and must not get one: regenerating would replace the
    // official form's mark with a generic pdf-lib tick.
    expect(await appearanceStream(result.bytes, '13 NOT APPEALED', onState)).toBe(before);
  }, 120000);
});
