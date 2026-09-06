# Bundle-size regression attribution, PR #49 (dbc4e2c vs 8499a84)

Method: checked out each commit, ran `npm@12 ci`, built with `productionBrowserSourceMaps: true` (temporary, not committed), then walked the 18 chunks referenced from `out/index.html`, the same initial-load set `scripts/bundle-report.mjs` computes, loaded each chunk's linked `.js.map` with `source-map-js`, and attributed the byte span between consecutive mappings to the top-level `node_modules/<pkg>` (or `@scope/<pkg>`) in the mapping's source path. One chunk, the Next.js `Object.assign` polyfill (112,594 B), ships with no source map in both builds and is excluded since it is identical either side. Local totals: before 2,557,659 B initial, after 2,671,056 B initial, a 113,397 B delta, close to the reported +110,461 B (the gap is normal build-to-build Turbopack hashing noise).

## Delta table, top 15 packages (initial-load chunks only)

| Package | Before (B) | After (B) | Delta (B) |
|---|---:|---:|---:|
| zod | 265,419 | 348,829 | +83,410 |
| @radix-ui/react-collection | 1,277 | 7,250 | +5,973 |
| react-hook-form | 29,885 | 34,107 | +4,222 |
| @radix-ui/react-dismissable-layer | 3,609 | 5,788 | +2,179 |
| next | 881,692 | 883,199 | +1,507 |
| @radix-ui/react-use-controllable-state | 994 | 2,153 | +1,159 |
| @radix-ui/react-switch | 2,845 | 3,557 | +712 |
| @radix-ui/primitive | 250 | 959 | +709 |
| @radix-ui/react-focus-scope | 3,135 | 3,723 | +588 |
| @radix-ui/react-checkbox | 3,435 | 3,959 | +524 |
| @radix-ui/react-radio-group | 5,117 | 5,591 | +474 |
| @radix-ui/react-toast | 11,037 | 11,457 | +420 |
| @radix-ui/react-tooltip | 7,456 | 7,866 | +410 |
| @radix-ui/react-use-is-hydrated | 0 | 395 | +395 |
| @radix-ui/react-presence | 2,349 | 2,731 | +382 |

Sum of all package deltas, all 79 packages seen: +105,465 B, most of the regression. zod alone is 79 percent of that total. Everything below the top 15 is single-digit-to-low-hundreds of bytes, mostly other Radix primitives with small point-release changes from the same grouped bump.

## New / removed transitive dependencies

- New after, absent before: `@radix-ui/react-use-is-hydrated` (395 B).
- Present before, absent after: `@radix-ui/react-use-escape-keydown` (210 B).

These look like a paired internal swap inside one Radix primitive's point releases, a hook renamed or replaced, not a new feature the app opted into. Net effect is a wash, +185 B.

## Top three contributors

1. **zod (4.4.3 to 4.5.4, +83,410 B, unavoidable at current usage).** Comparing the two npm tarballs directly, `v4/core` gained three new files not present in 4.4.3: `compile.js` (about 87 KB source), `memoizer.js`, and `visit.js`, a schema-compilation engine. It is wired into `v4/core/index.js` and `v4/classic/external.js`, exactly the path the app uses (`import { z } from 'zod'` in `src/lib/schemas.ts`, `src/lib/url-state.ts`, etc). Critically, `zod/v4-mini` does not reference `compile.js` at all, so the classic API's new compiler is the whole story. This is a real feature addition to zod itself, not something the app's usage pattern triggers avoidably, short of migrating every schema in the codebase to the `zod/mini` functional API, a real rewrite and not a quick win.

2. **@radix-ui/react-collection (1.1.9 to 1.1.15, +5,973 B measured, likely overstated).** The package's own `dist/index.mjs` grew from only 17,183 to 18,151 source bytes (+5.6%), a small, real change. The larger measured delta is plausibly inflated by the attribution method: this package is a shared internal dependency of `@radix-ui/react-select`, `-menu`, `-tabs`, and `-radio-group`, and Turbopack's chunk boundaries shifted between the two builds, so some neighboring minifier glue landed under `react-collection` in the after build that fell elsewhere before. Either way this is Radix-internal plumbing already used by several primitives in the app, with no app-level avoidance available.

3. **react-hook-form (7.78.0 to 7.87.0, +4,222 B, unavoidable).** Diffing exported function names between the two versions shows a real internal rewrite of dirty-field tracking (`clearDirtyField`, `collectDirtyFieldNames`, `isDirtyContainer`/`isEmptyDirtyContainer`, `getNullAncestorValue`) plus new helpers (`jsonToFormData`, `useResyncOnReconnect`, `safeJSONStringify`). This is core hook behavior the app already depends on, `react-hook-form` plus `@hookform/resolvers` are used for every validated form, and there is no partial-import path to shed it.

## Recommendation

Accept the regression as shipped. The new total, 2,666,990 B initial and 7,006,109 B total, is still well under budget, about 5 and 6 percent headroom respectively, and most of the added weight, zod's new compiler, is baked into the classic API's core path with no cheap opt-out. Avoiding it means migrating the codebase to `zod/mini`, a real refactor to scope separately if bundle size gets tighter later, not something to back out of a routine dependency bump. The remaining Radix and react-hook-form deltas are small, internal point-release changes to packages the app already uses directly, not new imports, so pinning any one back means fighting semver-compatible patches for little gain. If the owner wants headroom back now, the only targeted lever is pinning `zod` to `^4.4.x` in package.json, overriding the Dependabot merge, until a `zod/mini` migration is evaluated, but given the current margin this is optional.
