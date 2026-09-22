// tests/volume/appendix-panel.test.tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useVolumeStore, blankVolume } from '@/store/volumeStore';
import { AppendixPanel } from '@/components/volume/AppendixPanel';

// Task 22: appendix authoring had no editor UI at all - title, glossary
// term/definition rows, plain body blocks, and the divider change log could
// only be populated by hand-editing or importing a .nldp file.
describe('AppendixPanel (Task 22)', () => {
  beforeEach(() => useVolumeStore.getState().setDoc(blankVolume()));

  it('adds an appendix lettered "A" and shows it in the panel', () => {
    render(<AppendixPanel />);
    fireEvent.click(screen.getByRole('button', { name: /add appendix/i }));
    expect(useVolumeStore.getState().doc.appendices).toHaveLength(1);
    expect(useVolumeStore.getState().doc.appendices[0].letter).toBe('A');
    expect(screen.getByText('Appendix A')).toBeTruthy();
  });

  it('edits the appendix title and stores the value', () => {
    useVolumeStore.getState().addAppendix();
    render(<AppendixPanel />);
    fireEvent.change(screen.getByLabelText(/appendix a title/i), {
      target: { value: 'GLOSSARY OF ACRONYMS AND ABBREVIATIONS' },
    });
    expect(useVolumeStore.getState().doc.appendices[0].title).toBe('GLOSSARY OF ACRONYMS AND ABBREVIATIONS');
  });

  it('adds, edits, and removes a glossary row', () => {
    useVolumeStore.getState().addAppendix();
    render(<AppendixPanel />);
    fireEvent.click(screen.getByRole('button', { name: /add glossary row/i }));
    expect(useVolumeStore.getState().doc.appendices[0].glossary).toHaveLength(1);

    fireEvent.change(screen.getByLabelText(/glossary term 1/i), { target: { value: 'ABA' } });
    fireEvent.change(screen.getByLabelText(/glossary definition 1/i), {
      target: { value: 'American Bar Association' },
    });
    expect(useVolumeStore.getState().doc.appendices[0].glossary).toEqual([
      { term: 'ABA', definition: 'American Bar Association' },
    ]);

    fireEvent.click(screen.getByRole('button', { name: /remove appendix a glossary row 1/i }));
    expect(useVolumeStore.getState().doc.appendices[0].glossary).toHaveLength(0);
  });

  it('adds a body text block via the reused BlockEditor', () => {
    useVolumeStore.getState().addAppendix();
    render(<AppendixPanel />);
    fireEvent.click(screen.getByRole('button', { name: /add text/i }));
    expect(useVolumeStore.getState().doc.appendices[0].blocks).toHaveLength(1);
    fireEvent.change(screen.getByLabelText(/appendix a text 1/i), { target: { value: 'Plain appendix text.' } });
    expect(useVolumeStore.getState().doc.appendices[0].blocks[0].runs[0].text).toBe('Plain appendix text.');
  });

  it('adds a divider change-log row', () => {
    useVolumeStore.getState().addAppendix();
    render(<AppendixPanel />);
    fireEvent.click(screen.getByRole('button', { name: /add change entry/i }));
    expect(useVolumeStore.getState().doc.appendices[0].changeLog).toHaveLength(1);
  });

  it('removes an appendix and re-letters the survivor to A', () => {
    useVolumeStore.getState().addAppendix();
    useVolumeStore.getState().addAppendix();
    useVolumeStore.getState().updateAppendix(1, { title: 'Survivor' });
    render(<AppendixPanel />);
    fireEvent.click(screen.getByRole('button', { name: /remove appendix a$/i }));
    const { appendices } = useVolumeStore.getState().doc;
    expect(appendices).toHaveLength(1);
    expect(appendices[0].letter).toBe('A');
    expect(appendices[0].title).toBe('Survivor');
  });
});
