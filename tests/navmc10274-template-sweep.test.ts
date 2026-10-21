/**
 * Every shipped AA Form template (public/templates/global/aa-*.nldp)
 * through the NAVMC 10274 fit check: a template that will not fit the
 * official form the moment a drafter opens it is a defect in the pack,
 * not in the drafter's wording (docs/NAVMC_10274_LAYOUT_PLAN.md, PR 3).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { navmc10274FitReport } from '@/lib/navmc10274-fit';
import { NAVMC10274_FIELDS, aaLineCapacity } from '@/lib/navmc10274-layout';
import type { FormData, ParagraphData } from '@/types';

const DIR = join(__dirname, '..', 'public', 'templates', 'global');
interface IndexEntry { id: string; documentType: string; title: string }
const index = JSON.parse(readFileSync(join(DIR, 'index.json'), 'utf8')) as IndexEntry[];
const pack = index.filter(e => e.documentType === 'aa-form' && existsSync(join(DIR, `${e.id}.nldp`)));

// A pack template stores its lists as plain strings; an app export (NLDP
// 1.1) stores them as { text, order } records. Both are read.
type Listed = string | { text: string };
interface Pkg { data: { formData: FormData; paragraphs: ParagraphData[]; vias?: Listed[]; references?: Listed[]; enclosures?: Listed[]; copyTos?: Listed[] } }
const text = (xs: Listed[] | undefined) => (xs ?? []).map(x => (typeof x === 'string' ? x : x.text));

function reportFor(id: string) {
  const { data } = JSON.parse(readFileSync(join(DIR, `${id}.nldp`), 'utf8')) as Pkg;
  // A template ships with the name blank; the sweep measures it with a
  // name of the longest common form so the signature group is counted.
  const formData = { ...data.formData, sig: data.formData.sig || 'F. M. LASTNAME' };
  return navmc10274FitReport({
    formData, paragraphs: data.paragraphs,
    vias: text(data.vias), references: text(data.references), enclosures: text(data.enclosures), copyTos: text(data.copyTos),
  });
}

describe('AA Form template pack against the official form', () => {
  it('covers the whole pack', () => {
    expect(pack.length).toBe(27);
  });

  it.each(pack.map(e => [e.id] as const))('%s fits block 12 and block 13', (id) => {
    const r = reportFor(id);
    expect(r.flow.fits, `${id}: ${r.flow.totalLines} lines, block 13 holds ${aaLineCapacity(NAVMC10274_FIELDS.ProcAct)}`).toBe(true);
  });

  it('reports which templates reach block 13 and which small boxes overflow', () => {
    const rows = pack.map(e => {
      const r = reportFor(e.id);
      return {
        id: e.id,
        block12: r.flow.block12.length,
        block13: r.flow.block13.length,
        over: r.overflows.map(o => `${o.field.block}:${o.lines}/${o.capacity}`),
      };
    });
    // The table is the deliverable of this sweep; the assertion pins the
    // state measured on 2026-10-21 so a template edit that pushes one past
    // a box fails here, with the row to read. Measured: no small box
    // overflows anywhere in the pack; one template, the Reserve O6-level
    // SgtMaj slate request, fills block 12 (30 lines) and runs 12 lines
    // into block 13 with the name. Whether to shorten it is the owner's
    // call (docs/NAVMC_10274_LAYOUT_PLAN.md, PR 3 findings).
    const reaching13 = rows.filter(r => r.block13 > 0).map(r => `${r.id} ${r.block12}+${r.block13}`);
    const overflowing = rows.filter(r => r.over.length > 0).map(r => `${r.id} ${r.over.join(' ')}`);
    expect({ reaching13, overflowing }).toEqual({ reaching13: ['aa-sgtmaj-slate 30+12'], overflowing: [] });
  });
});
