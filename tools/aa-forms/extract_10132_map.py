#!/usr/bin/env python3
"""Extract the NAVMC 10132 (Unit Punishment Book) AcroForm field map.

NAVMC 10132 is a plain AcroForm, unlike NAVMC 10274 / 118(11) / 10922 which are
LiveCycle XFA. There is no datasets.xml and no positional sequence: fields are
addressed by NAME. This script emits the machine-readable map that feeds the
emitter, the validators, and the round-trip test.

Two things this map records that a naive dump would lose:

  1. Choice fields carry /Opt entries that may be a bare string OR a two-element
     array. Per ISO 32000-1 Table 231 that array is [export value, display text],
     NOT the other way round. On this form the findings dropdowns are
     [['Guilty','G'], ['Not Guilty','NG']] - the SHORT strings are display only.
     An emitter that writes "G" writes an invalid export value. Export and
     display are therefore separate columns here.

  2. Character capacity. Every widget's /DA is "/Arial 8 Tf 0 g" and none of them
     auto-shrink, so overflow clips silently. Capacity is computed from the
     widget rectangle using Helvetica advance widths (metric-compatible stand-in
     for Arial, which is not embedded).

Usage:
    python extract_10132_map.py <blank.pdf> <out.json>

Companion: docs/NAVMC_10132_SPEC.md sections 2 and 11.
"""
import hashlib
import json
import re
import sys
import warnings

warnings.filterwarnings("ignore")

from pypdf import PdfReader
from pypdf.generic import IndirectObject

# Text field flags, ISO 32000-1 Table 228. Bit numbers are 1-indexed in the
# spec, so bit N has value 1 << (N - 1).
FF_READ_ONLY = 1 << 0
FF_REQUIRED = 1 << 1
FF_MULTILINE = 1 << 12
FF_PASSWORD = 1 << 13
FF_DO_NOT_SPELL_CHECK = 1 << 22
FF_DO_NOT_SCROLL = 1 << 23
FF_COMB = 1 << 24
FF_RICH_TEXT = 1 << 25
# Choice field flags, Table 230.
FF_COMBO = 1 << 17
FF_EDIT = 1 << 18
FF_SORT = 1 << 19
FF_MULTI_SELECT = 1 << 21

# Helvetica advance widths in 1/1000 em for the printable ASCII range, from the
# Adobe Core 14 AFM. Arial is metric-compatible with Helvetica.
HELV = {
    32: 278, 33: 278, 34: 355, 35: 556, 36: 556, 37: 889, 38: 667, 39: 191,
    40: 333, 41: 333, 42: 389, 43: 584, 44: 278, 45: 333, 46: 278, 47: 278,
    48: 556, 49: 556, 50: 556, 51: 556, 52: 556, 53: 556, 54: 556, 55: 556,
    56: 556, 57: 556, 58: 278, 59: 278, 60: 584, 61: 584, 62: 584, 63: 556,
    64: 1015, 65: 667, 66: 667, 67: 722, 68: 722, 69: 667, 70: 611, 71: 778,
    72: 722, 73: 278, 74: 500, 75: 667, 76: 556, 77: 833, 78: 722, 79: 778,
    80: 667, 81: 778, 82: 722, 83: 667, 84: 611, 85: 722, 86: 667, 87: 944,
    88: 667, 89: 667, 90: 611, 91: 278, 92: 278, 93: 278, 94: 469, 95: 556,
    96: 333, 97: 556, 98: 556, 99: 500, 100: 556, 101: 556, 102: 278, 103: 556,
    104: 556, 105: 222, 106: 222, 107: 500, 108: 222, 109: 833, 110: 556,
    111: 556, 112: 556, 113: 556, 114: 333, 115: 500, 116: 278, 117: 556,
    118: 500, 119: 722, 120: 500, 121: 500, 122: 500, 123: 334, 124: 260,
    125: 334, 126: 584,
}
DEFAULT_ADVANCE = 556

# A representative mixed-case entry. Capacity is a planning figure for the UI
# meters, so it is derived from realistic text rather than from an all-caps or
# all-lowercase extreme.
CAPACITY_SAMPLE = (
    "Restr to limits of H&S Co, 1st Bn, 3d Mar for 14 days w/o susp fr du"
)
PADDING_PT = 2.0          # per side, Acrobat's default widget inset
LINE_HEIGHT_FACTOR = 1.15  # multiline leading against the DA font size


def resolve(value):
    """Follow indirect references to the underlying object."""
    while isinstance(value, IndirectObject):
        value = value.get_object()
    return value


def average_advance(font_size):
    total = sum(HELV.get(ord(ch), DEFAULT_ADVANCE) for ch in CAPACITY_SAMPLE)
    return (total / len(CAPACITY_SAMPLE)) / 1000.0 * font_size


def da_font_size(da_string, fallback=8.0):
    """Pull the point size out of a default-appearance string such as
    '/Arial 8 Tf 0 g'. Size 0 means auto-size, which this form never uses."""
    if not da_string:
        return fallback
    match = re.search(r"([\d.]+)\s+Tf", str(da_string))
    if not match:
        return fallback
    size = float(match.group(1))
    return size if size > 0 else fallback


def text_flag_names(ff):
    names = []
    if ff & FF_READ_ONLY:
        names.append("readOnly")
    if ff & FF_REQUIRED:
        names.append("required")
    if ff & FF_MULTILINE:
        names.append("multiline")
    if ff & FF_PASSWORD:
        names.append("password")
    if ff & FF_DO_NOT_SPELL_CHECK:
        names.append("doNotSpellCheck")
    if ff & FF_DO_NOT_SCROLL:
        names.append("doNotScroll")
    if ff & FF_COMB:
        names.append("comb")
    if ff & FF_RICH_TEXT:
        names.append("richText")
    return names


def choice_flag_names(ff):
    names = ["combo" if ff & FF_COMBO else "list"]
    if ff & FF_EDIT:
        names.append("editable")
    if ff & FF_SORT:
        names.append("sorted")
    if ff & FF_MULTI_SELECT:
        names.append("multiSelect")
    if ff & FF_READ_ONLY:
        names.append("readOnly")
    if ff & FF_REQUIRED:
        names.append("required")
    return names


def split_options(raw_opts):
    """Return parallel export and display lists.

    ISO 32000-1 Table 231: an /Opt element is either a text string used for both
    purposes, or a two-element array [export value, display text].
    """
    exports, displays = [], []
    for entry in raw_opts or []:
        entry = resolve(entry)
        if isinstance(entry, str):
            exports.append(str(entry))
            displays.append(str(entry))
        else:
            pair = [str(resolve(x)) for x in entry]
            exports.append(pair[0])
            displays.append(pair[1] if len(pair) > 1 else pair[0])
    return exports, displays


def widget_javascript(annot):
    """Decode any /AA additional-action scripts hanging off the widget.

    These matter more on this form than on any other in the repo: the Booker
    statement, the item 23-25 identity copy, and the guilty-finding check are
    all JavaScript the app has to reimplement. Recording them here means the
    unit tests can be diffed against the real thing.
    """
    actions = {}
    aa = resolve(annot.get("/AA"))
    if not aa:
        return actions
    for trigger in aa:
        action = resolve(aa[trigger])
        script = resolve(action.get("/JS"))
        if script is None:
            continue
        if hasattr(script, "get_data"):
            script = script.get_data().decode("utf-8", "replace")
        actions[str(trigger)] = str(script)
    return actions


def sha256_of(path):
    digest = hashlib.sha256()
    with open(path, "rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def extract(pdf_path):
    reader = PdfReader(pdf_path)
    root = resolve(reader.trailer["/Root"])
    acroform = resolve(root["/AcroForm"])
    perms = resolve(root.get("/Perms"))

    fields = []
    for page_index, page in enumerate(reader.pages, start=1):
        for annot_ref in resolve(page.get("/Annots")) or []:
            annot = resolve(annot_ref)
            name = annot.get("/T")
            if name is None:
                continue
            field_type = str(annot.get("/FT")) if annot.get("/FT") else None
            ff = int(annot.get("/Ff") or 0)
            rect = [round(float(v), 2) for v in annot["/Rect"]]
            width = round(rect[2] - rect[0], 2)
            height = round(rect[3] - rect[1], 2)
            da = annot.get("/DA") or acroform.get("/DA")
            font_size = da_font_size(da)

            entry = {
                "name": str(name),
                "type": field_type,
                "page": page_index,
                "rect": rect,
                "width": width,
                "height": height,
                "ff": ff,
                "da": str(da) if da else None,
                "fontSize": font_size,
                "tooltip": str(annot["/TU"]) if annot.get("/TU") else None,
                "defaultValue": None,
                "javascript": widget_javascript(annot),
            }

            stored = resolve(annot.get("/V"))
            if stored is not None:
                entry["defaultValue"] = str(stored)

            if field_type == "/Tx":
                entry["flags"] = text_flag_names(ff)
                entry["maxLen"] = (
                    int(annot["/MaxLen"]) if annot.get("/MaxLen") is not None else None
                )
                advance = average_advance(font_size)
                usable = max(width - 2 * PADDING_PT, 0)
                if ff & FF_MULTILINE:
                    line_height = font_size * LINE_HEIGHT_FACTOR
                    lines = max(int((height - 2 * PADDING_PT) // line_height), 1)
                else:
                    lines = 1
                entry["lines"] = lines
                entry["capacity"] = int(usable // advance) * lines
            elif field_type == "/Ch":
                entry["flags"] = choice_flag_names(ff)
                exports, displays = split_options(resolve(annot.get("/Opt")))
                entry["exportValues"] = exports
                entry["displayValues"] = displays
                entry["optionCount"] = len(exports)
                # True when at least one option displays text that differs from
                # what must actually be written. Emitters must select by export.
                entry["exportDiffersFromDisplay"] = exports != displays
            elif field_type == "/Btn":
                entry["flags"] = text_flag_names(ff & (FF_READ_ONLY | FF_REQUIRED))
                appearance = resolve(annot.get("/AP")) or {}
                normal = resolve(appearance.get("/N")) or {}
                entry["states"] = [str(state) for state in normal.keys()]
                entry["onState"] = next(
                    (s for s in entry["states"] if s != "/Off"), None
                )
            elif field_type == "/Sig":
                entry["flags"] = []

            fields.append(entry)

    by_type = {}
    for field in fields:
        by_type[field["type"]] = by_type.get(field["type"], 0) + 1

    return {
        "form": "NAVMC 10132 (REV. 08-2023) (EF)",
        "container": "AcroForm",
        # Revision guard. The March 2025 posting on sja.marines.mil carries the
        # same 08-2023 revision string, so a filename or date tells you nothing.
        # A changed hash is the only reliable signal that the blank moved.
        "sourceSha256": sha256_of(pdf_path),
        "pages": len(reader.pages),
        "fieldCount": len(fields),
        "countsByType": by_type,
        "sigFlags": int(acroform.get("/SigFlags") or 0),
        "needAppearances": bool(acroform.get("/NeedAppearances")),
        "permsKeys": [str(k) for k in perms.keys()] if perms else [],
        "calculationOrder": [
            str(resolve(f).get("/T")) for f in (resolve(acroform.get("/CO")) or [])
        ],
        "capacityMethod": {
            "font": "Helvetica advance widths as a metric-compatible stand-in for Arial",
            "sample": CAPACITY_SAMPLE,
            "paddingPerSide": PADDING_PT,
            "lineHeightFactor": LINE_HEIGHT_FACTOR,
            "note": "No widget auto-shrinks. Overflow clips silently and without warning.",
        },
        "fields": fields,
    }


def main():
    if len(sys.argv) != 3:
        print(__doc__)
        return 2
    source, destination = sys.argv[1], sys.argv[2]
    data = extract(source)
    with open(destination, "w", encoding="utf-8") as handle:
        json.dump(data, handle, indent=2, ensure_ascii=False)
        handle.write("\n")

    print(f"{data['fieldCount']} fields -> {destination}")
    print(f"  source sha256: {data['sourceSha256']}")
    for field_type, count in sorted(data["countsByType"].items()):
        print(f"  {field_type}: {count}")
    print(f"  /Perms: {data['permsKeys'] or 'none'}")
    print(f"  calculation order: {data['calculationOrder']}")
    scripted = [f["name"] for f in data["fields"] if f["javascript"]]
    print(f"  widgets carrying JavaScript: {len(scripted)}")
    mismatched = [
        f["name"] for f in data["fields"] if f.get("exportDiffersFromDisplay")
    ]
    print(f"  choice fields whose export differs from display: {len(mismatched)}")
    for name in mismatched:
        print(f"      {name}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
