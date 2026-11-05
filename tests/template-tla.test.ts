// @vitest-environment node
/**
 * The TLA Packet templates: each parses against the schema, lands under
 * the TLA type, totals the lodging worked by hand, holds no rate, and
 * leaves open only what the drafter must still do.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { TlaPacketSchema } from '@/lib/schemas';
import { emptyTlaPeriod, summarizeTla, tlaAdvisories } from '@/lib/tla';
import { generateTlaPacket, tlaPacketModel } from '@/services/pdf/tlaPacketGenerator';
import type { FormData } from '@/types';

const GLOBAL_DIR = join(__dirname, '..', 'public', 'templates', 'global');
type IndexEntry = { id: string; title: string; description: string; documentType?: string; url: string };
const index: IndexEntry[] = JSON.parse(readFileSync(join(GLOBAL_DIR, 'index.json'), 'utf-8'));

/** Worked by hand: id, days, lodging total, and the checks left open. */
const SAMPLES: [string, number, number, string[]][] = [
  // $250 + $10 tax, 15 days. The reporting day still claims lodging.
  ['tla-arrival-family', 15, 15 * 260, ['receipts']],
  // $180, 15 days.
  ['tla-arrival-additional', 15, 15 * 180, ['receipts']],
  // $170, 14 days.
  ['tla-departure-early-termination', 14, 14 * 170, ['receipts']],
  // $120, 5 days. No receipts yet.
  ['tla-advance-arrival', 5, 5 * 120, []],
  // $130, 15 days, TAD days included.
  ['tla-tdy-military-necessity', 15, 15 * 130, ['receipts']],
];

function raw(id: string): string {
  const entry = index.find((e) => e.id === id);
  expect(entry, `${id} is missing from index.json`).toBeDefined();
  return readFileSync(join(GLOBAL_DIR, entry!.url.replace('/templates/global/', '')), 'utf-8');
}

function load(id: string): FormData {
  const entry = index.find((e) => e.id === id)!;
  expect(entry.documentType).toBe('tla-packet');
  const nldp = JSON.parse(raw(id));
  expect(nldp.metadata.package.documentType).toBe('tla-packet');
  return nldp.data.formData as FormData;
}

describe('TLA Packet templates', () => {
  it.each(SAMPLES)('%s parses and totals the lodging worked by hand', (id, days, total) => {
    const fd = load(id);
    expect(TlaPacketSchema.safeParse(fd).success).toBe(true);
    const summary = summarizeTla(fd);
    expect(summary.incompletePeriods).toEqual([]);
    expect(summary.totalDays).toBe(days);
    expect(summary.lodgingTotal).toBe(total);
  });

  it.each(SAMPLES)('%s leaves open only what the drafter must still do', (id, _days, _total, open) => {
    expect(tlaAdvisories(load(id)).map((a) => a.id)).toEqual(open);
  });

  it.each(SAMPLES)('%s renders and says it is sample data', async (id) => {
    const fd = load(id);
    expect((await generateTlaPacket(fd)).length).toBeGreaterThan(1000);
    expect(index.find((e) => e.id === id)!.description).toMatch(/Sample data/);
  });

  it.each(SAMPLES)('%s holds no rate, percentage or dropped field', (id) => {
    expect(raw(id)).not.toMatch(/perDiem|tlaAuthorityGuidance|tlaLodgingNote|tlaClaimHas/);
    expect(index.find((e) => e.id === id)!.description).not.toMatch(/DTMO|rate/i);
  });

  it('carries no personal identifier', () => {
    for (const [id] of SAMPLES) {
      expect((load(id) as unknown as Record<string, unknown>).tlaMarineEdipi ?? '').toBe('');
    }
  });

  it('names the lodging on every period', () => {
    for (const [id] of SAMPLES) {
      for (const line of summarizeTla(load(id)).lines) expect(line.lodgingName.trim()).not.toBe('');
    }
  });

  it('shows each situation its certificate or justification', () => {
    expect(tlaPacketModel(load('tla-arrival-additional')).additional?.reason).toMatch(/household goods/i);
    expect(tlaPacketModel(load('tla-departure-early-termination')).certificates.map((c) => c.id)).toEqual(['early-termination']);
    expect(tlaPacketModel(load('tla-tdy-military-necessity')).certificates.map((c) => c.id)).toEqual(['military-necessity']);
    expect(tlaPacketModel(load('tla-departure-early-termination')).checklist.join(' ')).toMatch(/departing/i);
    expect(tlaPacketModel(load('tla-advance-arrival')).checklist.join(' ')).toMatch(/flight date/i);
  });

  it('stores every period with the fields the editor expects', () => {
    const keys = Object.keys(emptyTlaPeriod()).sort();
    for (const [id] of SAMPLES) {
      const periods = (load(id) as unknown as { tlaPeriods: Record<string, unknown>[] }).tlaPeriods;
      for (const p of periods) expect(Object.keys(p).sort()).toEqual(keys);
    }
  });
});

describe('an advance and the housing log', () => {
  it('does not ask for a housing log before the Marine has arrived', () => {
    const fd = {
      documentType: 'tla-packet', tlaRequestKind: 'advance', tlaSituation: 'arrival',
      tlaPeriods: [{ ...emptyTlaPeriod(), startDate: '2026-11-01', endDate: '2026-11-02', dailyLodgingCost: '100' }],
    } as unknown as FormData;
    expect(tlaAdvisories(fd).map((a) => a.id)).not.toContain('housing-log-empty');
  });
});
