# SemperScribe Policy Compliance Audit — Four-Instrument Cross-Reference

**Date:** 2026-06-09
**Scope:** SECNAV M-5216.5 CH-1 (DON Correspondence Manual), SECNAV M-5215.1 (Sep 2020, DON Directives Management Manual), MCO 5215.1K w/Admin CH-3 (Marine Corps Directives Management Program), MCO 5216.20B w/Admin CH-4 (Marine Corps Supplement to the DON Correspondence Manual).
**Method:** Full-text forensic extraction of all four source files, every numeric value cited to chapter/paragraph. Values absent from a source are marked ABSENT — nothing is inferred.

**Source fidelity caveats (verify before treating as authoritative):**

- All four files are markdown conversions. Figure images (MCO 5216.20B Figs 13-1 to 13-21; SECNAV M-5215.1 Appendix C workflow) were lost in conversion. Exemplar layouts from those figures are NOT recoverable from these files.
- OCR artifacts exist: garbled date stamps in MCO 5216.20B, stripped paragraph numerals in SECNAV M-5215.1.
- Both correspondence instruments predate the DoDI 5200.48 CUI program — they use FOUO terminology. Per project policy, SemperScribe does not handle CUI; the user is responsible for not entering it. FOUO/classified marking rules below are documented as policy facts, not as features to implement.

---

## DOCUMENT 1 OF 4

### 📑 SECNAV M-5216.5 CH-1 — Core Summary

The Department of the Navy Correspondence Manual is the master layout authority for the **Correspondence** archetype: standard naval letters, multiple-address letters, endorsements, six memorandum types, business letters, executive correspondence, and e-mail. It is the upstream source every other instrument in this set delegates to for margins, fonts, and page geometry. It does not format Directives (delegates to OPNAVINST 5215.17 / MCO 5215.1K), and DLA, I-Type, and AMHS formats are ABSENT.

### 🛠️ Data & Workflow Requirements

- **Mandatory fields (standard naval letter):** SSIC (4-5 digits), originator code + serial (serial mandatory only if classified, resets to 001 each calendar year), date (abbreviated format, typed only on signing day), From, To, Subj (sentence fragment, all caps, no acronyms), signature block (name all caps, no rank, no complimentary close).
- **Conditional fields:** Via (numbered only if 2+), Ref (lettered (a)-(z), then (aa)+; listed in order of first text citation; every ref must be cited in text), Encl (numbered (1)+ even when single), Copy to.
- **Conditional logic (selected, full inventory in extraction):**
  - More than 4 action addressees → drop To line, use Distribution line (Ch 8).
  - Endorsement fits on signature page → same-page endorsement, else new-page; new-page must repeat basic letter SSIC, ID, subject (Ch 9).
  - Endorsement refs/encls continue the basic letter's lettering/numbering sequence.
  - Window envelope only if: address ≤5 lines, does not pass page middle, unclassified, no Via addressees (Fig 7-3).
  - Signature page must carry at least 2 lines of body text; no paragraph starts at page bottom without 2 lines there and 2 lines carried over (7-2.13).
  - If 1a exists then 1b must exist, at every level.
  - Decision memo → single addressee only; decision block 2 lines below signature.
  - Memo for SecDef/DepSecDef/SECNAV/UNSECNAV signature → omit signature block; SecDef/DepSecDef/ExecSec → omit date.
- **Security/privacy markers:** Classified → serial mandatory with classification letter after slash, banner top+bottom center, portion marks every paragraph, CAB on first page. TOP SECRET → number ALL pages. SSN collection eliminated effective 1 Oct 2015 unless justified (2-2.10). Signing ink black or blue-black only (2-2.21).

### 📐 Visual Layout & Typography Blueprint

- **Margins:** 1 inch all four sides, every page (7-2.1). Header 1 inch, footer 1/2 inch. No right/center/full justification, no proportional spacing.
- **Typography:** 10-12 pt; Times New Roman 12 preferred for official correspondence, Courier New acceptable for informal (2-2.20). Bold/underline/italics emphasis only.
- **Letterhead:** 8.5 x 11 white bond; DoD seal 1 inch diameter at 1/2 inch from top-left; "DEPARTMENT OF THE NAVY" centered on 4th line from top; activity name/address centered below, nine-digit ZIP, no abbreviations or punctuation. Computer-generated: 10 pt bold first line, 8 pt address lines (App C). Preprinted ink: PMS 288 blue.
- **Sender symbols:** SSIC on 2nd line below letterhead, starting 2+ inches from right paper edge, longest line ends near right margin; stack SSIC / code+serial / date.
- **Heading block spacing (lines below previous element / spaces after colon):** From: 2nd line below date, 2 spaces. To: next line (no skip), 6 spaces. Via: next line, 5 spaces. Subj: 2nd line below, 3 spaces. Ref: 2nd line below, 4 spaces. Encl: 2nd line below, 3 spaces. Runover lines align under first word after heading.
- **Body:** starts 2nd line below last heading; single-spaced paragraphs, blank line between; continuation lines at left margin (never indented). Indent scheme per Fig 7-8: each subdivision aligns with first letter of the paragraph above; levels 1. / a. / (1) / (a) / underlined 1. / a. / (1), never beyond.
- **Signature block:** all lines start at page center, 4th line below text. Name all caps (prefix exception: P. W. McNALLY). No rank, no close. "By direction" / "Acting" on line below name.
- **Copy to:** left margin, 2nd line below signature line.
- **Continuation pages:** repeat Subj at top, start on 6th line from page top, text resumes 2nd line below.
- **Page numbers:** none on page 1; centered, 1/2 inch from bottom, starting at 2, no punctuation.
- **Business letter divergences:** ID symbols upper LEFT; date in civilian format (May 23, 2014); inside address 2-8 lines below date; salutation + "Sincerely," at center, 2nd line below text; signature 4th line below close; main paragraphs indented 4 spaces, unnumbered; subdivisions indented 8 spaces (Fig 11-1); window variant: ID on line 10, address on line 16, salutation on line 25 (Fig 11-4).
- **Executive memo (Ch 12):** 2-inch top margin first page (adjustable to 1.75, or 1 if no letterhead), 1 inch elsewhere; TNR 12; paragraphs indented 0.5 inch, subparagraphs +0.5 inch; double space between paragraphs; signature 4 blank lines below text at center.

### 💻 Three-Way Parity Implementation Specs

| Layout Element | Web Preview (HTML/CSS) | DOCX Strategy (OpenXML) | PDF Strategy |
| :--- | :--- | :--- | :--- |
| Page sheet | Fixed 8.5in x 11in container, `padding: 1in`, `box-sizing: border-box` | `w:pgSz w="12240" h="15840"`, `w:pgMar` all 1440 twips, footer 720 | `@page { size: letter; margin: 1in; }` footer via `@bottom-center` at 0.5in |
| Font | `font-family: 'Times New Roman', serif; font-size: 12pt; line-height: normal` — never rem-based | `w:rFonts ascii="Times New Roman"`, `w:sz val="24"` | Embed TNR; identical 12pt metric so line counts match Web/DOCX |
| Heading colon gaps | Render literal spaces inside `white-space: pre-wrap` spans — never CSS gap/margin, or DOCX copy-paste fidelity dies | Literal space runs in `w:t xml:space="preserve"` | Same pre-formatted text; WeasyPrint honors `white-space: pre-wrap` |
| Runover alignment | Hanging indent: `padding-left` equal to measured ch offset of first word, `text-indent` negative | `w:ind hanging=` matching twip offset | Same CSS as preview |
| Signature block | Block with `margin-left: 50%`, preceded by exactly 3 empty line boxes (4th line rule), `break-inside: avoid` | Empty paragraphs x3 then paragraph with `w:ind left=` at center (4680 twips) and `w:keepLines`; bind to last text paragraph with `w:keepNext` | `page-break-inside: avoid` on sig container plus 2-line widow guard on preceding paragraph |
| Two-lines-of-text rule | JS pagination pass counts rendered line boxes; force break earlier when sig page would carry <2 text lines | `w:widowControl` plus `w:keepNext` on last 2 body paragraphs | `orphans: 2; widows: 2` plus same container logic as preview |
| Page numbers | Paginated preview renders absolute-positioned centered footer, hidden on page 1 | `w:footerReference type="default"` with PAGE field; `titlePg` to suppress page 1 | `@bottom-center { content: counter(page) }` with `@page :first` empty |
| Continuation header | Repeat Subj line at top of every page ≥2 in the paginator (6th line from top = 1in margin baseline) | Header reference containing Subj text, `titlePg` suppresses on first page | `@top-left` running element `position: running(subj)` |

### ⚠️ Edge-Case Risks & Alignment Validation

- **Indent-by-alignment is content-dependent.** Fig 7-8 aligns each subdivision with the first letter of the parent paragraph, so `12.` shifts children relative to `1.`. Compute indents from measured designator width (ch units in a monospace-measured pass, or canvas text metrics for TNR), never from fixed constants. DOCX must receive the same computed twip values.
- **Two-digit paragraph numbers break naive grids.** "Paragraphs will not line up" is by design. Snapshot tests must include a 10+ paragraph document.
- **Endorsement numbering continuity.** Refs and encls continue from the basic letter. Schema must track cumulative counters across document + endorsement chain, not per-section counters.
- **Window envelope validation.** Reject window format when address >5 lines, any Via exists, or classification set. This is a hard validator, not a style toggle.
- **Divergence hot spot:** browser line-height vs Word single spacing. Lock `line-height` to font metrics (1.15 default in Word ≠ CSS `normal` for TNR). Validate with a 60-line page-fill test: all three pipelines must break to page 2 at the same paragraph.

---

## DOCUMENT 2 OF 4

### 📑 SECNAV M-5215.1 (Sep 2020) — Core Summary

The DON Directives Management Manual governs the **Directives** archetype at SECNAV level: instructions, manuals, notices, ALNAVs, and change transmittals. It prescribes the identification block, mandatory paragraph order, page numbering by section, and the five-page text cap. It delegates paragraph indent geometry back to SECNAV M-5216.5 ch 11 fig 11-1.

### 🛠️ Data & Workflow Requirements

- **Mandatory fields (instruction):** designation abbreviation (SECNAVINST + SSIC.consecutive + revision suffix), originator code, date of signature, designation line (caps, underlined), From (title of issuing authority), Subj, numbered body paragraphs with underlined titles, signature at center, Distribution line.
- **Mandatory paragraphs in order:** 1. Purpose (revision states purpose of the series, not the revision). 2. Cancellation (when superseding; cite canceled report symbols and form numbers). Last paragraph: Forms and Information Collections (next-to-last if a notice has a cancellation paragraph). Records Management paragraph appears in Exhibit 2 sequence; prescriptive content text ABSENT.
- **Conditional logic (selected):**
  - Instruction/notice text ≤5 pages including signature block (excl. enclosures, manuals, non-DON-lead joint instructions). References overflow → move to enclosure.
  - Notice without cancellation paragraph → self-cancels at 1 year; "Canc:" date in upper right, 2nd line above ID symbols, always last day of a month.
  - ALNAV auto-cancels at 180 days unless text or change extends.
  - Change affects >25% of pages → full revision required (next suffix letter).
  - Revision suffixes skip I and O; after Z, new consecutive point number.
  - Notices carry no consecutive number — cited by SSIC + date.
  - Classified → C/S prefix to SSIC, portion marks, top+bottom center banners. Top Secret cannot issue by directive at all.
- **Security/privacy markers:** classification prefix in designation; distribution via DON Issuance website (classified variant on SIPR site). Distribution statements A-F: ABSENT from this manual.

### 📐 Visual Layout & Typography Blueprint

- **Margins:** "bottom, left, right and header shall be 1 inch and the footer will be 1/2 inch. Page number shall be centered in the footer" (Table 1 item 3).
- **Typography:** "Courier New 12 font is the only authorized font" (Table 1 item 1.c). Pitch may change in enclosures only.
- **ID block:** top right corner, line below letterhead's last line; blocked left with longest line flush right margin; stack: designation / sponsor / date. Overlap rule: drop to 2nd line below header or split after INST/NOTE. Continuation pages: same symbols flush right, 1 inch from top, originator code omitted.
- **Designation line:** left margin, caps, underlined, 2nd line below date (Exhibit 1). Notice variant: 5 lines below letterhead address, 7 if classified (Exhibit 5) — internal conflict, see matrix row C5.
- **Headings:** From/Subj/Ref/Encl each 2 lines below preceding typing at left margin, naval-letter style.
- **Paragraphs:** numbered 1. / a. / (1) / (a); underlined Title Case titles on all major paragraphs; heading followed by period only when text runs on. Indent values ABSENT — delegated to M-5216.5 fig 11-1.
- **Signature:** name in caps, 4th line below preceding typing, beginning at page center.
- **Distribution:** 2 lines below signature, electronic website citation authorized.
- **Page numbers:** Arabic centered 1/2 inch from bottom starting page 2; inserted change pages 4a, 4b, 4c; manual front matter Roman (i, ii, iii); chapters 1-1, 2-1 (first page of chapter odd); appendix B-2 centered with "Appendix B" flush right same footer line; index Index-1.
- **Enclosures:** ID + date top flush right 1 inch from top; "Enclosure (1)" bottom flush right 1/2 inch from bottom of EVERY enclosure page.
- **Change transmittals:** "CH-n" appended to first ID line; changed first page gets "CH-1 of [date]" two spaces above ID block while date line keeps original issue date; other changed pages get ID + CH-n on line 1, change date line 2; unchanged pages untouched. Designation split rule: break after date (notice) / after number (instruction), single underscore under second line extended to the longer line. Change bars/asterisks: ABSENT.

### 💻 Three-Way Parity Implementation Specs

| Layout Element | Web Preview (HTML/CSS) | DOCX Strategy (OpenXML) | PDF Strategy |
| :--- | :--- | :--- | :--- |
| Courier New body | `font-family: 'Courier New', monospace; font-size: 12pt` — monospace makes space-count indents exact in ch units | `w:rFonts ascii="Courier New"`, `w:sz val="24"` | Embed Courier New (not a metric substitute like Liberation Mono — width deltas shift page breaks) |
| ID block flush-right stack | Right-aligned inline-block, `text-align: left` inside, widest line determines block width (fit-content) | Right tab stop at 9360 twips; or borderless 1-cell table anchored right | Same fit-content block; verify longest-line edge at exactly 7.5in from left sheet edge |
| Underlined designation line | `text-decoration: underline` on caps text — underline spans text only, not trailing spaces | `w:u val="single"` on run | Inherits preview CSS |
| 5-page cap | Paginator counts pages pre-export; block export with validation error when text+signature >5 | Same shared paginator verdict — do not re-count in DOCX, reuse the engine result | Same verdict; PDF page count asserted in CI |
| Section-variant page numbers | Paginator assigns label per section type (roman, arabic, chapter-relative, appendix) | Separate `w:sectPr` per segment: `w:pgNumType fmt="lowerRoman"`, `fmt="decimal"` with `chapSep` | Named CSS pages: `@page front { @bottom-center { content: counter(page, lower-roman) } }` etc. |
| Appendix footer dual content | Footer flex row: centered page label + right-aligned "Appendix A" | Footer paragraph: center tab + right tab, PAGE field at center tab | `@bottom-center` and `@bottom-right` margin boxes on appendix page rule |
| Enclosure page ID | Running top-right block + bottom-right "Enclosure (n)" per enclosure section | Section-scoped header and footer with right alignment | Named page per enclosure with `@top-right` / `@bottom-right` |
| CH-n stacked date | Extra line two line-boxes above ID block, right-aligned | Additional right-aligned paragraph above ID table | Same as preview |

### ⚠️ Edge-Case Risks & Alignment Validation

- **Font split is archetype-fatal if globalized.** Correspondence = TNR 12 preferred; SECNAV directives = Courier New 12 ONLY. The renderer must key font on archetype, never on a global theme. A single shared stylesheet default is a compliance defect.
- **Change-page numbering (4a/4b) breaks automatic counters.** All three pipelines need literal page-label overrides, not counter arithmetic. In DOCX this forces section breaks per inserted page — high divergence risk; consider rendering change packages as PDF-only with DOCX carrying a warning.
- **Designation overlap rule is letterhead-dependent.** Whether the ID block collides with letterhead line 4 depends on measured letterhead height. Implement as measured collision check in the paginator, mirrored into the DOCX by adjusting the spacer paragraph count.
- **Divergence hot spot:** the originator-code-omitted continuation header. If the DOCX uses one header for all pages it will wrongly carry the sponsor code past page 1. Use `titlePg` first-page header with full stack, default header without code.

---

## DOCUMENT 3 OF 4

### 📑 MCO 5215.1K w/Admin CH-3 — Core Summary

The Marine Corps Directives Management Program order governs the **Directives** archetype at USMC level: Marine Corps Orders (five-paragraph Situation/Mission/Execution/Admin+Logistics/Command+Signal format), Marine Corps Bulletins (Purpose-first format, 12-month auto-cancel), joint directives, and change transmittals. It supplies the explicit 4-space indent ladder the SECNAV manuals never state numerically.

### 🛠️ Data & Workflow Requirements

- **Mandatory fields (MCO):** ID block (MCO + SSIC.point + revision / sponsor code / date in dd Mmm yy(yy)), designation line caps underlined, From (title of principal official), To ("Distribution List"), Subj (all caps, acronyms spelled out), signature block, DISTRIBUTION with PCN, Distribution Statement on letterhead page bottom.
- **Mandatory paragraphs (Order):** 1. Situation. 2. Cancellation (if needed, always second; pushes count to 6). Mission. Execution (Commander's Intent and Concept of Operations / Subordinate Element Missions / Coordinating Instructions). Administration and Logistics. Command and Signal (Command = applicability, Signal = "This Order is effective the date signed.").
- **Mandatory paragraphs (Bulletin):** Purpose (always first), Cancellation (second if needed), Background, Action, Reserve Applicability, Cancellation Contingency (last, no date repeat). Cancellation date "Canc:" or "Canc frp: Mmm yyyy" in upper right, 2nd line above SSIC position.
- **Conditional logic (selected):**
  - <50% pages modified → change; ≥50% → revision. Max 9 changes, then revise. Revise at 9 years old.
  - ≥5 reports → Reports Required page immediately after signature page; ≤4 → promulgation page.
  - Enclosure >200 pages → optional 4/5-digit paragraph numbering (start 1000 preferred).
  - Revision suffixes skip I, O(0), Q. After Z → new point number. Reserve-only → R after SSIC (MCO 5215R.15). Classified → C/S prefix.
  - Bulletins: no point number, max one per SSIC per day, 12-month hard ceiling.
  - >26 references → (aa)-(az).
  - Subdivision requires at least two subdivisions; paragraph titles need ≥2 following lines on the page; signature needs ≥2 consecutive text lines on its page.
- **Security/privacy markers:** Distribution Statements A-F and X verbatim in Ch 1 para 19, placed at bottom of letterhead page. FOUO: "FOR OFFICIAL USE ONLY" centered, bottom of letterhead page and last printed page, 2 lines below page number. Classified ID block alternates upper-left (even pages) / upper-right (odd).

### 📐 Visual Layout & Typography Blueprint

- **Margins:** same as naval letter — 1 inch top/bottom/left/right/header, 1/2 inch footer, page numbers centered in footer (Ch 1 para 18c). No right justification.
- **Typography:** "Courier or Courier New typeface; 10 or 12 point" (18b). Two spaces after periods, one space after parentheses (para 36).
- **Indent ladder (para 33, normative):** `1.` at margin; `a.` at 4 spaces; `(1)` at 8; `(a)` at 12; underlined `1.` at 16; underlined `a.` at 20; `(1)` at 24; `(a)` at 28. Never beyond. Two blank spaces after number/letter designators, one after parenthesized. Blank line between every paragraph. Two-digit majors keep stepping 4 (no realignment).
- **ID block:** upper right, line below letterhead's last line; date dd Mmm yyyy or dd Mmm yy added after signing.
- **Designation line:** 2nd line below date, all caps, underlined.
- **Signature block:** name all caps on the FIFTH line below text, all lines start at page center, no grade/rank. DISTRIBUTION: 2nd line below signature block, caps, left margin. Copy to: 2nd line below distribution, colons aligned.
- **Page numbering:** page 1 unnumbered; Arabic centered 1/2 inch from bottom thereafter. Front matter: Locator Sheet i, Record of Changes ii, TOC iii (renumber upward when optional pages absent). Chapters 1-1, 2-1. Appendix A-1. Index I-1. Enclosure first page marked "Enclosure (X)" bottom right.
- **Running header:** directive ID block 1 inch from top right of each page, date on next line. Classified/printed: alternate sides by page parity.
- **Figures/tables:** captions bottom for figures ("Figure 1-1.--First Figure."), titles top for tables, chapter-relative numbering, double hyphen.

### 💻 Three-Way Parity Implementation Specs

| Layout Element | Web Preview (HTML/CSS) | DOCX Strategy (OpenXML) | PDF Strategy |
| :--- | :--- | :--- | :--- |
| 4-space indent ladder | Monospace font makes `text-indent: Nch` exact; level n indent = n*4 ch; continuation lines at left margin via negative hanging logic only where para 33 diagram shows | `w:ind firstLine=` only (no left indent) — MCO continuation lines return to margin; firstLine = level*4 * char-width twips (Courier 12 = 144 twips/char → 576/level) | Same ch-based CSS; assert col position of `(a)` designator = 12 chars in text extraction test |
| Five-paragraph titles | Underlined Title Case runs, `1.**` spacing as literal characters | `w:u` run props, literal spaces preserved | Inherits preview |
| Sig block 5th line | 4 empty line boxes between last text line and name (5th-line rule — one MORE than naval letter) | 4 empty paragraphs + center-indented block, `keepNext` chain | `break-inside: avoid` wrapper spanning last 2 text lines + gap + block |
| Bulletin Canc line | Right-aligned line positioned 2 line boxes above SSIC line in ID stack | Right-aligned paragraph above ID block | Same as preview |
| Alternating header sides | Page-parity class in paginator toggles left/right alignment | `w:evenAndOddHeaders` + even header (left) and default header (right) | `@page :left { @top-left }` / `@page :right { @top-right }` |
| Distribution Statement | Pinned to bottom of first-page content area above footer (flex column with `margin-top: auto`) | Text-frame anchored to bottom margin of page 1, or final first-section paragraph with exact spacer | First-page named rule with `@bottom-center` reserved for page number; statement as bottom-anchored block in flow |
| Record of Changes / TOC | Template components with fixed roman labels assigned by paginator | Distinct `w:sectPr` per front-matter segment, `lowerRoman` | Named pages per segment |
| Reports Required page | Conditional component injected immediately after signature page when reports ≥5 | New section after signature section | Forced page break + component |

### ⚠️ Edge-Case Risks & Alignment Validation

- **Font conflict with correspondence is repeated here:** Courier 10-12 (USMC directives) vs Courier New 12 only (SECNAV directives) vs TNR 12 preferred (correspondence). Three different font regimes across archetypes — schema must carry `fontPolicy` per archetype, with USMC directives allowing a 10pt variant SECNAV forbids.
- **Signature offset conflict:** 5th line (MCO 5215.1K para 37) vs 4th line (M-5216.5 letters, M-5215.1 directives). A shared signature component with a hardcoded offset is wrong for one instrument. Parameterize `sigOffsetLines` per archetype+service.
- **Front-matter renumbering cascade.** Removing the optional Locator Sheet shifts Record of Changes to i and TOC to i or ii. Label assignment must be computed at render time from present segments.
- **Divergence hot spot:** the 200-page optional numbering system changes paragraph identity format (3102.9c(3)(a)). If implemented, citation auto-links and TOC generation need a second parser mode. Recommend declaring this out of PoC scope explicitly.

---

## DOCUMENT 4 OF 4

### 📑 MCO 5216.20B w/Admin CH-4 — Core Summary

The Marine Corps Supplement to the DON Correspondence Manual is a **policy and authority overlay on the Correspondence archetype**, not a layout specification. It is published as Chapter 13 of SECNAV M-5216.5 and delegates nearly all geometry to it. Its unique renderable content: USMC signature-authority tables, executive (star) stationery rules, salutation/close pairing logic, and AMHS release policy for ALMARs/MARADMINs (policy only — message body format ABSENT).

### 🛠️ Data & Workflow Requirements

- **Mandatory fields:** all HQMC correspondence From line = "Commandant of the Marine Corps"; outgoing HQMC mail sent "From: Commandant of the Marine Corps"; complete 9-digit ZIP addresses; first Via addressee spelled out in full, subsequent vias abbreviable.
- **Conditional logic (selected):**
  - Letterhead ink: signers from Section 3 senior list → PMS 288 blue mandatory; others → black acceptable.
  - Business letter salutation: no first name → colon; first name → comma. Star stationery → comma always.
  - Close: Congress/cabinet/Service Secretary → "Very respectfully"; otherwise "Sincerely".
  - CMC received star/personal stationery → reply on star stationery; received "MEMORANDUM FOR THE COMMANDANT" → reply as memorandum on letterhead.
  - ACMC/DMCS packages → signature block left BLANK (stamped after signing) except star stationery and pen-signed letters.
  - MARADMIN → FROM line "CMC WASHINGTON DC"; final paragraph must name release authority ("RELEASE AUTHORIZED BY...").
  - Hyphenation: max 3 hyphenated lines per page, never successive; star stationery max 1 word per page preferred.
- **Security/privacy markers:** classified letters over-stamped in red ink; portion marks (U)/(C)/(S)/(TS) after subject and refs, preceding paragraphs. PII handling per Privacy Act. Routing sheet paper colors: canary (Unclas), light blue (Conf), pink (Secret), red-hatched white (TS) — physical workflow, out of renderer scope.

### 📐 Visual Layout & Typography Blueprint

- **Standard letter geometry:** ABSENT — defers wholesale to SECNAV M-5216.5 ch 2.
- **Signature blocks (Sec 12 para 2.g):** Standard naval letter and Memorandum For → signature line on 4th line following last text line, from page center, no complimentary close. Business letter → close on 2nd line following text from center, then signature 4th line below close.
- **Star stationery:** 13-pitch Times New Roman; all paragraphs indented 1/2 inch; date typed centered one line below flag after signing, format "10 November 2015", never stamped; salutation comma; close begins at center followed by comma; address block staggered under 2nd letter of the prior line; one page preferred, large stationery over two small pages.
- **Dates:** three-letter month abbreviations (Jan...Dec); never predate; date stamped after signing except star stationery (typed).
- **Information Paper:** originator symbol/code + date upper right; no address or signature block.

### 💻 Three-Way Parity Implementation Specs

| Layout Element | Web Preview (HTML/CSS) | DOCX Strategy (OpenXML) | PDF Strategy |
| :--- | :--- | :--- | :--- |
| PMS 288 letterhead | `color: #00309C` (PMS 288 sRGB approx) applied only when signer ∈ senior list | `w:color val="00309C"` conditional on signer role | Same conditional, PDF/A color profile if archival output required |
| Business close + sig | Close block at `margin-left: 50%`, 1 empty line box above; sig 3 empty line boxes below close | Center-indented paragraphs, 2nd-line and 4th-line offsets as empty paragraphs | `break-inside: avoid` spanning close + signature |
| Star stationery | Distinct template: 0.5in `text-indent` per paragraph, centered date slot rendered post-signature placeholder | Separate template part; `w:ind firstLine="720"` | Distinct named page size if 7x9 flag stock modeled — otherwise out of scope |
| Salutation punctuation | Computed field: `salutation + (firstName ? ',' : ':')` — single source function shared by all 3 emitters | Same computed string injected into template | Same string |
| Classification portion marks | Inline `(U)`/`(C)`/`(S)`/`(TS)` spans from schema enum, red over-stamp NOT simulated (manual physical act) | Plain text runs | Plain text |

### ⚠️ Edge-Case Risks & Alignment Validation

- **Lost figures are an evidence gap.** Figs 13-1 to 13-21 did not survive conversion. Any pixel-level claim about star stationery or HQMC signature layouts beyond the quoted text is unverifiable from these files. Obtain the signed PDF originals before coding those templates.
- **AMHS archetype remains unspecified.** This order governs WHO releases ALMARs/MARADMINs, not message body format. RTTUZYUW headers, precedence, and fixed-width rules are in NTP-3/DMS guidance, which is not in this document set. Do not implement the AMHS renderer from these four sources.
- **Divergence hot spot:** the blank-signature-block rule for ACMC/DMCS packages conflicts with "ensure signature blocks are typed on all CMC correspondence." The schema needs a `sigBlockRendering: typed | blank | stamped` state keyed to signer identity, or the DOCX export will emit typed blocks the SOP forbids.

---

## CROSS-REFERENCE CONFLICT MATRIX

Precedence model: SECNAV M-5216.5 is the correspondence baseline; MCO 5216.20B overlays USMC policy on it (published as its ch 13). SECNAV M-5215.1 governs SECNAV-level directives; MCO 5215.1K governs USMC directives and explicitly inherits naval-letter margins. Conflicts below are real divergences SemperScribe must encode as per-archetype parameters, not bugs in one source.

| # | Element | SECNAV M-5216.5 (Corr.) | SECNAV M-5215.1 (SECNAV Dir.) | MCO 5215.1K (USMC Dir.) | MCO 5216.20B (USMC Corr.) | Required handling |
| :- | :--- | :--- | :--- | :--- | :--- | :--- |
| C1 | Body font | TNR 12 preferred, 10-12 allowed, Courier New informal | Courier New 12 ONLY | Courier or Courier New, 10 or 12 pt | ABSENT (defers); star stationery 13-pitch TNR | `fontPolicy` keyed to archetype + service |
| C2 | Signature offset | 4th line below text, center | 4th line below preceding typing, center | 5th line below text, center | 4th line (naval ltr/memo); business: close 2nd line, sig 4th below close | `sigOffsetLines` parameter: 4 vs 5 |
| C3 | Change vs revision threshold | n/a | >25% of pages → revision | ≥50% → revision; max 9 changes; 9-year revise | n/a | Per-service workflow rule |
| C4 | Revision suffix skip letters | n/a | skip I, O | skip I, O(0), Q | n/a | USMC also excludes Q |
| C5 | Notice/Bulletin designation line position | n/a | INTERNAL CONFLICT: Exh 1 "2nd line below date" vs Exh 5 notice "5 lines below letterhead address (7 if classified)" | 2nd line below date | n/a | Adopt 2nd-line-below-date; flag Exh 5 variant for SME ruling |
| C6 | Temporary-issuance auto-cancel | n/a | Notice: 1 year; ALNAV: 180 days | MCBul: 12 months | n/a | Per-type `autoCancelDays` |
| C7 | Page cap | n/a | 5 pages text incl. signature (instr./notices) | ABSENT | exec corr.: 1 page preferred | Validator on SECNAV directives only |
| C8 | Indent scheme | align under parent's first letter (content-relative) | ABSENT (delegates to 5216.5 fig 11-1) | fixed 4-space ladder (0/4/8/12/16/20/24/28) | ABSENT; star: 0.5in all paragraphs | Two indent engines: relative (corr.) and fixed (USMC dir.) |
| C9 | To: line spacing (USMC dir.) | n/a | n/a | INTERNAL CONFLICT: Ch 2 "next line below From" vs Ch 3 "second line below From" | n/a | Adopt next-line (matches naval letter); flag for SME |
| C10 | Mandatory paragraph scheme | n/a | Purpose / Cancellation / ... / Forms last | Order: Situation/Mission/Execution/A&L/C&S; Bulletin: Purpose-first | n/a | Distinct body schemas per directive type |
| C11 | Distribution statements | ABSENT | ABSENT | A-F + X verbatim, bottom of letterhead page | Statement A used on covers | Source statement text from MCO 5215.1K only |
| C12 | Sentence spacing | not stated as rule | not stated | two spaces after periods, one after parentheses | n/a | Apply to USMC directives; do not globalize |

**Agreements (verified consistent, safe to share one implementation):** 1-inch margins with 1/2-inch footer and centered footer page numbers (all four); page 1 unnumbered, numbering starts at 2 (corr. + both directive systems); signature block lines start at page center, name all caps, no rank; PMS 288 blue letterhead ink; dd Mmm yy(yy) date in ID blocks; designation/ID block upper right with longest line flush right; ≥2 lines of text on signature page; C/S classification prefix to SSIC; consecutive point numbers never reused.

---

## VERIFICATION LEDGER

| Claim class | Method | Result |
| :--- | :--- | :--- |
| Numeric values (margins, line offsets, indents, page caps) | Quoted verbatim from source text by extraction agents with paragraph citations | Verified against quotes; two internal conflicts found and logged (C5, C9) rather than resolved silently |
| Figure-based layouts | Figures absent from markdown conversions | UNVERIFIABLE — marked throughout; obtain signed PDFs |
| Cross-document precedence | Stated delegation chains (5216.20B → 5216.5 ch 2; 5215.1 → 5216.5 fig 11-1; 5215.1K margins → naval letter) | Verified by quoted delegation language |
| AMHS body format | Searched all four sources | ABSENT from this document set — do not build from these sources |
| CUI markings | All four instruments predate DoDI 5200.48, use FOUO | Consistent with project policy: app does not handle CUI; no CUI markings implemented |

**Confidence: 0.87.** Weaknesses pulling below 1.0: lost figure images (unrecoverable from these files), OCR artifacts in the two SECURED conversions, and the two unresolved internal conflicts (C5, C9) which need an SME ruling or comparison against signed PDF originals.
