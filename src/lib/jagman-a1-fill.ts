/**
 * Generic fill engine for JAGMAN Appendix A-1 forms (src/lib/jagman-appendix-a1.ts).
 *
 * This module knows nothing about NJP, offenses, or punishment. It knows how
 * to locate an anchor line inside one appendix's verbatim text and write
 * caller-supplied lines into the blank the appendix already prints there.
 * Callers own every word of `value`. This module never authors, paraphrases,
 * reflows, or re-indents a line of appendix text on its own account. The one
 * exception, documented at applyFillRule below, is preserving a rule line's
 * OWN trailing punctuation, which is appendix text, not something callers
 * are expected to supply, added only when the caller's own text does not
 * already end a sentence.
 *
 * An anchor matching zero or more than one line is not an exception.
 * It is recorded in the report and the text is left untouched, because the
 * appendix text is regenerated from the extractor's own instruction, and an
 * anchor going stale under a re-extraction has to fail loudly and locally
 * rather than silently mis-fill a rights form.
 */

import type { JagmanAppendix } from '@/lib/jagman-appendix-a1';
import { appendixWidth, wrapHanging } from '@/lib/jagman-a1-wrap';

export type A1FillMode = 'replaceNote' | 'fillRule' | 'replaceInline';

export interface A1Fill {
  /** Stable id for diagnostics and tests. */
  id: string;
  /** Exact substring identifying the anchor LINE. Must match exactly one line. */
  anchor: string;
  mode: A1FillMode;
  /** How `anchor` is matched against a line. Default 'substring' for
   *  compatibility. 'exact' compares against the trimmed line, and exists
   *  for a short anchor whose only content is otherwise a substring of a
   *  longer, unrelated line elsewhere in the same appendix (e.g. a bare
   *  underscore-and-period blank also serving as the tail of a longer
   *  rule line). Use it rather than padding the anchor with surrounding
   *  content not truly distinguishing. */
  anchorMatch?: 'substring' | 'exact';
  /** Lines to write. Callers supply already-formatted, already-width-safe text. */
  value: readonly string[];
}

export interface A1FillReport {
  applied: string[];
  /** Fills whose anchor matched no line, or more than one. */
  unmatched: Array<[string, string]>;
  /** Anchors matched but with no rule/note to write into. */
  noTarget: Array<[string, string]>;
}

/** A line whose only characters are whitespace and underscores, with an
 *  optional single trailing period, matches trivially on a wholly blank
 *  line too (zero characters vacuously "consist only of" the set). That is
 *  intentional: several rule blocks in the real appendices separate each
 *  underscore line with a blank spacer line rather than stacking them
 *  consecutively (for example A-1-f's "violation(s) of the ... Justice:"
 *  block), and the run has to absorb those spacers to reach every rule
 *  line, not stop at the first one. */
const RULE_OR_BLANK_LINE = /^[ \t_]*\.?$/;

/** Leading whitespace run at the start of a line. */
function leadingWhitespace(line: string): string {
  return line.match(/^[ \t]*/)?.[0] ?? '';
}

/** Finds the single line index matching `anchor`, either as a substring or
 *  (with anchorMatch 'exact') as the whole trimmed line.
 *  Returns null when the anchor matches zero or more than one line. */
function findAnchorLine(
  lines: readonly string[],
  anchor: string,
  anchorMatch: 'substring' | 'exact',
): number | null {
  const matches: number[] = [];
  lines.forEach((line, idx) => {
    const isMatch = anchorMatch === 'exact' ? line.trim() === anchor : line.includes(anchor);
    if (isMatch) {
      matches.push(idx);
    }
  });
  return matches.length === 1 ? matches[0] : null;
}

/**
 * replaceNote: the anchor line IS a parenthetical instruction to the
 * preparer, e.g. "(Note: Here describe the offenses ...)". The note spans
 * one or more consecutive lines until the line ending in ")". The whole
 * block is replaced by `value`, every line indented to the ANCHOR line's
 * own leading whitespace (not each original continuation line's, which the
 * appendix does not keep consistent - see A-1-c vs A-1-d paragraph 1).
 *
 * Returns false (noTarget) when no closing ")" is ever found, which would
 * mean the anchor matched a line only shaped like a note opening.
 */
function applyReplaceNote(lines: string[], fill: A1Fill, anchorIdx: number): boolean {
  let closeIdx = anchorIdx;
  while (closeIdx < lines.length && !lines[closeIdx].trimEnd().endsWith(')')) {
    closeIdx++;
  }
  if (closeIdx >= lines.length) {
    return false;
  }
  const indent = leadingWhitespace(lines[anchorIdx]);
  const replacement = fill.value.map((v) => indent + v);
  lines.splice(anchorIdx, closeIdx - anchorIdx + 1, ...replacement);
  return true;
}

/** A line ending in one of the three characters that already close a
 *  sentence. Used to decide whether a rule line's own trailing period
 *  still belongs on the end of caller-supplied text, or would double it
 *  up (renderPunishment, for one, already returns text ending in "."). */
const ENDS_SENTENCE = /[.?!]$/;

/**
 * fillRule: the anchor line is prose. Immediately after it, a contiguous
 * run of RULE_OR_BLANK_LINE lines follows. Within the run, the actual
 * "rules" are the lines containing at least one underscore - a wholly
 * blank line in the run is a spacer, not a rule, and is left untouched.
 *
 * Each rule line is filled in order from `value`. When `value` has fewer
 * lines than there are rules, the leftover rules are left exactly as
 * printed (still blank, per the rule "keep the remaining rules blank").
 * When `value` has more lines than there are rules, every value line is
 * kept: the extra lines are inserted immediately after the run's last rule
 * line, growing the form, and nothing already printed is deleted.
 *
 * The run's LAST rule line often carries its own trailing period, closing
 * a sentence the run opened (e.g. "... punishment: ______."). That period
 * is appendix text, not part of `value`, and belongs at the true end of
 * the filled text - which, once a caller's value has been wrapped to
 * width and spread across more physical lines than there are rule slots,
 * is the last element of `value` overall, not necessarily whatever lands
 * in the last original rule slot. It is added there only when that last
 * value line does not already end a sentence itself: renderPunishment and
 * similar callers can return text already ending in ".", "?", or "!", and
 * appending the appendix's own period on top would double it.
 */
function applyFillRule(lines: string[], fill: A1Fill, anchorIdx: number): boolean {
  const runIndices: number[] = [];
  let i = anchorIdx + 1;
  while (i < lines.length && RULE_OR_BLANK_LINE.test(lines[i])) {
    runIndices.push(i);
    i++;
  }
  const ruleIndices = runIndices.filter((idx) => lines[idx].includes('_'));
  if (ruleIndices.length === 0) {
    return false;
  }

  const indent = leadingWhitespace(lines[ruleIndices[0]]);
  const lastRuleTrailing =
    lines[ruleIndices[ruleIndices.length - 1]].match(/\.[ \t]*$/)?.[0] ?? '';
  const lastValueIdx = fill.value.length - 1;

  const withTrailing = (v: string, n: number): string =>
    n === lastValueIdx && lastRuleTrailing !== '' && !ENDS_SENTENCE.test(v) ? v + lastRuleTrailing : v;

  // Value lines are written CONTIGUOUSLY from the first rule, not mapped one
  // to one onto the rule slots.
  //
  // Some rule blocks separate their rules with a blank spacer line, A-1-f's
  // opening violation list among them. Mapping slot by slot dropped a
  // wrapped value's continuation into the NEXT slot, so a two-line offense
  // printed with a blank line through the middle of the sentence:
  //
  //     Art. 86  Absence without leave. UA from 0730 to 1500, 14
  //
  //     Aug 26, H&S Bn, MCB Quantico.
  //
  // Wrapping is the caller's, and its lines belong together. Any rule slot
  // left over keeps its rule exactly as printed, so an unused second
  // violation line still has somewhere to be written by hand.
  const firstRule = ruleIndices[0];
  const written = fill.value.map((v, n) => indent + withTrailing(v, n));

  // Rules consumed by the write, counted from the first, so the leftover
  // rules are the ones past whatever the contiguous block covers.
  const consumed = ruleIndices.filter((idx) => idx < firstRule + written.length);
  lines.splice(firstRule, consumed.length, ...written);

  return true;
}

/** The two bracket shapes a preparer instruction is printed in across the
 *  appendices: "(identify the superior authority ...)" and
 *  "[insert current edition]". Whichever opens first on the line wins. */
const INLINE_BRACKETS: ReadonlyArray<{ open: string; close: string }> = [
  { open: '(', close: ')' },
  { open: '[', close: ']' },
];

function findOpenBracket(line: string): { openIdx: number; close: string } | null {
  let best: { openIdx: number; close: string } | null = null;
  for (const { open, close } of INLINE_BRACKETS) {
    const idx = line.indexOf(open);
    if (idx !== -1 && (best === null || idx < best.openIdx)) {
      best = { openIdx: idx, close };
    }
  }
  return best;
}

/**
 * replaceInline: the anchor line contains an inline underscore run or an
 * inline bracketed instruction to replace in place. `value` must be
 * exactly one line. Everything before and after the matched span is
 * preserved.
 *
 * Span location, in order: first an inline `_+` run on the anchor line
 * itself is preferred (e.g. the caption blanks, or a single-line inline
 * blank like A-1-f's appeal-advisor blank). Otherwise the first inline
 * "(" or "[" on the line is located and its matching ")" or "]" is
 * searched for, scanning forward line by line exactly as applyReplaceNote
 * does, because real appendix data has at least one parenthetical
 * instruction opening on the anchor line without closing there (A-1-f's
 * appeal-authority instruction spans two physical lines).
 *
 * When the span crosses lines, prefix, value, and suffix are joined into
 * ONE logical string (never left with the suffix stranded on its own
 * line, which would orphan the appendix's own closing punctuation at the
 * front of the next physical line) and re-wrapped to `width`, replacing
 * the whole original span. The wrapped result can run to fewer, the same,
 * or more physical lines than the original span - the appendix already
 * grows and shrinks around a fillRule fill, and a replaceInline span does
 * the same once it has to flow real prose around a variable-length value.
 * A span spanning three or more physical lines before any fill is not
 * implemented - none of the appendices need one today.
 *
 * Returns false (noTarget) when the anchor line has neither an inline
 * underscore run nor an inline bracket to replace, and throws when
 * `value` does not carry exactly one line, since this is a caller
 * programming error, not appendix drift.
 */
/**
 * Splice `prefix + value + suffix` over the span [anchorIdx, closeLineIdx],
 * wrapped to the appendix measure and keeping the anchor line's own left
 * margin on every resulting line.
 *
 * Both replaceInline branches route through here. The underscore branch
 * used to return early without wrapping, which let a value longer than the
 * rule it replaced run past the fixed width: the appeal advisor fill
 * produced a 72 column line against a 65 column form while every content
 * assertion passed.
 */
function spliceWrapped(
  lines: string[],
  anchorIdx: number,
  closeLineIdx: number,
  prefix: string,
  value: string,
  suffix: string,
  width: number,
): void {
  const margin = leadingWhitespace(lines[anchorIdx]);
  const joined = prefix + value + suffix;
  const content = joined.startsWith(margin) ? joined.slice(margin.length) : joined;
  const budget = Math.max(width - margin.length, 1);
  const replacement = wrapHanging(content, budget).map((wrapped) => margin + wrapped);
  lines.splice(anchorIdx, closeLineIdx - anchorIdx + 1, ...replacement);
}

function applyReplaceInline(lines: string[], fill: A1Fill, anchorIdx: number, width: number): boolean {
  if (fill.value.length !== 1) {
    throw new Error(
      `Fill "${fill.id}": replaceInline requires exactly one value line, got ${fill.value.length}.`,
    );
  }
  const value = fill.value[0];
  const line = lines[anchorIdx];

  const underscoreMatch = line.match(/_+/);
  if (underscoreMatch && underscoreMatch.index !== undefined) {
    const start = underscoreMatch.index;
    const end = start + underscoreMatch[0].length;
    spliceWrapped(lines, anchorIdx, anchorIdx, line.slice(0, start), value, line.slice(end), width);
    return true;
  }

  const opened = findOpenBracket(line);
  if (opened === null) {
    return false;
  }
  const { openIdx, close } = opened;

  let closeLineIdx = anchorIdx;
  let closeCharIdx = line.indexOf(close, openIdx);
  while (closeCharIdx === -1 && closeLineIdx + 1 < lines.length) {
    closeLineIdx++;
    closeCharIdx = lines[closeLineIdx].indexOf(close);
  }
  if (closeCharIdx === -1) {
    return false;
  }

  const prefix = line.slice(0, openIdx);
  const suffix = lines[closeLineIdx].slice(closeCharIdx + 1);

  // Same-line and cross-line spans take the identical path. A cross-line
  // span collapses onto the value's own line rather than stranding its
  // suffix behind the original indent, which is what produced
  // "      . Your appeal must be timely." on the real appendix.
  spliceWrapped(lines, anchorIdx, closeLineIdx, prefix, value, suffix, width);
  return true;
}

/** Applies `fills` in order against one appendix's verbatim text. Fills are
 *  applied sequentially against the SAME mutable line array, so a later
 *  fill's anchor search sees the effect of every earlier fill - callers
 *  are expected to give each fill a non-overlapping anchor, which every
 *  fill list in this codebase does. */
export function fillAppendix(
  appendix: JagmanAppendix,
  fills: readonly A1Fill[],
): { lines: string[]; report: A1FillReport } {
  const lines = [...appendix.text];
  const report: A1FillReport = { applied: [], unmatched: [], noTarget: [] };
  // Read once from the ORIGINAL appendix text, per jagman-a1-wrap.ts - used
  // only by applyReplaceInline's cross-line span rewrap (defect 3), since
  // that is the one place this engine does its own line wrapping rather
  // than trusting already-width-safe caller-supplied `value` lines.
  const width = appendixWidth(appendix);

  for (const fill of fills) {
    const anchorIdx = findAnchorLine(lines, fill.anchor, fill.anchorMatch ?? 'substring');
    if (anchorIdx === null) {
      report.unmatched.push([fill.id, fill.anchor]);
      continue;
    }

    let applied: boolean;
    switch (fill.mode) {
      case 'replaceNote':
        applied = applyReplaceNote(lines, fill, anchorIdx);
        break;
      case 'fillRule':
        applied = applyFillRule(lines, fill, anchorIdx);
        break;
      case 'replaceInline':
        applied = applyReplaceInline(lines, fill, anchorIdx, width);
        break;
    }

    if (applied) {
      report.applied.push(fill.id);
    } else {
      report.noTarget.push([fill.id, fill.anchor]);
    }
  }

  return { lines, report };
}

/** Convenience: throws when any fill failed. Use where a partial form is unacceptable. */
export function fillAppendixStrict(appendix: JagmanAppendix, fills: readonly A1Fill[]): string[] {
  const { lines, report } = fillAppendix(appendix, fills);
  if (report.unmatched.length > 0 || report.noTarget.length > 0) {
    const problems = [
      ...report.unmatched.map(([id, anchor]) => `unmatched "${id}" (anchor "${anchor}")`),
      ...report.noTarget.map(([id, anchor]) => `no target "${id}" (anchor "${anchor}")`),
    ];
    throw new Error(
      `fillAppendixStrict failed for ${appendix.designator}: ${problems.join(', ')}`,
    );
  }
  return lines;
}
