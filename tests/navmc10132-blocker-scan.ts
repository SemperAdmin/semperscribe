// Shared source scanner for the NAVMC 10132 export-gate meta guards in
// tests/navmc10132-export-gate.test.ts.
//
// WHY THIS EXISTS. Three meta guards in that file each built their own
// copy of "which files to scan" and "how to find a block-severity rule id
// in the source text." The coordinator measured the drift directly: the
// original id-extraction regex, `issue\(\s*[`'"]([^`'"]+)[`'"]\s*,...`,
// stops a quoted id at the FIRST quote character of ANY kind — backtick,
// single, or double. That is wrong for a backtick template containing a
// single-quoted literal inside a `${...}` expression, which is exactly
// what navmc10132-v09-overflow-${field.toLowerCase().replace(/[^a-z0-9]+/g,
// '-')}` in navmc10132-validators-identity.ts is: the `'-'` inside
// `.replace()` is a single quote sitting before the id's own closing
// backtick, so the regex's match never completes and V-09 is invisible to
// it. Measured file by file (raw 'block' occurrences in the source text,
// including comments and the severity type union / real call sites the
// old regex actually captured):
//
//   offenses.ts     5 raw / 4 real call sites / 4 captured (correct by luck: no template ids here)
//   dates.ts        4 raw / 4 real call sites / 4 captured (same)
//   punishment.ts  32 raw / 22 real call sites / 22 captured (same)
//   identity.ts     6 raw / 4 real call sites / 3 captured, AND NEVER SCANNED AT ALL
//
// identity.ts was excluded from the two original meta guards on the
// stated grounds that the eleven rules those guards were built to prove
// never touched it. That reasoning never covered what the guards actually
// protect against: identity.ts carries its own block-severity rules
// (V-09 through V-12), exposed to the identical unproven-blocker and
// misdocumented-severity defects as any rule in the other three files,
// and nothing was checking them. A guard whose own coverage nobody
// measured is the exact failure this whole exercise exists to eliminate,
// so this module exists to make that coverage a single, provable thing
// instead of three independently-trusted copies.

/**
 * The canonical file list every NAVMC 10132 export-gate meta guard scans.
 * All four rule modules. identity.ts is INCLUDED, not excluded the way it
 * was before this module existed — see the file header above for why that
 * exclusion was wrong.
 *
 * If a future module is ever deliberately left out of these guards, the
 * exclusion and its stated reason belong HERE, in the one shared list, so
 * every guard sees the same reasoning — never as a silent omission
 * reintroduced in one caller's own copy of a file list.
 */
export const NAVMC10132_VALIDATOR_MODULES: readonly string[] = [
  'navmc10132-validators-offenses.ts',
  'navmc10132-validators-dates.ts',
  'navmc10132-validators-punishment.ts',
  'navmc10132-validators-identity.ts',
];

/**
 * Extracts every `issue(<id>, 'block', ...)` (or `"block"`) call site's
 * static id prefix from one file's source text — the part every id that
 * call site ever emits at runtime is guaranteed to start with.
 *
 * THE FIX. The first argument must be matched as ONE balanced unit before
 * the severity argument is even looked for: a backtick template running
 * to its own closing backtick (never stopping early at a quote nested
 * inside a `${...}` expression), or a single- or double-quoted literal
 * running to its own closing quote. This is a source-text pattern match,
 * not a type-checked AST walk, matching the house convention already
 * documented on the guards that use it — it does not defend against a
 * severity chosen via a variable, a ternary, or a differently-named local
 * helper.
 *
 * Returns one entry per call site, NOT deduplicated by id prefix. Two
 * distinct source locations can legitimately share a literal id prefix
 * (navmc10132-v20-forfeiture-over-ceiling- in
 * navmc10132-validators-punishment.ts has one call site in the dollars
 * branch and one in the dollarsPerMonth branch); callers that only care
 * about the set of distinct prefixes dedupe themselves, the same way the
 * guards that use this already do for their own bookkeeping (counting
 * distinct `${file}:${idPrefix}` keys, not raw call sites).
 */
export function extractBlockSeverityRuleIds(src: string): string[] {
  const RE = /issue\(\s*(?:`([^`]*)`|'([^']*)'|"([^"]*)")\s*,\s*['"]block['"]/g;
  const ids: string[] = [];
  let match: RegExpExecArray | null;
  RE.lastIndex = 0;
  while ((match = RE.exec(src)) !== null) {
    const rawId = match[1] ?? match[2] ?? match[3] ?? '';
    const templateStart = rawId.indexOf('${');
    ids.push(templateStart === -1 ? rawId : rawId.slice(0, templateStart));
  }
  return ids;
}

/**
 * A deliberately simpler, independently-computed count of the same real
 * call sites `extractBlockSeverityRuleIds` finds, used only to prove that
 * function is not silently under-counting. This is NOT the same
 * regex machinery: it does not anchor to `issue(` and does not try to
 * capture or balance the id argument at all, it only looks for the shape
 * every real severity ARGUMENT has, a comma closing the id argument
 * before it and a comma opening the rule argument after it —
 * `, 'block',` or `, "block",`. A bare mention of 'block' in the
 * severity type union (`'block' | 'fail' | 'warn'`, no comma before) or
 * in prose ("severity 'block' and", no comma before) does not have a
 * comma on both sides and is correctly not counted.
 *
 * Deliberately independent so a bug shared between the two counting
 * methods cannot make them silently agree on the wrong number, which is
 * the whole point of comparing them at all.
 */
export function countBlockSeverityArguments(src: string): number {
  const matches = src.match(/,\s*['"]block['"]\s*,/g);
  return matches ? matches.length : 0;
}
