/**
 * Package readiness and case building.
 *
 * The assertion that matters most is the vessel one. Picking A-1-c for a
 * Marine ashore tells him he cannot refuse NJP when he can, and picking
 * A-1-d for a Marine embarked offers a right he does not have. Both are
 * wrong advice on a rights advisement.
 */

import { describe, it, expect } from 'vitest';
import zlib from 'zlib';
import type { FormData } from '@/types';
import { NAVMC_10132_DEMAND } from '@/types/navmc';
import {
  chargedOffenses,
  vesselExceptionApplies,
  rightsElectionReadiness,
  buildRightsCase,
  accusedRankAbbreviation,
  maximumPunishmentStatus,
  renderRightsElection,
  NjpPackageError,
} from '@/lib/njp-package';

const complete = {
  documentType: 'navmc10132',
  accusedName: 'SNUFFY, JOHN A',
  accusedRankGrade: 'LCpl, E3',
  unit: 'H&S BN, MCB QUANTICO',
  offenses: [{ articleLabel: 'Art. 86  Absence without leave', summary: 'UA 14 Aug 26.' }],
} as unknown as FormData;

describe('readiness names what is missing', () => {
  it('is ready when the accused, the accused rank, the unit, and an offense are present', () => {
    expect(rightsElectionReadiness(complete)).toEqual({ ready: true, missing: [] });
  });

  it('is NOT ready when the rank (item 19) is missing, even with everything else present', () => {
    const noRank = { ...complete, accusedRankGrade: '' } as FormData;
    const r = rightsElectionReadiness(noRank);
    expect(r.ready).toBe(false);
    expect(r.missing).toEqual(["the accused's rank (item 19)"]);
  });

  it('names each missing field rather than failing silently', () => {
    const r = rightsElectionReadiness({ documentType: 'navmc10132' } as FormData);
    expect(r.ready).toBe(false);
    expect(r.missing).toHaveLength(4);
    expect(r.missing.join(' ')).toContain('item 19');
    expect(r.missing.join(' ')).toContain('item 18');
    expect(r.missing.join(' ')).toContain('item 17');
    expect(r.missing.join(' ')).toContain('item 1');
  });

  // A rights advisement states the offenses. A row with prose and no article
  // is mid-entry, not a charge.
  it('ignores an offense row with no article selected', () => {
    const r = rightsElectionReadiness({
      ...complete,
      offenses: [{ articleLabel: '', summary: 'Something happened.' }],
    } as unknown as FormData);
    expect(r.ready).toBe(false);
    expect(chargedOffenses({ ...complete, offenses: [{ articleLabel: '', summary: 'x' }] } as unknown as FormData))
      .toEqual([]);
  });
});

describe('the vessel exception is read from its own field', () => {
  // The whole reason the field exists. The advisement is served BEFORE the
  // accused elects anything, so status cannot come from the election.
  it('applies with no demand recorded at all', () => {
    expect(vesselExceptionApplies({ ...complete, vesselException: true } as FormData)).toBe(true);
    expect(buildRightsCase({ ...complete, vesselException: true } as FormData).vesselException).toBe(true);
  });

  it('does not apply by default, so a Marine ashore keeps the right to refuse', () => {
    expect(vesselExceptionApplies(complete)).toBe(false);
    expect(buildRightsCase(complete).vesselException).toBe(false);
  });

  it('the explicit field wins over a contradicting demand election', () => {
    const embarkedButElectedAccept = {
      ...complete,
      vesselException: true,
      demand: NAVMC_10132_DEMAND.ACCEPT,
    } as FormData;
    expect(vesselExceptionApplies(embarkedButElectedAccept)).toBe(true);
  });

  // A case saved before the field existed still resolves correctly.
  it('falls back to a recorded vessel election when the field is absent', () => {
    expect(vesselExceptionApplies({ ...complete, demand: NAVMC_10132_DEMAND.VESSEL } as FormData)).toBe(true);
  });
});

describe('buildRightsCase', () => {
  it('carries the accused, the unit, and every charged offense', () => {
    const input = buildRightsCase(complete);
    expect(input.accusedName).toBe('SNUFFY, JOHN A');
    expect(input.unit).toBe('H&S BN, MCB QUANTICO');
    expect(input.offenses).toHaveLength(1);
  });

  it('populates the four new fields: accusedRank, authorityPayGrade, accusedPayGrade, accusedService', () => {
    const input = buildRightsCase({
      ...complete,
      njpAuthorityPayGrade: 'O5',
      accusedPayGrade: 'E3',
      accusedService: 'USMC',
    } as unknown as FormData);
    expect(input.accusedRank).toBe('LCpl');
    expect(input.authorityPayGrade).toBe('O5');
    expect(input.accusedPayGrade).toBe('E3');
    expect(input.accusedService).toBe('USMC');
  });

  it('throws with the missing list rather than rendering a partial advisement', () => {
    expect(() => buildRightsCase({ documentType: 'navmc10132' } as FormData))
      .toThrow(NjpPackageError);
  });

  it('throws naming the rank specifically when only item 19 is missing', () => {
    expect(() => buildRightsCase({ ...complete, accusedRankGrade: '' } as FormData)).toThrow(
      /accused's rank \(item 19\)/,
    );
  });

  // The type carries no finding and no punishment. This asserts the data
  // does not sneak in through a spread.
  it('carries no finding and no punishment', () => {
    const input = buildRightsCase({
      ...complete,
      offenses: [{ articleLabel: 'Art. 86  Absence without leave', summary: 'UA.', finding: 'Guilty' }],
      punishments: [{ code: 'N09', days: '10' }],
    } as unknown as FormData);
    expect(JSON.stringify(input)).not.toContain('Guilty');
    expect(JSON.stringify(input)).not.toContain('N09');
  });
});

describe('accusedRankAbbreviation', () => {
  it('takes the rank alone off the composed item 19 "RANK, GRADE" string', () => {
    expect(accusedRankAbbreviation({ accusedRankGrade: 'LCpl, E3' } as unknown as FormData)).toBe('LCpl');
  });

  it('is empty when item 19 is not set', () => {
    expect(accusedRankAbbreviation({} as FormData)).toBe('');
    expect(accusedRankAbbreviation({ accusedRankGrade: '' } as unknown as FormData)).toBe('');
  });

  it('is safe against a value with no comma, e.g. a Navy rating with no pay grade appended', () => {
    expect(accusedRankAbbreviation({ accusedRankGrade: 'LCpl' } as unknown as FormData)).toBe('LCpl');
  });
});

describe('maximumPunishmentStatus', () => {
  const base = {
    ...complete,
    njpAuthorityPayGrade: 'O5',
    accusedPayGrade: 'E3',
    accusedService: 'USMC',
  } as unknown as FormData;

  it('the vessel case: no ceiling, because A-1-c carries no refusal right to advise on', () => {
    const status = maximumPunishmentStatus({ ...base, vesselException: true } as FormData);
    expect(status.level).toBeNull();
    expect(status.detail).toContain('A-1-c states no maximum punishment');
    expect(status.notes).toEqual([]);
  });

  it('the unset-grade case: advisory, tells the clerk to set item 8A', () => {
    const status = maximumPunishmentStatus({
      ...base,
      vesselException: false,
      njpAuthorityPayGrade: '',
    } as FormData);
    expect(status.level).toBeNull();
    expect(status.detail).toContain('Set the NJP authority pay grade (item 8A)');
  });

  it('the unreadable-grade case: names the bad value and how to fix it', () => {
    const status = maximumPunishmentStatus({
      ...base,
      vesselException: false,
      njpAuthorityPayGrade: 'LtCol',
    } as FormData);
    expect(status.level).toBeNull();
    expect(status.detail).toContain('"LtCol"');
    expect(status.detail).toContain('O1 through O10');
  });

  it('the field-grade case: resolves the level and names the pay grade in the detail', () => {
    const status = maximumPunishmentStatus({
      ...base,
      vesselException: false,
      njpAuthorityPayGrade: 'O5',
    } as FormData);
    expect(status.level).toBe('field-grade');
    expect(status.detail).toContain('Field grade');
    expect(status.detail).toContain('O5');
    expect(status.notes).toEqual([]);
  });

  it('surfaces the USMC reduction-bar note through the field-grade case', () => {
    const status = maximumPunishmentStatus({
      ...base,
      vesselException: false,
      njpAuthorityPayGrade: 'O5',
      accusedPayGrade: 'E6',
      accusedService: 'USMC',
    } as FormData);
    expect(status.level).toBe('field-grade');
    expect(status.notes.some((n) => n.includes('MCO 5800.16 Vol 14 para 010302.C'))).toBe(true);
  });
});

describe('renderRightsElection: the PDF caption and the filename include the rank', () => {
  const formData = {
    ...complete,
    njpAuthorityPayGrade: 'O5',
    accusedPayGrade: 'E3',
    accusedService: 'USMC',
    vesselException: false,
  } as unknown as FormData;

  it('the filename slug includes the rank ahead of the name', async () => {
    const doc = await renderRightsElection(formData);
    expect(doc.filename).toBe('A-1-d-rights-election-lcpl-snuffy-john-a.pdf');
  });

  it('a different rank on an otherwise identical case produces a different filename', async () => {
    const doc = await renderRightsElection({ ...formData, accusedRankGrade: 'Sgt, E5' } as FormData);
    expect(doc.filename).toBe('A-1-d-rights-election-sgt-snuffy-john-a.pdf');
  });

  // The caption text itself is drawn into a PDF content stream, which
  // pdf-lib Flate-compresses and hex-encodes - not greppable as plain text
  // in the raw bytes. Inflate every content stream and hex-decode every
  // Tj string literal to recover what was actually drawn, so this checks
  // the real rendered caption rather than trusting the source unread.
  function drawnStrings(bytes: Uint8Array): string {
    const raw = Buffer.from(bytes).toString('latin1');
    const streamRe = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
    const hexRe = /<([0-9A-Fa-f]+)>\s*Tj/g;
    let out = '';
    let m: RegExpExecArray | null;
    while ((m = streamRe.exec(raw)) !== null) {
      let inflated: string;
      try {
        inflated = zlib.inflateSync(Buffer.from(m[1], 'latin1')).toString('latin1');
      } catch {
        continue;
      }
      let h: RegExpExecArray | null;
      while ((h = hexRe.exec(inflated)) !== null) {
        out += Buffer.from(h[1], 'hex').toString('latin1') + '\n';
      }
    }
    return out;
  }

  it('the rendered PDF caption line reads "LCpl SNUFFY, JOHN A", rank before name', async () => {
    const doc = await renderRightsElection(formData);
    const drawn = drawnStrings(doc.bytes);
    expect(drawn).toContain('LCpl SNUFFY, JOHN A');
  });
});
