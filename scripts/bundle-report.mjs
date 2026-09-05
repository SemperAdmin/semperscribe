#!/usr/bin/env node
/**
 * Bundle report for the static export.
 *
 * Splits the JavaScript under out/_next/static into what the app shell
 * references on first load (script tags and preloads in out/index.html)
 * and what loads lazily through dynamic import(). Prints both totals, the
 * largest chunks with an initial or lazy flag, and exits non-zero when a
 * budget passed as an argument is exceeded.
 *
 * Usage:
 *   node scripts/bundle-report.mjs                      # report only
 *   node scripts/bundle-report.mjs --initial-budget=3670016 --total-budget=12288000
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = 'out';
const indexPath = join(root, 'index.html');
if (!existsSync(indexPath)) {
  console.error('[bundle-report] out/index.html not found. Run `npm run build` first.');
  process.exit(1);
}

const args = Object.fromEntries(
  process.argv.slice(2).filter(a => a.startsWith('--')).map(a => {
    const [k, v] = a.slice(2).split('=');
    return [k, v === undefined ? true : Number(v)];
  }),
);

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const s = statSync(p);
    if (s.isDirectory()) walk(p, out);
    else if (p.endsWith('.js')) out.push({ path: p, bytes: s.size });
  }
  return out;
}

const all = walk(join(root, '_next', 'static'));
const html = readFileSync(indexPath, 'utf8');
const referenced = new Set(
  [...html.matchAll(/\/_next\/static\/[^"'\s)]+\.js/g)].map(m => m[0].replace(/^\//, '')),
);
for (const f of all) {
  f.initial = referenced.has(relative(root, f.path).replace(/\\/g, '/'));
}

const total = all.reduce((s, f) => s + f.bytes, 0);
const initial = all.filter(f => f.initial).reduce((s, f) => s + f.bytes, 0);
const fmt = n => `${(n / 1048576).toFixed(2)} MiB (${n.toLocaleString()} B)`;

console.log(`initial-load JS : ${fmt(initial)} across ${all.filter(f => f.initial).length} chunks`);
console.log(`total JS        : ${fmt(total)} across ${all.length} chunks`);
console.log('');
console.log('largest chunks:');
for (const f of [...all].sort((a, b) => b.bytes - a.bytes).slice(0, 12)) {
  console.log(`  ${f.initial ? 'initial' : 'lazy   '}  ${String(f.bytes).padStart(9)}  ${relative(root, f.path)}`);
}

let failed = false;
if (typeof args['initial-budget'] === 'number' && initial > args['initial-budget']) {
  console.error(`::error::initial-load JS ${initial} B exceeds budget ${args['initial-budget']} B`);
  failed = true;
}
if (typeof args['total-budget'] === 'number' && total > args['total-budget']) {
  console.error(`::error::total JS ${total} B exceeds budget ${args['total-budget']} B`);
  failed = true;
}
process.exit(failed ? 1 : 0);
