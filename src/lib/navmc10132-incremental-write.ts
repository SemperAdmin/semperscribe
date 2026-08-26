/**
 * Writing the next pass into an already-signed NAVMC 10132.
 *
 * THE WHOLE POINT: the exported file must be the ORIGINAL file with new
 * bytes appended, not a new file that resembles it. A CAC signature covers
 * a byte range. Rewrite the document and every byte moves, the range no
 * longer covers what it signed, and Acrobat reports the signature as
 * invalid. That is indistinguishable from tampering to anyone who opens it
 * afterwards, which on a legal record is worse than an export that fails.
 *
 * SO THIS APPENDS AN INCREMENTAL UPDATE and never touches a byte that came
 * before. Verified against a real CAC-signed UPB, 2026-08-26: 5,144,151
 * bytes preserved byte for byte as the prefix, a 686-byte delta appended,
 * the `/ByteRange` count unchanged, the written value reading back, and the
 * signature-locked accused name untouched.
 *
 * FOUR THINGS THAT COST TIME TO LEARN, all measured rather than read:
 *
 * 1. `saveIncremental` RETURNS ONLY THE DELTA. It is not a document. Write
 *    it out on its own and you have a 686-byte file that opens as nothing.
 *    It has to be appended to the original bytes, which is what this module
 *    does and why it returns the whole file.
 * 2. `useObjectStreams: true` HERE, which is the OPPOSITE of the Phase 0
 *    rule for the full-rewrite export. Do not harmonize them. This form ends
 *    in an xref STREAM, and a classic xref table appended to it is rejected
 *    by Acrobat with "Unexpected byte range values defining scope of signed
 *    data" — a structural rejection thrown before any hash is checked, so it
 *    reads as corruption rather than as a bad signature.
 * 3. MUTATING A FIELD IS NOT ENOUGH. pdf-lib tracks new objects, not
 *    modified ones, so without `markRefForSave` on the field's ref AND on
 *    every widget, the delta carries a font and an appearance stream and no
 *    `/V`. The save succeeds, the file opens, and the value is not there.
 * 4. `@cantoo/pdf-lib`, NOT `pdf-lib`. Stock pdf-lib has no incremental API
 *    at all, so this cannot be done with the copy the rest of the app uses.
 *    Both are in the dependency tree on purpose. Everything that does a full
 *    rewrite keeps using stock pdf-lib; only this file uses the fork.
 * 5. SETTING `/V` LEAVES THE OLD APPEARANCE STREAM IN PLACE, AND HALF THE
 *    WORLD DRAWS THE APPEARANCE RATHER THAN THE VALUE. A base file that has
 *    been filled once already carries an `/AP` on every widget. `setText`
 *    marks the field dirty but does not touch that stream, so the delta
 *    re-emits the widget with the NEW `/V` and the OLD `/AP`. Acrobat
 *    regenerates from `/V` and shows the new text. Chrome's engine trusts
 *    `/AP` and shows the old, which on a freshly written field means it
 *    shows nothing at all.
 *
 *    MEASURED, 2026-08-26, rendering through pdfium (the engine behind the
 *    in-app preview) and counting ink inside item 6's own rectangle:
 *
 *      base file, item 6 empty                 947 dark px
 *      after the write, no appearance pass     947 dark px  <- invisible
 *      after the write, appearance regenerated 2519 dark px <- the text
 *
 *    That is the whole of the "item 6 shows in the download but not in the
 *    preview" defect. The fix is to regenerate the appearance for the
 *    fields this pass writes, which is what the blank-fill path has always
 *    done through `updateFieldAppearances()`. Only value-drawn fields need
 *    it: a checkbox picks among states the FORM drew, through `/AS`, so
 *    regenerating one would replace the form's own mark with a generic
 *    pdf-lib tick. Checkboxes were measured too, and they render correctly
 *    with no appearance pass at all.
 *
 *    NOT `NeedAppearances`, though that flag also works here (measured: the
 *    same 947 -> 2521). It tells every viewer to redraw EVERY field,
 *    including the ones inside the signed byte range, with whatever font it
 *    substitutes. On a legal record the signature should keep covering what
 *    it displayed, so this writes appearances for the fields it touched and
 *    leaves the rest exactly as signed.
 *
 * WHAT IT REFUSES TO WRITE, and why refusing is the feature:
 *
 * - ANY FIELD A SIGNATURE HAS CLOSED. Stephen's ruling: "We should not be
 *   updating the locked sections once that are blocked with the signature."
 *   Writing one would break the signature that closed it, so the refusal
 *   protects the document as well as obeying the rule. Refusals are
 *   REPORTED, never silent: a clerk who changed a locked field in the app
 *   has to be told the export did not carry it.
 * - ANY FIELD THE APP HAS NOTHING FOR. An empty value in document state is
 *   the app not having reached that field, not an instruction to blank the
 *   file. This is the same rule the loader applies in the other direction,
 *   and together they mean a round trip never destroys what it did not
 *   collect.
 * - ANY FIELD ALREADY CARRYING THE SAME VALUE. A no-op write still produces
 *   a delta, and a delta on every export grows the file by a revision each
 *   time for no reason.
 */

import {
  PDFDocument,
  PDFTextField,
  PDFCheckBox,
  PDFDropdown,
  PDFRadioGroup,
  PDFName,
  PDFString,
  type PDFFont,
  type PDFForm,
} from '@cantoo/pdf-lib';
import { buildTwoStepLookup, type AcroFormFieldMeta } from '@/lib/acroform-fill';

/** Thrown when the base file cannot be written into at all. */
export class Navmc10132WriteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'Navmc10132WriteError';
  }
}

export interface Navmc10132IncrementalResult {
  /** The WHOLE file: the original bytes with the update appended. */
  bytes: Uint8Array;
  /** Field names actually written. */
  written: string[];
  /** Field names a signature closed, which were not written. */
  refused: string[];
  /** Field names skipped because the file already says the same thing. */
  unchanged: string[];
  /** Field names the app had no value for, so the file keeps its own. */
  skippedEmpty: string[];
  /** Bytes appended. Zero means nothing needed writing. */
  deltaBytes: number;
}

/** Reads a field's current value in the same vocabulary the writer takes. */
function currentValue(field: unknown): string | null {
  if (field instanceof PDFTextField) {
    try {
      return field.getText() ?? '';
    } catch {
      // RichText, item 21. Unreadable through getText, so it cannot be
      // compared; treat as unknown and let the write decide.
      return null;
    }
  }
  if (field instanceof PDFCheckBox) return field.isChecked() ? 'true' : '';
  if (field instanceof PDFDropdown) return (field.getSelected() ?? []).join('');
  if (field instanceof PDFRadioGroup) return field.getSelected() ?? '';
  return null;
}

/**
 * Write `values` into `originalBytes` as an incremental update.
 *
 * `values` is keyed by FORM FIELD NAME, the same vocabulary
 * `navmc10132Values` produces, so the existing table is the source and this
 * module does not learn the form a second time.
 *
 * Returns the whole file. Writes nothing and returns the original bytes
 * unchanged when every field is refused, unchanged or empty, so an export
 * that has nothing to add does not grow the document.
 */
export async function writeNavmc10132Incremental(
  originalBytes: Uint8Array,
  values: Record<string, string | boolean | undefined>,
  lockedFields: ReadonlySet<string>,
  /**
   * Field metadata, normally the generated form map's `fields` array. Used
   * for ONE thing: the two-step dropdown rule (see `acroform-fill.ts` point
   * 2). Optional because the mechanics tests fill text fields only, and a
   * missing map costs a dropdown its display text rather than the whole
   * write. Every production caller passes it.
   */
  fields: readonly AcroFormFieldMeta[] = [],
): Promise<Navmc10132IncrementalResult> {
  const original = new Uint8Array(originalBytes);

  let doc: PDFDocument;
  try {
    doc = await PDFDocument.load(original, { ignoreEncryption: true, updateMetadata: false });
  } catch (err) {
    throw new Navmc10132WriteError(
      `The uploaded file could not be opened for writing. ${err instanceof Error ? err.message : ''}`.trim(),
    );
  }

  const snapshot = doc.takeSnapshot();
  const form = doc.getForm();

  // Export value -> display value, for the choice fields whose two differ.
  // Shared with the blank-fill path so a form revision is learned once.
  const twoStep = buildTwoStepLookup([...fields]);

  // Embedding a font creates an object, and a pass that writes only
  // checkboxes needs none, so this is built on first use rather than up
  // front. An export with nothing to draw should not grow the file.
  let cachedFont: PDFFont | undefined;
  const appearanceFont = (formRef: PDFForm): PDFFont => {
    if (!cachedFont) cachedFont = formRef.getDefaultFont();
    return cachedFont;
  };

  const written: string[] = [];
  const refused: string[] = [];
  const unchanged: string[] = [];
  const skippedEmpty: string[] = [];

  for (const [name, raw] of Object.entries(values)) {
    if (lockedFields.has(name)) {
      refused.push(name);
      continue;
    }

    const desired = typeof raw === 'boolean' ? (raw ? 'true' : '') : (raw ?? '').trim();

    // A checkbox's false is a real answer, so only text-shaped emptiness
    // counts as "the app has nothing".
    if (desired === '' && typeof raw !== 'boolean') {
      skippedEmpty.push(name);
      continue;
    }

    let field;
    try {
      field = form.getField(name);
    } catch {
      // Not on this revision of the form. Not an error: a field the app
      // knows and the file does not is the form having changed, and the
      // caller is told through `refused` rather than by an exception that
      // aborts the whole export.
      refused.push(name);
      continue;
    }

    const before = currentValue(field);
    if (before !== null && before === desired) {
      unchanged.push(name);
      continue;
    }

    try {
      if (field instanceof PDFTextField) {
        field.setText(desired);
        // POINT 5 FROM THE HEADER. Without this the value is in the file
        // and invisible in every viewer that draws the appearance.
        field.defaultUpdateAppearances(appearanceFont(form));
      } else if (field instanceof PDFCheckBox) {
        if (desired === 'true') field.check();
        else field.uncheck();
        // No appearance pass, deliberately. A checkbox selects among states
        // the FORM already drew, through /AS, so it renders correctly as it
        // stands and regenerating would replace the form's own mark.
      } else if (field instanceof PDFDropdown) {
        // The two-step rule, same order and same reason as the blank path:
        // draw the DISPLAY text, then put the EXPORT value in /V. Drawing
        // the export value instead clips a narrow widget ("Guilty" into a
        // 23.76pt findings box), and patching /V first would draw exactly
        // that. Order is load-bearing.
        const display = twoStep.get(name)?.get(desired);
        field.select(display ?? desired);
        field.defaultUpdateAppearances(appearanceFont(form));
        if (display !== undefined) {
          field.acroField.dict.set(PDFName.of('V'), PDFString.of(desired));
        }
      } else if (field instanceof PDFRadioGroup) {
        field.select(desired);
        // Same as the checkbox: /AS picks a state the form drew.
      } else {
        refused.push(name);
        continue;
      }
    } catch (err) {
      throw new Navmc10132WriteError(
        `Could not write "${name}": ${err instanceof Error ? err.message : 'unknown error'}.`,
      );
    }

    // POINT 3 FROM THE HEADER. Without both of these the delta carries a
    // font and an appearance stream and no value, and the write silently
    // does nothing.
    snapshot.markRefForSave(field.acroField.ref);
    for (const widget of field.acroField.getWidgets()) {
      const ref = widget.dict.context.getObjectRef(widget.dict);
      if (ref) snapshot.markRefForSave(ref);
    }

    written.push(name);
  }

  if (written.length === 0) {
    return { bytes: original, written, refused, unchanged, skippedEmpty, deltaBytes: 0 };
  }

  const delta = await doc.saveIncremental(snapshot, { useObjectStreams: true });

  // POINT 1 FROM THE HEADER. `delta` is the update, not the document.
  const bytes = new Uint8Array(original.length + delta.length);
  bytes.set(original, 0);
  bytes.set(delta, original.length);

  return { bytes, written, refused, unchanged, skippedEmpty, deltaBytes: delta.length };
}
