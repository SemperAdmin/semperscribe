// tests/volume/editor.test.tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { VolumeEditor } from '@/components/volume/VolumeEditor';
import { useVolumeStore, blankVolume } from '@/store/volumeStore';

describe('VolumeEditor', () => {
  beforeEach(() => useVolumeStore.getState().setDoc(blankVolume()));
  it('shows the live section designator 0101', () => {
    render(<VolumeEditor />);
    expect(screen.getByText('0101')).toBeTruthy();
  });
  it('adds a chapter via the button', () => {
    render(<VolumeEditor />);
    fireEvent.click(screen.getByRole('button', { name: /add chapter/i }));
    expect(useVolumeStore.getState().doc.chapters).toHaveLength(2);
  });
});
