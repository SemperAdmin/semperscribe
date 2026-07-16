/**
 * P3.1 (DONDOCS_PARITY_PLAN) - find and replace over document fields.
 */
import { describe, it, expect } from 'vitest';
import { countMatches, totalMatches, replaceAll, DEFAULT_SCOPE, FindReplaceInput, FindReplaceOptions } from '@/lib/find-replace';

function input(): FindReplaceInput {
  return {
    formData: { documentType: 'basic', subj: 'HAPPY DAY REQUEST', from: 'Happy Officer', to: 'Commander' },
    paragraphs: [
      { id: 1, level: 1, content: 'We are happy to report a happy outcome.' },
      { id: 2, level: 2, content: 'Nothing here.' },
    ],
    vias: ['Happy Battalion'],
    references: ['(a) HAPPY MANUAL 1.0'],
    enclosures: ['Happy Enclosure'],
    copyTos: [''],
  };
}

function options(overrides: Partial<FindReplaceOptions> = {}): FindReplaceOptions {
  return { find: 'happy', replace: 'glad', caseSensitive: false, scope: { ...DEFAULT_SCOPE }, ...overrides };
}

describe('countMatches', () => {
  it('counts case-insensitively across all scopes', () => {
    expect(totalMatches(input(), options())).toBe(7);
  });

  it('respects case sensitivity', () => {
    // Lowercase 'happy' appears exactly twice, both in paragraph one.
    // (Original expectation of 3 was a test-authoring error caught by
    // the first local run - the implementation was correct.)
    expect(totalMatches(input(), options({ caseSensitive: true }))).toBe(2);
  });

  it('respects scope exclusions', () => {
    const opts = options();
    opts.scope = { ...DEFAULT_SCOPE, body: false, addresses: false };
    expect(totalMatches(input(), opts)).toBe(3);
  });

  it('escapes regex metacharacters in the needle', () => {
    const data = input();
    data.paragraphs[0].content = 'Cost is $5 (approx).';
    expect(totalMatches(data, options({ find: '(approx)' }))).toBe(1);
  });

  it('returns zero for an empty needle', () => {
    expect(totalMatches(input(), options({ find: '' }))).toBe(0);
  });
});

describe('replaceAll', () => {
  it('replaces across every scoped field and reports the count', () => {
    const result = replaceAll(input(), options());
    expect(result.replaced).toBe(7);
    expect(result.formData.subj).toBe('glad DAY REQUEST');
    expect(result.formData.from).toBe('glad Officer');
    expect(result.paragraphs[0].content).toBe('We are glad to report a glad outcome.');
    expect(result.vias[0]).toBe('glad Battalion');
    expect(result.references[0]).toBe('(a) glad MANUAL 1.0');
    expect(result.enclosures[0]).toBe('glad Enclosure');
  });

  it('leaves out-of-scope slices untouched by identity', () => {
    const data = input();
    const opts = options();
    opts.scope = { ...DEFAULT_SCOPE, body: false };
    const result = replaceAll(data, opts);
    expect(result.paragraphs).toBe(data.paragraphs);
    expect(result.paragraphs[0].content).toContain('happy');
  });

  it('preserves paragraph metadata through replacement', () => {
    const data = input();
    data.paragraphs[0].marking = 'CUI';
    const result = replaceAll(data, options());
    expect(result.paragraphs[0].marking).toBe('CUI');
    expect(result.paragraphs[0].id).toBe(1);
    expect(result.paragraphs[0].level).toBe(1);
  });
});
