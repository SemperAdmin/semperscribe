#!/usr/bin/env node
/**
 * Guards a Next.js static export (out/) against a Windows-only Next
 * 16.3.4 defect: a Windows build writes a nested route's RSC prefetch
 * payload as a DIRECTORY (e.g. out/privacy/__next.privacy/__PAGE__.txt,
 * holding __PAGE__.txt inside it) instead of the FILE the browser
 * actually requests (out/privacy/__next.privacy.__PAGE__.txt). Measured
 * 2026-09-09 against a Windows build of Next 16.3.4: the root-level
 * out/__next.__PAGE__.txt came out correct, but every nested route
 * (privacy, dynamic-forms) came out as a directory. The App Router
 * falls back to a hard navigation when a prefetch 404s, so the defect
 * is invisible while clicking around a local build - it only shows up
 * as failed prefetch requests in the network tab, and on cloud.gov it
 * shipped as a live 404 on every such prefetch. A Linux build (this
 * repo's GitHub Actions runners) does not have the defect.
 *
 * WHERE THIS RUNS: both deploy paths - the "Deploy to cloud.gov" and
 * "Deploy to GitHub Pages" GitHub Actions workflows, and
 * scripts/deploy-cloudgov.ps1's step 6 - never `npm run build` itself.
 * A Windows workstation build is still useful for local development
 * (dev server, typecheck, tests all work fine on it); wiring this
 * check into `build` would turn every such local build red until Next
 * fixes the export writer, for a defect that only matters to a pushed
 * export.
 *
 * Usage: node scripts/check-export.mjs [outDir]   (default: out)
 * Exit 0 when the export is clean, 1 otherwise.
 */
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { pathToFileURL } from 'node:url';

/** Directories never walked for check (c): asset trees, not routes. */
const SKIP_DIR_NAMES = new Set(['_next', 'nginx']);

function isSkippedDirName(name) {
  return SKIP_DIR_NAMES.has(name) || name.startsWith('.');
}

/** Check (a): out/index.html exists and is a file. */
function checkIndexHtml(outDir) {
  const indexPath = join(outDir, 'index.html');
  if (!existsSync(indexPath) || !statSync(indexPath).isFile()) {
    return {
      ok: false,
      problems: [`${indexPath} is missing - run the build first (\`npm run build\`).`],
    };
  }
  return { ok: true, problems: [] };
}

/**
 * Walks every directory under outDir with no exclusions ("skip
 * nothing"), so check (b) can catch the defect anywhere it lands.
 */
function walkAllDirs(dir, out) {
  out.push(dir);
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (entry.isDirectory()) walkAllDirs(join(dir, entry.name), out);
  }
  return out;
}

/** Check (b): no directory anywhere under outDir named like an RSC payload. */
function checkNoPayloadDirectories(outDir) {
  if (!existsSync(outDir)) return { ok: true, problems: [] };
  const dirs = walkAllDirs(outDir, []);
  const problems = [];
  for (const dir of dirs) {
    if (dir === outDir) continue;
    const name = basename(dir);
    if (!name.startsWith('__next.')) continue;
    const expectedFile = join(dirname(dir), `${name}.__PAGE__.txt`);
    problems.push(
      `RSC prefetch payload written as a directory: ${dir} - this is the Windows Next ` +
        `16.3.4 defect measured 2026-09-09. The browser requests the file ${expectedFile} ` +
        'instead. Build this export on Linux (the "Deploy to cloud.gov" workflow) instead.',
    );
  }
  return { ok: problems.length === 0, problems };
}

/**
 * Finds every prefetchable route directory under outDir: a directory
 * holding index.txt, the RSC document payload the export writes beside
 * index.html for every App Router route (measured on a Linux build of
 * Next 16.3.4: /, /privacy, /dynamic-forms and /_not-found have it,
 * the 404/ alias page does not, and only routes with it get a
 * __PAGE__ prefetch file). _next and nginx are asset trees, never
 * routes, and large enough that walking them is wasted work. Root
 * (outDir itself) counts, with an empty segments array.
 */
function findRouteDirs(outDir) {
  const routeDirs = [];
  function recurse(dirPath, segments) {
    let entries;
    try {
      entries = readdirSync(dirPath, { withFileTypes: true });
    } catch {
      return;
    }
    const hasPayload = entries.some((e) => e.isFile() && e.name === 'index.txt');
    if (hasPayload) routeDirs.push({ dirPath, segments });
    for (const entry of entries) {
      if (entry.isDirectory() && !isSkippedDirName(entry.name)) {
        recurse(join(dirPath, entry.name), [...segments, entry.name]);
      }
    }
  }
  recurse(outDir, []);
  return routeDirs;
}

/** The RSC prefetch payload filename a route directory's segments resolve to. */
function expectedPayloadFilename(segments) {
  return segments.length === 0
    ? '__next.__PAGE__.txt'
    : `__next.${segments.join('.')}.__PAGE__.txt`;
}

/** Check (c): every route directory has its RSC prefetch payload file. */
function checkRoutePayloadFiles(outDir) {
  if (!existsSync(outDir)) return { ok: true, problems: [] };
  const problems = [];
  for (const { dirPath, segments } of findRouteDirs(outDir)) {
    const filePath = join(dirPath, expectedPayloadFilename(segments));
    if (!existsSync(filePath) || !statSync(filePath).isFile()) {
      const route = segments.length === 0 ? '/' : `/${segments.join('/')}`;
      problems.push(`route "${route}" is missing its RSC prefetch payload file: ${filePath}`);
    }
  }
  return { ok: problems.length === 0, problems };
}

const CHECKS = [
  ['out/index.html exists', checkIndexHtml],
  ['no Windows-defect __next.* payload directories under out/', checkNoPayloadDirectories],
  ['every route has its __next.<segments>.__PAGE__.txt payload file', checkRoutePayloadFiles],
];

/** Runs all checks against outDir and returns the combined result. */
export function checkExport(outDir) {
  const problems = [];
  for (const [, fn] of CHECKS) {
    const result = fn(outDir);
    problems.push(...result.problems);
  }
  return { ok: problems.length === 0, problems };
}

function main() {
  const outDir = process.argv[2] ?? 'out';
  let allOk = true;
  for (const [what, fn] of CHECKS) {
    const { ok, problems } = fn(outDir);
    if (ok) {
      console.log(`[check-export] ok  ${what}`);
    } else {
      allOk = false;
      console.log(`[check-export] FAIL ${what}`);
      for (const problem of problems) console.log(`  ${problem}`);
    }
  }
  process.exit(allOk ? 0 : 1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
