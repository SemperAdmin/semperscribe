# Test audit, 2026-08-25

Static audit of the suite on branch `feat/navmc-10132-unit-punishment-book`.
83 test files, 1,343 `it`/`test` blocks, 2,323 cases at runtime after
parameterisation. No suite run was needed for any finding below.

VERDICT: the suite is disciplined in the ways most suites are not, and it has one
structural hole. The defect D-34 identified was fixed for the five validators that
session touched and left in place for eleven others. Half the export gate is
still defended by the assertion pattern that has already failed once.

---

## 1. Eleven of twenty-two blockers have no gate test (CRITICAL)

D-34 recorded the lesson: three severities exist, only `'block'` gates, and a test
asserting `expect(issue.severity).toBe(...)` passes forever while the rule does
nothing. The fix added `getExportBlockers` assertions to V-18 through V-22.

Measured coverage across the whole blocker table:

| gate-tested | severity string only |
|---|---|
| V-01, V-09, V-10, V-11, V-12, V-16, V-18, V-19, V-20, V-21, V-22 | **V-02, V-03, V-04, V-05, V-06, V-07, V-08, V-13, V-14, V-15, V-17** |

Only five test files call `getExportBlockers` at all, 21 calls in total.
`navmc10132-validators.test.ts` carries 45 severity-string assertions against 4
gate calls.

What sits in the ungated half matters:

- **V-04**, item 6 punishment non-empty. Per MCO 011110.C, no punishment means no
  NJP occurred and the form is destroyed rather than filed.
- **V-13**, punishment requires at least one Guilty finding.
- **V-14**, officer-only punishment codes N01-N03 refused for enlisted accused.
- **V-15**, item 6 overflow, where the failure mode is silent clipping.
- **V-05**, item 7, the rule that blocked every form for most of a session.

None of these is known to be broken. The point is that the suite would not say so
if they were. D-34 fixed the instances it created and not the class.

FIX: one gate test per rule, asserting through `getExportBlockers` that a violating
fixture is stopped and a compliant variant of the same fixture is not.

## 2. Green tests defend three decisions reversed today (HIGH)

`tests/navmc10132-acroform.test.ts` asserts the app writes `2 BOOKER`,
`2 DEMAND`, `2 COUNSELOPP` (lines 103-105) and `23/24/25 ACCUSED` (lines 128-130).

- D-40 rules the pass-1 export CLEARS the first three.
- D-41 makes `bookerStatement()` a verifier rather than the writer of `2 BOOKER`.
- D-42 retires defect 3.4: Acrobat's calculate scripts populate 23-25 on the round
  trip, so the app verifies them and never writes them.

These tests will fail correctly when the pass model lands, which is the good case.
The risk is someone reading a green suite as evidence the current behaviour is
right and reverting the spec to match the tests.

FIX: mark them with the deciding row now, before the code changes, so the failure
reads as expected rather than as a regression.

## 3. Forty of 109 lib modules are imported by no test (HIGH)

Ranked by consequence rather than count:

| module | why it matters |
|---|---|
| `navmc10132-booker` | The Booker statement. Form defect 3.2, the one that produces a UPB falsely stating the accused accepted NJP. D-41 just made it the VERIFIER for a value arriving from outside the app. Zero tests |
| `navmc10132-capacity` | The measured character limits behind V-09 and V-15. Failure mode is silent clipping, which no other check can see |
| `navmc10132-export` | The export path itself |
| `navmc10132-date` | Naval date rendering, consumed by item 6, item 7 and the Figure 14-1 letter |
| `navmc10132-field-metrics` | Feeds capacity |
| `njp-vacation-handoff` | New, uncommitted, no tests |
| `njp-appeal-package` | New, uncommitted, no tests |
| `security-utils`, `validation-utils` | Named for what they do; nothing exercises them |

The remaining 32 are mostly UI helpers, seal and font assets, and storage shims,
where the cost of a defect is visible rather than legal.

## 4. Twenty-one new spec rows have no tests at all (EXPECTED, TRACK IT)

D-37 through D-57, V-23 through V-30, W-17 through W-19 were written today and
nothing implements or tests them. Stated so the gap is deliberate rather than
forgotten.

## 5. Five verification harnesses are run by nothing (MEDIUM)

`tools/aa-forms/` holds `navmc10132_fill.mjs`, `navmc10132_probe_values.mjs`,
`verify_10132_app_fill.mjs`, `verify_templates.mjs` and `verify_unit_diary.mjs`.
No npm script and no workflow invokes any of them. `test.yml` runs `npm ci`,
`typecheck`, `typecheck:tests`, `lint` and `npm test`, and stops there.

`verify_templates.mjs` guards a real failure mode, index URLs that resolve to
nothing, and belongs in `test.yml`.

## 6. V-17 exists in code and tests but has no spec row (LOW)

`navmc10132-validators-punishment.ts:330` documents "V-17, blocker. The rendered
item 7 suspension text does not fit". The spec's blocker table jumps V-16 to V-18.
The decision table is the record, so a rule enforced in code and absent from the
record is a divergence, whichever side is wrong.

## 7. Sixty-three weak sole assertions (LOW)

`toBeDefined`, `toBeTruthy`, `toBeFalsy` and `not.toThrow()` as the only assertion
in a case. Concentrated in `navmc10132-utils.test.ts` (19),
`dla-correspondence.test.ts` (14) and `document-types.test.ts` (14). Several are
legitimate smoke checks around generated cases. Worth a pass, not a priority.

## What the suite gets right

Stated because it is unusual and worth protecting.

- **Zero** `.skip`, `.todo` or `.only` anywhere in 83 files.
- **Zero** snapshot assertions outside `tests/golden`, where they are the point.
- Every `V-` and `W-` identifier named in `src` is also named in a test. The
  traceability is real; only the gate assertion is missing on eleven of them.
- Golden tests are separated behind their own script, so a LibreOffice-less
  environment does not produce a red suite that trains people to ignore red.
- CI runs both typechecks, and `tsconfig.tests.json` means test code is typed
  rather than trusted.

---

## Recommended order

1. Gate tests for the eleven ungated blockers. Highest value per hour in the repo,
   and it closes the class rather than the instances.
2. Annotate the three reversed assertions in `navmc10132-acroform.test.ts`.
3. Tests for `navmc10132-booker` and `navmc10132-capacity`, in that order.
4. `verify_templates.mjs` into `test.yml`.
5. V-17 into the spec, or out of the code.
6. Tests for the two new NJP modules, alongside the vacation build.
