#!/usr/bin/env python3
"""NAVMC 10922 flattened-render layout extractor.

Generates the layout JSON that drives the programmatic flattened
renderer (src/services/pdf/navmc10922Generator.ts). Everything comes
from the form's own template.xml: static labels (draw elements), field
cell rectangles, radio option boxes, the five unbindable checkboxes,
and the master-page overlays (CUI artwork, form number footer).

Bound cells carry the SAME map index as tools/aa-forms/navmc10922-map.json
and the positional emitter, so the renderer places value[i] into
cell[i] with no name lookup - identical addressing to the XFA path.

Usage:
    python3 extract_10922_layout.py <blank.pdf> <layout.json>

Coordinates: millimetres, top-left origin, page-absolute (content
subform offsets of 12.7mm applied; master overlays are already page
coordinates). The renderer converts to pdf points and flips Y.
"""

import json
import sys

import pikepdf
from lxml import etree

CONTENT_X = 12.7
CONTENT_Y = 12.7

SKIP_FIELDS = {"PrintButton1", "ResetButton2", "CurrentPage", "PageCount"}


def ln(e):
    return e.tag.split("}")[-1] if isinstance(e.tag, str) else "#"


def mm(v):
    """'12.7mm' | '7.5in' | '4in' | None -> float mm."""
    if not v:
        return 0.0
    v = v.strip()
    if v.endswith("mm"):
        return float(v[:-2])
    if v.endswith("in"):
        return float(v[:-2]) * 25.4
    if v.endswith("pt"):
        return float(v[:-2]) * 25.4 / 72.0
    return float(v)


def text_of(e):
    return " ".join("".join(e.itertext()).split())


def visible_text(draw):
    """A draw's VISIBLE text only - the <value> subtree. itertext over
    the whole draw would concatenate assist/toolTip/speak strings into
    the label (the CUI header carries a screen-reader duplicate).
    exData <br/> elements become newlines."""
    for c in draw:
        if ln(c) != "value":
            continue
        for v in c:
            k = ln(v)
            if k == "text":
                return " ".join((v.text or "").split())
            if k == "exData":
                parts = []

                def walk(el):
                    if ln(el) == "br":
                        parts.append("\n")
                    if el.text:
                        parts.append(el.text)
                    for child in el:
                        if isinstance(child.tag, str):
                            walk(child)
                            if ln(child) == "p":
                                parts.append("\n")
                        if child.tail:
                            parts.append(child.tail)

                walk(v)
                joined = "".join(parts)
                return "\n".join(" ".join(l.split()) for l in joined.split("\n")).strip()
    return ""


def caption_of(e):
    for c in e:
        if ln(c) == "caption":
            return text_of(c)
    return ""


def para_of(e):
    """Direct-child <para> alignment: (hAlign, vAlign). XFA defaults
    are left/top; only explicit values are returned."""
    for c in e:
        if ln(c) == "para":
            return c.get("hAlign"), c.get("vAlign")
    return None, None


def caption_meta(e):
    """(placement, reserve_mm, hAlign) of the field's caption."""
    for c in e:
        if ln(c) == "caption":
            ha = None
            for p in c:
                if ln(p) == "para":
                    ha = p.get("hAlign")
            return c.get("placement"), (mm(c.get("reserve")) if c.get("reserve") else None), ha
    return None, None, None


def apply_align(entry, e):
    ha, va = para_of(e)
    if ha and ha != "left":
        entry["ha"] = ha
    if va and va != "top":
        entry["va"] = va


def font_size(e):
    """Nearest declared font size in pt, else None."""
    for f in e.iter():
        if ln(f) == "font" and f.get("size"):
            return mm(f.get("size")) * 72.0 / 25.4
    return None


def ui_kind(e):
    for c in e:
        if ln(c) == "ui":
            kinds = [ln(g) for g in c if isinstance(g.tag, str)]
            return ",".join(kinds)
    return "exclGroup" if ln(e) == "exclGroup" else ""


def border_edges(e):
    """Element-level border -> 4 edge specs [visible, thickness_mm] in
    XFA order top, right, bottom, left. A single edge applies to all
    four; unspecified edges inherit the LAST specified edge (XFA
    default). Returns None when nothing is visible - the renderer
    draws no lines for those elements."""
    for b in e:
        if ln(b) != "border":
            continue
        if b.get("presence") == "hidden":
            return None
        edges = []
        for g in b:
            if ln(g) != "edge":
                continue
            visible = g.get("presence") != "hidden"
            thickness = mm(g.get("thickness")) if g.get("thickness") else 0.1753
            edges.append([visible, round(thickness, 3)])
        if not edges:
            # border present with no edge children = default visible box
            edges = [[True, 0.1753]]
        while len(edges) < 4:
            edges.append(list(edges[-1]))
        if not any(v for v, _ in edges):
            return None
        return edges[:4]
    return None


def has_global_bind(e):
    return any(ln(c) == "bind" and c.get("match") == "global" for c in e)


def has_any_bind(e):
    return any(ln(c) == "bind" for c in e)


def option_boxes(group):
    opts = []
    for f in group:
        if ln(f) != "field":
            continue
        value = None
        for items in f:
            if ln(items) == "items":
                texts = ["".join(g.itertext()) for g in items if isinstance(g.tag, str)]
                if texts:
                    value = texts[0]
        opts.append({
            "value": value,
            "caption": caption_of(f),
            "x": mm(f.get("x")),
            "y": mm(f.get("y")),
            "w": mm(f.get("w")) or 6.35,
            "h": mm(f.get("h")) or 6.35,
        })
    return opts


def extract(blank_path):
    pdf = pikepdf.open(blank_path)
    xfa = pdf.Root.AcroForm.XFA
    template = None
    for i in range(0, len(xfa), 2):
        if str(xfa[i]) == "template":
            template = bytes(xfa[i + 1].read_bytes())
    root = etree.fromstring(template)

    # The map-index order: no-bind nodes in document order, then
    # global-bind deduped - identical to extract_10922_map.py.
    local_nodes, global_nodes, seen = [], [], set()
    for e in root.iter():
        if not isinstance(e.tag, str):
            continue
        if ln(e) not in ("field", "exclGroup"):
            continue
        name = e.get("name")
        if not name or name in SKIP_FIELDS:
            continue
        if has_global_bind(e):
            if name in seen:
                continue
            seen.add(name)
            global_nodes.append(e)
        elif not has_any_bind(e):
            local_nodes.append(e)
    index_of = {id(e): i for i, e in enumerate(local_nodes + global_nodes)}
    # Global-bind fields render on more than one page (NameOfMarine
    # repeats on page 2) but dedupe to one datasets node - map every
    # occurrence to the shared index BY NAME.
    global_index = {e.get("name"): len(local_nodes) + i for i, e in enumerate(global_nodes)}

    # Page subforms: children of the root form1 subform, in order.
    form1 = next(c for c in root if ln(c) == "subform")
    page_subforms = [c for c in form1 if ln(c) == "subform" and c.get("name") != "designer__stylesheet"]

    def which_page(e):
        a = e
        while a is not None:
            for i, ps in enumerate(page_subforms):
                if a is ps:
                    return i
            a = a.getparent()
        return None  # master overlay (direct child of form1)

    pages = [{"labels": [], "cells": [], "checkboxes": []} for _ in page_subforms]
    master = []

    for e in root.iter():
        if not isinstance(e.tag, str):
            continue
        kind = ln(e)
        if kind == "draw":
            if e.getparent() is not None and e.getparent().get("name") == "designer__stylesheet":
                continue
            txt = visible_text(e)
            if not txt:
                continue
            pg = which_page(e)
            entry = {
                "x": mm(e.get("x")), "y": mm(e.get("y")),
                "w": mm(e.get("w")) or 60.0, "h": mm(e.get("h")) or 6.35,
                "text": txt, "size": font_size(e),
            }
            if e.get("rotate"):
                # Section sidebar headers rotate 90 degrees. XFA rotates
                # around the anchor with w/h staying pre-rotation - the
                # renderer handles placement.
                entry["rotate"] = int(e.get("rotate"))
            apply_align(entry, e)
            edges = border_edges(e)
            if edges:
                entry["edges"] = edges
            if pg is None:
                master.append(entry)
            else:
                entry["x"] += CONTENT_X
                entry["y"] += CONTENT_Y
                pages[pg]["labels"].append(entry)
        elif kind in ("field", "exclGroup"):
            name = e.get("name")
            if name in SKIP_FIELDS:
                continue
            if ln(e.getparent()) == "exclGroup":
                continue  # option boxes ride on their group
            pg = which_page(e)
            if pg is None:
                continue  # buttons in the root area
            rect = {
                "x": mm(e.get("x")) + CONTENT_X, "y": mm(e.get("y")) + CONTENT_Y,
                "w": mm(e.get("w")) or 25.4, "h": mm(e.get("h")) or 6.35,
            }
            if not name:
                # the five unbindable checkboxes
                cb = {**rect, "caption": caption_of(e)}
                cb_edges = border_edges(e)
                if cb_edges:
                    cb["edges"] = cb_edges
                pages[pg]["checkboxes"].append(cb)
                continue
            idx = index_of.get(id(e))
            if idx is None and has_global_bind(e):
                idx = global_index.get(name)
            cell = {
                **rect,
                "index": idx,
                "kind": "radio" if kind == "exclGroup" else ui_kind(e),
                "caption": caption_of(e),
            }
            apply_align(cell, e)
            cap_place, cap_reserve, cap_ha = caption_meta(e)
            if cap_place:
                cell["capPlace"] = cap_place
            if cap_reserve:
                cell["capReserve"] = round(cap_reserve, 3)
            if cap_ha and cap_ha != "left":
                cell["capHa"] = cap_ha
            if kind == "exclGroup":
                cell["options"] = option_boxes(e)
            edges = border_edges(e)
            if edges:
                cell["edges"] = edges
            pages[pg]["cells"].append(cell)

    return {
        "form": "NAVMC 10922 (7-21) (EF)",
        "pageSize": {"wPt": 612, "hPt": 792},
        "content": {"x": CONTENT_X, "y": CONTENT_Y, "w": 190.5, "h": 247.65},
        "master": master,
        "pages": pages,
    }


MM_TO_PT = 72 / 25.4


def calibrate_marks(layout, background_pdf):
    """Snaps every radio-option and checkbox X target to the printed
    square actually drawn on the flattened background (an Adobe print
    positions its widgets slightly differently from the raw template
    geometry - measured 2.8pt systematic, 14.8pt on START). Stores
    cx/cy in POINTS, top-left origin, on each option/checkbox."""
    import pdfplumber

    with pdfplumber.open(background_pdf) as pdf:
        page_squares = []
        for pg in pdf.pages:
            squares = []
            for r in pg.rects:
                w = r["x1"] - r["x0"]
                h = r["bottom"] - r["top"]
                if 5 < w < 14 and 5 < h < 14:
                    squares.append(((r["x0"] + r["x1"]) / 2, (r["top"] + r["bottom"]) / 2))
            page_squares.append(squares)

    snapped = unsnapped = 0
    for pg_index, page in enumerate(layout["pages"]):
        squares = page_squares[pg_index] if pg_index < len(page_squares) else []

        def snap(box_x_mm, box_y_mm, box_w_mm, box_h_mm, target):
            nonlocal snapped, unsnapped
            ex = (box_x_mm + box_w_mm / 2) * MM_TO_PT
            ey = (box_y_mm + box_h_mm / 2) * MM_TO_PT
            ranked = sorted(
                (((sx - ex) ** 2 + (sy - ey) ** 2) ** 0.5, sx, sy) for sx, sy in squares
            )
            # 28pt reach covers the worst measured widget drift (23pt on
            # TYPE OF SERVICE); the ambiguity guard refuses any snap the
            # runner-up square nearly ties (square pitch is >=36pt, so a
            # clean snap wins by a wide margin).
            if ranked and ranked[0][0] <= 28 and (len(ranked) < 2 or ranked[1][0] - ranked[0][0] >= 8):
                target["cx"] = round(ranked[0][1], 1)
                target["cy"] = round(ranked[0][2], 1)
                snapped += 1
            else:
                unsnapped += 1

        for cell in page["cells"]:
            if cell["kind"] != "radio":
                continue
            for opt in cell.get("options", []):
                snap(cell["x"] + opt["x"], cell["y"] + opt["y"], opt["w"], opt["h"], opt)
        for cb in page["checkboxes"]:
            snap(cb["x"], cb["y"], cb["w"], cb["h"], cb)
    print(f"calibration: {snapped} marks snapped to printed squares, {unsnapped} unsnapped")


def main():
    if len(sys.argv) not in (3, 4):
        print(__doc__)
        raise SystemExit(2)
    layout = extract(sys.argv[1])
    if len(sys.argv) == 4:
        calibrate_marks(layout, sys.argv[3])
    with open(sys.argv[2], "w", encoding="utf-8") as fh:
        json.dump(layout, fh, indent=1)
        fh.write("\n")
    counts = [
        (len(p["labels"]), len(p["cells"]), len(p["checkboxes"])) for p in layout["pages"]
    ]
    bound = sum(1 for p in layout["pages"] for c in p["cells"] if c["index"] is not None)
    print(f"OK: {len(layout['pages'])} pages, (labels,cells,checkboxes)={counts}, "
          f"bound cells={bound}, master overlays={len(layout['master'])}")


if __name__ == "__main__":
    main()
