import React from 'react';
import { MetaPanel } from './MetaPanel';
import { ChapterTree } from './ChapterTree';

/** Volume document type editor: order/volume metadata + change log +
 * references (MetaPanel), then the chapter/section/paragraph/sub-paragraph
 * tree (ChapterTree). Reads and writes `useVolumeStore` directly. */
export function VolumeEditor() {
  return (
    <div className="space-y-6">
      <MetaPanel />
      <ChapterTree />
    </div>
  );
}
