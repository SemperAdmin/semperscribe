/**
 * TLA Packet rules: what a proper request must state (DoD FMR Vol 7A Ch 68
 * section 4; FPM Vol 1 para 0703; MARADMIN 373/20). The packet states facts.
 * Finance sets the per diem from the location and computes the amount.
 */
import { describe, it, expect } from 'vitest';
import type { FormData } from '@/types';
import { DOCUMENT_TYPES } from '@/lib/schemas';
import {
  emptyTlaPeriod, summarizeTla, tlaAdvisories, tlaDraftTitle, type TlaPeriod,
} from '@/lib/tla';

function period(p: Partial<TlaPeriod> = {}): TlaPeriod {
  return {
    ...emptyTlaPeriod(),
    startDate: '2026-11-01',
    endDate: '2026-11-05',
    memberOccupying: true,
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

describe('no rates and no computed TLA', () => {
  it('stores no per diem field on a period', () => {
    expect(Object.keys(emptyTlaPeriod()).join()).not.toMatch(/perDiem|rate/i);
  });

  it('has no rate field in the schema', () => {
    const periods = DOCUMENT_TYPES['tla-packet'].schema.shape.tlaPeriods;
    expect(JSON.stringify(periods.def ?? periods)).not.toMatch(/perDiem/);
  });

  it('counts a period with dates and a lodging cost, with no rate anywhere', () => {
    const result = summarizeTla(form({ tlaPeriods: [period()] }));
    expect(result.incompletePeriods).toEqual([]);
    expect(result.totalDays).toBe(5);
    expect(result.lodgingTotal).toBe(750);
  });
});

describe('summarizeTla', () => {
  it('states the lodging paid each day, with tax and GTCC fees in it', () => {
    const { lines, lodgingTotal } = summarizeTla(form({ tlaPeriods: [period({ dailyLodgingCost: '150', dailyFees: '12.50' })] }));
    expect(lines[0].dailyLodging).toBe(162.5);
    expect(lines[0].days).toBe(5);
    expect(lodgingTotal).toBe(812.5);
  });

  it('adds one extra room charge once, not per day', () => {
    const { lodgingTotal } = summarizeTla(form({ tlaPeriods: [period({ extraRoomCharge: '100' })] }));
    expect(lodgingTotal).toBe(850);
  });

  it('claims no lodging on an M&IE-only period', () => {
    const { lines, lodgingTotal, totalDays } = summarizeTla(form({ tlaPeriods: [period({ coverage: 'mie-only' })] }));
    expect(lines[0].lodgingTotal).toBe(0);
    expect(lodgingTotal).toBe(0);
    expect(totalDays).toBe(5);
  });

  it('carries the facts finance needs on each line', () => {
    const { lines } = summarizeTla(form({ tlaPeriods: [period({
      lodgingName: 'Example Inn', lodgingKind: 'government', kitchen: true, dependents12Plus: '1', dependentsUnder12: '2',
    })] }));
    expect(lines[0]).toMatchObject({
      period: 1, lodgingName: 'Example Inn', lodgingKind: 'government', kitchen: true,
      occupants: 'Marine, 1 dep 12+, 2 under 12',
    });
  });

  it('says who is in the lodging when the Marine is not', () => {
    const { lines } = summarizeTla(form({ tlaPeriods: [period({ memberOccupying: false, dependents12Plus: '1' })] }));
    expect(lines[0].occupants).toBe('1 dep 12+');
  });

  it('reads money typed with a dollar sign and commas', () => {
    expect(summarizeTla(form({ tlaPeriods: [period({ dailyLodgingCost: '$1,000.50', endDate: '2026-11-01' })] })).lodgingTotal).toBe(1000.5);
  });

  it('leaves a period with unusable dates out and names it', () => {
    const result = summarizeTla(form({ tlaPeriods: [period(), period({ startDate: '2026-11-10', endDate: '2026-11-08' })] }));
    expect(result.totalDays).toBe(5);
    expect(result.incompletePeriods).toEqual([2]);
  });

  it('returns an empty summary for a new packet', () => {
    expect(summarizeTla(form({}))).toMatchObject({ lines: [], lodgingTotal: 0, totalDays: 0, incompletePeriods: [] });
  });
});

describe('tlaAdvisories', () => {
  it('asks for the situation once lodging is entered', () => {
    expect(ids(form({ tlaPeriods: [period()] }))).toContain('situation-missing');
    expect(ids(form({ tlaSituation: 'arrival', tlaPeriods: [period()] }))).not.toContain('situation-missing');
  });

  it('asks for the lodging cost when lodging is claimed without one', () => {
    expect(ids(form({ tlaPeriods: [period({ dailyLodgingCost: '' })] }))).toContain('lodging-cost-missing');
    expect(ids(form({ tlaPeriods: [period({ dailyLodgingCost: '', coverage: 'mie-only' })] }))).not.toContain('lodging-cost-missing');
  });

  it('warns past 60 arrival days unless the request is for an additional period', () => {
    const fields = { tlaSituation: 'arrival', tlaPriorDays: '58', tlaPeriods: [period()] };
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

  it('warns past 15 days in one claim and asks for a split at 30', () => {
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

  it('stays quiet about a new blank packet', () => {
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
