# How-To Videos Implementation Plan

> For agentic workers: REQUIRED SUB-SKILL: use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task by task. Steps use checkbox (`- [ ]`) syntax for tracking.

Goal: link the 32 Semper Scribe MarineNet how-to videos from the active document header, GuidanceDialog, and a new library dialog, with no change to any existing control.

Architecture: a static typed catalog (`src/lib/how-to-videos.ts`) plus a data copy of the sidebar grouping (`src/lib/document-groups.ts`) guarded by a text-parsing drift test. Four small client components render rows. Entry points are additive edits to DocumentLayout, GuidanceDialog, HeaderActions, ModernAppShell, CommandPalette and page.tsx.

Tech stack: Next.js 16 static export, React 19, TypeScript, Tailwind, lucide-react, Vitest 4 with Testing Library (jsdom), Playwright against `out/`.

Spec: docs/superpowers/specs/2026-11-13-howto-videos-design.md

## Global constraints

- Sidebar.tsx is not edited. No existing control, label, layout or order changes (spec 2). The videos were recorded against the current UI.
- No network request from the app for videos. No CSP change. Links use `target="_blank"` and `rel="noopener noreferrer"`.
- Every URL matches `^https://portal\.mcele\.usmc\.mil/content/mcele-portal/en/media/detail\.html\?Id=[0-9A-F]{12}$`.
- No regulation citation in any user-facing video text.
- Menu label "How-To Videos" (Title Case, matching "Correspondence Guide"). Command palette label "How-to videos" (sentence case, matching "Correspondence guide").
- If you cannot PROVE a behavior with a test that fails when the behavior is removed, do not write a test that passes anyway. Report it as a named deliverable instead.

---

### Task 1: Sidebar grouping as data, with drift guard [DONE, verified 2026-11-14: 3 tests green incl. 2 negative controls]

Files:
- Create: `src/lib/document-groups.ts`
- Test: `tests/sidebar-groups-drift.test.ts`

Interfaces produced: `interface DocumentGroup { key: string; label: string; typeIds: readonly string[] }`, `const DOCUMENT_GROUPS: readonly DocumentGroup[]`.

`src/lib/document-groups.ts`:

```ts
/**
 * The sidebar's document-type grouping, as data, in sidebar order.
 *
 * Sidebar.tsx keeps its own hand-written JSX and does NOT import this
 * file: the 32 Semper Scribe how-to videos were recorded against the
 * current sidebar (10 to 12 Nov 2026), so its rendering stays
 * byte-for-byte unchanged. tests/sidebar-groups-drift.test.ts reads
 * Sidebar.tsx as text and fails when the two disagree, so this copy
 * cannot drift silently.
 *
 * Groups 1 to 9 are the sidebar accordion items. AMHS Message renders
 * as a standalone button after the accordion and is listed as group 10
 * so every sidebar type has a group. `change-transmittal` has no
 * sidebar entry. The same-page endorsement is a picker option of the
 * `endorsement` type, not a type id, so it is not listed.
 *
 * Spec: docs/superpowers/specs/2026-11-13-howto-videos-design.md 4.1.
 */
export interface DocumentGroup {
  /** The sidebar AccordionItem value, or the type id for a standalone item. */
  key: string;
  /** The sidebar label, verbatim. */
  label: string;
  /** Registry type ids in sidebar order. */
  typeIds: readonly string[];
}

export const DOCUMENT_GROUPS: readonly DocumentGroup[] = [
  { key: 'standard-letter', label: 'Standard Letter', typeIds: ['basic', 'multiple-address', 'endorsement'] },
  { key: 'memorandums', label: 'Memorandums', typeIds: ['mfr', 'from-to-memo', 'letterhead-memo', 'moa', 'mou'] },
  { key: 'staffing-papers', label: 'Staffing Papers', typeIds: ['information-paper', 'position-paper', 'decision-paper', 'coordination-page'] },
  { key: 'external-executive', label: 'External & Executive', typeIds: ['business-letter', 'executive-correspondence'] },
  { key: 'dla-correspondence', label: 'DLA Correspondence', typeIds: ['dla-memorandum', 'dla-business-letter'] },
  { key: 'directives', label: 'Directives', typeIds: ['mco', 'bulletin', 'volume', 'secnav-instruction', 'secnav-notice'] },
  { key: 'forms', label: 'Forms', typeIds: ['aa-form', 'page11', 'navmc10922', 'navmc10132', 'navmc11106', 'dd368', 'tla-packet'] },
  { key: 'counseling-worksheets', label: 'Counseling Worksheets', typeIds: ['counseling'] },
  { key: 'technical-publication', label: 'Technical Publication', typeIds: ['i-type'] },
  { key: 'amhs', label: 'AMHS Message', typeIds: ['amhs'] },
];
```

`tests/sidebar-groups-drift.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DOCUMENT_GROUPS } from '@/lib/document-groups';

/**
 * Drift guard for src/lib/document-groups.ts (spec 2026-11-13 section 8.2).
 *
 * Sidebar.tsx is hand-written JSX and is deliberately NOT refactored to
 * read document-groups.ts (the how-to videos were recorded against it).
 * This parser reads the sidebar source as text and rebuilds the grouping:
 * every `AccordionItem value="..."` opens a group, every
 * `handleSelect('<literal>')` inside the accordion joins the open group,
 * and every `handleSelect('<literal>')` after `</Accordion>` is a
 * standalone group keyed by its own id. `handleSelect(SAME_PAGE_...)`
 * is a picker option, not a type id, and the literal-only regex skips it.
 */
export function parseSidebarGroups(source: string): { key: string; typeIds: string[] }[] {
  const start = source.indexOf('<Accordion');
  const end = source.indexOf('</Accordion>');
  if (start < 0 || end < 0 || end < start) throw new Error('Sidebar accordion not found');
  const groups: { key: string; typeIds: string[] }[] = [];
  const token = /AccordionItem value="([a-z0-9-]+)"|handleSelect\('([a-z0-9-]+)'\)/g;
  for (const m of source.slice(start, end).matchAll(token)) {
    if (m[1]) groups.push({ key: m[1], typeIds: [] });
    else if (m[2]) {
      if (groups.length === 0) throw new Error(`handleSelect('${m[2]}') before any AccordionItem`);
      groups[groups.length - 1].typeIds.push(m[2]);
    }
  }
  for (const m of source.slice(end).matchAll(/handleSelect\('([a-z0-9-]+)'\)/g)) {
    groups.push({ key: m[1], typeIds: [m[1]] });
  }
  return groups;
}

const SIDEBAR = readFileSync(join(process.cwd(), 'src/components/layout/Sidebar.tsx'), 'utf8');
const asData = DOCUMENT_GROUPS.map(g => ({ key: g.key, typeIds: [...g.typeIds] }));

describe('document-groups.ts matches Sidebar.tsx', () => {
  it('has the same group keys, members and order as the sidebar', () => {
    expect(parseSidebarGroups(SIDEBAR)).toEqual(asData);
  });

  it('negative control: two swapped type ids are reported as a mismatch', () => {
    const swapped = SIDEBAR
      .replace("handleSelect('mco')", "handleSelect('__TMP__')")
      .replace("handleSelect('bulletin')", "handleSelect('mco')")
      .replace("handleSelect('__TMP__')", "handleSelect('bulletin')");
    expect(swapped).not.toBe(SIDEBAR);
    expect(parseSidebarGroups(swapped)).not.toEqual(asData);
  });

  it('negative control: a type moved to another group is reported as a mismatch', () => {
    const moved = SIDEBAR.replace("handleSelect('mou')", "handleSelect('__X__')");
    expect(parseSidebarGroups(moved)).not.toEqual(asData);
  });
});
```

- [x] Write the test. Run `npx vitest run tests/sidebar-groups-drift.test.ts`, expect FAIL (module missing).
- [x] Create the module. Run again, expect 3 PASS.

### Task 2: Video catalog and validator [DONE, verified 2026-11-14: 16 tests green incl. 8 negative controls]

Files:
- Create: `src/lib/how-to-videos.ts`
- Test: `tests/how-to-videos.test.ts`

Interfaces produced: `type FeatureGroup`, `interface HowToVideo`, `FEATURE_GROUP_LABELS`, `MARINENET_VIDEO_URL`, `HOW_TO_VIDEOS`, `videosForType(typeId, videos?) => HowToVideo[]`, `sidebarPlacement(video, groups?)`, `interface LibraryGroup { key; label; videos }`, `libraryGroups(videos?, groups?) => LibraryGroup[]`, `validateVideoCatalog(videos, registryIds, groups?) => string[]`, `typesWithoutVideo(registryIds, videos?) => string[]`.

`src/lib/how-to-videos.ts`:

```ts
/**
 * The Semper Scribe how-to video catalog: 32 MarineNet videos, linked,
 * never embedded or hosted. The app makes no network call for them.
 *
 * Source: Vanguard video database (vanguard.db, assets table, Series
 * 'Semper Scribe', rows 1248 to 1279), extracted 2026-11-13 and
 * 2026-11-14 to D:\Videos\semperscribe-videos.json.
 *
 * Summaries come from the stored YouTube description, NOT the MarineNet
 * description, because the MarineNet text cites wrong regulations
 * (spec 3.1). No summary may carry a regulation citation;
 * validateVideoCatalog enforces that.
 *
 * Placement (spec 4.2): a video with `group` goes in that feature group.
 * Otherwise it goes in the sidebar group holding the first of its
 * `documentTypes` ids found in DOCUMENT_GROUPS. Its contextual header
 * link shows on every type in `documentTypes`.
 *
 * Spec: docs/superpowers/specs/2026-11-13-howto-videos-design.md.
 */
import { DOCUMENT_GROUPS, type DocumentGroup } from '@/lib/document-groups';

export type FeatureGroup = 'getting-started' | 'check-export-share' | 'power-tools';

export interface HowToVideo {
  /** Slug from the extract, unique. */
  id: string;
  title: string;
  /** MarineNet link. null renders "Coming soon" (no anchor). */
  url: string | null;
  /** One plain sentence, no regulation citations. */
  summary: string;
  /** Registry type ids, primary first. [] for feature videos. */
  documentTypes: readonly string[];
  /** Set only for the three hand-placed feature groups. */
  group?: FeatureGroup;
}

export const FEATURE_GROUP_LABELS: Record<FeatureGroup, string> = {
  'getting-started': 'Getting Started',
  'check-export-share': 'Check, Export, and Share',
  'power-tools': 'Power Tools',
};

/** The only accepted URL form: the MCELE portal detail page, one 12-hex Id, nothing else. */
export const MARINENET_VIDEO_URL =
  /^https:\/\/portal\.mcele\.usmc\.mil\/content\/mcele-portal\/en\/media\/detail\.html\?Id=[0-9A-F]{12}$/;

/** A regulation citation in user-facing text. The MarineNet descriptions carried wrong ones. */
const CITATION = /\bMCO\s*\d|\bM-5216\b|\bSECNAV\s*M-\d/i;

export const HOW_TO_VIDEOS: readonly HowToVideo[] = [
  {
    id: "what-it-is-and-what-it-is-not",
    title: "What It Is and What It Is Not",
    url: "https://portal.mcele.usmc.mil/content/mcele-portal/en/media/detail.html?Id=1015957C256C",
    summary: "The first screen, what the app does, where your work lives, and what it is not.",
    documentTypes: [],
    group: 'getting-started',
  },
  {
    id: "install-it-and-work-offline",
    title: "Install It and Work Offline",
    url: "https://portal.mcele.usmc.mil/content/mcele-portal/en/media/detail.html?Id=101461486EE1",
    summary: "Install it, open it, work offline, then move faster with the command palette.",
    documentTypes: [],
    group: 'getting-started',
  },
  {
    id: "set-up-your-profile",
    title: "Set Up Your Profile",
    url: "https://portal.mcele.usmc.mil/content/mcele-portal/en/media/detail.html?Id=101533B3FC88",
    summary: "Open Settings, fill your profile, then set your formatting defaults.",
    documentTypes: [],
    group: 'getting-started',
  },
  {
    id: "your-first-basic-letter",
    title: "Your First Basic Letter",
    url: "https://portal.mcele.usmc.mil/content/mcele-portal/en/media/detail.html?Id=10160A971FB7",
    summary: "Start the letter, fill the header, then check and export it.",
    documentTypes: ["basic"],
    group: 'getting-started',
  },
  {
    id: "references-enclosures-and-via",
    title: "References, Enclosures, and Via",
    url: "https://portal.mcele.usmc.mil/content/mcele-portal/en/media/detail.html?Id=1015208950CB",
    summary: "Via, then references, then enclosures.",
    documentTypes: ["basic"],
  },
  {
    id: "multiple-address-letters",
    title: "Multiple-Address Letters",
    url: "https://portal.mcele.usmc.mil/content/mcele-portal/en/media/detail.html?Id=1014817F20C3",
    summary: "Open the form, build the To block, then finish the closing block and export.",
    documentTypes: ["multiple-address"],
  },
  {
    id: "endorsements",
    title: "Endorsements",
    url: "https://portal.mcele.usmc.mil/content/mcele-portal/en/media/detail.html?Id=101429EA6E04",
    summary: "Start the endorsement, identify the basic letter, continue the numbering, and add an endorsement on the same page.",
    documentTypes: ["endorsement"],
  },
  {
    id: "memorandums",
    title: "Memorandums",
    url: "https://portal.mcele.usmc.mil/content/mcele-portal/en/media/detail.html?Id=10147683EE7D",
    summary: "Choose the format, then build a Memorandum for the Record, a From-To Memorandum, and a Letterhead Memorandum.",
    documentTypes: ["mfr", "from-to-memo", "letterhead-memo"],
  },
  {
    id: "agreements-and-understandings",
    title: "Agreements and Understandings",
    url: "https://portal.mcele.usmc.mil/content/mcele-portal/en/media/detail.html?Id=101318E99E43",
    summary: "Choose MOA or MOU, name the two activities, finish the starter paragraphs, then check the signatures and export.",
    documentTypes: ["moa", "mou"],
  },
  {
    id: "staffing-papers",
    title: "Staffing Papers",
    url: "https://portal.mcele.usmc.mil/content/mcele-portal/en/media/detail.html?Id=101556945F48",
    summary: "The Information Paper, the Position Paper, the Decision Paper, and the Coordination Page.",
    documentTypes: ["information-paper", "position-paper", "decision-paper", "coordination-page"],
  },
  {
    id: "business-and-executive-correspondence",
    title: "Business and Executive Correspondence",
    url: "https://portal.mcele.usmc.mil/content/mcele-portal/en/media/detail.html?Id=101341B8192D",
    summary: "The Business Letter, Executive Correspondence, and the two Defense Logistics Agency formats.",
    documentTypes: ["business-letter", "executive-correspondence", "dla-memorandum", "dla-business-letter"],
  },
  {
    id: "orders-and-bulletins",
    title: "Orders and Bulletins",
    url: "https://portal.mcele.usmc.mil/content/mcele-portal/en/media/detail.html?Id=101500847199",
    summary: "Choose the directive, fill the order header, set the directive options, write the body, then build a bulletin.",
    documentTypes: ["mco", "bulletin"],
  },
  {
    id: "volumes-and-technical-publications",
    title: "Volumes and Technical Publications",
    url: "https://portal.mcele.usmc.mil/content/mcele-portal/en/media/detail.html?Id=101582D4EE0A",
    summary: "Set up the volume, build its chapters, fill the I-Type header, then set its distribution and control.",
    documentTypes: ["volume", "i-type"],
  },
  {
    id: "change-transmittals-and-secnav-directives",
    title: "Change Transmittals and SECNAV Directives",
    url: "https://portal.mcele.usmc.mil/content/mcele-portal/en/media/detail.html?Id=10136710BD87",
    summary: "Open a change transmittal, fill its change details, build a SECNAV instruction, then build a SECNAV notice.",
    documentTypes: ["change-transmittal", "secnav-instruction", "secnav-notice"],
  },
  {
    id: "the-aa-form-navmc-10274",
    title: "The AA Form (NAVMC 10274)",
    url: "https://portal.mcele.usmc.mil/content/mcele-portal/en/media/detail.html?Id=101571A20F29",
    summary: "Open the form, fill the AA header, start from a template, finish the letter, then check and export.",
    documentTypes: ["aa-form"],
  },
  {
    id: "page-eleven-entries-navmc-118-11",
    title: "Page Eleven Entries (NAVMC 118(11))",
    url: "https://portal.mcele.usmc.mil/content/mcele-portal/en/media/detail.html?Id=10151E11C817",
    summary: "Open the form, load an entry, fill the blanks, add a second entry, then export.",
    documentTypes: ["page11"],
  },
  {
    id: "dependency-applications-navmc-10922",
    title: "Dependency Applications (NAVMC 10922)",
    url: "https://portal.mcele.usmc.mil/content/mcele-portal/en/media/detail.html?Id=10141069CAD5",
    summary: "Set the reason, fill the Marine's data, list the dependents, complete section seven, then load a template and export.",
    documentTypes: ["navmc10922"],
  },
  {
    id: "the-unit-punishment-book-navmc-10132",
    title: "The Unit Punishment Book (NAVMC 10132)",
    url: "https://portal.mcele.usmc.mil/content/mcele-portal/en/media/detail.html?Id=101614637C29",
    summary: "Start the case, offenses and authority, rights advisement.",
    documentTypes: ["navmc10132"],
  },
  {
    id: "cola-applications-navmc-11106",
    title: "COLA Applications (NAVMC 11106)",
    url: "https://portal.mcele.usmc.mil/content/mcele-portal/en/media/detail.html?Id=101352D3BC3A",
    summary: "Check Part A, fill Part B, list dependents in Part C, handle Part D, then load a template and export.",
    documentTypes: ["navmc11106"],
  },
  {
    id: "conditional-release-dd-368",
    title: "Conditional Release (DD 368)",
    url: "https://portal.mcele.usmc.mil/content/mcele-portal/en/media/detail.html?Id=101392B2F344",
    summary: "Fill section one, the recruiter block, section two, sections three and four, then load the template and export.",
    documentTypes: ["dd368"],
  },
  {
    id: "tla-packets",
    title: "TLA Packets",
    url: "https://portal.mcele.usmc.mil/content/mcele-portal/en/media/detail.html?Id=101564695F7F",
    summary: "Enter the Marine and the order, set the request, log the lodging, add the supporting entries, then use a template.",
    documentTypes: ["tla-packet"],
  },
  {
    id: "counseling-worksheets",
    title: "Counseling Worksheets",
    url: "https://portal.mcele.usmc.mil/content/mcele-portal/en/media/detail.html?Id=1014007F158E",
    summary: "Set the occasion, record who, walk the functional areas, set targets, then close and record.",
    documentTypes: ["counseling"],
  },
  {
    id: "amhs-messages",
    title: "AMHS Messages",
    url: "https://portal.mcele.usmc.mil/content/mcele-portal/en/media/detail.html?Id=101306C76C0A",
    summary: "Set the date time group and message type, fill the header and references, add points of contact and text, then copy or export.",
    documentTypes: ["amhs"],
  },
  {
    id: "check-before-you-export",
    title: "Check Before You Export",
    url: "https://portal.mcele.usmc.mil/content/mcele-portal/en/media/detail.html?Id=101376E0170E",
    summary: "Compliance Issues, Proofread, Find and Replace, and Compare Revisions.",
    documentTypes: [],
    group: 'check-export-share',
  },
  {
    id: "classification-markings-and-cui",
    title: "Classification Markings and CUI",
    url: "https://portal.mcele.usmc.mil/content/mcele-portal/en/media/detail.html?Id=10138D79E884",
    summary: "Turn on markings, fill the CUI block, add portion marks, see the training levels, and check the output.",
    documentTypes: [],
    group: 'check-export-share',
  },
  {
    id: "export-pdf-and-word",
    title: "Export PDF and Word",
    url: "https://portal.mcele.usmc.mil/content/mcele-portal/en/media/detail.html?Id=1014397474FD",
    summary: "Export a PDF, export a Word document, then handle the sensitive data check.",
    documentTypes: [],
    group: 'check-export-share',
  },
  {
    id: "share-review-and-sign",
    title: "Share, Review, and Sign",
    url: "https://portal.mcele.usmc.mil/content/mcele-portal/en/media/detail.html?Id=1015437B165B",
    summary: "Make a protected link, see what the reviewer sees, add comments, place signature fields, and send the signature request.",
    documentTypes: [],
    group: 'check-export-share',
  },
  {
    id: "assemble-a-package",
    title: "Assemble a Package",
    url: "https://portal.mcele.usmc.mil/content/mcele-portal/en/media/detail.html?Id=1013214B6342",
    summary: "Save the parts, add them in order, measure the pages, and export the package.",
    documentTypes: [],
    group: 'check-export-share',
  },
  {
    id: "batch-generate",
    title: "Batch Generate",
    url: "https://portal.mcele.usmc.mil/content/mcele-portal/en/media/detail.html?Id=10133E8EA93D",
    summary: "Pick the fields, fill the roster, check the preview, and generate the files.",
    documentTypes: [],
    group: 'check-export-share',
  },
  {
    id: "import-any-old-letter",
    title: "Import Any Old Letter",
    url: "https://portal.mcele.usmc.mil/content/mcele-portal/en/media/detail.html?Id=10145FFD78F2",
    summary: "Import a Word or PDF file, check what it read, paste text, start from a template, and reopen a data package.",
    documentTypes: [],
    group: 'power-tools',
  },
  {
    id: "never-lose-a-draft",
    title: "Never Lose a Draft",
    url: "https://portal.mcele.usmc.mil/content/mcele-portal/en/media/detail.html?Id=1014966BE76E",
    summary: "Save a draft, use the document library, compare and restore, recover unsaved work, and back up off the browser.",
    documentTypes: [],
    group: 'power-tools',
  },
  {
    id: "gunnybot",
    title: "GunnyBot",
    url: "https://portal.mcele.usmc.mil/content/mcele-portal/en/media/detail.html?Id=1014488F2B05",
    summary: "What it is, the setup, the proxy for GenAI.mil, and where it shows up in the app.",
    documentTypes: [],
    group: 'power-tools',
  },];

/** Every video whose `documentTypes` holds the type, in catalog order. */
export function videosForType(typeId: string, videos: readonly HowToVideo[] = HOW_TO_VIDEOS): HowToVideo[] {
  return videos.filter(v => v.documentTypes.includes(typeId));
}

/** Group index and in-group position of the first `documentTypes` id the sidebar lists, or null. */
export function sidebarPlacement(
  video: HowToVideo,
  groups: readonly DocumentGroup[] = DOCUMENT_GROUPS,
): { groupIndex: number; position: number } | null {
  for (const id of video.documentTypes) {
    for (let groupIndex = 0; groupIndex < groups.length; groupIndex++) {
      const position = groups[groupIndex].typeIds.indexOf(id);
      if (position >= 0) return { groupIndex, position };
    }
  }
  return null;
}

export interface LibraryGroup {
  key: string;
  label: string;
  videos: HowToVideo[];
}

/**
 * The library, in order: Getting Started, the sidebar groups in sidebar
 * order, Check, Export, and Share, Power Tools. Empty groups are dropped.
 */
export function libraryGroups(
  videos: readonly HowToVideo[] = HOW_TO_VIDEOS,
  groups: readonly DocumentGroup[] = DOCUMENT_GROUPS,
): LibraryGroup[] {
  const feature = (g: FeatureGroup): LibraryGroup => ({
    key: g,
    label: FEATURE_GROUP_LABELS[g],
    videos: videos.filter(v => v.group === g),
  });
  const documentGroups = groups.map((g, groupIndex): LibraryGroup => ({
    key: g.key,
    label: g.label,
    videos: videos
      .filter(v => !v.group && sidebarPlacement(v, groups)?.groupIndex === groupIndex)
      .sort((a, b) => sidebarPlacement(a, groups)!.position - sidebarPlacement(b, groups)!.position),
  }));
  return [feature('getting-started'), ...documentGroups, feature('check-export-share'), feature('power-tools')]
    .filter(g => g.videos.length > 0);
}

/**
 * Every rule the catalog must satisfy. Returns one message per broken
 * rule; the production catalog returns []. A pure function so the tests
 * can feed it broken copies (negative controls) and prove each rule fires.
 */
export function validateVideoCatalog(
  videos: readonly HowToVideo[],
  registryIds: Iterable<string>,
  groups: readonly DocumentGroup[] = DOCUMENT_GROUPS,
): string[] {
  const errors: string[] = [];
  const registry = new Set(registryIds);
  const ids = new Set<string>();
  const urls = new Set<string>();
  for (const v of videos) {
    if (!v.id || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(v.id)) errors.push(`${v.id}: id is not a lowercase slug`);
    if (ids.has(v.id)) errors.push(`${v.id}: duplicate id`);
    ids.add(v.id);
    if (!v.title.trim()) errors.push(`${v.id}: empty title`);
    if (v.url !== null) {
      if (!MARINENET_VIDEO_URL.test(v.url)) errors.push(`${v.id}: url is not a MarineNet portal detail link: ${v.url}`);
      if (urls.has(v.url)) errors.push(`${v.id}: duplicate url ${v.url}`);
      urls.add(v.url);
    }
    for (const t of v.documentTypes) {
      if (!registry.has(t)) errors.push(`${v.id}: unknown document type "${t}"`);
    }
    if (v.group !== undefined && !(v.group in FEATURE_GROUP_LABELS)) errors.push(`${v.id}: unknown group "${v.group}"`);
    if (v.group === undefined && sidebarPlacement(v, groups) === null) {
      errors.push(`${v.id}: no library group (no group and no documentTypes id in the sidebar)`);
    }
    if (!v.summary.trim()) errors.push(`${v.id}: empty summary`);
    if (CITATION.test(v.summary)) errors.push(`${v.id}: summary carries a regulation citation`);
  }
  return errors;
}

/** Registry types with no video. Reported by the tests, never a failure. */
export function typesWithoutVideo(
  registryIds: Iterable<string>,
  videos: readonly HowToVideo[] = HOW_TO_VIDEOS,
): string[] {
  return [...registryIds].filter(t => videosForType(t, videos).length === 0);
}
```

`tests/how-to-videos.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { DOCUMENT_TYPES } from '@/lib/schemas';
import {
  HOW_TO_VIDEOS,
  libraryGroups,
  typesWithoutVideo,
  validateVideoCatalog,
  videosForType,
  type HowToVideo,
} from '@/lib/how-to-videos';

/**
 * Spec 2026-11-13 section 8.1. Every rule gets a positive control (the
 * production catalog passes) and a negative control (a deliberately
 * broken copy produces the matching error), so a passing run proves
 * each rule actually fires.
 */
const REGISTRY = Object.keys(DOCUMENT_TYPES);
const clone = (): HowToVideo[] => HOW_TO_VIDEOS.map(v => ({ ...v, documentTypes: [...v.documentTypes] }));
const withEdit = (edit: (vs: HowToVideo[]) => void) => { const vs = clone(); edit(vs); return validateVideoCatalog(vs, REGISTRY); };

describe('how-to video catalog', () => {
  it('production catalog: 32 videos, every URL set, no errors', () => {
    expect(HOW_TO_VIDEOS).toHaveLength(32);
    expect(HOW_TO_VIDEOS.every(v => v.url !== null)).toBe(true);
    expect(validateVideoCatalog(HOW_TO_VIDEOS, REGISTRY)).toEqual([]);
  });

  it('report: registry types with no video (informational, empty today)', () => {
    const missing = typesWithoutVideo(REGISTRY);
    if (missing.length) console.warn(`Types with no how-to video: ${missing.join(', ')}`);
    expect(Array.isArray(missing)).toBe(true);
  });

  it('negative: duplicate id', () => {
    expect(withEdit(vs => { vs[1].id = vs[0].id; }).join('\n')).toMatch(/duplicate id/);
  });
  it('negative: duplicate url', () => {
    expect(withEdit(vs => { vs[1].url = vs[0].url; }).join('\n')).toMatch(/duplicate url/);
  });
  it('negative: session token appended to a url', () => {
    expect(withEdit(vs => { vs[0].url += '&token=x'; }).join('\n')).toMatch(/not a MarineNet portal detail link/);
  });
  it('negative: http scheme', () => {
    expect(withEdit(vs => { vs[0].url = vs[0].url!.replace('https:', 'http:'); }).join('\n')).toMatch(/not a MarineNet portal detail link/);
  });
  it('negative: foreign host (the SSO login redirect)', () => {
    expect(withEdit(vs => { vs[0].url = 'https://www.mcele.usmc.mil/id3/sso/login?signin=d55669ba03841dd10b20246608059c70'; }).join('\n'))
      .toMatch(/not a MarineNet portal detail link/);
  });
  it('negative: unknown document type', () => {
    expect(withEdit(vs => { vs[5].documentTypes = ['not-a-type']; }).join('\n')).toMatch(/unknown document type "not-a-type"/);
  });
  it('negative: a video with no library group', () => {
    expect(withEdit(vs => { delete vs[0].group; vs[0].documentTypes = []; }).join('\n')).toMatch(/no library group/);
  });
  it('negative: a regulation citation in a summary', () => {
    expect(withEdit(vs => { vs[0].summary = 'Build it per MCO 50216.20.'; }).join('\n')).toMatch(/regulation citation/);
  });
});

describe('libraryGroups', () => {
  const groups = libraryGroups();

  it('places all 32 videos exactly once', () => {
    const ids = groups.flatMap(g => g.videos.map(v => v.id));
    expect(ids).toHaveLength(32);
    expect(new Set(ids).size).toBe(32);
  });

  it('orders the groups as the spec section 5 catalog', () => {
    expect(groups.map(g => `${g.label}:${g.videos.length}`)).toEqual([
      'Getting Started:4', 'Standard Letter:3', 'Memorandums:2', 'Staffing Papers:1',
      'External & Executive:1', 'Directives:3', 'Forms:7', 'Counseling Worksheets:1',
      'AMHS Message:1', 'Check, Export, and Share:6', 'Power Tools:3',
    ]);
  });

  it('puts Change Transmittals in Directives through secnav-instruction', () => {
    const directives = groups.find(g => g.key === 'directives')!;
    expect(directives.videos.map(v => v.id)).toContain('change-transmittals-and-secnav-directives');
  });
});

describe('videosForType', () => {
  it('basic shows both letter videos, whatever library group they sit in', () => {
    expect(videosForType('basic').map(v => v.id)).toEqual(['your-first-basic-letter', 'references-enclosures-and-via']);
  });
  it('the UPB has its video', () => {
    expect(videosForType('navmc10132').map(v => v.id)).toEqual(['the-unit-punishment-book-navmc-10132']);
  });
  it('DLA and I-Type headers get their links through multi-type videos', () => {
    expect(videosForType('dla-memorandum')).toHaveLength(1);
    expect(videosForType('i-type').map(v => v.id)).toEqual(['volumes-and-technical-publications']);
  });
});
```

- [x] Write the test. Run `npx vitest run tests/how-to-videos.test.ts`, expect FAIL (module missing).
- [x] Create the module. Run again, expect 16 PASS.

### Task 3: Row components and library dialog

Files:
- Create: `src/hooks/useOnlineStatus.ts`, `src/components/videos/LoginRequiredBadge.tsx`, `src/components/videos/VideoLink.tsx`, `src/components/videos/HowToVideoLinks.tsx`, `src/components/videos/HowToVideosDialog.tsx`
- Test: `tests/components/how-to-videos-ui.test.tsx`

Interfaces consumed: Task 2 exports. Produced: `useOnlineStatus(): boolean`, `<LoginRequiredBadge />`, `<VideoLink video compact? />` with `data-state` of `link | coming-soon | offline`, `<HowToVideoLinks typeId? heading? />` (renders null when no video has a URL), `<HowToVideosDialog open onOpenChange />`.

`src/hooks/useOnlineStatus.ts`:

```ts
'use client';

import { useSyncExternalStore } from 'react';

/**
 * Whether the browser reports a network connection (spec 7). This reads
 * navigator.onLine only: it says a network exists, not that MarineNet
 * is reachable. Probing reachability would be a network call from the
 * app, which the how-to videos design forbids.
 */
function subscribe(onChange: () => void): () => void {
  window.addEventListener('online', onChange);
  window.addEventListener('offline', onChange);
  return () => {
    window.removeEventListener('online', onChange);
    window.removeEventListener('offline', onChange);
  };
}

export function useOnlineStatus(): boolean {
  return useSyncExternalStore(subscribe, () => navigator.onLine, () => true);
}
```

`src/components/videos/LoginRequiredBadge.tsx`:

```tsx
import { ExternalLink, LockKeyhole } from 'lucide-react';

/**
 * "MarineNet login" badge on every how-to video link (spec 6). Inline
 * lucide SVG, theme tokens only, so light and dark follow the app. The
 * whole badge is aria-hidden: the link's accessible name already says
 * "login required, opens in a new tab".
 */
export function LoginRequiredBadge() {
  return (
    <span
      aria-hidden="true"
      data-testid="login-required-badge"
      className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
    >
      <LockKeyhole className="h-3 w-3" />
      MarineNet login
      <ExternalLink className="h-3 w-3" />
    </span>
  );
}
```

`src/components/videos/VideoLink.tsx`:

```tsx
'use client';

import { PlayCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { HowToVideo } from '@/lib/how-to-videos';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { LoginRequiredBadge } from './LoginRequiredBadge';

interface VideoLinkProps {
  video: HowToVideo;
  /** Header form: "Watch how-to: <title>", no summary. */
  compact?: boolean;
}

/**
 * One how-to video row (spec 6 and 7). Three states, exposed as
 * data-state for the tests:
 *   link         an anchor to MarineNet in a new tab
 *   coming-soon  no URL yet, plain text
 *   offline      the browser reports no network, plain text
 * The app makes no request of its own: no tracking, no prefetch.
 */
export function VideoLink({ video, compact = false }: VideoLinkProps) {
  const online = useOnlineStatus();
  const title = compact ? `Watch how-to: ${video.title}` : video.title;
  const state = !video.url ? 'coming-soon' : online ? 'link' : 'offline';

  if (state !== 'link') {
    return (
      <div
        data-video-id={video.id}
        data-state={state}
        className="flex items-start justify-between gap-2 px-1 py-1.5 text-muted-foreground"
      >
        <span className="min-w-0">
          <span className="text-sm">{title}</span>
          <span className="block text-xs">
            {state === 'coming-soon' ? 'Coming soon' : 'Needs a network connection'}
          </span>
        </span>
      </div>
    );
  }

  return (
    <a
      href={video.url!}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Watch ${video.title} on MarineNet, login required, opens in a new tab`}
      data-video-id={video.id}
      data-state="link"
      className={cn(
        'flex items-start justify-between gap-2 rounded px-1 py-1.5 text-foreground',
        'hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      )}
    >
      <span className="flex min-w-0 items-start gap-1.5">
        {compact && <PlayCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-primary" />}
        <span className="min-w-0">
          <span className="text-sm font-medium text-primary">{title}</span>
          {!compact && <span className="block text-xs text-muted-foreground">{video.summary}</span>}
        </span>
      </span>
      <LoginRequiredBadge />
    </a>
  );
}
```

`src/components/videos/HowToVideoLinks.tsx`:

```tsx
'use client';

import { videosForType } from '@/lib/how-to-videos';
import { VideoLink } from './VideoLink';

interface HowToVideoLinksProps {
  /** Active registry type id (a same-page endorsement is 'endorsement'). */
  typeId?: string;
  /** Optional heading, used inside GuidanceDialog. */
  heading?: string;
}

/**
 * The contextual "Watch how-to" rows for one document type (spec 6).
 * Renders nothing when the type has no video with a URL, so a type
 * without a video shows no empty row.
 */
export function HowToVideoLinks({ typeId, heading }: HowToVideoLinksProps) {
  const videos = typeId ? videosForType(typeId).filter(v => v.url) : [];
  if (videos.length === 0) return null;
  return (
    <div data-testid="howto-video-links" className="mt-2">
      {heading && (
        <h4 className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{heading}</h4>
      )}
      <div className="space-y-0.5">
        {videos.map(v => <VideoLink key={v.id} video={v} compact />)}
      </div>
    </div>
  );
}
```

`src/components/videos/HowToVideosDialog.tsx`:

```tsx
'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Video } from 'lucide-react';
import { libraryGroups } from '@/lib/how-to-videos';
import { VideoLink } from './VideoLink';

interface HowToVideosDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * The how-to video library (spec 6). Same Dialog parts and size as
 * GuidanceDialog. Groups in spec order, no search.
 */
export function HowToVideosDialog({ open, onOpenChange }: HowToVideosDialogProps) {
  const groups = libraryGroups();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[680px] h-[70vh] flex flex-col bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <Video className="w-4 h-4" /> How-To Videos
          </DialogTitle>
          <DialogDescription>
            Each video opens on MarineNet in a new tab. Log in to watch.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 min-h-0 overflow-y-auto native-scroll pr-3">
          <div className="space-y-4">
            {groups.map(g => (
              <section key={g.key} data-testid="howto-video-group" data-group={g.key} aria-labelledby={`howto-${g.key}`}>
                <h3 id={`howto-${g.key}`} className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {g.label}
                </h3>
                <div className="space-y-0.5">
                  {g.videos.map(v => <VideoLink key={v.id} video={v} />)}
                </div>
              </section>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

Test file `tests/components/how-to-videos-ui.test.tsx` must assert, each with a control that fails when the behavior is removed:

```tsx
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, within, act } from '@testing-library/react';
import { VideoLink } from '@/components/videos/VideoLink';
import { HowToVideoLinks } from '@/components/videos/HowToVideoLinks';
import { HowToVideosDialog } from '@/components/videos/HowToVideosDialog';
import { HOW_TO_VIDEOS } from '@/lib/how-to-videos';

const setOnline = (value: boolean) => {
  Object.defineProperty(window.navigator, 'onLine', { configurable: true, get: () => value });
  act(() => { window.dispatchEvent(new Event(value ? 'online' : 'offline')); });
};
afterEach(() => setOnline(true));

const endorsement = HOW_TO_VIDEOS.find(v => v.id === 'endorsements')!;

describe('VideoLink', () => {
  it('renders a new-tab MarineNet anchor with the login badge and accessible name', () => {
    render(<VideoLink video={endorsement} />);
    const a = screen.getByRole('link', { name: 'Watch Endorsements on MarineNet, login required, opens in a new tab' });
    expect(a).toHaveAttribute('href', endorsement.url!);
    expect(a).toHaveAttribute('target', '_blank');
    expect(a).toHaveAttribute('rel', 'noopener noreferrer');
    expect(within(a).getByTestId('login-required-badge')).toHaveAttribute('aria-hidden', 'true');
  });
  it('coming soon: no anchor when url is null', () => {
    const { container } = render(<VideoLink video={{ ...endorsement, url: null }} />);
    expect(container.querySelector('a')).toBeNull();
    expect(screen.getByText('Coming soon')).toBeInTheDocument();
  });
  it('offline: no anchor, reads "Needs a network connection", and recovers when online', () => {
    const { container } = render(<VideoLink video={endorsement} />);
    setOnline(false);
    expect(container.querySelector('a')).toBeNull();
    expect(screen.getByText('Needs a network connection')).toBeInTheDocument();
    setOnline(true);
    expect(container.querySelector('a')).not.toBeNull();
  });
});

describe('HowToVideoLinks', () => {
  it('basic shows both letter videos', () => {
    render(<HowToVideoLinks typeId="basic" />);
    expect(screen.getAllByRole('link')).toHaveLength(2);
  });
  it('renders nothing for a type with no video', () => {
    const { container } = render(<HowToVideoLinks typeId="not-a-type" />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('HowToVideosDialog', () => {
  it('lists 11 groups in spec order and 32 links', () => {
    render(<HowToVideosDialog open onOpenChange={() => {}} />);
    const groups = screen.getAllByTestId('howto-video-group').map(g => g.getAttribute('data-group'));
    expect(groups).toEqual([
      'getting-started', 'standard-letter', 'memorandums', 'staffing-papers', 'external-executive',
      'directives', 'forms', 'counseling-worksheets', 'amhs', 'check-export-share', 'power-tools',
    ]);
    expect(screen.getAllByRole('link')).toHaveLength(32);
  });
});
```

- [ ] Write the test file. Run `npx vitest run tests/components/how-to-videos-ui.test.tsx`, expect FAIL (modules missing).
- [ ] Create the five files exactly as above. Run again, expect PASS.
- [ ] Negative check by hand: temporarily change `rel` in VideoLink to `noopener` and confirm the first test goes red, then restore.

### Task 4: Entry points (additive edits only)

Files:
- Modify: `src/components/document/DocumentLayout.tsx` (header card, about line 211)
- Modify: `src/components/GuidanceDialog.tsx` (after the "Example subject" block, about line 108)
- Modify: `src/components/layout/HeaderActions.tsx` (props about line 173, `hasOtherReview` about line 336, menu about line 628)
- Modify: `src/components/layout/ModernAppShell.tsx` (props line 69, destructure line 121, pass-through line 348)
- Modify: `src/components/CommandPalette.tsx` (props line 50, destructure line 59, "Open" group line 114)
- Modify: `src/app/page.tsx` (state line 270, ModernAppShell line 1476, CommandPalette line 1702, dialogs line 1712)
- Test: extend `tests/components/how-to-videos-ui.test.tsx`; keep `tests/components/guidance-dialog.test.tsx`, `command-palette-hint.test.tsx`, `a11y-names.test.tsx` green unchanged.

Edits:

1. DocumentLayout.tsx: `import { HowToVideoLinks } from '@/components/videos/HowToVideoLinks';` and, inside the header text `<div>`, directly after the description `<p className="text-muted-foreground">...</p>`, add `<HowToVideoLinks typeId={formData.documentType} />`. Nothing else in the header changes.
2. GuidanceDialog.tsx: import the same component and add `<HowToVideoLinks typeId={selected.type} heading="How-to video" />` as the last child of the `space-y-4` right-panel div, after the Example subject block.
3. HeaderActions.tsx: add optional prop `onVideos?: () => void;` next to `onGuide`, destructure it, change `hasOtherReview` to `Boolean(onProofread || onCompliance || onCompare || onFindReplace || onGuide || onVideos)`, import `Video` from lucide-react, and add directly after the Correspondence Guide item:
   ```tsx
   {onVideos && (
     <DropdownMenuItem onClick={onVideos} className="cursor-pointer focus:bg-accent focus:text-accent-foreground">
       <Video className="w-4 h-4 mr-2" />
       How-To Videos
     </DropdownMenuItem>
   )}
   ```
4. ModernAppShell.tsx: add optional prop `onVideos?: () => void;`, destructure it, pass `onVideos={onVideos}` to HeaderActions next to `onGuide={onGuide}`.
5. CommandPalette.tsx: add OPTIONAL prop `onVideos?: () => void;` (optional so existing callers and tests compile), destructure it, import `Video`, and add after the Correspondence guide item:
   ```tsx
   {onVideos && (
     <CommandItem onSelect={() => run(onVideos)}>
       <Video className="mr-2 h-4 w-4" /> How-to videos
     </CommandItem>
   )}
   ```
6. page.tsx: `const [showVideos, setShowVideos] = useState(false);` next to `showGuidance`; `onVideos={() => setShowVideos(true)}` on ModernAppShell and on CommandPalette next to their `onGuide`; import `HowToVideosDialog` and render `<HowToVideosDialog open={showVideos} onOpenChange={setShowVideos} />` directly after `<GuidanceDialog ... />`.

Add to the UI test file:

```tsx
import { GuidanceDialog } from '@/components/GuidanceDialog';

describe('GuidanceDialog video row', () => {
  it('shows the Endorsements video for the endorsement entry', () => {
    render(<GuidanceDialog open onOpenChange={() => {}} documentType="endorsement" />);
    expect(screen.getByRole('link', { name: /Watch Endorsements on MarineNet/ })).toBeInTheDocument();
  });
});
```

- [ ] Make edits 1 to 6. Run `npx tsc --noEmit` and `npx tsc --noEmit -p tsconfig.tests.json`, expect 0 errors.
- [ ] Run `npx vitest run tests/components`, expect PASS, including the pre-existing guidance, palette and a11y tests unchanged.
- [ ] `git diff --stat` must list only the six files above plus new files. `git diff src/components/layout/Sidebar.tsx` must be empty.

### Task 5: End-to-end and gates

Files:
- Create: `tests/e2e/how-to-videos.spec.ts`

Use `enterApp` and `collectErrors` from `tests/e2e/helpers.ts` and select types through the sidebar the way `same-page-endorsement.spec.ts` does. Assertions:

- Endorsement selected: header `[data-testid="howto-video-links"] a` has the Endorsements href, `target="_blank"`, `rel="noopener noreferrer"`.
- Unit Punishment Book (NAVMC 10132) selected: header link present with href ending `Id=101614637C29`.
- Actions menu, "How-To Videos": the dialog shows 11 `[data-testid="howto-video-group"]` sections in the Task 3 order and 32 anchors.
- `context.setOffline(true)`: the dialog rows read "Needs a network connection" and contain no anchor.
- Sidebar unchanged: not asserted in the browser. Sidebar.tsx is untouched and receives the same props, so `git diff --exit-code src/components/layout/Sidebar.tsx` (Task 4) is the proof.
- `collectErrors` empty at the end (covers CSP violations).

Gates, in the cloud clone:

- [ ] `npx tsc --noEmit` and `npx tsc --noEmit -p tsconfig.tests.json`: 0 errors.
- [ ] `npx eslint src/lib/how-to-videos.ts src/lib/document-groups.ts src/components/videos src/hooks/useOnlineStatus.ts <the six modified files>`: no new errors over the baseline.
- [ ] `npx vitest run`: green (the LibreOffice parity test runs in the container).
- [ ] `npm run build && npx playwright test tests/e2e/how-to-videos.spec.ts tests/e2e/smoke.spec.ts`: green.

### Task 6: Live verification and handoff

- [ ] Stephen starts `npm run dev` on Windows.
- [ ] In Chrome: light and dark screenshots of the Basic Letter, Same-Page Endorsement and NAVMC 10132 headers and the library. Click one link and confirm a new tab opens on the portal.
- [ ] Hand Stephen the diff. Write to D:\Coding\SemperScribe only on his go. No commit, no push.
