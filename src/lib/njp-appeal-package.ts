/**
 * The NJP appeal package forwarded to higher authority.
 *
 * VACATION IS A DIFFERENT ACTION WITH A DIFFERENT ANSWER. MCO 5800.16 Vol 14
 * para 011201, quoted verbatim:
 *
 *   "Vacation of suspended punishment is not itself NJP, and subsequent
 *   action to impose NJP for the offense(s) upon which the vacation action
 *   is based is authorized. If only suspended punishment is vacated, an
 *   accused has no right of appeal. If additional punishment is imposed,
 *   the right to appeal applies."
 *
 * JAGMAN (JAGINST 5800.7G CH-2) para 0118.d supplies the remedy 011201
 * leaves out: the vacation decision itself "is not itself subject to
 * appeal...but is a proper subject of an Article 138, UCMJ, complaint."
 *
 * THE FACT THAT DECIDES IT IS NOT ON THIS FORM. A vacation is recorded on
 * this UPB as a structured item 21 remark (kind 'suspension-vacated-njp',
 * see navmc10132-remarks.ts), so the app CAN see that a vacation happened.
 * But "additional punishment is imposed" means a SUBSEQUENT NJP, and 011201
 * says outright that imposing it is a new "action", meaning a SEPARATE
 * proceeding on a SEPARATE UPB, one this module has never seen and has no
 * way to reach. A vacation remark on this form proves a vacation happened;
 * it says nothing about whether that other proceeding exists.
 *
 * SO THE CALLER STATES IT, AND "NOT STATED" IS A REAL ANSWER, NOT A GAP TO
 * DEFAULT AWAY. `appealPackage` takes an optional second argument,
 * `additionalPunishment`, for exactly this fact. Three things can happen
 * when a vacation remark is present:
 *
 *   - `'not-imposed'`: no right of appeal from the vacation. The 011107
 *     checklist would be assembling a package around a right that does not
 *     exist, so it is not built. The caller gets the 011201 citation and
 *     the JAGMAN 0118.d Article 138 remedy instead.
 *   - `'imposed'`: 011201's own words, "the right to appeal applies", so
 *     the ordinary 011107 checklist below is exactly right and is what
 *     this returns.
 *   - omitted: the caller does not know yet. Defaulting to `'imposed'`
 *     would build a checklist around a right that may not exist, telling a
 *     clerk to chase a signature on block 14 for an appeal nobody may
 *     bring. Defaulting to `'not-imposed'` is worse: it tells a Marine who
 *     may hold a real right of appeal that they have none, which this
 *     codebase's standing rule against inventing a legal figure it cannot
 *     verify treats as the more dangerous of the two wrong answers. So
 *     neither branch is picked. The result reports BOTH outcomes in full,
 *     under `ifAdditionalPunishmentImposed` and `ifVacationOnly`, plus
 *     `decidingFact` naming the one thing that resolves it, so the caller
 *     can act on whichever branch turns out to be true without this module
 *     ever having guessed.
 *
 * When no vacation remark is present at all, `additionalPunishment` is
 * irrelevant and this is an ordinary appeal from NJP: the 011107 checklist
 * applies exactly as it always has.
 *
 * MCO 5800.16 Vol 14 para 011107, quoted verbatim:
 *
 *   "When an appeal from NJP is forwarded to higher authority for decision,
 *   compliance with reference (r), sections 0116 and 0117 is required.
 *   Furthermore, applicable Page 11 entries, the Marine's Record of Service
 *   (corporals and below), the original UPB form, the summarization of
 *   proceedings, and all allied papers shall be forwarded to the higher
 *   authority. The appeal authority is required to sign block 14 of the UPB
 *   and the correspondence responding directly to the Marine regarding the
 *   appeal authority's final decision on the appeal. After action on the
 *   appeal, the original NJP appeal paperwork and all allied papers will be
 *   returned to the officer originating the UPB. Allied papers may include,
 *   but are not limited to statements, investigative reports, documents,
 *   records, or photographs. A copy of the appeal, will be provided to the
 *   Marine concerned. Item 15 will be completed by the individual providing
 *   notice to the accused of the decision on the appeal and the original
 *   appeal with all enclosures and endorsements will be attached to the UPB
 *   form. Any allied papers will be filed in the command's correspondence
 *   files in accordance with current directives. Factual disputes should be
 *   addressed by endorsers and resolved by the Appeal Authority."
 *
 * WHY A CHECKLIST AND NOT A GENERATED DOCUMENT. Almost nothing here is a
 * document this app could write. It is a list of things that must be
 * ASSEMBLED and PHYSICALLY ROUTED, and the failure mode is omission rather
 * than misdrafting: a package forwarded without the summarization of
 * proceedings comes back, and the Marine waits. So the app enumerates the
 * paragraph's requirements against what it can see and marks each one
 * satisfied, unsatisfied, or unverifiable.
 *
 * THREE STATES, AND THE THIRD ONE MATTERS MOST. Most of 011107 concerns
 * paper this app never holds: Page 11 entries, the Record of Service,
 * statements and photographs. Marking those "unsatisfied" would train a
 * clerk to ignore red marks, and marking them "satisfied" would be a lie.
 * They are UNVERIFIABLE, listed with what to go and check, and the summary
 * says plainly how many items the app could not see.
 *
 * ONE CONDITIONAL. "the Marine's Record of Service (corporals and below)"
 * applies only at E-4 and below, which the app knows from item 19. Above
 * that the item is not merely satisfied, it does not apply, and saying so
 * is more useful than a green tick.
 */

import type { FormData } from '@/types';
import { NAVMC_10132_APPEAL_INTENT, type Navmc10132Remark } from '@/types/navmc';

export type AppealItemState = 'satisfied' | 'unsatisfied' | 'unverifiable' | 'not-applicable';

export interface AppealPackageItem {
  id: string;
  /** What 011107 requires, in its own terms. */
  requirement: string;
  state: AppealItemState;
  /** Why it is in that state, and for anything unverifiable, what to check. */
  detail: string;
}

/**
 * Whether additional NJP punishment was imposed, on a SEPARATE UPB, for the
 * offense(s) a vacation action here was based on. This is the one fact
 * MCO 011201 conditions the right of appeal on, and this module cannot see
 * it. See the module-level comment for why. Pass it when the caller
 * actually knows; omit it otherwise. Omitting it is a legitimate answer.
 */
export type AdditionalPunishmentImposed = 'imposed' | 'not-imposed';

/** The ordinary case: an appeal from NJP itself, or a vacation on which
 * additional punishment was also imposed. 011201: "the right to appeal
 * applies", so the 011107 checklist is the right answer. */
export interface AppealRightsPackage {
  kind: 'appeal-rights';
  /** True when the accused has elected to appeal, so the package applies. */
  applies: boolean;
  items: AppealPackageItem[];
  /** Count of items the app cannot see. Never hidden from the caller. */
  unverifiableCount: number;
  /** Items actively failing, as distinct from unverifiable. */
  unsatisfiedCount: number;
}

/** Only the suspended punishment was vacated. MCO 011201: no right of
 * appeal from the vacation. JAGMAN 0118.d: the remedy that survives is an
 * Article 138 complaint, not an appeal. */
export interface VacationOnlyPackage {
  kind: 'vacation-only';
  applies: false;
  /** No right of appeal from the vacation. Cites MCO 5800.16 Vol 14 para 011201. */
  noAppealRight: string;
  /** The remedy that remains. Cites JAGMAN (JAGINST 5800.7G CH-2) para 0118.d. */
  article138Remedy: string;
}

/** A vacation remark is present and the caller has not said whether
 * additional punishment was imposed. Both outcomes are reported in full,
 * unresolved, alongside the one fact that decides between them. */
export interface UnstatedActionPackage {
  kind: 'unstated';
  applies: false;
  /** The one fact this module cannot see that decides which branch applies. */
  decidingFact: string;
  /** What follows if additional NJP punishment was imposed for the same offense(s). */
  ifAdditionalPunishmentImposed: AppealRightsPackage;
  /** What follows if only the suspended punishment was vacated. */
  ifVacationOnly: VacationOnlyPackage;
}

export type AppealPackage = AppealRightsPackage | VacationOnlyPackage | UnstatedActionPackage;

function str(formData: FormData, key: string): string {
  const value: unknown = formData[key];
  return typeof value === 'string' ? value.trim() : '';
}

/** Bare enlisted grade number, or null when unreadable. */
function enlistedGrade(payGrade: string): number | null {
  const match = /^E-?(\d)$/i.exec(payGrade.trim());
  return match ? Number(match[1]) : null;
}

/** `formData.remarks` as Navmc10132Remark[], the same runtime-checked
 * pattern navmc10132-acroform.ts uses: an `unknown` binding narrowed by an
 * Array.isArray check, never a straight cast off the `any`-typed index. */
function readRemarks(formData: FormData): Navmc10132Remark[] {
  const value: unknown = formData.remarks;
  return Array.isArray(value) ? (value as Navmc10132Remark[]) : [];
}

/** True when item 21 carries a structured vacation-of-suspended-NJP remark.
 * This is a fact the app CAN see on this very form; it says nothing about
 * whether additional punishment was later imposed elsewhere. See the
 * module-level comment. */
function hasVacationRemark(formData: FormData): boolean {
  return readRemarks(formData).some((r) => r.kind === 'suspension-vacated-njp');
}

const NO_APPEAL_RIGHT =
  'Vacation of suspended punishment is not itself NJP (MCO 5800.16 Vol 14 para 011201). ' +
  'Because only the suspended punishment was vacated, with no additional NJP imposed for the ' +
  'offense(s) the vacation was based on, the accused has no right of appeal from this action.';

const ARTICLE_138_REMEDY =
  'The vacation decision is not itself appealable, but it is a proper subject of an Article ' +
  '138, UCMJ, complaint (JAGMAN (JAGINST 5800.7G CH-2) para 0118.d).';

function vacationOnlyPackage(): VacationOnlyPackage {
  return {
    kind: 'vacation-only',
    applies: false,
    noAppealRight: NO_APPEAL_RIGHT,
    article138Remedy: ARTICLE_138_REMEDY,
  };
}

/**
 * The 011107 checklist for this case.
 *
 * `applies` is false unless item 12 records an intention to appeal or item
 * 13 records an appeal date. Presenting the checklist on a case with no
 * appeal would be noise.
 */
function appealRightsPackage(formData: FormData): AppealRightsPackage {
  const intent = str(formData, 'intendAppeal');
  const appealDate = str(formData, 'appealDate');
  const applies = intent === NAVMC_10132_APPEAL_INTENT.WILL || appealDate !== '';

  const decision = str(formData, 'appealDecision');
  const decisionDate = str(formData, 'appealDecisionDate');
  const noticeDate = str(formData, 'appealDecisionNoticeDate');
  const grade = enlistedGrade(str(formData, 'accusedPayGrade'));

  const items: AppealPackageItem[] = [
    {
      id: 'jagman-0116-0117',
      requirement: 'Comply with JAGMAN sections 0116 and 0117.',
      state: 'unverifiable',
      detail:
        'The appeal procedures themselves. This app does not model them. Read them before ' +
        'forwarding.',
    },
    {
      id: 'page-11',
      requirement: 'Forward the applicable Page 11 entries.',
      state: 'unverifiable',
      detail: 'Held in the service record, not in this app. Confirm the entries are included.',
    },
    {
      id: 'record-of-service',
      requirement: "Forward the Marine's Record of Service (corporals and below).",
      state: grade === null ? 'unverifiable' : grade <= 4 ? 'unverifiable' : 'not-applicable',
      detail:
        grade === null
          ? 'Item 19 carries no readable pay grade, so the app cannot tell whether this applies. ' +
            'It applies at E-4 and below.'
          : grade <= 4
            ? `The accused is E-${grade}, corporal or below, so the Record of Service IS required. ` +
              'It is held in the service record, not in this app.'
            : `The accused is E-${grade}, above corporal, so 011107 does not require the Record ` +
              'of Service.',
    },
    {
      id: 'original-upb',
      requirement: 'Forward the ORIGINAL UPB form.',
      state: 'unverifiable',
      detail:
        'The original signed NAVMC 10132, not a copy and not a fresh export from this app. ' +
        'Exporting a new PDF does not satisfy this.',
    },
    {
      id: 'summarization',
      requirement: 'Forward the summarization of proceedings.',
      state: 'unverifiable',
      detail: 'Prepared at the hearing. This app does not generate it.',
    },
    {
      id: 'allied-papers',
      requirement: 'Forward all allied papers.',
      state: 'unverifiable',
      detail:
        'May include, but is not limited to, statements, investigative reports, documents, ' +
        'records, or photographs.',
    },
    {
      id: 'block-14-signed',
      requirement: 'The appeal authority signs block 14 of the UPB.',
      state: decision === '' && decisionDate === '' ? 'unsatisfied' : 'unverifiable',
      detail:
        decision === '' && decisionDate === ''
          ? 'Item 14 carries neither a decision nor a decision date. The appeal authority has ' +
            'not acted, or the result has not been recorded.'
          : 'Item 14 carries a decision. The app cannot see a signature, only the recorded text.',
    },
    {
      id: 'response-correspondence',
      requirement:
        'The appeal authority signs the correspondence responding directly to the Marine.',
      state: 'unverifiable',
      detail:
        'A separate letter to the Marine, signed by the appeal authority. This app does not ' +
        'generate it yet.',
    },
    {
      id: 'copy-to-marine',
      requirement: 'Provide a copy of the appeal to the Marine concerned.',
      state: 'unverifiable',
      detail: 'A physical routing step the app cannot observe.',
    },
    {
      id: 'item-15',
      requirement:
        'Item 15 is completed by the individual giving the accused notice of the decision.',
      state: noticeDate === '' ? 'unsatisfied' : 'satisfied',
      detail:
        noticeDate === ''
          ? 'Item 15 carries no date of notice of the appeal decision.'
          : `Item 15 records notice given on ${noticeDate}.`,
    },
    {
      id: 'attach-to-upb',
      requirement:
        'Attach the original appeal, with all enclosures and endorsements, to the UPB form.',
      state: 'unverifiable',
      detail: 'A filing step on the original paper record.',
    },
    {
      id: 'return-to-originator',
      requirement:
        'After action, return the original appeal paperwork and allied papers to the officer ' +
        'who originated the UPB.',
      state: 'unverifiable',
      detail: 'Happens after the appeal authority decides. Track it outside this app.',
    },
    {
      id: 'file-allied-papers',
      requirement: "File allied papers in the command's correspondence files.",
      state: 'unverifiable',
      detail: 'In accordance with current directives.',
    },
    {
      id: 'factual-disputes',
      requirement: 'Endorsers address factual disputes; the Appeal Authority resolves them.',
      state: 'unverifiable',
      detail:
        'A drafting obligation on whoever endorses the appeal. An endorsement that passes a ' +
        'disputed fact along without addressing it does not comply.',
    },
  ];

  return {
    kind: 'appeal-rights',
    applies,
    items,
    unverifiableCount: items.filter((i) => i.state === 'unverifiable').length,
    unsatisfiedCount: items.filter((i) => i.state === 'unsatisfied').length,
  };
}

const DECIDING_FACT =
  'Item 21 records that a suspended punishment was vacated. MCO 5800.16 Vol 14 para 011201 ' +
  'makes the right of appeal turn on one fact this UPB cannot show: whether additional NJP ' +
  'punishment was also imposed, on a separate UPB, for the offense(s) the vacation was based ' +
  'on. That fact decides which of the two outcomes below applies. Confirm it, then call this ' +
  "again passing 'imposed' or 'not-imposed'.";

/**
 * The NJP appeal package for this case.
 *
 * When item 21 carries no vacation remark, this is an ordinary appeal from
 * NJP and `additionalPunishment` is not used: the 011107 checklist applies.
 *
 * When item 21 DOES carry a vacation remark, MCO 011201 governs instead,
 * and `additionalPunishment` is the fact that decides the outcome:
 *
 *   - `'not-imposed'` returns the vacation-only result: no right of
 *     appeal, cited to 011201, with the Article 138 remedy from JAGMAN
 *     0118.d.
 *   - `'imposed'` returns the ordinary 011107 checklist, because 011201
 *     says the right to appeal applies once additional punishment is
 *     imposed.
 *   - omitted returns BOTH outcomes, unresolved, plus the one fact
 *     (`decidingFact`) that would resolve them. See the module-level
 *     comment for why this module will not guess between the two.
 */
export function appealPackage(
  formData: FormData,
  additionalPunishment?: AdditionalPunishmentImposed,
): AppealPackage {
  if (!hasVacationRemark(formData)) {
    return appealRightsPackage(formData);
  }

  if (additionalPunishment === 'imposed') {
    return appealRightsPackage(formData);
  }

  if (additionalPunishment === 'not-imposed') {
    return vacationOnlyPackage();
  }

  return {
    kind: 'unstated',
    applies: false,
    decidingFact: DECIDING_FACT,
    ifAdditionalPunishmentImposed: appealRightsPackage(formData),
    ifVacationOnly: vacationOnlyPackage(),
  };
}
