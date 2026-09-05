/**
 * E.2: the same-page endorsement as its own picker option.
 *
 * The schema keeps one endorsement type with a placement field
 * (M-5216.5 9-1). The picker shows two options. This module is the
 * mapping between them, so the tests pin both directions and the
 * order the options are listed in.
 */
import { describe, it, expect } from 'vitest';
import {
  SAME_PAGE_ENDORSEMENT_OPTION,
  pickerTypeFor,
  resolvePickerType,
  pickerDefinitionFor,
  pickerOptions,
} from '@/lib/document-type-options';
import { DOCUMENT_TYPES } from '@/lib/schemas';

describe('pickerTypeFor', () => {
  it('reads a same-page endorsement as the same-page option', () => {
    expect(pickerTypeFor({ documentType: 'endorsement', endorsementPlacement: 'same-page' }))
      .toBe(SAME_PAGE_ENDORSEMENT_OPTION);
  });

  it('reads a new-page or unset placement as the endorsement type', () => {
    expect(pickerTypeFor({ documentType: 'endorsement', endorsementPlacement: 'new-page' })).toBe('endorsement');
    expect(pickerTypeFor({ documentType: 'endorsement' })).toBe('endorsement');
  });

  it('ignores the placement on every other type', () => {
    expect(pickerTypeFor({ documentType: 'basic', endorsementPlacement: 'same-page' })).toBe('basic');
    expect(pickerTypeFor({ documentType: 'mco' })).toBe('mco');
  });
});

describe('resolvePickerType', () => {
  it('maps the same-page option to the endorsement type with same-page placement', () => {
    expect(resolvePickerType(SAME_PAGE_ENDORSEMENT_OPTION))
      .toEqual({ documentType: 'endorsement', endorsementPlacement: 'same-page' });
  });

  it('maps every document type to itself with new-page placement', () => {
    for (const key of Object.keys(DOCUMENT_TYPES)) {
      expect(resolvePickerType(key)).toEqual({ documentType: key, endorsementPlacement: 'new-page' });
    }
  });

  it('round-trips through pickerTypeFor', () => {
    for (const option of pickerOptions()) {
      expect(pickerTypeFor(resolvePickerType(option.key))).toBe(option.key);
    }
  });

  it('never yields a documentType the registry does not know', () => {
    for (const option of pickerOptions()) {
      expect(DOCUMENT_TYPES[resolvePickerType(option.key).documentType]).toBeDefined();
    }
  });
});

describe('pickerOptions', () => {
  it('lists the same-page option directly after the endorsement', () => {
    const keys = pickerOptions().map((o) => o.key);
    expect(keys.indexOf(SAME_PAGE_ENDORSEMENT_OPTION)).toBe(keys.indexOf('endorsement') + 1);
  });

  it('adds exactly one option to the registry', () => {
    expect(pickerOptions()).toHaveLength(Object.keys(DOCUMENT_TYPES).length + 1);
  });

  it('names the two options so a drafter tells them apart', () => {
    const byKey = Object.fromEntries(pickerOptions().map((o) => [o.key, o]));
    expect(byKey.endorsement.name).toBe('Endorsement');
    expect(byKey[SAME_PAGE_ENDORSEMENT_OPTION].name).toBe('Same-Page Endorsement');
    expect(byKey[SAME_PAGE_ENDORSEMENT_OPTION].description).toContain('9-1');
  });
});

describe('pickerDefinitionFor', () => {
  it('names the header after the option, not the type', () => {
    expect(pickerDefinitionFor({ documentType: 'endorsement', endorsementPlacement: 'same-page' }).name)
      .toBe('Same-Page Endorsement');
    expect(pickerDefinitionFor({ documentType: 'endorsement' }).name).toBe('Endorsement');
    expect(pickerDefinitionFor({ documentType: 'basic' }).name).toBe(DOCUMENT_TYPES.basic.name);
  });

  it('falls back to the basic letter for an unknown type', () => {
    expect(pickerDefinitionFor({ documentType: 'no-such-type' as never }).name).toBe(DOCUMENT_TYPES.basic.name);
  });
});
