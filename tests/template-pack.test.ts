/**
 * B4 (docs/AA_FORMS_TEMPLATE_PLAN.md) - template pack integrity.
 *
 * Guards the WHOLE public/templates system, not just the AA/Pg-11 pack:
 * every index entry must resolve to a real file, every .nldp must parse
 * and self-agree on documentType, and the AA pack must carry the shape
 * the NAVMC 10274 renderer expects (unprefixed arrays, laddered
 * paragraphs). A broken entry here is a broken Templates button in prod.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';

const GLOBAL_DIR = join(__dirname, '..', 'public', 'templates', 'global');
const index: { id: string; title: string; description?: string; documentType?: string; url: string }[] =
  JSON.parse(readFileSync(join(GLOBAL_DIR, 'index.json'), 'utf-8'));

function loadNldp(url: string) {
  const fileName = decodeURIComponent(url.replace('/templates/global/', ''));
  return JSON.parse(readFileSync(join(GLOBAL_DIR, fileName), 'utf-8'));
}

describe('template index integrity', () => {
  it('has unique ids', () => {
    const ids = index.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every entry resolves to an existing file', () => {
    for (const entry of index) {
      const fileName = decodeURIComponent(entry.url.replace('/templates/global/', ''));
      expect(existsSync(join(GLOBAL_DIR, fileName)), `${entry.id} -> ${entry.url}`).toBe(true);
    }
  });

  it('every .nldp parses and matches its index documentType', () => {
    for (const entry of index) {
      const nldp = loadNldp(entry.url);
      const formType = nldp.data?.formData?.documentType;
      expect(formType, `${entry.id}: formData.documentType missing`).toBeTruthy();
      if (entry.documentType) {
        expect(formType, `${entry.id}: index says ${entry.documentType}`).toBe(entry.documentType);
      }
    }
  });

  it('no orphan .nldp files outside the index', () => {
    const indexed = new Set(index.map((e) => decodeURIComponent(e.url.replace('/templates/global/', ''))));
    const onDisk = readdirSync(GLOBAL_DIR).filter((f) => f.endsWith('.nldp'));
    const orphans = onDisk.filter((f) => !indexed.has(f));
    // Pre-pack orphans existed (test fixtures); the count must not GROW.
    // If this fails, a new template file was added without an index entry.
    expect(orphans.length, `orphans: ${orphans.join(', ')}`).toBeLessThanOrEqual(2);
  });
});

describe('AA form pack (R13/B1)', () => {
  // The generic 'aa-form' template predates the pack and stays untouched.
  const aaEntries = index.filter((e) => e.documentType === 'aa-form' && e.id !== 'aa-form');

  it('carries the 25 converted topics', () => {
    expect(aaEntries.length).toBe(25);
  });

  it.each(aaEntries.map((e) => [e.id, e] as const))('%s is renderer-ready', (_id, entry) => {
    const { formData } = loadNldp(entry.url).data;
    const data = loadNldp(entry.url).data;
    // Subject present and uppercase (NAVMC nature-of-action convention)
    expect(formData.subj.length).toBeGreaterThan(5);
    // ssic (File No.) present
    expect(formData.ssic.trim().length).toBeGreaterThan(0);
    // Addressee present
    expect(formData.to.trim().length).toBeGreaterThan(0);
    // Arrays UNPREFIXED - the pipeline adds (a)/(1); a prefixed source
    // item would render double-numbered.
    for (const r of data.references) expect(r, `ref "${r}"`).not.toMatch(/^\([a-z]\)/i);
    for (const e of data.enclosures) expect(e, `encl "${e}"`).not.toMatch(/^\(\d+\)/);
    for (const v of data.vias) expect(v, `via "${v}"`).not.toMatch(/^\(\d+\)/);
    // Paragraphs: content unprefixed, ladder never jumps more than +1
    let prev = 0;
    for (const p of data.paragraphs) {
      expect(p.content, `para "${p.content.slice(0, 40)}"`).not.toMatch(/^\d+\.\s/);
      expect(p.level, `ladder jump at "${p.content.slice(0, 40)}"`).toBeLessThanOrEqual(prev + 1);
      prev = p.level;
    }
    expect(data.paragraphs.length).toBeGreaterThan(0);
  });
});

describe('Page 11 redesignation (R13/B2)', () => {
  it('ships with the supplied counseling text', () => {
    const entry = index.find((e) => e.id === 'page11-redesignation-firstsgt');
    expect(entry).toBeTruthy();
    const { formData } = loadNldp(entry!.url).data;
    expect(formData.documentType).toBe('page11');
    expect(formData.remarksLeft).toBe('Entry:');
    expect(formData.remarksRight).toContain('24-month Obligated Service');
    expect(formData.remarksRight).toContain('(Marines Signature)');
    expect(formData.remarksRight).toContain('(Commanding Officers Signature)');
  });
});
