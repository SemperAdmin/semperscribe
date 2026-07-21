/**
 * NAVMC 10922 positional XFA export - Phase 6 gate of
 * docs/NAVMC_10922_BUILD_PLAN.md.
 *
 * The form's datasets nodes are non-unique (77x ParticipantName,
 * 17x RadioButtonList), so the fill is positional. These tests guard
 * the two things that can silently rot:
 *   1. the emitter's node order against the generated map
 *      (tools/aa-forms/navmc10922-map.json, derived from template.xml
 *      and verified against the shipped datasets stream), and
 *   2. the full round-trip through fillXfaDatasets on the REAL blank -
 *      every one of the 102 nodes re-read by position.
 * Adobe rendering itself was gated by hand (Phase 4 sample).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { PDFDocument, PDFName, PDFDict, PDFArray, PDFString, PDFHexString, PDFRawStream, decodePDFRawStream } from 'pdf-lib';
import { buildNavmc10922Xml, NAVMC10922_NODE_SEQUENCE } from '@/lib/navmc10922-xfa';
import { fillXfaDatasets, officialFormPath } from '@/lib/xfa-form-fill';
import { baseline } from './navmc10922-cases';
import type { FormData } from '@/types';
import map from '../tools/aa-forms/navmc10922-map.json';

const BLANK = join(__dirname, '..', 'public', 'forms', 'navmc-10922-blank.pdf');

async function readDatasets(bytes: Uint8Array): Promise<string> {
  const doc = await PDFDocument.load(bytes);
  const acroForm = doc.catalog.lookup(PDFName.of('AcroForm'), PDFDict);
  const xfa = acroForm.lookup(PDFName.of('XFA')) as PDFArray;
  for (let i = 0; i < xfa.size() - 1; i += 2) {
    const name = xfa.get(i);
    const text = name instanceof PDFString || name instanceof PDFHexString ? name.decodeText() : '';
    if (text === 'datasets') {
      const stream = xfa.lookup(i + 1) as PDFRawStream;
      return new TextDecoder().decode(decodePDFRawStream(stream).decode());
    }
  }
  throw new Error('datasets not found');
}

/** Positional (name, value) pairs - both self-closing and valued nodes. */
function parseNodes(ds: string): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  const re = /<([A-Za-z]+)(?:\s*\/>|>([\s\S]*?)<\/\1>)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(ds)) !== null) {
    if (m[1] === 'form1') continue; // container, not a node
    out.push([m[1], m[2] ?? '']);
  }
  return out;
}

/** A GAIN sample touching every section - matches the Phase 4 gate PDF. */
function sample(): FormData {
  const d = baseline();
  d.memberPrevMarried = 'yes';
  d.memberPrevMarriedTimes = '1';
  d.dissolutions[0] = {
    formerMarriageOf: 'self', spouseName: 'PRIOR P SPOUSE',
    dateOfDissolution: '2019-03-15', placeOfDissolution: 'WASHOE COUNTY NV', reason: 'divorce',
  };
  d.dependents[1] = {
    name: 'JILL ELISE MARINE', address: 'SAME AS ABOVE', relationship: 'STEPDAUGHTER',
    dateOfBirth: '2015-08-06', allowanceClaimedFrom: '2026-06-20',
  };
  d.organizationStation = '1ST BN 6TH MARINES 2D MARDIV\nCAMP LEJEUNE NC 28547';
  d.swornDay = '20'; d.swornMonth = 'July'; d.swornYear2Digit = '26';
  d.ecc = '2027-06-13';
  return d;
}

describe('emitter node order', () => {
  it('matches the generated map exactly, 102 of 102', () => {
    const expected = (map.nodes as Array<{ node: string }>).map((n) => n.node);
    expect(NAVMC10922_NODE_SEQUENCE.length).toBe(102);
    expect([...NAVMC10922_NODE_SEQUENCE]).toEqual(expected);
  });
});

describe('XML builder', () => {
  it('escapes metacharacters and converts newlines to CR entities', () => {
    const d = sample();
    d.documentsViewed = 'CERT <A> & DECREE';
    const xml = buildNavmc10922Xml(d);
    expect(xml).toContain('CERT &lt;A&gt; &amp; DECREE');
    expect(xml).toContain('1ST BN 6TH MARINES 2D MARDIV&#xD;CAMP LEJEUNE NC 28547');
  });

  it('formats dates per the template picture clauses', () => {
    const xml = buildNavmc10922Xml(sample());
    expect(xml).toContain('Jul 1, 2026'); // index 0: MMM D, YYYY
    expect(xml).toContain('6/20/26'); // M/D/YY grid dates
    expect(xml).toContain('3/15/19');
  });

  it('leaves index 1 empty for START - the checkbox is unbindable', () => {
    const d = sample();
    d.reason = 'start';
    const nodes = parseNodes(buildNavmc10922Xml(d));
    expect(nodes[1]).toEqual(['RadioButtonList', '']);
  });
});

describe('fillXfaDatasets round-trip on the real blank', () => {
  it('all 102 nodes land in shipped order with correct values', async () => {
    const base = readFileSync(BLANK);
    const out = await fillXfaDatasets(base, buildNavmc10922Xml(sample()));
    const nodes = parseNodes(await readDatasets(out));

    expect(nodes.length).toBe(102);
    const expectedNames = (map.nodes as Array<{ node: string }>).map((n) => n.node);
    expect(nodes.map(([n]) => n)).toEqual(expectedNames);

    // Positional value spots across every section (indices are map
    // indices; see docs/NAVMC_10922_SPEC.md section 3).
    const spots: Record<number, string> = {
      0: 'Jul 1, 2026',            // date of application
      1: '3',                      // GAIN
      2: '1234567890',             // EDIPI
      5: 'SGT',                    // grade
      7: '6/13/27',                // ECC
      10: '2',                     // USMC
      11: 'TONYA CAROL MARINE',    // dep 1 name
      13: 'SPOUSE',
      14: '7/7/97',                // dep 1 DOB
      16: 'JILL ELISE MARINE',     // dep 2 name
      18: 'STEPDAUGHTER',
      45: '2',                     // spouse prev married NO
      47: '1',                     // member prev married YES
      48: '1',
      49: 'TONYA CAROL GRAY',
      51: '6/20/26',               // marriage date
      52: '2',                     // former marriage of SELF
      53: '3',                     // reason DIVORCE
      54: 'PRIOR P SPOUSE',
      56: '3/15/19',
      72: '2',                     // court order NO
      75: '2',                     // section 5 NO
      76: '2',                     // section 6 NO
      83: 'July',
      85: '20',
      93: 'MARRIAGE CERTIFICATE',
      94: 'MARINE, ALONZO DEAN',   // global NameOfMarine
      96: '1234567890',            // Section 7 EDIPI repeats Section 1
      97: 'SGT',
    };
    for (const [idx, value] of Object.entries(spots)) {
      expect(nodes[Number(idx)][1], `index ${idx}`).toBe(value);
    }

    // Section 8, unit diary, and every signature widget stay empty.
    for (const idx of [...Array(7).keys()].map((i) => i + 86).concat([95, 98, 99, 100, 101])) {
      expect(nodes[idx][1], `index ${idx} must be empty`).toBe('');
    }
  });

  it('keeps the dynamic-XFA flag so Adobe re-renders', async () => {
    const base = readFileSync(BLANK);
    const out = await fillXfaDatasets(base, buildNavmc10922Xml(sample()));
    const doc = await PDFDocument.load(out);
    expect(String(doc.catalog.lookup(PDFName.of('NeedsRendering')))).toBe('true');
  });
});

describe('routing table', () => {
  it('maps navmc10922 to its bundled blank', () => {
    expect(officialFormPath('navmc10922')).toContain('navmc-10922-blank.pdf');
  });
});
