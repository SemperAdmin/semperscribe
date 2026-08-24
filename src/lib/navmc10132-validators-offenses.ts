/**
 * NAVMC 10132 validators, item 1 (offenses) and item 5 (findings) plus the
 * cross-checks item 4 (unauthorized absence) and item 22 (victims) run
 * against them.
 *
 * Every issue carries a real citation. Blockers use severity 'block' and
 * gate export. Warnings use severity 'warn' and never gate anything, the
 * commander decides.
 */

import { FormData } from '@/types';
// TYPE-ONLY. letter-validators imports this module at runtime, so a value
// import here would create a module cycle.
import type { ValidationIssue } from '@/lib/letter-validators';
import { resolveArticle } from '@/lib/navmc10132-utils';
import type { Navmc10132Offense, Navmc10132Victim } from '@/types/navmc';

function issue(
  id: string, severity: ValidationIssue['severity'],
  rule: string, citation: string, detail: string,
): ValidationIssue {
  return { id, severity, rule, citation, detail };
}

/** Item 1 offense rows, padded defensively. FormData is loosely typed. */
function offenseRows(formData: FormData): Navmc10132Offense[] {
  const value = (formData as unknown as Record<string, unknown>).offenses;
  return Array.isArray(value) ? (value as Navmc10132Offense[]) : [];
}

/** Item 22 victim rows, padded defensively. FormData is loosely typed. */
function victimRows(formData: FormData): Navmc10132Victim[] {
  const value = (formData as unknown as Record<string, unknown>).victims;
  return Array.isArray(value) ? (value as Navmc10132Victim[]) : [];
}

/**
 * Row letters A through E, in item order, for readable issue detail text.
 * The form has exactly five offense rows.
 */
const ROW_LETTERS = ['A', 'B', 'C', 'D', 'E'];

/**
 * Article 85 (desertion) and 86 (absence without leave) prefixes. Labels
 * look like "Art. 86  Absence without leave" with two spaces after the
 * number on the official blank, but do not rely on the double space being
 * the only spacing the app ever produces. Match the article number as a
 * prefix token, not the whole label.
 */
function isArticle85Or86(articleLabel: string): boolean {
  return /^Art\.\s*8[56]\b/.test(articleLabel.trim());
}

/**
 * Article number prefixes for offenses where a victim is DEFINITIONAL
 * rather than incidental, for W-12 only. This list is an app heuristic,
 * not drawn from any controlling source, see the citation on
 * victimsWithoutVictimOffense.
 *
 * The list is deliberately narrow and high-confidence rather than
 * exhaustive. The form offers roughly 167 offenses and a meaningfully
 * larger set than this could plausibly involve a victim, but W-12 only
 * uses this list to PROMPT for a missing item 22 entry, never to flag one
 * as wrong. A missed offense here just costs a prompt the preparer did
 * not get, not a false accusation against a real record, so narrowness is
 * the safe direction and completeness is not worth chasing.
 *
 * Kept local and independent of resolveArticle, which is documented to
 * expose notOrdinarilyMinor and nothing about victims.
 */
const VICTIM_ARTICLE_PREFIXES = [
  '93', // cruelty and maltreatment
  '118', // murder
  '119', // manslaughter
  '119a', // death or injury of an unborn child
  '119b', // child endangerment
  '120', // rape and sexual assault generally
  '120b', // rape and sexual assault of a child
  '120c', // other sexual misconduct
  '122', // robbery
  '125', // kidnapping
  '127', // extortion
  '128', // assault
  '128a', // maiming
  '128b', // domestic violence
  '130', // stalking
];

function articleClearlyInvolvesVictim(articleLabel: string): boolean {
  const match = articleLabel.trim().match(/^Art\.\s*(\d+[a-z]?)\b/);
  if (!match) return false;
  return VICTIM_ARTICLE_PREFIXES.includes(match[1]);
}

/**
 * V-01: at least one offense row carries an article.
 *
 * The official form does NOT self-enforce this. Its item 1 /V (validate)
 * script tests event.target.name against "1A ARTICLE" or "1A OFFENSE", and
 * that identical script is copy-pasted onto rows B through E without the
 * row letter updated, so the inner test can never be true for those rows.
 * "1A OFFENSE" is also not a field on the document at all. The app must
 * enforce item 1's requirement itself because the form cannot.
 */
export function offenseArticlePresent(formData: FormData): ValidationIssue[] {
  const rows = offenseRows(formData);
  const hasArticle = rows.some((row) => (row?.articleLabel ?? '').trim() !== '');
  if (hasArticle) return [];
  return [
    issue(
      'navmc10132-offense-article-present',
      'block',
      'No offense row has an article selected.',
      'Item 1 instruction. Defect 3.5 means the form does not self-enforce this.',
      'Select an article for at least one offense row before export.',
    ),
  ];
}

/**
 * V-02: every row that has an article also has a summary.
 */
export function offenseSummaryPresent(formData: FormData): ValidationIssue[] {
  const rows = offenseRows(formData);
  const issues: ValidationIssue[] = [];
  rows.forEach((row, i) => {
    const hasArticle = (row?.articleLabel ?? '').trim() !== '';
    const hasSummary = (row?.summary ?? '').trim() !== '';
    if (hasArticle && !hasSummary) {
      issues.push(issue(
        `navmc10132-offense-summary-present-${ROW_LETTERS[i] ?? i}`,
        'block',
        `Offense row ${ROW_LETTERS[i] ?? i + 1} has an article but no summary.`,
        'Item 1 instruction.',
        `Enter a summary for row ${ROW_LETTERS[i] ?? i + 1}, or remove its article.`,
      ));
    }
  });
  return issues;
}

/**
 * V-03: a finding is present only on a row that has an article.
 *
 * The item 5 instruction says to leave findings blank where there is no
 * corresponding offense.
 */
export function offenseFindingRequiresArticle(formData: FormData): ValidationIssue[] {
  const rows = offenseRows(formData);
  const issues: ValidationIssue[] = [];
  rows.forEach((row, i) => {
    const hasArticle = (row?.articleLabel ?? '').trim() !== '';
    const hasFinding = (row?.finding ?? '') !== '';
    if (hasFinding && !hasArticle) {
      issues.push(issue(
        `navmc10132-offense-finding-requires-article-${ROW_LETTERS[i] ?? i}`,
        'block',
        `Offense row ${ROW_LETTERS[i] ?? i + 1} has a finding but no offense.`,
        'Item 5 instruction.',
        `Clear the finding on row ${ROW_LETTERS[i] ?? i + 1}, or enter its offense.`,
      ));
    }
  });
  return issues;
}

/**
 * V-13: punishment in item 6 requires at least one finding of exactly
 * 'Guilty', unless item 6 begins with "none".
 *
 * Reproduces the form's own item-6 /V (validate) script, which the app
 * must run itself because pdf-lib does not execute field scripts. Matches
 * the script's own substring(0,4).toLowerCase() test, so only the first
 * four characters of the trimmed text are checked against "none", not the
 * whole word.
 */
export function punishmentRequiresGuiltyFinding(formData: FormData): ValidationIssue[] {
  const punishmentImposed = ((formData as { punishmentImposed?: string }).punishmentImposed ?? '');
  if (punishmentImposed === '') return [];
  const trimmed = punishmentImposed.trim();
  if (trimmed.substring(0, 4).toLowerCase() === 'none') return [];
  const rows = offenseRows(formData);
  const hasGuilty = rows.some((row) => row?.finding === 'Guilty');
  if (hasGuilty) return [];
  return [
    issue(
      'navmc10132-punishment-requires-guilty-finding',
      'block',
      'Item 6 imposes punishment but no offense row is marked Guilty.',
      "The form's own item-6 validate script, reproduced in the app because pdf-lib does not run it.",
      'Mark at least one offense row Guilty, or start item 6 with "None".',
    ),
  ];
}

/**
 * W-01: an offense is ordinarily not a minor offense, so NJP is
 * questionable.
 *
 * Paraphrases MCM Part V para 1.e: a minor offense ordinarily carries no
 * dishonorable discharge and no confinement over one year if tried by
 * general court-martial. Warn only, the commander decides.
 */
export function offenseOrdinarilyNotMinor(formData: FormData): ValidationIssue[] {
  const rows = offenseRows(formData);
  const issues: ValidationIssue[] = [];
  rows.forEach((row, i) => {
    const label = (row?.articleLabel ?? '').trim();
    if (label === '') return;
    const article = resolveArticle(label);
    if (article && article.notOrdinarilyMinor) {
      issues.push(issue(
        `navmc10132-offense-not-minor-${ROW_LETTERS[i] ?? i}`,
        'warn',
        `Offense row ${ROW_LETTERS[i] ?? i + 1} is ordinarily not a minor offense, so NJP is questionable.`,
        'MCM Part V para 1.e: a minor offense ordinarily carries no dishonorable discharge and no confinement over one year at general court-martial.',
        'Confirm the commander has weighed whether this offense is appropriate for NJP rather than court-martial.',
      ));
    }
  });
  return issues;
}

/**
 * W-02: item 4 is populated but no Article 85 or 86 offense is selected.
 */
export function item4WithoutArticle85Or86(formData: FormData): ValidationIssue[] {
  const item4 = ((formData as { unauthorizedAbsences?: string }).unauthorizedAbsences ?? '').trim();
  if (item4 === '') return [];
  const rows = offenseRows(formData);
  const has8586 = rows.some((row) => isArticle85Or86(row?.articleLabel ?? ''));
  if (has8586) return [];
  return [
    issue(
      'navmc10132-item4-without-article-85-86',
      'warn',
      'Item 4 is populated but no Article 85 or 86 offense is selected.',
      'Item 4 instruction.',
      'Select an Article 85 or 86 offense, or clear item 4 if it does not apply.',
    ),
  ];
}

/**
 * W-03: an Article 85 or 86 offense is selected but item 4 is empty.
 */
export function article85Or86WithoutItem4(formData: FormData): ValidationIssue[] {
  const item4 = ((formData as { unauthorizedAbsences?: string }).unauthorizedAbsences ?? '').trim();
  if (item4 !== '') return [];
  const rows = offenseRows(formData);
  const has8586 = rows.some((row) => isArticle85Or86(row?.articleLabel ?? ''));
  if (!has8586) return [];
  return [
    issue(
      'navmc10132-article-85-86-without-item4',
      'warn',
      'An Article 85 or 86 offense is selected but item 4 is empty.',
      'Item 4 instruction.',
      'Complete item 4 for the unauthorized absence or marks of desertion.',
    ),
  ];
}

/**
 * W-12: a selected offense clearly involves a victim, and item 22 records
 * no victim.
 *
 * This is an app suggestion, not a form rule. The item 22 instruction says
 * nothing about linking victims to offenses, so this carries no controlling
 * citation. It is deliberately shaped as a missing-data prompt rather than
 * an accusation of error: it fires only off the narrow, high-confidence
 * VICTIM_ARTICLE_PREFIXES list, so an offense missing from that list never
 * produces a false warning, it simply produces no prompt. Item 22 exists
 * to capture victim demographics for offenses that have them, so a
 * victim-clear offense with an empty item 22 is worth flagging even though
 * nothing on the form itself requires the link.
 */
export function victimsWithoutVictimOffense(formData: FormData): ValidationIssue[] {
  const rows = offenseRows(formData);
  const hasVictimOffense = rows.some((row) => articleClearlyInvolvesVictim(row?.articleLabel ?? ''));
  if (!hasVictimOffense) return [];
  const victims = victimRows(formData);
  const hasVictimRow = victims.some((v) => Object.values(v ?? {}).some((val) => (val ?? '') !== ''));
  if (hasVictimRow) return [];
  return [
    issue(
      'navmc10132-victims-without-victim-offense',
      'warn',
      'App suggestion: a selected offense clearly involves a victim, but item 22 has no victim recorded.',
      'App heuristic, no controlling source.',
      'Check whether item 22 should record the victim of this offense.',
    ),
  ];
}

/**
 * Aggregate of all item 1 (offenses), item 5 (findings), and the item 4 and
 * item 22 cross-checks that depend on them.
 */
export function offenseIssues(formData: FormData): ValidationIssue[] {
  return [
    ...offenseArticlePresent(formData),
    ...offenseSummaryPresent(formData),
    ...offenseFindingRequiresArticle(formData),
    ...punishmentRequiresGuiltyFinding(formData),
    ...offenseOrdinarilyNotMinor(formData),
    ...item4WithoutArticle85Or86(formData),
    ...article85Or86WithoutItem4(formData),
    ...victimsWithoutVictimOffense(formData),
  ];
}
