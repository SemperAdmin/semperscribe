// @vitest-environment node
/**
 * DD Form 368, Request for Conditional Release: the vocabulary, the
 * validators and the render. Rules cite the form's own instructions
 * (docs/INTERSERVICE_TRANSFER_DD368_SPEC.md section 2).
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { registerNodeAssets } from './node-assets';
import { extractPdfTextLayout } from './golden/helpers';
import { DD368_COMPONENTS, dd368MemberCategory, isDd368Date, isDd368Name, isDd368Component } from '@/lib/dd368';
import { runDd368Validators } from '@/lib/dd368-validators';
import { generateDd368, dd368PrintedValues } from '@/services/pdf/dd368Generator';
import { DOCUMENT_TYPES, Dd368Schema } from '@/lib/schemas';
import { requiredFieldStatus } from '@/lib/required-fields';
import { getExportFilename } from '@/lib/naval-format-utils';
import type { FormData } from '@/types';

beforeAll(() => {
  registerNodeAssets();
});

function form(overrides: Partial<FormData> = {}): FormData {
  return {
    documentType: 'dd368',
    dd368MemberName: 'SAMPLE, MARINE, A.',
    dd368PayGrade: 'E-5',
    dd368Edipi: '1234567890',
    dd368ServiceComponent: 'USMC',
    dd368CurrentUnit: 'Commanding Officer, 1st Battalion, 6th Marines, Camp Lejeune, NC 28542',
    dd368MemberStreet: '100 Sample Street', dd368MemberCity: 'Jacksonville', dd368MemberState: 'NC', dd368MemberZip: '28540',
    dd368GainingComponent: 'USNR',
    dd368MemberSignedDate: '260906',
    dd368RecruiterName: 'RECRUITER, SAMPLE, B.',
    ...overrides,
  } as FormData;
}

describe('vocabulary', () => {
  it('lists the twelve short titles the form names, in its order', () => {
    expect(DD368_COMPONENTS).toEqual(['USA', 'ARNGUS', 'USAR', 'USN', 'USNR', 'USMC', 'USMCR', 'USAF', 'ANGUS', 'USAFR', 'USCG', 'USCGR']);
    expect(isDd368Component('USMC')).toBe(true);
    expect(isDd368Component('Marine Corps')).toBe(false);
  });

  it('reads YYMMDD and nothing else', () => {
    expect(isDd368Date('260906')).toBe(true);
    expect(isDd368Date('240229')).toBe(true);
    expect(isDd368Date('230229')).toBe(false);
    expect(isDd368Date('261301')).toBe(false);
    expect(isDd368Date('2026-09-06')).toBe(false);
    expect(isDd368Date('6 Sep 26')).toBe(false);
  });

  it('reads Last, First, Middle Initial', () => {
    expect(isDd368Name('SMITH, JOHN, A.')).toBe(true);
    expect(isDd368Name('Smith, John A')).toBe(true);
    expect(isDd368Name("O'BRIEN, MARY-ANNE")).toBe(true);
    expect(isDd368Name('John A. Smith')).toBe(false);
    expect(isDd368Name('')).toBe(false);
  });

  it('decides officer or enlisted from the pay grade', () => {
    expect(dd368MemberCategory('E-5')).toBe('enlisted');
    expect(dd368MemberCategory('e5')).toBe('enlisted');
    expect(dd368MemberCategory('O-3')).toBe('officer');
    expect(dd368MemberCategory('W-2')).toBe('officer');
    expect(dd368MemberCategory('Sgt')).toBe('unknown');
    expect(dd368MemberCategory('')).toBe('unknown');
  });
});

describe('validators', () => {
  const ids = (fd: FormData) => runDd368Validators(fd).map((i) => i.id);

  it('is a no-op for every other document type', () => {
    expect(runDd368Validators({ documentType: 'basic', dd368MemberSignedDate: 'bad' } as FormData)).toEqual([]);
  });

  it('accepts the sample', () => {
    expect(ids(form())).toEqual([]);
  });

  it('blocks a date that is not YYMMDD and cites the instructions', () => {
    const [issue] = runDd368Validators(form({ dd368MemberSignedDate: '6 Sep 26' }));
    expect(issue.id).toBe('dd368-date-3.e');
    expect(issue.severity).toBe('block');
    expect(issue.citation).toContain('DD Form 368');
    expect(issue.field).toBe('dd368MemberSignedDate');
  });

  it('warns on a name out of Last, First, Middle Initial order', () => {
    const [issue] = runDd368Validators(form({ dd368MemberName: 'Marine A. Sample' }));
    expect(issue.id).toBe('dd368-name-1.a');
    expect(issue.severity).toBe('warn');
  });

  it('blocks a Service or component outside the short-title list', () => {
    expect(ids(form({ dd368GainingComponent: 'Navy Reserve' }))).toContain('dd368-component-3.b-and-4.a');
  });

  it('blocks a release into the member\'s own component', () => {
    expect(ids(form({ dd368GainingComponent: 'USMC' }))).toContain('dd368-gaining-equals-current');
  });

  it('requires the valid-until date on an approval and a 5.b remark on a disapproval', () => {
    expect(ids(form({ dd368Decision: 'approved' }))).toContain('dd368-valid-until');
    expect(ids(form({ dd368Decision: 'approved', dd368ReleaseValidUntil: '261231' }))).toEqual([]);
    expect(ids(form({ dd368Decision: 'disapproved' }))).toContain('dd368-disapproval-reason');
    expect(ids(form({ dd368Decision: 'disapproved', dd368Remarks: 'Item 5.b. Disapproved for the following reason: retention critical MOS.' }))).toEqual([]);
    expect(ids(form({ dd368Decision: '', dd368ReleaseValidUntil: '261231' }))).toContain('dd368-valid-until-without-approval');
  });

  it('blocks a pay grade it cannot classify and a malformed EDIPI', () => {
    expect(ids(form({ dd368PayGrade: 'Sergeant' }))).toContain('dd368-pay-grade');
    expect(ids(form({ dd368Edipi: '12345' }))).toContain('dd368-edipi');
  });

  it('warns when the officer\'s resigned-from component differs from item 1.d', () => {
    expect(ids(form({ dd368PayGrade: 'O-3', dd368CurrentComponent: 'USMCR' }))).toContain('dd368-current-component-mismatch');
  });
});

describe('registration', () => {
  it('is a forms type on its own pipeline with PDF export only', () => {
    const def = DOCUMENT_TYPES.dd368;
    expect(def.features.category).toBe('forms');
    expect(def.features.pdfPipeline).toBe('dd368');
    expect(def.features.exportFormats).toEqual(['pdf']);
    expect(def.features.showParagraphs).toBe(false);
  });

  it('names the six member-side required fields for the empty state', () => {
    const names = requiredFieldStatus('dd368', {}).map((f) => f.name);
    expect(names).toEqual(['dd368MemberName', 'dd368PayGrade', 'dd368Edipi', 'dd368ServiceComponent', 'dd368CurrentUnit', 'dd368GainingComponent']);
  });

  it('accepts the sample through the schema and names the export after the member', () => {
    expect(Dd368Schema.safeParse(form()).success).toBe(true);
    expect(getExportFilename(form(), 'pdf')).toBe('DD 368 - SAMPLE MARINE A.pdf');
  });
});

describe('printed values', () => {
  it('prints 3.b for an officer and leaves it blank for an enlisted member', () => {
    const enlisted = dd368PrintedValues(form());
    expect(enlisted.dd368GainingComponent3b).toBe('');
    expect(enlisted.dd368CurrentComponent).toBe('');
    expect(enlisted.dd368GainingComponent4a).toBe('USNR');
    const officer = dd368PrintedValues(form({ dd368PayGrade: 'O-3' }));
    expect(officer.dd368GainingComponent3b).toBe('USNR');
    // 3.b's current component defaults to item 1.d.
    expect(officer.dd368CurrentComponent).toBe('USMC');
  });

  it('prints the valid-until date only with an approval', () => {
    expect(dd368PrintedValues(form({ dd368ReleaseValidUntil: '261231' })).dd368ReleaseValidUntil).toBe('');
    expect(dd368PrintedValues(form({ dd368Decision: 'approved', dd368ReleaseValidUntil: '261231' })).dd368ReleaseValidUntil).toBe('261231');
  });
});

describe('render', () => {
  it('draws two faces with the values beside their items and the remarks on the reverse', async () => {
    const bytes = await generateDd368(form({
      dd368PayGrade: 'O-3',
      dd368Decision: 'approved',
      dd368ReleaseValidUntil: '261231',
      dd368OfficialName: 'OFFICIAL, AUTHORIZING, C.',
      dd368Remarks: 'Item 5.a. Release valid through the end of the calendar year.',
    }));
    const items = await extractPdfTextLayout(new Blob([new Uint8Array(bytes)], { type: 'application/pdf' }));
    const pages = new Set(items.map((i) => i.page));
    expect(pages.size).toBe(2);
    const p1 = items.filter((i) => i.page === 1);
    const name = p1.find((i) => i.text.includes('SAMPLE, MARINE'));
    expect(name).toBeDefined();
    // Item 1.a: under its label, inside its box, left of PAY GRADE.
    expect(name!.x).toBeGreaterThan(20);
    expect(name!.x).toBeLessThan(236);
    expect(name!.y).toBeGreaterThan(666);
    expect(name!.y).toBeLessThan(695);
    const officerBlank = p1.find((i) => i.text === 'USNR' && i.y > 530 && i.y < 540);
    expect(officerBlank, '3.b requesting component on the officer line').toBeDefined();
    const validUntil = p1.find((i) => i.text === '261231');
    expect(validUntil).toBeDefined();
    expect(validUntil!.y).toBeGreaterThan(330);
    expect(validUntil!.x).toBeGreaterThan(410);
    const mark = p1.find((i) => i.text === 'X' && i.y > 330 && i.y < 342);
    expect(mark, 'the 5.a box carries an X').toBeDefined();
    const p2 = items.filter((i) => i.page === 2);
    const remark = p2.find((i) => i.text.includes('Item 5.a. Release valid'));
    expect(remark).toBeDefined();
    expect(remark!.y).toBeGreaterThan(488);
  }, 60_000);
});
