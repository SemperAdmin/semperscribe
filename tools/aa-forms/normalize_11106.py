#!/usr/bin/env python3
"""Generate the bundled NAVMC 11106 blank and field map. Spec section 7.

The source is a STATIC XFA form: real page content, an AcroForm widget for
every field. Removing the XFA layer leaves a plain fillable form that takes
the 10132 route through src/lib/acroform-fill.ts.

Usage:
    python tools/aa-forms/normalize_11106.py <NAVMC 11106 (EF).pdf> \
        public/forms/navmc-11106-blank.pdf tools/aa-forms/navmc11106-map.json

Requires pypdf and PyMuPDF. Fails loudly if the source revision changes.
"""
import hashlib
import json
import os
import sys
import tempfile

import pymupdf
from pypdf import PdfReader, PdfWriter
from pypdf.generic import (
    ArrayObject,
    DecodedStreamObject,
    FloatObject,
    NameObject,
    TextStringObject,
)

EXPECTED_SOURCE_SHA256 = "8d2bfef56dbc0a1ad75337968724b0a3ea4d92a19faad8875307c27ca13b2485"
PREFIX = "topmostSubform[0].Page1[0]."
DROP = {"PrintButton1[0]", "ResetButton1[0]"}
LABEL_RECT = pymupdf.Rect(474.0, 150.0, 490.0, 158.5)
LABEL_ORIGIN = (474.8, 157.2)
HELV_AUTO = "/Helv 0 Tf 0 g"
# Auto-size fills a multiline field's whole box, so these two are fixed.
FIXED_DA = {"DutyStatn[0]": "/Helv 10 Tf 0 g", "RemrkD3[0]": "/Helv 9 Tf 0 g"}
FF_MULTILINE = 1 << 12


def add_off_state(writer, widget):
    """pdf-lib regenerates a radio whose /AS is missing from /N, which redraws
    the form's X marks as round dots. The source ships only the on state."""
    normal = widget["/AP"]["/N"].get_object()
    if "/Off" in normal:
        return
    x0, y0, x1, y1 = [float(v) for v in widget["/Rect"]]
    off = DecodedStreamObject()
    off.update({
        NameObject("/Type"): NameObject("/XObject"),
        NameObject("/Subtype"): NameObject("/Form"),
        NameObject("/BBox"): ArrayObject(
            [FloatObject(0), FloatObject(0), FloatObject(x1 - x0), FloatObject(y1 - y0)]
        ),
    })
    off.set_data(b"")
    normal[NameObject("/Off")] = writer._add_object(off)


def strip_xfa(src, tmp):
    w = PdfWriter(clone_from=src)
    root = w._root_object
    af = root["/AcroForm"].get_object()
    del af[NameObject("/XFA")]
    for key in ("/Perms", "/NeedsRendering"):
        if key in root:
            del root[NameObject(key)]
    if "/Names" in root:
        names = root["/Names"].get_object()
        if "/JavaScript" in names:
            del names[NameObject("/JavaScript")]

    page = w.pages[0]
    kept = ArrayObject()
    for ref in page["/Annots"]:
        o = ref.get_object()
        if o.get("/T") in DROP:
            continue
        kept.append(ref)
        if o.get("/FT") == "/Tx":
            o[NameObject("/DA")] = TextStringObject(FIXED_DA.get(o.get("/T"), HELV_AUTO))
        if o.get("/T") == "SocSecNoApplc[0]":
            o[NameObject("/TU")] = TextStringObject("Enter applicant's 10-digit EDIPI.")
        parent = o["/Parent"].get_object() if "/Parent" in o else None
        if parent is not None and parent.get("/FT") == "/Btn" and "/AP" in o:
            add_off_state(w, o)
    page[NameObject("/Annots")] = kept

    def prune(node):
        kids = node.get("/Kids")
        if kids is None:
            return
        out = ArrayObject()
        for ref in kids:
            kid = ref.get_object()
            if kid.get("/T") in DROP:
                continue
            prune(kid)
            out.append(ref)
        node[NameObject("/Kids")] = out

    for ref in af["/Fields"]:
        prune(ref.get_object())
    af[NameObject("/DA")] = TextStringObject(HELV_AUTO)
    w.write(tmp)


def relabel(tmp, out):
    d = pymupdf.open(tmp)
    page = d[0]
    page.add_redact_annot(LABEL_RECT)
    page.apply_redactions(
        images=pymupdf.PDF_REDACT_IMAGE_NONE,
        graphics=pymupdf.PDF_REDACT_LINE_ART_NONE,
    )
    page.insert_text(LABEL_ORIGIN, "EDIPI", fontname="helv", fontsize=7.0)
    d.save(out, garbage=3, deflate=True)
    d.close()


def verify(out):
    r = PdfReader(out)
    root = r.trailer["/Root"]
    af = root["/AcroForm"].get_object()
    assert "/XFA" not in af, "XFA survived"
    assert "/Perms" not in root, "usage rights survived"
    fields = r.get_fields()
    names = {k.split(".")[-1] for k in fields}
    assert not (names & DROP), names & DROP
    assert {"SigMem[0]", "SigCO[0]"} <= names
    for key, value in fields.items():
        assert value.get("/V") in (None, ""), (key, value.get("/V"))
    page = pymupdf.open(out)[0]
    text = page.get_text()
    assert "EDIPI" in text and "SSN" not in text
    assert len(page.search_for("EDIPI")) == 1


def build_map(out, source_sha):
    r = PdfReader(out)
    fields = {}
    for ref in r.pages[0]["/Annots"]:
        o = ref.get_object()
        parent = o["/Parent"].get_object() if "/Parent" in o else None
        if parent is not None and parent.get("/FT") == "/Btn":
            title = str(parent["/T"])
            entry = fields.setdefault(
                title, {"name": PREFIX + title, "type": "/Btn", "flags": ["radio"], "exportValues": []}
            )
            normal = o["/AP"]["/N"].get_object()
            entry["exportValues"] += [str(k)[1:] for k in normal.keys() if k != "/Off"]
            entry["exportValues"].sort()
        else:
            title = str(o["/T"])
            ff = int(o.get("/Ff", 0))
            entry = {"name": PREFIX + title, "type": str(o["/FT"]), "flags": []}
            if ff & FF_MULTILINE:
                entry["flags"].append("multiline")
            if o.get("/MaxLen") is not None:
                entry["maxLength"] = int(o["/MaxLen"])
            fields[title] = entry
    return {
        "form": "NAVMC 11106 (REV. 1-89) (EF)",
        "container": "AcroForm",
        "sourceSha256": source_sha,
        "fieldCount": len(fields),
        "fields": sorted(fields.values(), key=lambda f: f["name"]),
    }


def main():
    src, out, map_path = sys.argv[1], sys.argv[2], sys.argv[3]
    with open(src, "rb") as fh:
        sha = hashlib.sha256(fh.read()).hexdigest()
    if sha != EXPECTED_SOURCE_SHA256:
        raise SystemExit(f"Source changed: {sha}. Re-verify the spec before regenerating.")
    with tempfile.TemporaryDirectory() as td:
        tmp = os.path.join(td, "stripped.pdf")
        strip_xfa(src, tmp)
        relabel(tmp, out)
    verify(out)
    with open(map_path, "w", encoding="utf-8", newline="\n") as fh:
        json.dump(build_map(out, sha), fh, indent=2)
        fh.write("\n")
    print("ok", out, os.path.getsize(out))


if __name__ == "__main__":
    main()
