import React from 'react';
import { useVolumeStore } from '@/store/volumeStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { BlockEditor } from './BlockEditor';
import { BookOpen, History, Plus, Trash2 } from 'lucide-react';
import type { Appendix, Block } from '@/lib/schemas/volume-schema';

/**
 * Task 22: appendix authoring - title, an optional two-column glossary
 * (term/definition rows), plain body blocks (reusing BlockEditor, the same
 * flush-left-block editing chapters/sections already use), and the
 * appendix's own divider change log (mirrors ChapterChangeLog).
 *
 * The appendix `letter` is derived from array position (normalizeAppendices
 * in the store, the same "designators are computed, not authored"
 * convention a chapter's `number` already follows), so it is displayed but
 * never directly editable here.
 */
function AppendixChangeLog({ appendix, appendixIdx }: { appendix: Appendix; appendixIdx: number }) {
  const addAppendixChangeRow = useVolumeStore((s) => s.addAppendixChangeRow);
  const updateAppendixChangeRow = useVolumeStore((s) => s.updateAppendixChangeRow);
  const removeAppendixChangeRow = useVolumeStore((s) => s.removeAppendixChangeRow);

  return (
    <Card className="shadow-sm border-border">
      <CardHeader className="pb-3">
        <CardTitle as="h4" className="flex items-center text-sm font-semibold">
          <History className="mr-2 h-4 w-4" /> Appendix {appendix.letter} Change Log
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {appendix.changeLog.map((row, i) => (
          <div key={i} className="grid grid-cols-1 md:grid-cols-5 gap-2 items-center">
            <Input
              placeholder="Version"
              value={row.version}
              onChange={(e) => updateAppendixChangeRow(appendixIdx, i, { version: e.target.value })}
              aria-label={`Appendix ${appendix.letter} change ${i + 1} version`}
            />
            <Input
              placeholder="Page/paragraph"
              value={row.pageParagraph}
              onChange={(e) => updateAppendixChangeRow(appendixIdx, i, { pageParagraph: e.target.value })}
              aria-label={`Appendix ${appendix.letter} change ${i + 1} page/paragraph`}
            />
            <Input
              placeholder="Summary"
              className="md:col-span-2"
              value={row.summary}
              onChange={(e) => updateAppendixChangeRow(appendixIdx, i, { summary: e.target.value })}
              aria-label={`Appendix ${appendix.letter} change ${i + 1} summary`}
            />
            <div className="flex gap-2">
              <Input
                placeholder="Date of change"
                value={row.dateOfChange}
                onChange={(e) => updateAppendixChangeRow(appendixIdx, i, { dateOfChange: e.target.value })}
                aria-label={`Appendix ${appendix.letter} change ${i + 1} date of change`}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => removeAppendixChangeRow(appendixIdx, i)}
                aria-label={`Remove appendix ${appendix.letter} change ${i + 1}`}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={() => addAppendixChangeRow(appendixIdx)}>
          <Plus className="w-4 h-4 mr-1" /> Add Change Entry
        </Button>
      </CardContent>
    </Card>
  );
}

function GlossaryEditor({ appendix, appendixIdx }: { appendix: Appendix; appendixIdx: number }) {
  const addGlossaryRow = useVolumeStore((s) => s.addGlossaryRow);
  const updateGlossaryRow = useVolumeStore((s) => s.updateGlossaryRow);
  const removeGlossaryRow = useVolumeStore((s) => s.removeGlossaryRow);
  const glossary = appendix.glossary ?? [];

  return (
    <div className="space-y-2">
      <h5 className="text-sm font-semibold text-muted-foreground">Glossary</h5>
      {glossary.map((entry, i) => (
        <div key={i} className="flex gap-2 items-center">
          <Input
            placeholder="Term"
            value={entry.term}
            onChange={(e) => updateGlossaryRow(appendixIdx, i, { term: e.target.value })}
            aria-label={`Appendix ${appendix.letter} glossary term ${i + 1}`}
            className="w-40"
          />
          <Input
            placeholder="Definition"
            value={entry.definition}
            onChange={(e) => updateGlossaryRow(appendixIdx, i, { definition: e.target.value })}
            aria-label={`Appendix ${appendix.letter} glossary definition ${i + 1}`}
            className="flex-1"
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => removeGlossaryRow(appendixIdx, i)}
            aria-label={`Remove appendix ${appendix.letter} glossary row ${i + 1}`}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={() => addGlossaryRow(appendixIdx)}>
        <Plus className="w-4 h-4 mr-1" /> Add Glossary Row
      </Button>
    </div>
  );
}

function AppendixNode({ appendix, appendixIdx }: { appendix: Appendix; appendixIdx: number }) {
  const updateAppendix = useVolumeStore((s) => s.updateAppendix);
  const updateAppendixBlock = useVolumeStore((s) => s.updateAppendixBlock);
  const removeAppendixBlock = useVolumeStore((s) => s.removeAppendixBlock);
  const removeAppendix = useVolumeStore((s) => s.removeAppendix);

  return (
    <Card className="shadow-sm border-border border-l-4 border-l-primary">
      <CardHeader className="pb-3 bg-secondary text-secondary-foreground rounded-t-lg">
        <CardTitle as="h3" className="flex items-center gap-2 text-lg font-semibold">
          <span className="font-mono">Appendix {appendix.letter}</span>
          <Input
            value={appendix.title}
            onChange={(e) => updateAppendix(appendixIdx, { title: e.target.value })}
            placeholder="Appendix title"
            className="h-8 flex-1 bg-background text-foreground"
            aria-label={`Appendix ${appendix.letter} title`}
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 ml-auto"
            title={`Remove appendix ${appendix.letter}`}
            aria-label={`Remove appendix ${appendix.letter}`}
            onClick={() => removeAppendix(appendixIdx)}
          >
            <Trash2 className="w-4 h-4 text-destructive" />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        {appendix.blocks.map((block, bi) => (
          <BlockEditor
            key={bi}
            block={block}
            onChange={(b: Block) => updateAppendixBlock(appendixIdx, bi, b)}
            label={`Appendix ${appendix.letter} text ${bi + 1}`}
          />
        ))}
        <div className="flex gap-2 flex-wrap">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => updateAppendixBlock(appendixIdx, appendix.blocks.length, { runs: [{ text: '' }] })}
          >
            <Plus className="w-4 h-4 mr-1" /> Add Text
          </Button>
          {appendix.blocks.length > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => removeAppendixBlock(appendixIdx, appendix.blocks.length - 1)}
            >
              <Trash2 className="w-4 h-4 mr-1 text-destructive" /> Remove Last Text Block
            </Button>
          )}
        </div>

        <GlossaryEditor appendix={appendix} appendixIdx={appendixIdx} />

        <AppendixChangeLog appendix={appendix} appendixIdx={appendixIdx} />
      </CardContent>
    </Card>
  );
}

/** Renders appendices -> title/body/glossary/change-log with add/remove
 * controls, mounted after the chapter tree in VolumeEditor. */
export function AppendixPanel() {
  const appendices = useVolumeStore((s) => s.doc.appendices);
  const addAppendix = useVolumeStore((s) => s.addAppendix);

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold flex items-center gap-2">
        <BookOpen className="w-5 h-5" /> Appendices
      </h2>
      {appendices.map((appendix, ai) => (
        <AppendixNode key={ai} appendix={appendix} appendixIdx={ai} />
      ))}
      <Button type="button" onClick={addAppendix}>
        <Plus className="w-4 h-4 mr-1" /> Add Appendix
      </Button>
    </div>
  );
}
