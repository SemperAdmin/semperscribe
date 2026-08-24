/**
 * NAVMC 10132 AcroForm fill - Phase 0 reference implementation.
 *
 * This is the behaviour `src/lib/acroform-fill.ts` must reproduce. It is kept
 * as a tool so the production module can be diffed against something that
 * demonstrably works on the real blank.
 *
 * Three things here are NOT obvious and were each found by running the fill
 * rather than by reading the PDF. See docs/NAVMC_10132_SPEC.md section 4.
 *
 * 1. RICH TEXT CRASHES THE EXPORT.
 *    `21 REMARKS` has the RichText flag set. pdf-lib's getText() throws
 *    RichTextFieldReadError when a rich-text field is EMPTY, and
 *    updateFieldAppearances() calls getText() on every text field. A UPB with
 *    no remarks is entirely normal, so without clearing the flag the export
 *    crashes on the common case. Clearing bit 26 is safe: the blank carries no
 *    /RV, the app never writes rich content, and Acrobat renders /V fine on a
 *    plain text field.
 *
 * 2. DROPDOWNS NEED A TWO-STEP WRITE WHEN EXPORT DIFFERS FROM DISPLAY.
 *    pdf-lib's getOptions() returns DISPLAY text and select() writes whatever
 *    string it is given straight into /V, with no validation against /Opt.
 *    Writing the export value directly therefore also renders it: the findings
 *    widget is 22.76pt wide and "Guilty" at 8pt does not fit, so it clips.
 *    The fix is to select the DISPLAY text, generate appearances, then patch /V
 *    to the EXPORT value. Result: /V = "Guilty", the widget draws "G".
 *    Six fields need this - the five findings dropdowns and 2 COUNSELOPP.
 *    The list is read from the map, never hardcoded.
 *
 * 3. FOUR READ-ONLY FIELDS MUST BE UNLOCKED.
 *    Items 23-25 are populated only by calculate JavaScript and 2 BOOKER only
 *    by on-blur JavaScript. pdf-lib runs neither. Without the unlock, page 2
 *    ships with no accused identity (violating MCO 011103) and the Booker
 *    statement ships stale - claiming the accused accepted NJP even when they
 *    refused.
 *
 * Usage:
 *   node navmc10132_fill.mjs <blank.pdf> <map.json> <values.json> <out.pdf> [--keep-perms]
 */
import fs from 'node:fs';
import {
  PDFDocument,
  PDFTextField,
  PDFDropdown,
  PDFCheckBox,
  PDFSignature,
  PDFName,
  PDFString,
} from 'pdf-lib';

const FF_READ_ONLY = 1 << 0;
const FF_RICH_TEXT = 1 << 25;

/** Read-only fields the emitter unlocks, writes, and re-locks. */
export const UNLOCK_READ_ONLY = [
  '2 BOOKER',
  '23 ACCUSED FULL NAME',
  '24 ACCUSED RANK/GRADE',
  '25 ACCUSED EDIPI',
];

function setFlag(field, bit, on) {
  const acro = field.acroField;
  const flags = acro.getFlags();
  acro.setFlags(on ? flags | bit : flags & ~bit);
}

/**
 * Build the export-to-display lookup for every choice field whose two differ.
 * Map-driven so a form revision changes data, not code.
 */
function displayLookup(map) {
  const table = new Map();
  for (const field of map.fields) {
    if (field.type !== '/Ch' || !field.exportDiffersFromDisplay) continue;
    const pairs = new Map();
    field.exportValues.forEach((exp, i) => pairs.set(exp, field.displayValues[i]));
    table.set(field.name, pairs);
  }
  return table;
}

export function fillNavmc10132(doc, map, values, { keepPerms = false } = {}) {
  const form = doc.getForm();
  const twoStep = displayLookup(map);
  const report = { written: [], deferred: [], skipped: [], errors: [], notes: [] };

  // 1. Clear RichText on every rich-text field so appearance generation cannot
  //    throw on an empty value.
  for (const entry of map.fields) {
    if (entry.type !== '/Tx' || !entry.flags?.includes('richText')) continue;
    setFlag(form.getField(entry.name), FF_RICH_TEXT, false);
    report.notes.push(`cleared RichText on ${entry.name}`);
  }

  // 2. Unlock the read-only fields.
  const relock = [];
  for (const name of UNLOCK_READ_ONLY) {
    const field = form.getField(name);
    if (field.isReadOnly()) {
      setFlag(field, FF_READ_ONLY, false);
      relock.push(field);
    }
  }

  // 3. Write. Two-step dropdowns get their DISPLAY text now and their export
  //    value after appearances are generated.
  const patchLater = [];
  for (const [name, value] of Object.entries(values)) {
    if (value === undefined || value === null || value === '') continue;
    let field;
    try {
      field = form.getField(name);
    } catch {
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
        const pairs = twoStep.get(name);
        const exportValue = String(value);
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
          if (!field.getOptions().includes(exportValue)) {
            report.errors.push([name, `"${exportValue}" is not an option`]);
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
      report.errors.push([name, err.message.split('\n')[0]]);
    }
  }

  // 4. Appearances, generated from the display text.
  form.updateFieldAppearances();

  // 5. Patch /V to the export values. Order matters - doing this before
  //    appearance generation renders the long string and clips it.
  for (const [field, exportValue] of patchLater) {
    field.acroField.dict.set(PDFName.of('V'), PDFString.of(exportValue));
  }

  // 6. Re-lock.
  for (const field of relock) setFlag(field, FF_READ_ONLY, true);

  // 7. The usage-rights signature is void the moment the bytes change.
  //    Removing it shows no signature rather than an invalid one.
  if (!keepPerms && doc.catalog.has(PDFName.of('Perms'))) {
    doc.catalog.delete(PDFName.of('Perms'));
    report.notes.push('removed /Root/Perms (UR3 usage-rights signature)');
  }

  return report;
}

async function main() {
  const [blankPath, mapPath, valuesPath, outPath, ...flags] = process.argv.slice(2);
  if (!blankPath || !mapPath || !valuesPath || !outPath) {
    console.error(
      'usage: node navmc10132_fill.mjs <blank.pdf> <map.json> <values.json> <out.pdf> [--keep-perms]'
    );
    process.exit(2);
  }
  const map = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
  const values = JSON.parse(fs.readFileSync(valuesPath, 'utf8'));
  const doc = await PDFDocument.load(fs.readFileSync(blankPath), {
    ignoreEncryption: true,
  });
  const report = fillNavmc10132(doc, map, values, {
    keepPerms: flags.includes('--keep-perms'),
  });
  const bytes = await doc.save({ useObjectStreams: false });
  fs.writeFileSync(outPath, bytes);

  console.log(`out      : ${outPath} (${bytes.length} bytes)`);
  console.log(`written  : ${report.written.length}`);
  console.log(`two-step : ${report.deferred.length} (${report.deferred.join(', ')})`);
  console.log(`skipped  : ${report.skipped.length}`);
  console.log(`errors   : ${report.errors.length}`);
  for (const [n, w] of report.errors) console.log(`   ERROR ${n}: ${w}`);
  for (const note of report.notes) console.log(`note     : ${note}`);
  process.exit(report.errors.length ? 1 : 0);
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
