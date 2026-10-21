# NAVMC 10274 (AA Form): one layout for the preview and the official export

Status: PR 1 of 3 (0.13.5). Owner's handoff of 2026-10-21, verified against
`main` at `da11784` by four independent reads of the code, the XFA blank,
and the test suite. Decisions marked "ruled" are the owner's and binding.

## What was wrong

Two renderers, no shared layout. The live preview is a pdf-lib redraw
(`src/services/pdf/navmc10274Generator.ts`). The unsigned export replaces the
`datasets` stream of the government's dynamic XFA blank
(`src/lib/xfa-form-fill.ts`), and Acrobat lays the text out. Each formatted
the data on its own. Confirmed on the owner's v3 request:

| Id | Defect | Where |
|---|---|---|
| D1 | Export dropped the typed name | XML builder never read `sig` |
| D2 | Export wrote the date as typed ("19 Oct 26") into a `date{YYYY-MM-DD}` field | XML builder |
| D3 | Preview spilled block 12 overflow onto its own page 3 sheet, 29-row capacity at 12 pt | generator |
| D4 | Preview Via never wrapped, 10 pt, ran into block 5 | generator |
| D5 | Preview used 10 pt / 12 pt everywhere; the form is 9 pt / 10 pt in most boxes; lines dropped silently | generator |
| D6 | Indent styles differed (18 pt table vs four spaces and two spaces) | both |
| L1 | A blank paragraph made later siblings repeat a number (filtered index vs unfiltered engine) | XML builder |
| L2 | Reference letters past (z) printed "{" in the preview | pipeline data builder |
| L3 | Body plus name could exceed block 12 with no check | both |

Found during verification, not in the handoff: any non-WinAnsi character or a
newline inside a paragraph throws inside the preview; the preview drops the
name when the body is empty; a title-only paragraph vanished from the export
but was numbered in the preview; `parseInt` with no guard in both paths; no
test asserted any of this, and the browser test checked only that the export
starts with `%PDF-`.

## The official form, measured (XFA template of the bundled blank)

Every field is fixed height with no auto-grow; Acrobat clips. Insets 0.762 mm
left/right/top and 0.508 mm bottom unless noted. Captions sit on top.

| Field | Block | w x h mm | Font | Pitch | Lines |
|---|---|---|---|---|---|
| Date | 3 | 63.5 x 9.1 | TNR 9 | 9 | 1, picture `date{YYYY-MM-DD}`, centred, 1 mm insets |
| ActNum | 1 | 28.6 x 9.5 | TNR 9 | 10 | 1 |
| FileNum | 2 | 34.9 x 9.5 | TNR 9 | 10 | 1 |
| NameFrom | 4 | 98.5 x 12.7 | TNR 9 | 10 | 2 |
| OrgStat | 5 | 98.1 x 25.4 | TNR 9 | 10 | 5 |
| Via1 | 6 | 98.7 x 12.7 | TNR 9 | 10 | 2 |
| AddrTo | 7 | 95.25 x 28.6 | TNR 10 | 10 | 7, no caption, 1.27 mm insets |
| NatOfAct | 8 | 82.6 x 19.1 | TNR 9 | 10 | 4 |
| CopyTo | 9 | 82.6 x 15.9 | TNR 9 | 10 | 3 |
| RefAuth | 10 | 98.4 x 31.75 | TNR 9 | 10 | 7 |
| Encl1 | 11 | 98.4 x 31.75 | TNR 9 | 10 | 7 |
| SuppInfo | 12 | 196.96 x 129.97 | TNR 10 | none set | 30 at 11.5 pt, 32 at 11.07 pt |
| ProcAct | 13 | 196.85 x 244.5 | TNR 10 | none set | 59 at 11.5 pt, 62 at 11.07 pt |

The blank has no signature field, no auto-grow, and ships prefilled To and
Reference data the export overwrites. Block 12's caption, with the form's own
spelling: "Reduce to minimum wording - type name of orginiator and sign 3
lines below text".

## Rulings (2026-10-21)

1. Block 13 is the continuation box on both paths. Export blocks only when
   block 12 plus block 13 overflow. The processing chain endorses separately.
2. Paragraphs print as citation, two spaces, text, four spaces per sub-level,
   in both renderers.
3. Capacity is the safe pitch (30 lines in block 12, 59 in block 13) until the
   owner renders a 31-line and a 32-line file in Acrobat and reports which
   clips. One constant, `AA_DEFAULT_LINE_HEIGHT`, moves it.
4. The typed name starts at the box's centre line, three blank lines under
   the text, on both paths.
5. Unchanged from 2026-07-17 and 2026-08-28: unsigned forms export onto the
   official XFA form; the bundled blank stays byte-for-byte the government
   file.

## The sequence

1. 0.13.5 (this PR): `src/lib/navmc10274-layout.ts` with the table above,
   capacities, the date picture, the paragraph formatter on the unfiltered
   index, the block 12 / block 13 flow and the centred name. The export reads
   it. The preview data builder takes the shared letter and number helpers and
   the shared date. Tests: `tests/navmc10274-layout.test.ts`,
   `tests/xfa-form-fill.test.ts` (10274 body and date),
   `tests/fixtures/navmc10274-tle-extension.ts` (the v3 request with every
   personal detail replaced by a same-length placeholder).
2. Next: the preview draws each box at the form's own size and pitch from the
   module, wraps the Via, prints block 13 with block 13's geometry instead of
   the generic sheet, draws the name per ruling 4, surfaces overflow instead
   of dropping lines, and survives non-WinAnsi text. A block-severity
   validator refuses export past block 13 and a warning names the small boxes
   that overflow, through the existing export gate, with the Page 11 toast
   pattern in the hook.
3. Then: a parity test rendering the fixture through both paths and asserting
   identical block 12 and block 13 line breaks, a browser test reading the
   exported datasets for the date and the name, a sweep of the 27 AA
   templates for fit, a manual cloud.gov dispatch, and the owner's Acrobat
   check on the v3 file, which alone closes the item.
