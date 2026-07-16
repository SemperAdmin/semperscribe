/**
 * P2 (DONDOCS_PARITY_PLAN) - classification marking engine.
 */
import { describe, it, expect } from 'vitest';
import {
  DEFAULT_CLASSIFICATION,
  levelRank,
  portionPrefix,
  bannerText,
  needsCuiBlock,
  cuiBlockLines,
  getClassification,
  paragraphLevel,
  validateClassification,
  ClassificationConfig,
} from '@/lib/classification';
import type { ParagraphData, FormData } from '@/types';

function config(overrides: Partial<ClassificationConfig> = {}): ClassificationConfig {
  return {
    ...DEFAULT_CLASSIFICATION,
    enabled: true,
    ...overrides,
    cui: { ...DEFAULT_CLASSIFICATION.cui, ...(overrides.cui ?? {}) },
  };
}

function form(classification: ClassificationConfig): FormData {
  return { documentType: 'basic', classification };
}

function para(id: number, content: string, marking?: string): ParagraphData {
  return { id, level: 1, content, marking };
}

describe('levels and prefixes', () => {
  it('ranks the standard ladder', () => {
    expect(levelRank('UNCLASSIFIED')).toBeLessThan(levelRank('CUI'));
    expect(levelRank('CUI')).toBeLessThan(levelRank('CONFIDENTIAL'));
    expect(levelRank('CONFIDENTIAL')).toBeLessThan(levelRank('SECRET'));
    expect(levelRank('SECRET')).toBeLessThan(levelRank('TOP SECRET'));
  });

  it('ranks unknown custom levels above TOP SECRET', () => {
    expect(levelRank('EXERCISE ONLY')).toBeGreaterThan(levelRank('TOP SECRET'));
  });

  it('derives portion prefixes', () => {
    expect(portionPrefix('UNCLASSIFIED')).toBe('(U)');
    expect(portionPrefix('CUI')).toBe('(CUI)');
    expect(portionPrefix('SECRET')).toBe('(S)');
    expect(portionPrefix('TOP SECRET')).toBe('(TS)');
    expect(portionPrefix('exercise only')).toBe('(EO)');
  });

  it('normalizes banner text', () => {
    expect(bannerText(config({ level: 'cui' }))).toBe('CUI');
    expect(bannerText(config({ level: '' }))).toBe('UNCLASSIFIED');
  });
});

describe('CUI designation block', () => {
  it('requires the block only for CUI', () => {
    expect(needsCuiBlock(config({ level: 'CUI' }))).toBe(true);
    expect(needsCuiBlock(config({ level: 'UNCLASSIFIED' }))).toBe(false);
    expect(needsCuiBlock({ ...config({ level: 'CUI' }), enabled: false })).toBe(false);
  });

  it('renders one Controlled-by line per input line', () => {
    const lines = cuiBlockLines(config({
      level: 'CUI',
      cui: { controlledBy: 'Department of the Navy\nHQMC ARD', categories: 'PRVCY', distribution: 'FEDCON', poc: 'GySgt Smith' },
    }));
    expect(lines).toEqual([
      'Controlled by: Department of the Navy',
      'Controlled by: HQMC ARD',
      'CUI Category: PRVCY',
      'Distribution/Dissemination Control: FEDCON',
      'POC: GySgt Smith',
    ]);
  });
});

describe('validation (P2.4 - the check DonDocs lacks)', () => {
  it('returns nothing when marking is off', () => {
    expect(validateClassification({ documentType: 'basic' }, [para(1, 'text')])).toEqual([]);
  });

  it('fails an incomplete CUI block', () => {
    const issues = validateClassification(form(config({ level: 'CUI' })), [para(1, 'text')]);
    expect(issues.some((i) => i.id === 'cui-block-incomplete' && i.severity === 'fail')).toBe(true);
  });

  it('passes a complete CUI block', () => {
    const c = config({
      level: 'CUI',
      cui: { controlledBy: 'HQMC', categories: 'PRVCY', distribution: 'FEDCON', poc: 'Smith' },
    });
    const issues = validateClassification(form(c), [para(1, 'text')]);
    expect(issues.find((i) => i.id === 'cui-block-incomplete')).toBeUndefined();
  });

  it('fails when a portion exceeds the banner', () => {
    const c = config({ level: 'CUI', portionMarking: true });
    const issues = validateClassification(form(c), [para(1, 'text', 'SECRET')]);
    expect(issues.some((i) => i.id === 'portion-exceeds-banner' && i.severity === 'fail')).toBe(true);
  });

  it('accepts portions at or below the banner', () => {
    const c = config({
      level: 'CUI',
      portionMarking: true,
      cui: { controlledBy: 'HQMC', categories: 'PRVCY', distribution: 'FEDCON', poc: 'Smith' },
    });
    const issues = validateClassification(form(c), [para(1, 'a', 'UNCLASSIFIED'), para(2, 'b', 'CUI')]);
    expect(issues.find((i) => i.id === 'portion-exceeds-banner')).toBeUndefined();
  });

  it('warns on unmarked paragraphs when portion marking is on', () => {
    const c = config({ level: 'UNCLASSIFIED', portionMarking: true });
    const issues = validateClassification(form(c), [para(1, 'text')]);
    expect(issues.some((i) => i.id === 'portion-markings-missing' && i.severity === 'warn')).toBe(true);
  });

  it('warns on training levels above CUI', () => {
    const issues = validateClassification(form(config({ level: 'SECRET', customLevels: true })), []);
    expect(issues.some((i) => i.id === 'training-level-warning')).toBe(true);
  });

  it('unmarked paragraphs inherit the banner for the exceeds check', () => {
    const c = config({ level: 'UNCLASSIFIED', portionMarking: true });
    const p = para(1, 'text');
    expect(paragraphLevel(p, c)).toBe('UNCLASSIFIED');
    const issues = validateClassification(form(c), [p]);
    expect(issues.find((i) => i.id === 'portion-exceeds-banner')).toBeUndefined();
  });
});

describe('getClassification', () => {
  it('defaults to off for untouched forms', () => {
    expect(getClassification({ documentType: 'basic' })).toEqual(DEFAULT_CLASSIFICATION);
  });

  it('merges partial configs without losing CUI fields', () => {
    const merged = getClassification({
      documentType: 'basic',
      classification: { enabled: true, level: 'CUI', cui: { controlledBy: 'HQMC' } },
    });
    expect(merged.enabled).toBe(true);
    expect(merged.cui.controlledBy).toBe('HQMC');
    expect(merged.cui.poc).toBe('');
    expect(merged.portionMarking).toBe(false);
  });
});
