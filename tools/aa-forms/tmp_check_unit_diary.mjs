/**
 * Throwaway verification harness for src/lib/navmc10132-unit-diary.ts.
 *
 * Modelled on tools/aa-forms/verify_10132_app_fill.mjs: loads TypeScript
 * modules through jiti with an @ alias, no build step required.
 *
 * Usage: node tools/aa-forms/tmp_check_unit_diary.mjs
 */
import { createRequire } from 'node:module';
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

const { unitDiaryBlock } = jiti('./src/lib/navmc10132-unit-diary.ts');

let passCount = 0;
let failCount = 0;

function check(name, condition, detail) {
  if (condition) {
    console.log(`PASS - ${name}`);
    passCount++;
  } else {
    console.log(`FAIL - ${name}`);
    if (detail) console.log('       ' + detail);
    failCount++;
  }
}

function baseFormData(overrides = {}) {
  return {
    documentType: 'navmc10132',
    accusedName: 'SNUFFY, JOHN A',
    accusedRankGrade: 'Sgt, E5',
    accusedEdipi: '1234567890',
    unit: 'H&S BN, MCB QUANTICO',
    offenses: [
      { articleLabel: 'Art. 86  Absence without leave', summary: 'UA.', finding: 'Guilty' },
    ],
    punishments: [
      { code: 'N06', days: '7', suspendedFromDuty: true },
      { code: 'N13', days: '30' },
    ],
    punishmentsConcurrent: true,
    punishmentDate: '2026-08-20',
    suspension: 'SUSP 30 DAYS EXTRA DUTY',
    intendAppeal: 'I do not intend to appeal.',
    ...overrides,
  };
}

// --- Case 1: fully populated Guilty case ----------------------------------
{
  const result = unitDiaryBlock(baseFormData());
  check('case1 reportable true', result.reportable === true);
  check('case1 missing empty', result.missing.length === 0, JSON.stringify(result.missing));
  check('case1 excluded empty', result.excluded.length === 0, JSON.stringify(result.excluded));
  check('case1 text has MCTFS code 86', /\b86\b/.test(result.text));
  check('case1 text has N06', result.text.includes('N06'));
  check('case1 text has N13', result.text.includes('N13'));
}

// --- Case 2: one Guilty, one Not Guilty ------------------------------------
{
  const formData = baseFormData({
    offenses: [
      { articleLabel: 'Art. 86  Absence without leave', summary: 'UA.', finding: 'Guilty' },
      { articleLabel: 'Art. 92  Failure to obey other order or regulation', summary: 'x', finding: 'Not Guilty' },
    ],
  });
  const result = unitDiaryBlock(formData);
  check('case2 reportable true', result.reportable === true);
  check('case2 excluded has exactly one entry', result.excluded.length === 1, JSON.stringify(result.excluded));
  check('case2 text has NOT REPORTED section', result.text.includes('NOT REPORTED'));
  check(
    'case2 NOT REPORTED names the excluded row',
    result.text.includes('Art. 92  Failure to obey other order or regulation'),
    result.text
  );
}

// --- Case 3: every row Not Guilty ------------------------------------------
{
  const formData = baseFormData({
    offenses: [
      { articleLabel: 'Art. 86  Absence without leave', summary: 'UA.', finding: 'Not Guilty' },
      { articleLabel: 'Art. 92  Failure to obey other order or regulation', summary: 'x', finding: 'Not Guilty' },
    ],
  });
  const result = unitDiaryBlock(formData);
  check('case3 reportable false', result.reportable === false);
  check(
    'case3 text says no entry to make',
    /no unit diary entry to make/i.test(result.text),
    result.text
  );
  check('case3 excluded has two entries', result.excluded.length === 2, JSON.stringify(result.excluded));
}

// --- Case 4: empty accusedEdipi ---------------------------------------------
{
  const formData = baseFormData({ accusedEdipi: '' });
  const result = unitDiaryBlock(formData);
  check(
    'case4 missing names the EDIPI',
    result.missing.some((m) => /edipi/i.test(m)),
    JSON.stringify(result.missing)
  );
  check(
    'case4 text carries a bracketed marker on the EDIPI line',
    /EDIPI\s+\[MISSING\]/.test(result.text),
    result.text
  );
}

// --- Case 5: punishment entry missing a required parameter ------------------
{
  const formData = baseFormData({ punishments: [{ code: 'N06' }] });
  const result = unitDiaryBlock(formData);
  check('case5 block still returns', !!result.text);
  check(
    'case5 N06 line carries incomplete marker',
    /N06\s+\[incomplete:/.test(result.text),
    result.text
  );
  check(
    'case5 missing names N06',
    result.missing.some((m) => m.includes('N06')),
    JSON.stringify(result.missing)
  );
}

// --- Case 6: articleLabel not present in the article table ------------------
{
  const formData = baseFormData({
    offenses: [
      { articleLabel: 'Art. 999  Not a real article', summary: 'x', finding: 'Guilty' },
    ],
  });
  const result = unitDiaryBlock(formData);
  check(
    'case6 row lands in excluded',
    result.excluded.length === 1 && result.excluded[0].label === 'Art. 999  Not a real article',
    JSON.stringify(result.excluded)
  );
  check(
    'case6 row lands in missing',
    result.missing.some((m) => m.includes('Art. 999  Not a real article')),
    JSON.stringify(result.missing)
  );
}

// --- Case 7: intendAppeal empty ---------------------------------------------
{
  const formData = baseFormData({ intendAppeal: '' });
  const result = unitDiaryBlock(formData);
  check(
    'case7 missing does not name appeal',
    !result.missing.some((m) => /appeal/i.test(m)),
    JSON.stringify(result.missing)
  );
  check('case7 text carries not yet elected', result.text.includes('not yet elected'), result.text);
}

// --- Case 8: intendAppeal set ------------------------------------------------
{
  const formData = baseFormData({ intendAppeal: 'I do intend to appeal.' });
  const result = unitDiaryBlock(formData);
  check(
    'case8 text carries the value verbatim',
    result.text.includes('I do intend to appeal.'),
    result.text
  );
}

// --- Case 9: finalAdminUd set, finalAdminDtd set -----------------------------
{
  const formData = baseFormData({ finalAdminUd: '26-001234', finalAdminDtd: '2026-08-21' });
  const result = unitDiaryBlock(formData);
  check(
    'case9 alreadyReported non-null with both values',
    result.alreadyReported !== null &&
      result.alreadyReported.ud === '26-001234' &&
      result.alreadyReported.dtd === '2026-08-21',
    JSON.stringify(result.alreadyReported)
  );
  const marineIdx = result.text.indexOf('MARINE');
  const warnIdx = result.text.indexOf('ALREADY REPORTED');
  check(
    'case9 text carries ALREADY REPORTED above MARINE',
    warnIdx !== -1 && marineIdx !== -1 && warnIdx < marineIdx,
    result.text
  );
  check(
    'case9 UD ENTRY line carries the number',
    /UD ENTRY\s+26-001234/.test(result.text),
    result.text
  );
}

// --- Case 10: finalAdminUd set, finalAdminDtd empty --------------------------
{
  const formData = baseFormData({ finalAdminUd: '26-001234', finalAdminDtd: '' });
  const result = unitDiaryBlock(formData);
  check('case10 alreadyReported non-null', result.alreadyReported !== null, JSON.stringify(result.alreadyReported));
  check(
    'case10 no dangling "dated " with nothing after it',
    !/dated \./.test(result.text) && !/dated \n/.test(result.text) && !/dated $/m.test(result.text),
    result.text
  );
}

// --- Case 11: finalAdminUd empty ---------------------------------------------
{
  const formData = baseFormData({ finalAdminUd: '' });
  const result = unitDiaryBlock(formData);
  check('case11 alreadyReported null', result.alreadyReported === null);
  check(
    'case11 missing does not name it',
    !result.missing.some((m) => /final ?admin|ud entry|ud number/i.test(m)),
    JSON.stringify(result.missing)
  );
  check(
    'case11 UD ENTRY line reads [not yet recorded]',
    /UD ENTRY\s+\[not yet recorded\]/.test(result.text),
    result.text
  );
}

// --- Case 12: no Guilty finding AND finalAdminUd set -------------------------
{
  const formData = baseFormData({
    offenses: [
      { articleLabel: 'Art. 86  Absence without leave', summary: 'UA.', finding: 'Not Guilty' },
    ],
    finalAdminUd: '26-005555',
    finalAdminDtd: '2026-08-22',
  });
  const result = unitDiaryBlock(formData);
  check('case12 reportable false', result.reportable === false);
  check('case12 alreadyReported non-null', result.alreadyReported !== null, JSON.stringify(result.alreadyReported));
  check('case12 text carries ALREADY REPORTED', result.text.includes('ALREADY REPORTED'), result.text);
  check(
    'case12 text carries no-entry-to-make statement',
    /no unit diary entry to make/i.test(result.text),
    result.text
  );
}

console.log('');
console.log(`TOTAL: ${passCount} passed, ${failCount} failed`);
if (failCount > 0) process.exitCode = 1;
