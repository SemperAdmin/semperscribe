// @vitest-environment node
/**
 * The three counseling templates: each parses against the schema, lands
 * under the counseling type, and shows the pattern policy asks for
 * (three to five well-formed targets, six areas answered, the
 * next-session date on the rule).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { CounselingSchema } from '@/lib/schemas';
import { computedNextSessionDate, counselingAreaEntries, counselingSuggestions, counselingTargets, targetIsWellFormed } from '@/lib/counseling';
import type { FormData } from '@/types';

const GLOBAL_DIR = join(__dirname, '..', 'public', 'templates', 'global');
type IndexEntry = { id: string; title: string; documentType?: string; url: string };
const index: IndexEntry[] = JSON.parse(readFileSync(join(GLOBAL_DIR, 'index.json'), 'utf-8'));
const IDS = ['counseling-initial', 'counseling-thirty-day', 'counseling-follow-on'];

function load(id: string): FormData {
  const entry = index.find((e) => e.id === id)!;
  expect(entry.documentType).toBe('counseling');
  const nldp = JSON.parse(readFileSync(join(GLOBAL_DIR, entry.url.replace('/templates/global/', '')), 'utf-8'));
  return nldp.data.formData as FormData;
}

describe('counseling templates', () => {
  it.each(IDS)('%s parses, answers all six areas and sets three to five well-formed targets', (id) => {
    const fd = load(id);
    expect(CounselingSchema.safeParse(fd).success).toBe(true);
    expect(counselingAreaEntries(fd).every((a) => a.status !== '')).toBe(true);
    const targets = counselingTargets(fd);
    expect(targets.length).toBeGreaterThanOrEqual(3);
    expect(targets.length).toBeLessThanOrEqual(5);
    expect(targets.every(targetIsWellFormed)).toBe(true);
    expect(fd.counselingNextSessionDate).toBe(computedNextSessionDate(fd));
  });

  it('leaves only the handling note open on the initial and follow-on samples', () => {
    for (const id of ['counseling-initial', 'counseling-follow-on']) {
      const open = counselingSuggestions(load(id)).map((s) => s.id).filter((x) => x !== 'handling');
      expect(open, id).toEqual([]);
    }
  });

  it('carries a missed target forward on the follow-on sample', () => {
    const fd = load('counseling-follow-on');
    expect((fd.counselingPriorTargets as { status: string }[]).some((t) => t.status === 'not-met')).toBe(true);
    expect(counselingSuggestions(fd).map((s) => s.id)).not.toContain('target-not-met-1');
  });
});
