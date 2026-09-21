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

  // Finding 9: a hyperlink run is PAINTED bold-italic (pdf-lib's
  // TimesRomanBoldItalic - see volumeGenerator.ts's `fonts.link`), but used
  // to be MEASURED with the same regular-weight table as everything else.
  // Bold glyphs are wider, so wrapRuns under-estimated how much room a link
  // word actually needs, and could keep it (and whatever follows it) on a
  // line it doesn't fit on once painted with the real, wider font.
  describe('hyperlink runs measure bold-italic, not regular (finding 9)', () => {
    it('measures a link-flagged run wider than the same text as a plain run', () => {
      const word = 'MMMMMMMMMM'; // wide letters make the weight difference unambiguous
      const regular = measureText(word, 11, false);
      const bold = measureText(word, 11, true);
      expect(bold).toBeGreaterThan(regular);
    });

    it('wraps a line based on the link run\'s real (bold-italic) width, not its regular width', () => {
      const linkWord = 'MMMMMMMMMM';
      const firstLineX = 72;
      const prefix = 'x '; // pushes `used` off firstLineX before the link word
      const usedAfterPrefix = firstLineX + measureText(prefix, 11, false);
      const regularWidth = measureText(linkWord, 11, false);
      const boldWidth = measureText(linkWord, 11, true);
      expect(boldWidth).toBeGreaterThan(regularWidth); // precondition for the test to mean anything

      // A right edge that the link word fits under at its (wrong) regular
      // width, but NOT under its real bold-italic width - exactly the gap
      // the old code silently painted through.
      const rightEdge = usedAfterPrefix + regularWidth + 2;

      const runs = [{ text: prefix }, { text: linkWord, link: true, href: 'https://example.mil' }];
      const lines = wrapRuns(runs, firstLineX, firstLineX, rightEdge, 11);

      expect(lines.length).toBeGreaterThan(1);
      expect(lines[0].segments.map(s => s.text).join('')).not.toContain(linkWord);
      expect(lines[1].segments.map(s => s.text).join('')).toContain(linkWord);
    });

    it('does not affect the width of runs with no href (link flag alone is not enough)', () => {
      // A run with `link: true` but no `href` never paints as a link
      // (volumeGenerator.ts's own `isLink` check requires both) - measure it
      // the same way to match.
      const word = 'MMMMMMMMMM';
      const runs = [{ text: word, link: true }]; // no href
      const lines = wrapRuns(runs, 72, 72, 540, 11);
      const totalWidth = lines[0].segments.reduce((w, s) => w + measureText(s.text, 11, false), 0);
      expect(totalWidth).toBeCloseTo(measureText(word, 11, false), 3);
    });
  });
});
