"""
Task 25 fix 4: counts a table's horizontal ROW-BOUNDARY lines on a given PDF
page within a given y-range, so a test can compare "how many rows does this
table have" between our own generated PDF and the real published PDF without
caring which drawing primitive either renderer used for the rule itself.

Our own PDF (pdf-lib, src/services/pdf/volumeGenerator.ts's 'table' case)
draws each row boundary as a STROKED line (a `m ... l ... S` moveto/lineto/
stroke sequence, one per full-width horizontal grid line). The real,
professionally-typeset Vol 17 PDF instead draws each boundary as a set of
thin FILLED rectangles (`x y w h re` immediately followed by `f`/`f*`, one per
column since the vertical column-border rects visually interrupt each
horizontal one) - see this task's report for the full measurement. Both
patterns are counted here; a page only ever uses one or the other, so summing
them is safe and this script works unmodified against either renderer's
output.

Usage: python measure-table-rows.py <pdf-path> <page-index> <y-low> <y-high>
Prints the number of DISTINCT row-boundary y-coordinates (rounded to 1
decimal place, so the same physical line's several per-column rect segments
collapse into one) found within [y-low, y-high] on that page.
"""
import re
import sys

from pypdf import PdfReader


def main() -> None:
    pdf_path, page_index, y_low, y_high = sys.argv[1], int(sys.argv[2]), float(sys.argv[3]), float(sys.argv[4])
    reader = PdfReader(pdf_path)
    page = reader.pages[page_index]
    content = page.get_contents()
    data = content.get_data().decode('latin1') if content is not None else ''

    ys: set[float] = set()

    # Pattern A: thin filled rectangles (`x y w h re` ... `f`/`f*`/`s`/`S`),
    # height < 5pt and width > 15pt (a real row-separator segment, not a
    # column's vertical border or an unrelated small glyph-clipping rect).
    for m in re.finditer(r'([\d.\-]+)\s+([\d.\-]+)\s+([\d.\-]+)\s+([\d.\-]+)\s+re\s*\n?\s*(f\*|f|S|s)', data):
        x, y, w, h = (float(v) for v in m.groups()[:4])
        if w > 15 and h < 5 and y_low < y < y_high:
            ys.add(round(y, 1))

    # Pattern B: stroked horizontal lines (`x1 y1 m x2 y2 l ... S`), our own
    # pdf-lib `drawLine` output - only horizontal ones (y1 == y2).
    for m in re.finditer(
        r'([\d.\-]+)\s+([\d.\-]+)\s+m\s*\n?\s*([\d.\-]+)\s+([\d.\-]+)\s+l\s*\n?\s*S',
        data,
    ):
        x1, y1, x2, y2 = (float(v) for v in m.groups())
        if abs(y1 - y2) < 0.01 and y_low < y1 < y_high:
            ys.add(round(y1, 1))

    print(len(ys))


if __name__ == '__main__':
    main()
