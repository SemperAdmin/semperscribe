import { describe, it, expect } from 'vitest';
import { designatorX, textStartX, LEFT_MARGIN_PT, RUNOVER_X } from '@/lib/volume/volume-indent';

describe('volume indent', () => {
  it('places designators on the 36pt ladder', () => {
    expect(designatorX(1)).toBe(72);
    expect(designatorX(2)).toBe(108);
    expect(designatorX(3)).toBe(144);
    expect(designatorX(4)).toBe(180);
  });
  it('starts short designators text 36pt right', () => {
    // "A." at level 3 -> text at 180
    expect(textStartX(3, 'A.')).toBe(180);
    // "1." at level 4 -> text at 216
    expect(textStartX(4, '1.')).toBe(216);
  });
  it('pushes text past a wide paragraph token', () => {
    // "010301." is wider than one 36pt step; text lands beyond 144
    expect(textStartX(2, '010301.')).toBeGreaterThan(140);
    expect(textStartX(2, '010301.')).toBeLessThan(160);
  });
  it('run-over returns to the left margin', () => {
    expect(RUNOVER_X).toBe(LEFT_MARGIN_PT);
  });
});
