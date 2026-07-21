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
