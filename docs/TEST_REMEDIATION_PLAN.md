# Test remediation plan

Written 2026-08-25 against the findings in `docs/TEST_AUDIT.md`.

OBJECTIVE: close the class of defect D-34 identified, not eleven more instances
of it. Done means every export blocker is proven to stop an export, and a new
blocker that is not so proven fails CI.

NO FILE UNDER `src/` IS EDITED BY THIS PLAN. Every finding below is reachable
with test-only changes. That constraint is what makes the work safe to delegate.

---

## P0. Prerequisite, already measured

Each of the eleven ungated rules emits an id a test can key on. No renaming and
no `src` change is needed. The anchors:

| rule | id prefix to assert on |
|---|---|
| V-02 | `navmc10132-offense-summary-present-` |
| V-03 | `navmc10132-offense-finding-requires-article-` |
| V-04 | `navmc10132-v04-punishment-empty` |
| V-05 | `navmc10132-v05-` |
| V-06 | `navmc10132-v06-rights-cert-after-punishment` |
| V-07 | `navmc10132-v07-appeal-advisement-before-punishment` |
| V-08 | `navmc10132-v08-` |
| V-13 | `navmc10132-punishment-requires-guilty-finding` |
| V-14 | `navmc10132-v14-` |
| V-15 | `navmc10132-v15-item6-overflow` |
| V-17 | `navmc10132-v17-item7-overflow` |

NAMING INCONSISTENCY, LOGGED NOT FIXED: V-02, V-03 and V-13 carry no `vNN`
segment while every other rule does. Cosmetic, and changing an id is a `src`
edit, so it stays out of this plan. Note it for a later pass.

## P1. Eleven gate tests, one new file

New file `tests/navmc10132-export-gate.test.ts`.

WHY ONE FILE RATHER THAN CO-LOCATION. The V-18 to V-22 gate tests sit beside
their rule's other tests, in four files. That precedent is what let the class
survive: no reader can see at a glance which blockers are proven and which are
not. One file named for the question makes the gap visible and makes P2
possible.

### The assertion contract, non-negotiable

Copied from the V-22 test, which is the house pattern and is correct:

```ts
const blocking = baseForm({ /* one thing wrong */ });
expect(getExportBlockers(blocking, [], [], []).some(
  (i) => i.id.startsWith('<anchor>'))).toBe(true);

const compliant = baseForm({ /* the SAME fixture, that one thing fixed */ });
expect(getExportBlockers(compliant, [], [], []).some(
  (i) => i.id.startsWith('<anchor>'))).toBe(false);
```

- Assert on the PREFIX, never on the array's length or emptiness.
  `getExportBlockers` runs the FULL suite, so any fixture trips unrelated rules.
  A test asserting `toHaveLength(1)` or `toEqual([])` is wrong and will pass
  today and fail for the wrong reason tomorrow.
- The two fixtures differ in EXACTLY ONE FIELD. Two differences prove nothing
  about which one removed the issue.
- Assert the blocking case FIRST and require it to be true. A conditional rule
  whose precondition is unmet emits nothing, so a test that only checks the
  compliant half passes against a rule that never fires at all.
- Do NOT delete or weaken the existing severity-string assertions. They stay.
  They were never wrong, only insufficient.

### Per-rule fixture notes, where the rule is not a plain toggle

- **V-05** has three ids (`-empty`, `-short`, `-index-N`). Key on the `v05-`
  prefix and cover empty and short as separate cases.
- **V-08** is an exclusive-or with two ids, `-both` and `-neither`. It needs
  THREE fixtures: both set, neither set, and exactly one set.
- **V-14** is per-code. Blocking fixture uses N01, N02 or N03 against an enlisted
  accused. Compliant variant swaps the code, not the accused.
- **V-15** is "blocker unless the user routed the overflow to item 21". The
  compliant variant is the ROUTED case, not merely a shorter string. A shorter
  string tests the length check and leaves the routing branch unproven.
- **V-17** is the same shape as V-15 for item 7.
- **V-13** recomputes from structured punishments rather than reading the
  rendered string. Build the fixture from `punishments[]`, not `punishmentImposed`.

## P2. The guard that stops the class reopening

A meta test in the same file that reads `src/lib/navmc10132-validators*.ts`,
collects every `V-\d\d` marked as a blocker, and fails when one has no gate test
in the suite. Vitest runs in node, so `fs` is available.

Without P2 this plan fixes eleven instances and the twelfth blocker written next
month arrives ungated, which is precisely how the current state was reached.

The meta test is the deliverable of this plan. The eleven tests are what makes it
pass.

## P3. Annotate the three reversed assertions

`tests/navmc10132-acroform.test.ts` asserts the app writes `2 BOOKER`,
`2 DEMAND`, `2 COUNSELOPP` (lines 103-105) and `23/24/25 ACCUSED` (128-130).
D-40, D-41 and D-42 reversed all three.

Add a comment at each naming the deciding row and what the assertion becomes
under the pass model. Do not change the assertions yet: the code still writes
those fields, so the tests are currently correct about current behaviour. The
comment is there so the failure reads as expected when the pass model lands,
rather than as a regression someone reverts.

## P4. Unit tests for the two highest-risk untested modules

- `navmc10132-booker`. It owns the statement behind form defect 3.2, and D-41
  makes it the verifier for a value arriving from outside the app. Cover all five
  branches of the demand / counsel-opportunity / refusal decision, and cover the
  case D-41 exists for: elections that say refusal against a `2 BOOKER` still
  carrying the blank's shipped acceptance text.
- `navmc10132-capacity`. Failure mode is silent clipping, which nothing else can
  observe. Cover each measured limit in section 2.2 at the boundary, one under
  and one over.

## P5. CI wiring

`verify_templates.mjs` into `test.yml`. It guards index URLs that resolve to
nothing, and today no npm script and no workflow runs it or the other four
harnesses in `tools/aa-forms/`.

---

## Delegation

P1 and P2 go to ONE subagent in a single pass. Eleven tests from one template
plus a meta test is not work that benefits from fan-out, and four agents editing
one file conflict. P4 is two independent subagents, one module each. P3 and P5
are small enough to do directly.

### Brief, every subagent gets this verbatim

- Edit files under `tests/` ONLY. Any change under `src/` is out of scope, and if
  a test cannot be written without one, STOP and report why.
- Do not delete, weaken, loosen or reword any existing assertion.
- Never assert on the length or emptiness of a `getExportBlockers` result.
- Every new test must fail if its rule is disabled. State, per test, how you
  confirmed that.
- Report anything you could not prove rather than writing a test that passes
  without proving it.

### Review gate, per batch

1. I read every new test against the contract above.
2. Differential check: temporarily neuter each rule and confirm its test goes
   red. A gate test that stays green with its rule disabled is worthless, and
   that is exactly the defect being fixed.
3. Full suite in the cloud container. The device VM cannot load
   `rolldown-binding.linux-x64-gnu.node`, so verification is tarball, `npm ci`,
   `npx tsc --noEmit`, `npx tsc --noEmit -p tsconfig.tests.json`, `npm test`.
   Never pass `--reporter=basic`; it does not exist in vitest 4.

## Out of scope, deliberately

- The 63 weak sole assertions. Real but low value, and touching them churns
  files this plan needs stable.
- The other 38 untested lib modules. Mostly UI helpers and asset shims where a
  defect is visible rather than legal.
- Tests for D-37 to D-57. Those land with the code that implements them, not
  before.
- V-17's missing spec row, and the V-02 / V-03 / V-13 id inconsistency. Both are
  record-keeping, tracked separately.
