/**
 * The NJP appeal package forwarded to higher authority.
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
import { NAVMC_10132_APPEAL_INTENT } from '@/types/navmc';

export type AppealItemState = 'satisfied' | 'unsatisfied' | 'unverifiable' | 'not-applicable';

export interface AppealPackageItem {
  id: string;
  /** What 011107 requires, in its own terms. */
  requirement: string;
  state: AppealItemState;
  /** Why it is in that state, and for anything unverifiable, what to check. */
  detail: string;
}

export interface AppealPackage {
  /** True when the accused has elected to appeal, so the package applies. */
  applies: boolean;
  items: AppealPackageItem[];
  /** Count of items the app cannot see. Never hidden from the caller. */
  unverifiableCount: number;
  /** Items actively failing, as distinct from unverifiable. */
  unsatisfiedCount: number;
}

function str(formData: FormData, key: string): string {
  const value: unknown = formData[key];
  return typeof value === 'string' ? value.trim() : '';
}

/** Bare enlisted grade number, or null when unreadable. */
function enlistedGrade(payGrade: string): number | null {
  const match = /^E-?(\d)$/i.exec(payGrade.trim());
  return match ? Number(match[1]) : null;
}

/**
 * The 011107 checklist for this case.
 *
 * `applies` is false unless item 12 records an intention to appeal or item
 * 13 records an appeal date. Presenting the checklist on a case with no
 * appeal would be noise.
 */
export function appealPackage(formData: FormData): AppealPackage {
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
    applies,
    items,
    unverifiableCount: items.filter((i) => i.state === 'unverifiable').length,
    unsatisfiedCount: items.filter((i) => i.state === 'unsatisfied').length,
  };
}
