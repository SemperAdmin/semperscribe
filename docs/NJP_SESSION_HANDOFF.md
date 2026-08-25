# NJP package: session handoff

Rewritten 2026-08-25 at the end of a second long session. Read this before
touching the NAVMC 10132 or the NJP package. It is not a summary of what
happened; it is the set of facts that cost time to learn and would cost the same
again.

THE BIGGEST CHANGE SINCE THE LAST REVISION: the UPB is a MULTI-PASS document.
It is created in the app, exported, CAC-signed, re-uploaded, filled further,
exported again, and so on across seven passes. Everything written before
2026-08-25 assumed a single export. Section 3 covers what that invalidated.

Authoritative documents, in order of precedence:

1. `docs/NAVMC_10132_SPEC.md` — the decision table (D-01 to D-57) and the
   validator tables. **The decision table is the record.** If this handoff and
   the spec disagree, the spec wins and this file is stale.
2. `docs/NAVMC_10132_DEFECT_REPORT.md` — defects in the FORM and the MCO,
   routed to their owners. Not app defects.
3. `docs/TEST_AUDIT.md` and `docs/TEST_REMEDIATION_PLAN.md` — the state of the
   suite and the plan against it. P1 and P2 are done.
4. `docs/NJP_PACKAGE_RESEARCH.md` — what documents surround an NJP.
5. `docs/NAVMC_10132_BUILD_PLAN.md` — **PARTLY STALE.** Its export phase and its
   Phase 2 role both assume the single-export model. Do not brief anyone off it
   without reading spec section 13 first.

---

## 1. Environment: read this first

These are not preferences. Getting them wrong wastes an hour each.

**The device VM cannot run this repo's tooling.** `node_modules` is a Windows
install; the Linux VM behind `device_bash` cannot load
`rolldown-binding.linux-x64-gnu.node`. Do not try to run vitest, tsc or next
build through `device_bash`.

**Build and test in the cloud container.** Proven end to end 2026-08-25:

```
# on the device, tar alone in one call (45s shell limit):
cd "$HOME/mnt/SemperScribe" && tar --exclude=node_modules --exclude=.next \
  --exclude=.git --exclude=out --exclude=_scratch -czf _scratch/ss.tgz .
# 111M repo -> 62M tarball in 24s
```

Stage that one path, then in the container:

```
npm ci --no-audit --no-fund      # ~1 min, 927 packages
npx tsc --noEmit
npx tsc --noEmit -p tsconfig.tests.json
npx vitest run                   # ~220s, 84 files, 2342 tests
```

Never pass `--reporter=basic` to vitest. It does not exist in vitest 4. The
tarball must live inside the connected folder to be stageable, so it lands in
`_scratch/` and the user deletes it.

**Git through the bridge. Corrected TWICE, and this is the measured version.**

Revision one said git commands fail. Revision two said git succeeds and arms a
trap. Both were wrong in the same way: they stopped measuring one step early.

What actually happens:

```
git add / git status / git commit
  -> exit 0, work is done correctly
  -> warnings: unable to unlink '.git/index.lock' or '.git/HEAD.lock'
  -> that lock file REMAINS and blocks the next ref or index write
```

The missing step is that RENAME SUCCEEDS WHERE UNLINK FAILS. A stuck lock is
cleared from here without any elevated permission:

```
mv .git/index.lock .git/index.lock.stale-$(date +%s)
```

The `.git/index.lock.bak`, `index.lock.bak2`, `HEAD.lock.cleared` and
`index.lock.stale-*` files already sitting in this repo are exactly that
workaround, applied by hand in earlier sessions.

SO GIT IS USABLE FROM HERE. Two rules make it safe:

1. Prefer PLUMBING over porcelain for anything that moves a ref. `git commit`
   takes the HEAD lock; this does not:

   ```
   git add <paths>
   T=$(git write-tree)
   P=$(git rev-parse HEAD)
   C=$(git -c user.name="..." -c user.email="..." commit-tree "$T" -p "$P" -F msg.txt)
   printf '%s\n' "$C" > .git/refs/heads/<branch>
   ```

   Verified: two chained commits in a probe repo, correct log, clean status, no
   lock left behind at all.

2. After ANY git call, sweep for locks and rename them aside. `git add` and
   `git status` both leave `index.lock` on this mount even when they succeed.

Commit `c0eeb38` was made this way from the bridge, on a phone-only day, and
left the repo clean.

STILL DO NOT PUSH from here without the user asking. And the porcelain path
remains a trap for anyone who skips the sweep, so the user's own cleanup line
stays worth knowing:

```powershell
Get-ChildItem "D:\Coding\SemperScribe\.git" -Recurse -Filter *.lock | Remove-Item -Force
```

**Delete is blocked on the mount, but RENAME is not.** `touch` then `rm` under
`_scratch/` returns "Operation not permitted", and
`device_request_delete_permission` does not exist in this build. Nothing can be
removed from here. What CAN be done is move it: scratch artifacts go into
`_scratch/_to_delete/` and the user empties that folder. Say so whenever
something is left behind, every time.

**`.github/workflows/` is protected from remote writes.** `device_commit_files`
refuses it. Deliver workflow files as attachments and say they need placing by
hand. Everything else writes fine.

**Test files write straight to `tests/`.** `device_commit_files` puts them at
the right path under the right name. The attachment card shows the scratch
filename, which looks like something to file. It is not. Say so, or the user
will ask where to put it.

---

## 2. Where things stand

Branch `feat/navmc-10132-unit-punishment-book`, HEAD `8c6dd1b1`.

The ten files the previous revision listed as uncommitted are now committed in
`bf707270` / `8c6dd1b1`. Check push state yourself by reading the refs; do not
assume.

**Uncommitted as of this rewrite:**

```
docs/NAVMC_10132_SPEC.md               D-37..D-57, V-23..V-30, W-17..W-19, section 13
docs/TEST_AUDIT.md                     NEW
docs/TEST_REMEDIATION_PLAN.md          NEW
docs/NJP_SESSION_HANDOFF.md            this file
tests/navmc10132-export-gate.test.ts   NEW, 19 tests
```

Commit message drafted at `_scratch/commit-msg-export-gate.txt`.

Baseline: **2342 tests pass** across 84 files, both typechecks clean. Left on
the device and needing manual deletion: `_scratch/ss.tgz` (62MB),
`_scratch/gitprobe/`, `_scratch/_delete_probe.tmp`.

---

## 3. The document is multi-pass. This invalidated a lot.

The user stated the real lifecycle 2026-08-25 and ruled that signatures
ACCUMULATE IN ONE FILE, with structured state carried as embedded JSON inside
the PDF. Full detail in spec section 13. What matters here:

**pdf-lib 1.17.1 destroys every signature on every save.** Measured: load and
save with ZERO edits produces a different file that diverges from the input at
byte 10. `SaveOptions` has four keys and none of them is incremental. This is a
library limit, not a code defect.

**The fix is `@cantoo/pdf-lib` 2.9.1**, a fork with `saveIncremental`. Proven on
the user's own CAC-signed file: the signed revision preserved byte for byte, the
ByteRange unchanged, every written value read back, the locked accused name
untouched.

**Three traps inside that fix**, each of which cost real time:

- `saveIncremental` auto-includes NEW objects and NOT mutated existing ones.
  Forget `snap.markRefForSave(ref)` and you get a structurally valid PDF whose
  field value is silently absent. A first attempt produced exactly that.
- The appended cross-reference must MATCH the original's format. This form ends
  in an xref stream, so `useObjectStreams: true` is required. A classic xref
  table gets rejected by Acrobat with "Unexpected byte range values defining
  scope of signed data", which is a structural rejection thrown before any hash
  check rather than a tamper report. **This is the OPPOSITE of the Phase 0 rule,
  which requires `useObjectStreams: false` for full-rewrite fills. Both are
  right in their own path. Do not harmonize them.**
- Use `field.defaultUpdateAppearances(font)` per field, never
  `form.updateFieldAppearances()`. The latter throws on item 21's RichText flag.

**The form defines its own pass model.** Every signature field carries a
`/SigFieldLock`. Signing sets ReadOnly on every field the lock names. The app
reads that model rather than hardcoding one. Two consequences worth carrying in
your head: the signing order is FORCED, because item 3's lock includes item 2's
signature field and not the reverse, so signing item 3 first kills the form; and
`16 FINAL ADMIN INIT` carries `/Action /All`, making it terminal.

**Four lock lists contain 29 dead field references** naming fields renamed away
from FINAL DISPOSITION. Items 6, 8 and 10 are therefore locked by NO signature
until the terminal one, so the signature that imposes punishment does not lock
the punishment. Spec defect 3.9, mitigated by D-45 and V-27.

**Source blockers are CLOSED.** MCO 5800.16 Vol 14 and JAGINST 5800.7G CH-2 were
both supplied in full. No further source material is needed for the vacation
work.

---

## 4. Module map

Everything below is pure and lib-level unless marked.

### The form itself

| Module | Owns |
|---|---|
| `navmc10132-punishments.ts` | The code table N01-N17. **This IS MCTFS Table 19.** Also `punishmentFamily`, `resolveAuthorityLevel`, `releaseOnePunishmentsFor` |
| `navmc10132-ranks.ts` | Closed rank lists, `reductionBarred`, `reducedPayGrade`, `reducibleGrades` |
| `navmc10132-acroform.ts` | Field-name fill of the official PDF. **Recomputes derived strings itself** rather than reading them, which is why the round trip needs the embedded JSON |
| `navmc10132-booker.ts` | The Booker statement. **NO TESTS.** D-41 turns it from the writer into the VERIFIER of a value arriving from outside the app |
| `navmc10132-capacity.ts` | The measured character limits behind V-09 and V-15. **NO TESTS**, and the failure mode is silent clipping |
| `navmc10132-validators-*.ts` | V- and W- rules. See section 5 |

### Money

| Module | Owns |
|---|---|
| `navmc10132-basic-pay.ts` | DFAS table effective 2026-01-01, verified 198/198 by the user. `PAY_TABLE_CELL_DIGEST` guards it |
| `navmc10132-combination-limits.ts` | MCM Part V 5.d, plus 5.b per-case aggregates |

### The package

| Module | Owns |
|---|---|
| `jagman-appendix-a1.ts` | **GENERATED. Never hand-edit.** Regenerate via `tools/aa-forms/extract_jagman_a1.py` |
| `jagman-a1-fill.ts` / `-wrap.ts` / `-pdf.ts` | Fixed-width appendix engine, for JAGMAN appendices ONLY |
| `njp-a1-rights.ts` | A-1-c / A-1-d rights advisement. **Imported by NO component or hook.** The pass-1 generate option is new work, not wiring |
| `njp-maximum-punishment.ts` | A-1-d paragraph 3 ceiling |
| `njp-suspension-period.ts` | MCM 6.a. **Its `endsOn` is WRONG whenever tolling applies.** See D-51 |
| `njp-vacation-handoff.ts` | Figure 14-1. Generates one letter and needs two. See D-50. No tests |
| `njp-appeal-package.ts` | The 011107 checklist. Zero occurrences of "vacat". See D-53. No tests |
| `navmc10132-mctfs.ts` | TTC statements for the unit diary |

---

## 5. Rules that are not obvious

**Severity: `'block'` gates, `'fail'` does not.** Three levels exist.
`getExportBlockers` filters on `severity === 'block'`. `'fail'` renders as
"Non-compliant" and lets the export through; `'warn'` renders as "Advisory".

**Test the gate, not the string, and PROVE it by differential.** A test
asserting `expect(issue.severity).toBe('fail')` passes forever while the rule
does nothing. As of 2026-08-25 all 24 block-severity emitters have a
`getExportBlockers`-backed test, and each was verified by downgrading its rule to
`'fail'` and confirming its test goes red. Two meta guards in
`tests/navmc10132-export-gate.test.ts` keep the class closed. Run the
differential before trusting any new validator test.

**Never assert on the length or emptiness of a `getExportBlockers` result.** It
runs the FULL suite, so any fixture trips unrelated rules. Assert on the rule's
id prefix.

**Clearing a field is three operations, not one.** Delete `/V` and the value is
gone while the baked `/AP` appearance stream STILL DISPLAYS the old text. Delete
`/V`, delete `/AP` on every widget, and set `NeedAppearances`. A test asserting
only that `/V` is gone passes on a document that still prints the old answer.
`NeedAppearances` is a pass-1-only device; never set it on an incremental write.

**The DynamicForm clobber rule.** React Hook Form seeds defaults at mount and
clobbers external writes on its next debounced sync. Any field a custom
component writes must NOT appear in a `Navmc10132Definition` section. The
exclusion list in `schemas.ts` is authoritative.

**Derived strings need a writer, and the writer is a component effect.**
`punishments[] -> punishmentImposed` and `suspensions[] -> suspension`. The
second was documented and never built, so `suspension` stayed `''` and V-05
blocked every form, while the acroform recomputed independently so the PDF
looked right. If you add a derived field, add the effect AND a component test
closing the loop to the validator that reads it.

**Closed lists are closed.** Marine ranks and offense articles come from the
form's own page 3 note and the article crosswalk. An invented label silently
resolves to nothing.

**Many-to-one crosswalks.** Art. 92 alone has 22 form labels resolving to code
`92`. Dedupe before filling a fixed-slot transaction like TTC 212.

**Never guess a legal figure.** Every ceiling, cap and date traces to a quoted
paragraph. If the source cannot be read verbatim, leave the blank and say why.
Guessing produces a number that overcollects from a Marine's pay.

**Two stale comments, both caught the hard way.** The V-13 docstring in
`navmc10132-validators-punishment.ts` says the rule recomputes from structured
punishments; it reads `punishmentImposed`. The V-05 "short" case is documented
among blockers and emits `'warn'` on purpose. Read the code, not the comment.

---

## 6. How defects were actually found

Worth knowing, because the pattern repeated across both sessions.

- **Rendering, not tests.** Five layout defects in the A-1 appendices, the
  severity bug, and the item 7 derived-string bug were all found by looking at
  output. The suite was green throughout.
- **Differential probes.** The pdf-lib signature defect, the xref format
  rejection, the `/AP` clearing trap and the git lock behaviour were all found by
  running a control and a test case side by side and comparing bytes. Three of
  the four contradicted a written note that everyone believed.
- **The user's own verification.** The pay table's seven defects came from a
  198-cell programmatic diff and a 20.7-million-case float sweep run
  independently.
- **Reading the source paragraph.** JAGMAN 0111.b, MCM 6.a(2) and JAGMAN 0118.c
  were all found while looking for something else.
- **A subagent pushing back.** The Sonnet agent that wrote the export-gate tests
  contradicted its brief three times and was right every time, including twice
  where the brief was wrong. Briefs must ask for "anything you could not prove"
  as a named deliverable.
- **Sweeping the stage selector in a browser.** Driving all eight stages and
  diffing the rendered `<label>` set between consecutive stages found D-61, the
  item 16 leak, in one pass. The unit suite could not see it: it is written per
  section, so it inherits the same blind spot as the code it tests, and thirteen
  green section-level tests coexisted with two pass-7 inputs open at pass 1. Two
  properties fall out of the diff for free, ADDITIVE (each stage's label set is a
  superset of the last) and PLACED (a label appears no earlier than its pass).
  Re-run the sweep after any change to `Navmc10132Sections` or to a section that
  spans passes. Do not edit source while it runs, Fast Refresh kills the loop
  mid-sweep and the partial result reads like a real non-monotonic diff.

Working instruction: **render it and look at it.** A passing suite is not
evidence that the output is right.

---

## 7. Backlog

**BLOCKED ON A SOURCE DOCUMENT.** `njp-vacation-post-action.ts` (D-55) is built
and tested but its header carries a named debt: the verbatim text of MCO 5800.16
Vol 14 para 011202 is not in this codebase, so nothing in that module is presented
as a quotation, unlike `njp-appeal-package.ts` which quotes 011107 in full. Get the
order, add the paragraph to the header, and check two inferences the module rests
on: the ORDER of the five steps, and that step 1's "vacated punishment information"
means the unit diary number and date rather than a description of the punishment.
Do not ship the checklist to a user before that check.

**Specified and unbuilt.** D-37 through D-57, V-23 through V-30 and W-17 through
W-19 have no code. Twenty-one decision rows from one session. Start with D-51,
alone: it corrupts `endsOn`, which both `njp-vacation-handoff.ts` and D-36
consume.

**Test remediation, P3 to P5.** P1 and P2 are done. Remaining: annotate the three
reversed assertions in `navmc10132-acroform.test.ts` (they defend behaviour D-40,
D-41 and D-42 overturned), unit tests for `navmc10132-booker` and
`navmc10132-capacity`, and `verify_templates.mjs` into `test.yml`.

**Tier 2 NJP package.** Vacation notice and execution letter, both from one
template per D-50. Appeal endorsement. Neither new module has tests.
**The handoff ordering is load-bearing:** `handleLoadTemplateUrl` calls
`handleImport`, which REPLACES the document. Save the 10132 to the library
(`libPut`, IndexedDB) BEFORE seeding the letter, or the case is lost.

**Tier 3, unstarted.** A-1-h punitive letter, conditional on N16/N17 being
written. A-1-g appeal rights. A-1-f CO script buttons, where the user has never
ruled on the two-moments split, which is the same shape as D-50.

**Known gaps**

- **The appeal DynamicForm opens items 11-15 all at pass 4.** Same defect class as
  D-61, found by the same sweep, deliberately not fixed blind. Four of its eight
  fields belong to passes 5, 6 and 7 by the 13.1 lock table. The fix is a
  field-level `subDefinition` filter, and it is gated on measuring whether React
  Hook Form clears a field dropped from a DynamicForm definition. Spec 13.4.
- **MOS has no field anywhere.** Figure 14-1's To line needs it.
- **EAS has no field.** MCM 6.a(2) terminates a suspension early at expiration of
  enlistment, so every computed suspension date carries that caveat, and D-51
  adds two more.
- **`vesselException` is app state, not a form field.** It must ride in the
  embedded JSON or it is lost on every round trip.
- V-17 is enforced in code and has NO spec row.
- V-02, V-03 and V-13 emit ids with no `vNN` segment while every other rule has
  one.
- TTC 056 000's pay-grade field is "6-byte abbreviation", ambiguous between rank
  abbreviation and grade code. Currently emits the rank.
- TTC 212 001's SEQ is assigned by MCTFS; renders as `[SEQ]`.
- Three UI strings still say "Release one is enlisted only", contrary to spec
  section 1.3.
- The five `.mjs` harnesses in `tools/aa-forms/` are run by no npm script and no
  workflow.
- Date picker weekday header renders oddly; Radix logs a missing
  `aria-describedby` on the article-picker dialog.
- 38 lib modules beyond booker and capacity have no test importing them.

---

## 8. Working agreement with the user

- He is the reviewer and wants flaws led with, not buried.
- He supplies authoritative source by paste or attachment. Ask rather than
  paraphrase.
- **He runs git himself, by default.** Prepare commit messages in `_scratch/`
  and hand him the command. When he is away from the machine and asks for it to
  be run, section 1 has the plumbing path that works from the bridge without
  leaving a lock. Never push without him asking.
- Browser-test after each phase. The Chrome extension is connected and the dev
  server runs on `localhost:3000`.
- Subagents do the test-writing; brief them with the verbatim controlling
  paragraph, forbid them from editing `src/` or weakening an assertion, and ask
  them to report what they could not prove.
- Verify a failure mode before asserting it. Three notes in this file were wrong
  until someone ran a controlled probe against them.
