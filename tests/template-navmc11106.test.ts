/**
 * The NAVMC 11106 example templates: one per case the form handles. Each
 * lands under the type, computes the Part A, C10, D3, and Remarks worked by
 * hand from docs/NAVMC_11106_SPEC.md sections 3.3, 4, 9.1, and 9.2, shows only
 * the warnings it exists to show, and fills the official form.
 */
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { PDFDocument } from 'pdf-lib';
import type { FormData } from '@/types';
import { NAVMC_11106_SPONSORSHIP_BASES } from '@/types/navmc';
import { DOCUMENT_TYPES } from '@/lib/schemas';
import { exportNavmc11106Form } from '@/lib/navmc11106-export';
import { runNavmc11106Validators } from '@/lib/navmc11106-validators';
import {
  combinedRemarks,
  commandSponsoredDate,
  dependentRows,
  partAValue,
  spouseRow,
  suggestedEffectiveDate,
  type Navmc11106PartA,
} from '@/lib/navmc11106-rules';

const here = dirname(fileURLToPath(import.meta.url));
vi.mock('@/lib/assets', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/assets')>()),
  loadAssetBytes: vi.fn(async () => new Uint8Array(readFileSync(resolve(here, '../public/forms/navmc-11106-blank.pdf')))),
}));

const GLOBAL_DIR = join(here, '..', 'public', 'templates', 'global');
type IndexEntry = { id: string; title: string; description: string; documentType?: string; url: string };
const index: IndexEntry[] = JSON.parse(readFileSync(join(GLOBAL_DIR, 'index.json'), 'utf-8'));

const SPOUSE = 'SPOUSE B SAMPLE';
const SON = 'CHILD C SAMPLE';
const DAUGHTER = 'CHILD D SAMPLE';

interface Sample {
  id: string;
  part: Navmc11106PartA;
  c10: string;
  /** Printed D3, and the date the rules suggest for it. */
  d3: string;
  /** Names that reach Part C. Anything else in the file must not print. */
  printed: string[];
  remarks: string;
  warnings: string[];
}

/** Worked by hand from the spec, not read back from the rules. */
const SAMPLES: Sample[] = [
  // Box 1: D3 is B7.
  { id: 'navmc11106-member-only', part: 'mem', c10: '', d3: '2026-06-12', printed: [], remarks: '', warnings: [] },
  // Box 1 with MALT Plus on the reporting day: the day after B7.
  { id: 'navmc11106-member-only-malt-plus', part: 'mem', c10: '', d3: '2026-06-13', printed: [], remarks: '', warnings: [] },
  // Approved 01-20, arrived 04-05: the later of C9 and C10.
  { id: 'navmc11106-accompanied-approved', part: 'both', c10: '2026-01-20', d3: '2026-04-05', printed: [SPOUSE, SON], remarks: '', warnings: [] },
  // Born 09-14, after arrival: C10 and D3 are the birth, and the spouse's earlier date moves to Remarks.
  {
    id: 'navmc11106-birth', part: 'both', c10: '2026-09-14', d3: '2026-09-14', printed: [SPOUSE, SON],
    remarks: `C10: ${SPOUSE} COMMAND SPONSORED 2025-11-03.`, warnings: [],
  },
  // Placed 08-20, not the 2025 date of birth.
  {
    id: 'navmc11106-adoption', part: 'both', c10: '2026-08-20', d3: '2026-08-20', printed: [SPOUSE, DAUGHTER],
    remarks: `C10: ${SPOUSE} COMMAND SPONSORED 2025-11-03.`, warnings: [],
  },
  // CMC approved 07-15, spouse arrived 08-20.
  { id: 'navmc11106-tour-conversion', part: 'both', c10: '2026-07-15', d3: '2026-08-20', printed: [SPOUSE], remarks: '', warnings: [] },
  // Awarded 06-10, spouse arrived 07-02.
  { id: 'navmc11106-command-award', part: 'both', c10: '2026-06-10', d3: '2026-07-02', printed: [SPOUSE], remarks: '', warnings: [] },
  // Separated 05-31: the next day, and no C9 because the spouse is already at the PDS.
  {
    id: 'navmc11106-spouse-separated', part: 'both', c10: '2026-06-01', d3: '2026-06-01', printed: [SPOUSE],
    remarks: 'SPOUSE SEPARATED FROM ACTIVE DUTY 2026-05-31.', warnings: [],
  },
  // No date on the row, so C9 alone sets D3.
  {
    id: 'navmc11106-sponsorship-not-required', part: 'both', c10: '', d3: '2026-06-18', printed: [SPOUSE],
    remarks: `${SPOUSE}: COMMAND SPONSORSHIP NOT REQUIRED.`, warnings: [],
  },
  // Box 3: D3 is C9.
  {
    id: 'navmc11106-dependents-only-dual-cola', part: 'dep', c10: '', d3: '2026-03-20', printed: [SPOUSE, SON],
    remarks: `${SPOUSE}: PAID AT DEPENDENT LOCATION. ${SON}: PAID AT DEPENDENT LOCATION.`, warnings: [],
  },
  // Box 3, CONUS: the ZIP goes in Remarks, and Part D is not required (PRIUM 80101 par 3.a(4)).
  {
    id: 'navmc11106-dependents-conus', part: 'dep', c10: '', d3: '', printed: [SPOUSE, SON],
    remarks: `${SPOUSE}: PAID AT DEPENDENT LOCATION. ${SON}: PAID AT DEPENDENT LOCATION. CONUS COLA. ZIP 92055.`, warnings: [],
  },
  // Nobody counted, so box 1 and B7, with both warnings the case exists to show.
  {
    id: 'navmc11106-not-sponsored', part: 'mem', c10: '', d3: '2026-03-15', printed: [], remarks: '',
    warnings: ['navmc11106-not-sponsored-excluded', 'navmc11106-reduced-rate'],
  },
  {
    id: 'navmc11106-active-duty-spouse', part: 'mem', c10: '', d3: '2026-03-15', printed: [], remarks: '',
    warnings: ['navmc11106-active-duty-spouse-excluded'],
  },
];

function load(id: string): FormData {
  const entry = index.find((e) => e.id === id);
  expect(entry, `${id} is missing from index.json`).toBeDefined();
  const nldp = JSON.parse(readFileSync(join(GLOBAL_DIR, entry!.url.replace('/templates/global/', '')), 'utf-8'));
  expect(entry!.documentType).toBe('navmc11106');
  expect(nldp.metadata.packageId).toBe(id);
  expect(nldp.metadata.package.documentType).toBe('navmc11106');
  return nldp.data.formData as FormData;
}

const each = SAMPLES.map((s) => [s.id, s] as const);

describe('NAVMC 11106 templates', () => {
  it.each(each)('%s parses and says it is sample data', (id) => {
    expect(DOCUMENT_TYPES.navmc11106.schema.safeParse(load(id)).success).toBe(true);
    expect(index.find((e) => e.id === id)!.description).toMatch(/Sample data - replace before use\.$/);
  });

  it.each(each)('%s computes what was worked by hand', (id, s) => {
    const fd = load(id);
    expect(partAValue(fd)).toBe(s.part);
    expect(commandSponsoredDate(fd)).toBe(s.c10);
    expect(fd.effectiveDate).toBe(s.d3);
    expect(suggestedEffectiveDate(fd)).toBe(s.d3);
    expect(combinedRemarks(fd)).toBe(s.remarks);
  });

  it.each(each)('%s shows only the warnings it exists to show', (id, s) => {
    const issues = runNavmc11106Validators(load(id));
    expect(issues.map((i) => i.id).sort()).toEqual([...s.warnings].sort());
    expect(issues.every((i) => i.severity === 'warn')).toBe(true);
  });

  it.each(each)('%s fills the official form', async (id, s) => {
    const P = 'topmostSubform[0].Page1[0].';
    const blob = await exportNavmc11106Form(load(id));
    const form = (await PDFDocument.load(new Uint8Array(await blob.arrayBuffer()))).getForm();
    const text = (name: string) => form.getTextField(`${P}${name}[0]`).getText() ?? '';

    expect(form.getRadioGroup(`${P}RadA1[0]`).getSelected()).toBe(s.part);
    expect(text('DateDepComnd')).toBe(s.c10);
    expect(text('DateApplcEffct')).toBe(s.d3);
    expect(text('RemrkD3')).toBe(s.remarks);
    const names = ['NameSps1', ...[2, 3, 4, 5, 6, 7].map((n) => `NameDep${n}`)].map(text).filter(Boolean);
    expect(names).toEqual(s.printed);
  });

  it('covers every sponsorship basis and every Part A box', () => {
    const forms = SAMPLES.map((s) => load(s.id));
    const bases = new Set(forms.flatMap((fd) => [spouseRow(fd), ...dependentRows(fd)].map((r) => r.sponsorshipBasis)));
    for (const basis of NAVMC_11106_SPONSORSHIP_BASES) {
      expect(bases.has(basis), `no template uses ${basis}`).toBe(true);
    }
    expect(new Set(forms.map(partAValue))).toEqual(new Set(['mem', 'both', 'dep']));
  });

  it('flags the two cases that rest on a reading of policy', () => {
    for (const id of ['navmc11106-dependents-only-dual-cola', 'navmc11106-dependents-conus']) {
      expect(index.find((e) => e.id === id)!.description).toMatch(/PRIUM does not state/);
    }
  });

  it('leaves Part D blank on the CONUS case, which does not require it', () => {
    const fd = load('navmc11106-dependents-conus');
    for (const key of ['d1Quarters', 'd1Assignment', 'd2Mess', 'd2Who', 'd2b', 'effectiveDate', 'coDate', 'coNameGradeActivity']) {
      expect(fd[key] ?? '', key).toBe('');
    }
  });
});
