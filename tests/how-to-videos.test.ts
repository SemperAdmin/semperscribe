import { describe, it, expect } from 'vitest';
import { DOCUMENT_TYPES } from '@/lib/schemas';
import {
  HOW_TO_VIDEOS,
  libraryGroups,
  typesWithoutVideo,
  validateVideoCatalog,
  videosForType,
  type HowToVideo,
} from '@/lib/how-to-videos';

/**
 * Spec 2026-11-13 section 8.1. Every rule gets a positive control (the
 * production catalog passes) and a negative control (a deliberately
 * broken copy produces the matching error), so a passing run proves
 * each rule actually fires.
 */
const REGISTRY = Object.keys(DOCUMENT_TYPES);
const clone = (): HowToVideo[] => HOW_TO_VIDEOS.map(v => ({ ...v, documentTypes: [...v.documentTypes] }));
const withEdit = (edit: (vs: HowToVideo[]) => void) => { const vs = clone(); edit(vs); return validateVideoCatalog(vs, REGISTRY); };

describe('how-to video catalog', () => {
  it('production catalog: 32 videos, every URL set, no errors', () => {
    expect(HOW_TO_VIDEOS).toHaveLength(32);
    expect(HOW_TO_VIDEOS.every(v => v.url !== null)).toBe(true);
    expect(validateVideoCatalog(HOW_TO_VIDEOS, REGISTRY)).toEqual([]);
  });

  it('report: registry types with no video (informational, empty today)', () => {
    const missing = typesWithoutVideo(REGISTRY);
    if (missing.length) console.warn(`Types with no how-to video: ${missing.join(', ')}`);
    expect(Array.isArray(missing)).toBe(true);
  });

  it('negative: duplicate id', () => {
    expect(withEdit(vs => { vs[1].id = vs[0].id; }).join('\n')).toMatch(/duplicate id/);
  });
  it('negative: duplicate url', () => {
    expect(withEdit(vs => { vs[1].url = vs[0].url; }).join('\n')).toMatch(/duplicate url/);
  });
  it('negative: session token appended to a url', () => {
    expect(withEdit(vs => { vs[0].url += '&token=x'; }).join('\n')).toMatch(/not a MarineNet portal detail link/);
  });
  it('negative: http scheme', () => {
    expect(withEdit(vs => { vs[0].url = vs[0].url!.replace('https:', 'http:'); }).join('\n')).toMatch(/not a MarineNet portal detail link/);
  });
  it('negative: foreign host (the SSO login redirect)', () => {
    expect(withEdit(vs => { vs[0].url = 'https://www.mcele.usmc.mil/id3/sso/login?signin=d55669ba03841dd10b20246608059c70'; }).join('\n'))
      .toMatch(/not a MarineNet portal detail link/);
  });
  it('negative: unknown document type', () => {
    expect(withEdit(vs => { vs[5].documentTypes = ['not-a-type']; }).join('\n')).toMatch(/unknown document type "not-a-type"/);
  });
  it('negative: a video with no library group', () => {
    expect(withEdit(vs => { delete vs[0].group; vs[0].documentTypes = []; }).join('\n')).toMatch(/no library group/);
  });
  it('negative: a regulation citation in a summary', () => {
    expect(withEdit(vs => { vs[0].summary = 'Build it per MCO 50216.20.'; }).join('\n')).toMatch(/regulation citation/);
  });
});

describe('libraryGroups', () => {
  const groups = libraryGroups();

  it('places all 32 videos exactly once', () => {
    const ids = groups.flatMap(g => g.videos.map(v => v.id));
    expect(ids).toHaveLength(32);
    expect(new Set(ids).size).toBe(32);
  });

  it('orders the groups as the spec section 5 catalog', () => {
    expect(groups.map(g => `${g.label}:${g.videos.length}`)).toEqual([
      'Getting Started:4', 'Standard Letter:3', 'Memorandums:2', 'Staffing Papers:1',
      'External & Executive:1', 'Directives:3', 'Forms:7', 'Counseling Worksheets:1',
      'AMHS Message:1', 'Check, Export, and Share:6', 'Power Tools:3',
    ]);
  });

  it('puts Change Transmittals in Directives through secnav-instruction', () => {
    const directives = groups.find(g => g.key === 'directives')!;
    expect(directives.videos.map(v => v.id)).toContain('change-transmittals-and-secnav-directives');
  });
});

describe('videosForType', () => {
  it('basic shows both letter videos, whatever library group they sit in', () => {
    expect(videosForType('basic').map(v => v.id)).toEqual(['your-first-basic-letter', 'references-enclosures-and-via']);
  });
  it('the UPB has its video', () => {
    expect(videosForType('navmc10132').map(v => v.id)).toEqual(['the-unit-punishment-book-navmc-10132']);
  });
  it('DLA and I-Type headers get their links through multi-type videos', () => {
    expect(videosForType('dla-memorandum')).toHaveLength(1);
    expect(videosForType('i-type').map(v => v.id)).toEqual(['volumes-and-technical-publications']);
  });
});
