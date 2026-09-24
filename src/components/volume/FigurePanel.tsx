import React, { useRef } from 'react';
import { useVolumeStore } from '@/store/volumeStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ImagePlus, Plus, Trash2 } from 'lucide-react';
import type { Chapter } from '@/lib/schemas/volume-schema';

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

/**
 * Finding 12: figure authoring had NO editor UI at all - a chapter's
 * `figures` (schema-supported, rendered by both generators) could only be
 * populated by hand-editing or importing a .nldp file. This is release-one
 * scope, per the finding's ruling:
 *  - Figure.anchor is accepted by the schema but NOT honored here - figures
 *    stay end-of-chapter (lib/volume/layout.ts's layoutBody appends them
 *    after every section), matching both generators' current placement.
 *  - No image size cap is enforced here; a very large data URL will bloat
 *    the exported .nldp/.docx/.pdf, but that's out of scope for this wave.
 */
export function FigurePanel({ chapter, chapterIdx }: { chapter: Chapter; chapterIdx: number }) {
  const addFigure = useVolumeStore((s) => s.addFigure);
  const updateFigure = useVolumeStore((s) => s.updateFigure);
  const removeFigure = useVolumeStore((s) => s.removeFigure);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file later
    if (!file) return;
    const dataUrl = await readAsDataUrl(file);
    addFigure(chapterIdx, { caption: '', image: dataUrl, legend: [] });
  };

  const addLegendLine = (figureIdx: number) => {
    const legend = [...(chapter.figures[figureIdx].legend ?? []), ''];
    updateFigure(chapterIdx, figureIdx, { legend });
  };
  const updateLegendLine = (figureIdx: number, lineIdx: number, text: string) => {
    const legend = [...(chapter.figures[figureIdx].legend ?? [])];
    legend[lineIdx] = text;
    updateFigure(chapterIdx, figureIdx, { legend });
  };
  const removeLegendLine = (figureIdx: number, lineIdx: number) => {
    const legend = (chapter.figures[figureIdx].legend ?? []).filter((_, i) => i !== lineIdx);
    updateFigure(chapterIdx, figureIdx, { legend });
  };

  return (
    <Card className="shadow-sm border-border">
      <CardHeader className="pb-3">
        <CardTitle as="h4" className="flex items-center text-sm font-semibold">
          <ImagePlus className="mr-2 h-4 w-4" /> Chapter {chapter.number} Figures
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {chapter.figures.map((figure, fi) => (
          <div key={fi} className="space-y-2 border border-border rounded-md p-3">
            <div className="flex items-center gap-2">
              {figure.image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={figure.image}
                  alt={figure.caption || `Figure ${figure.number}`}
                  className="h-16 w-24 object-contain border border-border rounded bg-muted/30"
                />
              )}
              <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-secondary/40 whitespace-nowrap">
                Figure {figure.number}
              </span>
              <Input
                placeholder="Caption"
                value={figure.caption}
                onChange={(e) => updateFigure(chapterIdx, fi, { caption: e.target.value })}
                aria-label={`Figure ${figure.number} caption`}
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => removeFigure(chapterIdx, fi)}
                aria-label={`Remove figure ${figure.number}`}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>

            <div className="space-y-1.5 pl-2">
              {(figure.legend ?? []).map((line, li) => (
                <div key={li} className="flex gap-2 items-center">
                  <Input
                    placeholder="Legend line"
                    value={line}
                    onChange={(e) => updateLegendLine(fi, li, e.target.value)}
                    aria-label={`Figure ${figure.number} legend line ${li + 1}`}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => removeLegendLine(fi, li)}
                    aria-label={`Remove figure ${figure.number} legend line ${li + 1}`}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={() => addLegendLine(fi)}>
                <Plus className="w-4 h-4 mr-1" /> Add Legend Line
              </Button>
            </div>
          </div>
        ))}

        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg"
            className="hidden"
            aria-label={`Upload figure image for chapter ${chapter.number}`}
            onChange={handleFileChange}
          />
          <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
            <ImagePlus className="w-4 h-4 mr-1" /> Add Figure (upload image)
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
