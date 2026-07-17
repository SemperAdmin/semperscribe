/**
 * R4 (USER_DRIVEN_ROADMAP) - package assembly sequence math.
 * This library automates the arithmetic users most often get wrong,
 * so the continuation rules get exhaustive coverage.
 */
import { describe, it, expect } from 'vitest';
import {
  computeSequences, validatePackage, applySequence, toMember,
  totalPages, moveMember, sequenceFor, PackageMember,
} from '@/lib/package-assembly';
import type { SavedLetter } from '@/types';

function member(overrides: Partial<PackageMember> = {}): PackageMember {
  return {
    id: 'x', name: 'Doc', documentType: 'basic', endorsementLevel: '',
    referenceCount: 0, enclosureCount: 0, pageCount: 1, ...overrides,
  };
}

/** Basic (2pg, 2 refs, 1 encl) -> 1st End (1pg, 1 ref, 2 encl) -> 2nd End (3pg, 1 ref). */
function chain(): PackageMember[] {
  return [
    member({ id: 'b', documentType: 'basic', pageCount: 2, referenceCount: 2, enclosureCount: 1 }),
    member({ id: 'e1', documentType: 'endorsement', endorsementLevel: 'FIRST', pageCount: 1, referenceCount: 1, enclosureCount: 2 }),
    member({ id: 'e2', documentType: 'endorsement', endorsementLevel: 'SECOND', pageCount: 3, referenceCount: 1 }),
  ];
}

describe('computeSequences', () => {
  it('starts the basic letter at page 1, ref (a), enclosure 1', () => {
    const [first] = computeSequences(chain());
    expect(first.startingPageNumber).toBe(1);
    expect(first.previousPackagePageCount).toBe(0);
    expect(first.startingReferenceLevel).toBe('a');
    expect(first.startingEnclosureNumber).toBe(1);
  });

  it('continues page numbers across the chain', () => {
    const seq = computeSequences(chain());
    expect(seq[1].startingPageNumber).toBe(3); // after the basic letter's 2 pages
    expect(seq[1].previousPackagePageCount).toBe(2);
    expect(seq[2].startingPageNumber).toBe(4); // after 2 + 1
    expect(seq[2].previousPackagePageCount).toBe(3);
  });

  it('continues reference letters across the chain', () => {
    const seq = computeSequences(chain());
    expect(seq[1].startingReferenceLevel).toBe('c'); // basic used a, b
    expect(seq[2].startingReferenceLevel).toBe('d'); // 1st endorsement used c
  });

  it('continues enclosure numbers across the chain', () => {
    const seq = computeSequences(chain());
    expect(seq[1].startingEnclosureNumber).toBe(2); // basic used 1
    expect(seq[2].startingEnclosureNumber).toBe(4); // 1st endorsement used 2, 3
  });

  it('rolls reference letters past z', () => {
    const seq = computeSequences([
      member({ id: 'b', referenceCount: 26 }),
      member({ id: 'e1', documentType: 'endorsement', endorsementLevel: 'FIRST' }),
    ]);
    expect(seq[1].startingReferenceLevel).toBe('aa');
  });

  it('handles empty and single-member packages', () => {
    expect(computeSequences([])).toEqual([]);
    expect(computeSequences([member()])[0].startingPageNumber).toBe(1);
  });
});

describe('validatePackage', () => {
  it('passes a well-formed chain', () => {
    expect(validatePackage(chain()).filter((i) => i.severity === 'fail')).toHaveLength(0);
  });

  it('fails when a package starts with an endorsement', () => {
    const issues = validatePackage([member({ documentType: 'endorsement', endorsementLevel: 'FIRST' })]);
    expect(issues.some((i) => i.id === 'package-starts-with-endorsement')).toBe(true);
  });

  it('fails when a non-endorsement follows the basic letter', () => {
    const issues = validatePackage([member({ id: 'b' }), member({ id: 'm', documentType: 'mfr' })]);
    expect(issues.some((i) => i.id.startsWith('package-non-endorsement'))).toBe(true);
  });

  it('fails on an endorsement level gap', () => {
    const issues = validatePackage([
      member({ id: 'b' }),
      member({ id: 'e1', documentType: 'endorsement', endorsementLevel: 'FIRST' }),
      member({ id: 'e3', documentType: 'endorsement', endorsementLevel: 'THIRD' }),
    ]);
    expect(issues.some((i) => i.id.startsWith('package-level-order'))).toBe(true);
  });

  it('fails on a missing endorsement level', () => {
    const issues = validatePackage([
      member({ id: 'b' }),
      member({ id: 'e1', documentType: 'endorsement', endorsementLevel: '' }),
    ]);
    expect(issues.some((i) => i.id.startsWith('package-missing-level'))).toBe(true);
  });

  it('warns when page counts are unmeasured', () => {
    const issues = validatePackage([member({ pageCount: 0 })]);
    expect(issues.some((i) => i.id === 'package-unknown-page-counts' && i.severity === 'warn')).toBe(true);
  });

  it('says nothing about an empty package', () => {
    expect(validatePackage([])).toEqual([]);
  });
});

describe('applySequence', () => {
  const letter = {
    documentType: 'endorsement', id: 'e1', savedAt: 'x',
    vias: [], references: [], enclosures: [], copyTos: [], paragraphs: [],
  } as unknown as SavedLetter;

  it('writes the continuation fields onto an endorsement', () => {
    const seq = computeSequences(chain())[1];
    const applied = applySequence(letter, seq);
    expect(applied.startingPageNumber).toBe(3);
    expect(applied.previousPackagePageCount).toBe(2);
    expect(applied.startingReferenceLevel).toBe('c');
    expect(applied.startingEnclosureNumber).toBe('2'); // string, as the form stores it
  });

  it('resets the basic letter to the sequence origin', () => {
    const seq = computeSequences(chain())[0];
    const applied = applySequence({ ...letter, documentType: 'basic' } as SavedLetter, seq);
    expect(applied.startingPageNumber).toBe(1);
    expect(applied.previousPackagePageCount).toBe(0);
    expect(applied.startingReferenceLevel).toBe('a');
    expect(applied.startingEnclosureNumber).toBe('1');
  });
});

describe('helpers', () => {
  it('toMember counts only non-empty list entries', () => {
    const letter = {
      documentType: 'basic', id: 'b1', savedAt: 'x', name: 'My Letter',
      references: ['(a) X', '', '(b) Y'], enclosures: ['E1'],
      copyTos: [], vias: [], paragraphs: [],
    } as unknown as SavedLetter;
    const m = toMember(letter, 2);
    expect(m.referenceCount).toBe(2);
    expect(m.enclosureCount).toBe(1);
    expect(m.pageCount).toBe(2);
    expect(m.name).toBe('My Letter');
  });

  it('totalPages sums the chain', () => {
    expect(totalPages(chain())).toBe(6);
  });

  it('sequenceFor finds a member, or nothing', () => {
    expect(sequenceFor(chain(), 'e2')?.startingPageNumber).toBe(4);
    expect(sequenceFor(chain(), 'missing')).toBeUndefined();
  });

  it('moveMember reorders and respects bounds', () => {
    expect(moveMember(chain(), 1, -1)[0].id).toBe('e1');
    expect(moveMember(chain(), 0, -1)[0].id).toBe('b');
  });
});
