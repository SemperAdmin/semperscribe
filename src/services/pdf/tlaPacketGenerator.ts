/**
 * TLA Packet: the printed request.
 *
 * No official TLA blank exists in the policy set, and payment runs on the
 * command's NAVMC 11116, so this is drawn as the app's own boxed form: the
 * request with its lodging facts, the housing search statement, only the
 * certificates the situation calls for, and a routing checklist. It states
 * facts and prints no rate: finance sets the per diem and computes the amount.
 *
 * `tlaPacketModel` holds every printed value, so tests check content
 * without parsing the drawing.
 */
import { PDFDocument, StandardFonts } from 'pdf-lib';
import type { FormData } from '@/types';
import { parseAndFormatDate } from '@/lib/date-utils';
import { sanitizeForTimesRoman } from '@/lib/navmc10274-layout';
import {
  TLA_ADDITIONAL_REASONS, TLA_EARLY_TERMINATION_REASONS, TLA_REQUEST_KINDS, TLA_SITUATIONS,
  parseTlaMoney, summarizeTla, tlaField, tlaFlag, tlaHousingLog, tlaMoneyText, tlaRequestKind,
  type TlaLine, type TlaRequestKind,
} from '@/lib/tla';
import { INK, MARGIN, PAGE_H, PAGE_W, SMALL, Sheet, WIDTH, type Cell, type Fonts, type FormCheck } from '@/services/pdf/boxedFormSheet';

const PRIVACY_MARKING = 'PRIVACY SENSITIVE';
const FMR = 'DoD FMR Vol 7A Ch 68';
const TABLE_SIZE = 7.5;
const HANDLING_SIZE = 6;

/** Helvetica encodes WinAnsi and throws on the rest, so each line is made safe. */
function clean(text: string): string {
  return text.split(/\r?\n/).map((line) => sanitizeForTimesRoman(line).text).join('\n');
}

function dateText(iso: string): string {
  return iso.trim() ? clean(parseAndFormatDate(iso.trim())) : '';
}

function moneyEntry(text: string): string {
  const amount = parseTlaMoney(text);
  return amount === null ? '' : tlaMoneyText(amount);
}

// --- the model ---

export interface TlaPrintedLine extends TlaLine {
  dateText: string;
}

export interface TlaCertificate {
  id: string;
  title: string;
  citation: string;
  statement: string;
  detail: string;
  signer: string;
}

export interface TlaAdditional {
  reason: string;
  citation: string;
  narrative: string;
  dailyTla: string;
  dailyLodging: string;
  housingAllowance: string;
  familySeparationHousing: string;
}

export interface TlaPacketModel {
  title: string;
  subtitle: string;
  name: string;
  grade: string;
  edipi: string;
  unit: string;
  pds: string;
  orders: string;
  reportDate: string;
  departureDate: string;
  hhgDate: string;
  priorDays: string;
  kind: TlaRequestKind;
  kindChecks: FormCheck[];
  situationChecks: FormCheck[];
  lines: TlaPrintedLine[];
  lodgingTotalText: string;
  totalDays: number;
  incompletePeriods: number[];
  gtccText: string;
  gtccNote: string;
  overlap: string;
  additional: TlaAdditional | null;
  tlaBegan: string;
  tlaEnded: string;
  housingOfficial: string;
  housingLog: { date: string; action: string }[];
  housingStatement: string;
  marineSignature: string;
  authorizingOfficial: string;
  certificates: TlaCertificate[];
  checklist: string[];
  handling: string;
  lodgingNote: string;
}

const HOUSING_STATEMENT =
  'I understand that I must aggressively seek permanent housing, or await Government quarters when assigned them, and report my progress to the official above at the intervals the TLA Authority sets, 15 days or fewer. I will move as soon as practical. The payment depends on the expenses I incur, and I will keep itemized lodging receipts. No lodging is paid while staying with friends or relatives. TLA is not for personal inconvenience or enrichment, and it ends the day before I could reasonably occupy permanent housing.';

const LODGING_NOTE =
  `Lodging actually paid, including tax, VAT relief certificate cost and GTCC currency fees (${FMR} para 6.2.2). Finance sets the locality per diem from the location and dates, and computes the ceiling, M&IE and amount payable.`;

function certificates(formData: FormData): TlaCertificate[] {
  const get = (name: string) => clean(tlaField(formData, name).trim());
  const out: TlaCertificate[] = [];
  if (tlaFlag(formData, 'tlaCertMilitaryNecessity')) {
    out.push({
      id: 'military-necessity',
      title: 'CERTIFICATION OF MILITARY NECESSITY',
      citation: `${FMR} para 4.4.9, 5.2, 5.5`,
      statement: 'The Marine was ordered on TDY or deployment, or was hospitalized, while receiving TLA. Retaining the TLA lodging was due to military necessity and not to the Marine\'s personal choice or convenience. Annotate the order with this certification or attach it.',
      detail: get('tlaMilitaryNecessityNote'),
      signer: 'Commanding officer or designee',
    });
  }
  if (tlaFlag(formData, 'tlaCertGovQuarters')) {
    out.push({
      id: 'gov-quarters',
      title: 'CERTIFICATION, GOVERNMENT QUARTERS NOT AVAILABLE',
      citation: `${FMR} para 4.4.2`,
      statement: 'Government quarters were not available for the dates of this claim. When they are available and other lodging is used, reimbursement is limited to the cost of Government quarters.',
      detail: get('tlaGovQuartersNote'),
      signer: 'Marine claiming TLA',
    });
  }
  if (tlaFlag(formData, 'tlaCertNearestLodging')) {
    out.push({
      id: 'nearest-lodging',
      title: 'STATEMENT OF NEAREST SUITABLE LODGING',
      citation: `${FMR} para 6.3.2`,
      statement: 'Neither Government nor commercial temporary lodging was available at the PDS. The lodging used was the nearest suitable accommodation available to the PDS, and the per diem rate for its location applies.',
      detail: get('tlaNearestLodgingNote'),
      signer: 'Commanding officer or designee',
    });
  }
  if (tlaFlag(formData, 'tlaCertBeforeOrders')) {
    const advised = dateText(tlaField(formData, 'tlaOrdersAdvisedDate'));
    out.push({
      id: 'before-orders',
      title: 'STATEMENT, TLA BEFORE PCS ORDER ISSUED',
      citation: `${FMR} Table 68-10 rule 5`,
      statement: `The Marine was advised${advised ? ` on ${advised}` : ''} that a PCS order would be issued, before the order was actually issued. An end of active service date, retirement eligibility or expected rotation is not notice of intent to issue an order.`,
      detail: get('tlaBeforeOrdersNote'),
      signer: 'PCS authorizing official or designated representative',
    });
  }
  if (tlaFlag(formData, 'tlaCertEarlyTermination')) {
    const reason = TLA_EARLY_TERMINATION_REASONS.find((r) => r.value === tlaField(formData, 'tlaEarlyTerminationReason'))?.label ?? '';
    const given = dateText(tlaField(formData, 'tlaHousingRelinquishedDate'));
    out.push({
      id: 'early-termination',
      title: 'EARLY TERMINATION OF PERMANENT HOUSING',
      citation: `${FMR} Table 68-10 rule 3`,
      statement: `For reasons beyond the control of the Marine or dependent, permanent housing had to be relinquished${given ? ` on ${given}` : ''}, more than 10 days before the estimated departure date.${reason ? ` Reason: ${reason}.` : ''}`,
      detail: get('tlaEarlyTerminationNote'),
      signer: 'Authorizing official',
    });
  }
  return out;
}

function checklist(kind: TlaRequestKind, situation: string): string[] {
  const out: string[] = [];
  if (kind === 'advance') {
    out.push('Give the commander at the OCONUS duty station, before arrival or departure: the actual flight date, the lodging cost with kitchen availability, and who the allowance covers (FPM Vol 1 para 070303).');
    out.push('Bring the disbursing or finance office the paid lodging receipts after the advance, so it can be reconciled to the actual settlement (FPM Vol 1 para 070303).');
  } else {
    out.push(`Itemized lodging receipts for every day claimed, or invoices or vendor statements (${FMR} para 6.2.3.2.1). Keep copies.`);
    out.push('GTCC split amount stated on this request, even if zero (MARADMIN 373/20 para 3.g).');
  }
  out.push('PCS order or other order supporting the claim, with any required annotation.');
  out.push('Anything further the TLA Authority\'s written guidance requires.');
  out.push('Command submits the supporting documents to the disbursing or finance office; payment is directed on a NAVMC 11116 (FPM Vol 1 para 020101, 070301.G). This packet does not replace that form.');
  if (situation === 'departure' || situation === 'delayed-departure') {
    out.push('Departure claim: the commanding officer at the old duty station certifies the credit, and the NAVMC 11116 is cross-forwarded to the departing disbursing or finance office (FPM Vol 1 para 070301.B, 070301.G).');
  } else {
    out.push('Check in with the unit Agency Program Coordinator and say you are in TLA status, so the GTCC stays active with the right limit (MARADMIN 100/18 para 4.a, 4.b).');
  }
  return out;
}

export function tlaPacketModel(formData: FormData): TlaPacketModel {
  const get = (name: string) => clean(tlaField(formData, name).trim());
  const kind = tlaRequestKind(formData);
  const situation = tlaField(formData, 'tlaSituation');
  const summary = summarizeTla(formData);
  const lines = summary.lines.map((line) => ({
    ...line,
    lodgingName: clean(line.lodgingName.trim()),
    dateText: line.startDate === line.endDate ? dateText(line.startDate) : `${dateText(line.startDate)} - ${dateText(line.endDate)}`,
  }));

  const splitEntry = moneyEntry(tlaField(formData, 'tlaGtccSplit'));
  const last = summary.lines[summary.lines.length - 1];
  // The daily expense the TLA Authority weighs (para 4.3.2.3): what most days cost.
  const typical = summary.lines.reduce<TlaLine | undefined>((best, line) => (!best || line.days > best.days ? line : best), undefined);
  const reason =TLA_ADDITIONAL_REASONS.find((r) => r.value === tlaField(formData, 'tlaAdditionalReason'));

  return {
    title: 'TEMPORARY LODGING ALLOWANCE (TLA) REQUEST',
    subtitle: 'Request supporting the NAVMC 11116 under DoD FMR Vol 7A Ch 68 and FPM Vol 1 para 0703. Not an official form.',
    name: [get('tlaMarineLastName'), [get('tlaMarineFirstName'), get('tlaMarineMiddleInitial')].filter(Boolean).join(' ')].filter(Boolean).join(', '),
    grade: get('tlaMarineGrade'),
    edipi: get('tlaMarineEdipi'),
    unit: get('tlaUnit'),
    pds: get('tlaPds'),
    orders: get('tlaOrdersReference'),
    reportDate: dateText(tlaField(formData, 'tlaReportDate')),
    departureDate: dateText(tlaField(formData, 'tlaDepartureDate')),
    hhgDate: dateText(tlaField(formData, 'tlaHhgDeliveryDate')),
    priorDays: get('tlaPriorDays'),
    kind,
    kindChecks: TLA_REQUEST_KINDS.map((k) => ({ label: k.label, on: kind === k.value })),
    situationChecks: TLA_SITUATIONS.map((s) => ({ label: s.label, on: situation === s.value })),
    lines,
    lodgingTotalText: tlaMoneyText(summary.lodgingTotal),
    totalDays: summary.totalDays,
    incompletePeriods: summary.incompletePeriods,
    gtccText: splitEntry,
    gtccNote: parseTlaMoney(tlaField(formData, 'tlaGtccSplit')) === 0
      ? 'Zero split: the Marine pays the GTCC bill on receipt of any balance.'
      : 'Amount of this claim to send to the Government Travel Charge Card. With no amount entered, finance reviews the card balance and splits that amount, up to the settlement.',
    overlap: tlaFlag(formData, 'tlaHousingOverlap') ? get('tlaOverlapComment') || 'Overlap claimed. Justification not entered.' : 'None claimed.',
    additional: kind === 'additional'
      ? {
          reason: reason?.label ?? '',
          citation: reason?.citation ?? `${FMR} para 4.3.2`,
          narrative: get('tlaAdditionalNarrative'),
          dailyTla: moneyEntry(tlaField(formData, 'tlaDailyTla')),
          dailyLodging: typical ? tlaMoneyText(typical.dailyLodging) : '',
          housingAllowance: moneyEntry(tlaField(formData, 'tlaDailyHousingAllowance')),
          familySeparationHousing: moneyEntry(tlaField(formData, 'tlaDailyFamilySeparationHousing')),
        }
      : null,
    tlaBegan: summary.lines.length ? dateText(summary.lines[0].startDate) : '',
    tlaEnded: last ? dateText(last.endDate) : '',
    housingOfficial: get('tlaHousingOfficial'),
    housingLog: tlaHousingLog(formData)
      .filter((e) => (e.date ?? '').trim() || (e.action ?? '').trim())
      .map((e) => ({ date: dateText(e.date ?? ''), action: clean((e.action ?? '').trim()) })),
    housingStatement: HOUSING_STATEMENT,
    marineSignature: [get('tlaMarineGrade'), get('tlaMarineFirstName'), get('tlaMarineLastName')].filter(Boolean).join(' '),
    authorizingOfficial: get('tlaAuthorizingOfficial'),
    certificates: certificates(formData),
    checklist: checklist(kind, situation),
    handling: 'Contains personal and financial information. Handle under the Privacy Act and share only with the officials who process this claim.',
    lodgingNote: LODGING_NOTE,
  };
}

// --- the drawing ---

function titleBlock(s: Sheet, fonts: Fonts, title: string, subtitle: string) {
  const h = 30;
  s.rect(MARGIN, s.y - h, WIDTH, h);
  const tw = fonts.bold.widthOfTextAtSize(title, 13);
  s.text((PAGE_W - tw) / 2, s.y - 13, title, 13, true);
  const sw = fonts.body.widthOfTextAtSize(subtitle, SMALL);
  s.text((PAGE_W - sw) / 2, s.y - 25, subtitle, SMALL);
  s.y -= h;
}

function signatureRow(s: Sheet, who: string, name: string) {
  const cols = [270, 180, WIDTH - 450];
  s.row([
    { w: cols[0], label: who, value: name, minLines: 2 },
    { w: cols[1], label: 'SIGNATURE', minLines: 2 },
    { w: cols[2], label: 'DATE', minLines: 2 },
  ]);
}

function drawRequest(s: Sheet, fonts: Fonts, m: TlaPacketModel) {
  titleBlock(s, fonts, m.title, m.subtitle);

  s.section('SECTION I. MARINE');
  s.row([
    { w: 300, label: '1. NAME (Last, First, MI)', value: m.name },
    { w: 90, label: '2. GRADE', value: m.grade },
    { w: WIDTH - 390, label: '3. EDIPI', value: m.edipi },
  ]);
  s.row([
    { w: WIDTH / 2, label: '4. UNIT', value: m.unit },
    { w: WIDTH / 2, label: '5. OCONUS PDS', value: m.pds },
  ]);
  s.row([
    { w: 216, label: '6. ORDER REFERENCE', value: m.orders },
    { w: 108, label: '7. REPORTED', value: m.reportDate },
    { w: 108, label: '8. DEPARTING', value: m.departureDate },
    { w: 108, label: '9. HHG DELIVERED', value: m.hhgDate },
  ]);

  s.section('SECTION II. REQUEST');
  s.row([
    { w: 150, label: '10. TYPE', checks: m.kindChecks },
    { w: WIDTH - 150, label: '11. SITUATION', checks: m.situationChecks },
  ]);
  s.row([{ w: WIDTH, label: '12. TLA DAYS ALREADY AUTHORIZED', value: m.priorDays }]);

  if (m.additional) {
    s.section('SECTION II-A. ADDITIONAL PERIOD');
    s.row([{ w: WIDTH, label: `13. REASON (${m.additional.citation})`, value: [m.additional.reason, m.additional.narrative].filter(Boolean).join('\n'), minLines: 2 }]);
    const col = WIDTH / 4;
    s.row([
      { w: col, label: '14. DAILY TLA, IF KNOWN', value: m.additional.dailyTla },
      { w: col, label: '15. DAILY LODGING EXPENSE', value: m.additional.dailyLodging },
      { w: col, label: '16. DAILY HOUSING ALLOWANCE', value: m.additional.housingAllowance },
      { w: col, label: '17. DAILY FAMILY SEP. HOUSING', value: m.additional.familySeparationHousing },
    ]);
  }

  s.section('SECTION III. LODGING');
  const cols = [88, 28, 124, 72, 58, 40, 44, 40, 46];
  const small = (w: number, value: string, bold = false): Cell => ({ w, value, size: TABLE_SIZE, bold });
  const header = ['DATES', 'DAYS', 'LODGING NAME AND LOCATION', 'OCCUPANTS', 'TYPE', 'KITCHEN', 'PER DAY', 'EXTRA', 'TOTAL'];
  const rows: Cell[][] = m.lines.map((l) => [
    small(cols[0], [l.dateText, ...l.notes].join('\n')),
    small(cols[1], String(l.days)),
    small(cols[2], l.lodgingName),
    small(cols[3], l.occupants),
    small(cols[4], l.lodgingKind === 'government' ? 'Government' : 'Commercial'),
    small(cols[5], l.kitchen ? 'Yes' : 'No'),
    small(cols[6], tlaMoneyText(l.dailyLodging)),
    small(cols[7], l.extraRoomCharge ? tlaMoneyText(l.extraRoomCharge) : ''),
    small(cols[8], tlaMoneyText(l.lodgingTotal)),
  ]);
  if (rows.length === 0) rows.push(cols.map((w) => small(w, '')));
  rows.push([
    small(cols[0], 'TOTAL', true),
    small(cols[1], String(m.totalDays), true),
    small(cols.slice(2, 8).reduce((a, b) => a + b, 0), m.incompletePeriods.length ? `Period ${m.incompletePeriods.join(', ')} left out: dates missing.` : ''),
    small(cols[8], m.lodgingTotalText, true),
  ]);
  s.table(header.map((label, i) => small(cols[i], label, true)), rows, m.lodgingNote);

  s.section('SECTION IV. GTCC AND HOUSING ALLOWANCE');
  s.row([
    { w: 130, label: '18. SPLIT TO GTCC', value: m.gtccText },
    { w: WIDTH - 130, label: 'NOTE', value: m.gtccNote, size: SMALL },
  ]);
  s.row([{ w: WIDTH, label: '19. OVERLAP WITH OHA, BAH OR GOVERNMENT QUARTERS', value: m.overlap }]);

  s.section('SECTION V. SIGNATURES');
  signatureRow(s, '20. MARINE CLAIMING TLA', m.marineSignature);
  signatureRow(s, '21. TLA AUTHORITY\'S AUTHORIZING OFFICIAL', m.authorizingOfficial);
}

function drawHousing(s: Sheet, fonts: Fonts, m: TlaPacketModel) {
  s.newPage();
  titleBlock(s, fonts, 'TLA HOUSING SEARCH STATEMENT', `Required of the Marine by ${FMR} para 4.2.3 and 4.4.1. Not an official form.`);
  s.section('SECTION I. TLA PERIOD');
  s.row([
    { w: 180, label: '1. NAME', value: m.name },
    { w: 90, label: '2. TLA BEGAN', value: m.tlaBegan },
    { w: 90, label: '3. TLA ENDED', value: m.tlaEnded },
    { w: WIDTH - 360, label: '4. HOUSING OFFICIAL', value: m.housingOfficial },
  ]);
  s.section('SECTION II. PROGRESS');
  const cols = [90, WIDTH - 90];
  const rows: Cell[][] = m.housingLog.map((e) => [{ w: cols[0], value: e.date }, { w: cols[1], value: e.action }]);
  while (rows.length < 6) rows.push([{ w: cols[0], value: '' }, { w: cols[1], value: '' }]);
  s.table([
    { w: cols[0], value: 'DATE', bold: true, size: TABLE_SIZE },
    { w: cols[1], value: 'ACTION TAKEN, OR REPORT TO THE HOUSING OFFICIAL', bold: true, size: TABLE_SIZE },
  ], rows);
  s.section('SECTION III. STATEMENT');
  s.note(m.housingStatement);
  signatureRow(s, '5. MARINE CLAIMING TLA', m.marineSignature);
  signatureRow(s, '6. HOUSING OFFICIAL', m.housingOfficial);
}

function drawCertificates(s: Sheet, fonts: Fonts, m: TlaPacketModel) {
  if (m.certificates.length === 0) return;
  s.newPage();
  titleBlock(s, fonts, 'TLA CERTIFICATIONS', 'Printed only for the situations this claim marks. Not an official form.');
  s.row([
    { w: 300, label: 'NAME', value: m.name },
    { w: WIDTH - 300, label: 'OCONUS PDS', value: m.pds },
  ]);
  for (const c of m.certificates) {
    s.section(`${c.title} (${c.citation})`);
    s.row([{ w: WIDTH, value: c.statement }]);
    if (c.detail) s.row([{ w: WIDTH, label: 'DETAILS', value: c.detail }]);
    signatureRow(s, c.signer.toUpperCase(), '');
  }
}

function drawChecklist(s: Sheet, fonts: Fonts, m: TlaPacketModel) {
  s.newPage();
  titleBlock(s, fonts, 'TLA ROUTING AND ATTACHMENTS', 'Keep with the claim. Not an official form.');
  s.section('WHAT GOES WITH THIS CLAIM');
  s.row([{ w: WIDTH, checks: m.checklist.map((label) => ({ label, on: false })) }]);
  s.note('The TLA Authority\'s written guidance governs local procedure, and the disbursing or finance office decides the amount. Authorities: DoD FMR Vol 7A Ch 68; FPM Vol 1 para 0703; MARADMIN 373/20; MCO 4600.40C.');
}

export async function generateTlaPacket(formData: FormData): Promise<Uint8Array> {
  const model = tlaPacketModel(formData);
  const doc = await PDFDocument.create();
  doc.setTitle('TLA Packet');
  const fonts: Fonts = { body: await doc.embedFont(StandardFonts.Helvetica), bold: await doc.embedFont(StandardFonts.HelveticaBold) };
  const s = new Sheet(doc, fonts);

  drawRequest(s, fonts, model);
  if (model.kind !== 'advance') drawHousing(s, fonts, model);
  drawCertificates(s, fonts, model);
  drawChecklist(s, fonts, model);

  // Marking, handling and page numbers, once the count is known. Handling
  // sits in the footer of every page: a separated sheet still carries it,
  // and it can never spill alone onto a page of its own.
  const total = s.pages.length;
  const mw = fonts.bold.widthOfTextAtSize(PRIVACY_MARKING, SMALL + 1);
  const handling = `HANDLING. ${model.handling}`;
  const hw = fonts.body.widthOfTextAtSize(handling, HANDLING_SIZE);
  s.pages.forEach((page, i) => {
    page.drawText(PRIVACY_MARKING, { x: (PAGE_W - mw) / 2, y: PAGE_H - 30, size: SMALL + 1, font: fonts.bold, color: INK });
    page.drawText(handling, { x: (PAGE_W - hw) / 2, y: 36, size: HANDLING_SIZE, font: fonts.body, color: INK });
    page.drawText(PRIVACY_MARKING, { x: (PAGE_W - mw) / 2, y: 26, size: SMALL + 1, font: fonts.bold, color: INK });
    const pn = `Page ${i + 1} of ${total}`;
    page.drawText(pn, { x: PAGE_W - MARGIN - fonts.body.widthOfTextAtSize(pn, SMALL), y: 26, size: SMALL, font: fonts.body, color: INK });
  });

  return doc.save();
}
