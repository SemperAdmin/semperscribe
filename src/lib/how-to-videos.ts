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
