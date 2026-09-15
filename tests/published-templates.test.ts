// @vitest-environment node
/**
 * The published template library matches the code (user report
 * 2026-09-15: "the template is just filling in data").
 *
 * Browse Templates does not read src/lib/templates. It fetches .nldp
 * packages from public/templates/global, generated from the code
 * templates by scripts/generate-templates.ts. Nothing ever checked that
 * the generated files were current, and every one of them had fallen
 * behind: the Order template was rebuilt in commit d917cb6 (P3.8) and
 * its package still held the original skeleton, so what a drafter
 * actually opened was a bare list with the designators typed into the
 * content - the very thing tests/mco-template-structure.test.ts forbids
 * in the code templates it does check.
 *
 * This is the drift guard. It compares bytes, so a template edit that
 * skips the generator fails here with the command to run.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

import { PUBLISHED_TEMPLATES } from '@/lib/templates';
import { serializeTemplatePackage, indexEntry } from '@/lib/templates/publish';

const DIR = join(__dirname, '..', 'public', 'templates', 'global');
const REGENERATE = 'npx tsx scripts/generate-templates.ts';

interface IndexRow { id: string; title: string; description: string; documentType: string; url: string }

const index = JSON.parse(readFileSync(join(DIR, 'index.json'), 'utf-8')) as IndexRow[];

describe('published template packages', () => {
  const ids = Object.keys(PUBLISHED_TEMPLATES);

  it.each(ids)('%s.nldp is current with the code template', (id) => {
    const file = join(DIR, `${id}.nldp`);
    expect(existsSync(file), `${id}.nldp is missing. Run: ${REGENERATE}`).toBe(true);
    expect(
      readFileSync(file, 'utf-8'),
      `${id}.nldp is stale - the code template changed and the package was not regenerated. Run: ${REGENERATE}`,
    ).toBe(serializeTemplatePackage(id, PUBLISHED_TEMPLATES[id]));
  });

  it.each(ids)('%s has a matching index.json row', (id) => {
    const row = index.find((r) => r.id === id);
    expect(row, `no index row for ${id}. Run: ${REGENERATE}`).toBeDefined();
    expect(row).toEqual(indexEntry(id, PUBLISHED_TEMPLATES[id]));
  });

  it('every index row points at a file that exists', () => {
    for (const row of index) {
      const name = row.url.replace('/templates/global/', '');
      expect(existsSync(join(DIR, name)), `${row.id} -> ${row.url}`).toBe(true);
    }
  });

  it('ids are unique across generated and hand-authored rows', () => {
    const seen = new Set<string>();
    for (const row of index) {
      expect(seen.has(row.id), `duplicate index id: ${row.id}`).toBe(false);
      seen.add(row.id);
    }
  });
});

describe('published directive packages carry no typed designators', () => {
  /**
   * The rule tests/mco-template-structure.test.ts applies to the code
   * templates, applied to what the picker actually serves. The stale
   * Order package failed this: its paragraphs read "1. Situation.",
   * "a. Commander's Intent." at level 0 and 1, with the designator in
   * the content and no title field at all.
   */
  const DESIGNATOR = /^\s*(\d+\.|[a-z]\.|\(\d+\)|\([a-z]\))\s/;

  const directiveIds = Object.entries(PUBLISHED_TEMPLATES)
    .filter(([, t]) => t.typeId === 'mco' || t.typeId === 'bulletin')
    .map(([id]) => id);

  it.each(directiveIds)('%s generates its designators from levels', (id) => {
    const pkg = JSON.parse(readFileSync(join(DIR, `${id}.nldp`), 'utf-8'));
    const paras = pkg.data.paragraphs as { level: number; content: string }[];
    expect(paras.length, 'package has paragraphs').toBeGreaterThan(0);
    for (const p of paras) {
      if (p.level >= 1) {
        expect(DESIGNATOR.test(p.content), `"${p.content.slice(0, 48)}"`).toBe(false);
      }
    }
  });
});

describe('the Order templates', () => {
  const order = () => JSON.parse(readFileSync(join(DIR, 'marine-corps-order.nldp'), 'utf-8'));
  const guide = () => JSON.parse(readFileSync(join(DIR, 'marine-corps-order-format-guide.nldp'), 'utf-8'));

  it('both publish, and the picker offers them as separate entries', () => {
    expect(index.filter((r) => r.documentType === 'mco').map((r) => r.id))
      .toEqual(expect.arrayContaining(['marine-corps-order', 'marine-corps-order-format-guide']));
  });

  it('carry the five-paragraph order in SMEAC sequence', () => {
    for (const pkg of [order(), guide()]) {
      const titles = (pkg.data.paragraphs as { level: number; title?: string }[])
        .filter((p) => p.level === 1 && p.title)
        .map((p) => p.title!.toLowerCase());
      expect(titles).toEqual([
        'situation', 'cancellation', 'mission', 'execution',
        'administration and logistics', 'command and signal',
      ]);
    }
  });

  it('show the ladder to the fourth level, the deepest MCO 5215.1K para 33 allows', () => {
    for (const pkg of [order(), guide()]) {
      const levels = new Set((pkg.data.paragraphs as { level: number }[]).map((p) => p.level));
      expect([...levels].sort()).toEqual([1, 2, 3, 4]);
    }
  });

  it('turn on the front matter of para 48 so the anatomy is visible', () => {
    for (const pkg of [order(), guide()]) {
      expect(pkg.data.formData.showLocatorSheet).toBe(true);
      expect(pkg.data.formData.showRecordOfChanges).toBe(true);
      expect(pkg.data.formData.showStructuralPages).toBe(true);
    }
  });

  it('carry references, enclosures, reports and the admin subsections', () => {
    for (const pkg of [order(), guide()]) {
      expect(pkg.data.references.length).toBeGreaterThan(0);
      expect(pkg.data.enclosures.length).toBeGreaterThan(0);
      expect(pkg.data.formData.reports.length).toBeGreaterThan(0);
      expect(pkg.data.formData.adminSubsections.reportsRequired.show).toBe(true);
    }
  });

  it('the guide instructs and the worked order does not', () => {
    const guideSituation = guide().data.paragraphs[0].content as string;
    const orderSituation = order().data.paragraphs[0].content as string;
    // The guide addresses the drafter; the worked order addresses the
    // reader of a real directive.
    expect(guideSituation).toMatch(/^State the problem/);
    expect(orderSituation).not.toMatch(/^State /);
  });
});
