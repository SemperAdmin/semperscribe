/**
 * E.1 - the two placement fields survive every way a document leaves
 * the editor and comes back: the .nldp package, the share link and the
 * library round-trip. Both are carried by shape rather than by an
 * enumerated field list, so this pins the shape.
 */
import { describe, it, expect } from 'vitest';
import { createNLDPFile, importNLDPFile } from '@/lib/nldp-utils';
import { encodeStateForUrl, decodeStateFromUrl, type ShareableState } from '@/lib/url-state';
import { isSamePageEndorsement, omitsIdentification } from '@/lib/same-page-endorsement';
import type { FormData, SavedLetter } from '@/types';

const ENDORSEMENT: FormData = {
  documentType: 'endorsement',
  ssic: '5216',
  subj: 'HOW TO PREPARE AN ENDORSEMENT',
  from: 'Commander, Sea Based Anti-Submarine Warfare Wing, Atlantic',
  to: 'Commander, Fleet Forces Command',
  sig: 'R. L. GABEL',
  endorsementLevel: 'FIRST',
  basicLetterReference: 'NAS Meridian ltr 5216 Ser 11/273 of 22 Apr 26',
  endorsementPlacement: 'same-page',
  samePageOmitsIdentification: true,
};

describe('.nldp carries the placement', () => {
  it('export then import keeps both fields', async () => {
    const file = await createNLDPFile(
      ENDORSEMENT, ['Commander, Naval Air Force, U.S. Atlantic Fleet'], [], [],
      ['NAS Meridian (Code 11)'], [{ id: 1, level: 1, content: 'Forwarded, recommending approval.' }],
    );
    const imported = await importNLDPFile(JSON.stringify(file, null, 2));
    expect(imported.success).toBe(true);
    const formData = imported.data!.formData as FormData;
    expect(formData.endorsementPlacement).toBe('same-page');
    expect(formData.samePageOmitsIdentification).toBe(true);
    expect(isSamePageEndorsement(formData)).toBe(true);
    expect(omitsIdentification(formData)).toBe(true);
  });

  it('a package written before E.1 still reads as a new-page endorsement', async () => {
    const { endorsementPlacement, samePageOmitsIdentification, ...older } = ENDORSEMENT;
    void endorsementPlacement;
    void samePageOmitsIdentification;
    const file = await createNLDPFile(older as FormData, [], [], [], [], []);
    const imported = await importNLDPFile(JSON.stringify(file, null, 2));
    const formData = imported.data!.formData as FormData;
    expect(formData.endorsementPlacement).toBeUndefined();
    expect(isSamePageEndorsement(formData)).toBe(false);
    expect(omitsIdentification(formData)).toBe(false);
  });
});

describe('the share link carries the placement', () => {
  it('encode then decode keeps both fields', () => {
    const state: ShareableState = {
      formData: ENDORSEMENT,
      paragraphs: [{ id: 1, level: 1, content: 'Forwarded, recommending approval.' }],
      references: [], enclosures: [], vias: [], copyTos: [],
      version: 2,
    };
    const decoded = decodeStateFromUrl(encodeStateForUrl(state));
    expect(decoded).not.toBeNull();
    expect(decoded!.formData.endorsementPlacement).toBe('same-page');
    expect(decoded!.formData.samePageOmitsIdentification).toBe(true);
  });

  it('keeps the omission cleared when the drafter cleared it', () => {
    const state: ShareableState = {
      formData: { ...ENDORSEMENT, samePageOmitsIdentification: false },
      paragraphs: [], references: [], enclosures: [], vias: [], copyTos: [],
      version: 2,
    };
    const decoded = decodeStateFromUrl(encodeStateForUrl(state));
    expect(decoded!.formData.samePageOmitsIdentification).toBe(false);
    expect(omitsIdentification(decoded!.formData as FormData)).toBe(false);
  });
});

describe('the library round-trip carries the placement', () => {
  it('a saved document serialized and read back keeps both fields', () => {
    const saved: SavedLetter = {
      ...ENDORSEMENT,
      id: 'e1', savedAt: '2026-09-05T00:00:00.000Z',
      vias: [], references: [], enclosures: [], copyTos: [], paragraphs: [],
    };
    const back = JSON.parse(JSON.stringify(saved)) as SavedLetter;
    expect(back.endorsementPlacement).toBe('same-page');
    expect(back.samePageOmitsIdentification).toBe(true);
  });
});
