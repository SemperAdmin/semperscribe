import { describe, it, expect } from 'vitest';
import { stripCitationPrefix, stripCitationPrefixes } from '@/lib/citation-prefix';

describe('stripCitationPrefix: strips', () => {
  const cases: [string, string][] = [
    ['(a) MCO 1553.3B', 'MCO 1553.3B'],
    ['(aa) MCO 1553.3B', 'MCO 1553.3B'],
    ['(1) Unit SOP', 'Unit SOP'],
    ['(12) Unit SOP', 'Unit SOP'],
    ['a. MCO 1553.3B', 'MCO 1553.3B'],
    ['1. Unit SOP', 'Unit SOP'],
    ['Ref (a) MCO 1553.3B', 'MCO 1553.3B'],
    ['Ref: (a) MCO 1553.3B', 'MCO 1553.3B'],
    ['Reference (a) MCO 1553.3B', 'MCO 1553.3B'],
    ['Encl (1) Unit SOP', 'Unit SOP'],
    ['Encl: (1) Unit SOP', 'Unit SOP'],
    ['Enclosure (1) – Unit SOP', 'Unit SOP'],
    ['Enclosure (1) - Unit SOP', 'Unit SOP'],
    ['Tab (A) Decision Brief', 'Decision Brief'],
    ['  (a)   MCO 1553.3B', 'MCO 1553.3B'],
    ['(a): MCO 1553.3B', 'MCO 1553.3B'],
    ['(a) (b) MCO X', '(b) MCO X'],
  ];
  it.each(cases)('%j -> %j', (input, expected) => {
    expect(stripCitationPrefix(input)).toBe(expected);
  });
});

describe('stripCitationPrefix: keeps', () => {
  const keep = [
    'MCO 1553.3B',
    'U.S. Navy Regulations, 1990',
    'A. Smith ltr of 3 Jan 26',
    '(U) MCO 1553.3B',
    '(CUI) Unit SOP',
    '(S) Plan',
    '(TS) Plan',
    'no. 5 of the series',
    '1553.3B',
    '1990. Report',
    'Ref MCO 1553.3B',
    'Reference Guide for Marines',
    'Table (1) shows',
    '',
  ];
  it.each(keep)('%j unchanged', (input) => {
    expect(stripCitationPrefix(input)).toBe(input);
  });

  it('maps lists', () => {
    expect(stripCitationPrefixes(['(a) X', 'Y'])).toEqual(['X', 'Y']);
  });
});
