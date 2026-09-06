/**
 * templateMatches: the pure filter behind useTemplates (Phase A.5).
 * D.7 turns the document-type filter into a control the user sees, so
 * the caller passes a type only while the filter is on and the counts
 * the dialog prints come from the same predicate.
 */
import { describe, it, expect } from 'vitest';
import { templateMatches, templateMatchesDocumentType, type Template } from '@/hooks/useTemplates';

const t = (over: Partial<Template>): Template => ({ id: 'x', title: 'Untitled', url: '/x.json', ...over });

/** A stand-in for the shipped index: several types, one dominant. */
const INDEX: Template[] = [
  t({ id: 'basic-1', title: 'Standard Naval Letter', documentType: 'basic' }),
  t({ id: 'untyped', title: 'Legacy Untyped Template' }),
  t({ id: 'mfr-1', title: 'Memorandum for the Record', documentType: 'mfr' }),
  t({ id: 'aa-1', title: 'AA Form BAH', documentType: 'aa-form' }),
  t({ id: 'aa-2', title: 'AA Form POV', documentType: 'aa-form' }),
  t({ id: 'dla-1', title: 'DLA Memorandum', description: 'For DLA', documentType: 'dla-memorandum' }),
];

const countWith = (query: string, documentType?: string) =>
  INDEX.filter(x => templateMatches(x, query, documentType)).length;

describe('templateMatchesDocumentType', () => {
  it('treats a template with no type of its own as basic', () => {
    expect(templateMatchesDocumentType(t({}), 'basic')).toBe(true);
    expect(templateMatchesDocumentType(t({}), 'mfr')).toBe(false);
  });

  it('matches on the template\'s own type', () => {
    expect(templateMatchesDocumentType(t({ documentType: 'mfr' }), 'mfr')).toBe(true);
    expect(templateMatchesDocumentType(t({ documentType: 'mfr' }), 'basic')).toBe(false);
  });
});

describe('templateMatches with the type filter on', () => {
  it('limits to the current document type', () => {
    expect(templateMatches(t({ documentType: 'mfr' }), '', 'mfr')).toBe(true);
    expect(templateMatches(t({ documentType: 'mfr' }), '', 'basic')).toBe(false);
    expect(templateMatches(t({ documentType: 'mfr' }), '   ', 'basic')).toBe(false);
  });

  it('treats an untyped template as basic', () => {
    expect(templateMatches(t({}), '', 'basic')).toBe(true);
    expect(templateMatches(t({}), '', 'mfr')).toBe(false);
  });

  it('narrows the search within the type rather than escaping it', () => {
    const dla = t({ documentType: 'dla-memorandum', title: 'Request', description: 'For DLA' });
    expect(templateMatches(dla, 'dla', 'dla-memorandum')).toBe(true);
    expect(templateMatches(dla, 'dla', 'basic')).toBe(false);
  });

  it('counts 2 of 6 on a basic letter, the type plus the untyped entry', () => {
    expect(countWith('', 'basic')).toBe(2);
    expect(INDEX.length).toBe(6);
  });

  it('counts 2 of 6 on an AA form', () => {
    expect(countWith('', 'aa-form')).toBe(2);
  });
});

describe('templateMatches with the type filter off', () => {
  it('shows every template when no document type is given', () => {
    expect(templateMatches(t({ documentType: 'mfr' }), '')).toBe(true);
    expect(countWith('')).toBe(INDEX.length);
  });

  it('searches across types by title, description, unit and type, case-insensitively', () => {
    const dla = t({ documentType: 'mfr', title: 'Request', description: 'For DLA' });
    expect(templateMatches(dla, 'dla')).toBe(true);
    expect(templateMatches(t({ unitCode: 'M12345' }), 'm123')).toBe(true);
    expect(templateMatches(t({ documentType: 'endorsement' }), 'ENDORSE')).toBe(true);
    expect(templateMatches(dla, 'zzz')).toBe(false);
  });

  it('reaches the AA forms a basic letter used to hide', () => {
    expect(countWith('aa form')).toBe(2);
    expect(countWith('aa form', 'basic')).toBe(0);
  });
});
