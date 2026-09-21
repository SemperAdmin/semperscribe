import sys, json
from pypdf import PdfReader
r = PdfReader(sys.argv[1])
rows = []
for pi, page in enumerate(r.pages):
    def visit(text, cm, tm, font, size, _pi=pi):
        t = text.strip()
        if t:
            rows.append({"page": _pi, "x": round(tm[4],1), "y": round(tm[5],1), "size": round(size or 0,1), "text": t})
    page.extract_text(visitor_text=visit)
print(json.dumps(rows))
