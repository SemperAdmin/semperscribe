// tests/golden/volume/fidelity.test.ts
import { describe, it, expect } from 'vitest';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { VolumeSchema } from '@/lib/schemas/volume-schema';
import { generateVolumePdf } from '@/services/pdf/volumeGenerator';

interface MeasuredRow {
  page: number;
  x: number;
  y: number;
  size: number;
  text: string;
}

async function coords(fixture: string): Promise<MeasuredRow[]> {
  const doc = VolumeSchema.parse(JSON.parse(readFileSync(join(__dirname, 'fixtures', fixture), 'utf8')));
  const blob = await generateVolumePdf(doc);
  const dir = mkdtempSync(join(tmpdir(), 'vol-'));
  const pdf = join(dir, 'v.pdf');
  writeFileSync(pdf, Buffer.from(await blob.arrayBuffer()));
  // NOTE: the brief's original text names `measure-pdf.mjs` executed via
  // python -- that combination doesn't exist. The actual measurement helper
  // is the python/pypdf script `measure-pdf.py` already used by the other
  // golden volume tests (see geometry.test.ts); use that here too.
  const out = execFileSync('python', [join(__dirname, 'measure-pdf.py'), pdf]).toString();
  return JSON.parse(out) as MeasuredRow[];
}

describe('volume fidelity', () => {
  it('vol6 single-chapter: sequential footer, section at x=72', async () => {
    const rows = await coords('vol6.json');
    expect(rows.find(r => r.text.startsWith('0101'))?.x).toBeCloseTo(72, 0);
    // a footer that is a bare number
    expect(rows.some(r => r.y < 45 && /^\d+$/.test(r.text.trim()))).toBe(true);
  });
  it('vol16 multi-chapter: ladder columns 72/108/144/180 present', async () => {
    const rows = await coords('vol16.json');
    const xs = new Set(rows.map(r => Math.round(r.x)));
    expect([72, 108, 144, 180].every(x => [...xs].some(v => Math.abs(v - x) <= 1))).toBe(true);
  });
});
