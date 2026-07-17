/**
 * R7 (USER_DRIVEN_ROADMAP) - signature block validators.
 * Emphasis on bounding false positives: legitimate names must not warn.
 */
import { describe, it, expect } from 'vitest';
import { validateSignature, looksLikeInitial } from '@/lib/signature-validators';
import type { FormData } from '@/types';

function form(sig: string, delegationText?: string, documentType = 'basic'): FormData {
  return { documentType, sig, delegationText } as FormData;
}

function ids(formData: FormData): string[] {
  return validateSignature(formData).map((i) => i.id);
}

describe('scope', () => {
  it('ignores non-naval-signature document types', () => {
    expect(ids(form('JOHN A SMITH', undefined, 'business-letter'))).toEqual([]);
    expect(ids(form('JOHN A SMITH', undefined, 'moa'))).toEqual([]);
  });

  it('all issues are warn severity', () => {
    const issues = validateSignature(form('JOHN A SMITH', 'On behalf of'));
    expect(issues.length).toBeGreaterThan(0);
    expect(issues.every((i) => i.severity === 'warn')).toBe(true);
  });
});

describe('first-name-as-initials check', () => {
  it('accepts proper initials-plus-surname', () => {
    expect(ids(form('J. A. SMITH'))).not.toContain('signature-initials');
    expect(ids(form('J. SMITH'))).not.toContain('signature-initials');
  });

  it('accepts a run of initials written without spaces', () => {
    // Regression: "J.A. SMITH" was flagged as a spelled-out first name.
    // Caught by the first local run of this suite.
    expect(ids(form('J.A. SMITH'))).not.toContain('signature-initials');
    expect(ids(form('J.A.B. SMITH'))).not.toContain('signature-initials');
    expect(ids(form('J.A SMITH'))).not.toContain('signature-initials');
  });

  it('flags a spelled-out first name', () => {
    expect(ids(form('JOHN A. SMITH'))).toContain('signature-initials');
    expect(ids(form('John Smith'))).toContain('signature-initials');
  });

  it('does not flag a single-token entry (surname only)', () => {
    expect(ids(form('SMITH'))).not.toContain('signature-initials');
  });

  it('does not flag surname-first "SMITH, J. A."', () => {
    expect(ids(form('SMITH, J. A.'))).not.toContain('signature-initials');
  });

  it('does not flag name particles', () => {
    expect(ids(form('de la CRUZ'))).not.toContain('signature-initials');
    expect(ids(form('van BUREN'))).not.toContain('signature-initials');
  });

  it('ignores an empty signature (no false warn)', () => {
    expect(ids(form(''))).not.toContain('signature-initials');
  });
});

describe('looksLikeInitial predicate', () => {
  it('recognizes every legitimate initial form', () => {
    ['J', 'J.', 'J.A.', 'J.A', 'J.A.B.'].forEach((token) => {
      expect(looksLikeInitial(token)).toBe(true);
    });
  });

  it('rejects spelled-out names', () => {
    ['JOHN', 'JOHN.', 'SMITH', 'John'].forEach((token) => {
      expect(looksLikeInitial(token)).toBe(false);
    });
  });
});

describe('delegation line check', () => {
  it('accepts standard authority phrases', () => {
    expect(ids(form('J. SMITH', 'By direction'))).not.toContain('signature-delegation-form');
    expect(ids(form('J. SMITH', 'By direction of the Commanding Officer'))).not.toContain('signature-delegation-form');
    expect(ids(form('J. SMITH', 'Acting'))).not.toContain('signature-delegation-form');
    expect(ids(form('J. SMITH', 'Deputy'))).not.toContain('signature-delegation-form');
  });

  it('is case-insensitive', () => {
    expect(ids(form('J. SMITH', 'BY DIRECTION'))).not.toContain('signature-delegation-form');
  });

  it('flags a freeform delegation line', () => {
    expect(ids(form('J. SMITH', 'On behalf of the CO'))).toContain('signature-delegation-form');
  });

  it('does not flag an absent delegation line', () => {
    expect(ids(form('J. SMITH'))).not.toContain('signature-delegation-form');
  });
});
