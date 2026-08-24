// NAVMC 10132 item 2 "BOOKER" field, reproduced from decoded form JavaScript.
//
// Why this exists: on the official blank, the "2 BOOKER" field looks like
// static artwork, but it is actually rewritten by three identical on-blur
// JavaScript handlers attached to "2 DEMAND", "2 COUNSELOPP", and
// "2 ACC REFUSE TO SIGN". pdf-lib cannot execute those handlers when it
// fills the form, and the blank ships with the ACCEPTANCE text already
// stored in the field's /V entry. That means an export of a case where the
// accused refused to sign, demanded trial, invoked the vessel exception, or
// never had a counsel opportunity would silently keep the acceptance
// sentence and produce a legal record that falsely states the accused
// accepted NJP. The two functions below reproduce the decoded script
// exactly so the app can compute and write the correct field value itself.
//
// Ground truth: /tmp/ctx/decoded-scripts.txt, the /AA /Bl handler shared by
// all three fields.

import { NAVMC_10132_DEMAND } from '@/types/navmc';

/**
 * Reproduces the decoded on-blur script's five branches, in the script's
 * own order, to compute the item 2 "BOOKER" field value.
 *
 * The script tests, in this order: the vessel exception, then whether the
 * accused refused to sign, then a standing demand to refuse NJP, then
 * whether there was no counsel opportunity, then acceptance of NJP. The
 * first matching branch wins, exactly as in the form.
 *
 * When none of the five conditions match (for example demand is the empty
 * string), the real form leaves "2 BOOKER" at whatever value it already
 * held, which on a fresh blank is the acceptance sentence. This function
 * cannot carry forward a "prior value" because it is pure, so it returns
 * an empty string for that case instead. Callers must treat that empty
 * string as "no derivable statement" and always write the item 2 "BOOKER"
 * field explicitly, never relying on the field's shipped default.
 *
 * @param demand - current value of "2 DEMAND", one of the
 *   NAVMC_10132_DEMAND export strings, or empty.
 * @param counselOpportunity - current value of "2 COUNSELOPP", expected to
 *   be "have" or "have not".
 * @param refusedToSign - current state of "2 ACC REFUSE TO SIGN",
 *   true when the accused refused to sign.
 * @returns the exact "2 BOOKER" field text for the matching branch, or an
 *   empty string when no branch matches.
 */
export function bookerStatement(demand: string, counselOpportunity: string, refusedToSign: boolean): string {
  if (demand === NAVMC_10132_DEMAND.VESSEL) {
    return '(No Booker statement due to the vessel exception, United States v. Mack, 9 M.J. 300, 320 (C.M.A. 1980).)'
  }

  if (refusedToSign) {
    return '(No Booker statement due to refusal to sign.)'
  }

  if (demand === NAVMC_10132_DEMAND.REFUSE) {
    return '(No Booker statement due to refusal of NJP.)'
  }

  if (counselOpportunity === 'have not') {
    return '(No Booker statement; no opportunity to consult with counsel.)'
  }

  if (demand === NAVMC_10132_DEMAND.ACCEPT) {
    return 'BOOKER STATEMENT: Having been advised of the above and fully understanding my rights, I choose to accept NJP.'
  }

  return ''
}

/**
 * Reproduces the decoded script's forced coupling between the refuse-to-sign
 * checkbox and the item 2 "DEMAND" dropdown.
 *
 * In the original handler this coupling lives inside the refusedToSign
 * branch, before the branch sets the "2 BOOKER" text, so it only ever
 * touches a demand that currently reads the ACCEPT sentence. It has no
 * further effect on bookerStatement's own output, because bookerStatement
 * already resolves the refusal-to-sign branch ahead of the refuse-NJP
 * branch regardless of which demand string is present.
 *
 * @param demand - current value of "2 DEMAND".
 * @param refusedToSign - current state of "2 ACC REFUSE TO SIGN".
 * @returns the REFUSE demand string when refusedToSign is true and demand
 *   was the ACCEPT string, otherwise the demand unchanged.
 */
export function coerceDemand(demand: string, refusedToSign: boolean): string {
  if (refusedToSign && demand === NAVMC_10132_DEMAND.ACCEPT) {
    return NAVMC_10132_DEMAND.REFUSE
  }

  return demand
}
