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

  // Hardened 2026-10-21 (security review item 5). A job holding a
  // repository or environment secret is the one a package script or a
  // branch dispatch would aim at, so it runs on main only, inside an
  // environment whose rules the owner sets, and runs nothing from npm.
  const secretJobs = workflows.flatMap(({ name, text }) => {
    const jobsBlock = text.slice(text.indexOf('\njobs:'));
    const heads = [...jobsBlock.matchAll(/^  ([A-Za-z0-9_-]+):\s*$/gm)];
    return heads
      .map((h, i) => ({ name, job: h[1], body: jobsBlock.slice(h.index, heads[i + 1]?.index ?? jobsBlock.length) }))
      .filter(j => /secrets\.(?!GITHUB_TOKEN\b)/.test(j.body));
  });

  it('name the secret-holding jobs this suite expects', () => {
    expect(secretJobs.map(j => `${j.name}:${j.job}`).sort()).toEqual(['deploy-cloudgov.yml:deploy', 'mirror-to-gitlab.yml:mirror']);
  });

  it('run a secret-holding job on main (or a tag) only, inside an environment', () => {
    for (const { name, job, body } of secretJobs) {
      expect(body, `${name}: ${job} needs a ref guard`).toMatch(/^    if:[\s\S]*?github\.ref == 'refs\/heads\/main'/m);
      expect(body, `${name}: ${job} needs an environment`).toMatch(/^    environment:/m);
    }
  });

  it('run nothing from npm, and check nothing out, in a job holding a credential', () => {
    for (const { name, job, body } of secretJobs) {
      expect(body, `${name}: ${job} runs npm`).not.toMatch(/\b(npm|npx|yarn|pnpm)\s/);
      expect(body, `${name}: ${job} checks the repository out`).not.toMatch(/actions\/checkout/);
    }
  });

  // GitHub refuses a workflow file whole when an expression names a
  // context its position cannot see, and the refusal shows only as a
  // failed run with no job (deploy-cloudgov run #7, 2026-10-21:
  // `runner.temp` in a job-level env). A workflow-level or job-level
  // `env:` block may read github, needs, strategy, matrix, vars,
  // secrets and inputs; `runner`, `steps`, `job` and `env` belong to
  // steps.
  it('reference only step-visible contexts inside step blocks', () => {
    const stepOnly = /\$\{\{[^}]*\b(runner|steps|job|env)\./;
    for (const { name, text } of workflows) {
      const lines = text.split('\n');
      let envIndent: number | null = null;
      lines.forEach((line, i) => {
        const indent = line.search(/\S/);
        if (envIndent !== null && indent !== -1 && indent <= envIndent) envIndent = null;
        if (envIndent === null && /^(|    )env:\s*$/.test(line)) { envIndent = indent; return; }
        if (envIndent !== null) {
          expect(line, `${name}:${i + 1} job/workflow env reads a step-only context`).not.toMatch(stepOnly);
        }
      });
    }
  });

  it('never use pull_request_target', () => {
    for (const { name, text } of workflows) {
      expect(text, name).not.toMatch(/pull_request_target/);
    }
  });
});
