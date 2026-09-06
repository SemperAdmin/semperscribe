/**
 * R6 (USER_DRIVEN_ROADMAP) - acronym first-use checker.
 * Advisory only; the tests guard against noise as much as coverage.
 */
import { describe, it, expect } from 'vitest';
import { validateAcronyms } from '@/lib/acronym-validators';
import { militaryDictionary } from '@/lib/military-dictionary';
import type { ParagraphData } from '@/types';

function paras(...contents: string[]): ParagraphData[] {
  return contents.map((content, i) => ({ id: i + 1, level: 1, content }));
}

function ids(...contents: string[]): string[] {
  return validateAcronyms(paras(...contents)).map((i) => i.id);
}

describe('detection', () => {
  it('flags an acronym never spelled out', () => {
    expect(ids('The MCTFS record was updated.')).toContain('acronym-undefined-MCTFS');
  });

  it('accepts spell-out-then-use', () => {
    expect(ids('Marine Corps Total Force System (MCTFS) holds it. MCTFS is current.')).toEqual([]);
  });

  it('accepts a definition in an earlier paragraph', () => {
    expect(ids('Per Marine Corps Total Force System (MCTFS).', 'MCTFS shows the entry.')).toEqual([]);
  });

  it('flags each acronym only once', () => {
    expect(ids('AWOL then AWOL again and AWOL once more.')).toHaveLength(1);
  });

  it('flags use-before-definition ordering', () => {
    // Bare use comes first; the definition arrives later.
    expect(ids('The MCTFS is authoritative. Marine Corps Total Force System (MCTFS) is the source.'))
      .toContain('acronym-undefined-MCTFS');
  });
});

describe('noise control', () => {
  it('ignores stoplisted organizations and emphasis words', () => {
    expect(ids('The USMC and DOD agree. This SHALL apply to ALL hands.')).toEqual([]);
  });

  it('ignores roman numerals', () => {
    expect(ids('See Chapter III and Annex VII.')).toEqual([]);
  });

  it('ignores empty text', () => {
    expect(ids('')).toEqual([]);
    expect(validateAcronyms([])).toEqual([]);
  });

  it('is advisory only - never blocks or fails', () => {
    const issues = validateAcronyms(paras('MCTFS and AWOL and ADSW.'));
    expect(issues.length).toBeGreaterThan(0);
    expect(issues.every((i) => i.severity === 'warn')).toBe(true);
  });
});

describe('suggestions (dictionary supplied by the caller, B.5)', () => {
  it('offers the dictionary expansion when it knows exactly one', () => {
    const issue = validateAcronyms(paras('He was AWOL.'), militaryDictionary)[0];
    expect(issue.detail).toContain('ABSENT');
  });

  it('flags ambiguity when the dictionary knows several', () => {
    const issue = validateAcronyms(paras('The ADT period applies.'), militaryDictionary)[0];
    expect(issue.detail).toMatch(/readings|reads it as/);
  });

  it('still reports an unknown acronym without a suggestion', () => {
    const issues = validateAcronyms(paras('The ZZQQ system failed.'), militaryDictionary);
    expect(issues.some((i) => i.id === 'acronym-undefined-ZZQQ')).toBe(true);
  });

  it('detects the same acronyms with no dictionary, minus the suggestion', () => {
    const without = validateAcronyms(paras('He was AWOL.'));
    const withDict = validateAcronyms(paras('He was AWOL.'), militaryDictionary);
    expect(without.map((i) => i.id)).toEqual(withDict.map((i) => i.id));
    expect(without[0].detail).not.toContain('ABSENT');
    expect(without[0].detail).toContain('(AWOL)');
  });

  it('builds the expansion index once per dictionary array', () => {
    const spy: string[] = [];
    const dict = new Proxy(militaryDictionary.slice(0, 200), {
      get(target, prop, receiver) {
        if (prop === Symbol.iterator) spy.push('iterate');
        return Reflect.get(target, prop, receiver);
      },
    });
    validateAcronyms(paras('He was AWOL.'), dict);
    validateAcronyms(paras('The ADT period applies.'), dict);
    expect(spy).toEqual(['iterate']);
  });
});
