import React, { createContext, useContext, useEffect, useRef } from 'react';
import { useVolumeStore, type VolumePath } from '@/store/volumeStore';
import { volumePathKey, type VolumeFocusTarget } from '@/store/volumeHistory';
import { sectionDesignator, paragraphDesignator, subParaDesignator } from '@/lib/volume/designators';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { BlockEditor } from './BlockEditor';
import { ChapterChangeLog } from './ChapterChangeLog';
import { FigurePanel } from './FigurePanel';
import { ChevronUp, ChevronDown, Trash2, Plus, ListTree, IndentIncrease, IndentDecrease } from 'lucide-react';
import { canIndentNode, canOutdentNode, targetDesignator } from '@/store/volumeLevels';
import type { KeyboardEvent } from 'react';
import type { Block, Chapter, Paragraph, Section, SubPara } from '@/lib/schemas/volume-schema';

/** Appends `idx` to a path's `sub` array (or starts a new one). */
function subPathFor(base: VolumePath, idx: number): VolumePath {
  return { ...base, sub: [...(base.sub ?? []), idx] };
}

/**
 * Focus restoration. Tree nodes are keyed by index, so after indent/outdent
 * (or undo/redo) the edited node can render in a different component
 * instance and focus would be lost or land on whatever now sits at the old
 * index. Each node carries `data-volume-path` and its controls carry
 * `data-volume-control`; the store publishes a focusRequest and ChapterTree
 * focuses the matching control after commit (falling back to the node's
 * title when that control is gone or disabled).
 */
export function focusVolumeControl(root: HTMLElement | null, target: VolumeFocusTarget): boolean {
  const node = root?.querySelector<HTMLElement>(`[data-volume-path="${volumePathKey(target.path)}"]`);
  if (!node) return false;
  const own = (control: string) => Array.from(node.querySelectorAll<HTMLElement>(`[data-volume-control="${control}"]`))
    .find((el) => el.closest('[data-volume-path]') === node && !(el as HTMLButtonElement).disabled);
  const el = own(target.control ?? 'title') ?? own('title');
  if (!el) return false;
  el.focus();
  return true;
}

/** The data-volume-control of the focused element when it belongs to `node` itself. */
function focusedControl(node: HTMLElement): string | undefined {
  const active = document.activeElement as HTMLElement | null;
  if (!active || active.closest('[data-volume-path]') !== node) return undefined;
  return active.dataset.volumeControl;
}

/** Receives the polite live-region message after an indent/outdent. */
const LevelAnnounceContext = createContext<(msg: string) => void>(() => {});

function MoveRemoveControls({
  onUp, onDown, onRemove, removeLabel, level,
}: {
  onUp: () => void; onDown: () => void; onRemove: () => void; removeLabel: string;
  /** Indent/outdent for tree nodes (paragraphs and sub-paragraphs). */
  level?: { designator: string; path: VolumePath };
}) {
  const chapters = useVolumeStore((s) => s.doc.chapters);
  const indentNode = useVolumeStore((s) => s.indentNode);
  const outdentNode = useVolumeStore((s) => s.outdentNode);
  const announce = useContext(LevelAnnounceContext);
  const indentState = level ? canIndentNode(chapters, level.path) : null;
  const outdentState = level ? canOutdentNode(chapters, level.path) : null;
  const run = (dir: 'indent' | 'outdent') => {
    if (!level) return;
    const target = targetDesignator(chapters, level.path, dir);
    (dir === 'indent' ? indentNode : outdentNode)(level.path, { control: dir });
    if (target) announce(`${level.designator} is now ${target}`);
  };
  return (
    <div className="flex gap-1 ml-auto">
      {level && indentState && outdentState ? (
        <>
          <Button
            type="button" variant="ghost" size="sm" className="h-7 w-7 p-0"
            disabled={!outdentState.ok}
            data-volume-control="outdent"
            title={outdentState.ok ? `Outdent to ${targetDesignator(chapters, level.path, 'outdent')}` : outdentState.reason}
            aria-label={`Outdent ${level.designator}${outdentState.ok ? ` to ${targetDesignator(chapters, level.path, 'outdent')}` : ''}`}
            onClick={() => run('outdent')}
          >
            <IndentDecrease className="w-4 h-4" />
          </Button>
          <Button
            type="button" variant="ghost" size="sm" className="h-7 w-7 p-0"
            disabled={!indentState.ok}
            data-volume-control="indent"
            title={indentState.ok ? `Indent to ${targetDesignator(chapters, level.path, 'indent')}` : indentState.reason}
            aria-label={`Indent ${level.designator}${indentState.ok ? ` to ${targetDesignator(chapters, level.path, 'indent')}` : ''}`}
            onClick={() => run('indent')}
          >
            <IndentIncrease className="w-4 h-4" />
          </Button>
        </>
      ) : null}
      <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0" title="Move up" aria-label="Move up" data-volume-control="up" onClick={onUp}>
        <ChevronUp className="w-4 h-4" />
      </Button>
      <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0" title="Move down" aria-label="Move down" data-volume-control="down" onClick={onDown}>
        <ChevronDown className="w-4 h-4" />
      </Button>
      <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0" title={removeLabel} aria-label={removeLabel} onClick={onRemove}>
        <Trash2 className="w-4 h-4 text-destructive" />
      </Button>
    </div>
  );
}

/** Alt+Shift+Right indents, Alt+Shift+Left outdents the node whose header or body has focus. */
function useLevelKeys(path: VolumePath) {
  const indentNode = useVolumeStore((s) => s.indentNode);
  const outdentNode = useVolumeStore((s) => s.outdentNode);
  return (e: KeyboardEvent<HTMLElement>) => {
    if (!e.altKey || !e.shiftKey) return;
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    // Nested nodes sit inside their parent's wrapper; act only for the innermost.
    if ((e.target as HTMLElement).closest('[data-level-node]') !== e.currentTarget) return;
    e.preventDefault();
    (e.key === 'ArrowRight' ? indentNode : outdentNode)(path, { control: focusedControl(e.currentTarget) });
  };
}

function SubParaNode({ node, path, index }: { node: SubPara; path: VolumePath; index: number }) {
  const updateNodeTitle = useVolumeStore((s) => s.updateNodeTitle);
  const updateBlock = useVolumeStore((s) => s.updateBlock);
  const moveNode = useVolumeStore((s) => s.moveNode);
  const removeNode = useVolumeStore((s) => s.removeNode);
  const addSubPara = useVolumeStore((s) => s.addSubPara);

  const designator = subParaDesignator(node.style, index + 1);
  const onLevelKey = useLevelKeys(path);

  return (
    <div className="ml-4 border-l border-border pl-3 space-y-2 py-2" data-level-node data-volume-path={volumePathKey(path)} onKeyDown={onLevelKey}>
      <div className="flex items-center gap-2">
        <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-secondary/40 whitespace-nowrap">{designator}</span>
        <Input
          value={node.title ?? ''}
          onChange={(e) => updateNodeTitle(path, e.target.value)}
          data-volume-control="title"
          placeholder="Title (optional)"
          className="h-8 flex-1"
          aria-label={`${designator} title`}
        />
        <MoveRemoveControls
          onUp={() => moveNode(path, -1)}
          onDown={() => moveNode(path, 1)}
          onRemove={() => removeNode(path)}
          removeLabel={`Remove ${designator}`}
          level={{ designator, path }}
        />
      </div>

      {node.body.map((block, bi) => (
        <BlockEditor
          key={bi}
          block={block}
          onChange={(b: Block) => updateBlock(path, bi, b)}
          label={`${designator} text`}
          control={`block-${bi}`}
        />
      ))}

      <div className="flex gap-2 flex-wrap">
        <Button type="button" variant="outline" size="sm" onClick={() => updateBlock(path, node.body.length, { runs: [{ text: '' }] })}>
          <Plus className="w-4 h-4 mr-1" /> Add text
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => addSubPara(path)}>
          <ListTree className="w-4 h-4 mr-1" /> Add Sub-paragraph
        </Button>
      </div>

      {node.children.map((child, ci) => (
        <SubParaNode key={ci} node={child} path={subPathFor(path, ci)} index={ci} />
      ))}
    </div>
  );
}

function ParagraphNode({ paragraph, path, index }: { paragraph: Paragraph; path: VolumePath; index: number }) {
  const chapterNumber = usePathChapterNumber(path);
  const sectionSeq = (path.section ?? 0) + 1;
  const updateNodeTitle = useVolumeStore((s) => s.updateNodeTitle);
  const updateBlock = useVolumeStore((s) => s.updateBlock);
  const moveNode = useVolumeStore((s) => s.moveNode);
  const removeNode = useVolumeStore((s) => s.removeNode);
  const addSubPara = useVolumeStore((s) => s.addSubPara);

  const designator = paragraphDesignator(chapterNumber, sectionSeq, index + 1);
  const onLevelKey = useLevelKeys(path);

  return (
    <div className="ml-3 border-l-2 border-border pl-3 space-y-2 py-2" data-level-node data-volume-path={volumePathKey(path)} onKeyDown={onLevelKey}>
      <div className="flex items-center gap-2">
        <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-secondary/50 whitespace-nowrap">{designator}</span>
        <Input
          value={paragraph.title}
          onChange={(e) => updateNodeTitle(path, e.target.value)}
          data-volume-control="title"
          placeholder="Paragraph title"
          className="h-8 flex-1"
          aria-label={`${designator} title`}
        />
        <MoveRemoveControls
          onUp={() => moveNode(path, -1)}
          onDown={() => moveNode(path, 1)}
          onRemove={() => removeNode(path)}
          removeLabel={`Remove paragraph ${designator}`}
          level={{ designator, path }}
        />
      </div>

      {paragraph.body.map((block, bi) => (
        <BlockEditor
          key={bi}
          block={block}
          onChange={(b: Block) => updateBlock(path, bi, b)}
          label={`${designator} text`}
          control={`block-${bi}`}
        />
      ))}

      <div className="flex gap-2 flex-wrap">
        <Button type="button" variant="outline" size="sm" onClick={() => updateBlock(path, paragraph.body.length, { runs: [{ text: '' }] })}>
          <Plus className="w-4 h-4 mr-1" /> Add text
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => addSubPara(path)}>
          <ListTree className="w-4 h-4 mr-1" /> Add Sub-paragraph
        </Button>
      </div>

      {paragraph.children.map((child, ci) => (
        <SubParaNode key={ci} node={child} path={subPathFor(path, ci)} index={ci} />
      ))}
    </div>
  );
}

// Small helper so nested nodes don't each need chapter-number plumbing
// threaded through props; the chapter number lives on the chapter object,
// which the store keeps at `doc.chapters[path.chapter].number`.
function usePathChapterNumber(path: VolumePath): number {
  return useVolumeStore((s) => s.doc.chapters[path.chapter]?.number ?? path.chapter + 1);
}

function SectionNode({ section, path, index }: { section: Section; path: VolumePath; index: number }) {
  const chapterNumber = usePathChapterNumber(path);
  const sectionPeriod = useVolumeStore((s) => s.doc.volume.sectionPeriod);
  const updateNodeTitle = useVolumeStore((s) => s.updateNodeTitle);
  const updateBlock = useVolumeStore((s) => s.updateBlock);
  const moveNode = useVolumeStore((s) => s.moveNode);
  const removeNode = useVolumeStore((s) => s.removeNode);
  const addParagraph = useVolumeStore((s) => s.addParagraph);

  const designator = sectionDesignator(chapterNumber, index + 1, sectionPeriod);
  const body = section.body ?? [];

  return (
    <div className="ml-2 border-l-2 border-primary/30 pl-3 space-y-2 py-2" data-volume-path={volumePathKey(path)}>
      <div className="flex items-center gap-2">
        <span className="font-mono text-sm font-semibold px-2 py-0.5 rounded bg-primary/10 text-primary whitespace-nowrap">
          {designator}
        </span>
        <Input
          value={section.title}
          onChange={(e) => updateNodeTitle(path, e.target.value)}
          data-volume-control="title"
          placeholder="Section title"
          className="h-8 flex-1"
          aria-label={`${designator} title`}
        />
        <MoveRemoveControls
          onUp={() => moveNode(path, -1)}
          onDown={() => moveNode(path, 1)}
          onRemove={() => removeNode(path)}
          removeLabel={`Remove section ${designator}`}
        />
      </div>

      {body.map((block, bi) => (
        <BlockEditor
          key={bi}
          block={block}
          onChange={(b: Block) => updateBlock(path, bi, b)}
          label={`${designator} text`}
          control={`block-${bi}`}
        />
      ))}

      <div className="flex gap-2 flex-wrap">
        <Button type="button" variant="outline" size="sm" onClick={() => updateBlock(path, body.length, { runs: [{ text: '' }] })}>
          <Plus className="w-4 h-4 mr-1" /> Add text
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => addParagraph(path.chapter, path.section as number)}
        >
          <Plus className="w-4 h-4 mr-1" /> Add Paragraph
        </Button>
      </div>

      {section.paragraphs.map((paragraph, pi) => (
        <ParagraphNode key={pi} paragraph={paragraph} path={{ chapter: path.chapter, section: path.section, paragraph: pi }} index={pi} />
      ))}
    </div>
  );
}

function ChapterNode({ chapter, chapterIdx }: { chapter: Chapter; chapterIdx: number }) {
  const path: VolumePath = { chapter: chapterIdx };
  const updateNodeTitle = useVolumeStore((s) => s.updateNodeTitle);
  const moveNode = useVolumeStore((s) => s.moveNode);
  const removeNode = useVolumeStore((s) => s.removeNode);
  const addSection = useVolumeStore((s) => s.addSection);

  return (
    <Card className="shadow-sm border-border border-l-4 border-l-primary" data-volume-path={volumePathKey(path)}>
      <CardHeader className="pb-3 bg-secondary text-secondary-foreground rounded-t-lg">
        <CardTitle as="h3" className="flex items-center gap-2 text-lg font-semibold">
          <span className="font-mono">Chapter {chapter.number}</span>
          <Input
            value={chapter.title}
            onChange={(e) => updateNodeTitle(path, e.target.value)}
            data-volume-control="title"
            placeholder="Chapter title"
            className="h-8 flex-1 bg-background text-foreground"
            aria-label={`Chapter ${chapter.number} title`}
          />
          <MoveRemoveControls
            onUp={() => moveNode(path, -1)}
            onDown={() => moveNode(path, 1)}
            onRemove={() => removeNode(path)}
            removeLabel={`Remove chapter ${chapter.number}`}
          />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 pt-4">
        {chapter.sections.map((section, si) => (
          <SectionNode key={si} section={section} path={{ chapter: chapterIdx, section: si }} index={si} />
        ))}
        <Button type="button" variant="outline" size="sm" onClick={() => addSection(chapterIdx)}>
          <Plus className="w-4 h-4 mr-1" /> Add Section
        </Button>

        {/* Findings 11/12: per-chapter change log and figure authoring -
            previously no UI existed for either. */}
        <ChapterChangeLog chapter={chapter} chapterIdx={chapterIdx} />
        <FigurePanel chapter={chapter} chapterIdx={chapterIdx} />
      </CardContent>
    </Card>
  );
}

/** Renders chapters -> sections -> paragraphs -> sub-paragraphs with live
 * designators, editable titles, and add/remove/move controls. */
export function ChapterTree() {
  const chapters = useVolumeStore((s) => s.doc.chapters);
  const addChapter = useVolumeStore((s) => s.addChapter);
  const focusRequest = useVolumeStore((s) => s.focusRequest);
  const [announcement, setAnnouncement] = React.useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  // A request made before this tree mounted is stale; only act on new ones.
  const handledNonce = useRef(focusRequest?.nonce);

  useEffect(() => {
    if (!focusRequest || focusRequest.nonce === handledNonce.current) return;
    handledNonce.current = focusRequest.nonce;
    focusVolumeControl(rootRef.current, focusRequest);
  }, [focusRequest]);

  return (
    <LevelAnnounceContext.Provider value={setAnnouncement}>
      <div className="space-y-4" ref={rootRef}>
        {chapters.map((chapter, ci) => (
          <ChapterNode key={ci} chapter={chapter} chapterIdx={ci} />
        ))}
        <Button type="button" onClick={addChapter}>
          <Plus className="w-4 h-4 mr-1" /> Add Chapter
        </Button>
        <div role="status" aria-live="polite" className="sr-only">{announcement}</div>
      </div>
    </LevelAnnounceContext.Provider>
  );
}
