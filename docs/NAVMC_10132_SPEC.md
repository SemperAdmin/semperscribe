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
| MCO 5800.16 Vol 15 | Amended 2023 | Current | Officer NJP. Out of scope, release 1 |
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

MARADMIN 427/23 amended Vol 15 paragraphs 010502.B.1, 010502.B.5, 010605, and Figure 15-5 to
require the UPB in officer NJP cases. Vol 15 is unaudited. Release 1 is enlisted only, and the
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

W-05 and W-06 no longer need a text parser. Section 11 replaces free-text item 6 with a
structured builder over the MCTFS punishment codes, so the ceiling and the required authority
grade come from the selected code rather than from a regex. A parser survives only on the
IMPORT path, for reading an item 6 string written outside the app. There it stays
false-positive tolerant and warn-only, same posture as the 10922 foreign-divorce heuristic.

### 6.3 Deliberately NOT enforced

- Signature-driven locks. Your decision: capture and export only. Lock semantics stay in
  Acrobat, where the signatures happen.
- "Do not add offenses or victims after the accused signs." A lock rule with no signature event
  for the app to key on. Surface as static guidance on the offense and victim sections.
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
- Live preview: pending decision D-2, section 4.1.

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
| D-2 | Does the app's pdfjs preview pane paint pdf-lib generated widget appearances | Probe in Phase 0. Gates whether a flattened generator is in scope |
| D-3 | Punishment parser scope for W-05 through W-08 | Restriction days, extra duty days, forfeiture dollars, reduction target. Skip correctional custody and arrest in quarters in release 1 |
| D-4 | Does this need the in-app signature flow from SIGNATURE_COLLECTION_PLAN | No. Items 9 and 16 are CAC-signed in Acrobat. Leave the widgets open |
| D-5 | Should the app clear the RichText flag on item 21 | Only if the Phase 0 Acrobat check shows the value does not render |
| D-6 | Defect report to CMC (JA) | Yes. `docs/NAVMC_10132_DEFECT_REPORT.md`, two findings: the victim-status vocabulary split and the repealed 10 U.S.C. 486 reference. Route through the MARADMIN 427/23 POCs |
| D-7 | Re-verify MCM Part V against the 2024 edition | PARTIALLY RETIRED 2026-08-23. Substance of 1.e, 1.f, and 5.b verified across two independent extracts. Neither confirmed as the 2024 edition. Paraphrase with a paragraph cite; do not quote verbatim until a Marine Corps network copy is checked. See 1.4 |
| D-8 | Provenance of the two code tables | RESOLVED 2026-08-23: MCTFSPRIUM reporting tables, confirmed by Stephen. Remaining gap: the MCTFSPRIUM version and date, needed for the citation string. MCTFSPRIUM is not publicly posted, so this must come from Stephen's copy |
| D-9 | Does release 1 emit a unit-diary handoff | Recommend yes. Section 11.6. The codes make it nearly free and item 16 already demands the unit diary entry |
| D-10 | N04 and N05 authority assignment | Confirm against the MCTFSPRIUM narrative around the code tables. N04 serves both officer-GCMCA and enlisted field grade; N05 duplicates N14 plus N15. Until confirmed, treat N05 as officer-only and route enlisted 60-day restriction to N14 or N15 |
| D-11 | Detention of pay | No app support. Part V does not authorize it, MCTFS has no code, and MCO 011402.G is dead text. Record the finding, build nothing |

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

## 12. Sources

- NAVMC 10132 (REV. 08-2023) (EF), supplied 2026-08-23; same revision posted at sja.marines.mil under a 2025-03 filename
- MCO 5800.16 Vol 14, 18 MAY 2021, supplied 2026-08-23
- MARADMIN 427/23, UNIT PUNISHMENT BOOK POLICY UPDATE, 281800Z AUG 23
- Manual for Courts-Martial, 2019 ed. Part V (paragraphs verified); 2024 ed. is current and re-verification is pending per D-7
- JAGINST 5800.7G
- 10 U.S.C. 815; 10 U.S.C. 486 (repealed, Pub. L. 118-159 sec. 566(b)(1), 23 Dec 2024)
- ISO 32000-1 Table 231, choice field `/Opt` export and display ordering
- MCTFSPRIUM reporting tables: punishment codes N01-N17 and 113 article codes, supplied by Stephen 2026-08-23. Version and date pending per D-8. Not publicly posted
- 10 U.S.C. 815(b), authorized punishments, verified against the current U.S. Code text
