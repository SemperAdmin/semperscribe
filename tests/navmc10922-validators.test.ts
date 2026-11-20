/**
 * NAVMC 10922 validator suite - Phase 3 gate of
 * docs/NAVMC_10922_BUILD_PLAN.md. Table-driven from
 * tests/navmc10922-cases.ts (shared with the sandbox esbuild harness).
 */

import { describe, it, expect } from 'vitest';
import { runNavmc10922Validators } from '@/lib/navmc10922-validators';
import { baseline, CASES, NOW } from './navmc10922-cases';

describe('runNavmc10922Validators', () => {
  for (const c of CASES) {
    it(c.name, () => {
      const data = baseline();
      c.mutate(data);
      const issues = runNavmc10922Validators(data, NOW);

      if (c.expectId === 'ANY-BLOCK') {
        const blockers = issues.filter((i) => i.severity === 'block');
        expect(blockers, JSON.stringify(blockers, null, 2)).toHaveLength(0);
        return;
      }

      const hit = issues.find((i) => i.id === c.expectId);
      if (c.absent) {
        expect(hit, `expected ${c.expectId} to be absent, got ${JSON.stringify(hit)}`).toBeUndefined();
      } else {
        expect(hit, `expected ${c.expectId} in ${JSON.stringify(issues.map((i) => i.id))}`).toBeDefined();
        expect(hit!.severity).toBe(c.severity);
        expect(hit!.citation.length).toBeGreaterThan(0);
      }
    });
  }

  it('every issue id is namespaced and cited', () => {
    // Worst-case document: trip as many rules at once as possible.
    const data = baseline();
    data.reason = 'loss';
    data.documentsViewed = '';
    data.attestingOfficerName = '';
    data.memberPrevMarried = 'yes';
    data.courtOrderInEffect = 'yes';
    data.naturalParentArmedForces = 'yes';
    data.spouseArmedForces = 'yes';
    const issues = runNavmc10922Validators(data, NOW);
    expect(issues.length).toBeGreaterThan(5);
    for (const i of issues) {
      expect(i.id.startsWith('navmc10922-')).toBe(true);
      expect(i.citation.trim().length).toBeGreaterThan(0);
      expect(['block', 'fail', 'warn']).toContain(i.severity);
    }
  });
});

describe('self-attestation with grade and title present', () => {
  it('still blocks when the officer name matches the member', () => {
    const data = baseline();
    data.attestingOfficerName = String(data.nameOfMarine);
    data.attestingOfficerGrade = 'SSgt';
    data.attestingOfficerTitle = 'Admin Chief';
    const hit = runNavmc10922Validators(data, NOW).find((i) => i.id === 'navmc10922-self-attestation');
    expect(hit?.severity).toBe('block');
  });

  it('warns when unnamed even if grade and title are set', () => {
    const data = baseline();
    data.attestingOfficerName = '';
    data.attestingOfficerGrade = 'SSgt';
    data.attestingOfficerTitle = 'Admin Chief';
    const hit = runNavmc10922Validators(data, NOW).find((i) => i.id === 'navmc10922-attesting-unverified');
    expect(hit?.severity).toBe('warn');
  });
});

describe('Navmc10922Schema attesting official fields', () => {
  it('accepts grade and title alongside the name', async () => {
    const { Navmc10922Schema } = await import('@/lib/schemas');
    const shape = Navmc10922Schema.shape as Record<string, unknown>;
    expect(shape.attestingOfficerGrade).toBeDefined();
    expect(shape.attestingOfficerTitle).toBeDefined();
    const r = Navmc10922Schema.safeParse({
      ...baseline(),
      attestingOfficerName: 'DOE, JANE A',
      attestingOfficerGrade: 'SSgt',
      attestingOfficerTitle: 'Admin Chief',
    });
    if (r.success) {
      expect(r.data.attestingOfficerGrade).toBe('SSgt');
      expect(r.data.attestingOfficerTitle).toBe('Admin Chief');
    } else {
      const paths = r.error.issues.map((i) => i.path.join('.'));
      expect(paths).not.toContain('attestingOfficerGrade');
      expect(paths).not.toContain('attestingOfficerTitle');
    }
  });
});
