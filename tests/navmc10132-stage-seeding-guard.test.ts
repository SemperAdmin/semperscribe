import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { join, extname } from 'path';

// ===========================================================================
// D-43 REGRESSION HISTORY, READ BEFORE TOUCHING THIS FILE:
//
// navmc10132ExportGateStage (src/types/navmc.ts) defaults an ABSENT `stage`
// to 'complete' on purpose: an old document saved before the field existed
// is likelier finished than freshly started, and reading it as pass 1 would
// silently drop real export blockers. navmc10132Stage (the UI helper)
// defaults an absent `stage` to 1, for the opposite reason: a document that
// genuinely has no stage yet is most likely brand new.
//
// Those two defaults only agree with each other if a NEW document actually
// carries `stage`. They did not. The two real entry points that switch
// `documentType` to 'navmc10132' - the onClick in
// src/components/letter/DocumentTypeSection.tsx and
// handleDocumentTypeChange in src/app/page.tsx - never set `stage`, so on
// every fresh NAVMC 10132 the field was undefined. navmc10132Stage read
// that as pass 1 and the selector showed "Notification". The export gate
// read the same undefined value as 'complete' and fired every blocker from
// every later pass. Both helpers were doing exactly what they were built to
// do; the bug was an assumption held in one place while another place
// defaulted differently, and it was invisible to any test that only
// exercised the helpers in isolation.
//
// Both real entry points now seed `stage: prev.stage ?? 1` alongside the
// documentType switch. This file is the guard against a THIRD entry point
// being added later without the same seed. It does not re-test the fix in
// the two known files - tests/components/DocumentTypeSection.test.tsx does
// that directly, by rendering the real component and clicking the real
// card. This file instead scans all of src/ for the shape of the bug
// itself: any setFormData(...) call that can produce 'navmc10132' as the
// FormData without also assigning `stage` somewhere in that same call.
//
// The scanner is proven against synthetic source below, on the same
// principle applied to the shared blocker scanner after D-43 found META1
// and META2 silently under-scanning: a guard whose own coverage is never
// measured is the bug, not the fix.
// ===========================================================================

const SRC_DIR = join(__dirname, '..', 'src');

/**
 * Finds every top-level occurrence of `${calleeName}(...)` in `src` and
 * returns the full matched text of each call, from the callee name through
 * its balanced closing parenthesis. Balancing skips characters inside
 * single-quoted, double-quoted, and template-literal strings (including
 * escaped quote characters) so a stray `(` or `)` inside a string argument
 * cannot mismatch the count. This mirrors the quote-aware scanning already
 * used by extractBlockSeverityRuleIds in tests/navmc10132-blocker-scan.ts,
 * for the same reason: naive counting misfires on realistic source text.
 */
export function extractCallSpans(src: string, calleeName: string): string[] {
  const spans: string[] = [];
  const marker = `${calleeName}(`;
  let searchFrom = 0;
  while (true) {
    const start = src.indexOf(marker, searchFrom);
    if (start === -1) break;
    let depth = 0;
    let i = start + calleeName.length;
    let inString: '"' | "'" | '`' | null = null;
    let end = src.length;
    for (; i < src.length; i++) {
      const ch = src[i];
      if (inString) {
        if (ch === '\\') {
          i++;
          continue;
        }
        if (ch === inString) inString = null;
        continue;
      }
      if (ch === '"' || ch === "'" || ch === '`') {
        inString = ch;
        continue;
      }
      if (ch === '(') {
        depth++;
      } else if (ch === ')') {
        depth--;
        if (depth === 0) {
          end = i + 1;
          break;
        }
      }
    }
    spans.push(src.slice(start, end));
    searchFrom = end;
  }
  return spans;
}

/**
 * A setFormData(...) call is a stage-seeding violation if it can set
 * documentType toward 'navmc10132' (the literal string appears anywhere in
 * the call, which catches both a direct `documentType: 'navmc10132'` and a
 * conditional built from a comparison like `newType === 'navmc10132'`) but
 * never assigns a `stage` key anywhere in that same call.
 */
export function findStageSeedingViolations(src: string): string[] {
  return extractCallSpans(src, 'setFormData').filter(
    (span) => span.includes("'navmc10132'") && !/\bstage\s*:/.test(span),
  );
}

function listSourceFiles(dir: string): string[] {
  const entries = readdirSync(dir, { recursive: true }) as string[];
  return entries
    .filter((entry) => entry.endsWith('.ts') || entry.endsWith('.tsx'))
    .filter((entry) => !entry.endsWith('.d.ts'))
    .map((entry) => join(dir, entry));
}

describe('Meta: the stage-seeding scanner itself, proven on synthetic source before it is trusted on real source', () => {
  it('finds a single setFormData call and returns its exact balanced text', () => {
    const src = `foo(); setFormData(prev => ({ ...prev, documentType: 'basic' })); bar();`;
    const spans = extractCallSpans(src, 'setFormData');
    expect(spans).toEqual([`setFormData(prev => ({ ...prev, documentType: 'basic' }))`]);
  });

  it('does not miscount parentheses inside a string argument', () => {
    const src = `setFormData(prev => ({ ...prev, note: 'has a ) paren inside', documentType: 'navmc10132', stage: 1 }))`;
    const spans = extractCallSpans(src, 'setFormData');
    expect(spans).toHaveLength(1);
    expect(spans[0].endsWith('stage: 1 }))')).toBe(true);
  });

  it('does not miscount parentheses from a nested function call inside the same setFormData call', () => {
    const src =
      `setDate={(d) => setFormData(prev => ({ ...prev, cancellationDate: d ? format(d, 'yyyy-MM-dd') : '' }))}`;
    const spans = extractCallSpans(src, 'setFormData');
    expect(spans).toEqual([
      `setFormData(prev => ({ ...prev, cancellationDate: d ? format(d, 'yyyy-MM-dd') : '' }))`,
    ]);
  });

  it('separates two setFormData calls in the same source blob rather than spanning from the first to the last', () => {
    const src = `
      onClick={() => setFormData(prev => ({ ...prev, documentType: 'basic' }))}
      onClick={() => setFormData(prev => ({ ...prev, documentType: 'page11' }))}
    `;
    const spans = extractCallSpans(src, 'setFormData');
    expect(spans).toHaveLength(2);
    expect(spans[0]).toContain("'basic'");
    expect(spans[0]).not.toContain("'page11'");
    expect(spans[1]).toContain("'page11'");
  });

  it('flags a setFormData call that can reach navmc10132 without seeding stage', () => {
    const src = `setFormData(prev => ({ ...prev, documentType: 'navmc10132' }))`;
    expect(findStageSeedingViolations(src)).toEqual([src]);
  });

  it('does not flag a setFormData call that seeds stage alongside navmc10132', () => {
    const src = `setFormData(prev => ({ ...prev, documentType: 'navmc10132', stage: prev.stage ?? 1 }))`;
    expect(findStageSeedingViolations(src)).toEqual([]);
  });

  it('does not flag a setFormData call that reaches navmc10132 only through a dynamic comparison, as long as stage is assigned in the same call', () => {
    // This is the actual shape of handleDocumentTypeChange in page.tsx: the
    // assigned documentType value is a variable, not the literal string, but
    // 'navmc10132' still appears in the call via the comparison that gates
    // the stage seed itself.
    const src =
      `setFormData(prev => ({ ...prev, documentType: newType, stage: newType === 'navmc10132' ? (prev.stage ?? 1) : prev.stage }))`;
    expect(findStageSeedingViolations(src)).toEqual([]);
  });

  it('does not flag a setFormData call unrelated to navmc10132 at all', () => {
    const src = `setFormData(prev => ({ ...prev, documentType: 'basic' }))`;
    expect(findStageSeedingViolations(src)).toEqual([]);
  });
});

describe('The stage-seeding guard, run against the real source tree', () => {
  it('scans a non-trivial number of source files, so an empty result cannot mean nothing was scanned', () => {
    const files = listSourceFiles(SRC_DIR);
    expect(files.length).toBeGreaterThan(50);
  });

  it('finds at least the two known setFormData calls that reach navmc10132, so an empty violation list cannot mean the scan matched nothing', () => {
    const files = listSourceFiles(SRC_DIR);
    let matchedSpans = 0;
    for (const file of files) {
      const src = readFileSync(file, 'utf8');
      matchedSpans += extractCallSpans(src, 'setFormData').filter((span) =>
        span.includes("'navmc10132'"),
      ).length;
    }
    expect(matchedSpans).toBeGreaterThanOrEqual(2);
  });

  it('every setFormData call in src that can reach navmc10132 also seeds stage in the same call', () => {
    const files = listSourceFiles(SRC_DIR);
    const violations: string[] = [];
    for (const file of files) {
      const src = readFileSync(file, 'utf8');
      for (const span of findStageSeedingViolations(src)) {
        violations.push(`${file}:\n    ${span}`);
      }
    }

    expect(
      violations,
      violations.length
        ? 'The following setFormData call(s) can set documentType toward navmc10132 ' +
          'without seeding stage in the same call. A fresh NAVMC 10132 document whose ' +
          'stage is never set reads as stage 1 in the UI (navmc10132Stage) and as stage ' +
          "'complete' in the export gate (navmc10132ExportGateStage) at the same time, " +
          'which is the D-43 defect. Seed stage alongside documentType the way the two ' +
          'existing entry points do, preserving an already-set value with ?? 1 rather ' +
          'than rewinding it:\n\n' + violations.join('\n\n')
        : undefined,
    ).toEqual([]);
  });
});

// ===========================================================================
// WHAT THIS GUARD CANNOT CATCH, ON PURPOSE STATED HERE:
//   1. It only recognizes calls literally named `setFormData(`. A future
//      entry point that renames its state setter, destructures it under a
//      different local name, or reaches FormData through a reducer/dispatch
//      pattern instead of useState's setter is invisible to this scan.
//   2. It requires the literal substring 'navmc10132' to appear somewhere
//      inside the same setFormData(...) call as the documentType write, and
//      this is a real gap, not a theoretical one: reverting page.tsx's fix
//      down to `stage: (prev as FormData).stage` (no comparison against
//      'navmc10132' left anywhere in that call, since the fix's own
//      comparison was the only thing that put the literal there) made this
//      guard blind to that call while catching DocumentTypeSection.tsx's
//      revert. A future entry point that sets documentType from a bare
//      variable, with no nearby literal or comparison naming
//      'navmc10132' at all, is invisible to this scan the same way. The
//      "matched at least two calls" sanity check above exists because of
//      this exact finding, so a coverage drop of this shape at least fails
//      loudly instead of passing silently, but it does not identify which
//      call went missing or fix the blindness.
//   3. It requires a `stage` key to appear ANYWHERE in the same call, not
//      that the value assigned makes sense. `stage: undefined` or
//      `stage: NaN` would satisfy this guard while still being wrong; this
//      only proves the assumption was addressed, not that it was addressed
//      correctly. tests/components/DocumentTypeSection.test.tsx proves the
//      one entry point it reaches actually produces the right value; this
//      guard has no equivalent proof for handleDocumentTypeChange in
//      page.tsx, which renders the whole app shell and was judged too heavy
//      to bring under render-based test in this delivery.
//   4. It is scoped to src/. A setFormData call added under a different top
//      level directory, or FormData constructed by a script or migration
//      outside the React tree entirely, is outside this scan.
// ===========================================================================
