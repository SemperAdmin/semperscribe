/**
 * R4 (USER_DRIVEN_ROADMAP) - package assembly for endorsement chains.
 *
 * The arithmetic users get wrong. A package is a basic letter plus its
 * endorsements in order. Each endorsement must continue the sequences
 * the documents before it established:
 *
 * - startingPageNumber: pages run continuously across the package, so
 *   endorsement N starts at 1 + the page count of everything before it.
 * - startingReferenceLevel: references letter continuously (a, b, c...),
 *   so endorsement N starts at the letter after the last one used.
 * - startingEnclosureNumber: enclosures number continuously (1, 2, 3...),
 *   same rule.
 *
 * Every function here is PURE. Page counts come from the caller (the
 * PDF engine is the only honest source), so this library never renders.
 */

import { SavedLetter, EndorsementLevel } from '@/types';
import { indexToRefLetter } from '@/lib/letter-validators';

/** Endorsement ladder in order. Index 0 = the basic letter. */
export const ENDORSEMENT_ORDER: EndorsementLevel[] = [
  'FIRST', 'SECOND', 'THIRD', 'FOURTH', 'FIFTH',
  'SIXTH', 'SEVENTH', 'EIGHTH', 'NINTH', 'TENTH',
];

export interface PackageMember {
  /** Library document id. */
  id: string;
  /** Display label. */
  name: string;
  documentType: string;
  /** Endorsement level, empty for the basic letter. */
  endorsementLevel: EndorsementLevel;
  /** Non-empty references this member lists. */
  referenceCount: number;
  /** Non-empty enclosures this member lists. */
  enclosureCount: number;
  /** Rendered page count. Supplied by the caller; 0 when unknown. */
  pageCount: number;
}

export interface ComputedSequence {
  id: string;
  /** 1-based position in the package. */
  position: number;
  startingPageNumber: number;
  /** Letter this member's references begin at ('a', 'b', ...). */
  startingReferenceLevel: string;
  /** Number this member's enclosures begin at. */
  startingEnclosureNumber: number;
  /** Total pages before this member. */
  previousPackagePageCount: number;
}

export interface PackageIssue {
  id: string;
  severity: 'fail' | 'warn';
  rule: string;
  detail: string;
}

/** Converts a member into the SavedLetter fields the renderer reads. */
export function toMember(letter: SavedLetter, pageCount = 0): PackageMember {
  return {
    id: letter.id,
    name: letter.name || letter.subj || 'Untitled',
    documentType: letter.documentType,
    endorsementLevel: (letter.endorsementLevel ?? '') as EndorsementLevel,
    referenceCount: (letter.references ?? []).filter((r) => r.trim()).length,
    enclosureCount: (letter.enclosures ?? []).filter((e) => e.trim()).length,
    pageCount,
  };
}

/**
 * Computes the continuation fields for every member, in order.
 *
 * The basic letter always starts at page 1, reference (a), enclosure 1.
 * Each following member continues from the running totals.
 */
export function computeSequences(members: PackageMember[]): ComputedSequence[] {
  let pagesSoFar = 0;
  let refsSoFar = 0;
  let enclsSoFar = 0;

  return members.map((member, index) => {
    const sequence: ComputedSequence = {
      id: member.id,
      position: index + 1,
      startingPageNumber: pagesSoFar + 1,
      startingReferenceLevel: indexToRefLetter(refsSoFar + 1),
      startingEnclosureNumber: enclsSoFar + 1,
      previousPackagePageCount: pagesSoFar,
    };
    pagesSoFar += member.pageCount;
    refsSoFar += member.referenceCount;
    enclsSoFar += member.enclosureCount;
    return sequence;
  });
}

/** The sequence for one member, or undefined when it is not in the package. */
export function sequenceFor(members: PackageMember[], id: string): ComputedSequence | undefined {
  return computeSequences(members).find((s) => s.id === id);
}

/**
 * Chain integrity checks. Structural problems a drafter cannot see by
 * looking at one document alone.
 */
export function validatePackage(members: PackageMember[]): PackageIssue[] {
  const issues: PackageIssue[] = [];
  if (members.length === 0) return issues;

  // 1. The first member is the basic letter (not an endorsement).
  const first = members[0];
  if (first.documentType === 'endorsement') {
    issues.push({
      id: 'package-starts-with-endorsement',
      severity: 'fail',
      rule: 'A package begins with the basic letter',
      detail: `"${first.name}" is an endorsement. Add the basic letter it endorses as the first member.`,
    });
  }

  // 2. Everything after the first is an endorsement.
  members.slice(1).forEach((member) => {
    if (member.documentType !== 'endorsement') {
      issues.push({
        id: `package-non-endorsement-${member.id}`,
        severity: 'fail',
        rule: 'Only endorsements follow the basic letter',
        detail: `"${member.name}" is a ${member.documentType}, not an endorsement.`,
      });
    }
  });

  // 3. Endorsement levels ascend without gaps or repeats.
  const endorsements = members.filter((m) => m.documentType === 'endorsement');
  endorsements.forEach((member, i) => {
    const expected = ENDORSEMENT_ORDER[i];
    if (!member.endorsementLevel) {
      issues.push({
        id: `package-missing-level-${member.id}`,
        severity: 'fail',
        rule: 'Every endorsement carries a level',
        detail: `"${member.name}" has no endorsement level set. Expected ${expected}.`,
      });
    } else if (member.endorsementLevel !== expected) {
      issues.push({
        id: `package-level-order-${member.id}`,
        severity: 'fail',
        rule: 'Endorsement levels ascend in order without gaps',
        detail: `"${member.name}" is the ${expected} endorsement by position but is marked ${member.endorsementLevel}.`,
      });
    }
  });

  // 4. Page counts must be known for the math to be trustworthy.
  const unknown = members.filter((m) => m.pageCount <= 0);
  if (unknown.length > 0) {
    issues.push({
      id: 'package-unknown-page-counts',
      severity: 'warn',
      rule: 'Page counts are not measured yet',
      detail: `${unknown.length} member(s) have no rendered page count, so starting page numbers are provisional. Refresh the package to measure.`,
    });
  }

  return issues;
}

/** Applies a computed sequence onto a saved document's fields. */
export function applySequence(letter: SavedLetter, sequence: ComputedSequence): SavedLetter {
  // The basic letter carries no continuation fields - it starts everything.
  if (sequence.position === 1) {
    return {
      ...letter,
      startingPageNumber: 1,
      previousPackagePageCount: 0,
      startingReferenceLevel: 'a',
      startingEnclosureNumber: '1',
    };
  }
  return {
    ...letter,
    startingPageNumber: sequence.startingPageNumber,
    previousPackagePageCount: sequence.previousPackagePageCount,
    startingReferenceLevel: sequence.startingReferenceLevel,
    startingEnclosureNumber: String(sequence.startingEnclosureNumber),
  };
}

/** Total pages across the package. */
export function totalPages(members: PackageMember[]): number {
  return members.reduce((sum, m) => sum + m.pageCount, 0);
}

/** Moves a member within the chain. Returns a new array. */
export function moveMember(members: PackageMember[], index: number, direction: -1 | 1): PackageMember[] {
  const target = index + direction;
  if (index < 0 || index >= members.length || target < 0 || target >= members.length) return members;
  const next = [...members];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}
