/**
 * Host report 2026-11-11: the NAVMC 10922 and 11106 templates carried
 * real-looking names and real unit addresses (a battalion, its RUC and
 * PSC box), and the NAVMC 10132 Unit Punishment Book samples paired
 * realistic accused names with real battalions. Templates ship to every
 * user and appear in training videos, so every person and unit on the
 * personal forms now reads as a sample. This holds them there.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const PERSONAL_FORMS = new Set(['navmc10922', 'navmc11106', 'navmc10132', 'dd368', 'aa-form']);
// Sample values, or the fill-in placeholders the AA templates carry.
const SAMPLE_PERSON = /SAMPLE|FORMER|MAIDEN|RECRUITER|SAME AS ABOVE|Rank First MI/i;
const SAMPLE_UNIT = /SAMPLE|TRAINING DEMO|SAME AS ABOVE|Unit Name|HOME (COMMAND )?ADDRESS/i;
const PERSON_KEY = /(^|[a-z])(name|Name)$|SpouseName$|^sig$|^from$/;
// The To line names an office (CMC, a commanding general), not a person
// or a unit's street address, so it is not checked.
const UNIT_KEY = /^(unit|orgStation|organizationStation|dutyStation|dd368CurrentUnit|coNameGradeActivity|address)$/;

function files(): { file: string; formData: Record<string, unknown> }[] {
  const out: { file: string; formData: Record<string, unknown> }[] = [];
  for (const dir of ['public/templates/global', 'public/templates/navmc10132']) {
    for (const name of readdirSync(dir)) {
      if (!/\.(nldp|json)$/.test(name) || name === 'index.json') continue;
      const parsed = JSON.parse(readFileSync(join(dir, name), 'utf8'));
      const formData = parsed?.data?.formData ?? parsed?.formData ?? parsed;
      if (PERSONAL_FORMS.has(formData?.documentType)) out.push({ file: `${dir}/${name}`, formData });
    }
  }
  return out;
}

function offenders(formData: Record<string, unknown>): string[] {
  const bad: string[] = [];
  const walk = (o: unknown, key: string) => {
    if (Array.isArray(o)) return o.forEach((v) => walk(v, key));
    if (o && typeof o === 'object') return Object.entries(o).forEach(([k, v]) => walk(v, k));
    if (typeof o !== 'string' || !o.trim() || key === 'documentType') return;
    if (PERSON_KEY.test(key) && !SAMPLE_PERSON.test(o)) bad.push(`${key}: ${o}`);
    if (UNIT_KEY.test(key) && !SAMPLE_UNIT.test(o)) bad.push(`${key}: ${o}`);
  };
  walk(formData, '');
  return bad;
}

describe('personal-form templates use sample identities', () => {
  const all = files();
  it('finds the personal-form templates', () => {
    expect(all.length).toBeGreaterThanOrEqual(25);
  });
  it.each(all.map((f) => [f.file, f.formData] as const))('%s', (_file, formData) => {
    expect(offenders(formData)).toEqual([]);
  });
});
