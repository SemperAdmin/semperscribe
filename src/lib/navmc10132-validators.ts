/**
 * NAVMC 10132 validators - Phase 4 of docs/NAVMC_10132_BUILD_PLAN.md.
 *
 * Pure functions: FormData in, ValidationIssue[] out, folded into
 * runLetterValidators so the existing export gate picks up the blockers. Every
 * issue carries its citation. Rule source: docs/NAVMC_10132_SPEC.md section 6.
 *
 * The rules are split across four domain modules rather than one long file:
 * offenses and findings, date sequence, punishment and authority, and identity,
 * capacity and remarks. This module is the aggregate the rest of the app calls.
 *
 * CITATION DISCIPLINE, which this form makes unusually easy to get wrong:
 *
 *   MCO 5800.16 Vol 14 paragraphs 011105.A through 011105.R were DELETED in
 *   their entirety by MARADMIN 427/23 and replaced with a pointer to the form's
 *   own instruction page. Preparation-format rules therefore cite the FORM, and
 *   the MCO is cited only for the paragraphs that survive.
 *
 *   10 U.S.C. 486 was repealed 23 Dec 2024. It is never cited.
 *
 *   MCM Part V is paraphrased with a paragraph reference and never quoted, until
 *   the 2024 edition is checked against a Marine Corps network copy (spec D-7).
 *
 * SEVERITY AMENDMENT recorded here rather than buried: spec section 6.1 lists
 * V-16, no increase of punishment on appeal, as a BLOCKER. It ships as a
 * WARNING. The rule is real (MCM Part V para 1.f.(2)), but item 14 is free text
 * and item 6 is structured, so no honest comparison between them exists. A
 * keyword heuristic can suggest an increase, it cannot prove one, and a heuristic
 * must not gate an export. See navmc10132-validators-punishment.ts.
 */

import { FormData } from '@/types';
// type-only: letter-validators imports this module at runtime, so a value
// import here would create a cycle.
import type { ValidationIssue } from '@/lib/letter-validators';
import { offenseIssues } from '@/lib/navmc10132-validators-offenses';
import { dateIssues } from '@/lib/navmc10132-validators-dates';
import { punishmentIssues } from '@/lib/navmc10132-validators-punishment';
import { identityIssues } from '@/lib/navmc10132-validators-identity';

/**
 * Run every NAVMC 10132 rule. A no-op for every other document type, which is
 * how it can be folded unconditionally into the shared validator run.
 */
export function runNavmc10132Validators(formData: FormData): ValidationIssue[] {
  if (formData.documentType !== 'navmc10132') return [];
  return [
    ...offenseIssues(formData),
    ...dateIssues(formData),
    ...punishmentIssues(formData),
    ...identityIssues(formData),
  ];
}
