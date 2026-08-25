#!/usr/bin/env python3
"""Extract the JAGMAN Appendix A-1 forms as VERBATIM text.

Why this exists. Tier 1 generates JAGMAN Appendix A-1-c, A-1-d, A-1-f, and
A-1-g. Those are rights advisements and a hearing script, so a single reworded
sentence is a defect on a legal record. Nothing downstream is permitted to
author their wording. This tool is the only place the text enters the app, and
it copies rather than composes.

Source. JAGINST 5800.7G Change Transmittal 2, 1 Dec 23. CH-2 reissued pages
A-1-a through A-1-q in full, so CH-2 is the controlling text for every appendix
here regardless of what CH-1 said.

Appendix boundaries come from the page footers. Each page of the appendix ends
with a line holding only its own designator, so an appendix spans from the line
after the previous designator's LAST footer through its own last footer. That
beats searching for titles, which repeat inside cross-references in the body.

Usage:
    python extract_jagman_a1.py <JAGINST_5800.7G_CH-2.pdf> [-o out.json]

The PDF is NOT committed. The SHA-256 is recorded in the output so a future
re-extraction proves it read the same bytes.
"""
import argparse
import hashlib
import json
import re
import subprocess
import sys
import tempfile
from pathlib import Path

# Only the appendices Tier 1 and Tier 3 need. Widen deliberately, never by
# accident: every appendix added here becomes text the app reproduces.
WANTED = {
    'A-1-c': 'Nonjudicial punishment, accused notification and election of rights, vessel exception DOES apply',
    'A-1-d': 'Nonjudicial punishment, accused notification and election of rights, vessel exception does NOT apply',
    'A-1-e': 'Acknowledgement of advanced education assistance reimbursement',
    'A-1-f': 'Nonjudicial punishment proceeding guide, the commanding officer hearing script',
    'A-1-g': 'Nonjudicial punishment, accused acknowledgement of appeal rights',
    'A-1-h': 'Punitive letter of reprimand',
}

FOOTER = re.compile(r'^\s*(A-1-[a-q])\s*$')
RUNNING_HEAD = re.compile(r'^\s*JAGINST 5800\.7G,?\s*CH-2\s*$', re.I)


def pdf_to_text(pdf: Path) -> str:
    with tempfile.NamedTemporaryFile(suffix='.txt', delete=False) as tmp:
        out = Path(tmp.name)
    subprocess.run(
        ['pdftotext', '-layout', str(pdf), str(out)],
        check=True, capture_output=True,
    )
    return out.read_text(encoding='utf-8', errors='replace')


def appendix_spans(lines):
    """Map each designator to (start, end_exclusive) over `lines`."""
    footers = [(i, m.group(1)) for i, line in enumerate(lines)
               if (m := FOOTER.match(line))]
    if not footers:
        raise SystemExit('No A-1-x page footers found. Wrong PDF, or pdftotext '
                         'lost the footers. Extraction refuses to guess.')
    last = {}
    order = []
    for i, tag in footers:
        if tag not in last:
            order.append(tag)
        last[tag] = i
    spans, prev_end = {}, -1
    for tag in order:
        spans[tag] = (prev_end + 1, last[tag])
        prev_end = last[tag]
    return spans


def clean(block):
    """Strip running heads and page footers. Keep everything else BYTE FOR BYTE,
    including the underscore rules, the indentation, and the parenthetical
    notes. Blank-line runs collapse to one, which is layout rather than text."""
    kept, blanks = [], 0
    for raw in block:
        line = raw.rstrip()
        if FOOTER.match(line) or RUNNING_HEAD.match(line):
            continue
        if not line.strip():
            blanks += 1
            continue
        if kept and blanks:
            kept.append('')
        blanks = 0
        kept.append(line)
    return kept


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('pdf', type=Path)
    ap.add_argument('-o', '--out', type=Path, default=Path('jagman-a1.json'))
    args = ap.parse_args()

    if not args.pdf.exists():
        sys.exit(f'No such file: {args.pdf}')

    raw = args.pdf.read_bytes()
    sha = hashlib.sha256(raw).hexdigest()
    lines = pdf_to_text(args.pdf).split('\n')
    spans = appendix_spans(lines)

    missing = [t for t in WANTED if t not in spans]
    if missing:
        sys.exit(f'Appendices not found in this PDF: {missing}. Refusing to '
                 f'emit a partial source file.')

    out = {
        'source': {
            'instruction': 'JAGINST 5800.7G',
            'change': 'Change Transmittal 2',
            'changeDate': '2023-12-01',
            'note': ('CH-2 removed and reissued pages A-1-a through A-1-q in '
                     'full, so CH-2 controls every appendix below.'),
            'file': args.pdf.name,
            'sha256': sha,
        },
        'appendices': {},
    }

    for tag, description in WANTED.items():
        start, end = spans[tag]
        body = clean(lines[start:end])
        title = []
        for line in body[:6]:
            s = line.strip()
            if s.startswith('(See JAGMAN'):
                break
            if s and s.isupper():
                title.append(s)
            elif title:
                break
        out['appendices'][tag] = {
            'designator': tag,
            'title': ' '.join(title) if title else None,
            'description': description,
            'sourceLines': [start, end],
            'lineCount': len(body),
            'text': body,
        }

    args.out.write_text(json.dumps(out, indent=2, ensure_ascii=False) + '\n',
                        encoding='utf-8')

    print(f'source sha256 : {sha}')
    print(f'wrote         : {args.out}')
    for tag, entry in out['appendices'].items():
        print(f'  {tag}  {entry["lineCount"]:>4} lines  {entry["title"]}')


if __name__ == '__main__':
    main()
