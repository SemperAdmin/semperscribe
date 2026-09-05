/**
 * templateMatches: the pure filter behind useTemplates (Phase A.5).
 */
import { describe, it, expect } from 'vitest';
import { templateMatches, type Template } from '@/hooks/useTemplates';

const t = (over: Partial<Template>): Template => ({ id: 'x', title: 'Untitled', url: '/x.json', ...over });

describe('templateMatches', () => {
  it('limits to the current document type when not searching', () => {
    expect(templateMatches(t({ documentType: 'mfr' }), '', 'mfr')).toBe(true);
    expect(templateMatches(t({ documentType: 'mfr' }), '', 'basic')).toBe(false);
    expect(templateMatches(t({ documentType: 'mfr' }), '   ', 'basic')).toBe(false);
  });

  it('treats an untyped template as basic', () => {
    expect(templateMatches(t({}), '', 'basic')).toBe(true);
    expect(templateMatches(t({}), '', 'mfr')).toBe(false);
  });

  it('shows everything when no document type is given', () => {
    expect(templateMatches(t({ documentType: 'mfr' }), '')).toBe(true);
  });

  it('searches across types by title, description, unit and type, case-insensitively', () => {
    const dla = t({ documentType: 'mfr', title: 'Request', description: 'For DLA' });
    expect(templateMatches(dla, 'dla', 'basic')).toBe(true);
    expect(templateMatches(t({ unitCode: 'M12345' }), 'm123', 'basic')).toBe(true);
    expect(templateMatches(t({ documentType: 'endorsement' }), 'ENDORSE', 'basic')).toBe(true);
    expect(templateMatches(dla, 'zzz', 'basic')).toBe(false);
  });
});
