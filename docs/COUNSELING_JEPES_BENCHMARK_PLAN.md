# Counseling Worksheet: JEPES benchmark section, plan

Design for a provisional JEPES benchmark recorded at each counseling
session, for Marines in the grades JEPES covers. Companion to
`COUNSELING_FORM_PLAN.md`.

**Implementation status 2026-09-06.** Phases 1 to 3 shipped on branch
`counseling-jepes`: `src/lib/counseling.ts` (JEPES vocabulary, bands,
grade gate, suggestions), `src/lib/schemas.ts` (optional fields),
`src/components/counseling/CounselingSections.tsx` (`BenchmarkBlock`
under Step 5), `src/services/pdf/counselingGenerator.ts` (Section
VI-A), tests in `tests/counseling.test.ts` and
`tests/components/counseling-sections.test.tsx`, and the follow-on
sample template. Phase 4 (prior marks loaded from a saved session) waits
on the counseling plan's per-Marine link; until then the prior is typed.

**Owner decisions, 2026-09-06.** Marks start blank, with one control
which applies the order's 2.5 baseline to all three attributes. The
benchmark prints on the worksheet the Marine signs. The section is
hidden when the grade entered on this worksheet is E-5 or above.
Rubric descriptors show in the editor only. See section 10.

## 1. Why

MCO 1616.1 encl (1) para 3.a(3): "Until proven otherwise, a Marine
should begin at 2.5 in all three categories." Para 3.a(5) makes
counseling, "documented or informal, that occurred during the reporting
period," the evidence for a Below Expectations mark. The reporting chain
enters the mark of record once per period and has to reconstruct six
months from memory. A provisional mark taken at each counseling session,
with the evidence written in the same document, is the trail the order
describes and removes the recall problem.

## 2. What this is not

- Not a JEPES mark. The mark of record is entered in JEPES by the
  reporting chain at period end, with a justification comment chosen
  from JEPES's own drop-down of directed comments, which this app does
  not have. Every label, heading and export string says "benchmark" or
  "provisional," never "JEPES marks." Naming is the control.
- Not for Sergeants and above. "JEPES is the means by which Marines in
  the grades Private through Corporal are evaluated" (MCO 1616.1 para
  1). Fitness-report grades get no rubric. The section is absent, not
  disabled, when the grade is E-5 or higher.
- Not a unit distribution tool. The 80 percent note in para 3.a is a
  statement about a unit, unverifiable from one worksheet. It is shown
  as guidance text and never enforced.

## 3. Source

MCO 1616.1, 25 Nov 2020, enclosure (1):

- Figure 1-2, "JEPES Command Input Evaluation Metrics": the three
  rubrics (Individual Character; MOS Proficiency and/or Mission
  Accomplishment; Leadership), six bands each. Transcribed in section 7
  from the owner's screenshots on 2026-09-06. VERIFY against the PDF
  before the descriptors ship: the screenshots are a unit's rendering of
  the figure, and one line ("holds other to that same standard") reads
  as a typo carried from the source.
- Para 3.a, "JEPES Command Input Evaluation Metrics Guidelines," page
  2-5: the band rules quoted in section 4.

## 4. The rules the section carries

| Band | Range | Rule from para 3.a | What the app does |
|---|---|---|---|
| Exceptional | 4.1 to 5.0 | Requires a justification comment, "supported by formal commendatory material." Should be "a rarity." Each point above 4.1 "should increase in difficulty of achievement at an exponential rate." | Justification required. "Formal commendatory material on file" check required. Suggestion names both when absent. |
| Exceeds Expectations | 3.1 to 4.0 | "Solid performers whose accomplishments did not rate formal commendatory material." | No requirement. |
| Meets Expectations | 2.0 to 3.0 | "Until proven otherwise, a Marine should begin at 2.5." | The "Start at 2.5" control. Suggestion when all three are blank. |
| Working Toward Expectations | 1.0 to 1.9 | "Not adverse, nor does it require the Commander to NOT REC." | Guidance text says so. No requirement. |
| Below Expectations | 0.1 to 0.9 | "Requires a justification comment," evidenced by counseling during the period. "Not adverse and does not by itself NOT REC." | Justification required. Guidance text says not adverse. |
| Non Rec / Adverse | 0.0 | Rubric: NJP or court-martial in the period, pending legal action, CRB, or counselings showing complete inability. | Reason required, chosen from those four plus "other." |

One more rule, from the purpose of the section rather than the order:
a mark which moves more than 1.0 from the prior session with no
justification gets a suggestion. A benchmark which swings a full band
between sessions without a stated reason is the recall problem
reappearing in a different form.

## 5. Data model

New optional fields on `CounselingSchema`, all optional so every saved
document and the three templates still parse:

```
counselingBenchmark?: {
  character:  { mark: string; justification: string; commendatory: boolean; adverseReason: string }
  mos:        { mark: string; justification: string; commendatory: boolean; adverseReason: string }
  leadership: { mark: string; justification: string; commendatory: boolean; adverseReason: string }
  sharedWithMarine: true   // fixed by owner decision; kept as a field so the decision is in the record
}
counselingPriorBenchmark?: { character: string; mos: string; leadership: string; date: string }
```

`mark` is a string holding one decimal ("2.5"), empty when blank.
Stored as a string for the same reason the other fields are: the form
round-trips text, and "0.0" must survive as a chosen mark rather than
collapse to a falsy number.

`counselingPriorBenchmark` is filled the same way Section VII's prior
targets are: by the owner's "load prior targets" action from the last
saved session for the same Marine. Phase 2 of the counseling plan owns
the per-Marine link; until it ships, the senior pastes or types the
prior marks.

Pure helpers in `src/lib/counseling.ts`:

- `JEPES_ATTRIBUTES`: the three attributes with title, the descriptor
  paragraph, and the six band descriptors from Figure 1-2.
- `jepesBand(mark)`: the band for a mark, by the ranges above.
- `isJepesGrade(grade)`: E-1 through E-4.
- `benchmarkIssues(formData)`: the requirement checks in section 4,
  returned as suggestions in the existing engine's shape.

## 6. Where it sits

Section VI-A, "JEPES BENCHMARK (provisional, E-1 to E-4)," after
Section VI "Performance this period" and before Section VII. The
evidence (accomplishments, strengths, deficiencies) is written before
the number, so the number follows from what was recorded.

Editor (`CounselingSections.tsx`): one card per attribute, each with the
descriptor paragraph, a 0.0 to 5.0 input in 0.1 steps, the band label
and that band's descriptor list beside it, the prior mark and delta
when a prior exists, the justification field (shown always, marked
required by the band rule), the commendatory check (shown at 4.1+), and
the adverse reason (shown at 0.0). Above the three cards: the "Start at
2.5" button and the para 3.a guidance in the same suggestion style the
rest of the session uses.

Render (`counselingGenerator.ts`): one table under the section bar.
Columns: Attribute, Prior, This session, Band, Justification. Row
heights grow with the justification, through the same `row()` which
already splits across pages. The section is omitted from the PDF when
the grade is E-5 or above or all three marks are blank.

Suggestions engine: four new entries, keyed to the situation.

| id | when | text | cite | action |
|---|---|---|---|---|
| `benchmark-start` | grade E-1 to E-4, all three blank | Start each attribute at 2.5 and move from there. | 1616.1 encl (1) 3.a(3) | Apply 2.5 to all three |
| `benchmark-justify` | any mark at 4.1+ or 0.9 and below with blank justification | This band requires a justification. | 3.a(1), 3.a(5) | Focus the field |
| `benchmark-commendatory` | any mark at 4.1+ with the check off | An Exceptional mark is supported by formal commendatory material. | 3.a(1) | Focus the check |
| `benchmark-swing` | a mark more than 1.0 from the prior with blank justification | A full-band move since last session needs the reason written here. | (section purpose) | Focus the field |

## 7. The rubric, transcribed from Figure 1-2

Descriptor paragraphs and band lists as supplied. Text to verify
against the order before shipping is marked [verify].

### Individual Character

Positively displaying qualities in attributes such as courage,
initiative, honor, and commitment. These help distinguish the Marine as
an individual and form the picture of the "whole Marine" concept. Marine
is creative; favors taking initiative and displays a bias for action.
Proactive in the absence of specific direction and effectively performs
under all conditions. Physical and emotional strength overcome
difficulty, danger, and fear all the while consciously transforming
opportunity into action. Demonstrates mental flexibility and agility.

- 0.0: MRO has one or more NJPs or Courts Martial during the reporting
  period. MRO has recent or pending legal action. Documented counselings
  show a complete inability to display qualities of honor, courage and
  commitment.
- 0.1 to 0.9: Maintains minimum level of acceptable behavior and
  conduct. Documented counselings show difficulty maintaining the
  transformation as a Marine and upholding Marine Corps Values.
  Requires specific direction when confronted with situations that
  require character.
- 1.0 to 1.9: Continuing the transformation towards embodying the Core
  Values. Occasionally proactive in absence of specific direction.
  Occasionally demonstrates inner strength and maturity.
- 2.0 to 3.0: Upholds Core Values of Honor, Courage and Commitment.
  Exhibits a bias for action, integrity and military bearing with
  minimal direction. Conduct is guided with a moral compass.
- 3.1 to 4.0: Consistently displays a maturity of higher rank and grade.
  Frequently self-motivated in absence of specific direction.
  Individually recognized in front of Marines for strength of character
  during the reporting period.
- 4.1 to 5.0: Demonstrated presence of mind or composure under demanding
  circumstances. Consistently proactive. Guided by mature and ethical
  decisions. Received formal commendatory material during the reporting
  period or maintains exceptional performance highlighted previously in
  grade.

### MOS Proficiency and/or Mission Accomplishment

Demonstrates technical knowledge and practical skill in the execution of
the Marine's overall duties. Combines training, education, and
experience. Grade dependent in relation to MOS T&R Manual. Translates
skills into actions which contribute to accomplishing tasks and
missions. Understands and articulates the basic functions it took to
successfully achieve mission accomplishment in and out of MOS.
Efficiency with resources was evident and aided the Marine's ability to
successfully get the job done.

- 0.0: MRO was the subject of a Competency Review Board (CRB).
  Documented counselings show inability of MRO to perform the most basic
  MOS skills. Documented counselings show MRO is unable to perform most
  basic tasks required to accomplish the mission, even with guidance and
  supervision.
- 0.1 to 0.9: Documented counselings addressing deficiencies in MOS.
  Accomplishes assigned tasks only with direct supervision. Produces
  barely acceptable work in most aspects of job or tasks. Minimal MOS
  progression beyond PMOS school training.
- 1.0 to 1.9: Developing abilities with mentorship. Needs close
  supervision and assistance in accomplishing jobs and tasks. Performs
  acceptable work in some aspects of job or tasks. Slowly increasing
  capacity to perform within grade through training. Meets MOS specific
  T&R events; grade and MOS level MarineNet courses and/or similar
  training.
- 2.0 to 3.0: Solid and consistent performance. Dependable to accomplish
  jobs and tasks with minimal supervision and assistance. Acceptable
  level of quality and competence demonstrated. Exhibits abilities
  commensurate [verify: source reads "commiserate"] for grade for MOS
  specific T&R events; grade and MOS level MarineNet courses and/or
  similar training are in progress or complete.
- 3.1 to 4.0: Performance stands out well above peers. Can be counted on
  to execute advanced tasks with minimal supervision. Displays above
  average work in all aspects of assigned job and tasks. Exhibits
  abilities beyond grade in reference to MOS specific T&R events. PME is
  complete for grade. Individually recognized in front of Marines for
  MOS proficiency and/or contributions to mission accomplishment.
- 4.1 to 5.0: Exceptionally dependable, reliable and effective. Can be
  counted on to execute very challenging tasks with little or no
  supervision. Displays excellent work in all aspects of assigned job
  and tasks. Exhibits abilities well beyond grade in reference to MOS
  specific T&R events. PME complete for grade. Received formal
  commendatory material during the reporting period or maintains
  exceptional proficiency/mission accomplishment highlighted previously
  in grade.

### Leadership

Exhibits a natural and instinctive interest in the well-being of all
Marines, regardless of race, religion, ethnic background, or gender.
Visibly sets the example and serves as a role model for all others
while demonstrating the highest standards of conduct, ethical behavior,
fitness, and appearance. Remains authentic, compassionate, and earns the
trust of their subordinates. Maintains a positive attitude in all
situations. Embodies continual "Body, Mind, Spirit Improvement".

- 0.0: Documented counselings show complete lack of leadership far below
  the minimum expected of grade. Documented counselings show that lack
  of maturity inhibits MRO's fitness for advancement to the next grade.
  Documented counselings show a complete lack of initiative. MRO has one
  or more NJPs or Courts Martial that demonstrate a lack of leadership.
- 0.1 to 0.9: Documented counselings concerning leadership abilities.
  Decision-making is slow and un-compelling. Frequently sets a poor
  example for others to emulate.
- 1.0 to 1.9: Learning how to lead with guidance and/or in the presence
  of senior leadership. Knows self and seeks improvement. Occasionally
  displays poor example for others to emulate.
- 2.0 to 3.0: Competent at making appropriate decisions and leading IAW
  commander's intent. Dependable to discharge regular jobs and tasks
  with some supervision and assistance. Sustains required level of
  fitness and appearance.
- 3.1 to 4.0: Leadership abilities far exceed most peers. Achieves a
  highly effective balance between direction and delegation. Level of
  fitness and appearance exceeds that of peers. Individually recognized
  in front of Marines for outstanding leadership during the reporting
  period.
- 4.1 to 5.0: Exceptional leader who sets an outstanding example and
  holds others [verify: source reads "other"] to that same standard.
  Physical, mental, and/or moral courage inspires others into action.
  Model Marine, inspires subordinates, peers, and seniors. Received
  formal commendatory material during the reporting period or maintains
  exceptional proficiency/mission accomplishment highlighted previously
  in grade.

## 8. Tests

- `jepesBand`: every boundary (0.0, 0.1, 0.9, 1.0, 1.9, 2.0, 3.0, 3.1,
  4.0, 4.1, 5.0) and a blank.
- `isJepesGrade`: E-4 true, E-5 false, W-1 false.
- Suggestions: each of the four fires on its trigger and is silent
  otherwise; `benchmark-start` never fires for E-5.
- Editor: section absent for E-5, present for E-4; "Start at 2.5" fills
  all three; commendatory check appears at 4.1 and not at 4.0; adverse
  reason appears at 0.0.
- Render: section absent when blank or E-5; present with all three
  marks, band labels and justification; a long justification splits
  across pages through the existing row splitter.
- Templates: all three still parse with no benchmark fields.
- Differential: every render and suggestion test fails against the
  current generator and engine before the change lands.

## 9. Phases

1. Vocabulary, band function, grade gate, schema fields, suggestions,
   tests. No UI.
2. Editor section and the "Start at 2.5" control, with component tests.
3. Render, with position tests and the differential run.
4. Prior-benchmark load, once the counseling plan's Phase 2 per-Marine
   link exists. Until then, typed by hand.

## 10. Owner decisions on the open questions (2026-09-06)

- Descriptor paragraphs from Figure 1-2 appear in the editor only. The
  PDF carries the attribute, the mark, the band name and the
  justification. Nothing else.
- The grade gate reads the grade entered on this worksheet, at this
  session. The app keeps no database and no per-Marine history, so
  there is no promotion to detect. A worksheet for an E-5 has no
  benchmark section; a worksheet for an E-4 has one. Prior marks, when
  present, are whatever the senior typed or loaded into
  `counselingPriorBenchmark` for this document.
