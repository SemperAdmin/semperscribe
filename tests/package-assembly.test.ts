/**
 * R4 (USER_DRIVEN_ROADMAP) - package assembly sequence math.
 * This library automates the arithmetic users most often get wrong,
 * so the continuation rules get exhaustive coverage.
 */
import { describe, it, expect } from 'vitest';
import {
  computeSequences, validatePackage, applySequence, toMember,
  totalPages, moveMember, sequenceFor, fitsOnSignaturePage,
  asNewPageFallback, PackageMember,
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

describe('same-page placement (E.1, M-5216.5 9-1)', () => {
  /** Basic (2pg) -> 1st End same-page, fits -> 2nd End (2pg). */
  function samePageChain(fits: boolean | undefined): PackageMember[] {
    return [
      member({ id: 'b', documentType: 'basic', pageCount: 2, referenceCount: 1, enclosureCount: 1 }),
      member({
        id: 'e1', documentType: 'endorsement', endorsementLevel: 'FIRST',
        endorsementPlacement: 'same-page', samePageFits: fits,
        pageCount: fits === true ? 0 : 1, referenceCount: 1,
      }),
      member({ id: 'e2', documentType: 'endorsement', endorsementLevel: 'SECOND', pageCount: 2 }),
    ];
  }

  it('a fitting same-page endorsement adds no page and starts on the host page', () => {
    const seq = computeSequences(samePageChain(true));
    expect(seq[1].startingPageNumber).toBe(2); // the basic letter's last page
    expect(seq[1].previousPackagePageCount).toBe(1);
    // The next member continues from the host's count, not from a page
    // the same-page endorsement never added.
    expect(seq[2].startingPageNumber).toBe(3);
    expect(seq[2].previousPackagePageCount).toBe(2);
    expect(totalPages(samePageChain(true))).toBe(4);
  });

  it('a same-page endorsement which does not fit numbers like a new-page one', () => {
    const seq = computeSequences(samePageChain(false));
    expect(seq[1].startingPageNumber).toBe(3);
    expect(seq[1].previousPackagePageCount).toBe(2);
    expect(seq[2].startingPageNumber).toBe(4);
  });

  it('reference and enclosure sequences run either way (9-2.3, 9-2.4)', () => {
    const fitting = computeSequences(samePageChain(true));
    const spilling = computeSequences(samePageChain(false));
    expect(fitting[1].startingReferenceLevel).toBe('b');
    expect(fitting[2].startingReferenceLevel).toBe('c');
    expect(spilling[2].startingReferenceLevel).toBe('c');
    expect(fitting[1].startingEnclosureNumber).toBe(2);
  });

  it('fitsOnSignaturePage reads placement and measurement together', () => {
    expect(fitsOnSignaturePage(member({ endorsementPlacement: 'same-page', samePageFits: true }))).toBe(true);
    expect(fitsOnSignaturePage(member({ endorsementPlacement: 'same-page', samePageFits: false }))).toBe(false);
    expect(fitsOnSignaturePage(member({ endorsementPlacement: 'same-page' }))).toBe(false);
    expect(fitsOnSignaturePage(member({ samePageFits: true }))).toBe(false);
  });

  it('the new-page fallback restores the identification (Figure 9-1)', () => {
    const letter = {
      documentType: 'endorsement', id: 'e1', savedAt: 'x',
      endorsementPlacement: 'same-page', samePageOmitsIdentification: true,
      vias: [], references: [], enclosures: [], copyTos: [], paragraphs: [],
    } as unknown as SavedLetter;
    const fallback = asNewPageFallback(letter);
    expect(fallback.endorsementPlacement).toBe('new-page');
    expect(fallback.samePageOmitsIdentification).toBe(false);
  });

  it('toMember carries the placement off the saved document', () => {
    const letter = {
      documentType: 'endorsement', id: 'e1', savedAt: 'x',
      endorsementPlacement: 'same-page',
      vias: [], references: [], enclosures: [], copyTos: [], paragraphs: [],
    } as unknown as SavedLetter;
    expect(toMember(letter, 0, true).endorsementPlacement).toBe('same-page');
    expect(toMember(letter, 0, true).samePageFits).toBe(true);
    expect(toMember(letter, 1).samePageFits).toBeUndefined();
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

  it('fails when the first member is a same-page endorsement (9-1)', () => {
    const issues = validatePackage([
      member({ id: 'e1', documentType: 'endorsement', endorsementLevel: 'FIRST', endorsementPlacement: 'same-page' }),
    ]);
    const issue = issues.find((i) => i.id === 'package-first-member-same-page');
    expect(issue?.severity).toBe('fail');
    expect(issue?.detail).toContain('9-1');
  });

  it('warns when a same-page endorsement has not been measured', () => {
    const issues = validatePackage([
      member({ id: 'b', documentType: 'basic', pageCount: 1 }),
      member({
        id: 'e1', documentType: 'endorsement', endorsementLevel: 'FIRST',
        endorsementPlacement: 'same-page', pageCount: 1,
      }),
    ]);
    const issue = issues.find((i) => i.id === 'package-same-page-unmeasured');
    expect(issue?.severity).toBe('warn');
    expect(issue?.detail).toContain('Measure the package to check fit');
  });

  it('does not call a measured same-page member unmeasured for its zero pages', () => {
    const issues = validatePackage([
      member({ id: 'b', documentType: 'basic', pageCount: 1 }),
      member({
        id: 'e1', documentType: 'endorsement', endorsementLevel: 'FIRST',
        endorsementPlacement: 'same-page', samePageFits: true, pageCount: 0,
      }),
    ]);
    expect(issues.some((i) => i.id === 'package-unknown-page-counts')).toBe(false);
    expect(issues.some((i) => i.id === 'package-same-page-unmeasured')).toBe(false);
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
