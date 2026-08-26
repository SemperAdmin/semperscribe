# NJP package: session handoff

Revised 2026-08-26 at the end of a third long session. Read this before
touching the NAVMC 10132 or the NJP package. It is not a summary of what
happened; it is the set of facts that cost time to learn and would cost the same
again.

THE BIGGEST CHANGE THIS SESSION: the RETURN LEG IS BUILT. A signed UPB can be
uploaded, read, and merged into the open document, and the app now derives the
pass from the file's own signatures instead of a clerk setting a dropdown. The
WRITE half is not built. Section 3A is the whole story and is the first thing
to read if you are picking up that work.

THE CHANGE BEFORE IT, still true: the UPB is a MULTI-PASS document. Created in
the app, exported, CAC-signed, re-uploaded, filled further, exported again,
across seven passes. Everything written before 2026-08-25 assumed a single
export. Section 3 covers what that invalidated.

A WARNING ABOUT THIS FILE AND THE SPEC, learned the hard way on 2026-08-25.
Six decision rows were written CLOSED on the day they were decided, describing
an import architecture as though it shipped. It had not been built. If a
document here or in the spec says the app DOES something, check that it does
before relying on it. The spec now carries a status vocabulary at the head of
its decision table for exactly this reason.

Authoritative documents, in order of precedence:

1. `docs/NAVMC_10132_SPEC.md` — the decision table (D-01 to D-61) and the
   validator tables. **The decision table is the record.** If this handoff and
   the spec disagree, the spec wins and this file is stale. READ THE STATUS
   VOCABULARY at the head of that table first: `DECIDED, UNBUILT` means the
   ruling stands and no code implements it, and five rows carry it.
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

Branch `feat/navmc-10132-unit-punishment-book`, HEAD `20fc796`, **3 commits
unpushed**. Check the refs yourself; do not assume.

Baseline: **2638 tests across 97 files**, both typechecks clean. Run them on the
machine you are on before you touch anything, so a failure you inherit is not
mistaken for one you caused.

**Uncommitted, and none of it mine:** `docs/GENAI_MIL_CORS_DEFECT_REPORT.md`
modified, plus untracked `docs/GENAI_MIL_TEAMS_REPLY.md`,
`scripts/genaimil-base-url-probe.html`, `scripts/probe-genaimil-bases.ps1`.
`package.json` and `package-lock.json` carry `@cantoo/pdf-lib ^2.9.1`, installed
by Stephen on 2026-08-26 for the incremental writer that is not yet built.

**Left on the device needing manual deletion.** The bridge cannot delete, only
rename, so every git lock this session hit is parked in
`_scratch/_to_delete/`, along with `__tmp-upb-test.pdf`, which is a COPY OF A
REAL SIGNED UPB carrying a Marine's name and EDIPI. Delete that one first.

### What this session built, newest first

```
20fc796  import menu items named after what they take
7528a25  Clear Form seeds the stage, the hole the D-43 guard could not see
5ce9b9e  signed fields render as closed, not as editable boxes
a7f74d4  a signed UPB routes through the existing import menu
4667fb0  map a read UPB onto the open document, file wins, differences flagged
5c23091  read an existing NAVMC 10132 back out of a PDF
11dd429  refuse form imports; stop the spec claiming a round trip it lacks
d4da90d  the vacation panel, the last piece of D-60 with no UI
c9e0db8  gate the appeal block per field, after measuring it is safe
7123007  parity test skips locally without LibreOffice, still fails in CI
45bd45f  sofficePath could never find LibreOffice on Windows
47c6758  read para 011202, and reverse what D-55 assumed it said
57ebd4a  D-55: the 011202 post-action chain
b8c4417  record the stage sweep and the second leak it found
c65aa4f  gate item 16 to pass 7
495350e  seed the stage on a new UPB
136545d  D-43: scope the export gate, fix the guard hiding a module
407b013  pass-1 UI: show only the sections the current stage owns
```

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

## 3A. The return leg: reading a signed UPB back in

Built 2026-08-26. Read this whole section before touching any of it.

### The four measurements that decide the design

Taken on a real CAC-signed UPB, `NAVMC 10132 - THOMPSON JAMAL R.pdf`, at end of
pass 2. Two of the four contradicted what the spec said, so take nothing here on
authority; re-measure if you doubt it.

1. **74 fields, 52 non-empty, all readable through `getForm()`.** The earlier
   verdict that a signed UPB "cannot be read" was about the TEXT extractor,
   which reads the page content stream and sees none of a form's values. An
   AcroForm reader sees all of them.
2. **Seven signature fields, exactly two carrying `/V`.** The file announces its
   own position in the pass sequence. No carrier needed for the stage.
3. **All seven `/Lock` dictionaries readable**, six `/Include` naming 43 to 70
   fields, and `16 FINAL ADMIN INIT` `/All`.
4. **ZERO fields carry the ReadOnly flag**, with two signatures applied. D-37
   says "signing sets ReadOnly on every field the lock names". ON A REAL FILE IT
   DOES NOT. Nothing reads `/Ff`; locks come from the `/Lock` dictionaries of
   signatures carrying `/V`. There is a note on every read saying so, to stop
   someone adding the flag check back.

### The modules, in the order data moves

| module | job |
| --- | --- |
| `navmc10132-pdf-read.ts` | parse: values, signed signatures, locked set, stage |
| `navmc10132-pdf-to-form.ts` | map onto document state, flag differences |
| `navmc10132-pdf-load.ts` | recognize a UPB, orchestrate, build the report |
| `navmc10132-locks.ts` | turn locked field names into keys the UI can ask about |
| `LoadReportPanel.tsx` | show the clerk what the load found |

Entry point is `useDocumentImport.startImport`, which routes a recognized 10132
to the loader BEFORE the text extractor runs.

### Rules that are not obvious here

- **The pass is the HIGHEST signature applied, never the count.** A case with no
  appeal never gets items 11 through 14 signed, so a closed-out document carries
  three signatures. Counting calls it pass 4 and reopens the whole appeal block
  on a finished case.
- **Recognition is by FIELD NAMES, never by text.** The text layer is the
  blank's boilerplate whether the file is empty or full. A quorum of six of ten
  markers, so a form revision renaming a field does not make files unreadable.
- **The load MERGES; it must never call `resetDocumentState`.** That is what
  `applyImport` does, and it is right for a text import and catastrophic here.
  Stephen's rule: the app updates what is not updated yet and does not preload
  anything.
- **"The file is the truth" is read narrowly, and he confirmed it.** The file
  wins WHERE THE FILE SAYS SOMETHING. An empty field is the file not having
  reached it, not an instruction to erase app data, because a clerk at pass 3
  has typed item 6 and the pass-2 file is blank there. Checkboxes are exempt:
  unchecked is an answer. To make it absolute, return `fromFile` unconditionally
  from `resolve()` in the mapper.
- **A conflict is not any difference.** Loading into a fresh document differs on
  every field the file carries: twelve flags for a load where nothing is in
  dispute, which teaches a clerk to dismiss the flag. Only two are flagged, both
  sides disagreeing, or the file empty where the app is not.
- **Four fields do not come back as structure.** Items 6, 7, 21 and the Booker
  statement are RENDERED from data the form cannot hold. Nothing parses them
  back; guessing punishment codes out of a rendered sentence invents a legal
  record. They are reported as carried-from-file and left in the file untouched.
  This costs nothing at a pass-2 upload, where all three are empty, and only
  bites on a late re-upload.
- **Items 23-25 are a cross-check, never a source.** Page 2's identity copy is
  filled by the form's own calculate scripts. Reading it as data lets a stale
  calculation overwrite items 18-20.
- **Item 19 is never split back into rank and pay grade.** "Cpl, E4" is comma
  separated and so is "GySgt, E7", and nothing guarantees the next one is.
- **Item 21 is a RichText field and `getText()` THROWS on it.** Falls back to
  reading `/V`. `/RV` is ignored: rebuilding text from its XHTML invents
  whitespace. The blank flags the field, the real signed file does not, so both
  shapes exist in the wild.
- **Locks are not the stage.** The stage says which pass you are at and hides
  controls whose pass has not arrived. A lock says a signature has closed a
  field, and shows it as closed with the value still readable. A document at
  pass 3 that nobody signed has NO locks; that is the ordinary case.

### The next piece: the incremental writer

`@cantoo/pdf-lib` is installed and unused. The path is PROVEN against the real
file but exists in no committed code:

```
load original -> takeSnapshot() -> set only unlocked, changed fields
-> markRefForSave() on every mutated ref AND its widgets
-> saveIncremental(snap, {useObjectStreams: true})
-> APPEND the result to the original bytes
```

Measured result: 5,144,151 bytes preserved byte-for-byte as the prefix, a
686-byte delta appended, `/ByteRange` count unchanged, the new value reading
back, the locked accused name untouched.

Three things that will cost time if not known:

- **`saveIncremental` returns ONLY THE DELTA.** It is not a whole file. Writing
  it out alone produces a 686-byte "PDF". Append it to the original.
- **`useObjectStreams: true` here, which is the OPPOSITE of the Phase 0 rule for
  the full-rewrite export.** Do not harmonize them. A classic xref table
  appended to this form's xref stream is rejected by Acrobat with "Unexpected
  byte range values defining scope of signed data", a structural rejection
  thrown before any hash check.
- **Mutating an existing object is not enough.** Without `markRefForSave` on the
  ref and on its widgets, the delta carries a font and an appearance stream and
  no `/V`, and the write silently does nothing.

The writer must refuse every field in the loaded file's locked set. That is
Stephen's ruling and it is also what keeps the signatures valid. The UI half is
already built (`navmc10132-locks.ts`); the writer half is not.

After the writer: point the live preview at the loaded file as its base, so what
a clerk sees is their actual document rather than a fresh blank.

---

## 4. Module map

Everything below is pure and lib-level unless marked.

### The return leg (new 2026-08-26, see section 3A)

- `navmc10132-pdf-read.ts` — parse a UPB PDF: values, signed signatures, the
  locked set from `/Lock` dictionaries, and the pass.
- `navmc10132-pdf-to-form.ts` — map a read onto document state, file wins where
  the file says something, differences flagged.
- `navmc10132-pdf-load.ts` — recognize a UPB by field-name quorum, orchestrate
  the two above, build the clerk-facing report.
- `navmc10132-locks.ts` — locked field names to the document-state keys the UI
  asks about. Carries a meta guard against drifting from the mapper.
- `LoadReportPanel.tsx` — what the load found, kept on document state so it
  survives a save.

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

- **Loading the user's own file rather than a fixture.** Every interesting fact
  in section 3A came from one real signed UPB, and two of them contradicted the
  spec. The blank does not have signatures, so it cannot tell you what a
  signature does.
- **Running all four shipped blanks through the real extractor** instead of
  reasoning about one. Three of them turned out to be XFA, which the reasoning
  had missed entirely, and that widened a fix from one form to any XFA form.
- **Reading the source paragraph, again.** Para 011202 reversed D-55's central
  claim. The row had been written from a summary made while the PDF was open,
  which felt like a citation and was not one.

Working instruction: **render it and look at it.** A passing suite is not
evidence that the output is right. And a document saying the app does something
is not evidence either: six spec rows said the round trip shipped when no line
of it existed.

---

## 7. Backlog

### Start here

1. **The incremental writer.** Section 3A has the proven path, the three traps,
   and the dependency is already installed. Without it the round trip is
   half a feature: a clerk can load a signed file, fill the next pass, and then
   has no way to export that does not break both signatures. Nothing else in
   this list matters as much.
2. **The live preview using the loaded file as its base.** Stephen asked for
   this in the same breath as the upload: "This is what we will use in the
   preview." Today it still renders from the blank, so a loaded document
   previews as though nothing was signed.
3. **V-23 through V-28**, the six re-upload validators. They were specified
   before the read half existed and can now actually be written. V-23 (refuse
   to write a locked field) is the writer's own guard and belongs with item 1.

### Then

**Specified and unbuilt.** D-37, D-40, D-41, D-45 and D-46 are `DECIDED,
UNBUILT` in the spec; V-23 through V-30 and W-17 through W-19 have no code.
D-51, D-55, D-60 and D-61 are built, UI included.

**A state carrier in the exported PDF.** Not blocking, see below, but it is the
only way `vesselException`, `punishments`, `suspensions`, `remarks` and
`vacations` survive a round trip as STRUCTURE rather than as rendered strings.

**Test remediation, P3 to P5.** P1 and P2 are done. Remaining: annotate the three
reversed assertions in `navmc10132-acroform.test.ts` (they defend behaviour D-40,
D-41 and D-42 overturned), unit tests for `navmc10132-booker` and
`navmc10132-capacity`, and `verify_templates.mjs` into `test.yml`.

**The live preview debounce.** It regenerates on every change and stalls the
renderer for 10 to 30 seconds. It cost about six minutes of every browser stage
sweep this session and makes ordinary typing painful. Cheap to fix, and it slows
every future UI phase until someone does.

**Dead `rights` section** in `Navmc10132Definition.sections`.

**What a PDF round trip can and cannot carry, now that the read half exists.**
Recoverable as STRUCTURE: items 1 and 5 as offense rows, victim row A, and every
one-to-one scalar (items 17, 18, 20, 2, 3, 4, 6-date, 8, 10-15, 16). NOT
recoverable: `punishments`, `suspensions`, `remarks` and `vacations`, which are
COLLAPSED into rendered strings on export; victims B-E, which go to item 21
prose; and `vesselException`, `accusedYearsOfService` and `forfeitureBasisGrade`,
which have no field at all. `stage` needs no carrier: the file's signatures give
it. An embedded JSON carrier is the only mechanism for the rest.

**`.nldp` and the library still carry everything**, because both serialize
`formData` directly. That is the lossless path between sessions and remains the
right one for parking a case. The PDF path is for the pass boundary, where the
signatures are.

**A hole in the stage-seeding guard, PARTLY CLOSED 2026-08-26.**
`resetDocumentState` now seeds the stage and the guard checks it (7528a25).
`handleImport` still escapes the scan, because it spreads a payload, so a
`.nldp` saved before `stage` existed imports with `stage` undefined and the
export gate reads absent as `'complete'`.

**The CMC (JA) defect report needs a revision.** `docs/NAVMC_10132_DEFECT_REPORT.md`
was delivered 2026-08-24 with thirteen numbered findings. Since then: 011402.G was
DOWNGRADED and is no longer an MCO defect (D-57, the MCO transcribes 10 U.S.C. 815(e)
faithfully and the dead text originates in the statute), and two new form findings
have accumulated against block 16, both from D-55. The first is the lock collision:
`16 FINAL ADMIN INIT` carries `/Action /All`, and TWO steps of MCO 5800.16 Vol 14
para 011202 write the original UPB after that signature. The second is a capacity
defect: 011202 directs block 16 to be updated with the vacated punishment
information from the commander's letter, and block 16 is exactly two fields, a unit
diary number and a date, neither of which can hold it.

**Tier 2 NJP package.** Vacation notice and execution letter, both from one
template per D-50. Appeal endorsement. Neither new module has tests.
**The handoff ordering is load-bearing:** `handleLoadTemplateUrl` calls
`handleImport`, which REPLACES the document. Save the 10132 to the library
(`libPut`, IndexedDB) BEFORE seeding the letter, or the case is lost.

**Tier 3, unstarted.** A-1-h punitive letter, conditional on N16/N17 being
written. A-1-g appeal rights. A-1-f CO script buttons, where the user has never
ruled on the two-moments split, which is the same shape as D-50.

**Known gaps**

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
- **Do not leave test state in his working document.** Browser tests write to
  the autosaved document, and a fake load report with a made-up filename sat in
  his app overnight and cost him a bug report. Clear Form at the end of a
  browser session, or use a filename that cannot be mistaken for a real one.
- **Do not put his data in the repo.** A real signed UPB was copied into
  `public/` to test the dev server and had to be moved back out. It carries a
  Marine's name and EDIPI. Serve it from somewhere else or test in node.
- **When he says something does not work, reproduce it before theorising.** The
  "file not showing" report was a picker filter, not a bug, and the load he was
  looking at was a stale panel from a test of mine. Both were findable in one
  pass against his actual file.
