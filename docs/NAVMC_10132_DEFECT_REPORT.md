# NAVMC 10132 defect report

Findings against NAVMC 10132 (REV. 08-2023) (EF), MCO 5800.16 Vol 14, and the MCTFSPRIUM
punishment code table, gathered while building NAVMC 10132 support in SemperScribe.

Every finding below was measured against the artifact itself, not inferred from documentation.
Field names, object numbers, flag values, and `/Opt` contents come from a byte-level extraction
of the blank. Statutory text comes from the Manual for Courts-Martial, United States (2024
edition), Part V, and from 10 U.S.C. 815.

Nothing here blocks use of the form. Each finding forces a workaround, and several of the
workarounds are visible to a reviewer reading a completed UPB, so the routing matters.

| # | Finding | Severity | Owner |
|---|---|---|---|
| 1 | Victim status carries two vocabularies, rows B-E are closed lists | CRITICAL | Form |
| 2 | Booker statement is JavaScript-generated, blank ships with the accept branch stored | CRITICAL | Form |
| 3 | Items 23-25 populate only through JavaScript | HIGH | Form |
| 4 | A validate script references a field name not present in the form | LOW | Form |
| 5 | Item 5 findings clip to one character in the widget | LOW | Form |
| 6 | Item 21 is a RichText field and breaks appearance generation when empty | LOW | Form |
| 7 | Article dropdown omits Art. 78 and Art. 109A | MEDIUM | Form |
| 8 | Form cites 10 U.S.C. 486, repealed 23 Dec 2024 | MEDIUM | Form |
| 9 | MCO 011402.G requires review of a punishment Part V does not authorize | MEDIUM | Order |
| 10 | No punishment code for vessel confinement | LOW | MCTFS |
| 11 | No punishment code for the enlisted field-grade forfeiture | MEDIUM | MCTFS |
| 12 | No punishment code for reduction to the lowest or an intermediate grade | MEDIUM | MCTFS |
| 13 | Distribution line names an enlisted-only record, but the form is required for officers | MEDIUM | Form |

Routing: findings 1 through 8 and 13 to CMC (JA) through the MARADMIN 427/23 points of contact.
Finding 9 to the MCO 5800.16 Vol 14 sponsor. Findings 10 through 12 to the MCTFSPRIUM table
owner.

---

## Form findings

### 1. Victim status carries two vocabularies, and rows B-E are closed lists

Row 22A offers the vocabulary printed in the form's own instructions:

    Military, Military (spouse), Civilian (spouse), Civilian (dependent),
    Civilian (DON employee), Civilian (other), Other, Unknown

Rows 22B through 22E offer a different vocabulary, found neither in the instructions nor
anywhere in MCO 5800.16 Vol 14:

    U.S. Marine, U.S. Marine Reservist, U.S. Military, U.S. Military Reservist,
    U.S. Military Dependent, U.S. Civilian, Foreign National, Unknown

Verified against raw `/Opt` on objects 113 (row A) and 129, 126, 115, 121 (rows B through E).

The two are not crosswalkable. No widget value exists for "Military (spouse)", "Civilian
(spouse)", or "Civilian (DON employee)". "U.S. Military Dependent" conflates spouse and
dependent. Any mapping loses the exact distinction the demographic block exists to record.

Free text is not a workaround. `/Ff` on rows B through E is 131072, Combo with the Edit bit
clear, so they are closed lists. A value outside `/Opt` produces non-conforming PDF a
downstream re-save is entitled to drop.

Impact: a multi-victim UPB cannot record victims 2 through 5 in the demographic block without
either corrupting the classification or writing non-conforming PDF.

Recommend: align rows B through E to the instruction vocabulary already used by row A.

### 2. The Booker statement is JavaScript-generated, and the blank ships with the accept branch stored

Field `2 BOOKER` reads as static artwork. It is not. Three identical on-blur scripts, attached
to `2 DEMAND`, `2 COUNSELOPP`, and `2 ACC REFUSE TO SIGN`, rewrite it from a five-branch
decision:

| Condition, evaluated in this order | Resulting `2 BOOKER` value |
|---|---|
| Vessel exception | `(No Booker statement due to the vessel exception, United States v. Mack, 9 M.J. 300, 320 (C.M.A. 1980).)` |
| Refusal to sign | `(No Booker statement due to refusal to sign.)` |
| Demand trial, refuse NJP | `(No Booker statement due to refusal of NJP.)` |
| No opportunity to consult counsel | `(No Booker statement; no opportunity to consult with counsel.)` |
| Do not demand trial | `BOOKER STATEMENT: Having been advised of the above and fully understanding my rights, I choose to accept NJP.` |

The blank ships with the last branch already stored in `/V`.

Impact: any tool filling this form outside Acrobat, and any workflow where the scripts do not
fire, produces a UPB affirmatively stating the accused accepted NJP. On a case where the accused
refused to sign, demanded trial, invoked the vessel exception, or had no counsel opportunity,
that is a false statement on a legal record, produced silently and with no visible error.

Recommend: ship the blank with `2 BOOKER` empty rather than pre-loaded with one branch.

### 3. Items 23-25 populate only through JavaScript

The second-page accused identity block duplicates items 18 through 20. It is populated by
script from the first-page fields and is flagged read-only, so a non-Acrobat fill leaves it
blank or stale while the fields it mirrors are correct.

Recommend: clear the read-only flag, or state in the instructions that items 23 through 25 are
Acrobat-only.

### 4. A validate script references a field name not present in the form

The item 1 validate script tests `event.target.name == "1A ARTICLE" || event.target.name ==
"1A OFFENSE"`. No field named `1A OFFENSE` exists in the form. The summary field is named
`1A SUMMARY`.

Impact: the branch is unreachable, so the form does not enforce what the script was written to
enforce.

### 5. Item 5 findings clip to one character in the widget

The item 5 findings dropdowns pair export values with shorter display strings, which ISO 32000-1
Table 231 permits and which is not itself a defect. The export values are `Guilty` and
`Not Guilty`, the display strings `G` and `NG`.

The defect is geometric. The widget is 23.76pt wide and the dropdown button consumes 15.8pt of
it, leaving under 8pt of drawable width. Acrobat maps the stored value through `/Opt` and draws
the display string correctly, so the visible result is right, but any measurement or extraction
that reads widget width rather than `/V` will conclude the field is truncated.

Confirmed by differential probe. The comparable field `2 COUNSELOPP` shows the same 15.8pt
button intrusion against its own leading-whitespace display string.

### 6. Item 21 is a RichText field and breaks appearance generation when empty

`21 REMARKS` carries `/Ff` bit 26 set, RichText, in addition to Multiline. When the field is
empty, which is the ordinary case, a standards-conforming appearance generation pass fails
attempting to read a rich-text value that does not exist.

Impact: any tool regenerating field appearances has to clear the RichText bit first. Nothing in
the form or its instructions signals this.

Recommend: clear bit 26. Item 21 has no rich-text content and the instructions prescribe a
plain-text line format.

### 7. Article dropdown omits Art. 78 and Art. 109A

The article dropdown carries 167 entries. Two real offenses, chargeable at NJP, have no entry:

- Art. 78, Accessory after the fact
- Art. 109A, Mail matter: wrongful taking, opening, etc.

The dropdown is not editable, so a clerk charging either has no path except the item 21
"Additional Offenses" remark, which leaves item 1 blank for a charged offense.

Two further entries are worth review. Art. 79 is a court-martial findings provision rather than
an NJP offense and is correctly absent. Art. 134.109 is superseded by Art. 117a, which the form
does carry, so 134.109 is legacy.

### 8. The form cites 10 U.S.C. 486, repealed 23 Dec 2024

Repealed by Pub. L. 118-159 sec. 566(b)(1). The reference should be removed at the next
revision.

### 13. The distribution line names an enlisted-only record, but the form is required for officers

Page 1 of the blank carries, as printed artwork:

    Distribution: E-SRB
    Copy to: OMPF, Files, Member

The E-SRB is the Electronic Service Record Book, an enlisted record. Officers hold an Officer
Qualification Record instead.

MARADMIN 427/23, of the same month as this form revision, amended MCO 5800.16 Vol 15 para
010502.B.1 to read "The Unit Punishment Book (UPB) will be used in officer NJP cases," added the
UPB as an enclosure at 010605.D, and modified Figure 15-5 to the same effect. Para 010502.B.5
directs, for officers, that the UPB go to the personnel administration center and the OMPF.

So the form is now mandatory in officer cases while its own distribution line names a record
officers do not have, and omits the officer routing the amending message prescribes.

Impact: a clerk preparing an officer UPB follows a distribution instruction printed on the form
that does not apply, and the printed line gives no officer alternative. MCO 5800.16 Vol 14 para
011101 compounds the confusion by stating the form "will be used to record the imposition of NJP
for U.S. Marine Corps enlisted personnel," which reads as exclusive until the reader follows its
own pointer to Volume 15.

Recommend: at the next revision, state both distributions on the form, or state the distribution
by reference to Vol 14 and Vol 15 rather than naming one record.

---

## Order finding

### 9. MCO 011402.G requires judge-advocate review of a punishment Part V does not authorize

Para 011402.G makes "Detention of more than 14 days' pay" a mandatory judge-advocate review
trigger before an appeal authority acts.

10 U.S.C. 815(b) authorizes detention of pay. MCM Part V paragraph 5.b, which states the
authorized maximum punishments the President has prescribed, does not list detention at any
authority level, in either the officer or the enlisted schedule. Verified against the 2024
edition. A commander therefore cannot impose detention of pay, and the MCTFS table correctly
carries no code for it.

Para 011402.G is dead text. It conditions a review on a punishment no commander can impose.

Recommend: strike 011402.G, or reissue it conditioned on a punishment Part V authorizes.

---

## MCTFS findings

The MCTFSPRIUM punishment table uses an `N` prefix for nonjudicial punishment and a `C` prefix
for court-martial. The three gaps below are therefore gaps in the nonjudicial vocabulary
specifically. They cannot be reported under a `C` code, because the punishments in question are
imposed under Article 15 rather than adjudged by a court-martial.

Table version: as of 20260823.

### 10. No punishment code for vessel confinement

MCM Part V 5.b(2)(A)(i) and 5.b(2)(B)(i), and 10 U.S.C. 815(b)(2)(A) and (b)(2)(H)(i), authorize
confinement for not more than 3 consecutive days upon a person attached to or embarked in a
vessel, at both authority levels. No `N` code expresses it.

Impact: low in volume, but Marines embarked on amphibious shipping are squarely in scope, and
the same vessel status drives the Booker vessel-exception branch in finding 2.

### 11. No punishment code for the enlisted field-grade forfeiture

10 U.S.C. 815(b)(2)(H)(iii) and MCM Part V 5.b(2)(B)(iii) authorize forfeiture of not more than
one-half of one month's pay per month for two months, imposed on an enlisted member by a
commanding officer of the grade of major or lieutenant commander or above.

The `N` table runs the enlisted schedule as N06 through N15, covering (b)(2)(B), (C), (D), (E),
(F) twice, then (H)(ii), (H)(v), and (H)(vi) twice. It skips (H)(iii) entirely. The only
half-month forfeiture code is N04, which sits inside the officer block at (b)(1)(B)(ii).

Impact: the enlisted field-grade forfeiture has to be reported under a code whose position in
the table marks it as an officer punishment. Any consumer inferring the accused's status from
the code block will infer it wrongly.

Recommend: add a distinct enlisted code for (b)(2)(H)(iii), or document that N04 serves both
schedules.

### 12. No punishment code for reduction to the lowest or an intermediate grade

10 U.S.C. 815(b)(2)(H)(iv) and MCM Part V 5.b(2)(B)(iv) authorize a field-grade commander to
reduce an enlisted member to the lowest or any intermediate pay grade, subject to the limit that
members above E-4 cannot be reduced more than one pay grade absent a wartime determination by
the Secretary concerned.

N08 covers only (b)(2)(D), reduction to the next inferior grade. No code expresses a reduction
of more than one grade.

Impact: a field-grade commander reducing an E-4 or below by more than one grade has no code that
records what was imposed. Note this gap is narrower for Marines than for the other Services,
because MCO 5800.16 Vol 14 para 010302.C bars reduction of Marines in the grade of E-6 and above
altogether, which is a Secretary limitation the MCM expressly permits at 5.a.

---

## Sources

- NAVMC 10132 (REV. 08-2023) (EF), byte-level extraction of the blank, SHA-256
  `1e99e12dcd97789e744b3578ad8b56edea05773a38be3402fe171581f19effc8`
- Manual for Courts-Martial, United States (2024 edition), Part V, paragraphs 2, 5.a, 5.b, 5.c,
  and 5.d. Edition incorporates E.O. 14103 of 28 July 2023 and names Nonjudicial Punishment
  Procedure among the parts updated
- 10 U.S.C. 815
- 10 U.S.C. 486, repealed by Pub. L. 118-159 sec. 566(b)(1), 23 Dec 2024
- MCO 5800.16 Vol 14, 18 MAY 2021, para 011101, as amended by MARADMIN 427/23, 281800Z AUG 23
- MCO 5800.16 Vol 15, paras 010502.B.1, 010502.B.5, 010605.D, and Figure 15-5, as amended by
  MARADMIN 427/23. Amendment text verified against the message published on marines.mil
- MCTFSPRIUM reporting tables, punishment codes N01 through N17 and 113 article codes, as of
  20260823. Not publicly posted
- ISO 32000-1 Table 231, choice field `/Opt` export and display ordering
