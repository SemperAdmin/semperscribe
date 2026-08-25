/**
 * JAGMAN A-1-f generator: the commanding officer's NJP proceeding guide,
 * the hearing script itself.
 *
 * renderNjpScript fills what is known going into and coming out of the
 * hearing (the violations read at the top, the findings and punishment
 * announced at the end, and the appeal authority/advisor) and leaves every
 * ACC: and WIT: response line untouched - those are filled by hand, at the
 * hearing, in real time, and this module never sees the accused's or a
 * witness's actual words.
 */

import { APPENDIX_A_1_F, type JagmanAppendix } from '@/lib/jagman-appendix-a1';
import { fillAppendix, type A1Fill, type A1FillReport } from '@/lib/jagman-a1-fill';
import { appendixWidth, wrapHanging } from '@/lib/jagman-a1-wrap';

/**
 * The leading whitespace fillRule will apply at `anchor`, read off the
 * appendix rather than assumed.
 *
 * fillRule indents whatever it writes to match the FIRST rule line under
 * the anchor. A caller wrapping its value has to know that margin, because
 * the margin's own characters count against the appendix's fixed measure.
 * Wrapping to the full width and then having the engine add six spaces is
 * how a line ends up over-long, which is defect 1.
 *
 * Returns an empty string when the anchor or its rule run cannot be found.
 * The fill itself then reports the miss through the normal report path, so
 * failing soft here loses nothing.
 */
function ruleIndent(appendix: JagmanAppendix, anchor: string): string {
  const at = appendix.text.findIndex((line) => line.includes(anchor));
  if (at < 0) return '';
  for (let i = at + 1; i < appendix.text.length; i += 1) {
    const line = appendix.text[i];
    if (line.includes('_')) {
      return line.slice(0, line.length - line.trimStart().length);
    }
    if (line.trim() !== '') break;
  }
  return '';
}

/** Wrap `values` to what is left of the appendix measure after the margin
 *  fillRule applies at `anchor`. No lettering: see formatOffenses below. */
function fitToRule(
  appendix: JagmanAppendix,
  anchor: string,
  values: readonly string[],
): string[] {
  const budget = Math.max(appendixWidth(appendix) - ruleIndent(appendix, anchor).length, 1);
  return values.flatMap((value) => wrapHanging(value, budget));
}

/** What is known AT the hearing. Extends the pre-hearing set. */
export interface NjpScriptCase {
  offenses: ReadonlyArray<{ articleLabel: string; summary: string }>;
  /** Announced at the end. Empty string leaves the rule blank. */
  findings: readonly string[];
  /** Already rendered by renderPunishment. Empty leaves the rule blank. */
  punishmentImposed: string;
  /** Superior authority by name and organizational title, JAGMAN 0116/0117. */
  appealAuthority: string;
  /** Who advises the accused more fully of the appeal right. */
  appealAdvisor: string;
}

/** No item-lettering here: A-1-f reads the violations aloud at a hearing,
 *  where a lettered "A. Article 92 ..." would be read as prose anyway, so
 *  this module does not carry njp-a1-rights.ts's A-through-E-and-onward
 *  convention (which itself follows the NAVMC 10132 item 21 overflow
 *  instruction, not a cap). A sixth or later offense here simply grows
 *  the rule block, per jagman-a1-fill.ts's documented fillRule growth. */
function formatOffenses(offenses: NjpScriptCase['offenses']): string[] {
  return offenses.map((o) => `${o.articleLabel}. ${o.summary}`);
}

/** Anchors, named once so the wrap budget and the fill agree on the site.
 *  Each was confirmed to match exactly one line of APPENDIX_A_1_F. */
const VIOLATIONS_ANCHOR = 'of the Uniform Code of Military Justice:';
const FINDINGS_ANCHOR = 'I find that you have committed the following offenses:';
const PUNISHMENT_ANCHOR = 'Accordingly, I impose the following punishment:';

export function renderNjpScript(
  input: NjpScriptCase,
): { lines: string[]; report: A1FillReport } {
  const fills: A1Fill[] = [];

  if (input.offenses.length > 0) {
    fills.push({
      id: 'violations',
      anchor: VIOLATIONS_ANCHOR,
      mode: 'fillRule',
      value: fitToRule(APPENDIX_A_1_F, VIOLATIONS_ANCHOR, formatOffenses(input.offenses)),
    });
  }

  if (input.findings.length > 0) {
    fills.push({
      id: 'findings',
      anchor: FINDINGS_ANCHOR,
      mode: 'fillRule',
      value: fitToRule(APPENDIX_A_1_F, FINDINGS_ANCHOR, input.findings),
    });
  }

  if (input.punishmentImposed !== '') {
    fills.push({
      id: 'punishment',
      anchor: PUNISHMENT_ANCHOR,
      mode: 'fillRule',
      value: fitToRule(APPENDIX_A_1_F, PUNISHMENT_ANCHOR, [input.punishmentImposed]),
    });
  }

  fills.push(
    {
      id: 'appeal-authority',
      anchor: '(identify the superior authority by name and',
      mode: 'replaceInline',
      value: [input.appealAuthority],
    },
    {
      id: 'appeal-advisor',
      anchor: 'will advise you more fully of',
      mode: 'replaceInline',
      value: [input.appealAdvisor],
    },
  );

  return fillAppendix(APPENDIX_A_1_F, fills);
}
