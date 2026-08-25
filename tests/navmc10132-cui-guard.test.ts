// Guard: no app-generated document module hardcodes a CUI control marking.
//
// WHY THIS EXISTS. Decision row D-48 (docs/NAVMC_10132_SPEC.md): Stephen
// ruled "no CUI at head and foot" on the app-generated Figure 14-1 letter,
// which MCO 5800.16 Vol 14 Figure 14-1 itself prints CUI above the SSIC
// block and again below Copy to. He GENERALIZED that ruling past the one
// figure: reproducing a source figure, form, or template reproduces its
// STRUCTURE, never its control markings. A marking this app printed on its
// own authority would assert a designation the app has no basis to make,
// the same reasoning behind the standing "CUI Pending" ban (section 6.3 and
// decision row D-13). Marking stays a USER decision, made only through
// src/lib/classification.ts, never something a document-generating module
// decides on the user's behalf.
//
// THE CODEBASE COMPLIES TODAY. Zero occurrences of the literal string CUI
// in any of the modules scanned below (verified 2026-08-25). This test
// exists to keep it that way. A guard that scans nothing and passes
// trivially is worse than no guard at all, so the sanity checks below prove
// the scan actually read real file content and that its own detection
// mechanism can in fact find the string, the same shape the two meta guards
// in tests/navmc10132-export-gate.test.ts use for their own sanity checks.
//
// WHAT IS SCANNED, AND WHY THIS SET RATHER THAN ALL OF src/lib. This test
// names, by hand, the modules whose job is composing the PROSE OR RENDERED
// TEXT of a document this app hands to a user, not every module that
// happens to touch a document:
//
//   - jagman-appendix-a1.ts: the JAGMAN Appendix A-1 forms, reproduced
//     VERBATIM from the source instruction. The most direct case D-48's
//     generalized rule addresses: a source figure reproduced here, one
//     paragraph the rule exists to keep out of.
//   - njp-vacation-handoff.ts: the Figure 14-1 notice of intent to vacate.
//     D-48's original subject.
//   - njp-a1-rights.ts, njp-a1-script.ts: the Article 31 rights
//     notification / election form and the NJP hearing script, both
//     generated from JAGMAN appendices.
//   - njp-appeal-package.ts: the appeal package narrative forwarded to
//     higher authority.
//   - navmc10132-remarks.ts, navmc10132-punishment-render.ts,
//     navmc10132-suspension-render.ts: the item 21 remark composer and the
//     item 6 / item 7 renderers, which compose the free text that prints
//     on the NAVMC 10132 itself.
//
// DELIBERATELY LEFT OUT, AND WHY:
//   - classification.ts: this IS the marking authority. It is SUPPOSED to
//     carry the string CUI; scanning it would either trip this guard on the
//     one module that correctly implements the user's own marking decision,
//     or force an exclusion entry that hides the real signal from a reader
//     scanning this file. Used below instead as the CANARY that proves the
//     detection mechanism itself works.
//   - navmc10132-acroform.ts, navmc10132-booker.ts, navmc10132-articles.ts:
//     these select or derive VALUES for fields the form already defines (a
//     date, a checkbox, a generated crosswalk code); none of them compose
//     new document prose the way the scanned modules do.
//   - jagman-a1-fill.ts, jagman-a1-pdf.ts, jagman-a1-wrap.ts: generic
//     layout engines that, by their own docstrings, "know nothing about
//     NJP, offenses, or punishment" and place only caller-supplied text.
//     See limitation 1 below: a marking hardcoded into one of these as a
//     constant is out of this guard's scope.
//   - njp-package.ts: UI readiness bookkeeping (which documents are
//     available yet, and why), not document content.
//
// WHAT THIS CANNOT CATCH, ON PURPOSE STATED HERE, MATCHING THE HOUSE
// PATTERN OF THE TWO META GUARDS IN tests/navmc10132-export-gate.test.ts:
//   1. A marking added to a module OUTSIDE the scanned list above,
//      including the three generic layout engines named there, or any
//      future document-generating module nobody adds to the list. The
//      sanity checks below guard against the list silently shrinking to
//      nothing or the scan silently reading no content; they cannot guard
//      against a new generator this list does not yet know about.
//   2. A marking spelled to dodge a literal substring match: split across
//      string concatenation, built from character codes, or assigned to a
//      constant whose NAME does not contain "CUI" but whose VALUE does,
//      routed through indirection this scan does not trace. This is a
//      source-text substring scan, not a data-flow or constant-folding
//      analysis.
//   3. A marking that is not the literal string "CUI" at all, e.g. a
//      differently worded control marking this test was never written to
//      recognize.
// ===========================================================================

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * The exact detection this guard relies on: a literal, case-sensitive
 * substring match for "CUI". Case-sensitive on purpose: the marking Figure
 * 14-1 prints, and the one classification.ts renders, is always the
 * three-letter uppercase indicator, never a lowercase mention of the word
 * inside ordinary prose (this codebase has none, but a lowercase "cui" is
 * not the marking this guard exists to catch).
 */
function containsCuiMarking(src: string): boolean {
  return src.includes('CUI');
}

describe('Meta: no document-generating module hardcodes a CUI marking', () => {
  it('finds zero literal CUI occurrences in the modules that compose document content', () => {
    const libDir = join(__dirname, '..', 'src', 'lib');

    // Deliberately a hand-picked list, not a directory glob. See the file
    // header above for what is in this list and why, and what is left out
    // and why.
    const SCANNED_SOURCE_FILES = [
      'jagman-appendix-a1.ts',
      'njp-vacation-handoff.ts',
      'njp-a1-rights.ts',
      'njp-a1-script.ts',
      'njp-appeal-package.ts',
      'navmc10132-remarks.ts',
      'navmc10132-punishment-render.ts',
      'navmc10132-suspension-render.ts',
    ];

    type Offense = { file: string; line: number; text: string };
    const offenders: Offense[] = [];
    let totalCharsScanned = 0;

    for (const fileName of SCANNED_SOURCE_FILES) {
      // readFileSync throws on a missing file, which is exactly right here:
      // a typo'd filename must fail loudly, not be silently skipped as
      // "nothing found".
      const src = readFileSync(join(libDir, fileName), 'utf-8');
      totalCharsScanned += src.length;

      if (!containsCuiMarking(src)) continue;
      src.split('\n').forEach((line, i) => {
        if (containsCuiMarking(line)) {
          offenders.push({ file: fileName, line: i + 1, text: line.trim() });
        }
      });
    }

    // SANITY CHECK 1: the scan actually read real file content, not empty
    // files or a list that resolved to nothing. Mirrors the "if this finds
    // nothing, the regex or file list broke" sanity check both meta guards
    // in tests/navmc10132-export-gate.test.ts carry.
    expect(SCANNED_SOURCE_FILES.length).toBeGreaterThan(0);
    expect(totalCharsScanned).toBeGreaterThan(2000);

    // SANITY CHECK 2, THE CANARY: prove containsCuiMarking itself can find
    // the string, by running the IDENTICAL function against
    // classification.ts, the one module that is SUPPOSED to carry it (it
    // is the marking authority, deliberately excluded from
    // SCANNED_SOURCE_FILES above). If this assertion ever fails, the
    // detection mechanism is broken and the "zero occurrences" result below
    // would be meaningless, passing for the wrong reason, the same trap the
    // export-gate meta guards' own sanity checks exist to catch.
    const classificationSrc = readFileSync(join(libDir, 'classification.ts'), 'utf-8');
    expect(containsCuiMarking(classificationSrc)).toBe(true);

    expect(
      offenders,
      offenders.length
        ? 'A document-generating module hardcodes the literal string CUI. Stephen ruled ' +
          '(decision row D-48, docs/NAVMC_10132_SPEC.md, 2026-08-25) that this app never ' +
          'prints a CUI marking on a generated document: reproducing a source figure, form, ' +
          'or template reproduces its STRUCTURE, never its control markings, because a ' +
          'marking the app prints on its own authority asserts a designation the app has no ' +
          'basis to make. Marking is a USER decision, made only through ' +
          'src/lib/classification.ts. Remove the hardcoded marking from the document module ' +
          'instead of adding an exclusion here; if the intent is genuinely to let a document ' +
          'assert its own classification independent of the user\'s own setting, that needs a ' +
          'new ruling from Stephen, not a quiet exception to this test:\n  ' +
          offenders.map((o) => `${o.file}:${o.line}: ${o.text}`).join('\n  ')
        : undefined,
    ).toEqual([]);
  });
});
