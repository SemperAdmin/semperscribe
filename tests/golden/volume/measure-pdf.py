import sys, json
import pypdf
from pypdf import PdfReader

# pypdf 6.16.2 through 6.18.0 report the wrong position to visitor_text for
# some text. 6.16.2 stopped scaling TL by the font size, so after pdf-lib's
# "Tj T*" the next BT/Tm line (25.2pt lower against TL 24) looks like the
# same line. The extractor then prepends a space without refreshing
# memo_tm, and the run is reported at the identity matrix (x=0, y=0) that
# BT left behind. pypdf 6.18.1 fixed it with the `text_was_empty` check in
# TextExtraction._post_process_text_operation. Rows at (0, 0) land in every
# "y < 45" footer filter and corrupt the joined label (for example
# "SUMMARY OF SUBSTANTIVE CHANGES1-1"), so refuse to measure instead of
# returning wrong coordinates.
def _version_tuple(v):
    parts = []
    for p in v.split('.')[:3]:
        digits = ''.join(ch for ch in p if ch.isdigit())
        parts.append(int(digits or 0))
    return tuple(parts + [0] * (3 - len(parts)))

if (6, 16, 2) <= _version_tuple(pypdf.__version__) < (6, 18, 1):
    sys.exit(
        f"measure-pdf.py: pypdf {pypdf.__version__} reports wrong text positions "
        "(versions 6.16.2 to 6.18.0 are affected). Install pypdf>=6.18.1."
    )

r = PdfReader(sys.argv[1])
rows = []
for pi, page in enumerate(r.pages):
    def visit(text, cm, tm, font, size, _pi=pi):
        t = text.strip()
        if t:
            # Task 20: additive `font` field (the embedded font's BaseFont,
            # stripped of any subset tag prefix like "ABCDEF+") so callers
            # can assert bold/italic weight, not just position/size -
            # existing fields/consumers are unchanged.
            base = ''
            try:
                base = str(font.get('/BaseFont', '')).split('+')[-1]
            except Exception:
                base = ''
            rows.append({"page": _pi, "x": round(tm[4],1), "y": round(tm[5],1), "size": round(size or 0,1), "text": t, "font": base})
    page.extract_text(visitor_text=visit)
print(json.dumps(rows))
