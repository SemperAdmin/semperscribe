#!/usr/bin/env python3
"""NAVMC 10922 positional map extractor and round-trip verifier.

The NAVMC 10922 (7-21) XFA form has non-unique field names: 77 of its
102 bound datasets nodes are named ParticipantName and 17 are named
RadioButtonList. Filling therefore has to be positional. This script is
the single source of truth for that position order. It derives the
order from template.xml the same way Adobe does when it synthesizes the
datasets DOM:

    1. fields and exclGroups carrying NO <bind> element, in document
       order (94 nodes), then
    2. fields carrying <bind match="global">, deduplicated by name, in
       document order (8 nodes).

The derivation is verified against the form's own shipped datasets
stream on every run - if Adobe ever revises the form, extraction fails
loudly instead of producing a stale map.

Usage:
    python3 extract_10922_map.py extract <blank.pdf> <map.json>
    python3 extract_10922_map.py verify  <blank.pdf> <map.json>

`extract` writes the positional map JSON.
`verify` fills the datasets stream with 102 indexed sentinel values via
the same stream-replacement approach the app uses (replace the stream
following the 'datasets' name in the AcroForm /XFA array), re-extracts,
and asserts every sentinel lands at its expected position.

Spec: docs/NAVMC_10922_SPEC.md sections 2-4.
"""

import json
import re
import sys

import pikepdf
from lxml import etree

MM = "mm"  # template coordinates are millimetre strings, kept verbatim

SKIP_FIELDS = {"PrintButton1", "ResetButton2", "CurrentPage", "PageCount"}

# Human captions for table cells whose template caption is empty.
# Index -> short semantic label, from docs/NAVMC_10922_SPEC.md section 3.
SEMANTIC_LABELS = {
    0: "dateOfApplication",
    1: "changeInDependents",          # radio: 2=LOSS 3=GAIN
    2: "edipi",
    3: "organizationStation",
    4: "futureAddressEta",
    5: "grade",
    6: "unitRuc",
    7: "ecc",
    8: "dateEnlistmentOrAd",
    9: "dateLastDischarge",
    10: "typeOfService",              # radio: 1=USMCR 2=USMC
    41: "custodianDepNo",
    42: "custodianName",
    43: "custodianAddress",
    44: "custodianRelationship",
    45: "spousePrevMarried",          # radio: 1=YES 2=NO
    46: "spousePrevMarriedTimes",
    47: "memberPrevMarried",          # radio: 1=YES 2=NO
    48: "memberPrevMarriedTimes",
    49: "marriageSpouseName",
    50: "marriagePlace",
    51: "marriageDate",
    72: "courtOrderInEffect",         # radio: 1=YES 2=NO
    73: "courtOrderDatePlace",
    74: "naturalParentInfo",
    75: "naturalParentArmedForces",   # radio: 1=YES 2=NO
    76: "spouseArmedForces",          # radio: 1=YES 2=NO
    77: "spouseEdipi",
    78: "spouseGrade",
    79: "spouseTypeOfService",        # radio: 2=REGULAR 1=RESERVE
    80: "spouseBranch",
    81: "spouseBaq",                  # radio: 2=WITH DEP 1=WITHOUT DEP
    82: "spouseServiceDates",
    83: "swornMonth",                 # choiceList January..December
    84: "swornYear2Digit",
    85: "swornDay",
    86: "approvedForDependentNumbers",
    87: "forwardedCmcDependentNumbers",
    88: "unitDiaryNo",
    89: "unitDiaryDated",
    90: "unitDiaryRuc",
    91: "unitDiaryClerkText",
    92: "cmcApprovingText",
    93: "documentsViewed",
    94: "nameOfMarine",
    95: "signatureOfMarine",
    96: "certEdipi",
    97: "certGrade",
    98: "signatureAttestingOfficer",
    99: "unitDesignation",
    100: "typedNameGradeCo",
    101: "signatureCo",
}

# Section 2 dependent grid: rows 1-6, columns in template document order.
DEP_COLS = ["name", "address", "relationship", "dateOfBirth", "allowanceClaimedFrom"]
for row in range(6):
    for col, colname in enumerate(DEP_COLS):
        SEMANTIC_LABELS[11 + row * 5 + col] = f"dependent{row + 1}_{colname}"

# Section 4 dissolution grid: rows 1-4. Per row, template document order:
# formerMarriageOf radio, reason radio, spouseName, place, date.
DISS_FIELDS = ["formerMarriageOf", "reason", "spouseName", "place", "date"]
for row in range(4):
    for col, colname in enumerate(DISS_FIELDS):
        SEMANTIC_LABELS[52 + row * 5 + col] = f"dissolution{row + 1}_{colname}"


def local_name(el):
    tag = el.tag
    return tag.split("}")[-1] if isinstance(tag, str) else "#"


def read_xfa_streams(pdf):
    out = {}
    xfa = pdf.Root.AcroForm.XFA
    for i in range(0, len(xfa), 2):
        out[str(xfa[i])] = bytes(xfa[i + 1].read_bytes())
    return out


def caption_text(el):
    for child in el:
        if local_name(child) == "caption":
            return " ".join("".join(child.itertext()).split())
    return ""


def ui_kind(el):
    for child in el:
        if local_name(child) == "ui":
            kinds = [local_name(g) for g in child if isinstance(g.tag, str)]
            return ",".join(kinds)
    return "exclGroup" if local_name(el) == "exclGroup" else ""


def picture_clause(el):
    """Return (kind, picture) for format/validate picture clauses."""
    for kind in ("format", "validate"):
        for child in el:
            if local_name(child) == kind:
                for pic in child.iter():
                    if local_name(pic) == "picture" and pic.text:
                        return kind, pic.text
    return None, None


def radio_options(el):
    """exclGroup children -> list of {value, caption, x, w}."""
    opts = []
    for field in el:
        if local_name(field) != "field":
            continue
        value = None
        for items in field:
            if local_name(items) == "items":
                texts = ["".join(g.itertext()) for g in items if isinstance(g.tag, str)]
                if texts:
                    value = texts[0]
        opts.append(
            {
                "value": value,
                "caption": caption_text(field),
                "x": field.get("x"),
                "w": field.get("w"),
            }
        )
    return opts


def has_global_bind(el):
    for child in el:
        if local_name(child) == "bind" and child.get("match") == "global":
            return True
    return False


def has_any_bind(el):
    return any(local_name(child) == "bind" for child in el)


def derive_order(template_root):
    """Positional order: no-bind nodes first, then global-bind deduped."""
    local_nodes, global_nodes, seen_global = [], [], set()
    for el in template_root.iter():
        if not isinstance(el.tag, str):
            continue
        kind = local_name(el)
        if kind not in ("field", "exclGroup"):
            continue
        name = el.get("name")
        if not name or name in SKIP_FIELDS:
            continue
        if has_global_bind(el):
            if name in seen_global:
                continue
            seen_global.add(name)
            global_nodes.append(el)
        elif not has_any_bind(el):
            local_nodes.append(el)
        # nodes with a non-global bind (match="none" etc.) do not emit
    return local_nodes + global_nodes


def datasets_sequence(datasets_bytes):
    return re.findall(rb"<([A-Za-z]+)\s*/>", datasets_bytes)


def build_map(blank_path):
    pdf = pikepdf.open(blank_path)
    streams = read_xfa_streams(pdf)
    template_root = etree.fromstring(streams["template"])
    ordered = derive_order(template_root)

    shipped = [s.decode() for s in datasets_sequence(streams["datasets"])]
    derived = [el.get("name") for el in ordered]
    if derived != shipped:
        for i, (a, b) in enumerate(zip(derived, shipped)):
            if a != b:
                raise SystemExit(
                    f"FATAL: derived order diverges from shipped datasets at "
                    f"index {i}: derived={a!r} shipped={b!r}. The form has "
                    f"changed - re-audit docs/NAVMC_10922_SPEC.md."
                )
        raise SystemExit(
            f"FATAL: length mismatch derived={len(derived)} shipped={len(shipped)}"
        )

    entries = []
    for idx, el in enumerate(ordered):
        kind, pic = picture_clause(el)
        entry = {
            "index": idx,
            "node": el.get("name"),
            "kind": local_name(el),
            "ui": ui_kind(el),
            "semantic": SEMANTIC_LABELS.get(idx, ""),
            "caption": caption_text(el),
            "x": el.get("x"),
            "y": el.get("y"),
            "w": el.get("w"),
            "h": el.get("h"),
            "bind": "global" if has_global_bind(el) else "none",
        }
        if pic:
            entry["pictureKind"] = kind
            entry["picture"] = pic
        if local_name(el) == "exclGroup":
            entry["options"] = radio_options(el)
        entries.append(entry)
    return {
        "form": "NAVMC 10922 (7-21) (EF)",
        "source": "template.xml document order, verified against shipped datasets",
        "nodeCount": len(entries),
        "spec": "docs/NAVMC_10922_SPEC.md",
        "nodes": entries,
    }


def replace_datasets(pdf, xml_bytes):
    """Replace the stream following the 'datasets' name in /XFA -
    the same operation src/lib/xfa-form-fill.ts performs with pdf-lib."""
    xfa = pdf.Root.AcroForm.XFA
    for i in range(0, len(xfa), 2):
        if str(xfa[i]) == "datasets":
            xfa[i + 1] = pdf.make_stream(xml_bytes)
            return
    raise SystemExit("FATAL: no datasets entry in /XFA array")


def sentinel_xml(map_data):
    parts = []
    for entry in map_data["nodes"]:
        node = entry["node"]
        if entry["kind"] == "exclGroup":
            values = [o["value"] for o in entry.get("options", []) if o["value"]]
            payload = values[0] if values else "1"
        else:
            payload = f"S{entry['index']:03d}"
        parts.append(f"<{node}>{payload}</{node}>")
    inner = "".join(parts)
    return (
        '<xfa:datasets xmlns:xfa="http://www.xfa.org/schema/xfa-data/1.0/">'
        f"<xfa:data><form1>{inner}</form1></xfa:data></xfa:datasets>"
    ).encode()


def cmd_extract(blank_path, map_path):
    map_data = build_map(blank_path)
    with open(map_path, "w", encoding="utf-8") as fh:
        json.dump(map_data, fh, indent=2)
        fh.write("\n")
    radios = sum(1 for n in map_data["nodes"] if n["kind"] == "exclGroup")
    pics = sum(1 for n in map_data["nodes"] if "picture" in n)
    print(
        f"OK: {map_data['nodeCount']} nodes ({radios} radio groups, "
        f"{pics} picture clauses) -> {map_path}"
    )


def cmd_verify(blank_path, map_path):
    with open(map_path, encoding="utf-8") as fh:
        map_data = json.load(fh)
    pdf = pikepdf.open(blank_path)
    replace_datasets(pdf, sentinel_xml(map_data))
    filled = "/tmp/navmc10922-sentinel.pdf"
    pdf.save(filled)
    pdf.close()

    refetched = read_xfa_streams(pikepdf.open(filled))["datasets"]
    pairs = re.findall(rb"<([A-Za-z]+)>([^<]*)</\1>", refetched)
    if len(pairs) != map_data["nodeCount"]:
        raise SystemExit(
            f"FAIL: round-trip node count {len(pairs)} != {map_data['nodeCount']}"
        )
    failures = 0
    for entry, (name, value) in zip(map_data["nodes"], pairs):
        name, value = name.decode(), value.decode()
        if name != entry["node"]:
            print(f"FAIL idx {entry['index']}: node {name!r} != {entry['node']!r}")
            failures += 1
            continue
        if entry["kind"] == "exclGroup":
            allowed = {o["value"] for o in entry.get("options", [])}
            if value not in allowed:
                print(f"FAIL idx {entry['index']}: radio value {value!r} not in {allowed}")
                failures += 1
        elif value != f"S{entry['index']:03d}":
            print(f"FAIL idx {entry['index']}: sentinel {value!r} misplaced")
            failures += 1
    if failures:
        raise SystemExit(f"FAIL: {failures} positional mismatches")
    print(f"OK: {len(pairs)} sentinels round-tripped in exact position ({filled})")


def main():
    if len(sys.argv) != 4 or sys.argv[1] not in ("extract", "verify"):
        print(__doc__)
        raise SystemExit(2)
    cmd, blank, map_path = sys.argv[1:]
    (cmd_extract if cmd == "extract" else cmd_verify)(blank, map_path)


if __name__ == "__main__":
    main()
