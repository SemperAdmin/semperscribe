/**
 * MCO example data integrity (user ruling 2026-06-10) + level-0
 * verbatim semantics.
 *
 * Rules: designators are GENERATED from levels, never typed into
 * content; Execution carries a. Commander's Intent / b. Concept of
 * Operations / c. Tasks (unit taskings at (1), (2)) /
 * d. Coordinating Instructions. Level 0 means a pre-formatted line:
 * rendered verbatim at the left margin, no generated designator.
 */
import { describe, it, expect, vi } from 'vitest';
import JSZip from 'jszip';

vi.mock('@/lib/pdf-fonts', () => import('./golden/pdf-fonts-mock'));

import { fixedLadderEngine } from '@/lib/indent-engine';
import { getMCOParagraphs, getAssumptionOfCommandParagraphs } from '@/lib/naval-format-utils';
import { AssumptionOfCommandTemplate, MCOTemplate, BulletinTemplate, ChangeTransmittalTemplate } from '@/lib/templates/orders';

// Change transmittals are deferred scope (Gate ruling: DLA and
// change-transmittal work out of scope); its template keeps the
// legacy embedded-designator style until that phase opens.
const orderTemplates = [AssumptionOfCommandTemplate, MCOTemplate, BulletinTemplate];
void ChangeTransmittalTemplate;
import { generateDocxBlob } from '@/lib/docx-generator';
import { FIXTURE_FORM_DATA } from './golden/fixture';

const DESIGNATOR = /^\s*(\d+\.|[a-z]\.|\(\d+\)|\([a-z]\))\s/;

describe('no embedded designators in MCO example data', () => {
  const allParagraphSets: [string, { level: number; content: string }[]][] = [
    ['getMCOParagraphs', getMCOParagraphs() as never],
    ['getAssumptionOfCommandParagraphs', getAssumptionOfCommandParagraphs() as never],
    ...orderTemplates.map((t) => [
      `template:${t.id}`,
      ((t.defaultData as { paragraphs?: { level: number; content: string }[] }).paragraphs ?? []),
    ] as [string, { level: number; content: string }[]]),
  ];

  it.each(allParagraphSets.map(([n]) => n))('%s has no designator typed into level>=1 content', (name) => {
    const paras = allParagraphSets.find(([n]) => n === name)![1];
    for (const p of paras) {
      if (p.level >= 1) {
        expect(DESIGNATOR.test(p.content), `"${p.content.slice(0, 40)}"`).toBe(false);
      }
    }
  });

  it('scaffold Execution substructure per ruling', () => {
    const titles = getMCOParagraphs().map((p) => `${p.level}:${p.title ?? ''}`);
    const ex = titles.indexOf('1:Execution');
    expect(titles.slice(ex + 1, ex + 5)).toEqual([
      "2:Commander's Intent",
      '2:Concept of Operations',
      '2:Tasks',
      '2:Coordinating Instructions',
    ]);
  });
});

describe('level-0 verbatim semantics (FixedLadderEngine)', () => {
  it('emits no citation, no spacing, margin-zero positions', () => {
    const specs = fixedLadderEngine.computeSpecs(
      [{ id: 1, level: 0, content: '1. Situation. Pre-formatted.' }] as never,
      'courier', 12,
    );
    expect(specs[0]).toMatchObject({
      citation: '', spacesAfter: 0, prefixChars: 0, firstLineTwips: 0,
    });
  });
});

describe('records-management template renders without double designators', () => {
  it('DOCX: generated designators only, full sequence correct', async () => {
    const tpl = orderTemplates.find((t) => JSON.stringify(t.defaultData).includes('Records Management'));
    expect(tpl, 'records template').toBeDefined();
    const data = tpl!.defaultData as unknown as { paragraphs: never[] };
    const blob = await generateDocxBlob(
      { ...FIXTURE_FORM_DATA, documentType: 'mco', ssic: '5210.11G', orderPrefix: 'MCO', sig: 'I. M. MARINE' } as never,
      [], [], [], [], data.paragraphs, [],
    );
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const xml = await zip.file('word/document.xml')!.async('string');
    const texts = (xml.match(/<w:p\b.*?<\/w:p>/gs) ?? []).map((p) =>
      (p.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) ?? [])
        .map((t) => t.replace(/<[^>]+>/g, '')).join('')
        .replace(/\u00A0/g, ' ')
        .replace(/&apos;/g, "'"));

    // Ruled structure with correct generated designators, including
    // siblings AFTER title-only paragraphs (the count bug regression).
    const expected: [RegExp, string][] = [
      [/^1\. {2}SITUATION\./, 'para 1'],
      [/^ {4}a\. {2}The current records/, '1a'],
      [/^ {4}b\. {2}This Order cancels/, '1b'],
      [/^2\. {2}CANCELLATION\./, 'para 2'],
      [/^3\. {2}MISSION\./, 'para 3'],
      [/^4\. {2}EXECUTION/, 'para 4'],
      [/^ {4}a\. {2}COMMANDER'S INTENT\./, '4a'],
      [/^ {4}b\. {2}CONCEPT OF OPERATIONS\./, '4b'],
      [/^ {8}\(1\) Each command/, '4b(1)'],
      [/^ {8}\(2\) Results/, '4b(2)'],
      [/^ {4}c\. {2}TASKS/, '4c'],
      [/^ {8}\(1\) CMC \(AR\)/, '4c(1)'],
      [/^ {8}\(2\) Commanding Generals/, '4c(2)'],
      [/^ {4}d\. {2}COORDINATING INSTRUCTIONS\./, '4d'],
      [/^5\. {2}ADMINISTRATION AND LOGISTICS/, 'para 5'],
      [/^ {4}a\. {2}Training requirements/, '5a'],
      [/^6\. {2}COMMAND AND SIGNAL\./, 'para 6'],
    ];
    let cursor = 0;
    for (const [re, name] of expected) {
      const found = texts.slice(cursor).findIndex((t) => re.test(t));
      expect(found, `${name} in order`).toBeGreaterThan(-1);
      cursor += found + 1;
    }

    // No doubled designators anywhere.
    for (const t of texts) {
      expect(/^\s*(\d+\.|[a-z]\.|\(\d+\)|\([a-z]\)) +(\d+\.|[a-z]\.|\(\d+\)|\([a-z]\)) /.test(t), `doubled: "${t.slice(0, 50)}"`).toBe(false);
    }
  });
});
