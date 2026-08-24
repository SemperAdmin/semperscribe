#!/usr/bin/env python3
"""Independent verifier for the NAVMC 10132 round-trip harness.

Reads the filled output with pypdf rather than pdf-lib, so a bug in pdf-lib's
own reader cannot make the harness confirm itself. Asserts:

  1. All 74 fields still present.
  2. 67 non-signature fields carry a value.
  3. The 7 signature widgets carry none.
  4. The read-only flag was RESTORED on all 4 unlocked fields. Whether those
     fields carry a value is a document-completeness question, not a harness
     question, so it is asserted only under --full. Items 23-25 must be
     populated on any real UPB per MCO 011103, and that is blocker V-10 in the
     Phase 4 validators, not this tool's job.
  5. Findings dropdowns hold EXPORT values ("Guilty"), never display text ("G").
  6. /Root/Perms state matches what was requested.

Usage:
    python verify_10132_roundtrip.py <filled.pdf> [--full] [--expect-perms]

    --full          assert all 67 writable fields carry a value, and that the
                    4 unlocked read-only fields were written (sentinel run)
    --expect-perms  assert /Root/Perms is still present
"""
import sys
import warnings

warnings.filterwarnings("ignore")

from pypdf import PdfReader
from pypdf.generic import IndirectObject

READ_ONLY_BIT = 1 << 0
UNLOCK_READ_ONLY = [
    "2 BOOKER",
    "23 ACCUSED FULL NAME",
    "24 ACCUSED RANK/GRADE",
    "25 ACCUSED EDIPI",
]
FINDING_FIELDS = [f"1{c} FINDING" for c in "ABCDE"]
VALID_FINDING_EXPORTS = {" ", "Guilty", "Not Guilty"}


def resolve(value):
    while isinstance(value, IndirectObject):
        value = value.get_object()
    return value


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        return 2
    path = sys.argv[1]
    expect_perms = "--expect-perms" in sys.argv
    # --full asserts the sentinel case: every writable field carries a value.
    # Realistic fixtures fill only the fields their scenario uses.
    full = "--full" in sys.argv

    reader = PdfReader(path)
    root = resolve(reader.trailer["/Root"])
    perms = resolve(root.get("/Perms"))

    widgets = {}
    for page in reader.pages:
        for annot_ref in resolve(page.get("/Annots")) or []:
            annot = resolve(annot_ref)
            if annot.get("/T") is None:
                continue
            widgets[str(annot["/T"])] = annot

    failures = []

    def check(condition, message):
        if not condition:
            failures.append(message)

    check(len(widgets) == 74, f"field count is {len(widgets)}, expected 74")

    signatures = [n for n, a in widgets.items() if str(a.get("/FT")) == "/Sig"]
    check(len(signatures) == 7, f"{len(signatures)} signature widgets, expected 7")
    for name in signatures:
        check(
            resolve(widgets[name].get("/V")) is None,
            f"signature widget was written: {name}",
        )

    valued = [
        n
        for n, a in widgets.items()
        if str(a.get("/FT")) != "/Sig" and resolve(a.get("/V")) not in (None, "")
    ]
    if full:
        check(len(valued) == 67, f"{len(valued)} fields carry a value, expected 67")

    for name in UNLOCK_READ_ONLY:
        annot = widgets.get(name)
        check(annot is not None, f"missing read-only field: {name}")
        if annot is None:
            continue
        if full:
            check(
                resolve(annot.get("/V")) not in (None, ""),
                f"read-only field was not written: {name}",
            )
        check(
            int(annot.get("/Ff") or 0) & READ_ONLY_BIT,
            f"read-only flag was NOT restored: {name}",
        )

    for name in FINDING_FIELDS:
        value = str(resolve(widgets[name].get("/V")))
        check(
            value in VALID_FINDING_EXPORTS,
            f"{name} holds {value!r}, which is display text, not an export value",
        )

    has_perms = bool(perms)
    check(
        has_perms == expect_perms,
        f"/Root/Perms present={has_perms}, expected {expect_perms}",
    )

    print(f"file      : {path}")
    print(f"fields    : {len(widgets)}")
    print(f"valued    : {len(valued)}")
    print(f"signatures: {len(signatures)} empty")
    print(f"/Perms    : {list(perms.keys()) if perms else 'absent'}")
    for name in FINDING_FIELDS[:1]:
        print(f"{name}: {resolve(widgets[name].get('/V'))!r}")
    print(f"2 BOOKER  : {str(resolve(widgets['2 BOOKER'].get('/V')))[:70]}...")

    if failures:
        print(f"\nVERIFY: FAIL ({len(failures)})")
        for message in failures:
            print(f"  - {message}")
        return 1
    print("\nVERIFY: PASS")
    return 0


if __name__ == "__main__":
    sys.exit(main())
