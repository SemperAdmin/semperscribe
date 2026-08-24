import { describe, expect, it } from 'vitest';
import {
  NAVMC_10132_ARTICLES,
  NAVMC_10132_ARTICLE_GROUPS,
  resolveArticle,
} from '@/lib/navmc10132-articles';
import map from '../tools/aa-forms/navmc10132-map.json';

/**
 * Map-diff guard plus the two routing rules that are not derivable from the
 * strings. Rule source: docs/NAVMC_10132_SPEC.md sections 11.1 and 11.2.
 *
 * The map-diff test is the one that matters most over time: sja.marines.mil
 * re-posted the same 08-2023 revision under a 2025-03 filename, so a filename
 * or a date proves nothing about whether the form moved. If the blank is ever
 * replaced and the dropdown changes, this fails instead of the emitter writing
 * an invalid export value in production.
 */

const articleField = (map as any).fields.find((f: any) => f.name === '1A ARTICLE');
const formExportValues: string[] = articleField.exportValues.filter(
  (o: string) => o.trim() !== ''
);

describe('NAVMC 10132 article crosswalk', () => {
  it('covers exactly the form dropdown, byte-exact', () => {
    expect(NAVMC_10132_ARTICLES.map((a) => a.formLabel)).toEqual(formExportValues);
  });

  it('has 167 selectable offenses across 89 base articles', () => {
    expect(NAVMC_10132_ARTICLES).toHaveLength(167);
    expect(NAVMC_10132_ARTICLE_GROUPS).toHaveLength(89);
  });

  it('resolves every form label to exactly one code', () => {
    for (const label of formExportValues) {
      const row = resolveArticle(label);
      expect(row, label).toBeDefined();
      expect(row!.mctfsCode).toBeTruthy();
    }
  });

  it('has no duplicate form labels', () => {
    expect(new Set(NAVMC_10132_ARTICLES.map((a) => a.formLabel)).size).toBe(167);
  });

  it('routes both Article 92 sexual harassment labels to 92.1', () => {
    const harassment = NAVMC_10132_ARTICLES.filter((a) => a.mctfsCode === '92.1');
    expect(harassment.map((a) => a.formLabel)).toEqual([
      'Art. 92  Viol. MCO 5354.1 (series) (Sexual Harassment)',
      'Art. 92  Viol. USNR 1166 (Sexual Harassment)',
    ]);
  });

  it('routes every other Article 92 label to 92', () => {
    const art92 = NAVMC_10132_ARTICLES.filter((a) => a.articleNumber === '92');
    expect(art92).toHaveLength(22);
    expect(art92.filter((a) => a.mctfsCode === '92')).toHaveLength(20);
  });

  it('routes Article 134 sexual harassment to 134.110', () => {
    expect(resolveArticle('Art. 134  Sexual harassment')!.mctfsCode).toBe('134.110');
  });

  it('collapses the four General Article labels to 134.91', () => {
    expect(
      NAVMC_10132_ARTICLES.filter((a) => a.mctfsCode === '134.91').map((a) => a.formLabel)
    ).toEqual([
      'Art. 134  General Article',
      'Art. 134  General Article Clause 1',
      'Art. 134  General Article Clause 2',
      'Art. 134  General Article Clause 3',
    ]);
  });

  it('collapses the four drunk and disorderly labels to 134.98', () => {
    expect(NAVMC_10132_ARTICLES.filter((a) => a.mctfsCode === '134.98')).toHaveLength(4);
  });

  it('flags the offenses that are ordinarily not minor', () => {
    const flagged = new Set(
      NAVMC_10132_ARTICLES.filter((a) => a.notOrdinarilyMinor).map((a) => a.articleNumber)
    );
    expect([...flagged].sort()).toEqual(
      ['103A', '103B', '118', '119', '120', '120B', '122', '125', '126', '128A', '94', '99'].sort()
    );
  });

  it('returns undefined for an unknown label rather than guessing', () => {
    expect(resolveArticle('Art. 999  Not a real offense')).toBeUndefined();
    expect(resolveArticle('Art. 86 Absence without leave')).toBeUndefined(); // single space
  });
});
