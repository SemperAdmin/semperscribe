/**
 * Reading an existing NAVMC 10132 back out of a PDF.
 *
 * THE LIFECYCLE THIS SERVES, in Stephen's words: the form is created in the
 * app, exported, CAC-signed, re-uploaded to action the next section, and
 * exported again, until the app is no longer needed. Everything before this
 * module handled the first export only. This is the return leg.
 *
 * MEASURED ON A REAL CAC-SIGNED FILE, 2026-08-25, and the measurements are
 * the reason this module exists in the shape it does rather than the shape
 * the spec assumed:
 *
 *   - 74 fields, 52 of them non-empty, ALL readable through `getForm()`.
 *     The earlier finding that a signed UPB "cannot be read" was about the
 *     TEXT extractor, which reads the page content stream and therefore
 *     sees none of this. An AcroForm reader sees all of it.
 *   - Seven signature fields; exactly two carried a `/V`, item 2 and item
 *     3. So the file announced its own position in the pass sequence.
 *   - All seven `/Lock` dictionaries present and readable, six `/Include`
 *     naming 43 to 70 fields each, and `16 FINAL ADMIN INIT` `/All`.
 *   - ZERO fields carried the ReadOnly flag, despite two applied
 *     signatures. See `lockedFields` below. This one contradicts decision
 *     row D-37 and is the reason nothing here reads `/Ff`.
 *
 * WHAT THIS MODULE DOES NOT DO. It does not map values into `FormData`,
 * which is navmc10132-pdf-to-form.ts, and it does not write. It answers
 * three questions about a file and stops: what does it hold, what is
 * closed, and which pass is it at.
 */

import {
  PDFDocument,
  PDFName,
  PDFDict,
  PDFArray,
  PDFRef,
  PDFTextField,
  PDFCheckBox,
  PDFDropdown,
  PDFRadioGroup,
  PDFSignature,
  PDFNumber,
} from 'pdf-lib';
import type { Navmc10132Stage } from '@/types/navmc';

/** Thrown when the bytes are not a readable NAVMC 10132. */
export class Navmc10132ReadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'Navmc10132ReadError';
  }
}

export interface Navmc10132PdfRead {
  /** Every non-signature field, by form field name, including empty ones. */
  values: Record<string, string>;
  /** Signature field names carrying a `/V`, i.e. actually signed. */
  signedSignatures: string[];
  /** Every signature field on the form, signed or not, in document order. */
  allSignatures: string[];
  /**
   * Field names the applied signatures have closed. Computed from the
   * `/Lock` dictionary of every SIGNED signature field, never from ReadOnly.
   */
  lockedFields: Set<string>;
  /** The pass this file is at, derived from `signedSignatures`. */
  stage: Navmc10132Stage;
  /** Non-fatal observations worth showing a clerk. */
  notes: string[];
}

/**
 * Which signature closes which pass, from the measured table in
 * docs/NAVMC_10132_SPEC.md section 13.1. Order is the pass order, and the
 * array index plus one is the pass a signature CLOSES.
 */
export const NAVMC_10132_PASS_SIGNATURES: readonly string[] = [
  '2 ACC ELECTION AND RIGHTS SIGNATURE', // closes pass 1
  '3 RIGHTS ATTEST SIGNATURE', // closes pass 2
  '9 NJP AUTHORITY SIGNATURE', // closes pass 3
  '11 APPEAL ADVISEMENT SIGNATURE', // closes pass 4
  '12 APPEAL INTENT SIGNATURE', // closes pass 5
  '14 APPEAL DECISION SIGNATURE', // closes pass 6
  '16 FINAL ADMIN INIT', // closes pass 7, and locks everything
];

/**
 * The pass a document is at, given which signatures are applied.
 *
 * READS THE HIGHEST SIGNATURE PRESENT, not the count, and the difference
 * matters on a real file. Signatures are not always applied in order: a
 * commander can sign item 9 before someone goes back and fills item 4, and
 * a case with no appeal never gets items 11 through 14 signed at all, so
 * counting would put a closed-out document at pass 4. The highest applied
 * signature is the last thing that actually closed.
 *
 * A document whose LAST pass signature is applied is `'complete'`: pass 7's
 * `16 FINAL ADMIN INIT` carries `/Action /All` and closes every field, so
 * there is no eighth pass to be at.
 *
 * NO SIGNATURES AT ALL means pass 1, which is also what a fresh document
 * gets. That is the right answer for an exported-but-unsigned file: nothing
 * has closed, so everything pass 1 owns is still open.
 */
export function navmc10132StageFromSignatures(signed: readonly string[]): Navmc10132Stage {
  let highest = -1;
  for (const name of signed) {
    const index = NAVMC_10132_PASS_SIGNATURES.indexOf(name);
    if (index > highest) highest = index;
  }
  if (highest < 0) return 1;
  // The signature at index i closes pass i+1, so the document is now at
  // pass i+2.
  const next = highest + 2;
  if (next > 7) return 'complete';
  return next as Navmc10132Stage;
}

function dictOf(doc: PDFDocument, value: unknown): PDFDict | null {
  if (value instanceof PDFDict) return value;
  if (value instanceof PDFRef) {
    const looked = doc.context.lookup(value);
    return looked instanceof PDFDict ? looked : null;
  }
  return null;
}

function arrayOf(doc: PDFDocument, value: unknown): PDFArray | null {
  if (value instanceof PDFArray) return value;
  if (value instanceof PDFRef) {
    const looked = doc.context.lookup(value);
    return looked instanceof PDFArray ? looked : null;
  }
  return null;
}

/**
 * The fields one signature's `/Lock` closes.
 *
 * Three actions, per ISO 32000-1 table 233. `/All` closes everything, and is
 * signalled here by returning null rather than a set, because "everything"
 * includes fields this reader has not enumerated. `/Include` closes the
 * named fields. `/Exclude` closes everything EXCEPT the named fields, so it
 * is expanded against the full field list rather than stored as an
 * exclusion, which would leak the distinction into every caller.
 */
function lockedBySignature(
  doc: PDFDocument,
  lock: PDFDict,
  allFieldNames: readonly string[],
): Set<string> | null {
  const action = lock.get(PDFName.of('Action'));
  const actionName = action ? String(action) : '';
  if (actionName === '/All') return null;

  const namesArray = arrayOf(doc, lock.get(PDFName.of('Fields')));
  const named = new Set<string>();
  if (namesArray) {
    for (const entry of namesArray.asArray()) {
      const value = entry instanceof PDFRef ? doc.context.lookup(entry) : entry;
      const text = (value as { decodeText?: () => string })?.decodeText?.();
      if (text) named.add(text);
    }
  }

  if (actionName === '/Exclude') {
    return new Set(allFieldNames.filter((n) => !named.has(n)));
  }
  return named;
}

/**
 * Read a NAVMC 10132 PDF.
 *
 * Accepts any revision of the form, signed or not. Throws only when the
 * bytes are not a PDF at all or carry no AcroForm, because a file that
 * parses but is the wrong form is better reported as a mismatch by the
 * caller, which can say WHICH fields it expected and did not find.
 */
export async function readNavmc10132Pdf(bytes: ArrayBuffer | Uint8Array): Promise<Navmc10132PdfRead> {
  // NORMALIZED RATHER THAN PASSED THROUGH. Callers arrive from three
  // places with three shapes: a browser File gives an ArrayBuffer, a test
  // gives a Node Buffer, and an in-app re-read gives a Uint8Array. pdf-lib
  // rejects some of those on a strict type check that reports the type as
  // NaN, which is not a diagnosable message. One line here beats three
  // call sites remembering.
  const input =
    bytes instanceof Uint8Array ? new Uint8Array(bytes) : new Uint8Array(bytes as ArrayBuffer);

  let doc: PDFDocument;
  try {
    doc = await PDFDocument.load(input, { ignoreEncryption: true, updateMetadata: false });
  } catch (err) {
    throw new Navmc10132ReadError(
      `This file could not be read as a PDF. ${err instanceof Error ? err.message : ''}`.trim(),
    );
  }

  let form;
  try {
    form = doc.getForm();
  } catch {
    throw new Navmc10132ReadError('This PDF carries no form fields, so there is nothing to read.');
  }

  const fields = form.getFields();
  if (fields.length === 0) {
    throw new Navmc10132ReadError('This PDF carries no form fields, so there is nothing to read.');
  }

  const values: Record<string, string> = {};
  const allSignatures: string[] = [];
  const signedSignatures: string[] = [];
  const notes: string[] = [];
  const allFieldNames = fields.map((f) => f.getName());

  const lockDicts: PDFDict[] = [];

  for (const field of fields) {
    const name = field.getName();

    // `instanceof` rather than `constructor.name`, and not only because tsc
    // rejects the casts the name check needs: class names do not survive a
    // minified browser bundle, and this module runs in the browser. A name
    // check would work in tests and silently classify every field as
    // "unknown" in production.
    if (field instanceof PDFSignature) {
      allSignatures.push(name);
      const dict = field.acroField.dict;
      if (dict.get(PDFName.of('V'))) {
        signedSignatures.push(name);
        const lock = dictOf(doc, dict.get(PDFName.of('Lock')));
        if (lock) lockDicts.push(lock);
      }
      continue;
    }

    // Every non-signature kind the NAVMC 10132 uses. Anything else is read
    // as empty rather than skipped, so the caller sees the field exists.
    try {
      if (field instanceof PDFTextField) {
        values[name] = field.getText() ?? '';
      } else if (field instanceof PDFCheckBox) {
        values[name] = field.isChecked() ? 'true' : '';
      } else if (field instanceof PDFDropdown) {
        // Joined with no separator on purpose. Every dropdown on this form
        // is single-select, so the array holds at most one entry, and a
        // separator would appear in the value if that ever changed rather
        // than silently concatenating two legal strings.
        values[name] = (field.getSelected() ?? []).join('');
      } else if (field instanceof PDFRadioGroup) {
        values[name] = field.getSelected() ?? '';
      } else {
        values[name] = '';
      }
    } catch (err) {
      values[name] = '';
      notes.push(
        `Field "${name}" could not be read (${err instanceof Error ? err.message : 'unknown'}), treated as empty.`,
      );
    }
  }

  let lockedFields = new Set<string>();
  for (const lock of lockDicts) {
    const closed = lockedBySignature(doc, lock, allFieldNames);
    if (closed === null) {
      // /Action /All. Everything is closed, and nothing later can widen it.
      lockedFields = new Set(allFieldNames);
      break;
    }
    for (const name of closed) lockedFields.add(name);
  }

  // MEASURED, AND WORTH SAYING OUT LOUD. On the real signed file not one
  // field carried the ReadOnly flag even with two signatures applied, so a
  // reader keying on /Ff would have concluded nothing was closed. Nothing
  // here reads /Ff; the note exists so the next person to look does not
  // "fix" this by adding it.
  const readOnlyCount = fields.filter((f) => {
    const ff = f.acroField.dict.get(PDFName.of('Ff'));
    const n = ff instanceof PDFNumber ? ff.asNumber() : 0;
    return (n & 1) === 1;
  }).length;
  if (signedSignatures.length > 0 && readOnlyCount === 0) {
    notes.push(
      'This file has applied signatures but no field carries the ReadOnly flag. That is ' +
        'normal for this form: the locks live in the signature /Lock dictionaries, which is ' +
        'what was read here.',
    );
  }

  return {
    values,
    signedSignatures,
    allSignatures,
    lockedFields,
    stage: navmc10132StageFromSignatures(signedSignatures),
    notes,
  };
}
