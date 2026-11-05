/**
 * TLA Packet rules: DoD FMR Vol 7A Ch 68 section 4 (conditions) and
 * section 6 with Table 68-11 (computation).
 */
import { describe, it, expect } from 'vitest';
import type { FormData } from '@/types';
import {
  computeTla, emptyTlaPeriod, tlaAdvisories, tlaDraftTitle, tlaPercentages, type TlaPeriod,
} from '@/lib/tla';

function period(p: Partial<TlaPeriod> = {}): TlaPeriod {
  return {
    ...emptyTlaPeriod(),
    startDate: '2026-11-01',
    endDate: '2026-11-05',
    memberOccupying: true,
    perDiemLodging: '200',
    perDiemMie: '100',
    dailyLodgingCost: '150',
    ...p,
  };
}

function form(fields: Record<string, unknown>): FormData {
  return { documentType: 'tla-packet', ...fields } as unknown as FormData;
}

function ids(formData: FormData): string[] {
  return tlaAdvisories(formData).map((a) => a.id);
}

describe('Table 68-11 percentages', () => {
  const pct = (member: boolean, older: number, younger: number, couple = false) =>
    tlaPercentages({ member, dependents12Plus: older, dependentsUnder12: younger, memberCoupleTogether: couple });

  it('gives one person 100 percent lodging and 65 percent M&IE', () => {
    expect(pct(true, 0, 0)).toEqual({ lodging: 100, mie: 65 });
    expect(pct(false, 1, 0)).toEqual({ lodging: 100, mie: 65 });
  });

  it('gives the member and one dependent, or two dependents, 100 percent together', () => {
    expect(pct(true, 1, 0)).toEqual({ lodging: 100, mie: 100 });
    expect(pct(false, 2, 0)).toEqual({ lodging: 100, mie: 100 });
  });

  it('adds 35 percent for each further dependent 12 or older and 25 for each under 12', () => {
    // Marine, spouse, one teen, two children: 100 + 35 + 25 + 25.
    expect(pct(true, 2, 2)).toEqual({ lodging: 185, mie: 185 });
  });

  it('takes the oldest dependent into the first two persons when there is no spouse', () => {
    // Marine, one teen, one child: the teen is in the 100, the child adds 25.
    expect(pct(true, 1, 1)).toEqual({ lodging: 125, mie: 125 });
    // Two children only: 100 together.
    expect(pct(false, 0, 2)).toEqual({ lodging: 100, mie: 100 });
  });

  it('gives a Service member couple lodging together 65 percent each', () => {
    expect(pct(true, 0, 0, true)).toEqual({ lodging: 65, mie: 65 });
  });

  it('ignores the couple rate once a dependent is in the lodging', () => {
    expect(pct(true, 1, 0, true)).toEqual({ lodging: 100, mie: 100 });
  });

  it('pays nothing when nobody eligible occupies the lodging', () => {
    expect(pct(false, 0, 0)).toEqual({ lodging: 0, mie: 0 });
  });
});

describe('computeTla', () => {
  it('pays the lesser of actual lodging and the ceiling, plus M&IE, for every day', () => {
    const result = computeTla(form({ tlaPeriods: [period({ dailyLodgingCost: '250' })] }));
    expect(result.lines).toHaveLength(1);
    const line = result.lines[0];
    expect(line.days).toBe(5);
    expect(line.lodgingCeiling).toBe(200);
    expect(line.lodgingPayable).toBe(200);
    expect(line.mie).toBe(65);
    expect(line.daily).toBe(265);
    expect(result.total).toBe(1325);
    expect(result.totalDays).toBe(5);
  });

  it('counts tax and GTCC currency fees as lodging cost', () => {
    const result = computeTla(form({ tlaPeriods: [period({ dailyLodgingCost: '150', dailyFees: '12.50' })] }));
    expect(result.lines[0].lodgingActual).toBe(162.5);
    expect(result.lines[0].lodgingPayable).toBe(162.5);
  });

  it('halves M&IE with a kitchen, except on the first and last day of TLA', () => {
    const result = computeTla(form({ tlaPeriods: [period({ kitchen: true })] }));
    expect(result.lines.map((l) => [l.startDate, l.endDate, l.days, l.mie])).toEqual([
      ['2026-11-01', '2026-11-01', 1, 65],
      ['2026-11-02', '2026-11-04', 3, 32.5],
      ['2026-11-05', '2026-11-05', 1, 65],
    ]);
  });

  it('halves every day of a claim that holds neither the first nor the last day', () => {
    const result = computeTla(form({
      tlaClaimHasFirstDay: false, tlaClaimHasLastDay: false, tlaPeriods: [period({ kitchen: true })],
    }));
    expect(result.lines).toHaveLength(1);
    expect(result.lines[0].mie).toBe(32.5);
  });

  it('keeps sub-cent amounts instead of rounding the daily rate', () => {
    const result = computeTla(form({
      tlaClaimHasFirstDay: false, tlaClaimHasLastDay: false,
      tlaPeriods: [period({ perDiemMie: '87', kitchen: true, startDate: '2026-11-01', endDate: '2026-11-01' })],
    }));
    expect(result.lines[0].mie).toBe(28.275);
  });

  it('pays M&IE only with no lodging when staying with friends or relatives, unreduced', () => {
    const result = computeTla(form({ tlaPeriods: [period({ coverage: 'mie-only', kitchen: true, dailyLodgingCost: '150' })] }));
    expect(result.lines).toHaveLength(1);
    expect(result.lines[0].lodgingPayable).toBe(0);
    expect(result.lines[0].mie).toBe(65);
  });

  it('pays lodging only when meals are paid elsewhere', () => {
    const result = computeTla(form({ tlaPeriods: [period({ coverage: 'lodging-only' })] }));
    expect(result.lines[0].lodgingPayable).toBe(150);
    expect(result.lines[0].mie).toBe(0);
  });

  it('raises the commercial ceiling to 1.5 times for an extra room charge, on that day only', () => {
    const result = computeTla(form({
      tlaPeriods: [period({ dailyLodgingCost: '180', extraRoomCharge: '180', startDate: '2026-11-01', endDate: '2026-11-02' })],
    }));
    expect(result.lines.map((l) => [l.days, l.lodgingCeiling, l.lodgingPayable])).toEqual([
      [1, 300, 300],
      [1, 200, 180],
    ]);
  });

  it('adds an extra room charge on top of the ceiling for Government lodging', () => {
    const result = computeTla(form({
      tlaPeriods: [period({
        lodgingKind: 'government', dailyLodgingCost: '250', extraRoomCharge: '75', startDate: '2026-11-01', endDate: '2026-11-01',
      })],
    }));
    expect(result.lines[0].lodgingCeiling).toBe(200);
    expect(result.lines[0].lodgingPayable).toBe(275);
  });

  it('applies the couple rate from the claim to a member-only period', () => {
    const result = computeTla(form({ tlaMemberCoupleTogether: true, tlaPeriods: [period({ dailyLodgingCost: '250' })] }));
    expect(result.lines[0].lodgingPayable).toBe(130);
    expect(result.lines[0].mie).toBe(65);
  });

  it('reads money typed with a dollar sign and commas', () => {
    const result = computeTla(form({ tlaPeriods: [period({ perDiemLodging: '$1,200.00', dailyLodgingCost: '$1,000.50' })] }));
    expect(result.lines[0].lodgingPayable).toBe(1000.5);
  });

  it('leaves a period with unusable dates out of the total and names it', () => {
    const result = computeTla(form({ tlaPeriods: [period(), period({ startDate: '2026-11-10', endDate: '2026-11-08' })] }));
    expect(result.totalDays).toBe(5);
    expect(result.incompletePeriods).toEqual([2]);
  });

  it('leaves a period with no per diem rate out of the total and names it', () => {
    const result = computeTla(form({ tlaPeriods: [period({ perDiemLodging: '', perDiemMie: '' })] }));
    expect(result.lines).toEqual([]);
    expect(result.incompletePeriods).toEqual([1]);
  });

  it('returns an empty computation for a new packet', () => {
    const result = computeTla(form({}));
    expect(result).toMatchObject({ lines: [], total: 0, totalDays: 0, incompletePeriods: [] });
  });
});

describe('tlaAdvisories', () => {
  it('warns past 60 arrival days unless the request is for an additional period', () => {
    const fields = {
      tlaSituation: 'arrival',
      tlaPriorDays: '58',
      tlaPeriods: [period()],
    };
    expect(ids(form(fields))).toContain('arrival-over-60');
    expect(ids(form({ ...fields, tlaRequestKind: 'additional', tlaAdditionalReason: 'hhg' }))).not.toContain('arrival-over-60');
  });

  it('does not count departure days against the 60-day arrival limit', () => {
    expect(ids(form({ tlaSituation: 'departure', tlaPriorDays: '58', tlaPeriods: [period()] }))).not.toContain('arrival-over-60');
  });

  it('asks for a reason on an additional period', () => {
    expect(ids(form({ tlaRequestKind: 'additional', tlaPeriods: [period()] }))).toContain('additional-reason');
  });

  it('warns when one additional arrival period runs past 15 days', () => {
    const fields = {
      tlaSituation: 'arrival', tlaRequestKind: 'additional', tlaAdditionalReason: 'hhg',
      tlaPeriods: [period({ startDate: '2026-11-01', endDate: '2026-11-16' })],
    };
    expect(ids(form(fields))).toContain('additional-over-15');
  });

  it('warns when one delayed-departure period runs past 10 days', () => {
    const fields = {
      tlaSituation: 'delayed-departure', tlaRequestKind: 'additional', tlaAdditionalReason: 'other',
      tlaPeriods: [period({ startDate: '2026-11-01', endDate: '2026-11-11' })],
    };
    expect(ids(form(fields))).toContain('delayed-over-10');
  });

  it('warns when departure TLA starts more than 10 days before leaving', () => {
    const base = { tlaSituation: 'departure', tlaPeriods: [period({ startDate: '2026-11-01', endDate: '2026-11-05' })] };
    expect(ids(form({ ...base, tlaDepartureDate: '2026-11-12' }))).toContain('departure-over-10');
    expect(ids(form({ ...base, tlaDepartureDate: '2026-11-11' }))).not.toContain('departure-over-10');
  });

  it('accepts early departure TLA when the early-termination certificate explains it', () => {
    expect(ids(form({
      tlaSituation: 'departure', tlaDepartureDate: '2026-11-20', tlaCertEarlyTermination: true, tlaPeriods: [period()],
    }))).not.toContain('departure-over-10');
  });

  it('warns about any TLA day on or after household goods delivery', () => {
    const base = { tlaSituation: 'arrival', tlaPeriods: [period()] };
    expect(ids(form({ ...base, tlaHhgDeliveryDate: '2026-11-05' }))).toContain('hhg-delivered');
    expect(ids(form({ ...base, tlaHhgDeliveryDate: '2026-11-06' }))).not.toContain('hhg-delivered');
  });

  it('warns past 15 days in one computation and asks for a split at 30', () => {
    const at = (end: string) => ids(form({ tlaPeriods: [period({ startDate: '2026-11-01', endDate: end })] }));
    expect(at('2026-11-15')).not.toContain('computation-period');
    expect(at('2026-11-16')).toContain('computation-period');
    expect(at('2026-11-30')).toContain('computation-too-long');
  });

  it('warns on an advance past 15 days', () => {
    const fields = { tlaRequestKind: 'advance', tlaPeriods: [period({ startDate: '2026-11-01', endDate: '2026-11-16' })] };
    expect(ids(form(fields))).toContain('advance-over-15');
  });

  it('asks for itemized receipts while lodging is claimed without them', () => {
    expect(ids(form({ tlaPeriods: [period()] }))).toContain('receipts');
    expect(ids(form({ tlaReceiptsAttached: true, tlaPeriods: [period()] }))).not.toContain('receipts');
    expect(ids(form({ tlaPeriods: [period({ coverage: 'mie-only' })] }))).not.toContain('receipts');
  });

  it('does not ask for receipts on an advance, which is paid before they exist', () => {
    expect(ids(form({ tlaRequestKind: 'advance', tlaPeriods: [period()] }))).not.toContain('receipts');
  });

  it('asks for the GTCC split amount on a settlement, and accepts zero', () => {
    const base = { tlaPeriods: [period()] };
    expect(ids(form(base))).toContain('gtcc-split-missing');
    expect(ids(form({ ...base, tlaGtccSplit: '0' }))).not.toContain('gtcc-split-missing');
    expect(ids(form({ tlaRequestKind: 'advance', ...base }))).not.toContain('gtcc-split-missing');
  });

  it('warns when the split is more than the computed TLA', () => {
    const base = { tlaPeriods: [period({ startDate: '2026-11-01', endDate: '2026-11-01' })] };
    expect(ids(form({ ...base, tlaGtccSplit: '500' }))).toContain('gtcc-split-over-total');
    expect(ids(form({ ...base, tlaGtccSplit: '215' }))).not.toContain('gtcc-split-over-total');
  });

  it('asks for a comment when TLA overlaps a housing allowance or Government quarters', () => {
    expect(ids(form({ tlaHousingOverlap: true, tlaPeriods: [period()] }))).toContain('overlap-comment');
    expect(ids(form({ tlaHousingOverlap: true, tlaOverlapComment: 'Five days per unit guidance.', tlaPeriods: [period()] }))).not.toContain('overlap-comment');
  });

  it('warns when the housing log has a gap past 15 days', () => {
    const base = { tlaSituation: 'arrival', tlaPeriods: [period()] };
    expect(ids(form({ ...base, tlaHousingLog: [{ date: '2026-11-01', action: 'Registered' }, { date: '2026-11-17', action: 'Called' }] }))).toContain('housing-log-gap');
    expect(ids(form({ ...base, tlaHousingLog: [{ date: '2026-11-01', action: 'Registered' }, { date: '2026-11-16', action: 'Called' }] }))).not.toContain('housing-log-gap');
  });

  it('asks an arriving Marine to log registration with the housing official', () => {
    expect(ids(form({ tlaSituation: 'arrival', tlaPeriods: [period()] }))).toContain('housing-log-empty');
    expect(ids(form({ tlaSituation: 'departure', tlaPeriods: [period()] }))).not.toContain('housing-log-empty');
  });

  it('warns when one extra room charge sits on a period longer than a day', () => {
    expect(ids(form({ tlaPeriods: [period({ extraRoomCharge: '100' })] }))).toContain('extra-charge-period');
    expect(ids(form({ tlaPeriods: [period({ extraRoomCharge: '100', endDate: '2026-11-01' })] }))).not.toContain('extra-charge-period');
  });

  it('names periods which overlap', () => {
    const overlapping = [period(), period({ startDate: '2026-11-05', endDate: '2026-11-06' })];
    expect(ids(form({ tlaPeriods: overlapping }))).toContain('period-overlap');
  });

  it('cites an authority on every advisory', () => {
    const all = tlaAdvisories(form({
      tlaSituation: 'arrival', tlaPriorDays: '70', tlaHousingOverlap: true,
      tlaPeriods: [period({ extraRoomCharge: '10' }), period()],
    }));
    expect(all.length).toBeGreaterThan(3);
    for (const a of all) expect(a.citation.trim()).not.toBe('');
  });

  it('stays quiet about a new blank packet except what starts the request', () => {
    expect(ids(form({}))).toEqual([]);
  });
});

describe('tlaDraftTitle', () => {
  it('names the draft by the Marine and first TLA day', () => {
    expect(tlaDraftTitle(form({ tlaMarineLastName: 'Rivera', tlaPeriods: [period()] }))).toBe('TLA - Rivera - 2026-11-01');
  });

  it('is empty when the packet identifies nobody', () => {
    expect(tlaDraftTitle(form({}))).toBe('');
  });
});
