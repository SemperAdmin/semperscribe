// @vitest-environment node
/**
 * Every DD 1561 template in the global index: loads under the type, clears
 * eligibility and every export blocker, exports to the official blank, and
 * shows the facts its description claims. Certifier blocks 15a-c, 16 and 9a
 * stay empty; no SSN shape appears anywhere (spec P4.4).
 */
import { describe, it, expect, vi } from 'vitest';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { PDFDocument } from 'pdf-lib';
import type { FormData } from '@/types';
import { Dd1561Schema } from '@/lib/schemas';
import { DD1561_FIELDS as F, DD1561_FSA_R as R } from '@/lib/dd1561-fields';
import {
  dd1561CheckBoxes,
  dd1561DayCount,
  dd1561FieldValues,
  evaluateDd1561Eligibility,
  isValidEdipi,
} from '@/lib/dd1561-rules';
import { runDd1561Validators } from '@/lib/dd1561-validators';
import { exportDd1561FormWithReport } from '@/lib/dd1561-export';

const loadAssetBytes = vi.hoisted(() => vi.fn());
vi.mock('@/lib/assets', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/assets')>()),
  loadAssetBytes,
}));
loadAssetBytes.mockImplementation(async (p: string) => new Uint8Array(readFileSync(resolve(__dirname, '../public', p))));

const GLOBAL_DIR = join(__dirname, '..', 'public', 'templates', 'global');
type IndexEntry = { id: string; title: string; description: string; documentType?: string; url: string };
const index: IndexEntry[] = JSON.parse(readFileSync(join(GLOBAL_DIR, 'index.json'), 'utf-8'));
const entries = index.filter((e) => e.documentType === 'dd1561');

const rawOf = (e: IndexEntry) => readFileSync(join(GLOBAL_DIR, e.url.replace('/templates/global/', '')), 'utf-8');
const dataOf = (id: string): FormData => {
  const e = entries.find((x) => x.id === id);
  expect(e, id).toBeDefined();
  return JSON.parse(rawOf(e!)).data.formData as FormData;
};
/** Optional: set DD1561_PDF_DIR to write each template's export for a visual check. */
const PDF_DIR = process.env.DD1561_PDF_DIR;

const SSN = /\b\d{3}-\d{2}-\d{4}\b|\b\d{3} \d{2} \d{4}\b|\bssn\b|social security/i;
const CERTIFIER_AND_9A = ['dd1561CertifierName', 'dd1561CertifierTitle', 'dd1561CertifierOrganization', 'dd1561CertifiedDate', 'dd1561MemberSignedDate'];
const TYPE_BOX: Record<string, string> = { T: F.typeFsaT, R: F.typeFsaR, S: F.typeFsaS };

describe('DD 1561 templates in the global index', () => {
  it('finds the seven situations', () => {
    expect(entries.map((e) => e.id).sort()).toEqual([
      'dd1561-fsa-r-okinawa-unaccompanied',
      'dd1561-fsa-s-arg-meu-deployment',
      'dd1561-fsa-t-back-to-back',
      'dd1561-fsa-t-dependent-parent',
      'dd1561-fsa-t-dual-military',
      'dd1561-fsa-t-mobilized-reservist',
      'dd1561-fsa-t-sample',
    ]);
  });

  describe.each(entries.map((e) => [e.id, e] as const))('%s', (_id, entry) => {
    const pkg = JSON.parse(rawOf(entry));
    const fd = pkg.data.formData as FormData;
    const rec = fd as unknown as Record<string, unknown>;

    it('loads under the dd1561 type with a titled, sample-data description', () => {
      expect(pkg.metadata.package.documentType).toBe('dd1561');
      expect(pkg.metadata.package.title).toBe(entry.title);
      expect(entry.title).toMatch(/^DD 1561 - /);
      expect(entry.description).toBe(pkg.metadata.package.description);
      expect(entry.description).toMatch(/DoD FMR Vol 7A Ch 27 par/);
      expect(entry.description).toMatch(/Sample data - replace before use\.$/);
      expect(Dd1561Schema.safeParse(fd).success).toBe(true);
    });

    it('is eligible and has no export blockers', () => {
      expect(evaluateDd1561Eligibility(fd).eligible).toBe(true);
      expect(runDd1561Validators(fd).filter((i) => i.severity === 'block')).toEqual([]);
    });

    it('uses a sample EDIPI, no SSN shape, no dollar figure, and leaves 15a-c, 16 and 9a empty', () => {
      expect(isValidEdipi(rec.dd1561Edipi)).toBe(true);
      expect(String(rec.dd1561Edipi)).toBe('1234567890');
      if (rec.dd1561DualMilitary === true) expect(isValidEdipi(rec.dd1561SpouseEdipi)).toBe(true);
      expect(rawOf(entry)).not.toMatch(SSN);
      expect(rawOf(entry)).not.toMatch(/\$/);
      for (const k of CERTIFIER_AND_9A) expect(rec[k], k).toBe('');
    });

    it('exports to the official blank with the right pages and type box', async () => {
      const { blob, continuationPages } = await exportDd1561FormWithReport(fd);
      const bytes = new Uint8Array(await blob.arrayBuffer());
      const rows = ((rec.dd1561FsaTRows as unknown[]) ?? []).length;
      const type = String(rec.dd1561FsaType);
      const expectedPages = type === 'T' && rows > 3 ? 2 : 1;
      const pdf = await PDFDocument.load(bytes);
      expect(pdf.getPageCount()).toBe(expectedPages);
      expect(continuationPages).toBe(expectedPages - 1);
      const form = pdf.getForm();
      for (const [t, name] of Object.entries(TYPE_BOX)) expect(form.getCheckBox(name).isChecked(), name).toBe(t === type);
      expect(form.getTextField(F.dodId).getText()).toBe('1234567890');
      for (const name of [F.certifierName, F.certifierTitle, F.certifierOrganization, F.certifiedDate, F.memberSignedDate]) {
        expect(form.getTextField(name).getText() ?? '', name).toBe('');
      }
      const printed = [...form.getFields()].map((f) => (f.constructor.name === 'PDFTextField' ? form.getTextField(f.getName()).getText() ?? '' : '')).join('\n');
      expect(printed).not.toMatch(SSN);
      if (PDF_DIR) {
        mkdirSync(PDF_DIR, { recursive: true });
        writeFileSync(join(PDF_DIR, `${entry.id}.pdf`), bytes);
      }
    });
  });
});

describe('DD 1561 situation facts', () => {
  it('FSA-R Okinawa: dependents not authorized, start date 15 Jun 26 from leave and proceed time (Table 27-1 rule 2)', () => {
    const fd = dataOf('dd1561-fsa-r-okinawa-unaccompanied');
    expect(fd.dd1561FsaRTransportAuthorized).toBe(false);
    expect(fd.dd1561FsaRElectedUnaccompanied).toBe(false);
    const r = dd1561DayCount(fd).fsaR!;
    expect(r.leaveDays).toBe(10);
    expect(r.proceedDays).toBe(4);
    expect(r.startDate).toBe('2026-06-15');
    const v = dd1561FieldValues(fd);
    expect(v[R.departedDate]).toBe('010626');
    expect(v[R.leaveDates]).toBe('020626 - 110626');
    expect(v[R.proceedDates]).toBe('120626 - 150626');
    expect(v[R.reportedDate]).toBe('170626');
    expect(String(v[R.reportedTo])).toMatch(/OKINAWA/);
    // 8g is for FSA-T/S only and Part II prints block 11 only.
    expect(dd1561CheckBoxes(fd).cert8g).toBe(false);
    expect(v[F.fsaSShipUnit]).toBe('');
  });

  it('FSA-S ARG/MEU: completed deployment, 80 days, commencing 2 Mar 26, qualifying from 1 Apr 26 (FMR 4.4.3)', () => {
    const fd = dataOf('dd1561-fsa-s-arg-meu-deployment');
    const c = dd1561DayCount(fd);
    expect(c.openEnded).toBe(false);
    expect(c.qualifyingDays).toBe(80);
    expect(c.periods[0].qualifiedOn).toBe('2026-04-01');
    const v = dd1561FieldValues(fd);
    expect(v[F.fsaSCommencingDate]).toBe('020326');
    expect(String(v[F.fsaSShipUnit])).toMatch(/MEU/);
    expect(v[F.fsaSHomeport]).toBeTruthy();
    expect(dd1561CheckBoxes(fd).cert8gLastTdyWasNot).toBe(true);
  });

  it('FSA-T back-to-back: 8g was, 45-day prior TDY, 27-day interim, 44-day redeployment continues for 71 days (FMR 4.4.2)', () => {
    const fd = dataOf('dd1561-fsa-t-back-to-back');
    const b = dd1561CheckBoxes(fd);
    expect(b.cert8gLastTdyWas).toBe(true);
    expect(b.cert8gLastTdyWasNot).toBe(false);
    const r = dd1561DayCount(fd).redeployment!;
    expect(r.priorDays).toBe(45);
    expect(r.interimDays).toBe(27);
    expect(r.redeploymentDays).toBe(44);
    expect(r.sameKind).toBe(true);
    expect(r.continues).toBe(true);
    expect(r.creditedDays).toBe(71);
    expect(evaluateDd1561Eligibility(fd).warnings.map((w) => w.code)).toContain('redeployment-continues');
  });

  it('dual-military couple: 8a and 8f checked, was residing together, no other dependents, spouse not drawing FSA (FMR 2.3.4.1)', () => {
    const fd = dataOf('dd1561-fsa-t-dual-military');
    const e = evaluateDd1561Eligibility(fd);
    expect(e.basis).toMatchObject({ dualMilitaryCouple: true, spouse: false, children: false, parent: false });
    expect(fd.dd1561SpouseReceivingFsa).toBe(false);
    const b = dd1561CheckBoxes(fd);
    expect(b.cert8f).toBe(true);
    expect(b.cert8fSpouseWas).toBe(true);
    expect(b.cert8fSpouseWasNot).toBe(false);
    expect(b.cert8b).toBe(false);
    expect(b.cert8c).toBe(false);
    const v = dd1561FieldValues(fd);
    expect(v[F.spouseDodId]).toBe('2345678901');
    expect(v[F.spouseBranchComponent]).toBe('USN ACTIVE');
    expect(dd1561DayCount(fd).qualifyingDays).toBe(45);
  });

  it('mobilized reservist: block 6 prints 020226 and only this template prints it (FMR 2.3.1.3 NOTE)', () => {
    const fd = dataOf('dd1561-fsa-t-mobilized-reservist');
    expect(fd.dd1561Mobilized).toBe(true);
    expect(dd1561FieldValues(fd)[F.mobilizedDepartureDate]).toBe('020226');
    expect(dd1561DayCount(fd).qualifyingDays).toBe(96);
    expect(evaluateDd1561Eligibility(fd).warnings.map((w) => w.code)).toContain('reserve-component-pds');
    for (const e of entries.filter((x) => x.id !== 'dd1561-fsa-t-mobilized-reservist')) {
      const other = dataOf(e.id);
      expect(other.dd1561Mobilized, e.id).toBe(false);
      expect(dd1561FieldValues(other)[F.mobilizedDepartureDate], e.id).toBe('');
    }
  });

  it('dependent parent: 8e and 8c checked, single member, no 8a, parent basis only (FMR 3.1.4)', () => {
    const fd = dataOf('dd1561-fsa-t-dependent-parent');
    const b = dd1561CheckBoxes(fd);
    expect(b.cert8e).toBe(true);
    expect(b.cert8c).toBe(true);
    expect(b.cert8a).toBe(false);
    expect(b.cert8b).toBe(false);
    expect(evaluateDd1561Eligibility(fd).basis).toMatchObject({ parent: true, spouse: false, children: false });
    expect(dd1561DayCount(fd).qualifyingDays).toBe(68);
    for (const e of entries.filter((x) => x.id !== 'dd1561-fsa-t-dependent-parent')) {
      expect(dd1561CheckBoxes(dataOf(e.id)).cert8e, e.id).toBe(false);
    }
  });
});
