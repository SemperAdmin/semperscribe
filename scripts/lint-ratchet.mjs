#!/usr/bin/env node
/**
 * Lint ratchet: warning counts only move down.
 *
 * ESLint exits 0 on warnings, so the 52 warnings the repo carried stayed
 * at 52 because nothing stopped 55. This script runs eslint in JSON mode,
 * counts warnings per rule, and compares to .lint-baseline.json. Any rule
 * whose count rose fails the run and prints the offending locations.
 *
 * When a PR lowers a count, update the baseline in the same PR:
 *   node scripts/lint-ratchet.mjs --update
 *
 * Once the baseline reaches zero, add --max-warnings 0 to the lint script
 * and delete this file.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const BASELINE_PATH = '.lint-baseline.json';
const update = process.argv.includes('--update');

let raw;
try {
  raw = execFileSync('npx', ['eslint', '.', '-f', 'json'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
} catch (err) {
  // eslint exits 1 on errors but still prints the JSON report.
  raw = err.stdout?.toString() ?? '';
  if (!raw.trim().startsWith('[')) {
    console.error(err.stderr?.toString() ?? String(err));
    process.exit(1);
  }
}

const report = JSON.parse(raw);
const counts = {};
const locations = {};
let errors = 0;
for (const file of report) {
  for (const m of file.messages) {
    if (m.severity === 2) {
      errors += 1;
      continue;
    }
    const rule = m.ruleId ?? '(no rule)';
    counts[rule] = (counts[rule] ?? 0) + 1;
    (locations[rule] ??= []).push(`${file.filePath.replace(process.cwd() + '/', '')}:${m.line}`);
  }
}
const total = Object.values(counts).reduce((a, b) => a + b, 0);

if (errors > 0) {
  console.error(`[lint-ratchet] ${errors} lint error(s). Fix errors first; the ratchet only tracks warnings.`);
  process.exit(1);
}

if (update || !existsSync(BASELINE_PATH)) {
  const sorted = Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(BASELINE_PATH, JSON.stringify({ total, rules: sorted }, null, 2) + '\n');
  console.log(`[lint-ratchet] baseline written: ${total} warning(s) across ${Object.keys(sorted).length} rule(s).`);
  process.exit(0);
}

const baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
let failed = false;
const rules = new Set([...Object.keys(baseline.rules), ...Object.keys(counts)]);
for (const rule of [...rules].sort()) {
  const before = baseline.rules[rule] ?? 0;
  const now = counts[rule] ?? 0;
  const delta = now - before;
  const mark = delta > 0 ? 'UP  ' : delta < 0 ? 'down' : '    ';
  console.log(`${mark} ${String(now).padStart(3)} (baseline ${String(before).padStart(3)})  ${rule}`);
  if (delta > 0) {
    failed = true;
    for (const loc of locations[rule] ?? []) {
      console.log(`         ${loc}`);
    }
  }
}
console.log(`[lint-ratchet] total ${total} (baseline ${baseline.total})`);

if (failed) {
  console.error('[lint-ratchet] a warning count rose above the baseline. Fix the new warning, or if it is a deliberate trade, run `node scripts/lint-ratchet.mjs --update` and explain in the PR.');
  process.exit(1);
}
if (total < baseline.total) {
  console.log('[lint-ratchet] count fell. Run `node scripts/lint-ratchet.mjs --update` and commit .lint-baseline.json so the floor moves with you.');
}
