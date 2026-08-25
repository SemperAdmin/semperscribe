/**
 * Verification gate for the four NAVMC 10132 sample templates, now living in
 * public/templates/global/ as *.nldp entries in that directory's index.json
 * (the app's actual template gallery, see src/hooks/useTemplates.ts, which
 * fetches only templates/global/index.json and templates/unit/index.json).
 * An earlier revision of this checker pointed at public/templates/navmc10132/,
 * a directory nothing in the app ever reads; that directory is left in place
 * per instruction but is no longer part of this gate.
 *
 * Modelled on tools/aa-forms/verify_10132_app_fill.mjs and
 * tools/aa-forms/tmp_check_unit_diary.mjs: loads the real TypeScript
 * modules through jiti with an @ alias, no build step required, no
 * re-implementation of any rule.
 *
 * For each of the four navmc10132 entries in global/index.json this loads
 * the .nldp JSON, feeds data.formData through the real modules, and asserts:
 *   - every url in global/index.json (all 69 entries, not just the four
 *     navmc10132 ones) resolves to a file actually present on disk. This is
 *     the failure mode that left the original four templates unreachable:
 *     a directory nothing reads, or a typo'd filename an index still points
 *     at, both look fine until something actually opens the file.
 *   - runNavmc10132Validators returns zero blocker-severity issues for each
 *     of the four navmc10132 templates. Warnings are printed, never fail
 *     the run.
 *   - every offense row's articleLabel resolves through resolveArticle.
 *   - renderPunishment does not throw on the template's punishment
 *     entries; the rendered item 6 text is printed.
 *   - unitDiaryBlock returns without throwing; reportable, missing, and
 *     excluded are printed.
 *   - for the mixed-finding template specifically, the Not Guilty row's
 *     MCTFS code does not appear in the unit diary OFFENSES section.
 *
 * Must be run from the repo root so jiti's alias resolves:
 *   node tools/aa-forms/tmp_check_templates.mjs
 *
 * Left in place per standing instruction, the mount blocks delete.
 */
import { createRequire } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
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

const { runNavmc10132Validators } = jiti('./src/lib/navmc10132-validators.ts');
const { resolveArticle } = jiti('./src/lib/navmc10132-articles.ts');
const { renderPunishment } = jiti('./src/lib/navmc10132-punishment-render.ts');
const { unitDiaryBlock } = jiti('./src/lib/navmc10132-unit-diary.ts');

const globalDir = path.join(root, 'public/templates/global');
const indexPath = path.join(globalDir, 'index.json');

let totalFail = 0;

function fail(msg) {
  console.error('FAIL - ' + msg);
  totalFail += 1;
}

function ok(msg) {
  console.log('PASS - ' + msg);
}

// ---------------------------------------------------------------------
// global/index.json sanity: every url resolves to a real file, for ALL
// 69 entries, not just the four navmc10132 ones. This is the assertion
// that would have caught the original mistake (a template whose url
// points nowhere the app ever reads, or a typo'd filename).
// ---------------------------------------------------------------------
console.log('='.repeat(78));
console.log('public/templates/global/index.json');
console.log('='.repeat(78));

const index = JSON.parse(readFileSync(indexPath, 'utf8'));
if (!Array.isArray(index)) {
  fail('global/index.json is not a JSON array');
  process.exit(1);
}
console.log(`total entries: ${index.length}`);

let urlFailures = 0;
for (const entry of index) {
  const rel = (entry.url ?? '').replace(/^\/templates\/global\//, '');
  const full = path.join(globalDir, rel);
  if (!entry.url || !entry.url.startsWith('/templates/global/') || !existsSync(full)) {
    fail(`index entry "${entry.id}" url "${entry.url}" does NOT resolve to a file on disk`);
    urlFailures += 1;
  }
}
if (urlFailures === 0) {
  ok(`all ${index.length} entries in global/index.json resolve to a file on disk`);
}

const navmc10132Entries = index.filter((e) => e.documentType === 'navmc10132');
if (navmc10132Entries.length !== 4) {
  fail(`expected exactly 4 navmc10132 entries in global/index.json, found ${navmc10132Entries.length}`);
} else {
  ok('global/index.json carries exactly 4 navmc10132 entries');
}

// ---------------------------------------------------------------------
// Per-template checks, navmc10132 entries only
// ---------------------------------------------------------------------
for (const entry of navmc10132Entries) {
  const rel = entry.url.replace(/^\/templates\/global\//, '');
  const full = path.join(globalDir, rel);

  console.log('');
  console.log('='.repeat(78));
  console.log(entry.id, '(', rel, ')');
  console.log('='.repeat(78));

  const doc = JSON.parse(readFileSync(full, 'utf8'));
  const formData = doc?.data?.formData;
  if (!formData) {
    fail(`${entry.id}: no data.formData in template file`);
    continue;
  }
  if (formData.documentType !== 'navmc10132') {
    fail(`${entry.id}: formData.documentType is "${formData.documentType}", expected "navmc10132"`);
  }

  // --- runNavmc10132Validators: zero blockers, warnings printed --------
  const issues = runNavmc10132Validators(formData);
  const blockers = issues.filter((i) => i.severity === 'block');
  const warnings = issues.filter((i) => i.severity !== 'block');

  if (blockers.length === 0) {
    ok(`${entry.id}: zero blocker-severity validator issues`);
  } else {
    fail(`${entry.id}: ${blockers.length} blocker-severity validator issue(s)`);
    for (const b of blockers) {
      console.error(`   BLOCK [${b.id}] ${b.rule}`);
      console.error(`         citation: ${b.citation}`);
      console.error(`         detail:   ${b.detail}`);
    }
  }

  console.log(`   warnings: ${warnings.length}`);
  for (const w of warnings) {
    console.log(`   WARN  [${w.id}] ${w.rule}`);
  }

  // --- every offense row's articleLabel resolves ------------------------
  const offenses = Array.isArray(formData.offenses) ? formData.offenses : [];
  let allArticlesResolve = true;
  for (const [i, o] of offenses.entries()) {
    const label = o?.articleLabel ?? '';
    if (label === '') continue;
    const article = resolveArticle(label);
    if (!article) {
      allArticlesResolve = false;
      fail(`${entry.id}: offense row ${i} articleLabel "${label}" does not resolve through resolveArticle`);
    }
  }
  if (allArticlesResolve) {
    ok(`${entry.id}: every non-empty offense row's articleLabel resolves through resolveArticle`);
  }

  // --- renderPunishment does not throw; print item 6 text --------------
  let item6 = null;
  try {
    const rendered = renderPunishment(formData.punishments ?? [], {
      concurrent: !!formData.punishmentsConcurrent,
    });
    item6 = rendered.text;
    ok(`${entry.id}: renderPunishment did not throw`);
    console.log(`   ITEM 6: ${rendered.text}`);
    console.log(`   ITEM 6 length: ${rendered.length}`);
  } catch (err) {
    fail(`${entry.id}: renderPunishment threw: ${err.message}`);
  }

  // --- unitDiaryBlock does not throw; print reportable/missing/excluded -
  let diary = null;
  try {
    diary = unitDiaryBlock(formData);
    ok(`${entry.id}: unitDiaryBlock did not throw`);
    console.log(`   reportable: ${diary.reportable}`);
    console.log(`   missing:    ${JSON.stringify(diary.missing)}`);
    console.log(`   excluded:   ${JSON.stringify(diary.excluded)}`);
    console.log('   --- unit diary text ---');
    for (const line of diary.text.split('\n')) console.log('   | ' + line);
    console.log('   --- end unit diary text ---');
  } catch (err) {
    fail(`${entry.id}: unitDiaryBlock threw: ${err.message}`);
  }

  // --- scenario-specific: mixed-finding template only -------------------
  if (entry.id === 'navmc10132-mixed-findings' && diary) {
    const notGuiltyRows = offenses.filter((o) => o?.finding === 'Not Guilty');
    if (notGuiltyRows.length === 0) {
      fail(`${entry.id}: expected at least one Not Guilty offense row, found none`);
    }
    for (const row of notGuiltyRows) {
      const article = resolveArticle(row.articleLabel);
      const code = article?.mctfsCode;
      if (!code) {
        fail(`${entry.id}: could not resolve MCTFS code for Not Guilty row "${row.articleLabel}"`);
        continue;
      }
      const offensesSectionMatch = diary.text.match(/OFFENSES \(guilty findings only\)\n([\s\S]*?)\n\n/);
      const offensesSection = offensesSectionMatch ? offensesSectionMatch[1] : '';
      const codeAppears = new RegExp(`\\b${code}\\b`).test(offensesSection);
      if (codeAppears) {
        fail(
          `${entry.id}: Not Guilty row's MCTFS code "${code}" appears in the unit diary OFFENSES section:\n${offensesSection}`
        );
      } else {
        ok(`${entry.id}: Not Guilty row's MCTFS code "${code}" is correctly absent from the OFFENSES section`);
      }
      const excludedHasIt = diary.excluded.some((e) => e.label === row.articleLabel);
      if (excludedHasIt) {
        ok(`${entry.id}: Not Guilty row is recorded in the diary's excluded list`);
      } else {
        fail(`${entry.id}: Not Guilty row is NOT recorded in the diary's excluded list`);
      }
    }
  }
}

console.log('');
console.log('='.repeat(78));
if (totalFail === 0) {
  console.log('ALL CHECKS PASSED');
} else {
  console.log(`${totalFail} CHECK(S) FAILED`);
  process.exitCode = 1;
}
