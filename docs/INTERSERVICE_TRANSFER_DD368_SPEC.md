# Interservice Transfer and Conditional Release (DD Form 368)

Analysis of the two documents supplied on 2026-09-06 and a design for a
new form option. Status: analysis and design only. No code written.

## 1. What was supplied, and what it does and does not cover

| Source | Date | What it governs |
|---|---|---|
| DD Form 368, Request for Conditional Release | AUG 2011, updated 20241126 | The one DoD form by which a member of one Service or component asks to be released to enter another. Four sections, four signers. |
| MCO 1001.65, Officer Retention and Prior Service Accessions | 11 Dec 2014 | Officer programs only: career designation, extended active duty, return to active duty, interservice transfer INTO the Marine Corps (enclosure 4), LDO redesignation. |

Two gaps to settle before building.

- **Direction.** MCO 1001.65 enclosure (4) is the inbound case: an
  officer of another Service applying to become a Marine. The DD 368 is
  used in both directions. A Marine leaving for another Service is the
  outbound case, and the supplied order says nothing about it. The
  outbound authorizing official for a Marine officer is set by DoD
  Instruction 1300.04 (reference (b) of the order, not supplied). For an
  enlisted Marine the governing order is the enlisted retention order
  (MCO 1130.80 series), not supplied. Both are needed to state who
  signs Section II for a Marine.
- **The blank.** The supplied DD 368 PDF is not a fillable form. pdf-lib
  cannot open it (invalid object references throughout) and it carries
  no AcroForm fields. The app's official-form exports (NAVMC 10274,
  10922, 11811, 10132) fill a fillable blank by field name. To export
  onto the official DD 368 the fillable edition from the DoD forms site
  is required. Until then the form is a redraw, the way the NAVMC 10922
  flattened preview is.

## 2. The DD Form 368, item by item

Section headings, item numbers and the completion rules are from the
form's own instructions on its reverse.

### Section I, Request for release. Completed by the recruiter and the applicant.

| Item | Field | Rule from the form |
|---|---|---|
| 1.a | Name | Last, First, Middle Initial |
| 1.b | Pay grade | |
| 1.c | EDIPI | Electronic Data Interchange Personal Identifier |
| 1.d | Service component | Short title only: USA, ARNGUS, USAR, USN, USNR, USMC, USMCR, USAF, ANGUS, USAFR, USCG, USCGR |
| 1.e | Current unit/command | Full address: the recruiter sends the form here (item 4) |
| 1.f | Address | Street, city, state, ZIP |
| 2.a to 2.d | Recruiting office address | If applicable. Section II is returned here |
| 3.a | Acknowledgement | Fixed text: request for conditional release; Guard and Reserve members attend all scheduled training until enlisted or appointed; keep the current commander informed |
| 3.b | Officer only | Tender of resignation from the current component, contingent on appointment or enlistment in the requesting component, effective the day before acceptance. Two blanks: current component, requesting component |
| 3.c | Enlisted only | Fixed text: discharge effective the day before the new enlistment or appointment |
| 3.d, 3.e | Member signature and date | Date in YYMMDD |
| 4.a | Recruiter request | Blank: Service/Component the member is to be enlisted or appointed into |
| 4.b to 4.e | Recruiter name, signature, date, title | |

### Section II, Approval or disapproval. Completed by the authorizing official within 30 days of receipt.

| Item | Field | Rule |
|---|---|---|
| 5.a | Approved | Requires the date the release is valid until |
| 5.b | Disapproved | Requires a Section IV remark referencing item 5.b with the reason; returned to the originator no later than the date in 5.a |
| 6.a to 6.f | Authorizing official name, title, telephone, address, signature, date | 6.c and 6.d are where Section III is returned to. Completed Section II is sent to the item 2 address |

### Section III, Notification of enlistment or appointment. Completed by the enlisting or appointing official within 10 days.

| Item | Field | Rule |
|---|---|---|
| 7 | Service the oath was administered into | This form and a copy of the oath go back to the item 6.d address to effect the discharge or withdrawal of federal recognition |
| 8.a to 8.g | Certifying official name, title, unit, telephone, address, signature, date | |

### Section IV, Remarks

Free text. Each remark references the item it pertains to, in the
form's own example: "Item 5.b. Disapproved for the following reason: ...".

### Value rules that become validators

- Dates in YYMMDD on every date item (3.e, 4.d, 5.a, 6.f, 8.g).
- Names in Last, First, Middle Initial order (1.a, 4.b, 6.a, 8.a).
- Service and component only from the twelve short titles (1.d, 3.b,
  4.a, 7).
- Full street, city, state, ZIP on every address (1.e, 1.f, 2, 6.d, 8.e).
- 5.a and 5.b exclusive; 5.a needs its valid-until date; 5.b needs a
  Section IV remark that names item 5.b.
- 3.b applies to an officer only and 3.c to an enlisted member only, so
  the pay grade in 1.b decides which acknowledgement prints.
- Section II is due within 30 days of receipt and Section III within 10
  days of the oath. The form gives no receipt date item, so the app can
  state the deadlines but cannot compute them without a received-on
  field of its own.

## 3. What MCO 1001.65 enclosure (4) adds for the inbound case

An officer of another Service applying for transfer to the Marine Corps.

- **Timing (para 2.a).** The application arrives at CMC (MMOA-3) no
  later than 30 days before the Officer Retention Board convenes and no
  later than nine months before the requested transfer date.
- **Format (para 2.a(2), 2.b).** The parent Service's format, with a
  cover letter carrying the statement of understanding in reference (e),
  SECNAVINST 1000.7F. That reference is not supplied, so the statement's
  wording is unknown to this design.
- **Endorsements (para 2.c).** Required from the chain of command. Each
  forwarding endorsement carries exactly one of four recommendations:
  recommended with enthusiasm, recommended with confidence, recommended
  with reservation, not recommended. Anything other than "with
  enthusiasm" must carry amplifying comments on the officer's
  qualifications and the reason. Enclosure (5) para 5 uses the same four
  grades for LDO redesignation, so the grade belongs on the endorsement
  type, not on one program.
- **Package contents (para 2.d), eleven items.** Certified true copies
  of all fitness reports; the conditional release from the parent
  Service (the DD 368 with Section II approved); a statement that the
  officer has neither been deferred from nor failed selection for
  promotion in the present grade; source of commission; SF 88 and SF 93
  in original and duplicate; a flying resume when applicable; a verified
  statement of service; PFT and CFT results administered and certified
  by a Marine above the applicant's rank within six months before the
  board; a full-length photograph in the Service C equivalent, labelled
  with name, EDIPI, MOS, height, weight and date; and the written
  observations and recommendations of two active component or Active
  Reserve Marine officers above the applicant's rank who interviewed
  the applicant.
- **Processing (para 2.e).** MMOA-3 screens for eligibility, the
  occupational field sponsor validates transferable skills, the board
  selects on the needs of the Marine Corps, selectees are career
  designated automatically, and MMOA prepares orders once both Services
  approve.

The Marine Corps unit's part in an inbound package is therefore three
documents the app can produce today as letters: the interview
observation and recommendation from each of two officers, the PFT and
CFT certification, and the forwarding endorsement with its graded
recommendation.

## 4. Design

### 4.1 Picker option

"Conditional Release (DD 368)" under Forms. Document type id `dd368`,
category `forms`, pipeline `dd368`. The form's own four sections become
four form sections; Section IV is one text area. Pay grade drives which
acknowledgement in item 3 prints and which of 3.b or 3.c is offered.

### 4.2 Rendering

A pdf-lib redraw of both faces at letter size, in the manner of the
NAVMC 10922 flattened preview: the section bars, the numbered item
labels, the fixed acknowledgement text, the checkboxes for 5.a and 5.b,
and the Privacy Act statement and instructions on the reverse. The
redraw serves the live preview and the export until the fillable blank
is available, at which point the official-form export routes through
the existing fill pipeline by field name and the redraw remains the
preview and the signature-field fallback, which is the NAVMC 10922
arrangement.

### 4.3 Validators

The value rules in section 2 above, each citing the form's
instructions. Two more from the order for the inbound package: the
endorsement grade rule (enclosure 4 para 2.c) and the PFT and CFT
six-month window (para 2.d(9)).

### 4.4 Endorsement recommendation grade

An optional `recommendation` on the endorsement type with the four
values, printed as the first sentence of paragraph 1 in the manual's
own words, with a validator that requires amplifying comments when the
grade is anything but "with enthusiasm". Cites MCO 1001.65 enclosure 4
para 2.c and enclosure 5 para 5.

### 4.5 Templates

- "IST forwarding endorsement" (new-page endorsement): the grade
  sentence, a paragraph on qualifications, and the medical
  qualification statement the commanding officer includes in the
  forwarding endorsement (enclosure 3 para 3.g, which the order states
  for RAD and which enclosure 4 does not repeat; flagged for the user).
- "IST interview observation" (letterhead memorandum from one
  interviewing officer to CMC (MMOA-3) via the applicant's chain):
  observations, recommendation, justification (enclosure 4 para
  2.d(11)).
- "PFT and CFT certification" (letterhead memorandum): scores, dates,
  the certifying Marine's rank above the applicant's, and the six-month
  window (para 2.d(9)).

### 4.6 Package

The inbound package is a Package Assembly member list: cover letter,
DD 368, the eleven items as enclosures with file bindings where they
are PDFs, and the endorsements. The existing package assembler and the
enclosure file store carry this without change.

## 5. Decisions the build needs from the user

1. Direction first: outbound (a Marine leaving), inbound (an officer
   joining), or both. The DD 368 serves both; the letters and the
   endorsement grade serve inbound only.
2. For outbound: who signs Section II for a Marine officer and for an
   enlisted Marine, with the order that says so. DoDI 1300.04 and the
   enlisted retention order are the likely sources and neither was
   supplied.
3. The wording of the statement of understanding in SECNAVINST 1000.7F,
   for the cover letter template.
4. The fillable DD 368 blank, for the official-form export.

## 6. Build phases

| Phase | Scope | Size |
|---|---|---|
| 1 | `dd368` type: data model, schema, four sections, validators from section 2, pdf-lib redraw of both faces, picker entry, tests | two to three sessions |
| 2 | Endorsement recommendation grade with its validator, the three inbound templates | one session |
| 3 | Official-form export onto the fillable DD 368 by field name, with the redraw as fallback | one session once the blank is supplied |
| 4 | Inbound package template for Package Assembly with the eleven enclosure slots | half a session |
