/**
 * Autosuggest presentation rules: natural casing and acronym filtering.
 *
 * These exist because the generated military dictionary renders every
 * term in ALL CAPS, which is a convention of the source document rather
 * than a format requirement of the drafted correspondence.
 */
import { describe, it, expect } from 'vitest';
import { toNaturalCase, isAcronymEntry, findSuggestions } from '@/lib/dictionary-display';
import type { DictionaryEntry } from '@/lib/military-dictionary';

const e = (term: string, meaning: string): DictionaryEntry => ({ term, meaning });

describe('toNaturalCase', () => {
  it('title-cases ordinary words and phrases', () => {
    expect(toNaturalCase('ACCOMMODATE')).toBe('Accommodate');
    expect(toNaturalCase('ADMINISTRATIVE COMMAND')).toBe('Administrative Command');
    expect(toNaturalCase('ADVANCED COMMUNICATION OFFICERS COURSE')).toBe(
      'Advanced Communication Officers Course',
    );
  });

  it('lowercases minor words mid-phrase but not at either end', () => {
    expect(toNaturalCase('ASSISTANT COMMANDANT OF THE MARINE CORPS')).toBe(
      'Assistant Commandant of the Marine Corps',
    );
    // A minor word in the first or last slot keeps its capital.
    expect(toNaturalCase('THE COMMANDING OFFICER')).toBe('The Commanding Officer');
  });

  it('capitalizes every segment across slashes and hyphens', () => {
    // Regression: the minor-word rule must not reach inside a slashed
    // compound, or "WITHOUT/OVER" renders "Without/over".
    expect(toNaturalCase('ABSENT/ABSENCE WITHOUT/OVER LEAVE/LIBERTY')).toBe(
      'Absent/Absence Without/Over Leave/Liberty',
    );
    expect(toNaturalCase('ACADEMIC-ACADEMY')).toBe('Academic-Academy');
    expect(toNaturalCase('(1) ADMINISTRATION/LEGAL SERVICES SCHOOL')).toBe(
      '(1) Administration/Legal Services School',
    );
  });

  it('preserves genuine acronyms, initialisms, and designators', () => {
    expect(toNaturalCase('NATO DEFENSE COLLEGE')).toBe('NATO Defense College');
    expect(toNaturalCase('SPECIAL PURPOSE MAGTF')).toBe('Special Purpose MAGTF');
    expect(toNaturalCase('AIR TRAFFIC CONTROL CLASS A-1')).toBe('Air Traffic Control Class A-1');
    expect(toNaturalCase('TOUR OPTIMIZATION FOR UNIFORM READINESS II MODEL')).toBe(
      'Tour Optimization for Uniform Readiness II Model',
    );
  });

  it('keeps a short parenthesised acronym but not a shouted word', () => {
    expect(toNaturalCase('ACTIVE RESERVE (AR) PROGRAM')).toBe('Active Reserve (AR) Program');
    expect(toNaturalCase('AMPHIBIOUS ASSAULT SHIP (MULTIPURPOSE)')).toBe(
      'Amphibious Assault Ship (Multipurpose)',
    );
  });

  it('lowercases leading-hyphen suffix fragments', () => {
    // "ACCORD -INC -ANCE -INGLY" lists word endings, not words.
    expect(toNaturalCase('ACCORD -INC -ANCE -INGLY')).toBe('Accord -inc -ance -ingly');
  });

  it('leaves an empty or whitespace-only term alone', () => {
    expect(toNaturalCase('')).toBe('');
    expect(toNaturalCase('   ')).toBe('   ');
  });
});

describe('isAcronymEntry', () => {
  it('flags a single-token term whose meaning is a prose expansion', () => {
    expect(isAcronymEntry(e('ALCOM', 'All commands.'))).toBe(true);
    expect(isAcronymEntry(e('ARREPCOVES', 'Upon arrival report to the commanding officer.'))).toBe(true);
  });

  it('keeps a word entry whose meaning is an abbreviation', () => {
    expect(isAcronymEntry(e('ACCOMMODATE', 'accom'))).toBe(false);
    expect(isAcronymEntry(e('ADMINISTRATIVE COMMAND', 'ADCOM'))).toBe(false);
    expect(isAcronymEntry(e('ALLIED COMMUNICATIONS PUBLICATION', 'ACP'))).toBe(false);
  });

  it('keeps a multi-word term even when its meaning has a space', () => {
    // Measured: 10 real entries look like this, e.g. "JOINT CHIEF OF
    // STAFF PUBLICATION" -> "JCS pub". The term is a phrase, not an acronym.
    expect(isAcronymEntry(e('JOINT CHIEF OF STAFF PUBLICATION', 'JCS pub'))).toBe(false);
    expect(isAcronymEntry(e('SELECTED MARINE CORPS RESERVE, GROUND', 'SMCR (G)'))).toBe(false);
  });

  it('keeps a word entry marked with the alternative-abbreviation asterisk', () => {
    // "COMMERCIAL" -> "*Mer or coml" is the one word entry whose meaning
    // contains a space. Without the asterisk carve-out it is misread as
    // an acronym and vanishes from the dropdown.
    expect(isAcronymEntry(e('COMMERCIAL', '*Mer or coml'))).toBe(false);
  });
});

describe('findSuggestions', () => {
  const dict: DictionaryEntry[] = [
    e('ACCOMMODATE', 'accom'),
    e('ADMINISTRATIVE COMMAND', 'ADCOM'),
    e('ADVANCED COMMUNICATION OFFICERS COURSE', 'ACDC'),
    e('ALCOM', 'All commands.'),
    e('ALLIED COMMUNICATIONS PUBLICATION', 'ACP'),
    e('ARREPCOVES', 'Upon arrival report to the commanding officer of that vessel for duty.'),
  ];

  it('returns natural-cased phrases and drops acronym entries', () => {
    // This is the exact "comm" query from the reported From-line bug.
    expect(findSuggestions(dict, 'comm')).toEqual([
      'Accommodate',
      'Administrative Command',
      'Advanced Communication Officers Course',
      'Allied Communications Publication',
    ]);
  });

  it('preserves ALL CAPS when asked, and still drops acronyms', () => {
    expect(findSuggestions(dict, 'comm', { preserveCase: true })).toEqual([
      'ACCOMMODATE',
      'ADMINISTRATIVE COMMAND',
      'ADVANCED COMMUNICATION OFFICERS COURSE',
      'ALLIED COMMUNICATIONS PUBLICATION',
    ]);
  });

  it('stays silent below the two-character threshold', () => {
    expect(findSuggestions(dict, 'a')).toEqual([]);
    expect(findSuggestions(dict, ' ')).toEqual([]);
  });

  it('honors the limit', () => {
    expect(findSuggestions(dict, 'comm', { limit: 2 })).toHaveLength(2);
  });

  it('matches on the abbreviation as well as the term', () => {
    expect(findSuggestions(dict, 'adcom')).toEqual(['Administrative Command']);
  });

  it('deduplicates labels that collapse to the same casing', () => {
    const dupes = [e('COMMAND', 'cmd'), e('Command', 'cmd2')];
    expect(findSuggestions(dupes, 'comm')).toEqual(['Command']);
  });
});
