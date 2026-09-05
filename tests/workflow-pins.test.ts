/**
 * Supply-chain guard on the CI definitions: every third-party action is
 * pinned to a full commit SHA (a tag can be moved; a SHA cannot), the
 * pin carries the version it stands for, and no workflow grants more
 * than it declares. Dependabot's github-actions feed bumps the SHAs.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const dir = join(process.cwd(), '.github', 'workflows');
const workflows = readdirSync(dir).filter(f => f.endsWith('.yml')).map(f => ({ name: f, text: readFileSync(join(dir, f), 'utf8') }));

describe('workflow actions', () => {
  it('pin every third-party action to a commit SHA with its version noted', () => {
    for (const { name, text } of workflows) {
      const uses = [...text.matchAll(/^\s*(?:-\s*)?uses:\s*(\S+)(.*)$/gm)]
        .map(m => ({ ref: m[1], rest: m[2] }))
        .filter(u => !u.ref.startsWith('./'));
      // A workflow of plain shell steps (the GitLab mirror) lists none.
      for (const { ref, rest } of uses) {
        expect(ref, `${name}: ${ref}`).toMatch(/@[0-9a-f]{40}$/);
        expect(rest, `${name}: ${ref} needs a "# vN" comment`).toMatch(/#\s*v\d/);
      }
    }
  });

  it('declare permissions on every workflow, at the top or on every job', () => {
    for (const { name, text } of workflows) {
      if (/^permissions:/m.test(text)) continue;
      // Reusable workflows (test.yml) declare per job so the caller's
      // broader grant is never inherited. Every job must then have one.
      const jobsBlock = text.slice(text.indexOf('\njobs:'));
      const jobs = [...jobsBlock.matchAll(/^  [A-Za-z0-9_-]+:\s*$/gm)].length;
      const perJob = [...jobsBlock.matchAll(/^    permissions:/gm)].length;
      expect(jobs, `${name} has no jobs`).toBeGreaterThan(0);
      expect(perJob, `${name}: ${jobs} job(s), ${perJob} with permissions`).toBe(jobs);
    }
  });

  it('never use pull_request_target', () => {
    for (const { name, text } of workflows) {
      expect(text, name).not.toMatch(/pull_request_target/);
    }
  });
});
