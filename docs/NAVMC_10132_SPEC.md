# NAVMC 10132 (Unit Punishment Book) - Form and Policy Audit

Status: audit complete, verified by adversarial review, no code written. Awaiting build-plan approval.
Audited 2026-08-23. Source form: NAVMC 10132 (REV. 08-2023) (EF), 3 pages, 74 AcroForm fields.
Companion to `docs/NAVMC_10922_SPEC.md`. Build pattern follows `docs/NAVMC_10922_BUILD_PLAN.md`.

Every measurement below was taken from the supplied blank with pypdf and pdf-lib and then
re-taken independently in a refutation pass. Twenty defects were found in the first draft of
this document and corrected. Items still marked UNVERIFIED are not to be relied on.

---

## 1. Authority chain

| Source | Date | Status | Governs |
|---|---|---|---|
| Article 15, UCMJ, 10 U.S.C. 815 | Current | Current | NJP power |
| MCM Part V | 2024 ed. is current; VERIFIED ONLY against pre-2024 extracts | See 1.4 | Minor-offense limit (1.e), limitations (1.f), ceilings (5.b), combination (5.d), appeal (7) |
| JAGINST 5800.7G (JAGMAN) | Current | Current | Article 31 advice, appeal procedure |
| MCO 5800.16 Vol 14 | 18 MAY 2021 | Current, PARTIALLY SUPERSEDED | Enlisted NJP procedure, UPB filing and retention |
| MCO 5800.16 Vol 15 | Amended by MARADMIN 427/23 | Current | Officer NJP. REQUIRES the UPB at 010502.B.1. Out of app scope by product choice, see D-14. Unaudited |
| MARADMIN 427/23 | 281800Z AUG 23 | Current | Amends Vol 14 and Vol 15. Deletes 011105.A-.R |
| NAVMC 10132 (REV. 08-2023) instructions, page 3 | Aug 2023 | Current | Item-by-item preparation. THE controlling map |
| Form Privacy Act statement | On the form | Current | Collection authority for all items incl. 22 |
| 10 U.S.C. 486 | REPEALED 23 Dec 2024 | DEAD | Was the reporting purpose behind item 22 |

### 1.1 Finding: the uploaded MCO is superseded on exactly the section you need

MARADMIN 427/23 deleted MCO 5800.16 Vol 14 paragraphs 011105.A through 011105.R in their
entirety and replaced them with one sentence: "For detailed preparation instructions, refer to
the instructions section of the NAVMC 10132 Unit Punishment Book form."

That matters because the 2021 order and the 2023 form disagree on item numbering. Confirmed
divergences, each traced to a surviving MCO paragraph or to the form's own instruction page:

| Content | MCO Vol 14 (2021) | NAVMC 10132 REV 08-2023 |
|---|---|---|
| Counsel-consultation certification | item 4 (011105.D) | folded into item 2 |
| Unauthorized absence over 24 hrs | item 5 (011105.E) | item 4 |
| Remarks | item 16 (011105.P) | item 21 |
| Final administrative action | item 17 (011105.Q) | item 16 |
| Victim demographics | does not exist | item 22 |
| Accused data duplicate | does not exist | items 23-25 |

Two further divergences are commonly asserted and are NOT supported by the supplied MCO text:
findings placement, and whether MCO item 18 was "Unit." MCO 011105.R disposes of its items
18-21 with "self-explanatory," so the order cannot establish either. Marked UNVERIFIED.
Do not cite them.

Rule for this build: every preparation-format validator cites the FORM instruction page.
MCO Vol 14 remains the citation for authority to impose (0103), jurisdiction (0104-0105),
forfeiture math (0109), suspension and set-aside (0110), UPB filing and retention (011110),
vacation (0112), and judge-advocate review triggers (0114). Those survive intact.

MARADMIN 427/23 also amended 011103 to make electronic preparation the preferred method.
That is the policy hook for this feature existing at all.

### 1.2 Finding: item 22's reporting statute is repealed

MARADMIN 427/23 lists 10 U.S.C. 486 as reference (a). That section was repealed by
Pub. L. 118-159, div. A, title V, section 566(b)(1), 23 Dec 2024, 138 Stat. 1905. No successor
exists in 10 U.S.C. chapter 23; sections 481 and 481a are survey provisions, not military-justice
demographic reporting.

This does NOT invalidate item 22. The authority to COLLECT is the form's own Privacy Act
statement (10 U.S.C. 5013, 5041, 801-946a, 2683, 8046, 8088; E.O. 13825; E.O. 14103;
JAGINST 5800.7G; MCO 5800.16 Vol 14-15; SORNs M01070-6 and DoD 0006). What is now unmoored is
the downstream reporting PURPOSE. App consequence: cite the Privacy Act statement, never
10 U.S.C. 486. Add the repeal to the defect report as a second, independent finding.

### 1.3 Officer NJP is out of scope for release 1

MARADMIN 427/23 amended Vol 15 paragraphs 010502.B.1, 010502.B.5, 010605.D, and Figure 15-5 to
require the UPB in officer NJP cases. VERIFIED 2026-08-24 against the message text on marines.mil:
010502.B.1 reads "The Unit Punishment Book (UPB) will be used in officer NJP cases." Vol 15 itself
is still unaudited. Release 1 is enlisted only, and the
app must not print "enlisted only" anywhere in UI copy, because the paper form now serves both.
Say nothing rather than say something wrong.

### 1.4 MCM edition gate, partially retired

MCO 5800.16 Vol 14 cites the 2019 MCM throughout. The current edition is the 2024 MCM.

Two independent public extracts of Part V were pulled and compared. Both agree on the substance
of 1.e, 1.f, and 5.b, and the two paragraph texts reproduce each other closely enough to treat
the SUBSTANCE as verified. Neither is confirmed as the 2024 edition: one still carries
"confinement on bread and water or diminished rations," language struck from 10 U.S.C. 815
effective 1 Jan 2019, so it is a 2016-era text. The full 2024 MCM PDF is too large to fetch
Part V from directly.

Verified across both extracts and safe to cite:
- 1.e Minor offenses. A minor offense is ordinarily one whose GCM maximum excludes a
  dishonorable discharge and confinement over one year.
- 1.f Limitations, five subparagraphs: (1) double punishment prohibited, (2) increase in
  punishment prohibited, (3) multiple punishment prohibited for offenses from a single incident
  or course of conduct, (4) two-year statute of limitations, (5) no NJP for an offense tried by
  a court deriving its authority from the United States.
- 5.b structure and every day and pay limit, matching 10 U.S.C. 815(b) except as noted below.

Residual debt: confirm the exact 2024 wording of 1.e and 1.f before a validator message quotes
them verbatim. Paraphrase with a paragraph cite until then. Get Part V from a Marine Corps
network copy rather than a commercial mirror.

---

## 2. Form forensics

Container: plain AcroForm. NOT LiveCycle XFA. First non-XFA official form in the repo.
NAVMC 10274, 118(11), and 10922 all route through `xfa-form-fill.ts`; 10132 cannot.

| Property | Value |
|---|---|
| Pages | 3 (page 3 is instructions, zero widgets) |
| Total fields | 74 |
| Text fields | 32 (4 read-only: `2 BOOKER`, 23, 24, 25) |
| Dropdowns | 33, all combo. Only sex, race, and ethnicity are ALSO editable |
| Checkboxes | 2, `/Off` and `/Yes` |
| Signature widgets | 7 |
| `/AcroForm /SigFlags` | 3 |
| `/Root /Perms` | `/UR3`, `adbe.pkcs7.detached` |
| `/NeedAppearances` | absent |
| `/CO` calculation order | 3 fields: items 23, 24, 25 |
| Document-level JavaScript | none |
| Field-level JavaScript | 6 validate, 3 calculate, 3 on-blur, 9 date format+keystroke pairs (18 actions) |

### 2.1 Complete field map

Page 1:

| # | Field name | Type | Notes |
|---|---|---|---|
| 1A-1E | `1A ARTICLE` .. `1E ARTICLE` | Dropdown, combo | 168 `/Opt` entries: one blank plus 167 selectable offenses across 89 article numbers. Identical list on all five |
| 1A-1E | `1A SUMMARY` .. `1E SUMMARY` | Text | cap 85 |
| 2 | `2 DEMAND` | Dropdown, combo | 3 options, NO blank entry |
| 2 | `2 COUNSELOPP` | Dropdown, combo | export `have not` / `have`; display `have not` / `   have` |
| 2 | `2 BOOKER` | Text, READ-ONLY | NOT static. Rewritten by three blur scripts. SEE DEFECT 3.2 |
| 2 | `2 ACC REFUSE TO SIGN` | Checkbox | `/Yes` |
| 2 | `2 ACC ELECTION AND RIGHTS DATE_af_date` | Text, date | `yyyy-mm-dd` |
| 2 | `2 ACC ELECTION AND RIGHTS SIGNATURE` | Signature | |
| 3 | `3 RIGHTS ATTEST DATE_af_date` | Text, date | |
| 3 | `3 RIGHTS ATTEST SIGNATURE` | Signature | |
| 4 | `4 CURRENT UAS OVER 24 HRS AND MARKS OF DESERTION` | Text | cap 152 |
| 5 | `1A FINDING` .. `1E FINDING` | Dropdown, combo | export `Guilty` / `Not Guilty`; DISPLAY `G` / `NG`. Blank is a single space. SEE DEFECT 3.3 |
| 6 | `6 PUNISHMENT IMPOSED` | Text | cap 123. Carries a validate script |
| 6 | `6 PUNISHMENT IMPOSITION DATE` | Text, date | cap 26 |
| 7 | `7 SUSPENSION IF ANY` | Text | cap 152 |
| 8 | `8 NJP AUTHORITY NAME TITLE SERVICE` | Text | cap 101 |
| 8A | `8A NJP AUTHORITY GRADE` | Text | cap 24 |
| 8B | `8B NJP AUTHORITY EDIPI` | Text | cap 24 |
| 9 | `9 NJP AUTHORITY SIGNATURE` | Signature | |
| 10 | `10 DATE OF DISPOSITION NOTICE` | Text, date | cap 26 |
| 11 | `11 APPEAL ADVISEMENT DATE_af_date` | Text, date | cap 17 |
| 11 | `11 APPEAL ADVISEMENT SIGNATURE` | Signature | |
| 12 | `12 INTEND APPEAL` | Dropdown, combo | blank + 3, incl. `the accused refuses to sign.` |
| 12 | `12 APPEAL INTENT DATE_af_date` | Text, date | cap 17 |
| 12 | `12 APPEAL INTENT SIGNATURE` | Signature | |
| 13 | `13 NOT APPEALED` | Checkbox | `/Yes` |
| 13 | `13 DATE OF APPEAL IF ANY_af_date` | Text, date | cap 26 |
| 14 | `14 APPEAL DECISION` | Text | cap 122 |
| 14 | `14 APPEAL DECISION DATE_af_date` | Text, date | cap 17 |
| 14 | `14 APPEAL DECISION SIGNATURE` | Signature | tooltip present |
| 15 | `15 DATE OF NOTICE OF APPEAL DECISION_af_date` | Text, date | cap 26 |
| 16 | `16 FINAL ADMIN UD` | Text | cap 15 |
| 16 | `16 FINAL ADMIN DTD` | Text | cap 15 |
| 16 | `16 FINAL ADMIN INIT` | Signature | Named INIT, but it is a signature widget, not text |
| 17 | `17 UNIT` | Text | cap 152 |
| 18-20 | `18 ACCUSED FULL NAME`, `19 ACCUSED RANK/GRADE`, `20 ACCUSED EDIPI` | Text | 101 / 24 / 24 |

Page 2:

| # | Field name | Type | Notes |
|---|---|---|---|
| 21 | `21 REMARKS` | Text, MULTILINE + RICHTEXT | `/Ff` 33558528. Spellcheck is ON. `/RV` absent in the blank. 539 x 519 pt, approx 55 lines |
| 22 | `22A..22E VICTIM STATUS` | Dropdown, combo, NOT editable (`/Ff` 131072) | SEE DEFECT 3.1 |
| 22 | `22A..22E VICTIM SEX` | Dropdown, combo, editable | blank + Male / Female / Unknown |
| 22 | `22A..22E VICTIM RACE` | Dropdown, combo, editable | blank + 7 values |
| 22 | `22A..22E VICTIM ETHNICITY` | Dropdown, combo, editable | blank + Hispanic or Latino / Not Hispanic or Latino / Unknown |
| 23-25 | `23 ACCUSED FULL NAME`, `24 ACCUSED RANK/GRADE`, `25 ACCUSED EDIPI` | Text, READ-ONLY | Populated only by calculate JS. SEE DEFECT 3.4 |

### 2.2 Character capacity, measured

Every widget's `/DA` is `/Arial 8 Tf 0 g`. Arial metrics are not embedded, so capacity was
computed with Helvetica as the metric-compatible substitute: usable width = rect width minus
2pt padding per side; average advance 3.499pt at 8pt. There is no auto-shrink. Overflow clips
silently and without warning.

Tightest fields carrying free text, in order:

- `16 FINAL ADMIN UD` and `16 FINAL ADMIN DTD`: 15 each
- `11`, `12`, `14` date fields: 17 each
- `8A NJP AUTHORITY GRADE`: 24
- `1A SUMMARY` through `1E SUMMARY`: 85. The MCO's own worked example
  "UA fr HqCo, HqBn, 3d MarDiv dur the prd 0800, 11 May 12 through 2359, 15 May 12."
  is exactly 80 characters. Real summaries will exceed 85 constantly.
- `6 PUNISHMENT IMPOSED`: 123. Combination punishments overflow this routinely.
- `14 APPEAL DECISION`: 122
- `4`, `7`, `17`: 152 each

Build requirement: live character meters on 1A-1E summary, 6, 7, 8A, 14, 16 UD, 16 DTD, and 17,
matching the field-93 meter already shipped in `Navmc10922Sections.tsx`. The escape hatch
prescribed by MCO 011103 is to type "See Supplemental Page" and continue in item 21.

---

## 3. Defects in the official form

Defects in the government artifact, not in the app. Each forces a design decision.

### 3.1 Victim status carries two vocabularies, and rows B-E are not editable (CRITICAL)

Row 22A offers the vocabulary printed in the form's own instructions:

    Military, Military (spouse), Civilian (spouse), Civilian (dependent),
    Civilian (DON employee), Civilian (other), Other, Unknown

Rows 22B, 22C, 22D, and 22E offer a different vocabulary found nowhere in the instructions and
nowhere in MCO 5800.16:

    U.S. Marine, U.S. Marine Reservist, U.S. Military, U.S. Military Reservist,
    U.S. Military Dependent, U.S. Civilian, Foreign National, Unknown

Verified against raw `/Opt` on objects 113 (row A) and 129, 126, 115, 121 (rows B-E). The word
"victim" does not appear in MCO Vol 14 at all.

The two vocabularies are not crosswalkable. There is no widget value for "Military (spouse)",
"Civilian (spouse)", or "Civilian (DON employee)". "U.S. Military Dependent" conflates spouse
and dependent. Any mapping loses the exact distinction the demographic block exists to record.

And rows B-E cannot be worked around by writing free text: `/Ff` is 131072, which is Combo with
the Edit bit CLEAR. They are closed lists. pdf-lib's `select()` will reject a non-listed value,
and a raw `/V` write produces non-conforming PDF that a re-render may drop.

Three options, none clean:

1. Crosswalk to the widget vocabulary for rows B-E. Rejected: silently corrupts the record.
2. Raw `/V` write outside `/Opt`. Rejected: non-conforming, and a downstream re-save may drop it.
3. Use row A only, and route victims 2 through 5 into item 21 using the instruction's own
   prescribed format, `YYYY-MM-DD ITEM 22: Additional Victims:` followed by lettered rows.

Recommend option 3. It uses a format the form itself prescribes, keeps one vocabulary across
every victim, and writes only conforming PDF. Cost: rows B-E stay visibly blank on a
multi-victim UPB, which will look wrong to a reviewer, so the app states in the export toast
that additional victims were recorded in item 21 and why.

Route a defect report to CMC (JA) through the MARADMIN 427/23 POCs. Same pattern as the
GenAI.mil CORS finding: measure it, write it up, route it.

### 3.2 The Booker statement is generated by JavaScript the app cannot run (CRITICAL)

`2 BOOKER` looks like static artwork. It is not. Three identical on-blur scripts, on `2 DEMAND`,
`2 COUNSELOPP`, and `2 ACC REFUSE TO SIGN`, rewrite it from a five-branch decision:

| Condition, evaluated in this order | `2 BOOKER` value |
|---|---|
| demand == vessel exception | `(No Booker statement due to the vessel exception, United States v. Mack, 9 M.J. 300, 320 (C.M.A. 1980).)` |
| refuse-to-sign checked | `(No Booker statement due to refusal to sign.)` |
| demand == demand trial and refuse NJP | `(No Booker statement due to refusal of NJP.)` |
| counsel opportunity == `have not` | `(No Booker statement; no opportunity to consult with counsel.)` |
| demand == do not demand trial | `BOOKER STATEMENT: Having been advised of the above and fully understanding my rights, I choose to accept NJP.` |

The blank ships with the LAST branch already stored in `/V`. So a pdf-lib fill of a case where
the accused refused to sign, demanded trial, invoked the vessel exception, or had no counsel
opportunity produces a UPB that affirmatively states the accused accepted NJP. That is a false
statement on a legal record, generated silently.

The same scripts also FORCE a coupling: when refuse-to-sign is checked and demand still reads
"I do not demand trial," the script overwrites demand with "I demand trial and refuse
non-judicial punishment." The app must replicate that coupling or its output will diverge from
what Acrobat produces from the same inputs.

Build requirement: `navmc10132-utils.ts` implements `bookerStatement(demand, counselOpp, refused)`
as a pure function reproducing the five branches in order, plus `coerceDemand(demand, refused)`.
The emitter unlocks `2 BOOKER`, writes the computed value, and restores the read-only flag.
A unit test asserts all five branches and the coercion against the decoded script.

### 3.3 Findings dropdown export values are the long strings, not G and NG

`/Opt` on the findings fields is `[' ', ['Guilty','G'], ['Not Guilty','NG']]`. Per
ISO 32000-1 Table 231 each pair is [export value, display text]. So the EXPORT values are
`Guilty` and `Not Guilty`; `G` and `NG` are only what is displayed in the narrow column.

Independently corroborated by the form's own item-6 validate script, which tests
`this.getField("1A FINDING").valueAsString != "Guilty"`.

An emitter that writes `G`, following the human-readable item-5 instruction, writes an invalid
export value. This is the single easiest way to ship a broken 10132 emitter. The selector table
carries export values only, and a test asserts it.

### 3.4 Items 23-25 depend on JavaScript the app cannot run (HIGH)

Items 23, 24, and 25 duplicate accused name, rank, and EDIPI onto page 2. They are read-only,
populated by three calculate scripts of the form
`event.value = this.getField("18 ACCUSED FULL NAME").valueAsString`.

pdf-lib executes no PDF JavaScript, so a fill leaves page 2's identity block empty. MCO 011103
requires additional sheets to carry the Marine's name and EDIPI, so a blank identity block is a
compliance failure, not a cosmetic one. Fix: unlock, write directly, restore the flag.

### 3.5 A validate script references a field that does not exist (LOW, but consequential)

All five article dropdowns carry:

    if (event.value == "") {
        if (event.target.name == "1A ARTICLE" || event.target.name == "1A OFFENSE") {
            app.alert("You must enter an offense or NJP cannot proceed.");
        }
    }

The inner test can never be true for 1B through 1E, so the alert is dead on four of five fields.
And `1A OFFENSE` is not a field in this document; the field is `1A SUMMARY`. The author renamed
the field and did not update the script.

Consequence: the official form does not actually enforce "at least one offense." The app must.
Becomes blocker V-01.

### 3.6 Filling the form invalidates the Adobe usage-rights signature (ACCEPTED COST)

`/Root /Perms /UR3` is an `adbe.pkcs7.detached` usage-rights signature. Any byte-level rewrite
breaks its ByteRange. Acrobat and Reader will flag the extended-rights banner as invalid.

You accepted this cost with the AcroForm path. Practical effect: a Reader-only user may lose
save rights and will see a signature warning. Anyone CAC-signing item 9 or 16 is on full
Acrobat and is unaffected in function. The export toast says this in one line.

### 3.7 `2 COUNSELOPP` display string carries leading whitespace (LOW)

Export values `have not` and `have`. The display string for `have` is `   have`, three leading
spaces, to center the word. Select by export value, never by label.

### 3.8 `21 REMARKS` is a RichText field (LOW, watch item)

`/Ff` 33558528 = Multiline + RichText. Acrobat may prefer `/RV` over `/V` on a rich-text field.
`/RV` is absent in the blank, and pdf-lib writes `/V` only, so the first fill is fine. The
emitter must assert `/RV` stays absent after any round trip, and the Phase 0 probe checks
whether Acrobat re-renders the value. If it does not, clear the RichText flag on write.

---

### 3.9 The signature lock lists name fields that no longer exist (CRITICAL)

Four of the seven `/SigFieldLock` `/Fields` arrays carry 29 references to field names
absent from the form. The form was revised, fields were renamed away from FINAL
DISPOSITION, and the lock arrays were never updated.

| dead name in the lock list | actual field on the form |
|---|---|
| `6 FINAL DISPOSITION TAKEN` | `6 PUNISHMENT IMPOSED` |
| `6 FINAL DISPOSITION DATE` | `6 PUNISHMENT IMPOSITION DATE` |
| `8 FINAL DISPOSITION AUTHORITY NAME TITLE SERVICE` | `8 NJP AUTHORITY NAME TITLE SERVICE` |
| `8A FINAL DISPOSITION AUTHORITY GRADE` | `8A NJP AUTHORITY GRADE` |
| `8B FINAL DISPOSITION AUTHORITY EDIPI` | `8B NJP AUTHORITY EDIPI` |
| `9 NJP PROPER SIGNATURE` | `9 NJP AUTHORITY SIGNATURE` |
| `10 DATE OF NOTICE TO ACCUSED OF FINAL DISPOSITION TAKEN_af_date` | `10 DATE OF DISPOSITION NOTICE` |
| `4 CURRENT UAS OVER 24 HRS` and `5 CURRENT MARKS OF DESERTION` | `4 CURRENT UAS OVER 24 HRS AND MARKS OF DESERTION` |

Dead counts: item 9 lock 6 of 58, item 11 lock 7 of 61, item 12 lock 7 of 64, item 14
lock 9 of 70. The item 2 lock (43) and the item 3 lock (45) are clean.

CONSEQUENCE. Items 6, 6 date, 8, 8A, 8B, 9 and 10 are locked by NO signature until the
terminal `16 FINAL ADMIN INIT`, whose `/Action /All` locks everything. So the signature
that imposes punishment does not lock the punishment. After the imposing officer signs,
the punishment text, its date and the officer's own identity stay editable, and changing
them falls outside every FieldMDP list, so Acrobat raises no invalidity flag. A permanent
record's punishment can be altered post-signature and still verify clean.

This is the strongest finding in the CMC (JA) report: precise, reproducible, and fixed by
correcting six strings in four lock dictionaries. App mitigation is D-45 and V-27.

---

## 4. Round-trip probe, measured

pdf-lib 1.17.1, Node 22, against the supplied blank:

    field classes: PDFTextField 32, PDFSignature 7, PDFDropdown 33, PDFCheckBox 2
    filled: 63 of 74
    skipped: 7 signature widgets, 4 read-only text fields
    updateFieldAppearances(): OK
    re-extract: 64 fields non-empty (63 written plus the pre-set Booker value)
    /Perms /UR3: dictionary survives, signature is invalid
    poppler render of page 1: all 63 values visible and correctly positioned

Conclusions carried into the build plan:

1. The pdf-lib AcroForm path works. No XFA machinery needed.
2. `updateFieldAppearances()` must be called or Reader shows empty widgets.
3. Read-only unlock is required for 23, 24, 25, AND `2 BOOKER`. The earlier assumption that
   `2 BOOKER` could be left untouched was wrong; see defect 3.2.
4. Signature widgets are left empty by design. Items 9 and 16 are CAC-signed downstream.
5. No auto-shrink. Capacity enforcement is the app's job.

### 4.1 Open probe: does the pdfjs preview pane render generated appearances

A pdfjs 4.8.69 text-layer extraction of the filled output did NOT surface the written values.
That is expected, because widget values live in annotation appearance streams rather than the
page text layer, and the repo's preview pane renders annotations. It is NOT proof the preview
works. Phase 0 must render the filled bytes through the app's actual pdfjs preview component
and look at it. If widgets do not paint, a flattened generator is required and scope grows by
roughly the 10922 Phase 5 effort. This is decision D-2 and it gates the estimate.

---

## 5. UI design

Nine sections, ordered to the paper workflow in the form's ELECTRONIC SIGNING AND LOCKING note:
prepare 1, 17-20, 22 first; accused completes 2; CO completes 3; 4-11 at the hearing; accused
completes 12; then 13-16.

| # | Section | Fields | Component |
|---|---|---|---|
| 1 | Accused and Unit | 17, 18, 19, 20 | DynamicForm + UNITS search dialog |
| 2 | Offenses and Findings | 1A-1E article, summary, finding | Custom, collapse-and-add, 5-row cap |
| 3 | Accused Election (item 2) | demand, counsel opp, refusal, date, live Booker preview | Custom, owns the Booker engine |
| 4 | CO Rights Certification (item 3) | date | DynamicForm |
| 5 | Absence and Desertion (item 4) | UA text | DynamicForm, shown only when Art. 85 or 86 present |
| 6 | Punishment (6, 7, 8, 8A, 8B, 10) | structured punishment builder over MCTFS codes N01-N17, dates, authority block | Custom, capacity meter, ceiling checks. See section 11 |
| 7 | Appeal (11-15) | advisement, intent, dates, decision | DynamicForm |
| 8 | Victims (item 22) | 5 rows x 4 fields | Custom, row A to the form, rows B-E to item 21 |
| 9 | Remarks and Final Action (21, 16) | remarks, UD#, DTD | Custom, structured remark composer |

### 5.1 Section 3 shows the Booker statement live

Because the Booker text is derived and legally consequential (defect 3.2), section 3 renders the
computed statement read-only, directly under the three controls that determine it, with the
branch named. A clerk who checks "refused to sign" watches the statement change from acceptance
to "(No Booker statement due to refusal to sign.)" and sees the demand dropdown coerce itself.
This makes an invisible JavaScript behavior visible, which is the whole reason to build the
feature in an app rather than hand someone the PDF.

### 5.2 Patterns carried from NAVMC 10922, verified applicable

- Collapse-and-add rows with a visible-row counter and a `lastActive` sync effect, for the
  offense grid and the victim grid. The component is not `formKey`-keyed, so state follows data.
- Any field written from OUTSIDE a `DynamicForm` must be REMOVED from that form's sections.
  RHF seeds defaults once at mount and clobbers external writes on its next debounced sync.
  This bit the 10922 build twice. Here it applies to the unit search, the Booker engine, and
  the remark composer.
- `date-picker` ControlType with ISO local-date conversion. Never `new Date('YYYY-MM-DD')`.
  All nine dates on this form use it. All nine format as `yyyy-mm-dd` per the form's own scripts.
- Character meters on capacity-bound fields, derived from measured usable width.

### 5.3 The offense picker

167 selectable offenses plus a blank, shipped verbatim per your decision.

- Searchable combobox, not a native select. 167 entries in a native select is unusable.
- Group by article number in the dropdown header. 89 distinct article numbers.
- The finding sits beside its offense in the same row, not in a separate item-5 block. The paper
  separates them; the user does not. The emitter writes to the item-5 fields.
- Finding disabled until the row has an article, matching "Leave blank when there is no
  corresponding offense."
- Emitter writes the EXPORT value `Guilty` or `Not Guilty`, never `G` or `NG`. See defect 3.3.

### 5.4 The remark composer (item 21)

The instruction page prescribes ten bulleted formats, all `YYYY-MM-DD ITEM n:` prefixed and
required in chronological order. Free text alone guarantees format drift.

| Trigger | Emitted line |
|---|---|
| Offenses F and beyond | `YYYY-MM-DD ITEM 1: Additional Offenses:` then `F. [Article] [Offense]. [Summary]. [G/NG].` |
| Forwarded for disposition | `YYYY-MM-DD ITEM 2: Fwd to Bn/Sqn CO recom [recommendation].` |
| Suspension vacated at NJP | `YYYY-MM-DD ITEM 7: [punishment] susp on [NJP date] vacated.` |
| Appeal stayed, restriction | `YYYY-MM-DD ITEM 13: Appeal submitted d Mmm yy, five days elapsed with no action. Punishment of restriction stayed.` |
| Appeal stayed, extra duties | `YYYY-MM-DD ITEM 13: Appeal submitted d Mmm yy, five days elapsed with no action. Punishment of extra duties stayed.` |
| Appeal denied | `YYYY-MM-DD ITEM 14: Appeal denied, [reason].` |
| Appeal granted | `YYYY-MM-DD ITEM 14: Appeal granted, [relief given].` |
| Suspension vacated on appeal | `YYYY-MM-DD ITEM 14: [punishment] susp on [Appeal date] vacated.` |
| Punishment set aside | `YYYY-MM-DD ITEM 14: [punishment], is set aside. All rights, privileges and property affected will be restored.` |
| Victims F and beyond | `YYYY-MM-DD ITEM 22: Additional Victims:` then `F. [Status] [Sex] [Race] [Ethnicity]` |

Note the two ITEM 13 lines are FIXED strings in the instruction, not a parameterized
"Punishment of [x] stayed." W-13 must not flag the literal forms as non-conforming.

Per defect 3.1, victims 2 through 5 also emit through the ITEM 22 row of this table, lettered
B through E rather than F onward, with a composer note explaining why.

Lines assemble into the read-only printed value, same as the 10922 documents-viewed line. Free
text appends below. This is the highest-leverage feature on the form: it is where clerks get it
wrong and where a legal review finds fault.

### 5.5 Authorized abbreviations

The instruction page fixes eleven: conf, cust, du, forf, fr, fwd, rec, red, restr, susp, w/o.
Wire them into the existing acronym and dictionary machinery rather than a new list, and offer
them as insert chips on items 6 and 7 where capacity is tight.

### 5.6 Rank and grade vocabulary

The instruction page fixes exact rank spellings (Pvt, PFC, LCpl, Cpl, Sgt, SSgt, GySgt, MSgt,
1stSgt, MGySgt, SgtMaj, WO, CWO2-CWO5, 2ndLt, 1stLt, Capt, Maj, LtCol, Col, BGen, MajGen, LtGen,
Gen) and pay grades (E1-E9, W1-W5, O1, O1E, O2, O2E, O3, O3E, O4-O10), and prohibits periods in
ranks, dashes in grades, and the digit zero for the letter O. It also directs Navy petty officer
rating abbreviations for Navy members, which matters because item 8 has a "Service Branch if
other than USMC" field.

`src/lib/ranks.ts` exists. Audit it against this list before reuse. The form's list is narrower
than a general rank list and the punctuation prohibitions are specific.

---

## 6. Validators

Every rule cites a controlling source. Blockers gate export. Warnings do not.

### 6.1 Blockers

THREE SEVERITIES EXIST AND ONLY ONE GATES. `getExportBlockers` in
letter-validators.ts filters on `severity === 'block'`. A rule emitted as
`'fail'` renders as "Non-compliant" in the compliance dialog and LETS THE
EXPORT THROUGH; `'warn'` renders as "Advisory". Every rule in this table must
be emitted as `'block'`, and its test must assert through `getExportBlockers`
that the export is stopped, not merely that an issue was produced. See D-34
for what happened when that was not done.

| ID | Rule | Citation |
|---|---|---|
| V-01 | At least one offense with an article | Item 1 instruction. Defect 3.5 means the form does not self-enforce |
| V-02 | Every offense with an article has a summary | Item 1 instruction |
| V-03 | Findings entered only for rows that have an offense | Item 5 instruction |
| V-04 | Item 6 punishment is non-empty | MCO 5800.16 Vol 14 para 011110.C: when no punishment is imposed, no NJP has occurred and the form is not maintained. Form item 6 instruction: destroy the form |
| V-05 | Item 7 is either `NONE` or a specific suspension with terms | Item 7 instruction |
| V-06 | Item 3 date is on or before item 6 date | Item 3 instruction: must precede imposition |
| V-07 | Item 11 date is not before item 6 date | Item 11 instruction |
| V-08 | Item 13 is either a date or the Not Appealed checkbox, never both, never neither | Item 13 instruction |
| V-09 | Every capacity-bound field is within its measured limit | Section 2.2, silent clipping |
| V-10 | Accused name, rank, and EDIPI present | Items 18-20 and MCO 011103 |
| V-11 | Item 17 names a company-sized unit up to the first GCMCA | Item 17 instruction |
| V-12 | EDIPI is exactly 10 digits, items 8B and 20 | DoD standard |
| V-13 | Punishment in item 6 requires at least one `Guilty` finding, unless item 6 begins with `none` | The form's own item-6 validate script, reproduced in the app because pdf-lib does not run it |
| V-14 | Every selected punishment code is authorized for the accused's status. Release 1 is enlisted, so N01, N02, and N03 are refused | 10 U.S.C. 815(b)(1) authorizes those three for officers only |
| V-15 | Rendered item 6 string is within 123 characters | Section 2.2. The MCO's own combination example is 160 characters and does not fit |
| V-16 | The item 14 appeal decision does not increase any punishment recorded in item 6 | MCM Part V para 1.f.(2): once NJP is imposed it may not be increased, upon appeal or otherwise. Checkable once item 6 is structured per section 11 |
| V-18 | A forfeiture imposed alongside a reduction is based on the grade to which reduced | MCM Part V para 5.c(8), "whether or not suspended". The app checks the recorded BASIS, not the arithmetic: it holds no pay table at the point of this check |
| V-19 | Correctional custody on an E-4 or above requires an unsuspended reduction below E-4 | JAGMAN 0111.b. Conditional, not absolute: a SUSPENDED reduction does not satisfy it, because the accused never leaves E-4 |
| V-20 | A forfeiture does not exceed the statutory ceiling for the grade it is based on | 10 U.S.C. 815(b)(2)(C) and (H)(iii); JAGMAN 0111.i; DoD FMR Vol 7A Ch 1. CONDITIONAL: silent unless the held pay table governs the punishment date, so it never blocks on a figure the app cannot support |
| V-21 | The set of punishments in item 6 is a lawful combination | MCM Part V para 5.d(1) to (4), plus the per-case aggregate ceilings of 5.b that per-code clamping cannot see |
| V-22 | An item 7 suspension does not exceed six months | MCM Part V para 6.a(2). Computed as a DATE, not a day count, because the order says months |
| V-23 | No write targets a field locked by a signature already present in the file | The form's own `/SigFieldLock` dictionaries. Computed per D-37. Writing a locked field is what invalidates a signature |
| V-24 | The returned `2 BOOKER` matches the statement recomputed from `2 DEMAND`, `2 COUNSELOPP` and `2 ACC REFUSE TO SIGN` | D-41. The blank ships an ACCEPTANCE default, so a reader whose scripts never fired leaves a refusal case stating acceptance |
| V-25 | Items 23-25 match items 18-20 on re-upload | D-42, MCO 011103. Verification, not authorship: the calculate scripts populate them in Acrobat |
| V-26 | Pass-1 content is unchanged on re-upload: item 1 rows, items 17-20 | The item 2 signature locks all of them, so any difference means the file was altered before signing or a different file came back |
| V-27 | Items 6, 6 date, 8, 8A, 8B and 10 are unchanged once item 9 is signed | D-45, defect 3.9. The form's lock lists name these fields under names that no longer exist, so the app enforces what the signature was meant to |
| V-28 | The returned `2 DEMAND` is consistent with `vesselException` | 10 U.S.C. 815(a): a member attached to or embarked in a vessel has no right to refuse NJP. If the box is checked, the vessel option is the only lawful election and demand-trial is unavailable. If it is clear, the vessel option is unlawful. Checked on re-upload, because `vesselException` is APP STATE carried outside the PDF while `2 DEMAND` comes back inside it, so the two can disagree |
| V-29 | The triggering offence date falls inside the suspension window | MCO 011201 and JAGMAN 0118.d, which word the window identically. Asserts `punishmentDate < offenceDate <= endsOnIfUninterrupted`. DISTINCT FROM D-36, which tests when the vacation ACTION occurs; this tests when the OFFENCE occurred. Per D-49 the gate tests the DATE only, never the nature of the basis |
| V-30 | The vacating authority is competent for the kind and amount vacated | MCO 011201: "any commander authorized to impose upon the accused punishment of the kind and amount to be vacated." Computed against `resolveAuthorityLevel` and the N-code ceilings. Reads the D-56 field, never item 8A |
| V-31 | No two item 7 suspensions target the same item 6 punishment | Command determination (Stephen), 2026-08-25. NOT a published MCO or JAGMAN paragraph, and V-31's message says so rather than citing one. The NAVMC 10132 carries one item 7 field per punishment. Silent when `punishmentIndex` is out of bounds or unreadable, because V-05 owns that and two rules shouting about one bad field trains people to ignore both. Id keyed on the entry's own array position per D-58, never on `punishmentIndex` |

### 6.2 Warnings

| ID | Rule | Citation |
|---|---|---|
| W-01 | Offense is ordinarily NOT a minor offense, so NJP is questionable (Art. 94, 99, 103a, 103b, 118, 119, 120, 120b, 122, 125, 126, 128a) | MCM Part V para 1.e: a minor offense ordinarily carries no dishonorable discharge and no confinement over one year at GCM. Warn, do not block, per your decision |
| W-02 | Item 4 populated but no Art. 85 or 86 offense | Item 4 instruction |
| W-03 | Art. 85 or 86 offense selected but item 4 empty | Item 4 instruction |
| W-04 | Item 21 appears to contain victim PII | Item 21 instruction, explicit prohibition. NOTE: the item 1 instruction does NOT carry this prohibition; only the printed item 1 heading says "not victim PII" |
| W-05 | Punishment code requires field-grade authority and item 8A is O-3 or below | 10 U.S.C. 815(b)(2)(H); MCO 5800.16 Vol 14 para 010303. Code-driven, see section 11 |
| W-06 | Days or dollars exceed the selected code's own ceiling | 10 U.S.C. 815(b); the ceiling is printed in the code description itself |
| W-07 | Forfeiture not in whole dollars | MCO 5800.16 Vol 14 para 010901 |
| W-08 | Reduction imposed and the accused is E-6 or above | MCO 5800.16 Vol 14 para 010302.C: Marines E-6 and above may not be reduced in paygrade |
| W-09 | Offense date more than two years before the item 6 date | MCM Part V para 1.f.(4) and MCO 5800.16 Vol 14 para 010702. Waivable by knowing and intelligent waiver, so warn |
| W-10 | Appealed punishment crosses a judge-advocate review threshold | MCO 5800.16 Vol 14 para 011402.A-.G |
| W-11 | Item 2 shows refusal or demand for trial, and item 6 carries punishment | Item 2 instruction: forward to the officer exercising court-martial jurisdiction |
| W-12 | Victim rows present but no offense that ordinarily has a victim | APP HEURISTIC, no citation. The item 22 instruction says nothing about offense linkage. Label it as an app suggestion in the message text |
| W-13 | Remark line does not match a prescribed format | Item 21 instruction. Must accept the two literal ITEM 13 forms |
| W-14 | An offense on this UPB also appears on another UPB for the same accused in the session library | MCM Part V para 1.f.(1): double punishment prohibited. Detection is best-effort within the app's own documents |
| W-15 | Multiple offenses share a date and place, suggesting one incident or course of conduct | MCM Part V para 1.f.(3): offenses from a single incident are ordinarily considered together and not made the basis for multiple punishments. Advisory only |
| W-16 | Remarks or summary indicate the offense was tried in a US-derived court | MCM Part V para 1.f.(5): NJP may not be imposed for an offense tried by a court deriving its authority from the United States. Keyword heuristic, warn only |
| W-17 | The computed suspension end date holds only if three unmodelled conditions did not occur | JAGMAN 0118.c interrupts the period for unauthorised absence and for commencement of vacation proceedings, both pushing the real end LATER. MCM Part V para 6.a(2) terminates it at expiration of enlistment, pushing it EARLIER. Names all three with their citations AND their directions. ADVISORY on purpose: the app cannot observe whether any occurred, so it cannot prove the date is wrong, only that it rests on assumptions. See D-51, which corrects this row's original "floor" wording |
| W-18 | Article 31 rights are read before the accused is asked for a statement | JAGMAN 0118.d. Fires whenever the recorded basis is misconduct, which under MCO 011201 is every vacation. Advisory: the app cannot observe whether the reading happened. See D-54 |
| W-19 | The vacation order issues within ten working days of commencement | JAGMAN 0118.d. Advisory rather than blocking, because the app has no ability to un-issue a late order and a block would trap a clerk recording history truthfully. Working days, so weekends and federal holidays come out. See D-52 |

W-05 and W-06 no longer need a text parser. Section 11 replaces free-text item 6 with a
structured builder over the MCTFS punishment codes, so the ceiling and the required authority
grade come from the selected code rather than from a regex. A parser survives only on the
IMPORT path, for reading an item 6 string written outside the app. There it stays
false-positive tolerant and warn-only, same posture as the 10922 foreign-divorce heuristic.

### 6.3 Deliberately NOT enforced

- ~~Signature-driven locks~~ REVERSED 2026-08-25. The app now READS the form's own
  `/SigFieldLock` dictionaries and refuses to write any locked field. See D-37 and V-23. The
  earlier entry assumed capture-and-export with no re-upload; the document is multi-pass.
- ~~"Do not add offenses or victims after the accused signs"~~ REVERSED 2026-08-25. The signature
  event the app lacked is exactly what it now keys on. Item 1 rows and the whole victim block
  22A-22E close at pass 1, alongside the accused's signature, so the rule is enforced by V-23
  rather than surfaced as guidance.
- CUI markings. The form carries its own `CUI - PRIVACY SENSITIVE WHEN FILLED IN` artwork. The
  app adds nothing, consistent with the standing CUI framing rule.

---

## 7. Export path

New module `src/lib/acroform-fill.ts`. Generic, not 10132-specific, because DD 137 in the 10922
backlog is also a plain AcroForm and will reuse it.

    fillAcroForm(baseBytes, values: Record<string, string|boolean>, opts?: {
      unlockReadOnly?: string[]
    }): Promise<Uint8Array>

Behavior:
1. Load with `ignoreEncryption: true`.
2. Dispatch on field class: text, dropdown, checkbox.
3. Dropdowns select by EXPORT value. Never by display text. See defects 3.3 and 3.7.
4. Temporarily clear the read-only flag for names in `unlockReadOnly`, write, restore.
   For 10132 that list is `2 BOOKER`, `23 ACCUSED FULL NAME`, `24 ACCUSED RANK/GRADE`,
   `25 ACCUSED EDIPI`.
5. Never touch signature widgets.
6. Assert `/RV` absent on `21 REMARKS` after write.
7. `updateFieldAppearances()`.
8. Save with `useObjectStreams: false`, matching the existing XFA path.

`src/lib/navmc10132-acroform.ts` holds the 74-entry name-to-selector table, with the Booker and
demand-coercion derivations applied before the table is evaluated.

Routing, following the 10922 precedent in `useDocumentExport.ts`:
- Plain PDF export: AcroForm fill onto `public/forms/navmc-10132-blank.pdf`.
- Live preview: CONFIRMED 2026-08-24, it paints generated appearances. See D-2 and section 4.1.

Extractor tool `tools/aa-forms/extract_10132_map.py`, mirroring `extract_10922_map.py`, emits
`navmc10132-map.json` with name, type, page, rect, `/Ff`, `/Opt` export and display values, and
computed capacity. A map-diff test guards against a form revision landing silently. That guard
matters: sja.marines.mil re-posted this same 08-2023 revision under a 2025-03 filename, which
from the outside is indistinguishable from a real revision.

---

## 8. Integration checklist

The 10922 gate miss: registering in `DOCUMENT_TYPES` does NOT surface a form in the UI. The
pickers are hardcoded. Every line below must be touched, and "appears in the picker" is a
separate gate from "registered."

New files:
1. `src/lib/acroform-fill.ts`
2. `src/lib/navmc10132-acroform.ts`
3. `src/lib/navmc10132-utils.ts` (Booker engine, demand coercion, remark composer, capacity)
4. `src/lib/navmc10132-validators.ts`
4a. `src/lib/navmc10132-articles.ts` (167-row form-label to MCTFS-code crosswalk, section 11.1)
4b. `src/lib/navmc10132-punishments.ts` (N01-N17 with ceilings, authority grade, render templates, section 11.3)
5. `src/components/letter/Navmc10132Sections.tsx`
6. `tools/aa-forms/extract_10132_map.py` and `navmc10132-map.json`
7. `public/forms/navmc-10132-blank.pdf`
8. `tests/navmc10132-cases.ts`, `tests/navmc10132-acroform.test.ts`

Modified files:
9. `src/types/navmc.ts` - `Navmc10132Data`
10. `src/lib/schemas.ts` - `PdfPipeline` union, `Navmc10132Schema`, `Navmc10132Definition`, `DOCUMENT_TYPES` entry
11. `src/services/export/pdfPipelineService.ts` - `PIPELINE_MAP` key, required by `Record<PdfPipeline>`
12. `src/lib/xfa-form-fill.ts` - `officialFormPath` returns the 10132 blank; `exportOfficialForm` branches to the AcroForm path
13. `src/hooks/useDocumentExport.ts` - official-form route and export toast
14. `src/lib/letter-validators.ts` - call `runNavmc10132Validators`
15. `src/components/letter/DocumentTypeSection.tsx` - card grid entry AND the settings-exclusion condition near line 558
16. `src/components/layout/Sidebar.tsx` - Forms accordion entry near line 438
17. `src/components/layout/HeaderActions.tsx` - DOCX menu exclusion near line 522
18. `src/lib/indent-engine.ts` - `isCorrespondenceType` exclusion list
19. `src/lib/proofread-checks.ts` - `isForm` list
20. `src/lib/naval-format-utils.ts` - `getExportFilename` branch
21. `src/lib/templates/index.ts` - placeholder template entry
22. `public/templates/navmc10132/` and `index.json` - samples with fictional data only

`schema-validators.ts` picks the schema up from the registry automatically. `merge-utils.ts`
`DOCUMENT_MERGE_FIELDS` is deliberately skipped, same decision as 10922.

---

## 9. Sandbox constraints, carried forward

All still true from the 10922 build:
- Full `tsc` is unrunnable on the mount. Copy `src` plus `zod` to `/tmp` and run the mount's
  `tsc.js` against the local tree with `@/*` paths.
- Component files verify via `esbuild --packages=external`. Do not let esbuild resolve
  `lucide-react` per-icon files through the mount.
- vitest dies on the mount. CI is the authoritative typecheck and test run.
- The mount blocks delete and rename. Git writes happen on your machine.
- PDF probes run in the cloud container, which has Node 22, pdf-lib, pypdf, and poppler.

---

## 10. Open decisions

| # | Question | Recommendation |
|---|---|---|
| D-1 | Victim rows B-E: crosswalk, raw `/V` write, or row A plus item 21 overflow | Row A plus item 21 overflow. Only option that writes conforming PDF and keeps one vocabulary |
| D-2 | Does the app's pdfjs preview pane paint pdf-lib generated widget appearances | CLOSED POSITIVE 2026-08-24. The preview renders the filled official form with generated appearances. Phase 5b, the flattened generator, is cancelled |
| D-3 | Punishment parser scope for W-05 through W-08 | Restriction days, extra duty days, forfeiture dollars, reduction target. Skip correctional custody and arrest in quarters in release 1 |
| D-4 | Does this need the in-app signature flow from SIGNATURE_COLLECTION_PLAN | No. Items 9 and 16 are CAC-signed in Acrobat. Leave the widgets open |
| D-5 | Should the app clear the RichText flag on item 21 | RESOLVED 2026-08-24: yes, and for a different reason than anticipated. updateFieldAppearances() THROWS RichTextFieldReadError when item 21 is EMPTY, the ordinary case. Bit 26 is cleared before appearances are generated. Defect 3.8 |
| D-6 | Defect report to CMC (JA) | DELIVERED 2026-08-24. `docs/NAVMC_10132_DEFECT_REPORT.md`, twelve findings across three owners: eight to CMC (JA) through the MARADMIN 427/23 POCs, one to the MCO 5800.16 Vol 14 sponsor, three to the MCTFSPRIUM table owner |
| D-7 | Re-verify MCM Part V against the 2024 edition | CLOSED 2026-08-24. Stephen supplied the 2024 edition. Paragraphs 2, 5.a, 5.b, 5.c, and 5.d read directly. Edition confirmed from the title page and preface, which incorporates E.O. 14103 of 28 July 2023 and names Nonjudicial Punishment Procedure among the parts updated. Verbatim quotation is now permitted |
| D-8 | Provenance of the two code tables | CLOSED 2026-08-24. MCTFSPRIUM reporting tables as of 20260823, the date the data was pulled, confirmed by Stephen. Prefix convention also confirmed: `N` denotes nonjudicial punishment, `C` denotes court-martial |
| D-9 | Does release 1 emit a unit-diary handoff | CLOSED YES 2026-08-24. Built in Phase 6. Transcription only, no MCTFS connection. Section 11.6 |
| D-10 | N04 and N05 authority assignment | CLOSED 2026-08-24 against MCM 2024 Part V 5.b. N05 is the OFFICER 60-day restriction at 815(b)(1)(B)(iii), NOT a duplicate of N14 plus N15. Proof: N01 through N05 walk 815(b)(1) in exact statutory order, N06 opens the enlisted block at (b)(2)(B), and MCTFS split the enlisted restrictions into suspension pairs while leaving the officer clause unsplit, matching the statute. N04 serves both schedules because the table has no enlisted code for (b)(2)(H)(iii), defect report finding 11. Stephen's ruling: keep the code table as the reporting baseline, unchanged. See D-14 |
| D-11 | Detention of pay | CLOSED 2026-08-24, re-verified against the 2024 edition. Detention appears nowhere in Part V 5.b at any authority level. The MCTFS omission is correct. MCO 011402.G is dead text, defect report finding 9. No app support, nothing built |
| D-12 | Strip the Adobe usage-rights signature on export | RESOLVED, STRIP. It goes void the moment the bytes change, and an invalid signature reads as tampering. Showing no signature is the less alarming honest state. `/Root/Perms` is deleted on write. Defect 3.6 |
| D-13 | Does the copied unit-diary block carry a CUI marking | CLOSED NO 2026-08-24 by Stephen. The block is a transient transcription aid, not a record. The record is the NAVMC 10132 itself, which carries its own artwork. Consistent with the standing rule: the app adds no CUI markings |
| D-14 | Officer punishment support | CLOSED NO 2026-08-24 by Stephen. PRODUCT SCOPE, NOT A REGULATORY LIMIT. Stephen's stated basis, that officers do not use this NAVMC, is superseded: MARADMIN 427/23 amended MCO 5800.16 Vol 15 para 010502.B.1 to read "The Unit Punishment Book (UPB) will be used in officer NJP cases," and added the UPB as an enclosure at 010605.D and Figure 15-5. Vol 14 para 011101 routes officer NJP to Vol 15 and is consistent with this. The FORM serves both populations; the APP covers enlisted only by choice. Consequences: N01, N02, N03, and N05 stay unavailable. The conditional-authority defect in N04, where a field-grade authority wrongly passes validation for an officer forfeiture under 815(b)(1)(B)(ii), is DEFERRED rather than retired, and blocks any future officer support. Section 1.3 still governs UI copy: print no scope claim at all |
| D-15 | A-1-d paragraph 3, the maximum punishment | REOPENED and REVERSED 2026-08-24 by Stephen, after reviewing a rendered A-1-d with the rule blank. Previously ruled a hand fill-in on 2026-08-23. NOW COMPUTED from the item 8A pay grade, which is what the fleet means by the type of NJP: company grade at O1 through O3 (MCM Part V 5.b(2)(A)) and field grade at O4 and above (5.b(2)(B)). There is no third tier for an enlisted accused, since a flag officer falls inside (B). Every day count is read off NAVMC_10132_PUNISHMENTS through authoritySatisfies, never typed into the generator, so the advisement and the item 6 picker cannot disagree. The combination limits of Part V 5.d(3) and 5.d(4) print with it, along with 5.d(5)'s statement that the maxima may be imposed together. THREE GUARDS: an unreadable item 8A prints the rule blank exactly as before rather than guessing a level, the module reads nothing from item 5 or item 6, and a Marine at E-6 or above loses the reduction line per MCO 5800.16 Vol 14 para 010302.C. Built in src/lib/njp-maximum-punishment.ts |
| D-16 | A-1-c/d paragraph 1 and paragraph 2 content | CLOSED 2026-08-24 by Stephen. Paragraph 1 carries the lettered ARTICLE only, paragraph 2 carries that article's SUMMARY under the same letter. This is the form's own split, matching item 1's two fields, and it retires the earlier ruling that paragraph 2 was a hand fill-in. Paragraph 2 is still left printed when no offense carries a summary yet |
| D-17 | Item 17, the unit, had no writer anywhere in the UI | CLOSED FIXED 2026-08-24. The schema section list reserved `unit` for a UNITS search dialog that was never built for this form, so item 17 exported blank and the JAGMAN rights advisement was permanently blocked on "the unit (item 17)" with no field to satisfy it. Found by browser test, not by the suite: every unit test supplied `unit` directly. Fixed by adding a plain text field to the `accused` section, now titled "Unit and Accused (Items 17-20)." No clobber risk, since nothing else writes the field |
| D-18 | Years of service | ADDED 2026-08-24 by Stephen, app-side only. MCM Part V para 5.c(8) defines basic pay as "the basic pay fixed by statute for the grade and length of service of the person concerned," so a forfeiture cannot be computed from the pay grade alone. IT DOES NOT PRINT. Verified against the blank form: 74 AcroForm fields, none of them years of service, and items 17 through 20 are UNIT, ACCUSED FULL NAME, ACCUSED RANK/GRADE, ACCUSED EDIPI. Composing it into item 19 would break the page 3 note, which fixes what that box may contain. Placed beside the item 19 preview in AccusedRankSection per Stephen, since grade and length of service are halves of one fact. SCOPE RULING (Stephen): field only, NO MATH. The app embeds no pay table and computes no dollar ceiling |
| D-19 | MCM Part V para 5.c(8), forfeiture based on the reduced grade | CLOSED 2026-08-24 by Stephen, BLOCKING. "If the punishment includes both reduction, whether or not suspended, and forfeiture of pay, the forfeiture must be based on the grade to which reduced." New field `forfeitureBasisGrade` and validator V-18. WHAT THE GATE CAN AND CANNOT DO: with no pay table the app cannot check the arithmetic, so it checks the BASIS the clerk recorded against the reduction target and says so in the message. Do not reword V-18 to imply the dollar figure was validated. "Whether or not suspended" is the trap the gate exists for, since a suspended reduction reads as one that did not happen and the Marine gets overcollected  SEVERITY CORRECTION 2026-08-25: this entry claimed BLOCKING and the rule was emitted as `'fail'`, which does not block. It became true only when the severity was corrected. See D-34 |
| D-20 | MCO 5800.16 Vol 14 para 010302.C is TWO floors, not one | CLOSED FIXED 2026-08-24. Order text, verbatim: "Marines in the grade of E-6 or above and Sailors in the grade of E-7 or above may not be reduced in paygrade." `reducibleGrades` and validator W-08 both tested a single E-6 floor for either service, which refused a lawful reduction of a Navy E-6 and passed an unlawful reduction of a Navy E-7 unwarned. Consolidated into NAVMC_10132_REDUCTION_BAR_FLOOR and `reductionBarred` in navmc10132-ranks.ts, now the single source for the picker, W-08, and the A-1-d maximum. Found while sourcing the A-1-d ceiling, not by the suite |
| D-21 | Item 6 picker gated on the imposing officer's grade | CLOSED 2026-08-24 by Stephen. The picker offered every release-one code regardless of item 8A and relied on W-05 to warn AFTER selection, by which point the clerk had typed the days and read them back in the item 6 preview. Now `releaseOnePunishmentsFor(authorityPayGrade)` drives the list off `authoritySatisfies`, so a company-grade authority sees N04, N12, N13, N14, N15 disabled. DISABLED, NOT HIDDEN: a hidden code reads as one the app cannot produce, when the real fact is that THIS commander cannot order it, and the remedy (route to a field-grade authority, or correct item 8A) is worth naming. N01 to N03 and N05 stay hidden, being out of release scope rather than out of reach. An unreadable item 8A offers everything and marks the field-grade codes `unverified`, because item 8A sits in a later section and gating on a grade nobody has entered would invert the form's preparation order. NjpAuthorityLevel and resolveAuthorityLevel MOVED from njp-maximum-punishment.ts to navmc10132-punishments.ts so the picker does not import a JAGMAN appendix module to learn the level, and are re-exported from the old site |
| D-22 | Basic pay table, REVERSING D-18's no-math scope | CLOSED 2026-08-24 by Stephen, who supplied the DFAS source. `src/lib/navmc10132-basic-pay.ts` holds the enlisted table effective 2026-01-01, transcribed from https://www.dfas.mil/MilitaryMembers/payentitlements/Pay-Tables/Basic-Pay/EM/ on 2026-08-24. THE STALENESS RULE IS THE WHOLE REASON THIS IS SAFE (Stephen's ruling, never silently stale): nothing computes unless the held table's effective date is the most recent 1 January on or before the ITEM 6 PUNISHMENT DATE. That one test refuses two errors, a punishment priced on a superseded table and an old case priced on rates that did not exist yet. An undated item 6 is never current. Update EFFECTIVE_DATE in the same commit as the table or the file goes silently inert, which is the intended failure mode. TRANSCRIPTION IS NOT HUMAN VERIFIED CELL BY CELL: checked only for row and column monotonicity and for reproducing the published blank-cell shape. E-9 special positions (SgtMaj of the Marine Corps, flat $11,166.90 per DFAS footnote 2) use the ORDINARY E-9 rate with a note, per Stephen |
| D-23 | Forfeiture base is not basic pay alone | CLOSED 2026-08-24. JAGMAN 0111.i, verbatim: "Pay subject to forfeiture refers only to basic pay, plus sea duty or hardship duty pay." A ceiling from basic pay alone is not conservative, it is WRONG in the direction that refuses a lawful forfeiture. New app-side field `accusedSeaHardshipDutyPay`, beside years of service, not printed, blank for most Marines, and the ceiling note says plainly when it computed on basic pay alone. The daily divisor is DoD FMR Vol 7A Ch 1: "The daily rate is 1/30 of the monthly rate." Ceilings floor to whole dollars per MCO 5800.16 Vol 14 para 010901, because rounding a CEILING up would authorize a dollar more than the statute allows |
| D-24 | V-20, forfeiture over the statutory ceiling | CLOSED 2026-08-24, BLOCKING but CONDITIONAL. Fires only when the held pay table governs the punishment date AND a ceiling is computable from the recorded grade, length of service, and sea or hardship duty pay. Silent otherwise, because a stale table blocking a lawful forfeiture is worse than no check. The dollar field is deliberately NOT clamped the way the day and month fields are: a day ceiling comes off the statute and cannot be wrong, a dollar ceiling comes off a table this app transcribed, and silently truncating the clerk's figure would hide a transcription error instead of surfacing it. The grade used is `forfeitureBasisGrade`, which V-18 has already forced to the reduction target  SEVERITY CORRECTION 2026-08-25: this entry claimed BLOCKING and the rule was emitted as `'fail'`, which does not block. It became true only when the severity was corrected. See D-34 |
| D-25 | V-19, correctional custody on an E-4 and above | CLOSED FIXED 2026-08-24. JAGMAN 0111.b, verbatim: "Correctional custody. This punishment will not be imposed on persons in paygrade E-4 and above unless an unsuspended reduction below paygrade E-4 is also imposed." The app offered N06 and N12 to any accused and modelled none of this. CONDITIONAL, NOT ABSOLUTE: an NCO may receive correctional custody, but only riding along with a reduction that actually takes effect, so a SUSPENDED reduction does not satisfy it and V-19 consults item 7 as well as item 6. Found in the JAGMAN while sourcing the forfeiture rules, after an earlier check of MCO 5800.16 Vol 14 found no such limit, which was correct: the rule is not in the MCO. ALSO LOGGED, NOT BUILT: JAGMAN 0111.a caps officer restriction at 15 days when imposed by a commander below O-4, narrower than the MCM's 30. Officer scope, deferred with D-14  SEVERITY CORRECTION 2026-08-25: this entry claimed BLOCKING and the rule was emitted as `'fail'`, which does not block. It became true only when the severity was corrected. See D-34 |
| D-26 | MCTFS TTC statement emitter | CLOSED 2026-08-24 by Stephen, who supplied the PRIUM extracts. `src/lib/navmc10132-mctfs.ts` emits TTC 268 000, TTC 212 000 and 001, TTC 283 003, TTC 056 000, and HIST statements, per PRIUM 70502, 70503, 70504, 70507, and 70508. The existing prose block in navmc10132-unit-diary.ts is KEPT, not replaced: PRIUM 70503 asks for a HIST statement on TTC 268 carrying the statistical information and all punishment awarded, and that block is exactly that text. THREE THINGS MAKE THIS DERIVABLE RATHER THAN GUESSWORK: the app's punishment code table IS MCTFS Table 19 (70508 note 4 names bytes 1 to 3 as Table 19 and byte 1 as C or N); item 2's three election strings are BYTE-IDENTICAL to the PRIUM's own VESSEL OPTION CODE descriptions, so the letter is a lookup; and byte 4 of every punishment code comes from item 7, which is already a 1:1 selection over item 6 |
| D-27 | TTC 212 capacity, 3 articles and 4 punishments | CLOSED BLOCKING 2026-08-24 by Stephen. The form holds five offence rows and item 6 can carry more than four punishments, and the PRIUM describes NO continuation sequence. A truncated 212 looks complete and understates a record MCTFS retains permanently, so overflow is a blocker naming the exact rows or codes that will not fit, never a silent fill of slots one to four. MITIGATED BY DEDUPLICATION: the article crosswalk is many-to-one (Art. 92 alone has 22 form labels resolving to code 92), so two Art. 92 offences share one slot and the fold is reported to the clerk. A Guilty row resolving to no MCTFS code is ALSO a blocker, never a silent drop |
| D-28 | Which transaction a punishment gets | CLOSED 2026-08-24. PRIUM 70503 note 2: "Punishment that does not affect pay, pay grade, or any other personnel data item may be reported with a history statement." Read off each code's own PARAMETERS rather than a list of code strings, so a table change carries through: `dollars` or `dollarsPerMonth` routes to TTC 283 003, `gradeReducedTo` routes to TTC 056 000, everything else routes to HIST. SUSPENSION OVERRIDES BOTH: a suspended reduction is a HIST statement and never a TTC 056 (70504.3), and a suspended forfeiture is HIST only and never a TTC 283 003 (70502.f), because neither has changed anything MCTFS holds. MONTHS IS NEVER DEFAULTED for a code carrying a `months` parameter, since assuming 1 on an N04 would print a TOTAL half the real forfeiture |
| D-29 | Follow-on entries the PRIUM buries | CLOSED 2026-08-24, surfaced as reminders rather than statements. (1) A new Good Conduct Medal commencement date must be reported with TTC 140 001, because any NJP breaks the GCM period (70503 note 3, 50101.8.c). (2) DO NOT report TTC 053: the three-month promotion restriction posts AUTOMATICALLY from TTC 268 (70503 note 1), and a careful clerk reporting it by hand double-restricts. Where the Marine is already restricted, MCTFS keeps whichever termination date is later (70702.3). (3) Correctional custody puts the Marine in pay status 03120 and may require time lost reporting (70400, 70401) |
| D-30 | V-21, MCM Part V para 5.d combination limits | CLOSED BLOCKING 2026-08-25 by Stephen, all three scopes. THE GAP: since D-15 the app PRINTED these rules on the A-1-d advisement and enforced NONE of them in item 6, so a set the advisement had just called unlawful passed export silently. Printing a rule and not checking it is worse than doing neither, because the printed sentence reads as an assurance to the accused. Built in src/lib/navmc10132-combination-limits.ts, surfaced as V-21. TWO KINDS OF RULE, FAILING DIFFERENTLY: 5.d(1) to (3) are FLAT PROHIBITIONS needing no number, so they fire whatever item 8A holds; 5.d(4) is a NUMERIC CAP against the extra-duty maximum, which turns on the imposing officer's grade, so it stays silent on an unreadable item 8A, the same discipline V-20 uses  SEVERITY CORRECTION 2026-08-25: this entry claimed BLOCKING and the rule was emitted as `'fail'`, which does not block. It became true only when the severity was corrected. See D-34 |
| D-31 | Per-case aggregate ceilings | CLOSED 2026-08-25, and NOT a 5.d rule. MCM Part V para 5.b states each maximum PER CASE, not per award: "extra duties ... for not more than 14 consecutive days" caps the punishment, so two awards of ten days each is twenty days of extra duty in one case. Per-code input clamping cannot see the total, which is why Stephen's own test data carried 55 days of extra duty across two codes and passed. Checked across every entry in a family. The family ceiling is the LOWEST maxDays among the contributing codes, not the highest: a set carrying only N09 is capped at 14 even under a field-grade commander who could have used N13, because the code actually imposed is what the record says was imposed |
| D-32 | Concurrency is arithmetic, not a separate rule | CLOSED 2026-08-25. 5.d(4) caps "the combination", so restriction and extra duties running concurrently combine to the LONGER of the two and consecutively to their SUM. One comparison covers both, which is why V-21 reads `punishmentsConcurrent` rather than demanding it be set. NON-OBVIOUS CONSEQUENCE worth knowing: a field-grade commander may impose 60 days of restriction ALONE, but not alongside extra duties, because the combination may not exceed the 45-day extra-duty maximum. The message names the concurrent remedy explicitly rather than only saying the set is unlawful |
| D-33 | Punishment families are one shared classifier | CLOSED 2026-08-25. `punishmentFamily` now lives in navmc10132-punishments.ts beside the table. Two rules read it and must never disagree about what counts as restriction: the A-1-d ceiling, which states one sentence per family rather than one per code, and the 5.d gates, which prohibit families rather than codes. It previously existed privately inside njp-maximum-punishment.ts. `confinement` and `arrest-in-quarters` are named despite having NO code in the table, so the 5.d(1) and 5.d(2) gates are written against the real rule rather than silently omitted, and a future code lands in the right family instead of falling through unclassified |
| D-34 | V-18 through V-22 were emitted as `'fail'` and blocked nothing | CLOSED FIXED 2026-08-25. THE DEFECT: three severities exist and only `'block'` gates, but all five new validators were emitted as `'fail'`, which renders as "Non-compliant" and lets the export through. Their docstrings, this decision table, and every status report called them BLOCKING throughout. `'fail'` appears nowhere in navmc10132-validators-punishment.ts before this session introduced it; every pre-existing NAVMC blocker uses `'block'`. CONSEQUENCE while it stood: a forfeiture computed on the pre-reduction grade, correctional custody on an NCO with no qualifying reduction, a forfeiture over the statutory ceiling, correctional custody combined with restriction, and a twelve-month suspension ALL EXPORTED CLEANLY. WHY THE TESTS MISSED IT: all twelve asserted `expect(issue.severity).toBe('fail')`, the string the code emitted rather than the behaviour the rule needed, so they stayed green. Found by reading the badge in the compliance dialog, not by any test. FIX: severities corrected, and each of the five now has a test that calls getExportBlockers and asserts the export is actually stopped for a violating fixture and clean for a compliant variant of the same fixture. The `issue()` helper carries a standing note about which severity gates |
| D-35 | V-22, the six-month suspension cap | CLOSED BLOCKING 2026-08-25. MCM Part V para 6.a(2): "Suspension of a punishment may not be for a period longer than 6 months from the date of the suspension." Item 7 collected a period in months or days with NO ceiling of any kind, so a twelve-month suspension recorded cleanly onto a permanent record. Computed as a DATE rather than a day count because the order says months: a suspension imposed 31 August ends 28 February, clamped to the last day of the target month. The boundary is INCLUSIVE, since 6.a(2) forbids longer than six months, not six months itself. NOT ENFORCED, and deliberately so: the second clause of 6.a(2) terminates a suspension early at the expiration of the current enlistment, and the form carries no EAS field, so every computed date names that caveat rather than implying it is unconditional |
| D-36 | The vacation deadline falls out of 6.a(3) | CLOSED 2026-08-25. "Unless the suspension is sooner vacated, suspended portions of the punishment are remitted, without further action, upon the termination of the period of suspension." A vacation notice served after that date acts on a punishment that no longer exists, so `vacationDeadlines` computes it from the item 6 date plus the item 7 period. This is why the Figure 14-1 work depends on njp-suspension-period.ts rather than the other way round |
| D-37 | The document has SEVEN passes, and the form defines them | CLOSED 2026-08-25 by Stephen. Every signature field carries a `/Lock` of type `/SigFieldLock`. Signing sets ReadOnly on every field the lock names, so the form encodes its own pass sequence in data. The app READS that model, it does not hardcode one. See section 13 for the measured table. THE RULE: before any pass-N write, compute the locked set from every signature field that carries a `/V`. `/Action /All` locks everything, `/Action /Include` locks the named `/Fields`, `/Action /Exclude` locks everything else. Refuse to write any member. Writing a locked field is what breaks a signature; writing an unlocked field does not |
| D-38 | Signing order is forced, one way only | CLOSED 2026-08-25, MEASURED. Item 3's lock list INCLUDES `2 ACC ELECTION AND RIGHTS SIGNATURE`. Item 2's lock list does NOT include `3 RIGHTS ATTEST SIGNATURE`. Member signs item 2 first, then the certifying officer signs item 3, and both work. Reverse them and the member's signature field is read-only and can never be signed, so the form is dead and the only remedy is starting over. Nothing in the form warns anyone. The pass-1 export must carry this order as printed guidance |
| D-39 | Pass 1 writes item 1, items 17-20 and the item 8 block, and NOTHING ELSE | CLOSED 2026-08-25 by Stephen. Findings, item 6, item 7, the item 2 group and everything from item 10 onward belong to later passes. Item 5 findings were exposed in the pass-1 UI and Stephen ruled them out: a finding is the commander's determination made AFTER the election and the hearing, so recording one at notification is a process defect ahead of any code. MEASURED VIOLATION on a live pass-1 export: the app wrote `NONE` into item 7, which the blank leaves undefined |
| D-40 | The blank PRE-ANSWERS the accused's election, and the app clears it | CLOSED 2026-08-25 by Stephen: "Blank for pandered election. No data should be assumed." MEASURED on the untouched government blank with no app involvement: `2 DEMAND` = "I do not demand trial and will accept non-judicial punishment, subject to my right of appeal.", `2 COUNSELOPP` = "have", `2 BOOKER` = "BOOKER STATEMENT: Having been advised of the above and fully understanding my rights, I choose to accept NJP." A notification document handed to a Marine therefore states they accept NJP and carries a Booker statement before anyone has spoken to them. The pass-1 export CLEARS all three. THE TRAP, and it is measured: removing `/V` alone is not clearing. Every one of the three carries a baked `/AP` appearance stream, so the value disappears while the page STILL DISPLAYS the acceptance text. That is the worst available state, a document reading as answered whose field is empty, and it would pass any check written against `/V`. THE CORRECT CLEAR is three operations per field: delete `/V`, delete `/AP` on every widget, and set `NeedAppearances` true on the AcroForm so the viewer regenerates an empty appearance. Verified: values gone, appearances gone, `2 DEMAND` keeps all three options for the member to pick, and `2 BOOKER` keeps its read-only flag. NO UNLOCK IS NEEDED even though `2 BOOKER` is read-only, because this is a dict-level delete rather than a `setText` through the form API. `NeedAppearances` IS A PASS-1-ONLY DEVICE: from pass 2 onward the file carries signatures, and asking a viewer to regenerate appearances across a signed document is a modification nobody sanctioned. Never set it on an incremental write |
| D-41 | `bookerStatement()` becomes a VERIFIER, not a writer | CLOSED 2026-08-25, and this REVERSES the Phase 2 role. `2 BOOKER` is read-only in the blank (`/Ff` 12582913) and its three inputs are editable: `2 DEMAND`, `2 COUNSELOPP`, `2 ACC REFUSE TO SIGN`. The member sets those in Acrobat, the form's own on-blur scripts compose the statement, and the item 2 signature locks all four together. Measured on Stephen's signed file: the group came back coherent. So the app must NOT write item 2 at pass 1. On re-upload it RECOMPUTES the statement from the three returned elections and compares against the returned `2 BOOKER`, blocking on mismatch. That catches the real failure, a member using a reader whose scripts never fire, leaving the blank's shipped ACCEPTANCE default in place on a refusal case. `coerceDemand()` gets the same treatment |
| D-42 | Defect 3.4 is RETIRED | CLOSED 2026-08-25, MEASURED. Items 23-25 came back POPULATED from Stephen's round trip and match items 18-20 exactly. Acrobat runs the calculate scripts when a human opens the file to sign, so the round trip fills page 2 identity. The original finding assumed a single pdf-lib export where no script ever runs, which is no longer the export model. The app VERIFIES these three on re-upload and never writes them |
| D-43 | The export gate needs a PASS SCOPE | CLOSED 2026-08-25. MEASURED on the live app: a valid pass-1 export was blocked by "Item 13 has neither an appeal date nor the Not Appealed checkbox set" and "Item 6 punishment imposed is empty". Item 13 belongs to pass 6 and item 6 to pass 3, so both are CORRECT states for a notification document. `getExportBlockers` must evaluate only the rules whose fields the current pass owns. A rule whose fields are locked or not yet reached stays silent rather than failing |
| D-44 | Pass 1 needs no incremental writer | CLOSED 2026-08-25. Nothing is signed at pass 1, so the existing full-rewrite fill is correct there and `useObjectStreams: false` still applies. The incremental path starts at pass 2. See section 13.3 |
| D-45 | The app locks what the form forgot to lock | CLOSED 2026-08-25, mitigation for defect 3.9. Once `9 NJP AUTHORITY SIGNATURE` carries a `/V`, the app treats items 6, 6 date, 8, 8A, 8B and 10 as APP-LOCKED even though the form leaves them writable, and records their values in the carried state so a later pass detects an outside change |
| D-46 | UI sections are derived, not hardcoded | CLOSED 2026-08-25 by Stephen. On import the app computes the locked set and shows only the sections whose fields are still open. A fresh document shows pass 1 alone. The table in section 13.1 is the expected result and serves as a TEST ORACLE, never as the runtime source of truth, so a future form revision changes behaviour without a code change |
| D-47 | The rights advisement renders DYNAMICALLY off the vessel checkbox | CLOSED 2026-08-25 by Stephen. Toggling `vesselException` re-renders the section live: true gives `APPENDIX_A_1_C`, false gives `APPENDIX_A_1_D`. `selectRightsAppendix` already does this and `renderNjpRights` is pure, so the section is a derived render rather than a stored value. NON-OBVIOUS DEPENDENCY, and it is the reason this row exists rather than being a UI note: the two appendices do not need the same inputs. A-1-d carries paragraph 3, the MAXIMUM punishment rule, which reads `authorityPayGrade` from item 8A and `accusedPayGrade` from item 19. A-1-c has no paragraph 3 and needs neither. So unchecking the box makes items 8A and 19 REQUIRED for a complete advisement, and an empty item 8A renders the maximum rule blank rather than erroring. Both fields are already in the pass-1 section list, so the dependency is satisfiable at pass 1, but the generate option must report the gap instead of emitting a blank paragraph 3 |
| D-48 | No CUI banner on the generated Figure 14-1 | CLOSED 2026-08-25 by Stephen: "no CUI at head and foot." MCO 5800.16 Vol 14 Figure 14-1 prints the literal word CUI above the SSIC block and again below Copy to. The generated letter reproduces the figure's STRUCTURE and drops the marking. GENERALIZED RULE: never hardcode a control marking from a source figure, form or template into an app-generated document. Marking stays a user decision through `src/lib/classification.ts`. WHY: a banner the app prints on its own authority asserts a designation the app has no basis to make, which is the same reasoning behind the standing "CUI Pending" ban. This EXTENDS D-13 and section 6.3 past the form-artwork premise those rested on, since a generated naval letter carries no pre-printed artwork. Say so in the module docstring so the deviation reads as a decision rather than an omission |
| D-49 | The vacation gate tests the DATE WINDOW alone | CLOSED 2026-08-25 by Stephen. THE CONFLICT: MCO 011201 allows vacation only "based on an offense under the UCMJ committed during the period of suspension", while JAGMAN 0118.d allows it on "a violation of the conditions of suspension" in that period. Conditions of suspension is the broader set, so a commander vacating on a condition violation short of a UCMJ offense acts within the JAGMAN and outside the MCO. A gate on the narrower test would BLOCK A LAWFUL VACATION. Both sources word the WINDOW identically, so the window is common ground and the gate lives there. The NATURE of the basis becomes advisory text naming both standards. See V-29 |
| D-50 | ONE letter, not two. REVERSED 2026-08-25 by Stephen | This row originally read "Figure 14-1 serves TWO moments, and the app renders both", and called the single letter in `njp-vacation-handoff.ts` a defect. Stephen ruled the opposite: Figure 14-1 is served ONCE, as the notice of intent, and para 011202 describes the downstream HANDLING of that same letter rather than a second document. THE AMBIGUITY WAS REAL, which is why it went to him rather than being resolved from the text: 011201 requires the accused be notified and given an opportunity to respond BEFORE the suspension may be vacated, while 011202 describes a letter that "notifies the Marine of the commander's decision to vacate the punishment in whole or in part", and one letter cannot both precede and follow the decision. On its face that reads as two documents. It is not how it runs at a unit. CONSEQUENCE: `njp-vacation-handoff.ts` was CORRECT as shipped and needs no change. The commander's decision is recorded on the UPB and in the 011201 summary transcript, not in a second letter. The figure's own paragraph 2, "It is my intent to vacate your previously suspended punishment in: FULL/PART", stays exactly as the figure prints it |
| D-51 | The computed suspension end date is CONDITIONAL, and "floor" was my error | CLOSED FIXED 2026-08-25, and this row CORRECTS ITS OWN EARLIER WORDING. The first draft called the computed date "a floor, not a date". That is wrong, not merely loose. A floor only ever moves the real date LATER. The three unmodelled conditions push in OPPOSITE directions: JAGMAN 0118.c interrupts the running of the period for the probationer's unauthorised absence and for commencement of vacation proceedings, both pushing the real end LATER; MCM Part V para 6.a(2)'s second clause terminates the suspension at expiration of the current enlistment, pushing it EARLIER. The number is neither a floor nor a ceiling: it holds only if none of the three occurred, and the app has a field for none of them. FIX: `endsOn` RENAMED to `endsOnIfUninterrupted` on both `SuspensionPeriod` and `VacationDeadline`, so the field name stops asserting certainty and the compiler finds every consumer. `SUSPENSION_ASSUMPTIONS` carries the three conditions as structured data with a closed `direction` union of `'later' | 'earlier'`, so a renderer or a test keys off the direction rather than grepping prose for a word a future edit could silently invert. `VacationDeadline` carries both the structured list and a rendered caveat built from it. AMENDS D-35, whose caveat named only the enlistment clause and therefore understated the uncertainty it existed to disclose. Surfaced as W-17 |
| D-52 | A second vacation deadline exists, ten WORKING days | CLOSED 2026-08-25. JAGMAN 0118.d: "The order vacating a suspension must be issued within 10 working days of the commencement of the vacation proceedings." Independent of D-36. D-36 runs from imposition to remission; this runs from commencement of proceedings. Working days, so weekends and federal holidays come out of the count. Needs a commencement-date field the app does not have. Advisory rather than blocking, per W-19: the app has no ability to un-issue a late order, and a block would only trap a clerk recording history truthfully |
| D-53 | The appeal statement is conditional AND incomplete | CLOSED BUILT 2026-08-25. MCO 011201: "If only suspended punishment is vacated, an accused has no right of appeal. If additional punishment is imposed, the right to appeal applies." `njp-appeal-package.ts` had ZERO occurrences of "vacat", so it assembled a package around a right that may not exist. JAGMAN 0118.d supplies the half the MCO omits: the decision is not appealable "but is a proper subject of an Article 138, UCMJ, complaint", so saying "no appeal" and stopping is accurate and incomplete. THE HARD PART, and why the API grew a parameter rather than an inference: the app CANNOT determine this from one UPB. A vacation is recorded as a structured item 21 remark, but "additional punishment imposed" means a SUBSEQUENT NJP, which 011201 itself says is a separate action on a separate form this module never sees. So a vacation remark proves a vacation happened and proves nothing about what followed. `appealPackage(formData, additionalPunishment?)` returns one of three shapes: the unchanged 011107 checklist, a vacation-only package citing 011201 and naming the Article 138 remedy, or, when the caller has not said, BOTH branches computed with the deciding fact named. NOT-STATED RESOLVES TO NEITHER, on purpose: defaulting to "rights apply" overstates, and defaulting to "no rights" is worse because it discourages a Marine from appealing. First tests the module has ever had, 18 of them |
| D-54 | Article 31 rights precede any request for a statement | CLOSED 2026-08-25. JAGMAN 0118.d: "If the reason for vacation involves additional misconduct, Article 31, UCMJ, rights must be read to the accused before the commander asks if the accused wishes to make a statement on his or her own behalf." MCO 011201 requires a UCMJ offense as the basis, so this fires in effectively every Marine Corps vacation. `njp-a1-rights.ts` covers A-1-c and A-1-d only. Surfaced as W-18 rather than a blocker, because the app cannot observe whether the reading happened |
| D-55 | The 011202 post-action chain, and the lock collision inside it | CLOSED 2026-08-25. Para 011202 specifies five steps the app models nowhere: administrators update block 16 on the original UPB, forward the letter and updated UPB to IPAC, IPAC returns the completed UPB carrying the UD number and date, IPAC scans the corrected UPB to the ESR and OMPF, and the unit VALIDATES the scanned copy against the binder original. The last step is a verification duty. Checklist material on the `njp-appeal-package.ts` pattern. THE COLLISION: `16 FINAL ADMIN INIT` carries `/Action /All`, so signing it locks the entire document. A vacation happens months later and 011202 orders a block 16 update on the ORIGINAL UPB, which that lock makes impossible in place. The form's lock design and the order's procedure contradict each other. Sixth finding for the CMC (JA) report. Block 16 itself resolves cleanly: it is `finalAdminUd` and `finalAdminDtd`, and 011202's loose phrase "vacated punishment information" resolves against its own closing sentences to the unit diary NUMBER AND DATE of the vacation action, not a punishment description. No capacity problem |
| D-56 | Vacating authority needs its own field, and item 8A is the wrong source | CLOSED 2026-08-25. MCO 011201: a suspended NJP "may be vacated by any commander authorized to impose upon the accused punishment of the kind and amount to be vacated." TWO consequences. The vacating commander is NOT necessarily the imposing commander, so item 8A cannot supply it. And "kind and amount" is a COMPUTABLE predicate against `resolveAuthorityLevel` and the N-code ceilings already shipped, so a company-grade commander vacating a field-grade forfeiture is detectable. JAGMAN 0118.a defines "successor in command" by reference to U.S. Navy Regulation 1026 and expressly NOT limited to the next succeeding officer, so the field is free text over a rank, not a pick from the current chain. See V-30 |
| D-57 | The MCO narrows a protection below the JAGMAN. Log it, build nothing | CLOSED 2026-08-25. JAGMAN 0118.d sets the appear-before-the-commander trigger at "Article 15(e)(1)-(7)". MCO 011201 sets it at "(1)-(6)", dropping item (7), detention of more than 14 days' pay. Not house style: the same MCO transcribes all seven at 011402 A-G for judge advocate review, and that transcription is FAITHFUL to 10 U.S.C. 815(e), verified verbatim 2026-08-25. So 011402.G is NOT an MCO defect, correcting an earlier framing; the dead text originates upstream in the statute retaining detention while MCM Part V para 5.b does not prescribe it. PRACTICAL IMPACT TODAY IS ZERO, since detention is unprescribed and MCTFS carries no code. Route to the CMC (JA) report and write no logic |
| D-58 | Validation issue ids must be keyed on a UNIQUE index | CLOSED FIXED 2026-08-25, found while closing D-51 and REAL rather than theoretical. `suspensionPeriodFindings` (feeding V-22) and the new W-17 rule both built their ids from `punishmentIndex`. Nothing anywhere forbids two item 7 suspensions targeting the same item 6 punishment: `suspensionIndexBoundsIssues` checks bounds only, never uniqueness, so duplicate-target suspensions are ordinary valid input. THE CONSEQUENCE WAS VISIBLE, NOT LATENT: `ComplianceDialog.tsx` line 80 and `PackageDialog.tsx` line 95 both render the issue list with `key={issue.id}`, and React keeps only one element per key within an array render. So a clerk with two over-six-month suspensions on one punishment saw ONE V-22 blocker on screen while `getExportBlockers` returned two. Same failure shape as D-34, a real problem present in the data and invisible on the surface, reached through React's key collapsing rather than through severity mislabelling. FIX: both ids now key on the new `suspensionIndex`, which is unique across the array by construction. The id PREFIX was deliberately not changed, because the export-gate meta guard matches rules by prefix. STILL OPEN, NOT REACHABLE TODAY: `navmc10132-v20-forfeiture-over-ceiling-${index}` is emitted from two branches that would collide if one punishment code ever carried both `dollars` and `dollarsPerMonth` as exact parameters. Checked all 17 codes; none does. Latent fragility, logged rather than fixed |
| D-59 | Only one suspension per punishment | CLOSED BUILT 2026-08-25 by Stephen's ruling, and the citation is UNUSUAL ON PURPOSE. Two or more item 7 entries must never target the same item 6 punishment. NOTHING IN THE MCM, THE JAGMAN OR MCO 5800.16 VOL 14 SAYS THIS. Two independent searches found no paragraph, so the rule rests on the subject-matter expert's determination, and V-31 cites it that way rather than borrowing a regulation that does not say it. A validator message citing a paragraph which does not support it is the exact failure class this app exists to prevent, so this is a boundary worth holding even when a plausible-looking cite is available. STRUCTURAL CORROBORATION, stated separately and never as the authority: the NAVMC 10132 carries ONE item 7 field, so the printed record has no way to express two independent suspensions distinctly. WHY IT MATTERS BEYOND TIDINESS: duplicate-target suspensions were ordinary valid input until today, and that is what made D-58's id collision and the vacation-letter mis-lookup reachable from a valid form rather than from malformed data. If a published paragraph ever turns up, replace the citation in V-31 with it |
| D-60 | Nothing records a vacation's OUTCOME back onto the UPB | OPEN, found 2026-08-25 while building D-53. `njp-vacation-handoff.ts` generates the Figure 14-1 notice. `navmc10132-remarks.ts` carries the `suspension-vacated-njp` remark kind that records the vacation on item 21. NOTHING CONNECTS THEM. The only path from a served notice to a recorded vacation is a clerk remembering to add the structured remark by hand, and nothing anywhere flags its absence. THE CONSEQUENCE IS NOW LOAD-BEARING: D-53's appeal logic keys off that remark, so an executed vacation that nobody recorded looks, to the app, like a case where the appeal checklist applies normally. It also breaks the 011202 chain in D-55, whose first step is updating block 16 from the commander's letter. Fix belongs with the vacation UI, not with either module in isolation |

---

## 11. MCTFS code integration

Two code tables were supplied 2026-08-23: 17 punishment codes (N01-N17) and 113 article codes.
Provenance confirmed 2026-08-23: MCTFSPRIUM reporting tables. The manual is not publicly
posted, so the tables below could not be verified against the source. The VERSION and DATE of
the MCTFSPRIUM copy are still needed for the citation string, decision D-8. Every mapping below
was computed from the supplied tables, not eyeballed.

### 11.1 Article codes: the mapping is total in one direction

| Measure | Value |
|---|---|
| Form dropdown selectable options | 167 |
| Form distinct article numbers | 89 |
| MCTFS article codes | 113 |
| MCTFS distinct base articles | 93 |
| Form articles with NO MCTFS code | 0 |
| MCTFS base articles with NO form option | 4 |

Every offense a clerk can pick on the form maps to an MCTFS code. The relationship is
many-to-one: 167 form strings collapse onto 113 codes. That is the right direction for a
crosswalk, because the form string is what prints and the code is what the unit diary needs.

Four MCTFS codes have no form option:

| Code | Description | Assessment |
|---|---|---|
| 77 | PRINCIPALS | Art. 77 is a theory of liability, not a chargeable offense. Correct to omit from the form |
| 78 | ACCESSORY AFTER THE FACT | A real standalone offense. Genuine gap in the form dropdown |
| 79 | CONVICTION OF OFFENSE CHARGED, LESSER INCLUDED OFFENSES, AND ATTEMPTS | A court-martial findings provision, not an NJP offense. Correct to omit |
| 109A | MAIL MATTER: WRONGFUL TAKING, OPENING, ETC. | A real offense and squarely a minor one. Genuine gap in the form dropdown |
| 134.109 | VISUAL DEPICTION, NONCONSENSUAL DISTRIBUTION OR BROADCAST | Superseded by Art. 117a, which the form does carry. Legacy code |

Art. 78 and Art. 109A are the two that matter. A clerk charging accessory after the fact or
wrongful opening of mail has no dropdown entry, and the article dropdown is not editable. The
only path is the item 21 "Additional Offenses" remark. Add both to the CMC (JA) defect report.

### 11.2 Article codes needing a disambiguation rule

Twenty base articles carry multiple form options that collapse to a single MCTFS code. The
crosswalk is unambiguous in the form-to-code direction, so nothing breaks, but the code loses
detail the form captured. Largest collapses:

| Article | Form options | MCTFS code |
|---|---|---|
| 92 | 22 | 92, plus 92.1 for sexual harassment |
| 134 | 25 | 20 sub-codes |
| 108 | 5 | 108 |
| 120c | 5 | 120C |
| 86 | 4 | 86 |
| 120 | 4 | 120 |

Two special rules:
- Art. 92: two of the 22 options are sexual harassment (`Viol. MCO 5354.1 (series) (Sexual
  Harassment)` and `Viol. USNR 1166 (Sexual Harassment)`). Both route to code 92.1. The other
  twenty route to 92. Getting this wrong misreports a sexual harassment case as an ordinary
  order violation, which is a reportable-category error, not a clerical one.
- Art. 134: `Art. 134 Sexual harassment` routes to 134.110. Four General Article options
  (bare plus Clauses 1, 2, and 3) collapse to 134.91. Four drunk and disorderly options
  (disorderly conduct, drunk and disorderly, drunk and disorderly aboard ship, drunkenness)
  collapse to 134.98.

The crosswalk table is data, not code: `src/lib/navmc10132-articles.ts` exports 167 rows of
`{ formLabel, mctfsCode, articleNumber, minorOffenseRisk }`. A test asserts every form option
has exactly one code and that the two sexual-harassment routes land on 92.1 and 134.110.

### 11.3 Punishment codes: the code IS the ceiling

Each N code names its own maximum. That removes the need for a text parser in W-05 and W-06
and converts item 6 from free text into a structured builder.

| Code | Punishment | Authority under 10 U.S.C. 815(b) | Applies to | Parameters |
|---|---|---|---|---|
| N01 | Restriction w/ susp from duty, 30 days | (b)(1)(A), any CO | OFFICER | limits, days |
| N02 | Restriction w/o susp, 30 days | (b)(1)(A), any CO | OFFICER | limits, days |
| N03 | Arrest in quarters, 30 days | (b)(1)(B)(i), GCMCA or GO | OFFICER | days |
| N04 | Forfeiture, 1/2 month pay per month for 2 months | (b)(1)(B)(ii) AND (b)(2)(H)(iii) | OFFICER or ENLISTED field grade | whole dollars per month, months |
| N05 | Restriction w/ or w/o susp, 60 days | (b)(1)(B)(iii) OR (b)(2)(H)(vi) | AMBIGUOUS, see D-10 | limits, days, susp flag |
| N06 | Correctional custody, 7 days | (b)(2)(B), any NJP authority | ENLISTED | days |
| N07 | Forfeiture, 7 days pay | (b)(2)(C), any | ENLISTED | whole dollars |
| N08 | Reduction to next inferior grade | (b)(2)(D), any | ENLISTED | grade reduced to |
| N09 | Extra duties, 14 days | (b)(2)(E), any | ENLISTED | days |
| N10 | Restriction w/ susp, 14 days | (b)(2)(F), any | ENLISTED | limits, days |
| N11 | Restriction w/o susp, 14 days | (b)(2)(F), any | ENLISTED | limits, days |
| N12 | Correctional custody, 30 days | (b)(2)(H)(ii), field grade | ENLISTED | days |
| N13 | Extra duties, 45 days | (b)(2)(H)(v), field grade | ENLISTED | days |
| N14 | Restriction w/ susp, 60 days | (b)(2)(H)(vi), field grade | ENLISTED | limits, days |
| N15 | Restriction w/o susp, 60 days | (b)(2)(H)(vi), field grade | ENLISTED | limits, days |
| N16 | Admonition | (b) preamble | Either | oral or written |
| N17 | Reprimand | (b) preamble | Either | oral or written |

Release 1 is enlisted. N01, N02, and N03 are officer-only and are refused by blocker V-14.
N05 is withheld pending D-10; enlisted 60-day restriction routes to N14 or N15.

N08 reads "reduction to the next inferior grade," which is narrower than 10 U.S.C.
815(b)(2)(H)(iv), where a field-grade CO may reduce to the lowest or any intermediate grade.
That is NOT a code-table defect. MCO 5800.16 Vol 14 para 010302.C narrows Marine reductions to
the next inferior paygrade by policy, so N08 is USMC-correct and stricter than the statute.

### 11.4 Code-table gaps, and one that is not a gap

Two statutory punishments have no N code. They are not the same kind of finding.

| Punishment | 10 U.S.C. 815(b) | MCM Part V 5.b | N code | Verdict |
|---|---|---|---|---|
| Confinement, 3 days, person attached to or embarked in a vessel | (2)(A) yes | yes, both (2)(A)(i) and (2)(B)(i) | NONE | GENUINE MCTFS GAP |
| Detention of 14 days pay, any authority | (2)(G) yes | ABSENT | NONE | NOT an MCTFS gap. See below |
| Detention of 1/2 month pay per month for 3 months | (1)(B)(iv) and (2)(H)(vii) yes | ABSENT | NONE | NOT an MCTFS gap. See below |

CORRECTION to the first read of this table. Detention of pay is authorized by the statute but
does NOT appear in MCM Part V paragraph 5.b, in either public extract checked. The President has
not prescribed detention as an available punishment. So the absence of a detention code in
MCTFS is CORRECT and consistent with the MCM. The MCTFS table is not defective here.

The defect moved. MCO 5800.16 Vol 14 para 011402.G makes "Detention of more than 14 days' pay"
a mandatory judge-advocate review trigger before an appeal authority acts. The order requires a
review for a punishment Part V does not authorize a commander to impose. 011402.G is dead text.
That is a defect in the ORDER, not in the reporting vocabulary, and it is the third finding for
the CMC (JA) defect report.

The vessel-confinement gap stands and remains an MCTFS finding. Part V authorizes it at both
authority levels, MCTFS cannot express it. It matters little in practice but interacts with the
Booker vessel-exception branch in defect 3.2, so the app offers no code rather than a wrong one.

Note the vessel-confinement wording differs across MCM extracts: the older text reads
"confinement on bread and water or diminished rations," language struck from 10 U.S.C. 815
effective 1 Jan 2019. Use the current statutory form, plain 3-day confinement, if this is ever
implemented.

### 11.5 What this changes in the build

Item 6 becomes a structured builder, not a text box:

1. User adds one or more punishment codes from the enlisted-legal set.
2. Per-code parameter inputs appear: days, whole dollars, limits text, grade reduced to.
3. The app checks the parameter against the code's own ceiling (W-06) and checks the code
   against the item 8A authority grade (W-05).
4. The app renders the prescribed abbreviated string using the eleven authorized abbreviations
   and writes it to item 6, under the 123-character budget.
5. The structured codes persist in the document data, so the same NJP feeds a unit-diary handoff.

The render step is where this earns its keep, because the abbreviated forms are prescribed and
the field is small. Measured against the MCO's own worked examples, with the date excluded
since item 6 has a separate date field:

| MCO example | Rendered length | Fits 123 |
|---|---|---|
| Restriction, 14 days, w/o susp | 75 | yes |
| Forfeiture, $250 for 2 months | 57 | yes |
| Correctional custody, 7 days, w/ susp | 34 | yes |
| Restriction to mess, billet, duty, worship, 14 days, PLUS extra duties 14 days concurrent | 160 | NO, over by 37 |
| Reduction to LCpl and oral reprimand | 53 | yes |

The order's own combination example does not fit the field the order governs. The builder must
detect the overflow, offer the abbreviated limits phrase, and fall back to "See Supplemental
Page" with the full punishment in item 21. That is blocker V-15.

### 11.6 Unit-diary handoff, decision D-9

Item 16 requires unit diary entries per MCTFSPRIUM and records the UD number and date. Once the
app holds article codes and punishment codes as structured data, emitting the IPAC handoff is
close to free: accused EDIPI, unit RUC, NJP date, article codes with findings, punishment codes
with parameters, suspension terms, and appeal status.

Recommend shipping it as a copyable text block or CSV in release 1, not an MCTFS transaction.
The app has no MCTFS connectivity and should not pretend to. Reuse the `edms-handoff.ts`
pattern already in the repo.

## 13. The pass model

The document is filled across seven passes. Each ends at a signature, and each signature
names the fields it makes read-only. The form therefore defines its own sequence, which
the app reads rather than hardcodes. See D-37.

### 13.1 The measured table

| pass | ends with | app writes in this pass | open entering | closes |
|---|---|---|---|---|
| 1 | `2 ACC ELECTION AND RIGHTS SIGNATURE`, accused | item 1 A-E article and summary, items 17-20, item 8 block, victim block 22A-22E if used | 74 | 43 |
| 2 | `3 RIGHTS ATTEST SIGNATURE`, certifying officer | nothing | 31 | 2 |
| 3 | `9 NJP AUTHORITY SIGNATURE`, imposing | item 4, item 5 findings A-E, item 6 punishment and date, item 7 suspension, item 8 block, item 10 | 29 | 13 |
| 4 | `11 APPEAL ADVISEMENT SIGNATURE` | item 11 date | 22 | 3 |
| 5 | `12 APPEAL INTENT SIGNATURE` | item 12 election and date | 20 | 3 |
| 6 | `14 APPEAL DECISION SIGNATURE` | item 13 date or Not Appealed, item 14 decision and date | 17 | 7 |
| 7 | `16 FINAL ADMIN INIT`, `/Action /All` | item 15 date, item 16 UD and DTD, item 21 remarks | 12 | all |

PASSES 1 AND 2 ARE ONE PHYSICAL ROUND TRIP. The app exports once, the member signs item 2,
the certifying officer signs item 3, and the file comes back.

THE VICTIM BLOCK CLOSES AT PASS 1, alongside the accused's signature. Anything entered in
22A-22E must precede it. Victims 2-5 route to item 21 remarks per D-1, which stays open
until pass 7, so that path is unaffected.

FINDINGS CLOSE AT PASS 3. They are writable earlier, and exposing them earlier is a
process defect per D-39.

### 13.2 Pass 1 UI, as ruled by Stephen 2026-08-25

The pass-1 form shows exactly these sections and nothing else:

- Unit and Accused, items 17-20
- Rank and Pay Grade, item 19
- Offenses and findings, items 1 and 5, WITH THE FINDING CONTROL HIDDEN
- Item 2, Accused Election, REDUCED TO TWO CONTROLS:
  - the vessel status checkbox, `vesselException`
  - the rights advisement, rendered DYNAMICALLY off that checkbox, with a generate option
- NJP Authority, items 8, 8A and 8B

The pass-1 export CLEARS `2 DEMAND`, `2 COUNSELOPP` and `2 BOOKER` per D-40. The clear is
three operations per field, not one: delete `/V`, delete `/AP` on every widget, set
`NeedAppearances`. A test asserting only that `/V` is gone passes on a document that still
prints the acceptance text.

WHY ITEM 2 APPEARS AT ALL, AND WHY ONLY THAT MUCH. `vesselException` is APP STATE, not a
form field. It records a fact about the accused rather than an election, it is settled
before the accused answers anything, and it selects which advisement is served:
`njp-a1-rights.ts` already returns `APPENDIX_A_1_C` when it is true and `APPENDIX_A_1_D`
when it is false. Everything else in item 2 belongs to the member in Acrobat, per D-41.

THE ADVISEMENT IS A DERIVED RENDER, NOT A STORED VALUE. Toggling the checkbox re-renders it,
per D-47. Watch the asymmetry: A-1-d carries paragraph 3, the maximum-punishment rule, which
reads item 8A and item 19; A-1-c has no paragraph 3 and reads neither. Clearing the checkbox
therefore makes two other pass-1 fields required for a complete advisement, and an empty item
8A renders that paragraph blank rather than raising an error.

BECAUSE `vesselException` IS APP-ONLY, it does not survive in the PDF. It has to ride in
the carried state, and it is the concrete case proving the carrier is needed.

GAP: `njp-a1-rights.ts` is built and wired to nothing. No component or hook imports it.
The generate option is new work, not a wiring task.

### 13.3 Which writer each pass uses

Pass 1 needs no incremental writer, because nothing is signed yet. The existing
full-rewrite fill applies, with `useObjectStreams: false` per Phase 0.

From pass 2 onward the file carries signatures and every write must be an incremental
update that leaves prior bytes untouched. That path requires `useObjectStreams: TRUE`,
which is the OPPOSITE of the Phase 0 rule and correct in its own path. Do not harmonize
the two. A classic xref table appended to this form's xref stream is rejected by Acrobat
with "Unexpected byte range values defining scope of signed data", which is a structural
rejection thrown before any hash check rather than a tamper report.

Verified end to end on a real CAC-signed file: the signed revision was preserved
byte-for-byte, the ByteRange was unchanged, every written value read back through an
independent parser, and the locked accused name was untouched.

---

## 12. Sources

- NAVMC 10132 (REV. 08-2023) (EF), supplied 2026-08-23; same revision posted at sja.marines.mil under a 2025-03 filename
- MCO 5800.16 Vol 14, 18 MAY 2021, supplied 2026-08-23
- MARADMIN 427/23, UNIT PUNISHMENT BOOK POLICY UPDATE, 281800Z AUG 23
- Manual for Courts-Martial, United States (2024 edition), Part V, paragraphs 2, 5.a, 5.b, 5.c, 5.d. Supplied 2026-08-24. Edition confirmed from the title page and preface. Supersedes the 2019 edition reading used through 2026-08-23
- JAGINST 5800.7G
- 10 U.S.C. 815; 10 U.S.C. 486 (repealed, Pub. L. 118-159 sec. 566(b)(1), 23 Dec 2024)
- ISO 32000-1 Table 231, choice field `/Opt` export and display ordering
- MCTFSPRIUM reporting tables: punishment codes N01-N17 and 113 article codes, as of 20260823, supplied by Stephen. `N` prefix denotes nonjudicial punishment, `C` denotes court-martial. Not publicly posted
- 10 U.S.C. 815(b), authorized punishments, verified against the current U.S. Code text
