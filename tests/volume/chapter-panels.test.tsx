// tests/volume/chapter-panels.test.tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useVolumeStore, blankVolume } from '@/store/volumeStore';
import { ChapterChangeLog } from '@/components/volume/ChapterChangeLog';
import { FigurePanel } from '@/components/volume/FigurePanel';

// Finding 11: chapter-level change logs had no authoring UI at all -
// MetaPanel only ever handled the volume-level changeLog.
describe('ChapterChangeLog (finding 11)', () => {
  beforeEach(() => useVolumeStore.getState().setDoc(blankVolume()));

  it('adds a chapter change row to the store', () => {
    const chapter = useVolumeStore.getState().doc.chapters[0];
    render(<ChapterChangeLog chapter={chapter} chapterIdx={0} />);
    fireEvent.click(screen.getByRole('button', { name: /add change entry/i }));
    expect(useVolumeStore.getState().doc.chapters[0].changeLog).toHaveLength(1);
  });

  it('edits a chapter change row field and stores the value', () => {
    useVolumeStore.getState().addChapterChangeRow(0);
    const chapter = useVolumeStore.getState().doc.chapters[0];
    render(<ChapterChangeLog chapter={chapter} chapterIdx={0} />);
    fireEvent.change(screen.getByLabelText(/change 1 version/i), { target: { value: '1.1' } });
    fireEvent.change(screen.getByLabelText(/change 1 summary/i), { target: { value: 'Initial change' } });
    const row = useVolumeStore.getState().doc.chapters[0].changeLog[0];
    expect(row.version).toBe('1.1');
    expect(row.summary).toBe('Initial change');
  });

  it('removes a chapter change row from the store', () => {
    useVolumeStore.getState().addChapterChangeRow(0);
    const chapter = useVolumeStore.getState().doc.chapters[0];
    render(<ChapterChangeLog chapter={chapter} chapterIdx={0} />);
    fireEvent.click(screen.getByRole('button', { name: /remove chapter 1 change 1/i }));
    expect(useVolumeStore.getState().doc.chapters[0].changeLog).toHaveLength(0);
  });
});

// Finding 12: figure authoring had no editor UI at all - figures could
// only be populated by hand-editing or importing a .nldp file.
describe('FigurePanel (finding 12)', () => {
  beforeEach(() => useVolumeStore.getState().setDoc(blankVolume()));

  it('uploads an image and adds a figure carrying its data URL to the store', async () => {
    const chapter = useVolumeStore.getState().doc.chapters[0];
    render(<FigurePanel chapter={chapter} chapterIdx={0} />);
    const input = screen.getByLabelText(/upload figure image/i) as HTMLInputElement;
    // A small (4-byte) base64-worthy fixture standing in for a real PNG -
    // FigurePanel doesn't validate image content, only reads it as a data URL.
    const file = new File([new Uint8Array([137, 80, 78, 71])], 'test.png', { type: 'image/png' });
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(useVolumeStore.getState().doc.chapters[0].figures).toHaveLength(1);
    });
    const figure = useVolumeStore.getState().doc.chapters[0].figures[0];
    expect(figure.number).toBe(1);
    expect(figure.image).toMatch(/^data:image\/png;base64,/);
    expect(figure.legend).toEqual([]);
  });

  it('edits a figure caption and adds/removes legend lines', () => {
    useVolumeStore.getState().addFigure(0, { caption: '', image: 'data:image/png;base64,AA==', legend: [] });
    const chapter = useVolumeStore.getState().doc.chapters[0];
    render(<FigurePanel chapter={chapter} chapterIdx={0} />);

    fireEvent.change(screen.getByLabelText(/figure 1 caption/i), { target: { value: 'Sample Figure' } });
    expect(useVolumeStore.getState().doc.chapters[0].figures[0].caption).toBe('Sample Figure');

    fireEvent.click(screen.getByRole('button', { name: /add legend line/i }));
    expect(useVolumeStore.getState().doc.chapters[0].figures[0].legend).toEqual(['']);
  });

  it('removing a figure renumbers the remaining ones by position', () => {
    useVolumeStore.getState().addFigure(0, { caption: 'First', image: 'data:image/png;base64,AA==', legend: [] });
    useVolumeStore.getState().addFigure(0, { caption: 'Second', image: 'data:image/png;base64,AA==', legend: [] });
    useVolumeStore.getState().removeFigure(0, 0);
    const figures = useVolumeStore.getState().doc.chapters[0].figures;
    expect(figures).toHaveLength(1);
    expect(figures[0].caption).toBe('Second');
    expect(figures[0].number).toBe(1);
  });
});
