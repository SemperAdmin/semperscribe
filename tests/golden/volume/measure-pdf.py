import sys, json
from pypdf import PdfReader
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
