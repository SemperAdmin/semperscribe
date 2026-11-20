import type { Chapter, Paragraph, Section, SubPara } from '@/lib/schemas/volume-schema';
import { paragraphDesignator, subParaDesignator } from '@/lib/volume/designators';
import type { VolumePath } from './volumeStore';

/**
 * Indent / outdent for the volume paragraph tree (Paragraph -> SubPara ->
 * SubPara ...). Tree semantics, matching Word's outline behavior:
 * - indent: the node (with its subtree) becomes the LAST child of its
 *   previous sibling.
 * - outdent: the node (with its subtree) becomes the next sibling of its
 *   parent; its later siblings stay with the old parent.
 * A top-level Paragraph turns into a depth-1 SubPara on indent and a depth-1
 * SubPara turns into a Paragraph on outdent. Sub-paragraph styles follow
 * depth: depth 1 is 'upper' (A.), deeper is 'arabic' (1.), the same rule
 * `addSubPara` uses. The volume model has no max depth and no locked nodes.
 * Only `applyLevelChange` mutates, and only the (already cloned) chapters it
 * is handed.
 */
export type LevelChange = { ok: true } | { ok: false; reason: string };
export type LevelDir = 'indent' | 'outdent';

type TreePath = VolumePath & { section: number; paragraph: number };
type Node = Paragraph | SubPara;

function isTreePath(path: VolumePath): path is TreePath {
  return path.section !== undefined && path.paragraph !== undefined;
}

const styleForDepth = (depth: number): 'upper' | 'arabic' => (depth === 1 ? 'upper' : 'arabic');

/** The sibling list holding the node at `path`, and the node's index in it. */
function siblings(section: Section, path: TreePath): { list: Node[]; index: number } | null {
  const sub = path.sub ?? [];
  let list: Node[] = section.paragraphs;
  let owner: Node | undefined = section.paragraphs[path.paragraph];
  if (!owner) return null;
  for (let i = 0; i < sub.length - 1; i++) {
    owner = owner.children[sub[i]];
    if (!owner) return null;
  }
  if (sub.length > 0) list = owner.children;
  const index = sub.length === 0 ? path.paragraph : sub[sub.length - 1];
  return list[index] ? { list, index } : null;
}

export function canIndentNode(chapters: Chapter[], path: VolumePath): LevelChange {
  if (!isTreePath(path)) return { ok: false, reason: 'Only paragraphs and sub-paragraphs can be indented' };
  const section = chapters[path.chapter]?.sections[path.section];
  const at = section && siblings(section, path);
  if (!at) return { ok: false, reason: 'Paragraph not found' };
  if (at.index === 0) return { ok: false, reason: 'No paragraph above to nest under' };
  return { ok: true };
}

export function canOutdentNode(chapters: Chapter[], path: VolumePath): LevelChange {
  if (!isTreePath(path)) return { ok: false, reason: 'Only paragraphs and sub-paragraphs can be outdented' };
  const section = chapters[path.chapter]?.sections[path.section];
  if (!section || !siblings(section, path)) return { ok: false, reason: 'Paragraph not found' };
  if ((path.sub ?? []).length === 0) return { ok: false, reason: 'Already at the top level' };
  return { ok: true };
}

/** Designator the node will carry after the change, or null when blocked. */
export function targetDesignator(chapters: Chapter[], path: VolumePath, dir: LevelDir): string | null {
  const check = dir === 'indent' ? canIndentNode(chapters, path) : canOutdentNode(chapters, path);
  if (!check.ok || !isTreePath(path)) return null;
  const chapter = chapters[path.chapter];
  const section = chapter.sections[path.section];
  const sub = path.sub ?? [];
  if (dir === 'indent') {
    const at = siblings(section, path)!;
    const prev = at.list[at.index - 1];
    return subParaDesignator(styleForDepth(sub.length + 1), prev.children.length + 1);
  }
  if (sub.length === 1) return paragraphDesignator(chapter.number, path.section + 1, path.paragraph + 2);
  return subParaDesignator(styleForDepth(sub.length - 1), sub[sub.length - 2] + 2);
}

/** Re-styles a moved subtree so each sub-paragraph matches its new depth. */
function restyle(node: SubPara, depth: number): void {
  node.style = styleForDepth(depth);
  node.children.forEach((c) => restyle(c, depth + 1));
}

function toSubPara(p: Paragraph): SubPara {
  return { seq: p.seq, style: 'upper', title: p.title, body: p.body, children: p.children };
}

function toParagraph(s: SubPara): Paragraph {
  return { seq: s.seq, title: s.title ?? '', body: s.body, children: s.children };
}

/**
 * Applies the change in place to `chapters` (callers pass a clone) and
 * returns the moved node's new path, or null when blocked. Seq numbers are
 * left for the caller's `normalizeNumbering`.
 */
export function applyLevelChange(chapters: Chapter[], path: VolumePath, dir: LevelDir): VolumePath | null {
  const check = dir === 'indent' ? canIndentNode(chapters, path) : canOutdentNode(chapters, path);
  if (!check.ok || !isTreePath(path)) return null;
  const section = chapters[path.chapter].sections[path.section];
  const sub = path.sub ?? [];
  const at = siblings(section, path)!;

  if (dir === 'indent') {
    const prev = at.list[at.index - 1];
    const [node] = at.list.splice(at.index, 1);
    const moved: SubPara = sub.length === 0 ? toSubPara(node as Paragraph) : (node as SubPara);
    restyle(moved, sub.length + 1);
    prev.children.push(moved);
    const prevIdx = at.index - 1;
    return sub.length === 0
      ? { ...path, paragraph: prevIdx, sub: [prev.children.length - 1] }
      : { ...path, sub: [...sub.slice(0, -1), prevIdx, prev.children.length - 1] };
  }

  const [node] = at.list.splice(at.index, 1);
  if (sub.length === 1) {
    const para = toParagraph(node as SubPara);
    para.children.forEach((c) => restyle(c, 1));
    section.paragraphs.splice(path.paragraph + 1, 0, para);
    return { chapter: path.chapter, section: path.section, paragraph: path.paragraph + 1 };
  }
  const moved = node as SubPara;
  restyle(moved, sub.length - 1);
  const parentSub = sub.slice(0, -1);
  let owner: Node = section.paragraphs[path.paragraph];
  for (const i of parentSub.slice(0, -1)) owner = owner.children[i];
  const parentIdx = parentSub[parentSub.length - 1];
  owner.children.splice(parentIdx + 1, 0, moved);
  return { ...path, sub: [...parentSub.slice(0, -1), parentIdx + 1] };
}
