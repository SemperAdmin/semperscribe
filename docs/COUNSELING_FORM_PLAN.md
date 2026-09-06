# Counseling Session: policy analysis and build plan

Analysis of the three documents supplied on 2026-09-06 and a design for a
guided counseling session that ends in a unit record. Nothing in this
plan is built yet.

**Owner decision, 2026-09-06.** Counseling is not a form and does not
sit in the Forms group. It gets its own category, "Leader Development,"
and the app guides the leader through every requirement, the six
functional areas included, in every session. Sections 4, 7 and 8 reflect
this.

**Owner decision, 2026-09-06 (second).** No hard requirements. The
record exports with whatever the leader filled in. Everything policy
says becomes a suggestion keyed to the situation of the session, shown
with its cite and applied in one click where the app has enough to act.
Section 5 is rewritten on that basis.

**Implementation status 2026-09-06.** Phase 1 shipped in 0.11.0.

| Artifact | Location |
|---|---|
| Vocabulary, dates, intervals, targets, the suggestion engine | `src/lib/counseling.ts` |
| Schema, definition, category `counseling-worksheets`, pipeline `counseling` | `src/lib/schemas.ts` (`CounselingSchema`, `CounselingDefinition`) |
| The guided seven-step editor | `src/components/counseling/CounselingSections.tsx` |
| Render, mock-up A as a boxed numbered form (0.11.1) | `src/services/pdf/counselingGenerator.ts` (`counselingFormModel`, `generateCounseling`) |
| Sidebar group "Counseling Worksheets" | `src/components/layout/Sidebar.tsx` |
| Templates | `public/templates/global/counseling-initial.nldp`, `counseling-thirty-day.nldp`, `counseling-follow-on.nldp` |
| Tests | `tests/counseling.test.ts`, `tests/template-counseling.test.ts`, `tests/components/counseling-sections.test.tsx`, `tests/components/sidebar-counseling.test.tsx` |
| Not built | Phases 2 and 3 (section 8): the per-Marine link, follow-on from a saved session, cross-session area coverage, DOCX, printable blank |

Owner decisions 2026-09-06, all applied: category "Counseling
Worksheets" (nothing else belongs in a Leader Development group yet);
guided flow; no hard requirements; EDIPI for both Marines; the new
section titles; PRIVACY SENSITIVE marking; the Marine's comments as an
option; warrant officers on the corporal-through-colonel interval; the
five life events plus a unit-specific entry.

## 1. What was supplied, and what each document settles

| Source | Date | What it governs |
|---|---|---|
| MCO 1500.61, Marine Leader Development | 28 Jul 2017 | The current order. Defines teaching, coaching, counseling and mentoring, the six functional areas, the baseline occasions for counseling, and the records and Privacy Act rules. Prescribes no form (para 5.b(1)). |
| NAVMC 2795, User's Guide to Counseling | undated, referenced by MCO 1500.61 as reference (g) | The how-to. Session frequency by grade and component (para 2001), the session process, target-setting rules (para 4002), documentation minimums (para 3005 and Appendix A), and two suggested worksheets (Figures A-1 and A-2). |
| Unit "Counseling Worksheet" (Counseling_Form.pdf) | undated | One unit's adaptation of the Appendix A worksheets. Sections A to G. Not an official form, so the app owes it nothing beyond what policy requires. |

Three facts drive every design decision below.

- **No form is prescribed.** MCO 1500.61 para 5.b(1) says the order "does
  not specify the use of certain forms or formats." NAVMC 2795 Appendix A
  says its worksheets are "suggested, not mandatory" and para 3005.1.f
  says a commander "can modify them as necessary to fit the unit's
  specific needs." The app is free to lay the worksheet out however it
  serves the counselor, as long as the policy minimums are on it.
- **The documentation minimum is four items.** NAVMC 2795 para 3005.1.j
  and Appendix A para 1: the date of the session, the name of the Marine
  counseled, the subjects discussed, and/or the targets or tasks set.
  Documentation itself is "recommended," with "specific procedures up to
  the individual unit commanders" (Appendix A para 1). The app suggests
  these four and blocks on none of them.
- **The record belongs to two people.** NAVMC 2795 para 3005.1.i: the
  documentation "is for use only by the senior and the junior. It is not
  to be forwarded to an officer in the reporting chain, nor is it to be
  passed from one senior to the next when the senior/junior relationship
  ends. When the relationship is terminated, all documentation is
  destroyed." MCO 1500.61 para 5.c adds the Privacy Act. This is a
  privacy-first record and the app must treat it that way.

## 2. The rulebook the form has to carry

Every rule the form enforces or displays, with its citation. These become
validators, defaults, or on-form text.

### 2.1 Occasions (MCO 1500.61 para 4.b(2))

The baseline occasions, "the minimum requirement, not all-inclusive":
establishment of the RS and MRO relationship, issuance of a fitness
report, assignment of proficiency and conduct marks, eligibility for
promotion, joining a new unit, PCS, assignment to Force Preservation, and
major changes in billet responsibilities.

NAVMC 2795 adds the session types: initial counseling session (ICS),
follow-on session, the 30-day session for lance corporals and below, and
event-related counseling (para 2001.4, "initiated by either party").

### 2.2 Frequency (NAVMC 2795 para 2001)

| Population | Rule | Cite |
|---|---|---|
| Any new senior/junior relationship | ICS approximately 30 days after the relationship starts. Does not replace the welcome-aboard meeting. | 2001.1.a |
| Corporal through colonel | First follow-on approximately 90 days after the ICS, then at intervals of no more than 6 months. | 2001.2.a |
| Lance corporal and below, active | Every 30 days, by the immediate supervisor (normally an NCO), 10 to 15 minutes. | 2001.3.a, 3.d |
| Lance corporal and below, reserve | Every 3 months and once during annual training duty. | 2001.3.f |
| Event-related | Any time, either party. | 2001.4 |

### 2.3 What an ICS must cover (NAVMC 2795 para 2001.1.b)

Seven objectives: make the senior's expectations clear, confirm the
junior understands them, set targets and plans, convey interest and
concern, explain the senior's leadership style, motivate, and confirm the
junior understands the unit mission and the junior's primary and
collateral duties. Para 2001.1.c fixes the agenda: unit mission and
status, the junior's duties, and targets for the job and for
professional development.

### 2.4 What a follow-on must cover (NAVMC 2795 para 2001.2.b)

Review progress on the targets set last session, modify or add targets,
deal with strengths and weaknesses, and identify problems since the last
session with a mutually agreed solution.

### 2.5 Targets (NAVMC 2795 para 4002)

- A target is an object, not a process: "To achieve a 95 percent NCI
  completion rate by 31 December," not "To work on improving readiness"
  (4002.1.b).
- A well-defined target has an action verb, the object of the verb, and
  one or more standards (4002.1.f, g).
- Standards are stated as quantity, quality, timeliness, or manner
  (4002.1.h).
- Challenging but attainable, within the junior's authority and
  resources, important to the mission, limited to "generally three to
  five," set jointly, and revisable (4002.1.i).

### 2.6 Documentation (NAVMC 2795 para 3005, Appendix A)

- Minimum content: date, Marine's name, subjects discussed, and/or
  targets or tasks set (3005.1.j).
- The worksheets record three things: the subject matter, the targets or
  tasks for the coming period, and major accomplishments or comments
  (3005.1.g). Both official worksheets also carry "Target date for next
  session," and Figure A-2 carries the ICS date and follow-on date.
- Fill in before the session and correct after, or fill in after. One
  approach for the whole unit (3005.1.h).
- For the senior and junior only. Not forwarded. Not passed to the next
  senior. Destroyed when the relationship ends (3005.1.i).
- Records follow NARA dispositions per SECNAV M-5210.1 (MCO 1500.61 para
  5.b(2)). PII per the Privacy Act and SECNAVINST 5211.5E (para 5.c).

### 2.7 The six functional areas (MCO 1500.61 para 4.a(1)(d))

The order calls them "a comprehensive framework to focus training and
coaching/counseling sessions" and directs leaders to "deliberately
integrate" them (para 4.b(1)). Its own definitions, which the app uses
as the prompts for each area:

| Area | The order's definition | Prompts the app offers |
|---|---|---|
| Fidelity | Faithfulness to one another, the Corps and the Nation: core values, leadership traits and principles, heritage, ethical conduct. | Conduct on and off duty since last session. Any ethics or standards issue. Example set for juniors. |
| Fighter | The skill sets and knowledge of a well-rounded warrior: PME, MOS duties and standards of performance, interpersonal communication, on and off-duty education. | PME status and next course. MOS proficiency and training gaps. Off-duty education. Rifle and weapons quals. |
| Fitness | Physical, mental, spiritual and social health and well-being. | PFT, CFT and body composition. Sleep, stress, resilience. Spiritual and social support. |
| Family | The fundamental social relationships Marines draw strength from. | Dependents and their situation. Housing and living conditions. Upcoming family events. |
| Finances | The disciplined practice of personal financial responsibility. | LES reviewed. Debt, savings, big purchases ahead. Command financial counselor referral. |
| Future | Setting and accomplishing goals in the other five areas. | Promotion and reenlistment timeline. Career and civilian goals. Targets set this session. |

Para 4.a(1)(c) sets the standard the prompts serve: leaders are expected
"to have knowledge of all aspects of the lives of their Marines and
Sailors, from the names and ages of their children to their educational
and fitness goals, and to their living conditions, both on and off
base." NAVMC 2795 para 2001.3.e covers the same ground for the 30-day
session: pay and LES, family, off-duty education, personal goals,
upcoming events.

**What the order does not say.** It does not require all six areas to
be discussed in every session, and para 5.b(1) warns against records
kept as a "paper drill" or to "check the block." A 10 to 15 minute
30-day session (NAVMC 2795 para 2001.3.d) will not cover six areas
every time. So the app walks every session through all six and suggests an answer
for each, not a discussion: discussed with notes, not this session, or
a target set. Coverage across a Marine's sessions is what the app
watches, and reports as a suggestion.

### 2.8 What this form is not

Developmental counseling under MCO 1500.61 is not the adverse
administrative counseling of MCO 1900.16 para 6105 (the page 11 entry).
NAVMC 2795 para 1001.3 calls counseling "a positive, forward-looking
process that focuses on improving performance," and para 5002.4 tells
the senior to keep attention on "facts, events, and targets and
results." The form carries no acknowledgement-of-deficiency
language, no rebuttal clause, and no OMPF routing. A unit needing a 6105
entry uses the page 11, not this worksheet.

## 3. The unit worksheet against policy

| Unit section | Policy support | Finding |
|---|---|---|
| A. Administrative: name, EDIPI, rank, DOR, PMOS, BILMOS; occasion; date; "Marine Performing Counseling (COUNSELING MENTOR)" with name, EDIPI, rank, billet | Figures A-1 and A-2 carry name, grade, MOS, billet, date. | Uses EDIPI where the 1980s worksheets used SSN. Correct: the app rejects SSNs on export already. Two defects: the "Mentor" label, and no component (active or reserve) field, which the frequency rule needs. |
| B. Billet title | Figures A-1, A-2 "Billet" | Keep. |
| C. Major accomplishments / significant events | 3005.1.g "major accomplishments" | Keep. |
| D. Evaluation of performance this period | Not a worksheet heading. 2001.2.b asks for strengths and weaknesses. | Keep as a narrative, retitled "Strengths and deficiencies." No grade or scale: para 5002.4 keeps the focus on facts, events, targets and results. |
| E. Tasks assigned next period / goals | 3005.1.g "targets or tasks"; 4002 target rules | Keep, but structure each target: action, object, standard, due date. A free bullet list is where 4002 gets lost. |
| F. Mentor's comments | Not in policy | Keep as "Senior's comments." Add "Marine's comments": counseling is "two-way communication" (MCO 1500.61 para 4.a(1)(c)). |
| G. Certification: both signatures and dates | Figures A-1, A-2 "Marine Counseled" and "Marine Performing Counseling" | Keep. |
| Missing | 3005.1.j(3): subjects discussed | Add "Subjects discussed." One of the four minimum items and the unit form has no place for it. |
| Missing | Figures A-1, A-2: "Target date for next session" | Add, computed from grade and component per para 2001. |
| Missing | Figure A-2: ICS date, follow-on date | Add "Date of ICS" and "Date of last session." |
| Missing | 2001.2.b: review of last session's targets | Add a prior-targets review block for follow-on sessions. |
| Missing | MCO 1500.61 4.a(1)(d): functional areas | Tag each subject and target with a functional area. |
| Missing | 3005.1.i, MCO 1500.61 5.c | Print the handling statement on the form. |

**The "Mentor" label is wrong under the current order.** MCO 1500.61
para 4.a(1)(d): mentoring "is a voluntary relationship between two
individuals and should not be directed or forced." Counseling is the
senior's duty. The form names the person "Marine performing counseling
(senior)" and does not call the relationship mentoring.

## 4. Optimised record: the data model

Field prefix `counseling`. Flat fields on FormData, the way `dd368*`
fields are, plus arrays for subjects, areas and targets. Document type
id `counseling`, new category `leader-development`, sidebar group
"Leader Development," option label "Counseling Session." The Forms
group stays for numbered official blanks. Putting counseling beside the
page 11 invites the confusion section 2.8 warns about.

### Section 1. Session

| Field | Type | Rule |
|---|---|---|
| `counselingOccasion` | select: initial, follow-on, 30-day, event-related, and the eight baseline occasions from 2.1 | drives suggestions |
| `counselingDate` | date | suggested (3005.1.j(1)) |
| `counselingIcsDate` | date | shown for follow-on; defaults to the session date for initial |
| `counselingLastSessionDate` | date | shown for follow-on |
| `counselingNextSessionDate` | date | defaulted per 2.2 from grade and component; editable |
| `counselingLifeEvents` | multi-select from MCO 1500.61 para 4.b(1)(b) | drives suggestions |
| `counselingEventDescription` | text | shown for event-related |

### Section 2. Marine counseled

| Field | Rule |
|---|---|
| `counselingMarineLastName`, `FirstName`, `MiddleInitial` | suggested (3005.1.j(2)) |
| `counselingMarineRank` | select, drives the frequency rule |
| `counselingMarineComponent` | select: active, reserve. Drives the 30-day versus 3-month rule. |
| `counselingMarineEdipi` | optional. See decision 1. |
| `counselingMarineDor`, `Pmos`, `BilletMos` | optional |
| `counselingBilletTitle`, `counselingBilletDescription` | optional |

### Section 3. Marine performing counseling

`counselingSeniorLastName`, `FirstName`, `MiddleInitial`, `Rank`,
`Billet`. All optional.

### Section 4. Subjects discussed

`counselingSubjects`: list of `{ text, area }` where `area` is one of the
six functional areas or "duties." For an initial session the section
opens with the seven ICS objectives as a checklist (2.3), each ticked
item becoming a subject line. Satisfies 3005.1.j(3).

### Section 4a. The six functional areas

`counselingAreas`: exactly six entries, one per area, each
`{ area, status, notes }` with status `discussed`, `not-this-session`
or `target-set`. The guided flow (section 7) shows the area's
definition and prompts from 2.7, and the notes become subject lines
under that area. An area left unanswered raises a suggestion, never a block.

### Section 5. Review of targets from last session (follow-on only)

`counselingPriorTargets`: list of `{ text, status }` with status met,
partly met, not met, dropped, carried forward. Carried-forward targets
copy into Section 8. Satisfies 2001.2.b.

### Section 6. Major accomplishments and significant events

`counselingAccomplishments`: textarea (3005.1.g).

### Section 7. Strengths and deficiencies

`counselingStrengths`, `counselingDeficiencies`: two textareas
(2001.2.b). Narrative only, no scale.

### Section 8. Targets for the coming period

`counselingTargets`: list of
`{ action, object, standardKind[], standard, dueDate, area }`.

- `action`: the verb, from a suggested list ("To complete," "To pass,"
  "To achieve," "To start," "To maintain") or typed.
- `object`: what the verb acts on.
- `standardKind`: any of quantity, quality, timeliness, manner (4002.1.h).
- `standard`: the measure ("95 percent," "first-class," "by 15 Oct").
- `dueDate`: on or before the next session date.
- `area`: functional area.

The form prints each as one sentence: "To achieve a 95 percent NCI
completion rate by 31 December." The structure exists so the suggestion
engine sees an action, an object and a standard.

### Section 9. Comments

`counselingSeniorComments`, `counselingMarineComments`: textareas.

### Section 10. Certification

`counselingSeniorSignedDate`, `counselingMarineSignedDate`. Names come
from Sections 2 and 3. The signature block is followed by the handling
statement:

> This record is for use only by the Marine counseled and the Marine
> performing the counseling. It is not forwarded in the reporting chain,
> is not passed to a succeeding senior, and is destroyed when the
> senior/junior relationship ends (NAVMC 2795 para 3005.1.i). It contains
> personally identifiable information protected by the Privacy Act of
> 1974 (MCO 1500.61 para 5.c).

## 5. Suggestions, not requirements

Nothing in this document type blocks an export. The only dialog on the
way out is the app's existing sensitive-data gate, which fires on EDIPI
and SSN patterns for every document type and has an "Export anyway"
button. That gate is Privacy Act handling (MCO 1500.61 para 5.c), not a
counseling rule, and stays as it is.

Everything else is a suggestion. A suggestion has four parts: the
situation that raises it, the text, the cite, and an action the leader
takes in one click where the app has enough to act. Suggestions are
dismissible for the session and never repeat once dismissed. They show
in the step they belong to and in one list on the close step.

### 5.1 Situation inputs

The situation is what the leader has already entered. The engine reads:

- occasion (initial, follow-on, 30-day, event-related, or one of the
  eight baseline occasions from MCO 1500.61 para 4.b(2));
- life events ticked in step 1, from MCO 1500.61 para 4.b(1)(b):
  eligible for promotion or reenlistment, birth of a child, PCS move,
  first car or house, selection to a resident school or special
  training, and "other";
- the Marine's grade and component;
- dates: session, ICS, last session, next session;
- last session's targets and their status (follow-on);
- the six area statuses;
- the targets entered so far and their parts.

### 5.2 The suggestion table

| Id | Situation | Suggestion | Cite | One-click action |
|---|---|---|---|---|
| `date` | session date empty | Record the date of the session. | NAVMC 2795 3005.1.j(1) | Set today |
| `marine-name` | Marine's name empty | Record the name of the Marine counseled. | 3005.1.j(2) | none |
| `content` | no subjects and no targets | Record the subjects discussed or the targets set, or both. | 3005.1.j(3), (4) | Go to step 4 |
| `senior-name` | senior's name empty | Record who performed the counseling. | Figures A-1, A-2 | none |
| `next-session` | next-session date empty | Set the target date for the next session: N days out for this grade and component. | 2001.1 to 2001.3, Figures A-1, A-2 | Set the computed date |
| `next-session-late` | next-session date past the interval | The interval for this grade and component is N. | 2001.2.a, 2001.3.a, 2001.3.f | Set the computed date |
| `ics-agenda` | occasion initial | Cover the seven ICS objectives: expectations, understanding, targets and plans, interest, leadership style, motivation, unit mission and duties. | 2001.1.b | Load the checklist |
| `ics-unit-status` | occasion initial | Review the unit's mission and status and the Marine's primary and collateral duties. | 2001.1.c | Add subject |
| `follow-on-review` | occasion follow-on, no prior targets loaded | Review progress on the targets set last session and modify or add. | 2001.2.b | Load last session's targets (phase 2) |
| `target-not-met` | a prior target marked not met | Identify the cause and agree a solution, or drop or modify the target if circumstances changed. | 2001.2.b, 4002.1.i(6) | Carry forward as a new target |
| `thirty-day-topics` | grade LCpl and below | A 10 to 15 minute session. Topics: strengths and weaknesses, pay and LES, family, off-duty education and PME, personal goals, upcoming events. | 2001.3.d, e | Mark the matching areas |
| `reserve-interval` | component reserve, grade LCpl and below | Reservists: every 3 months and once during annual training duty. | 2001.3.f | Set the computed date |
| `event-praise` | occasion event-related | A session is an occasion for praise as well as for problems. | 2001.4.b | none |
| `target-count-low` | fewer than 3 targets | Set a few important targets, generally three to five, achievable before the next session. | 4002.1.i(4) | Add target |
| `target-count-high` | more than 5 targets | More than five targets. Keep the ones that make the biggest difference before the next session. | 4002.1.i(4) | none |
| `target-form` | a target with no action verb, object or standard | State the target as an action, its object and a standard: quantity, quality, timeliness or manner. | 4002.1.f to h | Open the target builder |
| `target-due` | a target due after the next session | This target is due after the next session. Move the date or split the target. | 4002.1.i(4) | Set due to next session |
| `target-ownership` | all targets entered by the senior with no Marine's comment | Targets are a joint effort. Ask the Marine for one. | 4002.1.i(5) | none |
| `area-unanswered` | an area with no status | Answer each of the six areas: discussed, not this session, or target set. | MCO 1500.61 4.a(1)(d), 4.b(1) | Mark not this session |
| `area-target` | an area marked target set with no target tagged to it | An area is marked for a target. Build it in step 6. | 4.a(1)(d) | Add target tagged to the area |
| `area-coverage` | an area not discussed in the Marine's last three linked sessions, or in 6 months | This area has not come up since (date). | 4.a(1)(d) | Open the area card (phase 2) |
| `life-promotion` | eligible for promotion or reenlistment | Cover the timeline, PME and cutting-score or board requirements, and reenlistment options. | 4.b(1)(b), 4.b(2) | Mark Future and Fighter discussed |
| `life-child` | birth of a child | Cover dependency paperwork (NAVMC 10922 exists in this app), housing, finances and leave. | 4.b(1)(b) | Mark Family and Finances discussed |
| `life-pcs` | PCS move | Cover orders, household goods, family plans, finances during the move. | 4.b(1)(b), 4.b(2) | Mark Family and Finances discussed |
| `life-purchase` | first car or house | Cover the financial decision and a command financial counselor referral. | 4.b(1)(b), 4.a(1)(d) Finances | Mark Finances discussed |
| `life-school` | resident school or special training | Cover preparation, prerequisites and what follows the course. | 4.b(1)(b) | Mark Fighter and Future discussed |
| `force-preservation` | occasion Force Preservation | Cover physical, mental, spiritual and social well-being and the resources available. | 4.b(2), 4.a(1)(d) Fitness | Mark Fitness discussed |
| `fitrep-procon` | occasion fitness report or pro/con marks | Tie the marks to the targets set and met this period. | 4.b(2), 4002 | Load prior targets |
| `new-unit` | occasion joining a new unit or major billet change | This starts a new senior/junior relationship. Hold the ICS about 30 days in. | 2001.1.a, 4.b(2) | Set occasion initial and next session +30 days |
| `mentor-label` | "mentor" in a billet field | Counseling is the senior's duty. Mentoring is voluntary and never directed. | 4.a(1)(d) | none |
| `handling` | always, on the close step | This record is for the senior and junior only. Not forwarded. Destroyed when the relationship ends. | 3005.1.i | none |

The next-session computation: LCpl and below active, +30 days; LCpl
and below reserve, +3 months; Cpl and above from an initial session,
+90 days; Cpl and above from a follow-on, +6 months.

### 5.3 What this costs

A blank record exports. That is within policy: documentation is
recommended, not required, and its content is the commander's call.
The trade is a leader who fills in only what the session needed, with
the app having shown every applicable rule on the way. The close step
lists the suggestions still open so the export is a decision, not an
oversight.

## 6. Render

- **Pipeline.** New `counseling` entry in `PIPELINE_MAP`, drawn with
  pdf-lib the way `dd368Generator.ts` is, with no artwork behind it. One
  page in the normal case, overflow to a second page for long sections.
- **Layout (0.11.1, mock-up A).** Portrait letter, boxed and numbered
  the way DD and NAVMC forms read. Title block with a one-line
  statement of what the form is and is not. Ten sections in session
  order: I Session (items 1 to 6), II Marine counseled (7 to 14), III
  Senior (15 to 18), IV Agenda (19, by occasion), V the six areas as a
  table with discussed, not-this-session and target-set columns (20)
  plus subjects discussed (21), VI Performance (22 to 24), VII Review
  of last session's targets (25), VIII Targets as a five-row table with
  standard-kind codes (26), IX Comments (27, 28), X Certification (29
  to 32) with signature cells, then the handling paragraph. Check
  boxes for every closed choice. Section bars and tables keep together
  across page breaks; page numbers print. No form identifier (owner
  decision: a record kept by two people and destroyed at relationship
  end has no edition to track).
- **No letterhead, no seal, no SSIC, no classification block.** This is
  a working record, not correspondence. The unit form has none.
- **Marking.** "PRIVACY SENSITIVE" at the top and bottom of every page,
  the standard DoD PII marking, unless the owner decides otherwise
  (decision 3).
- **Exports.** PDF in phase 1. DOCX in phase 3 through the existing
  generator, since there is no official blank to protect.
- **Export gate.** The existing sensitive-data dialog fires on EDIPI
  and any SSN pattern. No change needed.

## 7. User experience: a guided session

- **Picker.** Sidebar, new "Leader Development" group above Forms, one
  entry for now: "Counseling Session." The group exists so the
  per-Marine notebook view in phase 2 has a home.
- **Guided flow.** The editor presents the session as seven steps, in
  the order a session runs (NAVMC 2795 chapter 3), with the policy
  guidance for each step shown at its head, the open suggestions for the
  step under it, and a progress rail. No step is mandatory and every
  step is skippable. The flat section list the rest of the app
  uses is the fallback view. The step layout is new UI.

| Step | What the leader does | Guidance shown |
|---|---|---|
| 1. Occasion and timing | Pick the occasion and any life events. See the interval rule and the computed next-session date. | NAVMC 2795 para 2001, MCO 1500.61 para 4.b(1)(b), 4.b(2) |
| 2. Who | Marine counseled and Marine performing counseling. | NAVMC 2795 para 3005.1.j(2) |
| 3. Agenda | Initial: the seven ICS objectives as a checklist. Follow-on: last session's targets, each marked met, partly met, not met, dropped or carried forward. Event-related: the event. | Para 2001.1.b, 2001.2.b |
| 4. The six areas | One card per area with the order's definition and the prompts from 2.7, re-ordered so the areas the situation points at come first. Set discussed, not this session, or target set. Notes become subjects discussed. | MCO 1500.61 para 4.a(1)(d) |
| 5. Performance | Major accomplishments, strengths, deficiencies. | Para 3005.1.g, 2001.2.b |
| 6. Targets | Three to five, each built as action, object, standard, due date, area. Targets flagged in step 4 are pre-seeded here. | Para 4002 |
| 7. Close and record | Senior's and Marine's comments, signatures, the handling statement, the list of open suggestions. Export. | Para 3004, 3005.1.i |

- **Session-type first.** The occasion in step 1 decides what steps 3
  and 4 show. The prompts in step 4 shift for a 30-day session to the
  para 2001.3.e topics.
- **Next session for free.** The date is pre-filled from grade and
  component, with the cite shown under the field.
- **Follow-on from a saved session.** A "Start follow-on session"
  action on a saved counseling document copies Sections 2 and 3, sets
  the occasion to follow-on, fills the ICS and last-session dates, and
  loads last session's targets into the prior-target review. Phase 2.
- **Templates.** Three: "Initial Counseling Session (Cpl and above),"
  "30-Day Counseling (LCpl and below)," and "Follow-On Session," each
  with three to five well-formed targets so the pattern is on screen.
- **Guidance panel.** The target-setting rules (2.5) and the ICS
  objectives (2.3) in the existing guidance data, keyed to the section.
- **Privacy.** The library entry shows a "for the senior and junior
  only" badge. Deleting a Marine's sessions when the relationship ends
  is the counselor's act under 3005.1.i, so the library offers "Delete
  all sessions for this Marine" in phase 2. Nothing counseling-related
  goes to the EDMS hand-off or the companion package builder.

## 8. Phases

| Phase | Scope | Gate |
|---|---|---|
| 1 | New category and sidebar group. Schema, definition, the seven-step guided flow with the six-area cards and prompts, the suggestion engine from section 5 (every row except the two phase 2 rows), pdf render, three templates, unit, component and pdf tests, docs. Version 0.11.0. | All existing gates, plus pdf tests reading back every field, all six areas and the handling statement. |
| 2 | Per-Marine link across sessions: the leader-notebook view listing a Marine's sessions, "start follow-on session" with prior-target carry-forward, the cross-session area-coverage suggestion, delete-all-for-Marine, e2e test of the initial-to-follow-on chain. | e2e green. |
| 3 | DOCX export, printable blank for by-hand sessions, coverage summary per Marine on the record. | Bundle budget unchanged for the initial load (the generator stays lazy). |

Phase 1 is the deliverable the owner tests. Phases 2 and 3 wait on that
feedback.

## 9. Decisions the owner makes before phase 1

Settled 2026-09-06: own category "Leader Development," guided flow, all
six functional areas walked in every session, no hard requirements,
suggestions keyed to the situation.

1. **EDIPI.** The unit form collects it for both Marines. Policy's
   minimum needs neither. Recommendation: keep it optional for the
   Marine counseled, drop it for the senior, and let the export gate
   flag it. Collecting less PII on a record that is destroyed anyway is
   the safer default.
2. **Section titles.** "Strengths and deficiencies" replaces "Evaluation
   of performance," and "Senior's comments" replaces "Mentor's comments."
   Say if the unit wording must stay.
3. **Marking.** "PRIVACY SENSITIVE" on every page, or no marking as on
   the unit form.
4. **Marine's comments.** Include the two-way block, or keep the senior's
   comments only as the unit form does.
5. **Rank list.** The next-session rule keys on grade. Confirm the grade
   list is E-1 through O-6 and that warrant officers follow the
   "corporal through colonel" rule.
