/**
 * useVoiceInput: one recogniser per hook, created on the first mic press
 * (Phase A.4), transcripts appended to the active paragraph, and a clean
 * unsupported path.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useVoiceInput } from '@/hooks/useVoiceInput';

class FakeRecognition {
  static instances: FakeRecognition[] = [];
  continuous = false;
  interimResults = false;
  lang = '';
  onresult: ((e: unknown) => void) | null = null;
  onerror: ((e: unknown) => void) | null = null;
  onend: (() => void) | null = null;
  start = vi.fn();
  stop = vi.fn();
  constructor() { FakeRecognition.instances.push(this); }
}

const paragraphs = [{ id: 1, level: 1, content: 'Existing text' }, { id: 2, level: 1, content: '' }];

beforeEach(() => {
  FakeRecognition.instances = [];
  (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition = FakeRecognition;
});
afterEach(() => {
  delete (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition;
  vi.restoreAllMocks();
});

describe('useVoiceInput', () => {
  it('creates no recogniser until the mic is pressed, then exactly one', () => {
    const { result } = renderHook(() => useVoiceInput(paragraphs, vi.fn()));
    expect(FakeRecognition.instances).toHaveLength(0);
    act(() => result.current.toggleVoiceInput(1));
    act(() => result.current.toggleVoiceInput(1));
    act(() => result.current.toggleVoiceInput(2));
    expect(FakeRecognition.instances).toHaveLength(1);
  });

  it('appends a final transcript to the active paragraph and stops on end', () => {
    const update = vi.fn();
    const { result } = renderHook(() => useVoiceInput(paragraphs, update));
    act(() => result.current.toggleVoiceInput(1));
    const rec = FakeRecognition.instances[0];
    expect(result.current.activeVoiceInput).toBe(1);
    expect(rec.start).toHaveBeenCalledTimes(1);

    act(() => rec.onresult!({
      resultIndex: 0,
      results: [[{ transcript: 'more words' }]].map(r => Object.assign(r, { isFinal: true })),
    }));
    expect(update).toHaveBeenCalledWith(1, 'Existing text more words');

    act(() => rec.onend!());
    expect(result.current.activeVoiceInput).toBeNull();
  });

  it('uses the latest update callback without re-creating the recogniser', () => {
    const first = vi.fn();
    const second = vi.fn();
    const { result, rerender } = renderHook(({ update }) => useVoiceInput(paragraphs, update), {
      initialProps: { update: first },
    });
    act(() => result.current.toggleVoiceInput(2));
    rerender({ update: second });
    act(() => FakeRecognition.instances[0].onresult!({
      resultIndex: 0,
      results: [Object.assign([{ transcript: 'hello' }], { isFinal: true })],
    }));
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith(2, 'hello');
    expect(FakeRecognition.instances).toHaveLength(1);
  });

  it('alerts when the browser has no speech recognition', () => {
    delete (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition;
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const { result } = renderHook(() => useVoiceInput(paragraphs, vi.fn()));
    act(() => result.current.toggleVoiceInput(1));
    expect(alertSpy).toHaveBeenCalledTimes(1);
    expect(result.current.activeVoiceInput).toBeNull();
  });
});
