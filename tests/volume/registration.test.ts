import { describe, it, expect } from 'vitest';
import { DOCUMENT_TYPES } from '@/lib/schemas';
import { pickerOptions } from '@/lib/document-type-options';
import { getHeadingStyle } from '@/lib/heading-policy';

describe('volume registration', () => {
  it('registers under directives with the volume pipeline', () => {
    const v = DOCUMENT_TYPES.volume;
    expect(v).toBeTruthy();
    expect(v.features.category).toBe('directives');
    expect(v.features.pdfPipeline).toBe('volume');
    expect(v.features.exportFormats).toEqual(['pdf', 'docx']);
  });
  it('appears in the picker labeled "Volume"', () => {
    const keys = pickerOptions().map(o => o.key);
    expect(keys).toContain('volume');
    expect(pickerOptions().find(o => o.key === 'volume')?.name).toBe('Volume');
  });
  it('uses regular-weight, non-underlined headings', () => {
    const style = getHeadingStyle('volume');
    expect(style.bold).toBe(false);
    expect(style.underline).toBe(false);
  });
});
