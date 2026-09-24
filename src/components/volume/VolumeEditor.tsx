import React from 'react';
import { MetaPanel } from './MetaPanel';
import { ChapterTree } from './ChapterTree';
import { AppendixPanel } from './AppendixPanel';

/** Volume document type editor: order/volume metadata + change log +
 * references (MetaPanel), then the chapter/section/paragraph/sub-paragraph
 * tree (ChapterTree), then (Task 22) the appendices panel. Reads and writes
 * `useVolumeStore` directly. */
export function VolumeEditor() {
  return (
    <div className="space-y-6">
      <MetaPanel />
      <ChapterTree />
      <AppendixPanel />
    </div>
  );
}
