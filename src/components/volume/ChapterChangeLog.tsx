import React from 'react';
import { useVolumeStore } from '@/store/volumeStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { History, Plus, Trash2 } from 'lucide-react';
import type { Chapter } from '@/lib/schemas/volume-schema';

/**
 * Finding 11: MetaPanel only ever authored the volume-level `changeLog`
 * (the title-page table); a chapter's OWN `changeLog` - the data source for
 * that chapter's divider "Summary of Substantive Changes" table
 * (lib/volume/layout.ts's layoutChapterDivider) - had no authoring UI at
 * all, so it could only ever be populated by hand-editing a .nldp file or
 * importing one.
 */
export function ChapterChangeLog({ chapter, chapterIdx }: { chapter: Chapter; chapterIdx: number }) {
  const addChapterChangeRow = useVolumeStore((s) => s.addChapterChangeRow);
  const updateChapterChangeRow = useVolumeStore((s) => s.updateChapterChangeRow);
  const removeChapterChangeRow = useVolumeStore((s) => s.removeChapterChangeRow);

  return (
    <Card className="shadow-sm border-border">
      <CardHeader className="pb-3">
        <CardTitle as="h4" className="flex items-center text-sm font-semibold">
          <History className="mr-2 h-4 w-4" /> Chapter {chapter.number} Change Log
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {chapter.changeLog.map((row, i) => (
          <div key={i} className="grid grid-cols-1 md:grid-cols-5 gap-2 items-center">
            <Input
              placeholder="Version"
              value={row.version}
              onChange={(e) => updateChapterChangeRow(chapterIdx, i, { version: e.target.value })}
              aria-label={`Chapter ${chapter.number} change ${i + 1} version`}
            />
            <Input
              placeholder="Page/paragraph"
              value={row.pageParagraph}
              onChange={(e) => updateChapterChangeRow(chapterIdx, i, { pageParagraph: e.target.value })}
              aria-label={`Chapter ${chapter.number} change ${i + 1} page/paragraph`}
            />
            <Input
              placeholder="Summary"
              className="md:col-span-2"
              value={row.summary}
              onChange={(e) => updateChapterChangeRow(chapterIdx, i, { summary: e.target.value })}
              aria-label={`Chapter ${chapter.number} change ${i + 1} summary`}
            />
            <div className="flex gap-2">
              <Input
                placeholder="Date of change"
                value={row.dateOfChange}
                onChange={(e) => updateChapterChangeRow(chapterIdx, i, { dateOfChange: e.target.value })}
                aria-label={`Chapter ${chapter.number} change ${i + 1} date of change`}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => removeChapterChangeRow(chapterIdx, i)}
                aria-label={`Remove chapter ${chapter.number} change ${i + 1}`}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </div>
        ))}
        {/* "Add Change Entry", not "Add Chapter Change" - the top-level
            "Add Chapter" button (ChapterTree) must stay uniquely matchable
            by name; a label starting with "Add Chapter" would collide. */}
        <Button type="button" variant="outline" size="sm" onClick={() => addChapterChangeRow(chapterIdx)}>
          <Plus className="w-4 h-4 mr-1" /> Add Change Entry
        </Button>
      </CardContent>
    </Card>
  );
}
