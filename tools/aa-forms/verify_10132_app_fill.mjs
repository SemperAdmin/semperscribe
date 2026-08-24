/**
 * Phase 5 gate: runs the APP'S OWN value table and fill engine against the
 * real bundled blank, outside the browser.
 *
 * Not a re-implementation. It loads src/lib/navmc10132-acroform.ts and
 * src/lib/acroform-fill.ts through jiti, so what runs here is the same code
 * the preview and the export run. The only substitution is the blank: the
 * browser fetches it over HTTP, this reads it from public/forms.
 *
 * Output goes to tools/aa-forms/out/navmc10132-app-fill.pdf for
 * verify_10132_roundtrip.py, which reads it with pypdf so pdf-lib never
 * grades its own work.
 *
 * Usage: node tools/aa-forms/verify_10132_app_fill.mjs
 */
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..');

const createJiti = require('jiti');
const jiti = createJiti(root + '/', {
  interopDefault: true,
  esmResolve: true,
  alias: { '@': path.join(root, 'src') },
});

const { navmc10132Values, NAVMC_10132_UNLOCK_READ_ONLY } = jiti('./src/lib/navmc10132-acroform.ts');
const { fillAcroFormWithReport } = jiti('./src/lib/acroform-fill.ts');
const fieldMap = JSON.parse(readFileSync(path.join(root, 'tools/aa-forms/navmc10132-map.json'), 'utf8'));

// A filled UPB with one offense, a finding, two punishments running
// concurrently, remarks, and both accused blocks. Chosen so every distinct
// write path in navmc10132Values fires at least once: plain text, a two-step
// dropdown (findings), a checkbox, a derived string (Booker, punishment),
// and the duplicated accused block.
const formData = {
  documentType: 'navmc10132',
  accusedName: 'SNUFFY, JOHN A',
  accusedRankGrade: 'Sgt, E5',
  accusedEdipi: '1234567890',
  unit: 'H&S BN, MCB QUANTICO',
  offenses: [
    {
      articleLabel: 'Art. 86  Absence without leave',
      summary: 'UA from 0730 to 1500, 14 Aug 26, H&S Bn, MCB Quantico.',
      finding: 'Guilty',
    },
  ],
  // Byte-exact against the form's own /Opt. A near-miss is rejected by the
  // fill engine rather than written, which is the behaviour under test.
  demand:
    'I do not demand trial and will accept non-judicial punishment, subject to my right of appeal.',
  counselOpportunity: 'have',
  electionDate: '2026-08-18',
  rightsAttestDate: '2026-08-18',
  dispositionNoticeDate: '2026-08-20',
  appealAdvisementDate: '2026-08-20',
  intendAppeal: 'I do not intend to appeal.',
  appealIntentDate: '2026-08-20',
  notAppealed: true,
  finalAdminDtd: '2026-08-21',
  accusedRefusedToSign: false,
  // Parameter names come from each code's `parameters` list in
  // navmc10132-punishments.ts. A wrong name makes renderPunishment throw,
  // item 6 come back undefined, and the ASSERT below fail loudly rather than
  // the PDF shipping silently short one field.
  punishments: [
    { code: 'N06', days: '7', suspendedFromDuty: true },
    { code: 'N13', days: '30' },
  ],
  punishmentsConcurrent: true,
  punishmentDate: '2026-08-20',
  unauthorizedAbsences: 'NONE',
  suspension: 'ZZTESTZZ SUSPENSION MARKER',
  njpAuthorityName: 'ROBERTS, MARIA L',
  njpAuthorityGrade: 'LtCol, O5',
  njpAuthorityEdipi: '9876543210',
  remarks: [],
  remarksFreeText: 'ZZTESTZZ REMARK MARKER',
};

const values = navmc10132Values(formData);
const base = readFileSync(path.join(root, 'public/forms/navmc-10132-blank.pdf'));
const bytes = await fillAcroFormWithReport(
  base.buffer.slice(base.byteOffset, base.byteOffset + base.byteLength),
  values,
  {
    fields: fieldMap.fields,
    unlockReadOnly: [...NAVMC_10132_UNLOCK_READ_ONLY],
    stripUsageRights: true,
  }
);

const out = bytes.bytes ?? bytes;
const report = bytes.report ?? null;

const outDir = path.join(root, 'tools/aa-forms/out');
mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, 'navmc10132-app-fill.pdf');
writeFileSync(outPath, Buffer.from(out));

// Item 6 is derived by renderPunishment, which THROWS on a malformed entry.
// navmc10132Values catches that and omits the field so a mid-entry preview
// still paints. Silence is right for the preview and wrong for a gate, so the
// gate asserts the field is present.
if (!values['6 PUNISHMENT IMPOSED']) {
  console.error(
    'ASSERT FAILED: 6 PUNISHMENT IMPOSED is empty. renderPunishment rejected '
    + 'the punishment entries, check each code\'s parameter names against '
    + 'navmc10132-punishments.ts.'
  );
  process.exitCode = 1;
} else if (formData.punishmentsConcurrent && !/to run concurrently/.test(values['6 PUNISHMENT IMPOSED'])) {
  console.error(
    'ASSERT FAILED: punishmentsConcurrent is set but item 6 carries no '
    + '"to run concurrently" clause. The flag is not reaching renderPunishment.'
  );
  process.exitCode = 1;
} else {
  console.log('ITEM 6  :', values['6 PUNISHMENT IMPOSED']);
}

console.log('VALUES WRITTEN:', Object.keys(values).length);
console.log('OUT:', outPath, Buffer.from(out).length, 'bytes');
if (report) {
  console.log('written :', report.written.length);
  console.log('deferred:', report.deferred.length, report.deferred.join(', '));
  console.log('skipped :', report.skipped.length);
  for (const [n, why] of report.skipped) console.log('   SKIP', n, '-', why);
  console.log('errors  :', report.errors.length);
  for (const [n, why] of report.errors) console.log('   ERR ', n, '-', why);
  for (const n of report.notes) console.log('   NOTE', n);
}
