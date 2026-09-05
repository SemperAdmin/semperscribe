# Changelog

All notable changes to Semper Scribe are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versions follow
semantic versioning. A version bump in `package.json` on `main` creates the
matching GitHub release with this file's section as the notes.

## [0.5.8] - 2026-09-05

Phase D.7 of the 2026-09-05 UX and policy plan: reuse for the daily
driver. The admin corporal drafting the same three letters weekly is why
the template library exists, and the audit measured what reached that
person. 69 templates ship. From a basic letter the picker read "Standard
Templates (1)", because it filtered to the current document type with no
control on screen and no way to clear it. The library empty state named
Save Draft without offering it. The command palette had answered
Ctrl+K since it shipped with nothing anywhere naming the key. And the
import pipeline read Word and PDF files only, though its extraction step
was already separate from its file reading.

### Fixed

- Every template is reachable from every document. The picker carries a
  "Matches this document type" chip, on by default when the current type
  has templates of its own and off when it has none, so a type with
  nothing of its own opens on the full index rather than on an empty
  list. A label beside it states the filter and the count, "Showing 12
  of 69, filtered to basic", and each card is badged as a match or as a
  switch to its own type. The hard filter at `useTemplates.ts:79-81` is
  gone. `templateMatches` stays pure and takes the document type only
  while the chip is on, so the count the label prints and the list the
  dialog renders come from one predicate.
- Picking a template of another document type switches the type first,
  through the same `handleDocumentTypeChange` the sidebar uses. Loading
  the template alone set `formData.documentType` from the template's own
  payload and skipped the type change, so an MCO or a staffing paper
  arrived under its own type with a basic letter's single empty
  paragraph instead of its paragraph template. On a document which
  already holds body text or any of the SSIC, subject, From or To
  fields, the switch asks first, the same `window.confirm` Clear Form
  and paragraph deletion use.
- The library empty state offers the action it names. "No saved
  documents yet. Use File, Save Draft." gains a "Save this document now"
  button on the same Save Draft path the File menu calls. It is held
  back on an untouched document, where saving would file an empty draft
  under "Untitled", and it never appears over a search which matched
  nothing.

### Added

- A command palette hint in the header: the word Commands and a `kbd`
  printing the shortcut, Ctrl K on Windows and Linux and Cmd K on macOS,
  matching the modifiers the palette's own listener reads. Clicking it
  opens the palette, so a pointer or a touch screen reaches R8 for the
  first time. The label resolves after hydration, so the static export's
  markup and the first client render agree.
- Paste-to-import (roadmap R11). File, Paste Text to Import opens the
  import modal on a paste box beside the Word and PDF entry. Pasted text
  is normalised by `linesFromText`, the same normaliser the .docx and
  .pdf extractors run over their own output, then goes through the same
  `docTypeDetector` and `correspondenceParser` calls and lands on the
  same review-fields step. `useDocumentImport` gains `importFromText`
  and `startPasteImport`, and the detect-parse-review half of the file
  path is now one function both sources call. Blank text is refused
  rather than opening an empty review.
- Tests for the filter on and off with the counts either way, the picker
  chip and its label, the card badges and the type carried back with a
  pick, the library empty-state action and the two states holding it
  back, the shortcut label on both platform families and the hint
  rendering, and a pasted basic letter parsing into From, To, Subj,
  SSIC, two Via lines, two references, two enclosures and two body
  paragraphs, from the fixture the parser tests use.

## [0.5.7] - 2026-09-05

Hold zod at 4.4.3. The weekly dependency group (#49) raised the
initial-load JavaScript from 2,556,529 B to 2,666,990 B. A source-map
attribution of the eighteen initial chunks before and after the merge
puts 83,410 B of the 105,465 B package delta on zod 4.4.3 to 4.5.4,
which added a schema-compilation engine to the classic import path the
app uses in every schema. Nothing in the app asked for it, and the
hardening program spent five PRs removing less. The report is at
`docs/audits/2026-09-05/bundle-attribution.md`.

### Changed

- `zod` is an exact pin at 4.4.3 with the reason recorded in
  `package.json`, and Dependabot ignores it, the same treatment as
  `pdfjs-dist` and `mammoth`. The other thirty-two updates in the group
  stay. Every consumer in the tree (`@hookform/resolvers`, the MCP SDK,
  the eslint react-hooks plugin) accepts 4.4.x, so the lockfile dedupes
  to one copy.
- Lifting the hold means either a `zod/mini` migration of the schemas,
  which does not pull the compiler, or a later zod release which makes
  it opt-in. Recorded under "Later" in the UX and policy plan.

## [0.5.6] - 2026-09-05

Phase D.4 of the 2026-09-05 UX and policy plan: messages that teach the
rule, and gates that hold. Three things the validators were doing wrong.
They cited a TypeScript path where a paragraph of the manual belongs.
Four items on the SECNAV M-5216.5 2-19.b proofreading list reported a
pass with no measurement behind them, one of them asserting a 1 inch top
margin the generator does not produce. And `block` severity, documented
as "export must refuse", was enforced in exactly one place, the signature
ceremony, so the PDF and DOCX downloads and the batch generator shipped a
document the app had already judged non-compliant.

### Changed

- Schema-field messages state the requirement and cite the paragraph it
  comes from. "SSIC fails its document schema", cited to "Basic Letter
  schema (src/lib/schemas.ts)", now reads "An SSIC is required on every
  naval letter" against 7-2.3.a(1), with the detail carrying what the
  manual asks for. The map covers the required header fields for both
  branches: SSIC, originator's code and date as the three parts of the
  sender's symbol (7-2.3.a(1) to (3), with the date formats at 2-16),
  From (7-2.6.a), To (7-2.7.a), Via (7-2.8.a), Subj (7-2.9.a) and the
  signature line (7-2.14.a(1)); and for a business or executive letter
  the same three identification symbols in the upper left (11-2.1.a to
  .c), the inside address (11-2.2.a) and the signer's name (11-2.9.a(1)).
  A field outside the map cites its document type's own authority. No
  message names a file in this repository. Issue ids are unchanged.
- The four hardcoded passes in the proofreading panel either measure or
  say they do not. Margins (b.(2)) and the header margin (b.(10)) report
  the generator's real figures: 0.61 inches at the top by the recorded
  2026-06-10 ruling against the 1 inch at 7-2.1, 1 inch at the sides and
  bottom, and 2 inches at the sides in Short Letter mode, which is the
  allowance at 12-4.2.b. Paragraph numbering (b.(6)) measures the
  paragraph level ladder and warns when a document opens below level 1 or
  skips a level, which leaves the app generating a designator figure 7-8
  has no reading for. Page numbers (b.(3)), paragraph alignment (b.(5))
  and the footer margin (b.(11)) report as manual items with what to
  check by eye, because the geometry they ask about lives in the PDF
  component rather than in the values the checklist reads.
- The proofreading panel passes the real Via addressees into the
  validators. It passed an empty array, so every rule which reads a Via,
  the window-envelope block at figure 7-3 among them, was inert in that
  surface and the drafter met the refusal for the first time at the
  export gate.
- A blocked export opens the compliance dialog instead of a native
  `alert()`. The SECNAV five page cap reports there too. Each issue which
  belongs to one field carries the field name, and the dialog gives it a
  jump-to-field action which scrolls the field into view and focuses it.
  The header form marks every field wrapper for the lookup.
- The reference re-lettering fixer letters a list from the same starting
  letter the validator reads. On an endorsement continuing the basic
  letter's sequence at (c), per 9-2.3, it used to walk from (a) and
  reletter a correct list into a wrong one.

### Added

- Subject line rules at warn severity. An acronym in the subject line is
  reported against 7-2.9.a and 12-3.2.c(4), which allow an acronym in the
  text once it is spelled out but never in the subject or the title. A
  token is reported only when the military dictionary carries it as an
  abbreviation and only at three letters or more: the whole subject is
  upper case by format, so flagging every capitalised word would flag
  every subject ever written. The dictionary arrives as an argument, the
  way the first-use rule takes it, so the table stays off the initial
  load. Terminal punctuation is reported against figure 7-1, which writes
  the subject in normal word order with all letters capitalised and no
  punctuation.
- An enclosure-order rule against 7-2.11.a, "List enclosures in the
  enclosure line in the order they appear in the text". It mirrors the
  reference-order rule at 7-2.10.a and carries the same severity, and it
  reads an endorsement against the numbering it continues (9-2.4), so a
  list starting at enclosure 3 is checked against 3 and 4.
- A warning when a naval signature line carries a rank or a grade.
  Paragraph 7-2.14.b lists four forms, name, name and title, name and
  title with "Acting", and name with "By direction", and none of them
  carries a rank. The Marine abbreviations come from the app's own rank
  table, with the other services and the pay grades added beside it.
- `getExportBlockers` gates the PDF and DOCX download paths and the batch
  generator, which is where the documented refusal was missing. The batch
  gate runs over the template, since the window-envelope controls, the
  addressee counts and the classification are all template state a merge
  row cannot change.
- Tests for every rule above, for the four proofreading statuses, for the
  endorsement re-lettering fixer, for the dialog's jump-to-field action,
  and for the download and batch paths refusing a blocking document and
  proceeding on a clear one.

## [0.5.5] - 2026-09-05

The spell check stops crying wolf. The paragraph editor carried its own
English dictionary, a hand-typed list of 341 words, and reported every
word outside it as unknown. On the forty-eight word paragraph the UX
audit sampled, the pass produced six false positives and zero true
positives, among them "approval", "third", "eighty-two", "sourced" and
"organically". A bar which is wrong six times out of six teaches the
drafter to ignore it. English spelling is now the browser's job, and the
custom pass keeps the one rule the browser has no view of: SECNAV
M-5216.5 paragraph 2-17.c, spell an acronym out at first use and put the
acronym in parentheses.

### Changed

- The paragraph textarea carries `spellCheck={true}` and `lang="en-US"`
  explicitly, so the platform dictionary underlines misspellings in the
  text where the drafter is typing and offers the platform's own
  corrections. The shadcn `Textarea` sets no such attribute, so the
  behavior rested on a browser default until now.
- `useSpellCheck` reports acronym suggestions and nothing else. A token
  has to be written the way the acronym table spells it before it
  matches, so lowercase prose draws no suggestion, and an acronym the
  paragraph already spells out with the expansion in parentheses is left
  alone.
- `SpellCheckBar` is labelled "Acronyms" and reads as reference material
  rather than a warning. The alert icon and the amber warning color are
  gone, the tooltip gives the expansion to write, and the bar stays
  hidden when it has nothing to show. The per-word dismiss still works.
- One place per rule: the document-level checker in
  `src/lib/acronym-validators.ts` is unchanged and stays the only place a
  first-use violation is reported, because first use is a property of the
  whole document and a single paragraph has no view of it. The per-paragraph
  bar states no rule and cites no policy. It supplies the expansion to
  write, which is the material the drafter needs to satisfy the rule.

### Removed

- The `COMMON_ENGLISH` allowlist and the `unknown` branch of the custom
  pass, along with the `unknown` member of `SpellIssue`. Initial-load JS
  drops 3,940 bytes, from 2,554,573 to 2,550,633.
- The military word set load from `useSpellCheck`. The set is a flat list
  of recognized terms with no record of a preferred spelling, so it
  supports an allowlist and no correction, and the allowlist it fed is
  gone. `loadMilitaryWordSet` stays in `src/lib/reference-data.ts` for
  other callers, and the word set is no longer fetched while a drafter
  edits a paragraph.

## [0.5.4] - 2026-09-05

Phase D.5 of the 2026-09-05 UX and policy plan: civilian letter
layout. The business letter and executive correspondence share one
render branch, and five of its geometry rules departed from SECNAV
M-5216.5 chapters 11 and 12. Every position below was measured by
rendering both emitters through `extractPdfTextLayout`, the helper the
audit used, at 12 point Times on letter paper with one inch side
margins. One line is 13.8 points.

### Fixed

- Business-letter identification symbols block at the upper LEFT
  (11-2.1, Fig 11-2). The SSIC, the originator code and the date
  measured x=460.3pt in the preview and sat in a right-anchored table
  in the export. Both now start at x=72.0pt, the left margin. The
  window-envelope variant keeps the right anchor, which is where Fig
  11-4 sets those symbols so they clear the address window. Executive
  correspondence keeps its right block: chapter 12 states no placement
  for it and Fig 12-2 shows the date to the right.
- The signer's name renders in capitals on the civilian branch
  (11-2.9.a(1)). The preview printed "j. q. public" as typed while the
  export and the naval branch both capitalised it.
- Main paragraphs indent half an inch. 11-2.6 indents a main paragraph
  "four spaces (or set margin at half inch)" and 12-3.2.c(2) has "Each
  paragraph must be indented 1/2 inch". The preview measured x=72.0pt,
  no indent at all, because react-pdf reads `textIndent` on the Text
  node and ignores it on the enclosing View. The first line now starts
  at x=108.0pt and the wrapped line returns to x=72.0pt. The DOCX
  first-line indent moves from 360 twips to 720. The old quarter inch
  cited the "eight spaces" of Fig 11-1, which governs subdivisions.
  Subdivision indents are unchanged.
- The complimentary close sits on the second line below the text
  (11-2.8, 12-3.4) and the name on the fourth line below the close
  (11-2.9.a, 12-3.2.e(3)(a)). Measured on a business letter before:
  last body line y=441.4, close y=400.0, a gap of 41.4pt or three
  lines. The name measured y=317.2, 82.8pt or six lines below the close. After:
  close y=413.8 at 27.6pt or two lines, name y=358.6 at 55.2pt or four.
  The executive letter moves the same two lines. The enclosure line
  stays on the second line below the signature line (11-2.10.a), and
  the DOCX already spaced both correctly, so the two surfaces now agree.
- Business-letter enclosure entries are numbered (11-2.10.a, "number
  and describe them briefly"): "(1) Widget report", "(2) Cost sheet".
  Chapter 12 states no enclosure-line form, so the executive letter
  keeps its plain list.

### Added

- Eleven cases in `tests/emitter-parity.test.ts` pinning the five rules
  on the business letter and the executive letter across both emitters:
  identification-block position, capitalised name, first-line indent
  and wrapped-line return, the close and name line offsets, and the
  numbered enclosures. Line offsets are asserted as measured points in
  the PDF and as counted blank paragraphs in the DOCX.
- A no-change assertion for the DLA business letter. The DLA plan makes
  the DLA ruleset a separate, parallel ruleset under the DLA
  Correspondence Manual, so it does not move with chapters 11 and 12.
  Every block this phase touches already excludes the DLA types, and
  the case pins the pre-D.5 measurement: date at x=460.3 y=675.2, body
  at the left margin, subdivision at x=108.0, the attachment line above
  the body, the close at x=306.0 with the name six lines below it.

## [0.5.3] - 2026-09-05

Phase D.3 of the 2026-09-05 UX and policy plan: endorsement
correctness. SECNAV M-5216.5 9-2.3 has an endorser "assign a letter to all
references you add by continuing the sequence of letters from the basic
letter and previous endorsements", and 9-2.4 says the same of enclosure
numbers. Both emitters honoured the continuation. The validator did
not, and the two emitters disagreed on which documents it applies to.

### Fixed

- A correct FIRST endorsement whose references continue the basic
  letter at (c) and (d) reports nothing. `validateReferences` takes the
  starting letter and letters the list from it, so the cited-not-listed,
  listed-not-cited and first-citation-order rules read the list the
  drafter sees. Before this the same endorsement drew five failures in
  the compliance dialog: `ref-not-cited-a`, `ref-not-cited-b`,
  `ref-cited-not-listed-c`, `ref-cited-not-listed-d` and
  `ref-citation-order`. Five wrong failures on a right document teach a
  drafter to close the dialog unread.
- The Word export applies the starting reference letter and the
  starting enclosure number only to an endorsement, which is the rule
  the preview already applied. A stale starting letter of "c" on a
  basic letter, as a saved draft or a shared link carries, lettered
  Word (c) and (d) against a preview reading (a) and (b).
- The 27th reference letters as (aa) in the preview, in the Word export
  and in the validator. The emitters walked character codes from the
  starting letter and printed "{" past (z), where the validator and the
  package assembler read "aa". The walk now lives in one module,
  `src/lib/reference-letters.ts`, and all three call it. The preview's
  reference-letter column widens by one character for a two-letter
  reference, which react-pdf used to wrap to "(-" and "aa)".

### Added

- A warning when an endorsement carries enclosures and still starts
  their numbering at 1, citing 9-2.4, and the matching warning when an
  endorsement lists references and still starts their lettering at (a),
  citing 9-2.3. Both stay at warn severity rather than fail: a basic
  letter which listed no references leaves its first endorsement
  starting at (a) correctly, and the same holds for enclosure 1.
  `runLetterValidators` reads the enclosure lines from its options
  argument, and the editor and the proofread panel both supply them.

## [0.5.2] - 2026-09-05

Phase D.2 of `docs/UX_POLICY_PLAN_2026-09.md`: the editor is usable at
every width and honest about saving. No change to any exported document.

### Fixed

- The paragraph body takes keyboard focus and text without a mouse
  click. It was a plain div with a click handler, and no textarea
  existed in the page until a pointer landed on it, so the primary input
  of the app failed WCAG 2.1.1 Level A. The read view stays, because it
  carries the rendered bold, italic and underline, and it is now a real
  control: Tab reaches it, Enter or Space opens the editor, Escape
  leaves it, and it names itself after the paragraph it holds
  ("Paragraph 1 body"). The textarea carries the same name.
- Compliance failures render above the editor at every viewport width.
  The banner sat inside the preview aside, hidden below 1280 px, so a
  drafter on a laptop or a phone validated nothing and exported letters
  missing required header elements with nothing on screen saying so
  (SECNAV M-5216.5 2-3, 7-2.9). The mobile preview sheet receives the
  same issues. One copy announces, so a screen reader hears the failures
  once.
- The header save indicator reports the real state. `isDirty` and
  `lastSavedAt` were declared on the shell and read by its header, and
  no caller ever passed them, so the indicator read "Draft" forever. The
  page counts edits from the moment the initial load settles and records
  the count each Save Draft wrote: "Draft" before the first edit,
  "Unsaved changes" after it, and "Saved 14:31" after an explicit save.
  The autosaved working copy does not read as saved, because the drafter
  did not choose to keep it.

### Changed

- The compliance banner lives in
  `src/components/layout/ComplianceBanner.tsx`, shared by the shell and
  the preview sheet. `LivePreview` no longer takes `issues`, and the
  `PreviewIssue` type keeps its old import path.

## [0.5.1] - 2026-09-05

Standard-letter output correctness in the PDF. The DOCX emitter is not
touched and its golden file is unchanged.

### Fixed

- "Copy to:" lands on the second line below the signature line in the
  PDF. SECNAV M-5216.5 7-2.15.b reads "Type 'Copy to:' at the left
  margin on the second line below the signature line." The PDF put the
  label on the first line below, so the on-screen preview and the PDF
  export disagreed with the DOCX export, which has always pushed the
  blank line. Measured on the golden fixture letter, whose signature
  block ends with a "By direction" delegation line at y 201.4 pt: the
  label moved from y 187.6 to y 173.8, a gap of 13.8 pt before and
  27.6 pt after, which is two 12 point line heights. The two copy-to
  addressees moved with it, from y 173.8 and y 160.0 to y 160.0 and
  y 146.2. A first endorsement measures the same, 491.2 pt to 463.6 pt.
  In Courier the gap is 27.4 pt, one 13.6 pt text line plus one 13.8 pt
  spacer. A letter with no copy-to addressees is unchanged, and so is
  every line above the signature block in a letter with them.

### Changed

- The Courier paragraph branch and the Times branch which serves the
  formats carrying no indent spec declare `orphans={2} widows={2}`, the
  two-line floor the correspondence branch already declared. SECNAV
  M-5216.5 Fig 7-1 para 3.a: "Do not start a paragraph at the bottom of
  the page unless at least two lines of text will remain on that page
  and at least two lines of text will carry over to the next page." The
  Courier branch serves every Courier letter and every USMC directive.
  In `@react-pdf/renderer` 4.5.1 the layout engine falls back to two
  when the props are absent, so today's output does not move. The engine
  does read them: raising both to four moves the same split from nine
  lines and two lines to seven lines and four lines. Declaring the value
  states the rule where the branch renders and holds it if the engine
  default ever changes.

### Tests

- `tests/copy-to-spacing.test.ts` measures the copy-to gap in the PDF
  for the basic letter in Times and in Courier, for a first endorsement,
  for an MCO directive, and for a letter with no copy-to addressees. It
  also walks a page break one line at a time across the long final
  paragraph of a Courier letter and holds at least two lines on each
  side of every split.
- The basic-letter PDF golden file records the three moved lines and
  nothing else.

## [0.5.0] - 2026-09-05

Companion, part 2 of 2: the headless process. SemperScribe now runs
without a browser. A `companion/` directory at the repository root holds
an HTTP server and an MCP stdio server over one set of operations: list
the document types, describe the fields a type takes, validate an NLDP
package, and render it to PDF or DOCX. It is built for EDMS integration
and for agent callers, and the PDF it produces is byte-for-byte the
layout the browser pipeline produces, which a parity test against the
committed golden snapshot proves. Nothing in the directory reaches the
web application: it sits outside `src/`, so `next build` never bundles
it, and the initial-load JS is unchanged.

### Added

- `companion/handler.ts` holds the four operations as pure functions.
  `renderDocument` runs the same sequence the editor runs before a
  download: NLDP structure and integrity, the letter validators, the
  export sensitive-data gate, the SECNAV five page cap, and the same
  pipeline selection, official NAVMC form fills and the I-Type route
  included. Sensitive-data findings refuse the render with a 422 naming
  them until the caller sets `acknowledgeSensitive`, which is the
  headless form of the dialog the browser shows. A document type is
  rendered only in a format it declares in its own features.
- `companion/server.ts` serves `GET /health`, `GET /document-types`,
  `POST /validate`, and `POST /render` on `127.0.0.1:7719`. A render
  returns the file as the response body with its export filename in
  Content-Disposition, or a JSON path when `out` was given. Errors are
  one JSON shape with the status the failure warrants: 400, 413, 415,
  422, 504. No CORS headers are sent.
- `companion/mcp.ts` exposes `list_document_types`,
  `get_document_schema`, `validate_document`, and `render_document` over
  stdio with `@modelcontextprotocol/sdk`, tool inputs described in zod.
  A render answers with the written path when `out` was given, otherwise
  base64 with a warning once the file passes 256 KB.
- `companion/limits.ts` caps request bodies at two megabytes
  (`COMPANION_MAX_BODY`) and bounds each operation with a real forty five
  second timer race (`COMPANION_TIMEOUT_MS`).
- `companion/output.ts` writes a rendered file only under
  `COMPANION_OUT_DIR` and only where realpath puts it inside that
  directory. Traversal, absolute paths, planted symlinks, and symlinked
  subdirectories are refused. With the variable unset there are no writes.
- `companion/assets.ts` points the C.1 asset seam at `public/` on disk,
  so fonts, seals, and the official form blanks are read from the
  checkout rather than fetched from an origin the process does not have.
- Scripts `companion` and `companion:mcp`, both run with `tsx`.
- `docs/COMPANION.md`: every route with request and response examples,
  the MCP client configuration, the environment variables, the security
  posture, and the list of what the companion does not do.
- Sixty tests in six files under `tests/companion/`, all under the plain Node
  environment: the handler operations, the limits, output confinement,
  the HTTP routes against a real listener on an ephemeral port, the MCP
  server spawned over stdio with the SDK's own client, and the golden
  parity check.

### Changed

- `@modelcontextprotocol/sdk` added as a production dependency and `tsx`
  as a development dependency. Audit is clean in both trees.

## [0.4.8] - 2026-09-05

Companion, part 1 of 2: the asset seam. Every file the export pipelines
read from `public/` (fonts, seals, form blanks, NAVMC template pages) now
goes through one module, `src/lib/assets.ts`, so a Node process can point
the pipelines at a directory on disk. This is the precondition for the
headless HTTP and MCP companion (part 2) which serves EDMS and other
integrations without a browser. No user-visible change in the app.

### Changed

- `src/lib/assets.ts` (new) owns asset access: `loadAssetBytes` and
  `loadOptionalAssetBytes` for byte consumers, `resolveAssetPath` for
  path consumers, and `registerAssetLoader` and
  `registerAssetPathResolver` to replace the same-origin fetch under Node.
  With nothing registered, the browser behaviour is unchanged.
- Font registration, the letterhead seals, the NAVMC 10274, 118(11), and
  10922 template loaders, the XFA and AcroForm official-form exports, and
  the I-Type DOCX cover seal read through the seam. The seal module's
  private loader hook is replaced by the shared one.
- `officialFormAsset(type)` returns the blank's path relative to
  `public/`; `officialFormPath` is unchanged for URL consumers.
- The test suite registers the disk loader once in `tests/setup.ts` and
  the fourteen per-file font mocks are gone with the mock module.

### Fixed

- The I-Type DOCX cover seal was fetched from `/USMC.png` without the
  deployment base path, so on GitHub Pages it silently rendered without
  the seal. It now resolves under the base path like every other asset.

### Added

- `tests/node-render.test.ts` runs under the plain Node environment (no
  window, no document) and renders the fixture letter to PDF and DOCX,
  the I-Type cover with its seal, and both official-form fills from disk.
  A hidden browser dependency in a pipeline fails here before it fails in
  the companion.
- `tests/assets.test.ts` pins the seam contract: leading-slash tolerance,
  fetch fallback under the base path, error text, and the optional loader.

## [0.4.7] - 2026-09-05

Security review. `npm audit` reports zero advisories in both trees and
CodeQL reports no alerts on the code it scans. The changes below close
the gaps the review found in the inputs the app accepts and in the
supply chain around the build. No user-visible change.

### Changed

- Share links are shape-checked before anything reaches the editor. A
  `?share=` link is attacker-constructable and an `#es=` payload is only
  as trustworthy as the password holder; both now pass through a zod
  schema which requires every field the app iterates or indexes to be
  the type it expects. A failing payload is reported as damaged.
- Every third-party GitHub Action is pinned to a full commit SHA with
  its version noted, and a test keeps it that way, along with declared
  permissions on every workflow and no `pull_request_target`.
- Dependabot files weekly grouped updates for npm (minor and patch, with
  the two deliberate exact pins excluded) and for GitHub Actions.
- CI and the documented minimum move to Node.js 22. Node 20 reached end
  of life in April 2026 and the runner had started warning on it.
- `SECURITY.md` no longer cites the two postcss findings which the 0.2.0
  lockfile refresh cleared.

## [0.4.6] - 2026-09-05

Editor commit timing. No change to any document's content.

### Fixed

- Leaving a field or a paragraph editor now commits its text to the
  document at once. Both editors debounce their commit by 500 ms while
  typing; before this, an export or save issued inside that window read
  the previous text. Seen as a CI failure (run 149) where a fast runner
  exported a letter with an empty body, and reproducible by a user who
  types and exports within half a second.

## [0.4.5] - 2026-09-05

Phases B.5 and B.6 of `docs/HARDENING_PLAN_2026-09.md`: the military
dictionary on demand, and the bundle budgets re-measured. No
user-visible change beyond timing. First-load JavaScript drops from
2,655,337 B to 2,553,227 B.

### Changed

- `validateAcronyms` takes the military dictionary as an optional
  argument instead of importing the 148 KB table. Detection is
  unchanged without it; the dictionary only adds the suggested
  expansion to each warning. `runLetterValidators` accepts it through
  a new options argument.
- The page fetches the dictionary once there is body text to scan,
  through `useMilitaryDictionary(enabled)`, and the compliance issues
  re-derive when it arrives. The proofread report and the export gate
  run without it and list the same acronyms, unsuggested.
- Deploy's initial-load budget lowered to 2,810,000 B. The total budget
  stays at 7,490,000 B against 6,887,587 B measured.
- The smoke test's first-load marker check now covers the dictionary
  alongside pdf-lib and jszip.

## [0.4.4] - 2026-09-05

Phase B.4 of `docs/HARDENING_PLAN_2026-09.md`: pdf-lib out of the
initial load. No user-visible change. First-load JavaScript drops from
3,139,817 B to 2,655,337 B.

### Changed

- The enclosure row model, the file reader and the merge schedule live
  in `src/lib/enclosure-rows.ts`, which has no pdf-lib dependency. The
  page and the Enclosures section import that module; the pdf-lib merge
  in `enclosure-attachments.ts` is loaded on demand at export time, as
  it already was at its three call sites.
- jszip loads with the first batch run instead of with the page.
- Deploy's initial-load budget lowered to 2,920,000 B (measured plus
  ten percent). The total budget is unchanged.
- The smoke test asserts that no chunk referenced by `index.html`
  carries pdf-lib or jszip, and that both still exist in a lazy chunk.

## [0.4.3] - 2026-09-05

Phases A.5 and A.6 of `docs/HARDENING_PLAN_2026-09.md`: the dependency
warnings and the memoization warnings. No user-visible change. Lint
warnings 14 to 0.

### Changed

- New `useLatestRef` hook (`src/hooks/useLatestRef.ts`): a ref holding
  the value from the latest commit, for effects which keep a fixed
  schedule but read current props. AMHSEditor uses it so the DTG is
  generated once at first load and never refilled under the user's
  cursor when the field is cleared or the callback prop changes.
- `getUiCitation` and `validateParagraphNumbering` are pure module
  functions exported from `src/hooks/useParagraphs.ts`; the hook still
  returns them under the same names. With them out of the closure the
  React Compiler compiles the hook, which removes the five memoization
  warnings as well.
- `templateMatches` is the pure, exported filter behind `useTemplates`.
- ITypePreview memoises its Components Affected row source so the
  cover and overflow lists key on a stable input.
- page.tsx lists the two dependencies its callbacks already read.

### Removed

- DistributionSection's initialise-if-undefined mount effect. Its only
  parent always passes a distribution object, so it never ran.

## [0.4.2] - 2026-09-05

Phase A.4 of `docs/HARDENING_PLAN_2026-09.md`: async loads and one-time
initialisation. No user-visible change. Lint warnings 24 to 14, and the
`set-state-in-effect` rule reaches zero.

### Changed

- New `useSyncedUpdate` in `src/hooks/useSyncedState.ts`: runs a callback
  during the render in which a source value changes, for state the
  component owns but a single `useSyncedState` cannot hold. Used for
  today's date (applied on the first client render, gated by
  `useHydrated` so the prerendered markup still matches), the profile
  defaults once the profile loads, the reports-to-admin-subsection sync,
  and the legacy level 0 paragraph migration.
- `useShareLinkLoader` reads the inbound link (EDMS handoff, encrypted
  fragment, legacy share param, in that order) once on the first client
  render. The EDMS latch, callback and hash clear stay in an effect
  which runs once per link.
- `useSpellCheck` clears its issue list in the render where the text
  empties or the check is disabled, and keeps the previous list while
  text is edited until the debounced check replaces it, as before.
- `useVoiceInput` creates one speech recogniser on the first mic press
  and reads the latest paragraphs and update callback through refs. The
  previous version created a recogniser at mount and another each time
  the update callback changed identity.
- Page 11 remarks: the template list loads from the button which opens
  the picker instead of an effect watching the open flag. A failed load
  still toasts and retries on the next open.
- The smoke test asserts the exported letter carries the run date in
  navy format, so a build-time date baked into the export fails CI.

### Removed

- A write-only EDMS context state in `page.tsx` whose value was never
  read.

## [0.4.1] - 2026-09-05

Phase A.3 of `docs/HARDENING_PLAN_2026-09.md`: state reset when an input
changes. No user-visible change. Lint warnings 31 to 24.

### Changed

- PageCountIndicator, DocumentImportModal and RevisionCompareDialog reset
  their local state during render through `useSyncedState`, keyed on the
  preview URL, the parse result and the dialog phase, instead of in an
  effect after the first paint. The revision dialog keeps its
  two-most-recent default once per open and re-arms it on close.
- ShareLinkDialog and GunnyBotSettings derive the EDMS lock and the saved
  proxy URL from `useHydrated`, so the first client render already shows
  the locked state. The GunnyBot mount effect now holds only the store
  side effects (provider, model, key presence) and no local state.
- SignaturePlacementModal is a wrapper plus a body. The body is remounted
  by key on every open and whenever the last letter page changes while
  open, so page, boxes and selection start fresh without an effect. The
  preview object URL is created once per blob in the wrapper and revoked
  when the blob changes or the modal unmounts.

### Added

- Component tests for all six dialogs and indicators above
  (`tests/components/*-dialog.test.tsx`, `page-count-indicator`,
  `signature-placement-modal`) plus an EDMS case for GunnyBotSettings.

## [0.4.0] - 2026-09-05

Phase B.1 of `docs/HARDENING_PLAN_2026-09.md`: the letterhead seals leave
the JavaScript bundle. Same pixels, same PDF and DOCX output.

### Changed

- The DoD and Navy seals are static files under `public/seals/`,
  byte-identical to the base64 data they replace, fetched on first use and
  cached (`src/lib/seal-assets.ts`). The PDF path still receives a data
  URL and the DOCX path an ArrayBuffer, both from one shared byte load per
  seal. The service worker serves them under its network-first stable-asset
  rule, so offline export keeps working after the first load.
- Total JavaScript shipped: 10,654,691 B to 6,809,010 B. Initial load is
  unchanged at 3,138,848 B. The seal transfer itself shrinks from 3.85 MB
  of base64 text to 2.9 MB of PNG, decoded once by the browser.
- Deploy's total-JS budget lowered to 7,490,000 B (measured plus ten
  percent). The initial-load budget is unchanged.
- The smoke test now asserts the exported letter carries an image
  XObject, so a broken seal fetch fails CI as a missing image and as a
  same-origin 4xx.

### Removed

- `src/lib/dod-seal-data.ts`, the 3.85 MB base64 module.

## [0.3.4] - 2026-09-05

Phase B.3 of `docs/HARDENING_PLAN_2026-09.md`: dependency hygiene. No
runtime change; the bundler already tree-shook the removed packages.

### Removed

- `recharts`, `file-saver` (and `@types/file-saver`), and
  `embla-carousel-react` from the dependency tree. Nothing under `src/`
  imported them; the carousel component which used embla went in 0.3.2.

### Changed

- `autoprefixer`, `postcss`, `tailwindcss`, and `tailwindcss-animate` moved
  to devDependencies. They run at build time only. The production SBOM
  now lists 232 components instead of 340, so the supply-chain surface
  reported to reviewers matches what the app ships.

## [0.3.3] - 2026-09-05

Phase A.7 of `docs/HARDENING_PLAN_2026-09.md`: the four image lint
warnings. Lint baseline 35 to 31. No runtime change.

### Changed

- The two `<img>` elements (header seal, I-type seal preview) carry a
  documented `no-img-element` disable: the export runs with
  `images.unoptimized`, so `next/image` would render the same element with
  no optimisation.
- `jsx-a11y/alt-text` is switched off for `src/components/pdf/**`: it
  matched @react-pdf's `Image` drawing primitive by name, which has no alt
  prop. The PDFs are untagged either way (SECTION_508_FINDINGS F1).

## [0.3.2] - 2026-09-05

Phase A.2 of `docs/HARDENING_PLAN_2026-09.md`: mount and media flags. No
user-visible change. Lint warnings 41 to 35.

### Changed

- New `useHydrated` hook (`src/hooks/useHydrated.ts`): false on the server
  and hydration render, true from the first client render, through
  `useSyncExternalStore`. Replaces the mounted-flag effect in ThemeToggle
  and gates the browser-only reads in DisclaimerModal (stored
  acknowledgement) and PlatformSettings (parked install prompt, standalone
  display mode), which now derive through `useSyncedState` and stay
  settable by their handlers.
- `useIsMobile` rewritten on `useSyncExternalStore` with a matchMedia
  subscription; same values, read during render.
- GuidanceDialog preselects the active document type through
  `useSyncedState` keyed on open state and type, instead of an effect.

### Removed

- `src/components/ui/carousel.tsx`, an unused shadcn component carrying
  one of the warnings. Nothing imported it.

## [0.3.1] - 2026-09-05

Phase A.1 of `docs/HARDENING_PLAN_2026-09.md`: derived state mirrored from
props. No user-visible change. Lint warnings 51 to 41.

### Changed

- New `useSyncedState` hook (`src/hooks/useSyncedState.ts`): local state
  which re-derives from a source value whenever the source changes
  identity, done during render rather than in a post-commit effect. Same
  observable behaviour as the `useEffect(() => setFlag(derive(source)))`
  pattern it replaces, minus the extra render and the first-paint flash.
- Ten effects replaced with it: the show/hide flag in ReferencesSection,
  ViaSection, CopyToSection, EnclosuresSection, ManualDistributionSection
  and ClosingBlockSection, and the visible-row count in the NAVMC 10922
  dependent and dissolution sections and the NAVMC 10132 offense and
  victim sections.
- Stateful component tests (`tests/components/list-sections-stateful.test.tsx`)
  pin the radio-and-list interplay in a parent holding real state, so the
  quirks of the old behaviour (clearing the only typed entry collapses the
  section, a form clear collapses a manually opened one) are kept on
  purpose.

## [0.3.0] - 2026-09-05

Phase 0 of `docs/HARDENING_PLAN_2026-09.md`: the safety net every later
refactor and bundle change runs behind.

### Added

- Browser smoke test on the built static export (`tests/e2e/smoke.spec.ts`,
  Playwright). Loads the app with zero console errors and zero same-origin
  4xx responses, types a basic letter and exports it as PDF and DOCX with
  the subject verified in both files, and exports an AA Form through the
  official NAVMC 10274 form path. Runs in CI after the build.
- Lint ratchet (`scripts/lint-ratchet.mjs`, `.lint-baseline.json`). CI
  fails when any rule's warning count rises above the committed baseline.
- Coverage floor (`npm run test:coverage`) with thresholds in
  `vitest.config.ts` set just below the measured baseline.
- Bundle report (`scripts/bundle-report.mjs`) splitting initial-load from
  lazy JavaScript. Deploy enforces both an initial-load and a total budget.
- Forty component tests pinning the show/hide and row-collapse behaviour
  of the nine sections Phase A.1 will refactor.

### Fixed

- The header seal requested `/logo.png` at the origin root on first paint
  and only corrected the path in an effect, a live 404 on GitHub Pages.
  The base path is now inlined at build time so the first request is
  right. Caught by the new smoke test. One lint warning fewer.

## [0.2.0] - 2026-09-05

First versioned release. Baseline established by the DonDocs comparison audit
in `docs/DONDOCS_COMPARISON_2026-09-05.md`.

### Added

- Pre-export sensitive-data check. Every PDF, DOCX, official-form, and batch
  ZIP download scans for SSN and EDIPI patterns and PHI keyword clusters and
  prompts for acknowledgement before the file is written
  (`src/lib/export-gate.ts`, `src/components/ExportScanGate.tsx`).
- Versioning. `CHANGELOG.md`, semantic version in `package.json`, a release
  workflow creating a GitHub release on version bump, and the running
  version shown in the app's Privacy and Security Notice.
- CI gates. `npm audit --omit=dev --audit-level=high` on every test run.
  Deploy now waits on a validated SBOM, asserts no test file reaches the
  static export, and enforces a bundle-size budget on `out/_next/static`.

### Changed

- README now states the GunnyBot data flow next to the local-first claim
  instead of only in `SECURITY.md`, corrects the document-type count to 27,
  and replaces the stale zero-vulnerability claim with the CI audit gate.
- `docs/COMPLIANCE.md` no longer cites git tags lost in the 2026-07-15
  history reset.
- `docs/README.md` rewritten as an index. Package name is now `semperscribe`.
- `tests/golden/page-parity.test.ts` skips with a loud message when
  LibreOffice is absent outside CI. On CI, or when `SOFFICE_PATH` is set, a
  missing binary still fails. When `soffice` runs but writes no PDF (Writer
  module not installed), the failure now quotes the converter's output
  instead of a bare file-not-found.

### Fixed

- One high-severity advisory (browserslist) and two lower advisories in the
  production dependency tree, via lockfile refresh.
- Two unused eslint-disable directives.

## [0.1.0] - 2026-07-15

Unversioned baseline at the start of the DonDocs parity program. See
`docs/DONDOCS_PARITY_PLAN.md` and `docs/USER_DRIVEN_ROADMAP.md` for the
feature history before this changelog existed.
