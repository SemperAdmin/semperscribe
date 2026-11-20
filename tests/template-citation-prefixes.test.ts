// @vitest-environment node
/**
 * Reference and enclosure entries must not carry their own citation
 * prefix. The renderers add "(a)", "(b)" / "(1)", "(2)" themselves
 * (refLetterAt and the enclosure label in NavalLetterPDF.tsx), so a
 * template that stores "(a) MCO 1553.3B" prints "Ref: (a) (a) MCO 1553.3B".
 *
 * Covers every code template and every .nldp under public/templates.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

import { DOCUMENT_TEMPLATES, PUBLISHED_TEMPLATES, VolumeMultiChapterTemplate } from '@/lib/templates';
import * as templateExports from '@/lib/templates';

// Paragraph bodies may open with "Reference (a) directs...", so only the
// numbering shapes count there.
const PARAGRAPH_NUMBER = /^\s*(\(([a-z]{1,2}|\d{1,2})\)|[a-z]\.\s|\d{1,2}\.\s)/i;

/** Paragraphs that hand-type a number the app also prints, or use a level below 1. */
function paragraphOffenders(list: unknown): string[] {
  if (!Array.isArray(list)) return [];
  return list
    .filter((p): p is { level: number; content: string } => !!p && typeof p === 'object')
    .filter((p) => p.level < 1 || (typeof p.content === 'string' && PARAGRAPH_NUMBER.test(p.content)))
    .map((p) => `L${p.level}: ${String(p.content).slice(0, 40)}`);
}

const CITATION_PREFIX = /^\s*(\(([a-z]{1,2}|\d{1,2})\)|[a-z]\.\s|\d{1,2}\.\s|(ref|reference|encl|enclosure)\b)/i;

function offenders(list: unknown): string[] {
  if (!Array.isArray(list)) return [];
  return list
    .map((x) => (typeof x === 'string' ? x : (x as { text?: string; title?: string } | null)?.text ?? (x as { title?: string } | null)?.title))
    .filter((s): s is string => typeof s === 'string' && CITATION_PREFIX.test(s));
}

function collectCodeTemplates(): Array<[string, unknown]> {
  const seen = new Map<string, unknown>();
  const add = (k: string, v: unknown) => { if (v && typeof v === 'object') seen.set(k, v); };
  Object.entries(DOCUMENT_TEMPLATES).forEach(([k, v]) => add(`DOCUMENT_TEMPLATES.${k}`, v));
  Object.entries(PUBLISHED_TEMPLATES).forEach(([k, v]) => add(`PUBLISHED_TEMPLATES.${k}`, v));
  add('VolumeMultiChapterTemplate', VolumeMultiChapterTemplate);
  // Any other exported template object (e.g. MCOFormatGuideTemplate).
  Object.entries(templateExports).forEach(([k, v]) => {
    if (k.endsWith('Template') && v && typeof v === 'object' && 'defaultData' in (v as object)) add(`export.${k}`, v);
  });
  return [...seen.entries()];
}

function nldpFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return nldpFiles(p);
    return name.endsWith('.nldp') ? [p] : [];
  });
}

describe('templates carry no hand-typed citation or paragraph numbers', () => {
  it('the scanner regex recognises the known bad shapes', () => {
    for (const bad of ['(a) MCO', '(1) Plan', 'a. MCO', '1. Plan', 'Enclosure (1) – SOP', 'Encl (1) SOP', 'Ref (a) MCO']) {
      expect(CITATION_PREFIX.test(bad), bad).toBe(true);
    }
    for (const ok of ['MCO 1553.3B', 'I MEF FY26 Training Plan', 'Unit SOP', '[Appropriate reference directing assumption of command]']) {
      expect(CITATION_PREFIX.test(ok), ok).toBe(false);
    }
  });

  it.each(collectCodeTemplates())('%s (code)', (_name, tpl) => {
    const t = tpl as { defaultData?: { references?: unknown; enclosures?: unknown; paragraphs?: unknown }; formData?: unknown };
    const d = t.defaultData ?? {};
    expect(offenders(d.references), 'references').toEqual([]);
    expect(offenders(d.enclosures), 'enclosures').toEqual([]);
    expect(paragraphOffenders(d.paragraphs), 'paragraphs').toEqual([]);
  });

  const files = nldpFiles(join(__dirname, '..', 'public', 'templates'));
  it('finds the published .nldp files', () => {
    expect(files.length).toBeGreaterThan(0);
  });
  it.each(files.map((f) => [f.slice(f.indexOf('public/templates')), f]))('%s', (_rel, file) => {
    const json = JSON.parse(readFileSync(file, 'utf-8')) as { data?: { references?: unknown; enclosures?: unknown; paragraphs?: unknown } };
    expect(offenders(json.data?.references), 'references').toEqual([]);
    expect(offenders(json.data?.enclosures), 'enclosures').toEqual([]);
    expect(paragraphOffenders(json.data?.paragraphs), 'paragraphs').toEqual([]);
  });
});
