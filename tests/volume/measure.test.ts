import { describe, it, expect } from 'vitest';
import { measureText, wrapRuns } from '@/lib/volume/measure';

describe('measure', () => {
  it('measures width as sum of em widths x size', () => {
    // 5 digits at 0.5 em, 11pt = 5 * 0.5 * 11 = 27.5
    expect(measureText('12345', 11)).toBeCloseTo(27.5, 3);
  });
  it('wraps first line at firstLineX and run-over at runoverX', () => {
    const runs = [{ text: 'alpha beta gamma delta epsilon zeta eta theta' }];
    const lines = wrapRuns(runs, 144, 72, 300, 11);
    expect(lines.length).toBeGreaterThan(1);
    expect(lines[0].x).toBe(144);
    expect(lines[1].x).toBe(72);
  });
  it('keeps each segment tied to its source run', () => {
    const runs = [{ text: 'plain ', }, { text: 'changed', changed: true }];
    const lines = wrapRuns(runs, 72, 72, 540, 11);
    const flagged = lines.flatMap(l => l.segments).find(s => s.run.changed);
    expect(flagged?.text).toContain('changed');
  });
});
