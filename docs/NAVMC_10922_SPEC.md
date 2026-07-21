# NAVMC 10922 (7-21) (EF) - Dependency Application

Completion specification derived from the official form and its governing orders.
Status - analysis only. No code has been written.
Audited 2026-07-20 against the three primary sources. Corrections applied.

**Citation convention used throughout.** `CH-1 para N` means the change transmittal signed
1 Jul 2021. `Ch 1 para N` and `Ch 2 para N` mean Enclosure (1), Chapter 1 and Chapter 2 of
MCO 1751.3. `P1751.3F para N` means the cancelled 2003 manual and carries no authority.

**Implementation status 2026-07-20** (build plan: `docs/NAVMC_10922_BUILD_PLAN.md`).

| Artifact | Location |
|---|---|
| Normalized blank | `public/forms/navmc-10922-blank.pdf` |
| Positional map + extractor | `tools/aa-forms/navmc10922-map.json`, `extract_10922_map.py` |
| Data model | `src/types/navmc.ts` (`Navmc10922Data`) |
| Schema + registration | `src/lib/schemas.ts` (`Navmc10922Schema`, `Navmc10922Definition`) |
| UI sections | `src/components/letter/Navmc10922Sections.tsx` |
| Shared helpers | `src/lib/navmc10922-utils.ts` |
| Validators (section 9 of this spec) | `src/lib/navmc10922-validators.ts` |
| Positional XFA emitter (sections 3-4) | `src/lib/navmc10922-xfa.ts` |
| Tests | `tests/navmc10922-*.ts` |
| Not built | Flattened START fallback (plan Phase 5), secondary dependent engine (decision 9) |

## 1. Source authority and the conflict you must resolve first

| Source | Date | Standing |
|---|---|---|
| NAVMC 10922 (7-21) (EF) | Jul 2021 | Current form revision. Previous versions obsolete. |
| MCO 1751.3 CH-1 | 1 Jul 2021 | **Governing order.** Enclosure (1) is the procedural guidance. |
| MCO P1751.3F | 24 Dec 2003 | **CANCELLED** by MCO 1751.3, para 2. |

MCO P1751.3F is cancelled. It remains the only document containing worked, block-by-block
examples of a filled NAVMC 10922 (Figures 1-3 through 1-16, 2-1 through 2-5, and 3-4 - 20 samples).
Treat it as layout precedent for how blocks were populated, never as rule authority.
Three of its rules are reversed by the current order and must not be carried forward.

| Cancelled rule (P1751.3F) | Current rule (MCO 1751.3 CH-1) |
|---|---|
| Officers self-attest as both claimant and attesting officer (para 1000) | Self attestation prohibited. Only administrative personnel with signature-by-direction authority sign as attesting officer (Ch 1, para 1.e) |
| Officers submit supporting documents only for secondary dependents plus foreign divorce (para 1000) | All members submit substantiating documents for every listed dependent category (Ch 1, para 1.f) |
| Proxy and telephone marriages not accepted (para 1001.5) | Proxy and telephone marriages valid under stated conditions, routed to CMC (MFP-1) (Ch 1, para 3.b) |

Other deltas the current order introduces. Substantiating documentation is due within 30 days
of the life event and a new NAVMC 10922 is retained in the OMPF (Ch 1, para 1.f). Approval
office renamed from MRP-1 to MFP-1. SSN replaced by EDIPI on the form.

**Statement-form change.** The cancelled manual used NAVMC 11346, the Children's Dependency
Determination Affidavit, for adopted children, stepchildren, children born out of wedlock, and
pre-adopted children - all primary dependents. It already used DD 137-3 for parents. The
current order drops NAVMC 11346 entirely and names DD 137-4 for a child born out of wedlock,
DD 137-5 for an incapacitated child over 21, DD 137-6 for a full-time student 21-22, DD 137-7
for a ward, and DD 137-3 for a parent or in loco parentis. DD 137-4, 137-5, 137-6, and 137-7
have zero occurrences in the cancelled manual.

**Second supersession - MARADMIN 311/25 (1 Jul 2025).** The DD 137 series named by MCO 1751.3
is itself now partially obsolete. Effective 1 Aug 2024, all secondary dependency claims use the
consolidated **DD Form 137, Secondary Dependency Application** (edition 10/31/2024). As of
1 Jul 2025, CMC (MFP-1) no longer accepts DD 137-3, DD 137-5, DD 137-6, or DD 137-7.
Verified against the ESD forms registry (DD 137, edition date 10/31/2024) and DoD FMR Vol 7A
Ch 26, May 2025 edition, which cites only the consolidated form (paras 3.3.3.2.1 through
3.3.3.2.3, 3.4.2.1.1, 3.4.3). The consolidated form accepts a prior-year tax return showing
the claimed individual as a dependent in place of its Worksheet for Determining Support
(FMR para 3.3.3.2.1).

**DD 137-4 is gone too - correction 2026-07-20.** The earlier "DD 137-4 survives" assessment
is withdrawn on two pieces of evidence. The ESD DD forms registry lists DD 137 (10/31/2024) as
the only active 137-series form - the listing runs DD 117, DD 137, DD 139 with no sub-forms.
And the full May 2025 FMR chapter, now in hand, contains **zero occurrences** of DD 137-3
or DD 137-4 across all 119 pages. The out-of-wedlock evidence path is now FMR para 3.2.1.3.3 -
birth certificate citing the member's name, or a court order, or "a signed notarized affidavit
of parentage from the Service member." MCO 1751.3 Figure 1-1 item 3 still names DD 137-4;
that line is unexecutable and the affidavit of parentage replaces it. The FMR is reference (a)
of MCO 1751.3 and controls.

Consequence for MCO 1751.3 Figures 1-2 through 1-6 - every checklist line naming DD 137-3,
137-5, 137-6, or 137-7 must be read as the consolidated DD Form 137. The notarization and
currency requirements on those figures have no restated equivalent for the new form in the
supplied material.

## 2. Form technology and hard fill constraints

NAVMC 10922 (7-21) is a dynamic Adobe LiveCycle **XFA** form. The single PDF page is the
"Please wait" shell. The real form lives in the embedded XFA XML streams. This is the same
class of form as NAVMC 10274 and NAVMC 118(11), so `src/lib/xfa-form-fill.ts` is the correct
export path. Four constraints differ from the existing two forms and drive the design.

**Constraint 1 - field names are not unique.** The `datasets` stream holds 102 nodes.
77 are named `ParticipantName` and 17 are named `RadioButtonList`. Only 8 nodes carry
meaningful names. Fill must be **positional**, not name-keyed. The existing `tag(name, value)`
helper in `xfa-form-fill.ts` is unusable here without a positional emitter.

**Constraint 2 - node order is deterministic and verified.** Order is document order of fields
carrying no `<bind>` element at all (94 nodes), followed by fields carrying
`bind match="global"` (8 unique nodes) in document order. Verified twice by independent
regeneration from `template.xml` and comparison to the shipped `datasets.xml` - exact match,
102 of 102.

Global-bound tail order is fixed - `NameOfMarine`, `SignatureofMarine`, `EDIPI`, `Grade`,
`SignatureandTitleofAttestingOfficer`, `UnitDesignation`,
`TypedNameandGradeofCommandingOfficer`, `SignatureofCommandingOfficer`.

**Constraint 3 - five checkboxes are unbindable.** These `checkButton` fields carry no name
and no data binding, so the datasets route cannot set them.

| Unbound checkbox | Location | Impact |
|---|---|---|
| START | Header block above Section 1, Reason for application, x=76.2mm y=38.1mm. Its own `<caption>` is empty. The label comes from the adjacent `START` draw at y=31.75mm. | **Claimant-facing. Real gap.** A START application exports with the reason box blank. |
| Document Viewed | Section 7, bottom | Attesting officer control. Acceptable to leave. |
| APPROVED AS CLAIMED | Section 8, command | Approving authority control. Should stay blank. |
| APPROVED FOR DEPENDENT NUMBERS | Section 8, command | Approving authority control. Should stay blank. |
| FORWARDED TO CMC (CODE MFP-1) | Section 8, command | Approving authority control. Should stay blank. |

**Constraint 4 - three fields are digital signature widgets.** `SignatureofMarine`,
`SignatureandTitleofAttestingOfficer`, and `SignatureofCommandingOfficer` use `ui=signature`.
Text cannot be injected. They are signed in Adobe after export, consistent with the existing
XFA path limitation already documented in `xfa-form-fill.ts`.

**Constraint 5 - CUI marking is baked into the form.** The template draws
`CUI (when filled in)` in the header and `Controlled by USMC / CUI Category PRVCY / LDC DL ONLY /
POC MFPrivacy@usmc.mil` in the footer. Those are form artwork, not app output. Per the standing
project rule the app does not handle CUI and adds no markings of its own. The blank form
carries these marks regardless of app behavior. Worth surfacing to the user as a warning at
the point of export, not as an app-applied marking.

**Constraint 6 - date pictures are declared in the template.** 21 of the 22 `dateTimeEdit`
fields carry an explicit picture clause (count corrected during Phase 0 extraction). Index 0 uses `<format><picture>date{MMM D, YYYY}`.
Indices 7, 8, and 9 use `<validate><picture>date{M/D/YY}`. Every Section 2 date cell
(14, 15, 19, 20, 24, 25, 29, 30, 34, 35, 39, 40), the present-marriage date (51), and all four
dissolution dates (56, 61, 66, 71) use `<format><picture>date{M/D/YY}`. Only index 89, the unit
diary DATED field, carries none. The form dictates its own formats. Do not invent one.

## 3. Complete bound-node index

Positional index into the datasets stream. Index is the emit order.

| idx | node | ui | y | x | form caption |
|----|------|----|---|---|--------------|
| 0 | `ParticipantName` | dateTimeEdit | 31.75mm |  | DATE OF APPLICATION |
| 1 | `RadioButtonList` | exclGroup | 38.1mm | 101.6mm | CHANGE IN DEPENDENTS (loss/gain) |
| 2 | `ParticipantName` | textEdit | 44.45mm | 88.9mm | EDIPI |
| 3 | `ParticipantName` | textEdit | 57.15mm | 6.35mm | ORGANIZATION AND STATION PREPARING THIS APPLICATION |
| 4 | `ParticipantName` | textEdit | 76.2mm | 6.35mm | FUTURE ADDRESS AND ETA IF TRANSER IS ANTICIPATED WITHIN 60 DAYS |
| 5 | `ParticipantName` | textEdit | 44.45mm | 120.65mm | GRADE |
| 6 | `ParticipantName` | textEdit | 57.15mm | 120.65mm | UNIT RUC |
| 7 | `ParticipantName` | dateTimeEdit | 76.2mm | 120.65mm | ECC |
| 8 | `ParticipantName` | dateTimeEdit | 57.15mm | 146.05mm | DATE OF CURRENT ENLISTMENT/APPOINTMENT OR DATE REPORTING FOR ACTIVE DUTY (WHICHEVER IS LATER) |
| 9 | `ParticipantName` | dateTimeEdit | 76.2mm | 146.05mm | DATE OF LAST DISCHARGE OR DATE OF LAST RELEASE TO INACTIVE DUTY |
| 10 | `RadioButtonList` | exclGroup | 50.8mm | 146.05mm | TYPE OF SERVICE (USMC/USMCR) |
| 11 | `ParticipantName` | textEdit | 107.95mm | 12.7mm | Sec 2 row 1 - name of dependent |
| 12 | `ParticipantName` | textEdit | 107.95mm | 63.5mm | Sec 2 row 1 - complete address |
| 13 | `ParticipantName` | textEdit | 107.95mm | 114.3mm | Sec 2 row 1 - relationship |
| 14 | `ParticipantName` | dateTimeEdit | 107.95mm | 139.7mm | Sec 2 row 1 - date of birth |
| 15 | `ParticipantName` | dateTimeEdit | 107.95mm | 158.75mm | Sec 2 row 1 - date allowance claimed from |
| 16 | `ParticipantName` | textEdit | 114.3mm | 12.7mm | Sec 2 row 2 - name |
| 17 | `ParticipantName` | textEdit | 114.3mm | 63.5mm | Sec 2 row 2 - address |
| 18 | `ParticipantName` | textEdit | 114.3mm | 114.3mm | Sec 2 row 2 - relationship |
| 19 | `ParticipantName` | dateTimeEdit | 114.3mm | 139.7mm | Sec 2 row 2 - DOB |
| 20 | `ParticipantName` | dateTimeEdit | 114.3mm | 158.75mm | Sec 2 row 2 - claimed from |
| 21 | `ParticipantName` | textEdit | 120.65mm | 12.7mm | Sec 2 row 3 - name |
| 22 | `ParticipantName` | textEdit | 120.65mm | 63.5mm | Sec 2 row 3 - address |
| 23 | `ParticipantName` | textEdit | 120.65mm | 114.3mm | Sec 2 row 3 - relationship |
| 24 | `ParticipantName` | dateTimeEdit | 120.65mm | 139.7mm | Sec 2 row 3 - DOB |
| 25 | `ParticipantName` | dateTimeEdit | 120.65mm | 158.75mm | Sec 2 row 3 - claimed from |
| 26 | `ParticipantName` | textEdit | 127mm | 12.7mm | Sec 2 row 4 - name |
| 27 | `ParticipantName` | textEdit | 127mm | 63.5mm | Sec 2 row 4 - address |
| 28 | `ParticipantName` | textEdit | 127mm | 114.3mm | Sec 2 row 4 - relationship |
| 29 | `ParticipantName` | dateTimeEdit | 127mm | 139.7mm | Sec 2 row 4 - DOB |
| 30 | `ParticipantName` | dateTimeEdit | 127mm | 158.75mm | Sec 2 row 4 - claimed from |
| 31 | `ParticipantName` | textEdit | 133.35mm | 12.7mm | Sec 2 row 5 - name |
| 32 | `ParticipantName` | textEdit | 133.35mm | 63.5mm | Sec 2 row 5 - address |
| 33 | `ParticipantName` | textEdit | 133.35mm | 114.3mm | Sec 2 row 5 - relationship |
| 34 | `ParticipantName` | dateTimeEdit | 133.35mm | 139.7mm | Sec 2 row 5 - DOB |
| 35 | `ParticipantName` | dateTimeEdit | 133.35mm | 158.75mm | Sec 2 row 5 - claimed from |
| 36 | `ParticipantName` | textEdit | 139.7mm | 12.7mm | Sec 2 row 6 - name |
| 37 | `ParticipantName` | textEdit | 139.7mm | 63.5mm | Sec 2 row 6 - address |
| 38 | `ParticipantName` | textEdit | 139.7mm | 114.3mm | Sec 2 row 6 - relationship |
| 39 | `ParticipantName` | dateTimeEdit | 139.7mm | 139.7mm | Sec 2 row 6 - DOB |
| 40 | `ParticipantName` | dateTimeEdit | 139.7mm | 158.75mm | Sec 2 row 6 - claimed from |
| 41 | `ParticipantName` | textEdit | 158.75mm | 6.35mm | Sec 3 - DEP NO. |
| 42 | `ParticipantName` | textEdit | 158.75mm | 12.7mm | Sec 3 - full name of custodian |
| 43 | `ParticipantName` | textEdit | 158.75mm | 123.825mm | Sec 3 - address and zip |
| 44 | `ParticipantName` | textEdit | 158.75mm | 79.375mm | Sec 3 - relationship to dependent |
| 45 | `RadioButtonList` | exclGroup | 171.45mm | 139.7mm | HAS PRESENT SPOUSE BEEN PREVIOUSLY MARRIED (yes/no) |
| 46 | `ParticipantName` | textEdit | 171.45mm | 165.1mm | Spouse - # OF TIMES |
| 47 | `RadioButtonList` | exclGroup | 171.45mm | 88.9mm | HAVE YOU BEEN PREVIOUSLY MARRIED (yes/no) |
| 48 | `ParticipantName` | textEdit | 171.45mm | 114.3mm | Member - # OF TIMES |
| 49 | `ParticipantName` | textEdit | 177.8mm | 57.15mm | Present marriage - full given name of spouse |
| 50 | `ParticipantName` | textEdit | 177.8mm | 25.4mm | Present marriage - place (county and state) |
| 51 | `ParticipantName` | dateTimeEdit | 177.8mm | 6.35mm | Present marriage - date |
| 52 | `RadioButtonList` | exclGroup | 203.2mm | 11.113mm | Dissolution row 1 - former marriage of (self/spouse) |
| 53 | `RadioButtonList` | exclGroup | 203.2mm | 139.7mm | Dissolution row 1 - reason (death/annulment/divorce) |
| 54 | `ParticipantName` | textEdit | 203.2mm | 38.1mm | Dissolution row 1 - name of spouse in dissolved marriage |
| 55 | `ParticipantName` | textEdit | 203.2mm | 101.6mm | Dissolution row 1 - place of dissolution |
| 56 | `ParticipantName` | dateTimeEdit | 203.2mm | 76.2mm | Dissolution row 1 - date of dissolution |
| 57 | `RadioButtonList` | exclGroup | 209.55mm | 11.113mm | Dissolution row 2 - former marriage of |
| 58 | `RadioButtonList` | exclGroup | 209.55mm | 139.7mm | Dissolution row 2 - reason |
| 59 | `ParticipantName` | textEdit | 209.55mm | 38.1mm | Dissolution row 2 - name |
| 60 | `ParticipantName` | textEdit | 209.55mm | 101.6mm | Dissolution row 2 - place |
| 61 | `ParticipantName` | dateTimeEdit | 209.55mm | 76.2mm | Dissolution row 2 - date |
| 62 | `RadioButtonList` | exclGroup | 215.9mm | 11.113mm | Dissolution row 3 - former marriage of |
| 63 | `RadioButtonList` | exclGroup | 215.9mm | 139.7mm | Dissolution row 3 - reason |
| 64 | `ParticipantName` | textEdit | 215.9mm | 38.1mm | Dissolution row 3 - name |
| 65 | `ParticipantName` | textEdit | 215.9mm | 101.6mm | Dissolution row 3 - place |
| 66 | `ParticipantName` | dateTimeEdit | 215.9mm | 76.2mm | Dissolution row 3 - date |
| 67 | `RadioButtonList` | exclGroup | 222.25mm | 11.113mm | Dissolution row 4 - former marriage of |
| 68 | `RadioButtonList` | exclGroup | 222.25mm | 139.7mm | Dissolution row 4 - reason |
| 69 | `ParticipantName` | textEdit | 222.25mm | 38.1mm | Dissolution row 4 - name |
| 70 | `ParticipantName` | textEdit | 222.25mm | 101.6mm | Dissolution row 4 - place |
| 71 | `ParticipantName` | dateTimeEdit | 222.25mm | 76.2mm | Dissolution row 4 - date |
| 72 | `RadioButtonList` | exclGroup | 234.95mm | 6.35mm | COURT ORDER / WRITTEN AGREEMENT IN EFFECT (yes/no) |
| 73 | `ParticipantName` | textEdit | 241.3mm | 6.35mm | Court order - date, county and state issued |
| 74 | `ParticipantName` | textEdit | 25.4mm | 6.35mm | Sec 5 - identifying info of natural parent |
| 75 | `RadioButtonList` | exclGroup | 19.05mm | 6.35mm | Sec 5 - natural parent ever in US Armed Force (yes/no) |
| 76 | `RadioButtonList` | exclGroup | 63.5mm | 6.35mm | Sec 6 - spouse ever in US Armed Force (yes/no) |
| 77 | `ParticipantName` | textEdit | 76.2mm | 6.35mm | Sec 6 - spouse EDIPI |
| 78 | `ParticipantName` | textEdit | 76.2mm | 38.1mm | Sec 6 - spouse GRADE |
| 79 | `RadioButtonList` | exclGroup | 76.2mm | 63.5mm | Sec 6 - TYPE OF SERVICE (regular/reserve) |
| 80 | `ParticipantName` | textEdit | 76.2mm | 88.9mm | Sec 6 - BRANCH OF SERVICE |
| 81 | `RadioButtonList` | exclGroup | 76.2mm | 165.1mm | Sec 6 - BAQ (with/without dependents) |
| 82 | `ParticipantName` | textEdit | 76.2mm | 127mm | Sec 6 - INCLUSIVE DATES OF ACTIVE SERVICE |
| 83 | `ParticipantName` | choiceList | 133.35mm | 82.55mm | Sec 7 - sworn month (January..December) |
| 84 | `ParticipantName` | textEdit | 133.35mm | 120.65mm | Sec 7 - sworn year (2-digit, follows literal "20") |
| 85 | `ParticipantName` | textEdit | 133.35mm | 57.15mm | Sec 7 - sworn day |
| 86 | `ParticipantName` | textEdit | 165.1mm | 63.5mm | Sec 8 - approved for dependent numbers |
| 87 | `ParticipantName` | textEdit | 171.45mm | 114.3mm | Sec 8 - forwarded to CMC for dependent numbers |
| 88 | `ParticipantName` | textEdit | 196.85mm | 50.8mm | Sec 8 - unit diary No. |
| 89 | `ParticipantName` | dateTimeEdit | 196.85mm | 97.282mm | Sec 8 - unit diary DATED |
| 90 | `ParticipantName` | textEdit | 196.85mm | 143.764mm | Sec 8 - unit diary RUC |
| 91 | `ParticipantName` | textEdit | 203.2mm | 6.35mm | Sec 8 - unit diary clerk free text block |
| 92 | `ParticipantName` | textEdit | 228.6mm | 6.35mm | Sec 8 - CMC approving authority free text block |
| 93 | `ParticipantName` | textEdit | 146.05mm | 38.1mm | Sec 7 - list of documents viewed |
| 94 | `NameOfMarine` | textEdit | 44.45mm | 6.35mm | NAME OF MARINE (Last, First, Middle) - repeats on page 2 |
| 95 | `SignatureofMarine` | signature | 114.3mm | 12.7mm | (Signature of Marine) |
| 96 | `EDIPI` | textEdit | 114.3mm | 73.025mm | (EDIPI) |
| 97 | `Grade` | textEdit | 114.3mm | 133.35mm | (Grade) |
| 98 | `SignatureandTitleofAttestingOfficer` | signature | 133.35mm | 133.35mm | (Signature and Title of Attesting Officer) |
| 99 | `UnitDesignation` | textEdit | 177.8mm | 136.525mm | (Unit Designation) |
| 100 | `TypedNameandGradeofCommandingOfficer` | textEdit | 177.8mm | 63.5mm | (Typed Name and Grade of Commanding Officer) |
| 101 | `SignatureofCommandingOfficer` | signature | 177.8mm | 9.525mm | (Signature of Commanding Officer) |

## 4. Radio group value maps

Every `RadioButtonList` is an `exclGroup`. Emit the value string of the selected child.
Emit an empty node to leave unselected.

| idx | Group | Value map |
|---|---|---|
| 1 | Change in dependents | `2` = LOSS, `3` = GAIN |
| 10 | Type of service | `1` = USMCR, `2` = USMC |
| 45 | Spouse previously married | `1` = YES, `2` = NO |
| 47 | Member previously married | `1` = YES, `2` = NO |
| 52, 57, 62, 67 | Former marriage of | `2` = YOURSELF, `1` = SPOUSE |
| 53, 58, 63, 68 | Reason for dissolution | `1` = DEATH, `2` = ANNULMENT, `3` = DIVORCE |
| 72 | Court order in effect | `1` = YES, `2` = NO |
| 75 | Natural parent in Armed Forces | `1` = YES, `2` = NO |
| 76 | Spouse in Armed Forces | `1` = YES, `2` = NO |
| 79 | Spouse type of service | `2` = REGULAR, `1` = RESERVE |
| 81 | Spouse BAQ | `2` = WITH DEPENDENTS, `1` = WITHOUT DEPENDENTS |

The five standalone checkboxes use `1` on, `0` off, `2` neutral, and are unbindable.

## 5. Section-by-section element semantics

### Section header block - reason for this application

Three mutually meaningful states with only two controls. START is a standalone checkbox.
CHANGE IN DEPENDENTS is a two-option radio (LOSS, GAIN).

- **START** - first dependency application for the member, or a full re-establishment listing
  all dependents. Used at accession and when the member has no prior approved 10922 on file.
- **GAIN** - marriage, birth, adoption, step relationship established, ward order, secondary
  dependent approved.
- **LOSS** - divorce, death of a dependent, child ages out, ward order expires, secondary
  dependent fails re-determination, dependent claimed by another service member.

For LOSS the form directs the explanation into the certification section. Ch 1 para 10 requires
the reason for the loss, the effective date of the loss, and the signature of the member and a
commanding officer. **Para 10 is scoped to a secondary dependent loss only.** Its title reads
"Submission and Forwarding of the Dependency Application, NAVMC 10922, for a Secondary
Dependent Loss." No paragraph of the current order imposes an equivalent Section 7 narrative
for a primary dependent loss. Treat the narrative as mandatory for secondary dependent losses
and as best practice elsewhere. See the Section 7 capacity problem below.

### Section 1 - identification

| Element | Rule and usage |
|---|---|
| DATE OF APPLICATION | Date the member signs. Template picture `date{MMM D, YYYY}`. Note the 30-day substantiation clock in Ch 1 para 1.f runs from the life event, not from this date. |
| NAME OF MARINE | Last, First, Middle. Repeats on page 2 by global bind, emit once. |
| EDIPI | 10-digit DoD ID. Replaced SSN in the 7-21 revision. |
| GRADE | Member pay grade at signature. |
| ORGANIZATION AND STATION PREPARING THIS APPLICATION | The servicing administrative office, not the member's billet. |
| UNIT RUC | Reporting Unit Code. Ch 1 para 1.c defines commanding officer by RUC assignment, so RUC determines who holds approval authority. |
| ECC | Expiration of Current Contract. |
| DATE OF CURRENT ENLISTMENT/APPOINTMENT OR DATE REPORTING FOR ACTIVE DUTY | Later of the two. |
| DATE OF LAST DISCHARGE OR LAST RELEASE TO INACTIVE DUTY | Blank for a member with no prior service. |
| FUTURE ADDRESS AND ETA IF TRANSFER ANTICIPATED WITHIN 60 DAYS | Conditional. Populate only when PCS falls inside 60 days of the application date. Drives where CMC (MFP-1) returns the adjudicated form. |
| TYPE OF SERVICE | USMC or USMCR. Reservists follow the same rules with one exception, see Section 2. |

Form label typo present in the official template - `TRANSER`. Reproduce as-is. Do not correct.

### Section 2 - dependent information (6 rows)

Columns per row - NO. (pre-printed 1 through 6, not a field), NAME (full given name),
COMPLETE ADDRESS with zip, RELATIONSHIP, DATE OF BIRTH, DATE ALLOWANCE CLAIMED FROM.

RELATIONSHIP is a controlled vocabulary. The column header directs, for a child, indication of
step, adopted, ward, or born out of wedlock. Derived allowed set from the two orders.

`SPOUSE`, `SON`, `DAUGHTER`, `STEPSON`, `STEPDAUGHTER`, `ADOPTED SON`, `ADOPTED DAUGHTER`,
`WARD`, `CHILD BORN OUT OF WEDLOCK`, `PRE-ADOPTED CHILD`, `INCAPACITATED CHILD OVER 21`,
`FULL-TIME STUDENT 21-22`, `MOTHER`, `FATHER`, `MOTHER-IN-LAW`, `FATHER-IN-LAW`,
`STEPMOTHER`, `STEPFATHER`, `ADOPTIVE PARENT`, `IN LOCO PARENTIS`.

The relationship value is the primary switch for the entire evidence and routing engine.
It drives Section 3 requirement, Section 5 requirement, checklist selection, approval level,
and re-determination cadence.

DATE ALLOWANCE CLAIMED FROM. Effective dates by relationship. **Source column is load-bearing.
Only one row rests on the current order.**

| Relationship | Effective date rule | Source | Standing |
|---|---|---|---|
| Ward | Date of the court order or date of residency per DD 137-7 | MCO 1751.3 Ch 1 para 6.a | Authoritative |
| Stepchild | Later of date of marriage or date the child became dependent | P1751.3F para 1003.3 | Cancelled |
| Adopted child | Later of date of adoption or date the child became dependent | P1751.3F para 1003.4 | Cancelled |
| Child born out of wedlock | Date support commenced | P1751.3F para 2001.1 | Cancelled |
| Pre-adopted child | Date of the court order | P1751.3F para 1003.6 | Cancelled |
| Secondary dependent parent | Date sufficient support was provided | P1751.3F para 3002.2 | Cancelled |
| Spouse | Date of marriage | none found | **No textual basis in either document** |
| Legitimate child | Date of birth | none found | **No textual basis in either document** |

**SUPERSEDED 2026-07-20 by section 10a.** The FMR May 2025 full chapter was supplied and
closes this gap. Para 10.3 and Table 26-1 rule 5 set the acquisition date as the effective
date for spouse, birth, and adoption. The table above is retained only to document what each
older source claimed. Section 10a is the build target.

For a previously approved dependent re-listed on a new application, the column header directs
entry of the date of approval. The cancelled manual shows `PREV APPR` on Figure 1-11a and
lowercase `Prev apprvd` on Figures 1-5a and 1-14a. In all three the text sits above the first
dependent row, reading as a column annotation rather than a cell value. Do not adopt any
literal without confirming current MFP-1 practice.

**Reservist exception.** MCO P1751.3F para 5000 left this column blank for reservists for
mobilization purposes. MCO 1751.3 has no equivalent paragraph. Unresolved - flag to the user
rather than silently applying a cancelled rule.

Capacity - 6 rows. The form's instruction block reads exactly `INSTRUCTIONS` followed by
`WHERE ADDITIONAL SPACE IS NECESSARY TO COMPLETE ITEMS`. The phrase "USE SEPARATE SHEET"
appeared on the 2001 revision and has **zero occurrences** in the 7-21 template. The only
continuation language on the current form is the Section 4 dissolution header
`(Continue on separate sheet if necessary)`. The 7-21 instruction is therefore truncated and
prescribes no remedy. Overflow handling is an app decision, not a form rule.

### Section 3 - custodian information (1 row only)

Required when any dependent listed in Section 2 does not live in the member's household, or
when a third party holds physical custody. Columns - DEP NO. (cross-reference to the Section 2
row number), FULL NAME OF CUSTODIAN, RELATIONSHIP TO DEPENDENT, ADDRESS AND ZIP CODE.

**The 7-21 form provides exactly one custodian row.** A member with children by two different
custodians (the exact scenario of cancelled Figure 2-4) overflows immediately. Any design must
route the second and later custodians to a continuation sheet.

Trigger conditions.
- Child born out of wedlock not in the member's physical custody.
- Child of a divorce residing with the other parent.
- Stepchild residing with a non-member parent.
- Ward residing apart from the member under the institutional-care exception.
- Incapacitated child in institutional care.

### Section 4 - marital status and support / paternity

Sub-block A - present marriage. DATE, PLACE (county and state), FULL GIVEN NAME OF SPOUSE.
Populate only when the member is currently married. Cancelled Figure 1-16a shows the literal
`NOT MARRIED` written across the block for an unmarried member claiming a ward.

Sub-block B - prior marriage flags. Two independent yes/no radios with a `# OF TIMES` count
each - one for the member, one for the present spouse. If either is YES, the dissolution table
below is mandatory.

Sub-block C - dissolution table, 4 rows. Per row - FORMER MARRIAGE OF (yourself or spouse),
NAME OF THE SPOUSE IN THE DISSOLVED MARRIAGE, DATE OF DISSOLUTION, PLACE OF DISSOLUTION
(county and state), REASON (death, annulment, divorce).

Validation rule with direct BAH consequence. The date of every dissolution must precede the
date of the present marriage. A later dissolution date means the present marriage is void for
BAH purposes (Ch 1 para 3.c) and the case routes to CMC (MFP-1).

Capacity - 4 rows. Total prior marriages of member plus spouse above 4 overflows.
The block header itself directs continuation on a separate sheet.

Sub-block D - court order or written agreement relative to support, maintenance, or paternity.
Yes/no radio and a single-line text field for date, county, and state of issue, with the copy
attached. The cancelled manual shows the row prefixed by dependent number where more than one
order applies, for example `DEPN #1: 20010530 ONSLOW COUNTY NORTH CAROLINA (DATE COURT ORDER FILED)`.

Downstream effect. YES with a stated support amount binds the member to that amount and never
below BAH-DIFF (Ch 2 paras 5, 6, 7). YES silent on support does not by itself change the
allowance. Absent an order, support must be at least BAH-DIFF for the grade, and must rise
within 60 days of a BAH-DIFF rate increase (Ch 2 para 8).

### Section 5 - natural parent of child in Armed Forces

Yes/no radio and one multi-line block. Applies only when a child is listed in Section 2.
When YES, the block requires full name of the natural parent, EDIPI, grade, type of service,
branch of service, inclusive dates of active service, and full name of each child.

Purpose - prevent the same child being claimed for BAH by two service members. A dependent
supported and claimed by another US service member is not an eligible dependent.

### Section 6 - spouse in Armed Forces

Yes/no radio. When YES - spouse EDIPI, GRADE, TYPE OF SERVICE (regular or reserve), BRANCH OF
SERVICE, INCLUSIVE DATES OF ACTIVE SERVICE, and BAQ (with dependents or without dependents).

`BAQ` is the obsolete Basic Allowance for Quarters term still printed on the 7-21 form. It
means the spouse's own housing allowance status. Reproduce the label, explain it in help text.

Dual-military note from the cancelled manual - a 10922 was not required for a Marine married to
another active duty member with no other dependents. MCO 1751.3 Ch 1 para 1.e states an
application is required for any dependent to be added to MCTFS, with no dual-military carve-out.
Treat the carve-out as rescinded and flag it.

### Section 7 - certification

Fixed certification text is form artwork. Two paragraphs - the accuracy and pay-checkage
consent, and the information release authorization.

Fields - `SignatureofMarine` (digital signature), `EDIPI`, `Grade`, sworn day, sworn month
(dropdown, January through December), sworn 2-digit year following the pre-printed `20`,
`SignatureandTitleofAttestingOfficer` (digital signature), the `Document Viewed` checkbox
(unbindable), and one single-line list field for documents viewed.

**Self-attestation is prohibited.** CH-1 para 3.a, implementing Ch 1 para 1.e. The member signs
as claimant. The attesting officer must be administrative personnel with signature-by-direction
authority. An officer signing both blocks is a compliance failure.

Detection limit - the 7-21 form has **no typed attesting-officer name field**. Index 98 is a
`ui=signature` widget captioned "(Signature and Title of Attesting Officer)". At export the app
holds no attesting-officer name string to compare against the member name. Automated detection
requires an app-side collected field outside the form, or an interstitial acknowledgement.

**Capacity problem.** Field 93 is `w=152.4mm h=6.35mm` with
`<textEdit hScrollPolicy="off" multiLine="1" vScrollPolicy="off">`. It accepts multiple lines
inside a box one line tall, with scrolling disabled in both axes. Overflow is **silently
clipped** with no visual indicator. The orders require this area to carry all of the following.

1. The list of every document viewed (cancelled P1751.3F Fig 1-2 checklist items 2, 3, 4).
2. For a secondary dependent LOSS - reason for the loss and effective date of the loss,
   with member and commanding officer signatures (Ch 1 para 10).
3. For an aged-out dependent whose member refuses to sign - the CO statement
   "Subject Name Marine (SNM) Dependent has reached the age of 21 and SNM failed to validate
   eligibility." (Ch 1 para 6.c, second note).
4. For a foreign nation divorce validated by a court - the certification of validation
   (cancelled P1751.3F para 1002.2.a, wording no longer authoritative).
5. For a foreign nation divorce with a domiciled party - the domicile certification
   (cancelled P1751.3F para 1002.2.b, wording no longer authoritative).

One line does not hold this. The app should compose the required text, warn on overflow, and
generate a continuation sheet. Confirm the continuation-sheet format with the user.

### Section 8 - approving authority

Three sub-blocks, none of which the member fills.

**Command approving authority.** Three unbindable checkboxes - APPROVED AS CLAIMED, APPROVED
FOR DEPENDENT NUMBERS (with a bound number field), FORWARDED TO CMC (CODE MFP-1) FOR APPROVAL
FOR DEPENDENT NUMBERS (with a bound number field). Then CO signature, typed name and grade,
and unit designation.

**Unit diary clerk.** REPORTED ON UNIT DIARY - No., DATED, RUC, plus a free text block.
Secondary dependent diary entries are made only by CMC (MFP-1) (Ch 1 para 11). All other
diary actions are made by the command (Ch 1 para 1.h).

**CMC approving authority.** Free text block reserved for MFP-1.

Design position - the app should render these blocks read-only and never populate them. Filling
an approving authority block on behalf of a command is the single highest-risk failure mode for
a form of this type.

## 6. Approval routing engine

Command approval versus CMC (MFP-1) determination. This is the highest-value logic in the form.

**Commanding officer approves.**
- United States ceremonial marriage, after the CO views the marriage certificate. The CO is
  not authorized to disapprove one (Ch 1 para 3.f).
- Foreign marriage, after the attesting officer views the original certificate and a certified
  English translation by a certified translator. The CO is not authorized to disapprove one
  (Ch 1 para 3.g).
- United States divorce from a court with jurisdiction, with the original decree (Ch 1 para 4.a).
- Legitimate child, on viewing the birth certificate. The hospital-certificate fallback pending
  issue of the birth certificate comes from cancelled P1751.3F para 1003.1. The word "hospital"
  has zero occurrences in MCO 1751.3.
- Adopted child, child born out of wedlock, stepchild - primary dependents, approvable at
  command level with the Figure 1-1 documentation (Ch 1 para 5).

**CMC (MFP-1) determines.**
- Common-law marriage, with certified true copies of the declaration and registration of
  informal marriage from the contracting state (Ch 1 para 3.a).
- Proxy or telephone marriage, with a certified true copy of the license and certificate of
  marriage (Ch 1 para 3.b).
- Voided marriage, when validity is questionable (Ch 1 para 3.c).
- Annulled marriage, with petition and decree of annulment (Ch 1 para 3.d).
- Indian tribunal marriage - treated as doubtful in all cases (Ch 1 para 3.e).
- Any marriage preceded by a foreign nation divorce. The CO cannot approve until MFP-1 rules on
  the divorce (Ch 1 para 3.h).
- Foreign nation divorce, with certified true copies of the original marriage certificate and
  original divorce decree, English translations of both, proof of residency (Ch 1 para 4.b).
- Any questionable US ceremonial or foreign marriage after local legal review fails to resolve.
- All secondary dependents - ward of a court, incapacitated child over 21, full-time student
  21-22, parent, parent-in-law, stepparent, parent by adoption, in loco parentis.
- Doubtful child born out of wedlock cases. Back pay requests route to CMC (MPO), not MFP-1.

Three doubtful-relationship triggers to detect automatically (Ch 1 para 4.b).
1. Member remarried following a foreign nation divorce.
2. A claim by or for the spouse from whom the member obtained a foreign nation divorce.
3. Member married to a person who obtained a foreign nation divorce.

**Certified true copy restriction.** Military notaries under 10 USC 1044a must not certify
copies of public records - birth certificates, marriage certificates, court documents
(Ch 1 para 1.i). Only the issuing entity certifies. This kills the common workaround and
should be surfaced wherever the app tells a user to obtain a certified copy.

## 7. Evidence matrix

Rows marked Fig 1-1 through Fig 1-6 come from MCO 1751.3 Enclosure (1). Rows marked otherwise
are sourced elsewhere and are flagged. Every path begins with a properly completed NAVMC 10922
signed by the member and an attesting officer.

| Dependent type | Required attachments | Statement form | Re-determination |
|---|---|---|---|
| Spouse (US ceremonial) | Marriage certificate viewed by the CO (Ch 1 para 3.f). **The current order does not say a license is unacceptable.** MCO 1751.3 Fig 1-1 step-child item 2 reads "marriage license/certificate". The "license is not acceptable" rule is cancelled P1751.3F Fig 1-2 item 5. | none | none |
| Spouse (foreign) | Original certificate plus certified English translation by a certified translator (Ch 1 para 3.g) | none | none |
| Legitimate child | Birth certificate. Hospital-certificate fallback is cancelled-source only, see section 6. | none | none |
| Adopted child | Adoption decree showing the member as legal parent (Fig 1-1) | none | none |
| Child born out of wedlock | Birth certificate naming the member, or court order, or a signed notarized affidavit of parentage from the member (FMR May 2025 para 3.2.1.3.3). Custody elsewhere routes to BAH-Diff rules. | **None.** DD 137-4 named by MCO Fig 1-1 item 3 no longer exists per the ESD registry and has zero occurrences in the May 2025 FMR. The affidavit of parentage replaces it. | none |
| Stepchild | Marriage license or certificate showing the member is married to the child's legal parent, plus documentation the spouse is the child's parent (Fig 1-1) | none | none |
| Ward of a court | Final court order granting custody 12 months or longer, certified true. Certified true copy of the ward's birth certificate. Signed statement of residency duration. Income verification. | DD Form 137 consolidated (was DD 137-7, obsolete 1 Jul 2025 per MARADMIN 311/25) | Annual - DD Form 137, contribution proof, income verification |
| Incapacitated child over 21 | Medical or psychiatric evaluation 4 months old or less, with date and age at onset, treatment, prognosis, self-support ability. DSM-V diagnosis for intellectual disability. Income verification. | DD Form 137 consolidated (was DD 137-5, obsolete 1 Jul 2025) | Annual - DD Form 137, contribution proof, income verification |
| Full-time student 21-22 | Current letter from an institution of higher education stating full-time enrollment and expected graduation date, on letterhead or from National Student Clearinghouse. Income verification. | DD Form 137 consolidated (was DD 137-6, obsolete 1 Jul 2025) | Annual - DD Form 137, current letter, contribution proof, income verification |
| Parent, parent-in-law, stepparent, adoptive parent | Proof of the member's monthly contribution is required. Income verification. | DD Form 137 consolidated (was DD 137-3, obsolete 1 Jul 2025) | Annual - DD Form 137, 12 months of contribution proof, income verification |
| In loco parentis | In-Loco Parentis Affidavit by the person who stood in loco parentis. Contribution proof required. Income verification. | DD Form 137 consolidated plus the affidavit | Annual - same as parent |

**Notarization resolved.** The consolidated DD Form 137 (edition updated 2025-05-19, OMB
0730-0014, expires 8/31/2027) carries **no notarization requirement**. The words notary,
notarized, sworn, and affirm have zero occurrences on the form. It substitutes a
penalty-of-perjury certification in Section 9 - "Under penalties of perjury, I certify claimed
individual is to my knowledge my dependent as defined by this form" - citing imprisonment up
to five years. The Figure 1-2 through 1-6 notarization wording died with the old forms. Proof
of financial dependency is a prior-year tax return showing the claimed individual as a
dependent, or the form's Worksheet for Determining Financial Support. The form is a standard
AcroForm - 7 pages, 117 fields (68 text, 31 buttons, 1 signature), not XFA - so filling it in
a later phase uses the ordinary pdf-lib path, not xfa-form-fill.ts.

Conditional attachments the attesting officer may request.
- Residential lease or command letter authorizing off-base residence, for a barracks-assigned
  Marine claiming a child resides with them.
- Proof of monthly contribution when the member is deployed, when the dependent does not reside
  in the household, or when the attesting officer deems it necessary.

**Currency rules.**
- Forms submitted to CMC (MFP-1) must be within 6 weeks of signature to submission. This note
  appears on Figures 1-2, 1-3, 1-4, 1-5, and 1-6. It does **not** appear on Figure 1-1, the
  adopted, out-of-wedlock, and step-children checklist. Do not apply it as a blanket rule.
- Substantiating documentation within 30 days of the life event (Ch 1 para 1.f).
- Incapacity medical evaluation within 4 months.
- Age-21 validation within 15 working days of notification, or the dependent is removed from
  MCTFS (Ch 1 para 6.c).

**Proof of support - allowed and disallowed.** Money order receipts, cancelled checks, bank to
bank transfers, wire transfers, dependent support allotments, billing statements with matching
bank statements. Joint account statements in some cases. **Cash payments are never acceptable.**

## 8. Secondary dependent eligibility tests

Encode these as validators, not prose.

**Ward of a court** - all five must hold.
1. Court of competent jurisdiction in the US or a US territory placed the ward in the member's
   custody permanently or for at least 12 months from the order date.
2. Placement occurred before the ward turned 21.
3. Ward depends on the member for over 50 percent of support.
4. Ward resides with the member, absent the military-necessity or institutional-care exception.
5. Ward is not a dependent of any other member under any other definition.

**Incapacitated child over 21** - both must hold.
1. Incapacitation existed before age 21 while the child was a legitimate child, dependent child,
   stepchild, adopted child, or ward, or while approved as a full-time student 21-22.
2. Child depends on the member for over 50 percent of support.

**Full-time student 21-22** - both must hold.
1. Enrolled full-time at an institution of higher education in a degree-producing course of study.
2. Depends on the sponsor for over 50 percent of support.

Eligibility runs from age 21 to the date of the 23rd birthday (Ch 1 paras 1.b and 1.f, verbatim
"to the date of their 23rd birthday"). Do not encode "day before" - the order does not say it.
A student claimed only for DEERS or medical purposes does not need DD 137-6 and routes to
MCO 5512.11E instead.

**Parent** - both must hold.
1. Parent depends on the member for over 50 percent of support.
2. Parent income excluding the member's contribution is less than half of total monthly
   living expenses.

**In loco parentis** - stood in place of a parent for a continuous period of at least 5 years
before the member turned 21, and meets every parent test.

**Never eligible** (from the cancelled manual introduction, unchanged in substance by the
current order's eligible-dependent list).
- Brothers, sisters, aunts, uncles, grandparents, and other relatives, unless they qualify as a
  court-appointed ward or stood in loco parentis.
- A Marine's child adopted by a third party.
- Stepparent after divorce from the natural parent, absent an in loco parentis relationship.
- A dependent supported and claimed for BAH by another US service member.

## 9. Validation rules for the app

Hard errors - block export.
1. Self-attestation. **Not detectable from form data alone** - the form carries no typed
   attesting-officer name. Implement as an app-side collected attesting-officer name compared
   to the member name, or as a blocking acknowledgement before export.
2. Any dissolution date on or after the present marriage date.
3. Section 2 relationship value outside the controlled vocabulary.
4. Prior-marriage radio YES with a zero or blank `# OF TIMES`.
5. Prior-marriage radio YES with no dissolution rows populated.
6. Court-order radio YES with an empty date and place field.
7. Section 5 radio YES with an empty identifying-information block.
8. Section 6 radio YES with empty spouse service fields.
9. Reason LOSS on a **secondary** dependent with no reason and effective date composed for
   Section 7, or with no commanding officer signature block completed (Ch 1 para 10). Primary
   dependent losses take a warning, not an error.
10. Secondary dependent claimed with no consolidated DD Form 137 attached (deferred with the
    secondary dependent engine, decision 9).
11. Row count above capacity - 6 dependents, 1 custodian, 4 dissolutions - with no continuation
    sheet generated.
12. Section 7 documents-viewed text exceeding the visible width of field 93. The widget has
    `vScrollPolicy="off"`, so excess text vanishes with no indicator.

Warnings - allow export, surface the risk.
1. Relationship value routes the case to CMC (MFP-1). State the reason and the attachment list.
2. Foreign nation divorce present anywhere. Recommend legal review before submission.
3. Application date more than 30 days after the stated life event.
4. Signature date more than 6 weeks before intended submission, for CMC-routed cases.
5. Ward court order duration under 12 months.
6. Student dependent whose 23rd birthday falls inside the claim period.
7. Custodian block populated but no dependent flagged as living outside the household.
8. Instruction to obtain a certified true copy of a public record, paired with the notary
   restriction under Ch 1 para 1.i.

Do not validate. Approving authority blocks in Section 8. Render read-only.

## 10. Date formats - resolved by the template

The form declares its own formats. No decision is needed.

| Field group | Indices | Picture clause |
|---|---|---|
| Date of application | 0 | `<format>` `date{MMM D, YYYY}` |
| ECC, current enlistment, last discharge | 7, 8, 9 | `<validate>` `date{M/D/YY}` |
| Section 2 DOB and claimed-from, all 6 rows | 14, 15, 19, 20, 24, 25, 29, 30, 34, 35, 39, 40 | `<format>` `date{M/D/YY}` |
| Present marriage date | 51 | `<format>` `date{M/D/YY}` |
| Dissolution dates, all 4 rows | 56, 61, 66, 71 | `<format>` `date{M/D/YY}` |
| Unit diary DATED | 89 | none declared |

`date{M/D/YY}` matches the printed Section 2 header `DATE OF BIRTH (M/D/YY)`. The apparent
conflict with the cancelled manual is not a conflict. Its samples were filled on the 4-01
revision, whose DOB column header read `(Day, Mo., Year)`, which is why Figure 1-16a shows
`14081995` in DDMMYYYY. Both were correct for their own revision. Neither applies to 7-21.

Open item, minor - index 89 has no declared picture. Pick a house convention for the unit diary
DATED field. The app should never populate it in any case, since it belongs to the unit diary
clerk block.

## 10a. Effective-date rules - sourced 2026-07-20 from FMR May 2025 (full chapter supplied)

Authoritative basis for DATE ALLOWANCE CLAIMED FROM. All quotes verbatim from DoD FMR
7000.14-R Vol 7A Ch 26, May 2025 edition.

**Para 10.3 (p. 26-52):** "When a Service member acquires a dependent, for example, through
marriage, birth, or adoption, a with-dependent housing allowance is authorized as of the date
the dependent is acquired."

**Table 26-1 (p. 26-71), Date to Start BAH or OHA for a Service Member With a Dependent:**

| Rule | If a Service member | BAH/OHA with-dependent begins |
|---|---|---|
| 1 | enlists or is called to extended AD, no Government quarters | date of enlistment or entry on AD |
| 2 | is appointed to commissioned or warrant officer status, no Government quarters | date AD pay begins |
| 3 | occupies Government quarters with a dependent and the assignment ends | date the quarters assignment ends |
| 4 | departs the PDS with dependent on PCS from Government quarters | the PCS departure date |
| 5 | acquires a dependent while in a duty status or on authorized leave, no Government quarters | **the date the dependent is acquired** |
| 6 | acquires a dependent while in unauthorized absence status | date the member returns to pay status after apprehension or surrender |
| 7 | claims an individual **not yet determined to be a dependent** | date "determined or approved by authority specified in paragraph 3.2, as applicable" |

Application to the form.

| Relationship | Rule | Effective date |
|---|---|---|
| Spouse | 10.3 + Table 26-1 rule 5 | Date of marriage (dependent acquired through marriage) |
| Legitimate child | 10.3 + rule 5 | Date of birth (acquired through birth) |
| Adopted child | 10.3 + rule 5 | Date of adoption |
| Stepchild | 10.3 + rule 5 | Date acquired - the marriage creating the step relationship |
| Secondary dependents and any doubtful case | Table 26-1 rule 7 | Determination or approval by the para 3.2 authority. For USMC children, Table 26-7 (p. 26-77) - CO of a battalion, squadron, or separate detached command, or IPAC OIC for non-doubtful; CMC (MFP-1), 2008 Elliot Road, Quantico VA 22134-5143 for doubtful |

Rule 5's acquisition date and the MCO's ward rule (date of court order or residency) are
reconcilable - the court order is the acquisition event. Rule 7 governs the not-yet-determined
window and reads ambiguously between "date of the approval" and "date the authority sets."
For secondary dependents the app prompts rather than computes (deferred engine), so the
ambiguity has no code impact in phase 1.

The unauthorized-absence rule (Table 26-1 rule 6) and rules 1 and 2 are new information not in
either MCO - encode rule 5 as the default and surface rules 1, 2, and 6 as edge-case help text.

Tables 26-21 (CONUS) and 26-22 (OCONUS), pp. 26-89 to 26-90, govern which rate location applies
on acquisition and confirm the without-dependent rate stops the day before acquisition. Rate
selection is out of scope for the form filler - cite only.

**MCTFS caveat.** These FMR dates fix the entitlement. The MCO's stricter documentation clocks
(30-day life event submission, 6-week currency) still gate processing. Both apply.

## 11. Decisions - recorded 2026-07-20

| # | Question | Decision |
|---|---|---|
| 1 | START checkbox unbindable | **Build a flattened-render fallback path for START applications.** |
| 2 | Continuation sheet format | **Deferred.** Hold for a later test. Until then, hard error 11 blocks overflow export. |
| 3 | Spouse and legitimate-child effective dates | **CLOSED 2026-07-20.** Sourced verbatim from FMR May 2025 para 10.3 and Table 26-1 rule 5 - date the dependent is acquired. See section 10a. The app may compute, with the source cited in help text. |
| 4 | Five cancelled-source effective-date rules | **CLOSED 2026-07-20.** FMR para 10.3 and Table 26-1 rules 5 and 7 supersede the cancelled-manual rows. Section 5's effective-date table is superseded by section 10a. Secondary dependent dates remain prompt-only (rule 7 ambiguity, deferred engine). |
| 5 | Reservist blank claimed-from rule | **Dropped.** Not carried into the new form logic. Cancelled source only. |
| 6 | `PREV APPR` annotation | **Dropped.** Not carried into the new form logic. Cancelled source only. |
| 7 | Dual-military carve-out | **Treat as rescinded.** A 10922 is required for any dependent entering MCTFS. |
| 8 | Self-attestation detection | **Add an app-side attesting-officer name field.** Compare against member name, block on match. |
| 9 | First release scope | **Spouse and children only.** Secondary dependent engine with consolidated DD Form 137 routing is a later add. Section 7 evidence matrix rows for secondary dependents and section 8 tests stay in this spec as the build target for that phase. |
| 10 | Section 7 certification narratives | **User composes.** The app prompts with the required elements (documents viewed, loss reason and effective date where applicable) and validates presence and length against field 93 capacity. It does not author the text. |

## 11a. Superseding guidance - MARADMIN 311/25

MARADMIN 311/25 (R 012000Z JUL 25), Secondary Dependency Application DD Form 137 Update.
References DoD FMR Vol 7A Ch 26 (2024-08-01 per the MARADMIN; current edition May 2025) and
MCO 1751.3 W/CH 1. Key holdings.

1. Effective 1 Aug 2024, all secondary dependency claims use the consolidated DD Form 137.
2. From 1 Jul 2025, MFP-1 no longer accepts DD 137-3, 137-5, 137-6, 137-7.
3. Applies to Active Component, Selected Reserve, ADOS Marines, family members, and other
   populations when authorized by law.
4. DD 137-4 is not listed as obsolete. Child born out of wedlock is a primary dependent under
   MCO 1751.3, outside the MARADMIN's secondary-dependency scope.
5. POC - Mary Stroz, DEERS/RAPIDS SPO, MFP-1, 703-784-9188, mary.stroz@usmc.mil.

## 12. Confidence

| Area | Confidence | Basis |
|---|---|---|
Revised after independent audit on 2026-07-20.

| Area | Confidence | Basis |
|---|---|---|
| Field inventory and positional order | 0.99 | Regenerated twice from template.xml by separate passes, exact match against shipped datasets.xml, 102 of 102, and 0 diffs against the section 3 table on node, ui, x, and y |
| Date formats | 0.97 | Picture clauses read directly from the template. 20 of 21 dateTimeEdit fields declare one |
| Radio value maps | 0.97 | Read from template `items` elements and confirmed by comparing child centre positions to printed column centres. Maximum deviation 0.64mm |
| Unbindable checkbox list | 0.97 | No `name` attribute and no `bind` element. Verified 43 unnamed fields total, 38 of them exclGroup children, leaving exactly 5 standalone |
| Approval routing matrix | 0.94 | Every citation verified verbatim against MCO 1751.3 Ch 1 paras 1, 3, 4, 5, 6, 7, 10, 11 and Ch 2 paras 5 through 8 |
| Evidence matrix | 0.90 | 9 of 11 rows exact against Figures 1-1 through 1-6. Spouse and legitimate-child rows carry no figure and are flagged in place |
| Secondary dependent eligibility tests | 0.95 | Verbatim from Ch 1 paras 6.a, 6.b, 6.c, 7.a, 7.b |
| Relationship controlled vocabulary | 0.70 | Synthesized. No authoritative enumerated list exists in either supplied document |
| Effective date rules - primary dependents | 0.95 | FMR May 2025 para 10.3 and Table 26-1 rule 5, quoted verbatim from the full supplied chapter. Section 10a |
| Effective date rules - secondary dependents | 0.60 | Table 26-1 rule 7 wording is ambiguous between approval date and authority-set date. Prompt-only in the deferred engine |
| DD Form 137 consolidation facts | 0.95 | MARADMIN 311/25 full text, ESD registry listing, zero sub-form occurrences across all 119 FMR pages, and the form itself (2025-05-19 edition) |

Remaining weak links - relationship vocabulary (0.70) and rule 7 ambiguity (0.60). Neither
blocks the phase 1 spouse-and-children build.
