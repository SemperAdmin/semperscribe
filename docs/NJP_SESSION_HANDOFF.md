# NJP package: session handoff

Written 2026-08-25 at the end of a long session. Read this before touching
the NAVMC 10132 or the NJP package. It is not a summary of what happened; it
is the set of facts that cost time to learn and would cost the same again.

Authoritative documents, in order of precedence:

1. `docs/NAVMC_10132_SPEC.md` — the decision table (D-01 to D-36) and the
   validator tables. **The decision table is the record.** If this handoff and
   the spec disagree, the spec wins and this file is stale.
2. `docs/NAVMC_10132_DEFECT_REPORT.md` — defects in the FORM and the MCO,
   routed to their owners. Not app defects.
3. `docs/NJP_PACKAGE_RESEARCH.md` — what documents surround an NJP.
4. `docs/NAVMC_10132_BUILD_PLAN.md` — phase plan, partly historical.

---

## 1. Environment: read this first

These are not preferences. Getting them wrong wastes an hour each.

**The device VM cannot run this repo's tooling.** `node_modules` is a Windows
install; the Linux VM behind `device_bash` cannot load
`rolldown-binding.linux-x64-gnu.node`. Do not try to run vitest, tsc, or next
build through `device_bash`.

**Build and test in the cloud container.** Copy the repo in, `npm ci`, and
work there:

```
tar --exclude=node_modules --exclude=.next --exclude=.git --exclude=out -czf ss.tgz .
# stage the tarball, extract in the container, then:
npm ci && npx tsc --noEmit && npx tsc --noEmit -p tsconfig.tests.json
npm run build && npx vitest run
```

Never pass `--reporter=basic` to vitest. It does not exist in vitest 4.

**Do not run git through the bridge.** The mounted folder is read/write but
NOT delete. Git writes `.git/index.lock`, does its work, then unlinks it — the
unlink fails, and the lock blocks every later git command. This is true even
of read-only commands like `git status`. Read `.git/HEAD`, `.git/refs/**`,
`.git/packed-refs` and `.git/logs/HEAD` as plain files instead. Hand the user
git commands to run in their own shell.

If a lock is already stuck, the user clears all of them at once:

```powershell
Get-ChildItem "D:\Coding\SemperScribe\.git" -Recurse -Filter *.lock | Remove-Item -Force
```

**`.github/workflows/` is protected from remote writes.** `device_commit_files`
refuses it. Deliver workflow files as attachments and say they need placing by
hand. Everything else writes fine.

**Test files write straight to `tests/`.** `device_commit_files` puts them at
the right path under the right name. The attachment card shows the scratch
filename, which looks like something to file. It is not. Say so, or the user
will ask where to put it.

---

## 2. Where things stand

Branch `feat/navmc-10132-unit-punishment-book`, HEAD `3a06c1c5`.

```
3a06c1c5  V-22: cap suspensions at six months, and compute the vacation deadline
70ee5ce2  Fix stale tmp_check references after the verify_ rename
1ca8a5b9  Rename the two tmp_check harnesses to match the verify_ convention
5190a664  Close seven pay-table defects found by verification
cee07659  CI: run tests on every branch, typecheck in CI, gate deploy on the suite
e10b4380  Add the NJP package: JAGMAN A-1, pay table, MCTFS, four gates
```

Check push state yourself by reading the refs; do not assume.

**Uncommitted (10 files):**

```
docs/NAVMC_10132_SPEC.md                                  D-34..D-36, V-18..V-22 rows
src/components/letter/navmc10132/SuspensionSection.tsx    derived-string writer
src/lib/navmc10132-validators-punishment.ts               severity corrections
src/lib/njp-appeal-package.ts                             NEW, 011107 checklist
src/lib/njp-vacation-handoff.ts                           NEW, Figure 14-1
tests/components/navmc10132-derived-strings.test.tsx      NEW
tests/navmc10132-basic-pay.test.ts
tests/navmc10132-combination-limits.test.ts
tests/navmc10132-validators.test.ts
tests/njp-suspension-period.test.ts
```

Baseline: **2323 tests pass**, production build clean, both typechecks clean,
eslint 0 errors / 54 warnings (pre-existing, mostly
`react-hooks/set-state-in-effect`). Do not add `--max-warnings 0` until those
are cleared.

---

## 3. Blocked, and what unblocks it

Tier 2 is half built. It needs source material the user must supply, because
fetching MCO 5800.16 Vol 14 returns summaries rather than verbatim text and a
legal form must not be authored from a paraphrase.

**Needed:**

- **Para 011201** (or whichever paragraph actually governs vacation — the
  number came from a summariser and is unconfirmed). Who may vacate, the
  procedure, whether a hearing is required.
- **The figure that EXECUTES the vacation**, if one exists. Figure 14-1 is a
  *Notice of Intent to Vacate* — a pre-decision notice giving the Marine a
  chance to respond. Nothing yet carries the vacation out.

**Already supplied and built from:** Figure 14-1 and para 011107.

---

## 4. Module map

Everything below is pure and lib-level unless marked.

### The form itself

| Module | Owns |
|---|---|
| `navmc10132-punishments.ts` | The code table N01-N17. **This IS MCTFS Table 19.** Also `punishmentFamily`, `resolveAuthorityLevel`, `releaseOnePunishmentsFor` |
| `navmc10132-ranks.ts` | Closed rank lists, `reductionBarred`, `reducedPayGrade`, `reducibleGrades` |
| `navmc10132-acroform.ts` | Field-name fill of the official PDF. **Recomputes derived strings itself** rather than reading them |
| `navmc10132-validators-*.ts` | V- and W- rules. See severity note in section 5 |

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
| `njp-a1-rights.ts` | A-1-c / A-1-d rights advisement |
| `njp-maximum-punishment.ts` | A-1-d paragraph 3 ceiling |
| `njp-suspension-period.ts` | MCM 6.a: the six-month cap and the vacation deadline |
| `njp-vacation-handoff.ts` | **NEW.** Figure 14-1 as a naval letter |
| `njp-appeal-package.ts` | **NEW.** The 011107 checklist |
| `navmc10132-mctfs.ts` | TTC statements for the unit diary |

---

## 5. Rules that are not obvious

**Severity: `'block'` gates, `'fail'` does not.** Three levels exist.
`getExportBlockers` filters on `severity === 'block'`. `'fail'` renders as
"Non-compliant" and lets the export through; `'warn'` renders as "Advisory".
V-18 through V-22 were written as `'fail'` and blocked nothing for most of a
session while being described as BLOCKING everywhere. See D-34.

**Test the gate, not the string.** A test asserting
`expect(issue.severity).toBe('fail')` passes forever while the rule does
nothing. Assert through `getExportBlockers` that the export is actually
stopped.

**The DynamicForm clobber rule.** React Hook Form seeds defaults at mount and
clobbers external writes on its next debounced sync. Any field a custom
component writes must NOT appear in a `Navmc10132Definition` section. The
exclusion list in `schemas.ts` is authoritative — read it before adding a
field.

**Derived strings need a writer, and the writer is a component effect.**
`punishments[] -> punishmentImposed` and `suspensions[] -> suspension`. The
second was documented in `schemas.ts` and never built, so `suspension` stayed
`''` and V-05 blocked every form. The acroform recomputes independently, so
the PDF looked right and the gap survived. If you add a derived field, add the
effect AND a component test that closes the loop to the validator that reads
it.

**Closed lists are closed.** Marine ranks and offense articles come from the
form's own page 3 note and the article crosswalk. An invented label silently
resolves to nothing.

**Many-to-one crosswalks.** Art. 92 alone has 22 form labels resolving to
code `92`. Dedupe before filling a fixed-slot transaction like TTC 212.

**Never guess a legal figure.** Every ceiling, cap and date in this codebase
traces to a quoted paragraph. If the source cannot be read verbatim, leave the
blank and say why. Guessing produces a number that overcollects from a
Marine's pay.

---

## 6. How defects were actually found

Worth knowing, because the pattern repeated all session.

- **Rendering, not tests.** Five layout defects in the A-1 appendices, the
  severity bug, and the item 7 derived-string bug were all found by looking at
  output — a PDF in Acrobat, a badge in the compliance dialog, a blocker
  count in the banner. The suite was green throughout.
- **The user's own verification.** The pay table's seven defects came from a
  198-cell programmatic diff and a 20.7-million-case float sweep run
  independently. Structural invariants had passed five of six injected
  transcription errors, because monotonicity cannot see a transposed digit.
- **Reading the source paragraph.** JAGMAN 0111.b (correctional custody on an
  NCO) and MCM 6.a(2) (the six-month cap) were both found by reading the
  governing text while looking for something else. Neither was in any backlog.

Working instruction: **render it and look at it.** A passing suite is not
evidence that the output is right.

---

## 7. Backlog

**Tier 2, in progress**

- Vacation notice: module built, needs 011201, the execution figure, a
  `.nldp` template in `public/templates/global/` with an `index.json` entry,
  a button, and tests.
- Appeal endorsement: 011107 checklist built, needs the endorsement document
  itself and tests. Neither new module has tests.
- **The handoff ordering is load-bearing.** `handleLoadTemplateUrl` calls
  `handleImport`, which REPLACES the document. Save the 10132 to the library
  (`libPut`, IndexedDB) BEFORE seeding the letter, or the case is lost.

**Tier 3, unstarted**

- A-1-h punitive letter, conditional on N16/N17 being written.
- A-1-g appeal rights.
- A-1-f CO script buttons. The user has never ruled on the two-moments split
  (blank script at election vs completed summary at punishment).

**Known gaps**

- **MOS has no field anywhere.** Figure 14-1's To line needs it; it renders as
  an underscore blank.
- **EAS has no field.** MCM 6.a(2) terminates a suspension early at expiration
  of enlistment. Every computed suspension end date carries that caveat.
- TTC 056 000's pay-grade field is "6-byte abbreviation" — ambiguous between
  rank abbreviation and grade code. Currently emits the rank.
- TTC 212 001's SEQ is assigned by MCTFS; renders as `[SEQ]`.
- Three UI strings still say "Release one is enlisted only", contrary to spec
  section 1.3, which says print no scope claim.
- The five `.mjs` harnesses in `tools/aa-forms/` are run by no npm script and
  no workflow. `verify_templates.mjs` guards a real failure mode (index URLs
  that resolve to nothing) and belongs in `test.yml`.
- Date picker weekday header renders oddly; Radix logs a missing
  `aria-describedby` on the article-picker dialog.

---

## 8. Working agreement with the user

- He is the reviewer and wants flaws led with, not buried.
- He supplies authoritative source by paste or attachment. Ask rather than
  paraphrase.
- He runs git himself. Prepare commit messages in `_scratch/` and hand him the
  command.
- Browser-test after each phase. The Chrome extension is connected and the dev
  server runs on `localhost:3000`.
- Subagents do the test-writing; brief them with the verbatim controlling
  paragraph and forbid them from editing `src/` or weakening an assertion.
