# How-To Videos in Semper Scribe, Design Spec

Date: 2026-11-13
Status: Approved design, pre-implementation. Every section below was approved by Stephen in session on 2026-11-13.
Type: Architectural. New data module, new components, entry points in four existing surfaces.

## 1. Purpose

Link the 32 Semper Scribe how-to videos hosted on MarineNet from inside the app, in two places:

- On the active document type, so a user sees the matching video while working.
- In a full library, so a user reviews every video in a set order.

The app links to MarineNet only. It embeds nothing, hosts nothing, and makes no network call of its own.

## 2. Hard constraint: minimal UI change

The 32 videos were recorded on 2026-11-10 through 2026-11-12 against the current UI. Every existing control, label, layout and order stays as it is today. This feature adds elements only:

- One "Watch how-to" row inside the existing document header card.
- One "How-to videos" item in the Actions menu, next to "Correspondence Guide".
- One matching item in the command palette.
- Video rows inside existing GuidanceDialog entries.
- One new dialog, the library.

Sidebar.tsx is not edited. No existing component changes its rendering for users who never use the feature, except the added header row.

## 3. Source data

- Database: vanguard.db (SQLite) at D:\Videos\Video Database\Video Database\data\, table `assets`, `Series = 'Semper Scribe'`, rows 1248 to 1279.
- Extract: D:\Videos\semperscribe-videos.json, produced 2026-11-13, read from a copy of the database.
- 32 videos, all with a MarineNet URL. The Unit Punishment Book (NAVMC 10132) URL was added to the database on 2026-11-14 (Id=101614637C29).
- Every URL has the form `https://portal.mcele.usmc.mil/content/mcele-portal/en/media/detail.html?Id=<12 hex>`. No session or token parameters were present. No URL was altered.
- The database holds no duration, topic or sequence field. The app shows no duration (decided).

### 3.1 Known defects in the source text (not shipped)

The MarineNet Description field cites wrong regulations: "MCO 50216.20" (Staffing Papers), "MCO 50215.1" (Orders and Bulletins, Volumes and Technical Publications), and MCO 1500.61 for change transmittals. The app does not display the MarineNet descriptions. Correct them on the portal separately.

Summaries come from the stored YouTube description instead (the sentence after "We cover N steps."), with text-to-speech spellings restored: "Vee-uh" to "Via", "seck nav" to "SECNAV", "eye type" to "I-Type", "gen AI dot mil" to "GenAI.mil". The UPB has no YouTube description, so its summary uses the "Key areas" list from its MarineNet description.

## 4. Data module

### 4.1 src/lib/document-groups.ts (new)

Mirrors the sidebar's grouping as data, in sidebar order. Sidebar.tsx keeps its own JSX and does not import this file. A drift test (section 8) keeps the two identical.

| Order | Key | Label | Type ids, in sidebar order |
|---|---|---|---|
| 1 | `standard-letter` | Standard Letter | `basic`, `multiple-address`, `endorsement` |
| 2 | `memorandums` | Memorandums | `mfr`, `from-to-memo`, `letterhead-memo`, `moa`, `mou` |
| 3 | `staffing-papers` | Staffing Papers | `information-paper`, `position-paper`, `decision-paper`, `coordination-page` |
| 4 | `external-executive` | External & Executive | `business-letter`, `executive-correspondence` |
| 5 | `dla-correspondence` | DLA Correspondence | `dla-memorandum`, `dla-business-letter` |
| 6 | `directives` | Directives | `mco`, `bulletin`, `volume`, `secnav-instruction`, `secnav-notice`, `change-transmittal` |
| 7 | `forms` | Forms | `aa-form`, `page11`, `navmc10922`, `navmc10132`, `navmc11106`, `dd368`, `tla-packet` |
| 8 | `counseling-worksheets` | Counseling Worksheets | `counseling` |
| 9 | `technical-publication` | Technical Publication | `i-type` |
| 10 | `amhs` | AMHS Message | `amhs` |

AMHS Message renders in the sidebar as a standalone button after the accordion, not as an accordion group. It is listed here as group 10 so every sidebar type has a group. `change-transmittal` joined the Directives group in main PR #165 (2026-11-14).

### 4.2 src/lib/how-to-videos.ts (new)

```ts
export type FeatureGroup = 'getting-started' | 'check-export-share' | 'power-tools';

export interface HowToVideo {
  id: string;              // slug from the extract, unique
  title: string;
  url: string | null;      // null renders "Coming soon"
  summary: string;         // one plain sentence, no regulation citations
  documentTypes: string[]; // registry ids, primary first, [] for feature videos
  group?: FeatureGroup;    // set only for the three hand-placed groups
}
```

Exports: `HOW_TO_VIDEOS`, `videosForType(typeId)`, `libraryGroups()`, `validateVideoCatalog(videos, registryIds, sidebarGroups)`.

Placement rule:

1. If `group` is set, the video goes in that feature group.
2. Otherwise it goes in the sidebar group containing the first of its `documentTypes` ids found in any sidebar group.
3. Within a document group, videos sort by the sidebar position of that id.
4. Document groups with no videos are omitted from the library.
5. A contextual header row lists every video whose `documentTypes` contains the active type, whatever library group the video sits in.

Library order: Getting Started, then the document groups in sidebar order, then Check, Export, and Share, then Power Tools.

## 5. Catalog (all 32, in library order)

### Getting Started

| id | Title | documentTypes | Summary |
|---|---|---|---|
| `what-it-is-and-what-it-is-not` | What It Is and What It Is Not | none | The first screen, what the app does, where your work lives, and what it is not. |
| `install-it-and-work-offline` | Install It and Work Offline | none | Install it, open it, work offline, then move faster with the command palette. |
| `set-up-your-profile` | Set Up Your Profile | none | Open Settings, fill your profile, then set your formatting defaults. |
| `your-first-basic-letter` | Your First Basic Letter | `basic` | Start the letter, fill the header, then check and export it. |

### Standard Letter

| id | Title | documentTypes | Summary |
|---|---|---|---|
| `references-enclosures-and-via` | References, Enclosures, and Via | `basic` | Via, then references, then enclosures. |
| `multiple-address-letters` | Multiple-Address Letters | `multiple-address` | Open the form, build the To block, then finish the closing block and export. |
| `endorsements` | Endorsements | `endorsement` | Start the endorsement, identify the basic letter, continue the numbering, and add an endorsement on the same page. |

### Memorandums

| id | Title | documentTypes | Summary |
|---|---|---|---|
| `memorandums` | Memorandums | `mfr`, `from-to-memo`, `letterhead-memo` | Choose the format, then build a Memorandum for the Record, a From-To Memorandum, and a Letterhead Memorandum. |
| `agreements-and-understandings` | Agreements and Understandings | `moa`, `mou` | Choose MOA or MOU, name the two activities, finish the starter paragraphs, then check the signatures and export. |

### Staffing Papers

| id | Title | documentTypes | Summary |
|---|---|---|---|
| `staffing-papers` | Staffing Papers | `information-paper`, `position-paper`, `decision-paper`, `coordination-page` | The Information Paper, the Position Paper, the Decision Paper, and the Coordination Page. |

### External & Executive

| id | Title | documentTypes | Summary |
|---|---|---|---|
| `business-and-executive-correspondence` | Business and Executive Correspondence | `business-letter`, `executive-correspondence`, `dla-memorandum`, `dla-business-letter` | The Business Letter, Executive Correspondence, and the two Defense Logistics Agency formats. |

### Directives

| id | Title | documentTypes | Summary |
|---|---|---|---|
| `orders-and-bulletins` | Orders and Bulletins | `mco`, `bulletin` | Choose the directive, fill the order header, set the directive options, write the body, then build a bulletin. |
| `volumes-and-technical-publications` | Volumes and Technical Publications | `volume`, `i-type` | Set up the volume, build its chapters, fill the I-Type header, then set its distribution and control. |
| `change-transmittals-and-secnav-directives` | Change Transmittals and SECNAV Directives | `change-transmittal`, `secnav-instruction`, `secnav-notice` | Open a change transmittal, fill its change details, build a SECNAV instruction, then build a SECNAV notice. |

### Forms

| id | Title | documentTypes | Summary |
|---|---|---|---|
| `the-aa-form-navmc-10274` | The AA Form (NAVMC 10274) | `aa-form` | Open the form, fill the AA header, start from a template, finish the letter, then check and export. |
| `page-eleven-entries-navmc-118-11` | Page Eleven Entries (NAVMC 118(11)) | `page11` | Open the form, load an entry, fill the blanks, add a second entry, then export. |
| `dependency-applications-navmc-10922` | Dependency Applications (NAVMC 10922) | `navmc10922` | Set the reason, fill the Marine's data, list the dependents, complete section seven, then load a template and export. |
| `the-unit-punishment-book-navmc-10132` | The Unit Punishment Book (NAVMC 10132) | `navmc10132` | Start the case, offenses and authority, rights advisement. |
| `cola-applications-navmc-11106` | COLA Applications (NAVMC 11106) | `navmc11106` | Check Part A, fill Part B, list dependents in Part C, handle Part D, then load a template and export. |
| `conditional-release-dd-368` | Conditional Release (DD 368) | `dd368` | Fill section one, the recruiter block, section two, sections three and four, then load the template and export. |
| `tla-packets` | TLA Packets | `tla-packet` | Enter the Marine and the order, set the request, log the lodging, add the supporting entries, then use a template. |

### Counseling Worksheets

| id | Title | documentTypes | Summary |
|---|---|---|---|
| `counseling-worksheets` | Counseling Worksheets | `counseling` | Set the occasion, record who, walk the functional areas, set targets, then close and record. |

### AMHS Message

| id | Title | documentTypes | Summary |
|---|---|---|---|
| `amhs-messages` | AMHS Messages | `amhs` | Set the date time group and message type, fill the header and references, add points of contact and text, then copy or export. |

### Check, Export, and Share

| id | Title | documentTypes | Summary |
|---|---|---|---|
| `check-before-you-export` | Check Before You Export | none | Compliance Issues, Proofread, Find and Replace, and Compare Revisions. |
| `classification-markings-and-cui` | Classification Markings and CUI | none | Turn on markings, fill the CUI block, add portion marks, see the training levels, and check the output. |
| `export-pdf-and-word` | Export PDF and Word | none | Export a PDF, export a Word document, then handle the sensitive data check. |
| `share-review-and-sign` | Share, Review, and Sign | none | Make a protected link, see what the reviewer sees, add comments, place signature fields, and send the signature request. |
| `assemble-a-package` | Assemble a Package | none | Save the parts, add them in order, measure the pages, and export the package. |
| `batch-generate` | Batch Generate | none | Pick the fields, fill the roster, check the preview, and generate the files. |

### Power Tools

| id | Title | documentTypes | Summary |
|---|---|---|---|
| `import-any-old-letter` | Import Any Old Letter | none | Import a Word or PDF file, check what it read, paste text, start from a template, and reopen a data package. |
| `never-lose-a-draft` | Never Lose a Draft | none | Save a draft, use the document library, compare and restore, recover unsaved work, and back up off the browser. |
| `gunnybot` | GunnyBot | none | What it is, the setup, the proxy for GenAI.mil, and where it shows up in the app. |

Notes:
- Your First Basic Letter carries `basic` for its header link and `group: 'getting-started'` for its library place.
- Change Transmittals places in Directives through `change-transmittal` (sixth in that group since main PR #165).
- Volumes and Technical Publications places in Directives through `volume`. Its `i-type` id gives the I-Type header its link. The Technical Publication group holds no video and is omitted from the library.
- Business and Executive Correspondence places in External & Executive. Its DLA ids give both DLA headers their link. The DLA Correspondence group is omitted from the library.
- The same-page endorsement is the `endorsement` type with a placement field, so it shows the Endorsements video.
- All 32 registry ids have at least one video today.

## 6. Components and placement

New files:

- `src/components/videos/LoginRequiredBadge.tsx` renders lucide `LockKeyhole` and `ExternalLink` with the text "MarineNet login". The icons are `aria-hidden`. The badge uses theme tokens, so light and dark themes follow automatically.
- `src/components/videos/VideoLink.tsx` renders one row: title, summary, badge. The anchor uses `target="_blank"` and `rel="noopener noreferrer"`. Its accessible name reads "Watch <title> on MarineNet, login required, opens in a new tab". It renders the coming-soon and offline states (section 7) as text with no anchor.
- `src/components/videos/HowToVideosDialog.tsx` is the library, built from the same Dialog parts as GuidanceDialog. The header line reads "Each video opens on MarineNet in a new tab. Log in to watch." No search.
- `src/hooks/useOnlineStatus.ts` returns `navigator.onLine` through `useSyncExternalStore`, subscribed to the `online` and `offline` window events.

Entry points:

- DocumentLayout.tsx, the document header card: a "Watch how-to" row under the type description, listing `videosForType(activeType)`. The row is omitted when the list is empty or every entry lacks a URL.
- GuidanceDialog.tsx: the same rows under each entry's example.
- HeaderActions.tsx: a "How-to videos" item next to "Correspondence Guide", wired through ModernAppShell.tsx.
- CommandPalette.tsx: a matching item.
- page.tsx: a `showVideos` state, the same pattern as `showGuidance`.

## 7. Behavior

- Click: MarineNet opens in a new tab. The draft stays in the original tab. The app makes no request: no click tracking, no prefetch, no link check.
- Offline: when `useOnlineStatus` reports offline, each row renders as text reading "Needs a network connection", with no anchor. The library and the header row still render. Known limit: `navigator.onLine` reports a network connection, not MarineNet reachability. A captive portal or a blocked network reads as online, and the failure shows in the new tab. Probing reachability would mean a network call from the app, which this design forbids.
- Missing URL (no video today, kept for future entries): the library row reads "Coming soon" with no anchor. That type's header shows no row. Adding the URL to the data file restores both.
- CSP: no change. A new-tab navigation is not governed by the page CSP, and no remote image loads.

## 8. Testing

### 8.1 Unit tests (Vitest), with positive and negative controls

`validateVideoCatalog` returns a list of errors. The production catalog returns none. Each negative control feeds a broken copy and asserts the matching error appears.

| Check | Negative control |
|---|---|
| 32 entries, unique ids, unique non-null URLs | a duplicated id, a duplicated URL |
| URL null or exactly the portal pattern with a 12-hex Id and no other parameter | `&token=x` appended, `http://` scheme, a foreign host |
| every `documentTypes` id exists in `DOCUMENT_TYPES` | `not-a-type` |
| every video placed in exactly one library group, 32 in total | no `group` and an empty `documentTypes` |
| no summary contains a regulation citation (`MCO` followed by a number, `M-5216`) | summary "per MCO 50216.20" |

A non-failing report lists registry types with no video. It is empty today.

### 8.2 Sidebar drift test (Vitest)

Reads Sidebar.tsx as text, extracts the `AccordionItem value` keys and the `handleSelect('<id>')` calls in source order plus the standalone AMHS button, and asserts they equal `document-groups.ts` in keys, membership and order. Negative control: the same parser run on a fixture copy with two type ids swapped must report a mismatch.

### 8.3 End-to-end tests (Playwright, against serve-out.mjs with the cloud.gov headers)

- Endorsement header: link present, correct href, `target="_blank"`, `rel="noopener noreferrer"`.
- NAVMC 10132 header: link present with the UPB URL.
- Actions menu, How-to videos: group headings in the order of section 5, 32 rows, every row an anchor.
- Coming-soon state: covered by a unit test on `VideoLink` with `url: null`, since no production entry lacks a URL.
- `context.setOffline(true)`: rows read "Needs a network connection" and contain no anchor.
- Sidebar screenshot compared to a baseline captured before the change: no pixel difference.
- No CSP violation in the console for the whole run.

### 8.4 Live verification in Chrome

On Stephen's dev server (`npm run dev`, started by Stephen at the start of the phase): screenshots in light and dark themes of the Basic Letter, Same-Page Endorsement and NAVMC 10132 headers, and of the library.

### 8.5 Gates

Typecheck, lint, the full Vitest suite and the Playwright suite pass before the diff goes to Stephen. No write to the tree without his approval of the diff.

## 9. Out of scope

- Durations.
- Search in the library.
- "Watch how-to" buttons inside feature dialogs (Export, Share, Package). Candidate for a second pass.
- Changes to Sidebar.tsx.
- Correcting the MarineNet descriptions (portal-side task, section 3.1).

## 10. Open items

- Stephen confirms one URL opens the intended video after login before release (host is the MCELE portal, not a marinenet domain).
