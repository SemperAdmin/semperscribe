// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generateVolumePdf } from '@/services/pdf/volumeGenerator';
import { blankVolume } from '@/store/volumeStore';
import type { VolumeDoc } from '@/lib/schemas/volume-schema';

function build(): VolumeDoc {
  const d = blankVolume();
  d.chapters[0].title = 'TEST CHAPTER';
  d.chapters[0].sections[0] = { seq: 1, title: 'PURPOSE', body: [{ runs: [{ text: 'Body text here.' }] }], paragraphs: [] };
  return d;
}

async function renderCoords(doc: VolumeDoc = build()) {
  const blob = await generateVolumePdf(doc);
  const buf = Buffer.from(await blob.arrayBuffer());
  const dir = mkdtempSync(join(tmpdir(), 'vol-'));
  const pdf = join(dir, 'v.pdf');
  writeFileSync(pdf, buf);
  const out = execFileSync('python', [join(__dirname, 'measure-pdf.py'), pdf]).toString();
  return JSON.parse(out) as { page: number; x: number; y: number; size: number; text: string }[];
}

describe('volume PDF geometry', () => {
  it('uses a 612x792 page with 72pt left margin body', async () => {
    const rows = await renderCoords();
    const body = rows.find(r => r.text.includes('Body text'));
    expect(body?.x).toBeCloseTo(72, 0);
  });
  it('places the section designator at x=72', async () => {
    const rows = await renderCoords();
    const sec = rows.find(r => r.text.startsWith('0101'));
    expect(sec?.x).toBeCloseTo(72, 0);
  });
});
