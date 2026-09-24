import React from 'react';
import { useVolumeStore, type VolumePath } from '@/store/volumeStore';
import { sectionDesignator, paragraphDesignator, subParaDesignator } from '@/lib/volume/designators';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { BlockEditor } from './BlockEditor';
import { ChapterChangeLog } from './ChapterChangeLog';
import { FigurePanel } from './FigurePanel';
import { ChevronUp, ChevronDown, Trash2, Plus, ListTree } from 'lucide-react';
import type { Block, Chapter, Paragraph, Section, SubPara } from '@/lib/schemas/volume-schema';

/** Appends `idx` to a path's `sub` array (or starts a new one). */
function subPathFor(base: VolumePath, idx: number): VolumePath {
  return { ...base, sub: [...(base.sub ?? []), idx] };
}

function MoveRemoveControls({
  onUp, onDown, onRemove, removeLabel,
}: { onUp: () => void; onDown: () => void; onRemove: () => void; removeLabel: string }) {
  return (
    <div className="flex gap-1 ml-auto">
      <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0" title="Move up" aria-label="Move up" onClick={onUp}>
        <ChevronUp className="w-4 h-4" />
      </Button>
      <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0" title="Move down" aria-label="Move down" onClick={onDown}>
        <ChevronDown className="w-4 h-4" />
      </Button>
      <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0" title={removeLabel} aria-label={removeLabel} onClick={onRemove}>
        <Trash2 className="w-4 h-4 text-destructive" />
      </Button>
    </div>
  );
}

function SubParaNode({ node, path, index }: { node: SubPara; path: VolumePath; index: number }) {
  const updateNodeTitle = useVolumeStore((s) => s.updateNodeTitle);
  const updateBlock = useVolumeStore((s) => s.updateBlock);
  const moveNode = useVolumeStore((s) => s.moveNode);
  const removeNode = useVolumeStore((s) => s.removeNode);
  const addSubPara = useVolumeStore((s) => s.addSubPara);

  const designator = subParaDesignator(node.style, index + 1);

  return (
    <div className="ml-4 border-l border-border pl-3 space-y-2 py-2">
      <div className="flex items-center gap-2">
        <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-secondary/40 whitespace-nowrap">{designator}</span>
        <Input
          value={node.title ?? ''}
          onChange={(e) => updateNodeTitle(path, e.target.value)}
          placeholder="Title (optional)"
          className="h-8 flex-1"
          aria-label={`${designator} title`}
        />
        <MoveRemoveControls
          onUp={() => moveNode(path, -1)}
          onDown={() => moveNode(path, 1)}
          onRemove={() => removeNode(path)}
          removeLabel={`Remove ${designator}`}
        />
      </div>

      {node.body.map((block, bi) => (
        <BlockEditor
          key={bi}
          block={block}
          onChange={(b: Block) => updateBlock(path, bi, b)}
          label={`${designator} text`}
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

  return (
    <div className="ml-3 border-l-2 border-border pl-3 space-y-2 py-2">
      <div className="flex items-center gap-2">
        <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-secondary/50 whitespace-nowrap">{designator}</span>
        <Input
          value={paragraph.title}
          onChange={(e) => updateNodeTitle(path, e.target.value)}
          placeholder="Paragraph title"
          className="h-8 flex-1"
          aria-label={`${designator} title`}
        />
        <MoveRemoveControls
          onUp={() => moveNode(path, -1)}
          onDown={() => moveNode(path, 1)}
          onRemove={() => removeNode(path)}
          removeLabel={`Remove paragraph ${designator}`}
        />
      </div>

      {paragraph.body.map((block, bi) => (
        <BlockEditor
          key={bi}
          block={block}
          onChange={(b: Block) => updateBlock(path, bi, b)}
          label={`${designator} text`}
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
    <div className="ml-2 border-l-2 border-primary/30 pl-3 space-y-2 py-2">
      <div className="flex items-center gap-2">
        <span className="font-mono text-sm font-semibold px-2 py-0.5 rounded bg-primary/10 text-primary whitespace-nowrap">
          {designator}
        </span>
        <Input
          value={section.title}
          onChange={(e) => updateNodeTitle(path, e.target.value)}
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
    <Card className="shadow-sm border-border border-l-4 border-l-primary">
      <CardHeader className="pb-3 bg-secondary text-secondary-foreground rounded-t-lg">
        <CardTitle as="h3" className="flex items-center gap-2 text-lg font-semibold">
          <span className="font-mono">Chapter {chapter.number}</span>
          <Input
            value={chapter.title}
            onChange={(e) => updateNodeTitle(path, e.target.value)}
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

  return (
    <div className="space-y-4">
      {chapters.map((chapter, ci) => (
        <ChapterNode key={ci} chapter={chapter} chapterIdx={ci} />
      ))}
      <Button type="button" onClick={addChapter}>
        <Plus className="w-4 h-4 mr-1" /> Add Chapter
      </Button>
    </div>
  );
}
