/**
 * TLA Packet: the rules behind the Temporary Lodging Allowance claim.
 *
 * AUTHORITIES. DoD FMR Vol 7A Ch 68 sets the entitlement and the
 * computation (section 4 conditions, section 6 and Table 68-11). JTR no
 * longer holds TLA and points there. FPM Vol 1 para 0703 is the Marine
 * Corps claim process, MARADMIN 373/20 the GTCC split. The FPM is marked
 * DoD Community Only and this repository is public: cite it by paragraph
 * and paraphrase it, never quote it, and leave its transaction codes out.
 *
 * WHAT THIS IS NOT. Payment runs on the command's NAVMC 11116, and the
 * disbursing or finance office's computation governs. The TLA Authority's
 * written guidance sets local procedure, so nothing here blocks an export:
 * the checks are advisories with their authority beside them.
 *
 * Rates are typed in, never stored. Per diem changes, and DTMO publishes
 * the current percentages (Table 68-11 note 1).
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
  memberOccupying: boolean;
  dependents12Plus: string;
  dependentsUnder12: string;
  /** The locality per diem, split as DTMO publishes it. */
  perDiemLodging: string;
  perDiemMie: string;
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
    memberOccupying: true,
    dependents12Plus: '',
    dependentsUnder12: '',
    perDiemLodging: '',
    perDiemMie: '',
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

function isoFromDay(day: number): string {
  return new Date(day * DAY_MS).toISOString().slice(0, 10);
}

/** Clears binary noise only. The FMR computes "without rounding". */
function exact(n: number): number {
  return Math.round(n * 1_000_000) / 1_000_000;
}

/** Whole dollars and cents, for totals. */
export function tlaMoneyText(n: number): string {
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** A daily rate: at least two decimals, more only when the rate has them. */
export function tlaRateText(n: number): string {
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 })}`;
}

// --- Table 68-11 ---

export interface TlaOccupants {
  member: boolean;
  dependents12Plus: number;
  dependentsUnder12: number;
  /** Two Service members married to each other, lodging together. */
  memberCoupleTogether?: boolean;
}

/**
 * Table 68-11 and para 6.2.3.1.7. One person: 100 lodging, 65 M&IE. The
 * first two persons share 100. Each further dependent adds 35, or 25
 * under age 12. Without a spouse the oldest dependent is in the first
 * two, so dependents 12 and older are consumed first.
 */
export function tlaPercentages(o: TlaOccupants): { lodging: number; mie: number } {
  const persons = (o.member ? 1 : 0) + o.dependents12Plus + o.dependentsUnder12;
  if (persons === 0) return { lodging: 0, mie: 0 };
  if (persons === 1) {
    return o.member && o.memberCoupleTogether ? { lodging: 65, mie: 65 } : { lodging: 100, mie: 65 };
  }
  const inFirstTwo = o.member ? 1 : 2;
  const olderInFirstTwo = Math.min(inFirstTwo, o.dependents12Plus);
  const youngerInFirstTwo = inFirstTwo - olderInFirstTwo;
  const pct = 100 + (o.dependents12Plus - olderInFirstTwo) * 35 + (o.dependentsUnder12 - youngerInFirstTwo) * 25;
  return { lodging: pct, mie: pct };
}

// --- the computation ---

/** One run of days at one daily rate (FPM Vol 1 para 070301.G: one entry per rate). */
export interface TlaLine {
  /** 1-based period this line came from. */
  period: number;
  startDate: string;
  endDate: string;
  days: number;
  occupants: string;
  lodgingPct: number;
  miePct: number;
  lodgingCeiling: number;
  lodgingActual: number;
  lodgingPayable: number;
  mie: number;
  daily: number;
  total: number;
  notes: string[];
}

export interface TlaComputation {
  lines: TlaLine[];
  total: number;
  totalDays: number;
  /** 1-based periods left out because dates or rates are missing. */
  incompletePeriods: number[];
}

function occupantsText(o: TlaOccupants): string {
  const parts: string[] = [];
  if (o.member) parts.push('Marine');
  if (o.dependents12Plus) parts.push(`${o.dependents12Plus} dep 12+`);
  if (o.dependentsUnder12) parts.push(`${o.dependentsUnder12} under 12`);
  return parts.join(', ') || 'None';
}

export function computeTla(formData: FormData): TlaComputation {
  const periods = tlaPeriods(formData);
  const incompletePeriods: number[] = [];
  const usable: { p: TlaPeriod; index: number; first: number; last: number }[] = [];

  periods.forEach((p, index) => {
    const first = dayNumber(p.startDate);
    const last = dayNumber(p.endDate);
    const rates = parseTlaMoney(p.perDiemLodging) !== null || parseTlaMoney(p.perDiemMie) !== null;
    if (first === null || last === null || last < first || !rates) {
      incompletePeriods.push(index + 1);
      return;
    }
    usable.push({ p, index, first, last });
  });

  const claimFirst = usable.length ? Math.min(...usable.map((u) => u.first)) : 0;
  const claimLast = usable.length ? Math.max(...usable.map((u) => u.last)) : 0;
  // A claim holds the first and last day of TLA unless the user says it
  // is a middle claim. Para 6.3.4.1 keeps full M&IE on those two days.
  const hasFirst = (formData as Record<string, unknown>).tlaClaimHasFirstDay !== false;
  const hasLast = (formData as Record<string, unknown>).tlaClaimHasLastDay !== false;
  const couple = tlaFlag(formData, 'tlaMemberCoupleTogether');

  const lines: TlaLine[] = [];
  for (const { p, index, first, last } of usable) {
    const occupants: TlaOccupants = {
      member: p.memberOccupying,
      dependents12Plus: count(p.dependents12Plus),
      dependentsUnder12: count(p.dependentsUnder12),
      memberCoupleTogether: couple,
    };
    const pct = tlaPercentages(occupants);
    const perDiemLodging = parseTlaMoney(p.perDiemLodging) ?? 0;
    const perDiemMie = parseTlaMoney(p.perDiemMie) ?? 0;
    const cost = (parseTlaMoney(p.dailyLodgingCost) ?? 0) + (parseTlaMoney(p.dailyFees) ?? 0);
    const extra = parseTlaMoney(p.extraRoomCharge) ?? 0;
    const paysLodging = p.coverage !== 'mie-only';
    const paysMie = p.coverage !== 'lodging-only';

    for (let day = first; day <= last; day++) {
      const isExtraDay = extra > 0 && day === first;
      const commercialExtra = isExtraDay && p.lodgingKind === 'commercial';
      const lodgingPct = commercialExtra ? pct.lodging * 1.5 : pct.lodging;
      const lodgingCeiling = exact((perDiemLodging * lodgingPct) / 100);
      // Para 6.1.2: a commercial extra charge is tested against 1.5 times
      // the ceiling. Para 6.3.1: under Government jurisdiction it is added
      // to the day's TLA, on top of the standard computation.
      const lodgingActual = exact(commercialExtra ? cost + extra : cost);
      let lodgingPayable = paysLodging ? Math.min(lodgingActual, lodgingCeiling) : 0;
      if (isExtraDay && !commercialExtra && paysLodging) lodgingPayable += extra;
      lodgingPayable = exact(lodgingPayable);

      const firstOrLast = (hasFirst && day === claimFirst) || (hasLast && day === claimLast);
      // Para 6.3.4.1: the kitchen halves M&IE, except the first and last
      // day and except when a friend or relative provides the lodging.
      const halved = p.kitchen && paysLodging && !firstOrLast;
      const fullMie = (perDiemMie * pct.mie) / 100;
      const mie = paysMie ? exact(halved ? fullMie / 2 : fullMie) : 0;
      const daily = exact(lodgingPayable + mie);

      const notes: string[] = [];
      if (halved && paysMie) notes.push('M&IE halved, kitchen');
      if (isExtraDay) notes.push(commercialExtra ? 'Extra room charge, 1.5 ceiling' : 'Extra room charge added');
      if (!paysLodging) notes.push('M&IE only');
      if (!paysMie) notes.push('Lodging only');

      const prior = lines[lines.length - 1];
      const same = prior
        && prior.period === index + 1
        && prior.daily === daily
        && prior.lodgingPayable === lodgingPayable
        && prior.mie === mie
        && prior.lodgingCeiling === lodgingCeiling
        && prior.notes.join() === notes.join();
      if (same) {
        prior.endDate = isoFromDay(day);
        prior.days += 1;
        prior.total = exact(prior.total + daily);
      } else {
        lines.push({
          period: index + 1,
          startDate: isoFromDay(day),
          endDate: isoFromDay(day),
          days: 1,
          occupants: occupantsText(occupants),
          lodgingPct,
          miePct: paysMie ? pct.mie : 0,
          lodgingCeiling,
          lodgingActual: paysLodging ? lodgingActual : 0,
          lodgingPayable,
          mie,
          daily,
          total: daily,
          notes,
        });
      }
    }
  }

  return {
    lines,
    total: exact(lines.reduce((sum, l) => sum + l.total, 0)),
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
  const computed = computeTla(formData);
  const periods = tlaPeriods(formData);
  const days = computed.totalDays;
  const prior = count(tlaField(formData, 'tlaPriorDays'));

  if (computed.incompletePeriods.length) {
    add('period-incomplete', `Period ${computed.incompletePeriods.join(', ')} is left out of the total until it has valid dates and a locality rate.`, `${FMR} para 6.2.3`);
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

  const firstDay = computed.lines.length ? Math.min(...computed.lines.map((l) => dayNumber(l.startDate)!)) : null;
  const lastDay = computed.lines.length ? Math.max(...computed.lines.map((l) => dayNumber(l.endDate)!)) : null;

  const departure = dayNumber(tlaField(formData, 'tlaDepartureDate'));
  if (situation === 'departure' && departure !== null && firstDay !== null && departure - firstDay > 10 && !tlaFlag(formData, 'tlaCertEarlyTermination')) {
    add('departure-over-10', 'Departure TLA cannot start more than 10 days before the Marine leaves, unless an exception applies. If housing had to be given up early, add the early termination certificate.', `${FMR} para 4.9.1, Table 68-10 rule 3`, 'tlaDepartureDate');
  }

  const hhg = dayNumber(tlaField(formData, 'tlaHhgDeliveryDate'));
  if (hhg !== null && lastDay !== null && lastDay >= hhg) {
    add('hhg-delivered', 'TLA must stop the day household goods are delivered, and these dates reach that day. Check the last day with the disbursing or finance office.', `${FMR} para 4.6.3`, 'tlaHhgDeliveryDate');
  }

  if (days >= 30) {
    add('computation-too-long', `This computation holds ${days} days. TLA is computed in 15-day increments, and only a final period under 30 days may be one payment. Split this claim.`, `${FMR} para 6.2.1`);
  } else if (days > 15) {
    add('computation-period', `This computation holds ${days} days. TLA is computed in 15-day increments; a final period of 16 to 29 days may be one payment.`, `${FMR} para 6.2.1`);
  }

  // --- what the claim must carry
  const claimsLodging = computed.lines.some((l) => l.lodgingPayable > 0);
  if (kind !== 'advance' && claimsLodging && !tlaFlag(formData, 'tlaReceiptsAttached')) {
    add('receipts', 'Itemized lodging receipts, invoices or vendor statements are required to verify lodging.', `${FMR} para 4.2.3.7, 6.2.3.2.1`, 'tlaReceiptsAttached');
  }

  const split = tlaField(formData, 'tlaGtccSplit').trim();
  const splitAmount = parseTlaMoney(split);
  if (kind !== 'advance' && computed.total > 0 && splitAmount === null) {
    add('gtcc-split-missing', 'Enter the amount to split to the GTCC, even if it is zero. With no amount, finance reviews the card balance and splits that instead.', 'MARADMIN 373/20 para 3.g, 3.h', 'tlaGtccSplit');
  }
  if (splitAmount !== null && computed.total > 0 && splitAmount > computed.total) {
    add('gtcc-split-over-total', `The split is more than the ${tlaMoneyText(computed.total)} computed. No more than the TLA credit goes to the card.`, 'FPM Vol 1 para 070301.H', 'tlaGtccSplit');
  }

  if (tlaFlag(formData, 'tlaHousingOverlap') && !tlaField(formData, 'tlaOverlapComment').trim()) {
    add('overlap-comment', 'Overlap with OHA, BAH or Government quarters must be justified on the request so finance can validate it.', 'FPM Vol 1 para 070301.B', 'tlaOverlapComment');
  }

  // --- the housing search
  const log = tlaHousingLog(formData);
  if (LOG_SITUATIONS.has(situation) && days > 0 && log.length === 0) {
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
      add('extra-charge-period', `Period ${i + 1} has an extra room charge across more than one day. It counts on the first day only, so give that day its own period.`, `${FMR} para 6.1.2`);
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
