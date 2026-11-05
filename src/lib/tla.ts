/**
 * TLA Packet: what a proper Temporary Lodging Allowance request must state.
 *
 * AUTHORITIES. DoD FMR Vol 7A Ch 68 sets the entitlement and its conditions
 * (section 4). JTR no longer holds TLA and points there. FPM Vol 1 para 0703
 * is the Marine Corps claim process, MARADMIN 373/20 the GTCC split. The FPM
 * is marked DoD Community Only and this repository is public: cite it by
 * paragraph and paraphrase it, never quote it, and leave its transaction
 * codes out.
 *
 * FACTS ONLY, NO RATES. The per diem follows from the location and dates, and
 * the disbursing or finance office holds the rates and computes the amount
 * (owner decision, 4 Nov 26). So this module takes no rate, computes no
 * ceiling, M&IE or TLA, and adds up only the lodging the Marine actually paid.
 *
 * Payment runs on the command's NAVMC 11116. Nothing here blocks an export:
 * the checks are advisories with their authority beside them.
 */
import type { FormData } from '@/types';
import type { ValidationIssue } from '@/lib/letter-validators';

// --- choices ---

export type TlaRequestKind = 'settlement' | 'additional' | 'advance';
export type TlaCoverage = 'lodging-and-mie' | 'lodging-only' | 'mie-only';
export type TlaLodgingKind = 'commercial' | 'government';

export const TLA_REQUEST_KINDS: readonly { value: TlaRequestKind; label: string; hint: string }[] = [
  { value: 'settlement', label: 'Settlement', hint: 'Claim for days already lodged, with receipts.' },
  { value: 'additional', label: 'Additional period', hint: 'More TLA past the period already authorized.' },
  { value: 'advance', label: 'Advance', hint: 'Payment before the days are lodged, up to 15 days.' },
];

export const TLA_SITUATIONS: readonly { value: string; label: string; citation: string }[] = [
  { value: 'arrival', label: 'Arrival at an OCONUS PDS, or house hunting after reporting', citation: 'DoD FMR Vol 7A Ch 68 para 4.3.1.1, 4.3.1.5' },
  { value: 'departure', label: 'Before PCS departure from an OCONUS PDS, after vacating housing', citation: 'DoD FMR Vol 7A Ch 68 para 4.3.1.2, 4.9' },
  { value: 'delayed-departure', label: 'Departure delayed through no fault of the Marine or dependent', citation: 'DoD FMR Vol 7A Ch 68 Table 68-10 rule 2' },
  { value: 'after-tdy', label: 'No dependents, seeking housing after 90 or more days of TDY', citation: 'DoD FMR Vol 7A Ch 68 para 4.3.1.3' },
  { value: 'hospitalized-en-route', label: 'Dependents lodging while the Marine is hospitalized en route', citation: 'DoD FMR Vol 7A Ch 68 para 4.3.1.4' },
  { value: 'beyond-control', label: 'Must vacate or wait to reoccupy permanent housing, beyond the Marine\'s control', citation: 'DoD FMR Vol 7A Ch 68 para 4.3.1.6' },
];

export const TLA_ADDITIONAL_REASONS: readonly { value: string; label: string; citation: string }[] = [
  { value: 'hhg', label: 'Household goods have not arrived', citation: 'DoD FMR Vol 7A Ch 68 para 4.6.1.1' },
  { value: 'quarters-delay', label: 'Service requirements delay Government quarters', citation: 'DoD FMR Vol 7A Ch 68 para 4.6.1.2' },
  { value: 'disaster', label: 'Disaster or civil disturbance made housing unavailable', citation: 'DoD FMR Vol 7A Ch 68 para 4.6.1.3' },
  { value: 'landlord', label: 'Landlord withdrew the housing from the market', citation: 'DoD FMR Vol 7A Ch 68 para 4.6.1.4' },
  { value: 'no-suitable-housing', label: 'No suitable private-sector housing, per the housing officer', citation: 'DoD FMR Vol 7A Ch 68 para 4.6.1.5' },
  { value: 'hospital-or-duty', label: 'Hospitalization, or duties away from the PDS, limited the search', citation: 'DoD FMR Vol 7A Ch 68 para 4.6.1.6' },
  { value: 'other', label: 'Other reason beyond the Marine\'s or dependent\'s control', citation: 'DoD FMR Vol 7A Ch 68 para 4.3.2' },
];

export const TLA_EARLY_TERMINATION_REASONS: readonly { value: string; label: string }[] = [
  { value: 'hhg-shipment', label: 'Transportation Officer set the household goods shipment date' },
  { value: 'lease', label: 'Lease ended or was terminated after the PCS order or alert notice' },
  { value: 'landlord', label: 'Landlord withdrew the housing from the market' },
  { value: 'disaster', label: 'Disaster or disturbance made occupancy inadvisable' },
  { value: 'fixed-date', label: 'Lease, custom or law requires surrender on a fixed earlier date' },
  { value: 'government-convenience', label: 'Housing authority required vacating for the Government\'s convenience' },
  { value: 'tla-authority', label: 'TLA Authority determined the housing must be relinquished' },
];

// --- stored shapes ---

export interface TlaPeriod {
  startDate: string;
  endDate: string;
  /** Where the Marine lodged. The location can change which per diem finance applies. */
  lodgingName: string;
  memberOccupying: boolean;
  dependents12Plus: string;
  dependentsUnder12: string;
  dailyLodgingCost: string;
  /** Lodging tax, VAT relief certificate cost and GTCC currency fees, per day. */
  dailyFees: string;
  lodgingKind: TlaLodgingKind;
  kitchen: boolean;
  coverage: TlaCoverage;
  /** Charge for an extra day from check-in or check-out time. */
  extraRoomCharge: string;
}

export interface TlaHousingEntry {
  date: string;
  action: string;
}

export function emptyTlaPeriod(): TlaPeriod {
  return {
    startDate: '',
    endDate: '',
    lodgingName: '',
    memberOccupying: true,
    dependents12Plus: '',
    dependentsUnder12: '',
    dailyLodgingCost: '',
    dailyFees: '',
    lodgingKind: 'commercial',
    kitchen: false,
    coverage: 'lodging-and-mie',
    extraRoomCharge: '',
  };
}

export function tlaField(formData: FormData, name: string): string {
  const value = (formData as Record<string, unknown>)[name];
  return typeof value === 'string' ? value : value == null ? '' : String(value);
}

export function tlaFlag(formData: FormData, name: string): boolean {
  return (formData as Record<string, unknown>)[name] === true;
}

export function tlaPeriods(formData: FormData): TlaPeriod[] {
  const value = (formData as Record<string, unknown>).tlaPeriods;
  return Array.isArray(value) ? (value as Partial<TlaPeriod>[]).map((p) => ({ ...emptyTlaPeriod(), ...p })) : [];
}

export function tlaHousingLog(formData: FormData): TlaHousingEntry[] {
  const value = (formData as Record<string, unknown>).tlaHousingLog;
  return Array.isArray(value) ? (value as TlaHousingEntry[]) : [];
}

export function tlaRequestKind(formData: FormData): TlaRequestKind {
  const value = tlaField(formData, 'tlaRequestKind');
  return value === 'additional' || value === 'advance' ? value : 'settlement';
}

// --- small readers ---

/** A typed amount as a number, or null when it is empty or not a number. */
export function parseTlaMoney(text: string): number | null {
  const cleaned = String(text ?? '').replace(/[$,\s]/g, '');
  if (!cleaned || !/^\d*\.?\d*$/.test(cleaned) || cleaned === '.') return null;
  return Number(cleaned);
}

function count(text: string): number {
  const n = Number.parseInt(String(text ?? '').trim(), 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

const DAY_MS = 86_400_000;

/** A calendar day number from YYYY-MM-DD, free of any time zone. */
function dayNumber(iso: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso ?? '').trim());
  if (!m) return null;
  const ms = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const check = new Date(ms);
  if (check.getUTCMonth() !== Number(m[2]) - 1) return null;
  return Math.round(ms / DAY_MS);
}

/** Clears binary noise from a sum of typed amounts. */
function exact(n: number): number {
  return Math.round(n * 100) / 100;
}

export function tlaMoneyText(n: number): string {
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// --- the facts, added up ---

/** One lodging period as the request states it. */
export interface TlaLine {
  /** 1-based period this line came from. */
  period: number;
  startDate: string;
  endDate: string;
  days: number;
  lodgingName: string;
  lodgingKind: TlaLodgingKind;
  kitchen: boolean;
  occupants: string;
  /** Lodging, tax and fees paid per day. Zero when no lodging is claimed. */
  dailyLodging: number;
  extraRoomCharge: number;
  lodgingTotal: number;
  notes: string[];
}

export interface TlaSummary {
  lines: TlaLine[];
  lodgingTotal: number;
  totalDays: number;
  /** 1-based periods left out because their dates are missing or reversed. */
  incompletePeriods: number[];
}

function occupantsText(p: TlaPeriod): string {
  const parts: string[] = [];
  if (p.memberOccupying) parts.push('Marine');
  const older = count(p.dependents12Plus);
  const younger = count(p.dependentsUnder12);
  if (older) parts.push(`${older} dep 12+`);
  if (younger) parts.push(`${younger} under 12`);
  return parts.join(', ') || 'None';
}

export function summarizeTla(formData: FormData): TlaSummary {
  const incompletePeriods: number[] = [];
  const lines: TlaLine[] = [];

  tlaPeriods(formData).forEach((p, index) => {
    const first = dayNumber(p.startDate);
    const last = dayNumber(p.endDate);
    if (first === null || last === null || last < first) {
      incompletePeriods.push(index + 1);
      return;
    }
    const days = last - first + 1;
    const claimsLodging = p.coverage !== 'mie-only';
    const dailyLodging = claimsLodging
      ? exact((parseTlaMoney(p.dailyLodgingCost) ?? 0) + (parseTlaMoney(p.dailyFees) ?? 0))
      : 0;
    const extraRoomCharge = claimsLodging ? parseTlaMoney(p.extraRoomCharge) ?? 0 : 0;
    const notes: string[] = [];
    if (p.coverage === 'lodging-only') notes.push('Lodging only');
    if (p.coverage === 'mie-only') notes.push('M&IE only');
    lines.push({
      period: index + 1,
      startDate: p.startDate,
      endDate: p.endDate,
      days,
      lodgingName: p.lodgingName,
      lodgingKind: p.lodgingKind,
      kitchen: p.kitchen,
      occupants: occupantsText(p),
      dailyLodging,
      extraRoomCharge,
      lodgingTotal: exact(dailyLodging * days + extraRoomCharge),
      notes,
    });
  });

  return {
    lines,
    lodgingTotal: exact(lines.reduce((sum, l) => sum + l.lodgingTotal, 0)),
    totalDays: lines.reduce((sum, l) => sum + l.days, 0),
    incompletePeriods,
  };
}

// --- advisories ---

export interface TlaAdvisory {
  id: string;
  text: string;
  citation: string;
  /** The form field to jump to, when one field owns it. */
  field?: string;
}

const FMR = 'DoD FMR Vol 7A Ch 68';
const ARRIVAL_SITUATIONS = new Set(['arrival']);
const LOG_SITUATIONS = new Set(['arrival', 'after-tdy', 'beyond-control']);

export function tlaAdvisories(formData: FormData): TlaAdvisory[] {
  const out: TlaAdvisory[] = [];
  const add = (id: string, text: string, citation: string, field?: string) => out.push({ id, text, citation, field });

  const situation = tlaField(formData, 'tlaSituation');
  const kind = tlaRequestKind(formData);
  const summary = summarizeTla(formData);
  const periods = tlaPeriods(formData);
  const days = summary.totalDays;
  const prior = count(tlaField(formData, 'tlaPriorDays'));

  if (summary.incompletePeriods.length) {
    add('period-incomplete', `Period ${summary.incompletePeriods.join(', ')} is left out of the totals until it has valid dates.`, `${FMR} para 4.2.3.3`);
  }
  if (days > 0 && !situation) {
    add('situation-missing', 'Pick the situation. It decides which limits and conditions apply.', `${FMR} para 4.3.1`, 'tlaSituation');
  }
  if (summary.lines.some((l) => periods[l.period - 1].coverage !== 'mie-only' && parseTlaMoney(periods[l.period - 1].dailyLodgingCost) === null)) {
    add('lodging-cost-missing', 'Enter the daily lodging cost for each period that claims lodging.', `${FMR} para 6.2.3.2`);
  }

  // --- periods and limits
  if (ARRIVAL_SITUATIONS.has(situation) && kind !== 'additional' && prior + days > 60) {
    add('arrival-over-60', `This brings arrival TLA to ${prior + days} days. TLA should not ordinarily exceed 60 days; past that, request an additional period with a reason.`, `${FMR} para 4.6.1`, 'tlaRequestKind');
  }
  if (kind === 'additional' && !tlaField(formData, 'tlaAdditionalReason')) {
    add('additional-reason', 'An additional period must establish the need for TLA. Pick the reason.', `${FMR} para 4.3.2.2, 4.6.1`, 'tlaAdditionalReason');
  }
  if (kind === 'additional' && ARRIVAL_SITUATIONS.has(situation) && days > 15) {
    add('additional-over-15', 'An additional arrival period is authorized in increments of 15 days or fewer.', `${FMR} para 4.6.1`);
  }
  if (situation === 'delayed-departure' && days > 10) {
    add('delayed-over-10', 'Delayed departure TLA is authorized in increments of 10 days or fewer.', `${FMR} Table 68-10 rule 2`);
  }
  if (kind === 'advance' && days > 15) {
    add('advance-over-15', 'An advance may not exceed 15 days of TLA.', 'FPM Vol 1 para 070303');
  }

  const firstDay = summary.lines.length ? Math.min(...summary.lines.map((l) => dayNumber(l.startDate)!)) : null;
  const lastDay = summary.lines.length ? Math.max(...summary.lines.map((l) => dayNumber(l.endDate)!)) : null;

  const departure = dayNumber(tlaField(formData, 'tlaDepartureDate'));
  if (situation === 'departure' && departure !== null && firstDay !== null && departure - firstDay > 10 && !tlaFlag(formData, 'tlaCertEarlyTermination')) {
    add('departure-over-10', 'Departure TLA cannot start more than 10 days before the Marine leaves, unless an exception applies. If housing had to be given up early, add the early termination certificate.', `${FMR} para 4.9.1, Table 68-10 rule 3`, 'tlaDepartureDate');
  }

  const hhg = dayNumber(tlaField(formData, 'tlaHhgDeliveryDate'));
  if (hhg !== null && lastDay !== null && lastDay >= hhg) {
    add('hhg-delivered', 'TLA must stop the day household goods are delivered, and these dates reach that day. Check the last day with the disbursing or finance office.', `${FMR} para 4.6.3`, 'tlaHhgDeliveryDate');
  }

  if (days >= 30) {
    add('computation-too-long', `This claim holds ${days} days. TLA is computed in 15-day increments, and only a final period under 30 days may be one payment. Split this claim.`, `${FMR} para 6.2.1`);
  } else if (days > 15) {
    add('computation-period', `This claim holds ${days} days. TLA is computed in 15-day increments; a final period of 16 to 29 days may be one payment.`, `${FMR} para 6.2.1`);
  }

  // --- what the claim must carry
  if (kind !== 'advance' && summary.lodgingTotal > 0 && !tlaFlag(formData, 'tlaReceiptsAttached')) {
    add('receipts', 'Itemized lodging receipts, invoices or vendor statements are required to verify lodging.', `${FMR} para 4.2.3.7, 6.2.3.2.1`, 'tlaReceiptsAttached');
  }

  if (kind !== 'advance' && days > 0 && parseTlaMoney(tlaField(formData, 'tlaGtccSplit')) === null) {
    add('gtcc-split-missing', 'Enter the amount to split to the GTCC, even if it is zero. With no amount, finance reviews the card balance and splits that instead.', 'MARADMIN 373/20 para 3.g, 3.h', 'tlaGtccSplit');
  }

  if (tlaFlag(formData, 'tlaHousingOverlap') && !tlaField(formData, 'tlaOverlapComment').trim()) {
    add('overlap-comment', 'Overlap with OHA, BAH or Government quarters must be justified on the request so finance can validate it.', 'FPM Vol 1 para 070301.B', 'tlaOverlapComment');
  }

  // --- the housing search
  const log = tlaHousingLog(formData);
  if (LOG_SITUATIONS.has(situation) && kind !== 'advance' && days > 0 && log.length === 0) {
    add('housing-log-empty', 'Log registering with the housing official. Progress is reported at intervals of 15 days or fewer.', `${FMR} para 4.2.3.2`);
  }
  const logDays = log.map((e) => dayNumber(e.date)).filter((d): d is number => d !== null).sort((a, b) => a - b);
  if (logDays.some((d, i) => i > 0 && d - logDays[i - 1] > 15)) {
    add('housing-log-gap', 'The housing log has a gap past 15 days. Progress is reported at intervals of 15 days or fewer.', `${FMR} para 4.2.3.2`);
  }

  // --- period checks
  periods.forEach((p, i) => {
    const first = dayNumber(p.startDate);
    const last = dayNumber(p.endDate);
    if ((parseTlaMoney(p.extraRoomCharge) ?? 0) > 0 && first !== null && last !== null && last > first) {
      add('extra-charge-period', `Period ${i + 1} has an extra room charge across more than one day. Give that day its own period so finance can see which day it was.`, `${FMR} para 6.1.2`);
    }
  });
  const spans = periods
    .map((p, i) => ({ i, first: dayNumber(p.startDate), last: dayNumber(p.endDate) }))
    .filter((s): s is { i: number; first: number; last: number } => s.first !== null && s.last !== null && s.last >= s.first)
    .sort((a, b) => a.first - b.first);
  const clash = spans.find((s, n) => n > 0 && s.first <= spans[n - 1].last);
  if (clash) {
    add('period-overlap', `Period ${clash.i + 1} overlaps another period. Each TLA day is claimed once.`, `${FMR} para 4.5`);
  }

  return out;
}

/** The same checks in the proofread dialog. Warnings only: none blocks. */
export function runTlaValidators(formData: FormData): ValidationIssue[] {
  if (formData.documentType !== 'tla-packet') return [];
  return tlaAdvisories(formData).map((a) => ({
    id: `tla-${a.id}`,
    severity: 'warn' as const,
    rule: a.text,
    citation: a.citation,
    detail: 'Check for this TLA claim. The TLA Authority\'s written guidance and the disbursing or finance office decide it; nothing here blocks an export.',
    field: a.field,
  }));
}

// --- names ---

export function tlaDraftTitle(formData: FormData): string {
  const name = tlaField(formData, 'tlaMarineLastName').trim();
  const firstDay = tlaPeriods(formData)
    .map((p) => p.startDate)
    .filter((d) => dayNumber(d) !== null)
    .sort()[0];
  if (!name && !firstDay) return '';
  return ['TLA', name, firstDay].filter(Boolean).join(' - ');
}
