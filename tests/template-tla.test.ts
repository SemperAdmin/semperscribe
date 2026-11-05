// @vitest-environment node
/**
 * The TLA Packet templates: each parses against the schema, lands under
 * the TLA type, computes to a total worked by hand from Table 68-11, and
 * leaves open only what the drafter must still do.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { TlaPacketSchema } from '@/lib/schemas';
import { computeTla, emptyTlaPeriod, tlaAdvisories } from '@/lib/tla';
import { generateTlaPacket, tlaPacketModel } from '@/services/pdf/tlaPacketGenerator';
import type { FormData } from '@/types';

const GLOBAL_DIR = join(__dirname, '..', 'public', 'templates', 'global');
type IndexEntry = { id: string; title: string; description: string; documentType?: string; url: string };
const index: IndexEntry[] = JSON.parse(readFileSync(join(GLOBAL_DIR, 'index.json'), 'utf-8'));

/** Worked by hand: id, days, total, and the checks left open. */
const SAMPLES: [string, number, number, string[]][] = [
  // Marine, spouse, two children: 150 percent. Reporting day lodging only, $260.
  // Then 14 days at $260 lodging + $150 M&IE = $410.
  ['tla-arrival-family', 15, 260 + 14 * 410, ['receipts']],
  // Same family, kitchen, a middle claim: $180 lodging + $75 M&IE, 15 days.
  ['tla-arrival-additional', 15, 15 * 255, ['receipts']],
  // Marine and spouse: 100 percent. $170 lodging + $100 M&IE, 14 days.
  ['tla-departure-early-termination', 14, 14 * 270, ['receipts']],
  // Marine alone: $120 lodging + $65 M&IE, 5 days. No receipts yet.
  ['tla-advance-arrival', 5, 5 * 185, []],
  // Marine alone: 5 days at $130 + $65, then 10 days TAD at lodging only.
  ['tla-tdy-military-necessity', 15, 5 * 195 + 10 * 130, ['receipts']],
];

function load(id: string): FormData {
  const entry = index.find((e) => e.id === id);
  expect(entry, `${id} is missing from index.json`).toBeDefined();
  expect(entry!.documentType).toBe('tla-packet');
  const nldp = JSON.parse(readFileSync(join(GLOBAL_DIR, entry!.url.replace('/templates/global/', '')), 'utf-8'));
  expect(nldp.metadata.package.documentType).toBe('tla-packet');
  return nldp.data.formData as FormData;
}

describe('TLA Packet templates', () => {
  it.each(SAMPLES)('%s parses and computes to the hand-worked total', (id, days, total) => {
    const fd = load(id);
    expect(TlaPacketSchema.safeParse(fd).success).toBe(true);
    const computed = computeTla(fd);
    expect(computed.incompletePeriods).toEqual([]);
    expect(computed.totalDays).toBe(days);
    expect(computed.total).toBe(total);
  });

  it.each(SAMPLES)('%s leaves open only what the drafter must still do', (id, _days, _total, open) => {
    expect(tlaAdvisories(load(id)).map((a) => a.id)).toEqual(open);
  });

  it.each(SAMPLES)('%s renders and says it is sample data', async (id) => {
    const fd = load(id);
    expect((await generateTlaPacket(fd)).length).toBeGreaterThan(1000);
    expect(index.find((e) => e.id === id)!.description).toMatch(/Sample data/);
  });

  it('carries no personal identifier and no real rate claim', () => {
    for (const [id] of SAMPLES) {
      const fd = load(id) as unknown as Record<string, unknown>;
      expect(fd.tlaMarineEdipi ?? '').toBe('');
      expect(index.find((e) => e.id === id)!.description).toMatch(/current DTMO/);
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
      tlaPeriods: [{ ...emptyTlaPeriod(), startDate: '2026-11-01', endDate: '2026-11-02', perDiemLodging: '200', perDiemMie: '100' }],
    } as unknown as FormData;
    expect(tlaAdvisories(fd).map((a) => a.id)).not.toContain('housing-log-empty');
  });
});
