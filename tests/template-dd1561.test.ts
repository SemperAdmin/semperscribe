// @vitest-environment node
/**
 * The DD 1561 sample template: lands under the type, parses against the
 * schema, counts the FMR 4.4.1 Ex. 1 qualifying days worked by hand, clears
 * every export blocker, and leaves the certifying official and both
 * signatures to the people who sign (spec P4.4). No dollar figure.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { FormData } from '@/types';
import { Dd1561Schema, DOCUMENT_TYPES } from '@/lib/schemas';
import { dd1561DayCount, evaluateDd1561Eligibility, isValidEdipi } from '@/lib/dd1561-rules';
import { runDd1561Validators } from '@/lib/dd1561-validators';
import { createDd1561Defaults } from '@/types/dd1561';

const GLOBAL_DIR = join(__dirname, '..', 'public', 'templates', 'global');
type IndexEntry = { id: string; title: string; description: string; documentType?: string; url: string };
const index: IndexEntry[] = JSON.parse(readFileSync(join(GLOBAL_DIR, 'index.json'), 'utf-8'));
const ID = 'dd1561-fsa-t-sample';

function raw(): string {
  const entry = index.find((e) => e.id === ID);
  expect(entry, `${ID} is missing from index.json`).toBeDefined();
  return readFileSync(join(GLOBAL_DIR, entry!.url.replace('/templates/global/', '')), 'utf-8');
}
const load = (): FormData => JSON.parse(raw()).data.formData as FormData;

describe('DD 1561 FSA-T sample template', () => {
  it('is indexed under the registered dd1561 type and says it is sample data', () => {
    const entry = index.find((e) => e.id === ID)!;
    expect(entry.documentType).toBe('dd1561');
    expect(DOCUMENT_TYPES[entry.documentType!]).toBeDefined();
    expect(JSON.parse(raw()).metadata.package.documentType).toBe('dd1561');
    expect(entry.description).toMatch(/Sample data/);
  });

  it('parses against the schema and carries every default key', () => {
    const fd = load();
    expect(Dd1561Schema.safeParse(fd).success).toBe(true);
    expect(Object.keys(fd).sort()).toEqual(expect.arrayContaining(Object.keys(createDd1561Defaults()).sort()));
  });

  it('counts 32 qualifying days (FMR 4.4.1 Ex. 1) and appears to qualify', () => {
    const fd = load();
    const count = dd1561DayCount(fd);
    expect(count.qualifyingDays).toBe(32);
    expect(count.exceedsThirty).toBe(true);
    expect(evaluateDd1561Eligibility(fd).blockers).toEqual([]);
    expect(runDd1561Validators(fd).filter((i) => i.severity === 'block')).toEqual([]);
  });

  it('uses a sample EDIPI, no SSN, no dollar figure, and leaves Part II 15-16 for the certifier', () => {
    const fd = load() as unknown as Record<string, unknown>;
    expect(isValidEdipi(fd.dd1561Edipi)).toBe(true);
    expect(raw()).not.toMatch(/\$|\bssn\b|\d{3}-\d{2}-\d{4}/i);
    for (const k of ['dd1561CertifierName', 'dd1561CertifierTitle', 'dd1561CertifierOrganization', 'dd1561CertifiedDate', 'dd1561MemberSignedDate']) {
      expect(fd[k], k).toBe('');
    }
  });
});
