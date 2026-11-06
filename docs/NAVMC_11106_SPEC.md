# NAVMC 11106 (REV. 1-89) (EF) - Application for Cost-of-Living Allowances

Completion specification derived from the official form and its governing policy.
Status - built 2026-11-05 per `docs/NAVMC_11106_BUILD_PLAN.md`. Adobe Reader and CAC signing await the owner's check.
Scope - OCONUS COLA, plus the one CONUS COLA case a Marine stationed overseas can reach.

**Citation convention.** `Ch 68` is DoD FMR Vol 7A Chapter 68 (January 2025, the current
revision). `MCO Ch 6` is MCO 1300.8 W/ADMIN CH-2, Enclosure (2), Chapter 6. `PRIUM` is the
MCTFS PRIUM paragraph number. `FPM` is MCTFS FPM Vol 1 (April 2026). AskMCAAT rulings are cited
by ID only. Interpretive rulings, not regulation. The source emails stay out of this repo:
they carry names, DoD IDs, and CUI markings.

## 1. Authority chain

| Layer | Source | Controls |
|---|---|---|
| Statute | 37 U.S.C. 405 | Authority for the allowance |
| Entitlement | Ch 68 | Who rates COLA, at what rate, start and stop |
| Assignment | MCO Ch 6 | Tour type, command sponsorship, approval path |
| Pay handling | FPM par 070501 | Names the 11106 and the unit diary as substantiation |
| Form and reporting | PRIUM 80102, 80101 | How to complete the form; TTC 013/014/015/026 |
| Records | MCO 1070.1; MARADMIN 015/20 | Where the completed form is filed |

The JTR no longer carries this entitlement. Its "Disclaimer for Chapters 8-10" points to FMR
Chapters 26, 67, and 68, and Ch 68 par 1.2 says it includes policy previously in JTR Chapter 9.
JTR Appendix A still supplies the command-sponsored definition.

## 2. When the form is required

| Situation | 11106 | Source |
|---|---|---|
| OCONUS COLA with dependents | Yes | PRIUM 80102 par 2 |
| OCONUS COLA without dependents (own right) | Yes | PRIUM 80102 par 2 |
| Barracks COLA | No. Unit diary only | PRIUM 80102 par 3 |
| Dependents at an OCONUS location away from the PDS (dual COLA) | Yes | PRIUM 80102; Ch 68 2.2.2 |
| Member overseas, dependents in CONUS, CONUS COLA above $0 | Yes, "CONUS COLA" and ZIP in Remarks | PRIUM 80101 par 3 |
| Same, CONUS COLA is $0 | No | AskMCAAT 039-24 |

## 3. Command sponsorship

### 3.1 Definition

A command-sponsored dependent is "a dependent who is authorized by the appropriate authority to
reside at a location OCONUS with a Service member on an 'accompanied' tour" (JTR Appendix A). A
non-command-sponsored dependent is one not authorized or approved to reside there.

Sponsorship is an authorization. It is not the same as being a dependent in MCTFS, holding an
approved NAVMC 10922, or physically living at the PDS.

### 3.2 Criteria (MCO Ch 6 par 5.b)

All must hold:

1. An accompanied tour is authorized for the location.
2. The Marine has the obligated service for that tour, or extends or reenlists to get it.
3. The installation commander has authorized dependents in the vicinity.
4. The Marine has not elected the unaccompanied tour.
5. Dependents were found suitable by overseas screening. Hawaii and Alaska assignments require
   no screening (par 2).
6. Any special needs can be met at the location.

The gaining installation G-1/S-1 processes requests under locally established procedures and
reports approval or disapproval by naval message (par 4.b(4)).

### 3.3 Determining the block C10 date

The app captures a **sponsorship basis** on each dependent row. The basis decides which date
applies and whether the row prints.

| Basis (`sponsorshipBasis`) | Date to use | Prints and counts | Source |
|---|---|---|---|
| `installation-approval` | Date the gaining installation approved sponsorship | Yes | MCO Ch 6 par 4.b(4), 5 |
| `cmc-conversion` | Date CMC approved the tour conversion | Yes | MCO Ch 6 par 9.e(1)(a), (d) |
| `command-award` | Date the command awarded sponsorship to an acquired or formerly non-sponsored dependent, no tour conversion needed | Yes | MCO Ch 6 par 6.e, 7.c |
| `birth` | Date of birth. Filled from the row's date of birth | Yes | MCO Ch 6 par 6.b |
| `adoption-placement` | Date placed in the home, including pre-adoptive placement | Yes | MCO Ch 6 par 6.d |
| `dual-mil-separation` | Day after the spouse's separation | Yes | MCO Ch 6 par 5.c |
| `not-required` | None. Sponsorship not required under an exception | Yes | Ch 68 2.2.3, 2.1.5.2, 2.1.5.3 |
| `designated-place` | None. Unaccompanied, paid by the dependent's location | Yes | Ch 68 2.2.2, Table 68-1 |
| `not-sponsored` | None. Not claimable | **No** | Ch 68 3.6, 2.1.6.4 |
| `active-duty-spouse` | None. An active-duty spouse is not a dependent | **No** | Ch 68 2.2.1, Table 68-5 |

The spouse row does not offer `birth` or `adoption-placement`, because `birth` takes its date from
the row's event date, which on that row is the marriage date. Dependent rows do not offer
`active-duty-spouse` or `dual-mil-separation`.

Limits the `birth` hint states:
- Applies during an accompanied tour, or to a child born to a female Marine on an unaccompanied or
  dependent-restricted tour.
- A child born to a sponsored dependent who is not the Marine's spouse is not eligible without
  separate action (par 6.c).

**Policy gap.** No Marine-wide source names the document that proves the date. It is left to
local procedure. App wording: "Approval date from the installation G-1/S-1 message or orders
endorsement."

`designated-place` is a reading, not a stated rule. PRIUM does not say how to complete block C10
for an unaccompanied Marine whose dependents are paid by their own location.

### 3.4 Timing rules

- C10 alone does not start the rate. The dependent must be both sponsored and at the PDS vicinity
  (Ch 68 2.1.5, 3.3). With-dependent COLA generally starts on the later of C9 and C10.
- C10 normally precedes C9. Sponsorship is generally required before Government-funded travel
  starts (JTR 050803).
- Acquired or newly sponsored dependents need at least 12 months left on the tour after arrival or
  approval, whichever is later (MCO Ch 6 par 6.a, 7.b). The app states this in help text and does
  not compute it, because the form has no rotation date.
- Accompanied converting to unaccompanied: entitlement changes on the date CMC approves
  (MCO Ch 6 par 9.e(2)(d)).

## 4. Part A is computed, never selected

Owner ruling 2026-11-05. The Marine does not choose Part A. The app derives it from Part C.

```text
counted = rows with any filled field, excluding not-sponsored and active-duty-spouse

counted is empty              -> box 1, FOR MEMBER ONLY         (radio value mem)
counted exists, option off    -> box 2, FOR MEMBER AND DEPENDENTS (radio value both)
counted exists, option on     -> box 3, FOR MEMBER'S DEPENDENTS ONLY (radio value dep)
```

The UI shows all three boxes read-only with the computed one marked.

The **Dependents only** checkbox appears only while `counted` is not empty. When the last counted
row is removed, `dependentsOnly` resets to false so it cannot return on its own later. The
`dependentsOnly` flag is ignored whenever `counted` is empty.

Policy fit (PRIUM 80102 par 3.a(1)): box 1 is the without-dependent rate, box 2 the with-dependent
rate, box 3 the with-dependent rate only. Part C's heading limits the list to dependents "for
which COLA is claimed", so excluding the two non-claimable bases keeps the computed box correct.

A dual-COLA Marine files box 3 for the dependents' location. The Marine's own-right COLA at the
PDS is a separate application with no dependents listed, which computes to box 1. PRIUM does not
state whether two forms are expected. This is the reading its two-remark reporting implies.

## 5. Field map

Full AcroForm names carry the prefix `topmostSubform[0].Page1[0].`

### Part B

| Block | Field | Data key | Limit | Rule |
|---|---|---|---|---|
| B1 Name | `NameApplc[0]` | `nameOfMarine` | 70 | Last, First, MI |
| B2 Grade | `GrdApplc[0]` | `grade` | 20 | |
| B3 Date of rank | `DateRnk[0]` | `dateOfRank` | | |
| B4 **EDIPI** | `SocSecNoApplc[0]` | `edipi` | 10 digits | Section 6 |
| B5 Duty station | `DutyStatn[0]` | `dutyStation` | 130, multiline | City, Province, Country |
| B6 Orders effective | `DateOrdrs[0]` | `ordersEffectiveDate` | | |
| B7 Arrival | `DateArrvl[0]` | `dateOfArrival` | | Starts COLA (Ch 68 3.2.1) |

### Part C

| Block | Field | Limit |
|---|---|---|
| 1A, 1B, 1C spouse | `NameSps1[0]`, `RelatnshpSps1[0]`, `DateMarr[0]` | 25, 20, date of marriage |
| 2 to 7 A, B, C | `NameDepN[0]`, `RelatnshpDepN[0]`, `DateDepBrthN[0]` | 25, 20, date of birth |
| 8 Location | `DepLoc[0]` | 70 |
| 9 Dependents arrive | `DateDepArrv[0]` | |
| 10 Command sponsored | `DateDepComnd[0]` | |
| Member's date | `DateMemSigntr[0]` | |
| Member's signature | `SigMem[0]` | Never written |

Excluded rows close up, so printed rows have no gaps. Row 1 prints only for a counted spouse.

### Part D

| Block | Field | Values (verified against widget rectangles) |
|---|---|---|
| D1 quarters | `RadD1AvailNot[0]` | `y` Available, `n` Not Available |
| D1 assignment | `RadD1AssnNot[0]` | `Yes` Assigned, `no` Not Assigned |
| D1 to whom | `RadD1ToMemDep[0]` | `mem` To the Member, `dep` To the Member's Dependents |
| D2A mess | `RadD2AvailNot[0]` | `y` Is, `n` Is Not |
| D2A who | `RadD2Mem[0]` | `memdep` Member and Dependents, `mem` Member |
| D2B | `RadD2B1[0]` | `y` Enlisted authorized to mess separately, `n` Impractical |
| D3 effective | `DateApplcEffct[0]` | Date |
| Remarks | `RemrkD3[0]` | 720, multiline |
| CO date | `DateCmndOffcr[0]` | |
| CO name, grade, activity | `NameComndOffcr[0]` | 65 |
| CO signature | `SigCO[0]` | Never written |

Part A radio: `RadA1[0]`.

The form's radio tooltips are misleading ("not available" sits on the whole group). Map by value.

**Date format.** `YYYY-MM-DD`, the form's own template picture. Internal storage is ISO, so no
conversion is needed.

**Part D starts empty.** PRIUM 80102 par 3.b gives it to the commander. The section is labeled
"Commander completes". The radios carry `NoToggleToOff`, so once set they cannot be cleared in
Reader. That is why the blank must have no presets, and why the Okinawa copy that prompted this
work must never be bundled.

## 6. EDIPI replaces SSN

Owner ruling 2026-11-05.

- Printed label `4. SSN` becomes `4. EDIPI`, baked into the normalized blank.
- The field keeps its AcroForm name `SocSecNoApplc[0]`, so maps stay honest to the source file.
  Tooltip becomes "Enter applicant's 10-digit EDIPI." The data key is `edipi`.
- Validation matches the 10922: `/^\d{10}$/`.
- `DynamicForm` input uses `digitsOnly`, `maxLength: 10`, as on the 10922.

**Known risk, accepted.** The form still prints `REV .1-89`, and no form-manager revision makes
this change. The app's output differs from the catalog copy on this one label. Recorded here so
an inspector's question has an answer. The NAVMC 10922 made the same change officially in its
7-21 revision. The 11106 has not.

## 7. Bundled blank

`public/forms/navmc-11106-blank.pdf`, generated by `tools/aa-forms/normalize_11106.py` from the
library's `NAVMC 11106 (EF).pdf`, with the source SHA-256 recorded in the map.

The source is a **static** XFA form, unlike the dynamic 10274, 118(11), and 10922 shells. The page
content is real and every field has an AcroForm widget. So it follows the 10132 path, not
`xfa-form-fill.ts`.

Normalization steps:

1. Delete `/AcroForm /XFA`. Without this, Adobe ignores the AcroForm values.
2. Delete `/Root /Perms` (UR3), which any change voids.
3. Delete `/Names /JavaScript`. It holds only the XFA version-check scripts.
4. Remove `PrintButton1[0]` and `ResetButton1[0]`. Their behavior lived in XFA script, so they do
   nothing now.
5. Relabel `SSN` as `EDIPI` (label rectangle 474.8, 151.0 to 488.9, 158.0) and update the tooltip.
6. Replace the unembedded `/MyriadPro-Regular` default appearance with `/Helv`. Single-line fields
   use size 0 (auto) so long values shrink rather than clip. The two multiline fields take fixed
   sizes, because auto-size fills their whole box: `DutyStatn[0]` 10 pt, `RemrkD3[0]` 9 pt.
7. Add an empty `/Off` appearance to every radio widget. The source has only the on state, and
   pdf-lib regenerates any widget whose `/AS` is missing from `/N`, redrawing the form's X boxes
   as round dots.
8. Keep `SigMem[0]`, `SigCO[0]`, and `/SigFlags`, so both can be CAC-signed in Acrobat.

The XFA `docReady` privacy notice goes with the XFA layer. The export toast carries that message
instead (section 10).

A scratchpad probe ran steps 1 to 7 and filled the result with pdf-lib: text, shrink-to-fit, and
the form's X marks all render correctly in MuPDF. Adobe Reader and CAC signing remain untested.

## 8. Data model

`src/types/navmc.ts`:

```ts
export const NAVMC_11106_SPONSORSHIP_BASES = [
  'installation-approval', 'cmc-conversion', 'command-award', 'birth',
  'adoption-placement', 'dual-mil-separation', 'not-required',
  'designated-place', 'not-sponsored', 'active-duty-spouse',
] as const;
export type Navmc11106SponsorshipBasis = (typeof NAVMC_11106_SPONSORSHIP_BASES)[number];

export interface Navmc11106Dependent {
  name: string;
  relationship: string;
  /** ISO. Date of marriage on the spouse row, date of birth otherwise. */
  eventDate: string;
  sponsorshipBasis: '' | Navmc11106SponsorshipBasis;
  /** ISO. Empty for bases that carry no date. Not printed by row. */
  sponsoredOn: string;
}
```

Scalars on `FormData`: `dateOfRank`, `dutyStation`, `ordersEffectiveDate`, `dateOfArrival`,
`maltPlusOnReportingDay`, `navmc11106Spouse`, `navmc11106Dependents` (max 6), `dependentsOnly`,
`dependentLocation`, `dependentsArrived`, `memberSignedDate`, `conusColaDependents`,
`conusColaZip`, the six Part D radios, `effectiveDate`, `navmc11106Remarks`, `coDate`,
`coNameGradeActivity`.

`nameOfMarine`, `grade`, and `edipi` are the keys the 10922 already uses, so they carry across
when a user switches form. `remarks` is deliberately not reused: Page 11 and other types own it.

Zod stays permissive, as in the 10922. Rules live in validators.

## 9. Rules module

`src/lib/navmc11106-rules.ts`. Pure functions, no UI or PDF imports.

| Function | Returns |
|---|---|
| `countedDependents(data)` | Rows that print, section 4 |
| `partAValue(data)` | `mem`, `both`, or `dep` |
| `commandSponsoredDate(data)` | Latest `sponsoredOn` among counted rows, or empty |
| `suggestedEffectiveDate(data)` | Section 9.1 |
| `generatedRemarks(data)` | Section 9.2 |
| `navmc11106Values(data)` | Full field-name to value map for the fill |

### 9.1 Suggested D3 date

| Part A | Suggestion | Source |
|---|---|---|
| `mem` | B7. The next day if MALT Plus was authorized on the reporting day | Ch 68 3.2.1 |
| `both` | Later of C9 and C10. C9 alone when no row carries a date. With no C9, C10 only when the latest row is `birth`, `adoption-placement`, or `dual-mil-separation`, since those dependents are already at the PDS; otherwise no suggestion | Ch 68 2.1.5, 3.3 |
| `dep` | C9 | Ch 68 2.3.4 |

A "Use suggested date" control fills D3. It never overwrites silently. The commander decides.

### 9.2 Generated Remarks

Appended after the user's text, shown in the UI as "will also print", and counted against the
720-character limit:

- Rows whose `sponsoredOn` differs from the printed C10: `C10: <NAME> COMMAND SPONSORED <DATE>.`
- `not-required`: `<NAME>: COMMAND SPONSORSHIP NOT REQUIRED.`
- `designated-place`: `<NAME>: PAID AT DEPENDENT LOCATION.`
- CONUS case: `CONUS COLA. ZIP <ZIP>.` (PRIUM 80101 par 3.a(5))

Names in generated lines use the row's name as entered.

## 10. Validators

`src/lib/navmc11106-validators.ts`, returning `ValidationIssue[]`, folded into
`letter-validators.ts` next to `runNavmc10922Validators`.

| ID | Severity | Condition | Citation |
|---|---|---|---|
| `core-fields` | block | Name, grade, or duty station missing, or EDIPI not 10 digits | Form Part B |
| `row-incomplete` | fail | A counted row lacks a name, relationship, or date. The spouse row's relationship defaults to SPOUSE, so it is exempt | Form Part C |
| `basis-missing` | fail | A filled row has no sponsorship basis | MCO Ch 6 par 5 |
| `sponsored-date-missing` | fail | A dated basis has no `sponsoredOn` | MCO 1300.8 Ch 6 par 4-6 |
| `not-sponsored-excluded` | warn | A `not-sponsored` row exists; it will not print | Ch 68 3.6 |
| `reduced-rate` | warn | `not-sponsored` row exists and quarters are available; reduced rate only | Table 68-4 rule 13 |
| `active-duty-spouse-excluded` | warn | `active-duty-spouse` row exists; see the joint-household rule | Table 68-5 |
| `barracks-no-form` | warn | Box 1, quarters available, mess is available; this is barracks COLA and needs no application | PRIUM 80102 par 3; Table 68-4 rule 11 |
| `dep-only-no-location` | fail | Box 3 with no C8 location | PRIUM 80102 Note 2 |
| `member-dep-with-location` | warn | Box 2 with a C8 location; dependents elsewhere usually mean box 3 | PRIUM 80102 par 3.a(1)(c) |
| `designated-place-box-2` | warn | Box 2 with a counted `designated-place` row; dependents paid at their own location usually mean a dependents-only application | PRIUM 80102 par 3.a(1)(c); Ch 68 par 2.2.2 |
| `c10-before-travel` | warn | C10 is after C9 on an `installation-approval` row | JTR 050803 |
| `effective-date-differs` | warn | D3 differs from the suggestion | Ch 68 par 2.1.5, 2.3.4, 3.2.1, 3.3 |
| `effective-date-future` | warn | D3 is in the future; TTC 014 will reject it | PRIUM 80102 par 12.h |
| `mess-ignored-with-deps` | warn | Box 2 with D2B set; mess availability does not affect with-dependent COLA | Ch 68 3.3 |
| `impractical-needs-statement` | warn | D2B set to Impractical; Remarks should carry the mission or operational basis | Table 68-4 rule 3, note 1 |
| `remarks-too-long` | fail | User text plus generated lines exceed 720 | Form field |
| `field-too-long` | fail | A printed entry is over its limit: B1 70, B2 20, B5 130, C8 70, CO name 65, and on each counted row name 25 and relationship 20. One helper, `navmc11106FieldProblems`, serves this rule and the export | Form field |
| `field-unprintable` | fail | A printed entry (Remarks included) has a character outside Windows-1252, which the form font cannot print. Newlines are allowed in Remarks and B5 | NAVMC 11106 form font |

Only `core-fields` blocks export. The severity contract is the one in `letter-validators.ts`.

**Export toast.** States that the file is the official form in plain fillable format, that it
contains Privacy Act information, that a commander completes Part D, and the filing rule below.

**Filing guidance.** Upload to the OMPF Field Folder and keep a local copy (MARADMIN 015/20
par 4.b.3, at least 10 years under par 2). PRIUM 80102 par 3.c still says unit correspondence
files, most current form only, and MCO 1070.1 says IPAC or unit files. The MARADMIN is newer,
and MCAAT applied it in 2025 (AskMCAAT 21-25).

## 11. Export and preview

- `PdfPipeline` gains `navmc11106`. `PIPELINE_MAP.navmc11106` fills the blank through
  `fillAcroForm`, so preview and export share one path, as with the 10132.
- `acroform-fill.ts` gains a `PDFRadioGroup` branch. It has none today: a radio currently lands in
  `report.skipped`. It writes `/V` and each widget's `/AS` directly. pdf-lib's own `select()` marks
  the group dirty, which replaces the form's appearances with round dots. This is a generic
  addition, tested on its own. The module's stated purpose is reuse by later forms.
- A failed fill throws on export. The live preview runs on a timer, so it degrades to a notice page
  as the 10132's does.
- The export pre-checks printable text and limits with `navmc11106FieldProblems`. A character the form
  font cannot print (for example NGUYỄN, ŁUKASZ, 沖縄市) would otherwise throw an encoder error inside
  the fill, so the export refuses, names the block, and asks for the Latin spelling. Nothing is
  substituted or transliterated. MUÑOZ and O’BRIEN print.
- Enclosure rows and `signatureFields` survive a document-type switch while this form's editors are
  hidden. Both passes are skipped for `navmc11106` only, in export and in the live preview, so no
  counseling PDF or stray signature field rides onto the form.
- Filename: `NAVMC 11106 - <name>.pdf`.

## 12. Registration points

Same set the 10922 and 10132 touch:

`src/lib/schemas.ts` (schema, definition, `PdfPipeline`, `DocumentSchema`, `DOCUMENT_TYPES`);
`src/types/navmc.ts`; `src/lib/xfa-form-fill.ts` (`officialFormAsset` only);
`src/services/export/pdfPipelineService.ts`; `src/components/layout/Sidebar.tsx`;
`src/components/letter/DocumentTypeSection.tsx`; `src/components/document/DocumentLayout.tsx`;
`src/lib/letter-validators.ts`; `src/lib/naval-format-utils.ts`; `src/lib/proofread-checks.ts`;
`src/lib/indent-engine.ts`; `src/lib/templates/index.ts`; `src/hooks/useDocumentImport.ts`;
`tests/assets.test.ts`.

The `HeaderActions` read-back menu is left alone. Reading a filled 11106 back is out of scope.

UI lives in `src/components/letter/Navmc11106Sections.tsx`: `DynamicForm` for Part B and scalar
fields, custom components for Part A's display, dependent rows, and Part D.

## 13. Testing

| Test | Proves |
|---|---|
| `tests/navmc11106-rules.test.ts` | Part A table, every row-count and toggle case including reset; C10 and D3 logic; generated Remarks |
| `tests/navmc11106-validators.test.ts` | Each validator ID, each basis in section 3.3 |
| `tests/navmc11106-acroform.test.ts` | Round trip against the real blank: every field name resolves, radios land on the right value, signatures untouched |
| `tests/navmc11106-blank.test.ts` | No XFA, no Perms, no document JavaScript, no Print or Reset buttons, no preset values, `EDIPI` in page text and `SSN` gone |
| `tests/acroform-fill` additions | Radio branch, bad radio value reported rather than thrown |
| Component test | The Dependents only option appears and resets as section 4 states |
| Live preview in the app | Form renders, Part A follows row changes |
| Manual, Adobe Reader | Opens with no warnings, values show, CAC signature fields work. Owner check, since it cannot be automated here |

## 14. Out of scope

Rate calculator, geo-code lookup, unit diary worksheet, reading a filled form back, CONUS COLA at
a CONUS PDS (a Marine at a CONUS PDS requesting an off-PDS rate needs a secretarial determination
per PRIUM 80101 par 3).

## 15. Source defects for the record

- PRIUM 80102 gives Seoul two geo codes (`KR155`, `KR140`), and FPM repeats both. Another reason
  not to hardcode them when a lookup is built.
- PRIUM 80101 par 3.b says approve "by completing part F". The form ends at Part D, and par 3.a(4)
  says Part D is not required. The app leaves Part D open and never requires it for the CONUS case.
- The form's certification covers absences "involving return to the United States". Ch 68 Table 68-3
  turns on departing the PDS vicinity, which is the whole country. The official text cannot change,
  so the UI's help states the Ch 68 rule.
- The forms catalog shows a revision date of 22 Oct 2026, but the PDF still prints `REV .1-89`.
- Ch 68 Table 68-1 rule 7 cites paragraph 3.3.4, which does not exist. Evacuation is at 3.3.3.
