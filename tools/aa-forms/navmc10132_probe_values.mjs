/**
 * Phase 0 probe fixtures. Fictional data only, matching the identity convention
 * already used by the NAVMC 10922 templates.
 *
 * The Booker branch logic below is a THROWAWAY fixture, not the Phase 2 module.
 * It exists so the refusal probe carries the legally correct statement instead
 * of the acceptance text the blank ships with. Phase 2 implements the real one
 * with tests against the decoded scripts.
 */
import fs from 'node:fs';

const VESSEL = 'I cannot demand trial because I am attached to or embarked upon a vessel.';
const ACCEPT = 'I do not demand trial and will accept non-judicial punishment, subject to my right of appeal.';
const REFUSE = 'I demand trial and refuse non-judicial punishment.';

function bookerStatement(demand, counselOpp, refused) {
  if (demand === VESSEL)
    return '(No Booker statement due to the vessel exception, United States v. Mack, 9 M.J. 300, 320 (C.M.A. 1980).)';
  if (refused) return '(No Booker statement due to refusal to sign.)';
  if (demand === REFUSE) return '(No Booker statement due to refusal of NJP.)';
  if (counselOpp === 'have not')
    return '(No Booker statement; no opportunity to consult with counsel.)';
  if (demand === ACCEPT)
    return 'BOOKER STATEMENT: Having been advised of the above and fully understanding my rights, I choose to accept NJP.';
  return '';
}

function coerceDemand(demand, refused) {
  return refused && demand === ACCEPT ? REFUSE : demand;
}

const ACCUSED = {
  '17 UNIT': 'H&S Co., 1st Bn, 6th Mar, 2d MARDIV',
  '18 ACCUSED FULL NAME': 'MARINE, ALONZO DEAN',
  '19 ACCUSED RANK/GRADE': 'Sgt, E5',
  '20 ACCUSED EDIPI': '1234567890',
  '23 ACCUSED FULL NAME': 'MARINE, ALONZO DEAN',
  '24 ACCUSED RANK/GRADE': 'Sgt, E5',
  '25 ACCUSED EDIPI': '1234567890',
};

const OFFENSE = {
  '1A ARTICLE': 'Art. 86  Absence without leave',
  '1A SUMMARY': 'UA fr H&S Co, 1/6 dur the prd 0800, 4 Aug 26 through 2359, 6 Aug 26.',
  '1A FINDING': 'Guilty',
};

const AUTHORITY = {
  '8 NJP AUTHORITY NAME TITLE SERVICE': 'JOHN P. RIVERA, Commanding Officer',
  '8A NJP AUTHORITY GRADE': 'LtCol, O5',
  '8B NJP AUTHORITY EDIPI': '9876543210',
};

const VICTIM_NONE = {};

function build({ demand, counselOpp, refused, remarks, punishment, appeal }) {
  const finalDemand = coerceDemand(demand, refused);
  return {
    ...ACCUSED,
    ...OFFENSE,
    ...AUTHORITY,
    '2 DEMAND': finalDemand,
    '2 COUNSELOPP': counselOpp,
    ...(refused ? { '2 ACC REFUSE TO SIGN': true } : {}),
    '2 BOOKER': bookerStatement(demand, counselOpp, refused),
    '2 ACC ELECTION AND RIGHTS DATE_af_date': '2026-08-12',
    '3 RIGHTS ATTEST DATE_af_date': '2026-08-12',
    '4 CURRENT UAS OVER 24 HRS AND MARKS OF DESERTION':
      'UA 0800 4 Aug 26 to 2359 6 Aug 26, 2 days 15 hrs. No marks of desertion.',
    '6 PUNISHMENT IMPOSED': punishment,
    '6 PUNISHMENT IMPOSITION DATE': '2026-08-14',
    '7 SUSPENSION IF ANY': 'NONE',
    '10 DATE OF DISPOSITION NOTICE': '2026-08-14',
    '11 APPEAL ADVISEMENT DATE_af_date': '2026-08-14',
    '12 INTEND APPEAL': appeal,
    '12 APPEAL INTENT DATE_af_date': '2026-08-14',
    '13 NOT APPEALED': true,
    '16 FINAL ADMIN UD': '26-231',
    '16 FINAL ADMIN DTD': '2026-08-19',
    ...(remarks ? { '21 REMARKS': remarks } : {}),
    ...VICTIM_NONE,
  };
}

const LONG_REMARKS = [
  '2026-08-12 ITEM 2: Fwd to Bn CO recom NJP.',
  '2026-08-14 ITEM 22: Additional Victims:',
  '   B. Military Male White Not Hispanic or Latino',
  '   C. Civilian (spouse) Female Asian Not Hispanic or Latino',
  '2026-08-19 ITEM 14: Appeal denied, untimely.',
  '',
  'Additional remarks. Rows B and C above were recorded here rather than in',
  'item 22 because the printed rows B through E offer a status vocabulary that',
  'does not match the form instructions. See NAVMC_10132_SPEC.md defect 3.1.',
].join('\n');

const probes = {
  'probe-a-acceptance': build({
    demand: ACCEPT,
    counselOpp: 'have',
    refused: false,
    remarks: null, // EMPTY on purpose: this is the case that crashed the fill
    punishment: 'Restr to limits of H&S Co, 1st Bn, 6th Mar for 14 days w/o susp fr du.',
    appeal: 'I do not intend to appeal.',
  }),
  'probe-d-refusal': build({
    demand: ACCEPT, // coerced to REFUSE by the script's own coupling
    counselOpp: 'have',
    refused: true,
    remarks: '2026-08-12 ITEM 2: Fwd to Bn CO recom court-martial. Accused refused to sign item 2.',
    punishment: 'Restr to limits of H&S Co, 1st Bn, 6th Mar for 14 days w/o susp fr du.',
    appeal: 'the accused refuses to sign.',
  }),
  'probe-c-remarks-long': build({
    demand: ACCEPT,
    counselOpp: 'have',
    refused: false,
    remarks: LONG_REMARKS,
    punishment: 'Forf of $1,214 pay per month for 2 months. Total forf $2,428. Red to Cpl, E-4.',
    appeal: 'I do not intend to appeal.',
  }),
};

for (const [name, values] of Object.entries(probes)) {
  fs.writeFileSync(`out/${name}.json`, JSON.stringify(values, null, 1));
  const over = Object.entries(values).filter(([k, v]) => {
    if (typeof v !== 'string') return false;
    const caps = { '6 PUNISHMENT IMPOSED': 123, '1A SUMMARY': 84, '17 UNIT': 152 };
    return caps[k] && v.length > caps[k];
  });
  console.log(
    `${name}: ${Object.keys(values).length} fields` +
      (over.length ? `  OVER CAPACITY: ${over.map(([k, v]) => `${k}=${v.length}`).join(', ')}` : '  capacity ok')
  );
  console.log(`   Booker -> ${values['2 BOOKER'].slice(0, 72)}`);
  console.log(`   Demand -> ${values['2 DEMAND'].slice(0, 60)}`);
}
