/**
 * Generic AcroForm filler.
 *
 * Fills a plain (non-XFA) AcroForm PDF from a flat name/value map, using a
 * field-metadata array (the shape produced by this codebase's form-map
 * generator) to drive every form-specific decision. This module is generic
 * on purpose: it is written for any AcroForm-based document, not for one
 * form in particular. NAVMC 10132 (a Marine Corps unit punishment book) is
 * the form that first exercised it, and it is reused unchanged for DD Form
 * 137 in the NAVMC 10922 backlog.
 *
 * Runs in the browser: only pdf-lib and standard JS, no Node APIs and no
 * filesystem access.
 *
 * Three behaviours below are NOT obvious from reading a PDF spec or from
 * pdf-lib's own docs. Each was found empirically, by filling a real form and
 * watching it fail or render wrong, so keep them even if the reasoning looks
 * avoidable in isolation.
 *
 * 1. AN EMPTY RICH-TEXT FIELD CRASHES APPEARANCE GENERATION, WHICH IS THE
 *    ORDINARY CASE, NOT AN EDGE CASE. A field with the RichText flag set
 *    (bit 26, `1 << 25`) makes pdf-lib's `getText()` throw
 *    `RichTextFieldReadError` whenever that field is empty, and
 *    `updateFieldAppearances()` calls `getText()` on every text field in the
 *    form, whether or not the caller supplied a value for it. Most fills of
 *    most forms leave at least one optional rich-text remarks field blank,
 *    so a naive port crashes on the common path, not on some rare input.
 *    The fix is to clear the RichText flag, on every text field the
 *    metadata marks with a `richText` flag, before generating any
 *    appearances. This is safe as long as the blank carries no `/RV` (rich
 *    value) content and the caller never writes rich content either, which
 *    holds for every field this module has been asked to fill. Once the
 *    flag is off, the field behaves as an ordinary plain-text field and its
 *    `/V` renders normally.
 *
 * 2. A DROPDOWN WHOSE EXPORT VALUE DIFFERS FROM ITS DISPLAY TEXT NEEDS A
 *    TWO-STEP WRITE, AND SKIPPING THE SECOND STEP CLIPS THE WIDGET.
 *    pdf-lib's `PDFDropdown.getOptions()` returns the DISPLAY strings from
 *    `/Opt`, and `select()` writes whatever string it is given straight into
 *    `/V` with no validation against `/Opt` and no distinction between the
 *    export value and the display value. If the export value is written
 *    directly, it is also what gets drawn into the widget's appearance
 *    stream, and some export values are long labels that were never meant
 *    to be drawn (a findings widget on the reference form is 22.76pt wide,
 *    so an export value like "Guilty" does not fit and clips to "G"). The
 *    fix is a two-step write: call `select()` with the DISPLAY text so
 *    `updateFieldAppearances()` draws the short display string correctly,
 *    then, AFTER appearances are generated, reach into the low-level
 *    AcroForm dictionary and overwrite `/V` with the EXPORT value. Doing
 *    the `/V` patch before appearance generation instead of after draws the
 *    long export string and reproduces the clipping bug, so the order is
 *    load-bearing. Which fields need this is read entirely from each
 *    field's `exportDiffersFromDisplay` flag in the passed metadata. Nothing
 *    here is hardcoded to a field name, because a form revision changes
 *    data, not code.
 *
 * 3. FIELDS NORMALLY POPULATED BY PDF JAVASCRIPT MUST BE UNLOCKED, WRITTEN,
 *    AND RE-LOCKED. Some read-only fields on a real form are populated only
 *    by the form's own calculate or on-blur JavaScript (mirroring another
 *    field, or composing a boilerplate sentence). pdf-lib does not run PDF
 *    JavaScript, so those fields ship blank or stale unless this module
 *    fills them directly. The caller names which fields need this via
 *    `unlockReadOnly`. This module clears the read-only flag (bit 1,
 *    `1 << 0`) before the write pass and restores it afterward.
 *
 *    On WHY the flag has to move, measured rather than assumed: pdf-lib
 *    itself does not refuse a write to a read-only field, so the unlock is
 *    not there to dodge an exception. It is there so the SHIPPED document
 *    still reports those fields as read-only to every other reader, which
 *    is what the form's own design intends. An earlier version of this
 *    comment claimed the write was refused. It is not, and a false
 *    rationale in a comment invites someone to delete code they think is
 *    dead. `tests/navmc10132-acroform.test.ts` asserts the observable
 *    contract instead: the value lands AND the flag comes back.
 *
 * A fourth, smaller thing worth knowing: filling a form invalidates any
 * Adobe usage-rights (UR3) signature at `/Root /Perms`, because that
 * signature covers the exact original bytes. An invalidated signature reads
 * to most PDF readers as tampering, whereas simply having no signature reads
 * as an ordinary, unremarkable form. `stripUsageRights` defaults to `true`
 * for that reason. Whether stripping is the permanently correct behaviour is
 * still an open spec question upstream of this module, so it stays an
 * option rather than a hardcoded deletion.
 */

import {
  PDFDocument,
  PDFTextField,
  PDFDropdown,
  PDFCheckBox,
  PDFSignature,
  PDFName,
  PDFString,
  type PDFField,
} from 'pdf-lib';

/** A value this module can write. Booleans are for checkboxes. */
export type AcroFormValue = string | boolean;

/** Field metadata, normally one entry of a generated form map's `fields` array. */
export interface AcroFormFieldMeta {
  name: string;
  /** '/Tx' | '/Ch' | '/Btn' | '/Sig' */
  type: string;
  exportValues?: string[];
  displayValues?: string[];
  exportDiffersFromDisplay?: boolean;
  flags?: string[];
}

export interface FillAcroFormOptions {
  /** Read-only fields to unlock, write, then re-lock. */
  unlockReadOnly?: string[];
  /** Delete /Root /Perms. Defaults TRUE. See the D-12 note. */
  stripUsageRights?: boolean;
  /** Field metadata, normally the generated map's fields array. */
  fields: AcroFormFieldMeta[];
}

export interface FillAcroFormReport {
  written: string[];
  deferred: string[];
  skipped: Array<[string, string]>;
  errors: Array<[string, string]>;
  notes: string[];
}

/** PDF field-flag bit for read-only (bit 1). */
const FF_READ_ONLY = 1 << 0;
/** PDF field-flag bit for RichText on a text field (bit 26). */
const FF_RICH_TEXT = 1 << 25;

/** Toggle a single flag bit on a field without disturbing the others. */
function setFieldFlag(field: PDFField, bit: number, on: boolean): void {
  const acro = field.acroField;
  const flags = acro.getFlags();
  acro.setFlags(on ? flags | bit : flags & ~bit);
}

/**
 * Build export-value -> display-value lookups for every choice field the
 * metadata marks `exportDiffersFromDisplay`. Map-driven, so a form revision
 * that adds or removes such a field changes the map, not this code.
 */
function buildTwoStepLookup(fields: AcroFormFieldMeta[]): Map<string, Map<string, string>> {
  const table = new Map<string, Map<string, string>>();
  for (const field of fields) {
    if (field.type !== '/Ch' || !field.exportDiffersFromDisplay) continue;
    const exportValues = field.exportValues ?? [];
    const displayValues = field.displayValues ?? [];
    const pairs = new Map<string, string>();
    exportValues.forEach((exp, i) => pairs.set(exp, displayValues[i]));
    table.set(field.name, pairs);
  }
  return table;
}

/**
 * Fill an AcroForm PDF and return both the saved bytes and a diagnostic
 * report. See the module header for the fill order and why it is
 * load-bearing.
 *
 * Per-field problems (a bogus field name, a value that is not a valid
 * export value, an unsupported field type) are collected in the returned
 * report rather than thrown, so one bad field never aborts the whole fill.
 * The only thrown error is a document that has no AcroForm at all, since
 * there is nothing meaningful this module can do with that input.
 */
export async function fillAcroFormWithReport(
  baseBytes: ArrayBuffer | Uint8Array,
  values: Record<string, AcroFormValue | undefined>,
  options: FillAcroFormOptions,
): Promise<{ bytes: Uint8Array; report: FillAcroFormReport }> {
  const report: FillAcroFormReport = {
    written: [],
    deferred: [],
    skipped: [],
    errors: [],
    notes: [],
  };

  const doc = await PDFDocument.load(baseBytes, { ignoreEncryption: true });

  if (!doc.catalog.has(PDFName.of('AcroForm'))) {
    throw new Error('fillAcroForm: document has no /Root /AcroForm, nothing to fill');
  }

  const form = doc.getForm();
  const metaByName = new Map(options.fields.map((f) => [f.name, f] as const));
  const twoStep = buildTwoStepLookup(options.fields);

  // 1. Clear RichText on every rich-text field so appearance generation
  //    cannot throw on a field that happens to be empty.
  for (const entry of options.fields) {
    if (entry.type !== '/Tx' || !entry.flags?.includes('richText')) continue;
    const field = form.getFieldMaybe(entry.name);
    if (!field) continue;
    setFieldFlag(field, FF_RICH_TEXT, false);
    report.notes.push(`cleared RichText on ${entry.name}`);
  }

  // 2. Unlock the caller-named read-only fields so JavaScript-only fields
  //    can be written directly.
  const relock: PDFField[] = [];
  for (const name of options.unlockReadOnly ?? []) {
    const field = form.getFieldMaybe(name);
    if (!field) {
      report.errors.push([name, 'unlockReadOnly field not found in document']);
      continue;
    }
    if (field.isReadOnly()) {
      setFieldFlag(field, FF_READ_ONLY, false);
      relock.push(field);
    }
  }

  // 3. Write. Two-step dropdowns get their DISPLAY text now and their
  //    export value patched in after appearances are generated (step 5).
  const patchLater: Array<[PDFField, string]> = [];
  for (const [name, value] of Object.entries(values)) {
    if (value === undefined || value === null || value === '') continue;

    const field = form.getFieldMaybe(name);
    if (!field) {
      report.errors.push([name, 'field not found']);
      continue;
    }

    try {
      if (field instanceof PDFSignature) {
        report.skipped.push([name, 'signature widget, never written']);
      } else if (field instanceof PDFTextField) {
        field.setText(String(value));
        report.written.push(name);
      } else if (field instanceof PDFDropdown) {
        const exportValue = String(value);
        const pairs = twoStep.get(name);
        if (pairs) {
          const display = pairs.get(exportValue);
          if (display === undefined) {
            report.errors.push([name, `"${exportValue}" is not an export value`]);
            continue;
          }
          field.select(display);
          patchLater.push([field, exportValue]);
          report.deferred.push(name);
        } else {
          const meta = metaByName.get(name);
          const validValues = meta?.exportValues ?? field.getOptions();
          if (!validValues.includes(exportValue)) {
            report.errors.push([name, `"${exportValue}" is not an export value`]);
            continue;
          }
          field.select(exportValue);
          report.written.push(name);
        }
      } else if (field instanceof PDFCheckBox) {
        if (value === true || value === 'Yes' || value === '/Yes') field.check();
        else field.uncheck();
        report.written.push(name);
      } else {
        report.skipped.push([name, field.constructor.name]);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message.split('\n')[0] : String(err);
      report.errors.push([name, message]);
    }
  }

  // 4. Generate appearances from whatever is now in /V (display text for
  //    two-step dropdowns, final values for everything else).
  form.updateFieldAppearances();

  // 5. Patch /V on two-step dropdowns to their export values. Doing this
  //    before appearance generation would draw the export string instead
  //    of the display string and clip a narrow widget, so order matters.
  for (const [field, exportValue] of patchLater) {
    field.acroField.dict.set(PDFName.of('V'), PDFString.of(exportValue));
  }

  // 6. Re-lock whatever step 2 unlocked.
  for (const field of relock) setFieldFlag(field, FF_READ_ONLY, true);

  // 7. The usage-rights signature is void the instant the bytes change.
  //    Removing it shows no signature rather than an invalid one.
  const stripUsageRights = options.stripUsageRights ?? true;
  if (stripUsageRights && doc.catalog.has(PDFName.of('Perms'))) {
    doc.catalog.delete(PDFName.of('Perms'));
    report.notes.push('removed /Root/Perms (UR3 usage-rights signature)');
  }

  const bytes = await doc.save({ useObjectStreams: false });
  return { bytes, report };
}

/**
 * Fill an AcroForm PDF and return only the saved bytes. Use
 * {@link fillAcroFormWithReport} instead when the caller wants diagnostics
 * (what was written, deferred, skipped, or errored).
 */
export async function fillAcroForm(
  baseBytes: ArrayBuffer | Uint8Array,
  values: Record<string, AcroFormValue | undefined>,
  options: FillAcroFormOptions,
): Promise<Uint8Array> {
  const { bytes } = await fillAcroFormWithReport(baseBytes, values, options);
  return bytes;
}
