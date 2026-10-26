import { describe, it, expect } from 'vitest';
import { MOADefinition, MOUDefinition } from '@/lib/schemas';
import { supportsUnitSubName } from '@/lib/naval-format-utils';

describe('MOA/MOU form features', () => {
  it.each([MOADefinition, MOUDefinition])('$id shows the references and enclosures editors', (def) => {
    expect(def.features.showReferences).toBe(true);
    expect(def.features.showEnclosures).toBe(true);
  });

  it('offers the unit sub-name (fourth letterhead line) on MOA and MOU', () => {
    expect(supportsUnitSubName('moa')).toBe(true);
    expect(supportsUnitSubName('mou')).toBe(true);
    expect(supportsUnitSubName('basic')).toBe(true);
    expect(supportsUnitSubName('mfr')).toBe(false);
    expect(supportsUnitSubName(undefined)).toBe(false);
  });
});
