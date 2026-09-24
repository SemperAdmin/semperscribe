/**
 * Probe for the golden suite's coordinate extractor prerequisites.
 *
 * The volume golden tests measure rendered PDFs by shelling out to
 * `python tests/golden/volume/measure-pdf.py`, which needs the `pypdf`
 * package. Machines without python+pypdf (or CI runners that skipped the
 * install step) should SKIP those describes rather than crash every test
 * with a ModuleNotFoundError — the same graceful-degradation contract the
 * real-PDF comparison block already has via its existsSync guard.
 *
 * CI installs pypdf in .github/workflows/test.yml so the assertions do run
 * there; this probe is the safety net, not the expected path.
 */
import { execFileSync } from 'node:child_process';

let cached: boolean | undefined;

export function hasPypdf(): boolean {
  if (cached === undefined) {
    try {
      execFileSync('python', ['-c', 'import pypdf'], { stdio: 'ignore' });
      cached = true;
    } catch {
      cached = false;
    }
  }
  return cached;
}
