// Phase 7 gate test for the NAVMC 10132 AcroForm fill path.
//
// Exercises the generic engine in @/lib/acroform-fill against the real
// government blank in public/forms and the generated field map in
// tools/aa-forms, plus the 10132-specific value table and unlock list in
// @/lib/navmc10132-acroform.
//
// This suite depends on no DOM API, no fetch, and nothing from tests/setup.ts.
// The blank PDF and the field map are read straight off disk with node:fs, with
// paths resolved relative to this file rather than to the process cwd.
//
// ONE JSDOM TRAP, and it is not obvious. This project runs vitest with
// environment: 'jsdom'. Under jsdom the globals live in a different realm from
// Node's, so a Buffer straight out of readFileSync is NOT an instanceof the
// Uint8Array that pdf-lib checks against, and PDFDocument.load rejects it with
// "must be of type string or Uint8Array or ArrayBuffer, but was actually of
// type NaN". The bytes are fine, the constructor identity is not. Copying into
// a `new Uint8Array(...)` here puts the value in the same realm as pdf-lib and
// the load succeeds. Verified both directions with a probe. Do not "simplify"
// the copy away, and do not pass a raw Buffer into pdf-lib anywhere below.

import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
  PDFDocument,
  PDFName,
  PDFTextField,
  PDFDropdown,
  PDFCheckBox,
  PDFSignature,
} from 'pdf-lib';

import {
  fillAcroFormWithReport,
  fillAcroForm,
  type AcroFormFieldMeta,
} from '@/lib/acroform-fill';
import { NAVMC_10132_UNLOCK_READ_ONLY } from '@/lib/navmc10132-acroform';

// navmc10132-map.json lives under tools/aa-forms, outside src, so it is
// reached with a path relative to this test file rather than through the
// @ alias, which only covers ./src.
const here = dirname(fileURLToPath(import.meta.url));
const blankPdfPath = resolve(here, '../public/forms/navmc-10132-blank.pdf');
const mapPath = resolve(here, '../tools/aa-forms/navmc10132-map.json');

const EXPECTED_BLANK_SHA256 =
  '1e99e12dcd97789e744b3578ad8b56edea05773a38be3402fe171581f19effc8';

interface Navmc10132Map {
  fields: AcroFormFieldMeta[];
}

const blankBytes = new Uint8Array(readFileSync(blankPdfPath));
const map: Navmc10132Map = JSON.parse(readFileSync(mapPath, 'utf-8'));

/**
 * Hardcoded sorted list of the map's 74 field names, generated from the map
 * itself and pasted here so a regenerated map that silently adds, removes,
 * or renames a field is caught by a diff against this list rather than by
 * some downstream fill failure.
 */
const EXPECTED_FIELD_NAMES: readonly string[] = [
  '10 DATE OF DISPOSITION NOTICE',
  '11 APPEAL ADVISEMENT DATE_af_date',
  '11 APPEAL ADVISEMENT SIGNATURE',
  '12 APPEAL INTENT DATE_af_date',
  '12 APPEAL INTENT SIGNATURE',
  '12 INTEND APPEAL',
  '13 DATE OF APPEAL IF ANY_af_date',
  '13 NOT APPEALED',
  '14 APPEAL DECISION',
  '14 APPEAL DECISION DATE_af_date',
  '14 APPEAL DECISION SIGNATURE',
  '15 DATE OF NOTICE OF APPEAL DECISION_af_date',
  '16 FINAL ADMIN DTD',
  '16 FINAL ADMIN INIT',
  '16 FINAL ADMIN UD',
  '17 UNIT',
  '18 ACCUSED FULL NAME',
  '19 ACCUSED RANK/GRADE',
  '1A ARTICLE',
  '1A FINDING',
  '1A SUMMARY',
  '1B ARTICLE',
  '1B FINDING',
  '1B SUMMARY',
  '1C ARTICLE',
  '1C FINDING',
  '1C SUMMARY',
  '1D ARTICLE',
  '1D FINDING',
  '1D SUMMARY',
  '1E ARTICLE',
  '1E FINDING',
  '1E SUMMARY',
  '2 ACC ELECTION AND RIGHTS DATE_af_date',
  '2 ACC ELECTION AND RIGHTS SIGNATURE',
  '2 ACC REFUSE TO SIGN',
  '2 BOOKER',
  '2 COUNSELOPP',
  '2 DEMAND',
  '20 ACCUSED EDIPI',
  '21 REMARKS',
  '22A VICTIM ETHNICITY',
  '22A VICTIM RACE',
  '22A VICTIM SEX',
  '22A VICTIM STATUS',
  '22B VICTIM ETHNICITY',
  '22B VICTIM RACE',
  '22B VICTIM SEX',
  '22B VICTIM STATUS',
  '22C VICTIM ETHNICITY',
  '22C VICTIM RACE',
  '22C VICTIM SEX',
  '22C VICTIM STATUS',
  '22D VICTIM ETHNICITY',
  '22D VICTIM RACE',
  '22D VICTIM SEX',
  '22D VICTIM STATUS',
  '22E VICTIM ETHNICITY',
  '22E VICTIM RACE',
  '22E VICTIM SEX',
  '22E VICTIM STATUS',
  '23 ACCUSED FULL NAME',
  '24 ACCUSED RANK/GRADE',
  '25 ACCUSED EDIPI',
  '3 RIGHTS ATTEST DATE_af_date',
  '3 RIGHTS ATTEST SIGNATURE',
  '4 CURRENT UAS OVER 24 HRS AND MARKS OF DESERTION',
  '6 PUNISHMENT IMPOSED',
  '6 PUNISHMENT IMPOSITION DATE',
  '7 SUSPENSION IF ANY',
  '8 NJP AUTHORITY NAME TITLE SERVICE',
  '8A NJP AUTHORITY GRADE',
  '8B NJP AUTHORITY EDIPI',
  '9 NJP AUTHORITY SIGNATURE',
];

const SIGNATURE_FIELD_NAMES: readonly string[] = map.fields
  .filter((f) => f.type === '/Sig')
  .map((f) => f.name)
  .sort();

/**
 * Builds a value for every non-signature field in the map, so a fill of the
 * whole form can be driven without hand-listing 67 field names, and so a
 * newly added field is written (and therefore exercised) automatically
 * instead of being silently skipped.
 *
 * For a choice field the map marks exportDiffersFromDisplay, the pick
 * deliberately prefers an option whose export value differs from its
 * display text, so the round trip below exercises the two-step write path
 * rather than happening to dodge it. This is what surfaces the '1A FINDING'
 * through '1E FINDING' Guilty/G trap and the '2 COUNSELOPP' have/'   have'
 * trap instead of passing by accident.
 */
function buildFullValues(fields: AcroFormFieldMeta[]): Record<string, string | boolean> {
  const values: Record<string, string | boolean> = {};

  for (const field of fields) {
    if (field.type === '/Sig') continue;

    if (field.type === '/Tx') {
      values[field.name] = `TEST VALUE for ${field.name}`;
    } else if (field.type === '/Btn') {
      values[field.name] = true;
    } else if (field.type === '/Ch') {
      const exportValues = field.exportValues ?? [];
      const displayValues = field.displayValues ?? [];
      let pick: string | undefined;
      if (field.exportDiffersFromDisplay) {
        const diffIndex = exportValues.findIndex(
          (v, i) => v !== displayValues[i] && v.trim() !== '',
        );
        pick = diffIndex >= 0 ? exportValues[diffIndex] : undefined;
      }
      if (pick === undefined) {
        pick = exportValues.find((v) => v.trim() !== '');
      }
      if (pick === undefined) {
        throw new Error(`buildFullValues: no usable export value for ${field.name}`);
      }
      values[field.name] = pick;
    } else {
      throw new Error(`buildFullValues: unhandled field type ${field.type} for ${field.name}`);
    }
  }

  return values;
}

describe('Blank SHA guard', () => {
  it('the shipped blank PDF hashes to the recorded SHA-256', () => {
    const actual = createHash('sha256').update(blankBytes).digest('hex');
    expect(actual).toBe(EXPECTED_BLANK_SHA256);
  });
});

describe('Map-diff guard', () => {
  it('has exactly 74 fields', () => {
    expect(map.fields).toHaveLength(74);
  });

  it('has the exact hardcoded set of field names', () => {
    const actualNames = map.fields.map((f) => f.name).sort();
    expect(actualNames).toEqual(EXPECTED_FIELD_NAMES);
  });

  it('has exactly 7 /Sig type fields', () => {
    const sigCount = map.fields.filter((f) => f.type === '/Sig').length;
    expect(sigCount).toBe(7);
  });
});

describe('Full named round trip and dependent checks', () => {
  // Shared across this describe block's tests: one fill of the real blank
  // with a value for every writable field, reloaded once with pdf-lib. The
  // signature-untouched, read-only-restore, and export-value checks below
  // all read from this same filled document rather than re-filling it, so a
  // fill-order regression that only shows up once (not on a second fill of
  // fresh bytes) is not accidentally hidden by re-running the fill.
  let writtenValues: Record<string, string | boolean>;
  let reportWritten: string[];
  let reportDeferred: string[];
  let reportErrors: Array<[string, string]>;
  let reloaded: PDFDocument;

  beforeAll(async () => {
    writtenValues = buildFullValues(map.fields);
    const { bytes, report } = await fillAcroFormWithReport(blankBytes, writtenValues, {
      fields: map.fields,
      unlockReadOnly: NAVMC_10132_UNLOCK_READ_ONLY,
    });
    reportWritten = report.written;
    reportDeferred = report.deferred;
    reportErrors = report.errors;
    reloaded = await PDFDocument.load(bytes, { ignoreEncryption: true });
  });

  it('fills every named field with no engine errors', () => {
    expect(reportErrors).toEqual([]);
  });

  it('reports every non-signature field as written or deferred, with nothing left out', () => {
    // Two-step dropdowns (exportDiffersFromDisplay) land in report.deferred,
    // not report.written, because their /V patch happens after appearance
    // generation. Everything else lands in report.written. Between the two
    // lists, every field this fixture set a value for must be accounted
    // for, or a field silently got skipped by the engine.
    const expectedAll = Object.keys(writtenValues).sort();
    const actualAll = [...reportWritten, ...reportDeferred].sort();
    expect(actualAll).toEqual(expectedAll);

    const expectedDeferred = map.fields
      .filter((f) => f.type === '/Ch' && f.exportDiffersFromDisplay)
      .map((f) => f.name)
      .sort();
    expect([...reportDeferred].sort()).toEqual(expectedDeferred);
  });

  it('reads back the written value on every text field', () => {
    const form = reloaded.getForm();
    for (const meta of map.fields) {
      if (meta.type !== '/Tx') continue;
      const field = form.getField(meta.name);
      expect(field).toBeInstanceOf(PDFTextField);
      const expected = writtenValues[meta.name];
      expect((field as PDFTextField).getText()).toBe(expected);
    }
  });

  it('reads back the written export value on every choice field', () => {
    const form = reloaded.getForm();
    for (const meta of map.fields) {
      if (meta.type !== '/Ch') continue;
      const field = form.getField(meta.name);
      expect(field).toBeInstanceOf(PDFDropdown);
      const expected = writtenValues[meta.name];
      expect((field as PDFDropdown).getSelected()).toEqual([expected]);
    }
  });

  it('reads back the checked state on every checkbox field', () => {
    const form = reloaded.getForm();
    for (const meta of map.fields) {
      if (meta.type !== '/Btn') continue;
      const field = form.getField(meta.name);
      expect(field).toBeInstanceOf(PDFCheckBox);
      expect((field as PDFCheckBox).isChecked()).toBe(true);
    }
  });

  it('leaves all 7 signature widgets with no /V and still present', () => {
    const form = reloaded.getForm();
    expect(SIGNATURE_FIELD_NAMES).toHaveLength(7);
    for (const name of SIGNATURE_FIELD_NAMES) {
      const field = form.getField(name);
      expect(field).toBeInstanceOf(PDFSignature);
      expect(field.acroField.dict.has(PDFName.of('V'))).toBe(false);
    }
  });

  it('restores the read-only flag on every unlocked field, with its value still written', () => {
    const form = reloaded.getForm();
    expect(NAVMC_10132_UNLOCK_READ_ONLY.length).toBeGreaterThan(0);
    for (const name of NAVMC_10132_UNLOCK_READ_ONLY) {
      const field = form.getField(name);
      expect(field).toBeInstanceOf(PDFTextField);
      expect((field as PDFTextField).getText()).toBe(writtenValues[name]);
      expect(field.isReadOnly()).toBe(true);
    }
  });

  it('stores the export value, not the display value, on every field where they differ', () => {
    const form = reloaded.getForm();
    const diffFields = map.fields.filter((f) => f.type === '/Ch' && f.exportDiffersFromDisplay);
    // Sanity check on the fixture itself: the six known traps must all be
    // present, or this test would pass by finding nothing to check.
    expect(diffFields.map((f) => f.name).sort()).toEqual(
      ['1A FINDING', '1B FINDING', '1C FINDING', '1D FINDING', '1E FINDING', '2 COUNSELOPP'].sort(),
    );
    for (const meta of diffFields) {
      const field = form.getField(meta.name) as PDFDropdown;
      const stored = field.getSelected();
      expect(stored).toHaveLength(1);
      const exportValues = meta.exportValues ?? [];
      const displayValues = meta.displayValues ?? [];
      // The written value must be a real export value, and must not equal
      // the display text paired with it at that same slot. '1A FINDING'
      // stores 'Guilty', not 'G'. '2 COUNSELOPP' stores 'have', not
      // '   have'.
      expect(exportValues).toContain(stored[0]);
      const pairedIndex = exportValues.indexOf(stored[0]);
      expect(displayValues[pairedIndex]).not.toBe(stored[0]);
    }
  });

  it('names the exact stored value for each of the six known display/export traps', () => {
    const form = reloaded.getForm();
    for (const name of ['1A FINDING', '1B FINDING', '1C FINDING', '1D FINDING', '1E FINDING']) {
      const field = form.getField(name) as PDFDropdown;
      expect(field.getSelected()).toEqual(['Guilty']);
    }
    const counselOpp = form.getField('2 COUNSELOPP') as PDFDropdown;
    expect(counselOpp.getSelected()).toEqual(['have']);
  });
});

describe('Usage-rights strip', () => {
  it('doc.catalog carries /Root/Perms before any fill, so stripping has something to prove', async () => {
    const doc = await PDFDocument.load(blankBytes, { ignoreEncryption: true });
    expect(doc.catalog.has(PDFName.of('Perms'))).toBe(true);
  });

  it('removes /Root/Perms when stripUsageRights is true', async () => {
    const bytes = await fillAcroForm(
      blankBytes,
      { '17 UNIT': 'H&S Co, 1st Bn, 3d Mar' },
      { fields: map.fields, unlockReadOnly: NAVMC_10132_UNLOCK_READ_ONLY, stripUsageRights: true },
    );
    const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
    expect(doc.catalog.has(PDFName.of('Perms'))).toBe(false);
  });

  it('leaves /Root/Perms in place when stripUsageRights is false', async () => {
    const bytes = await fillAcroForm(
      blankBytes,
      { '17 UNIT': 'H&S Co, 1st Bn, 3d Mar' },
      { fields: map.fields, unlockReadOnly: NAVMC_10132_UNLOCK_READ_ONLY, stripUsageRights: false },
    );
    const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
    expect(doc.catalog.has(PDFName.of('Perms'))).toBe(true);
  });
});
