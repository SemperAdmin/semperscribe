"""Prepare the DD Form 1561 (DEC 2017) blank for the app.

The official file (esd.whs.mil, "Updated 20241204") is a static XFA /
AcroForm hybrid, owner-password encrypted with an EMPTY user password, so
it opens without a password but pdf-lib cannot write it. This script:

  1. decrypts it (empty user password, no owner password needed),
  2. removes the AcroForm /XFA entry and the catalog /NeedsRendering flag,
     so every viewer (pdf.js in the app, Edge, Chrome, Adobe) uses the
     AcroForm widgets - the full static form - instead of the XFA layer,
  3. writes public/forms/dd-1561-blank.pdf.

Page content, field names and widget geometry are untouched.

Usage (pypdf required):
    python3 -I tools/forms/prepare_dd1561.py <official dd1561.pdf> public/forms/dd-1561-blank.pdf
"""
import sys

from pypdf import PdfReader, PdfWriter
from pypdf.generic import NameObject


def main(src: str, dst: str) -> None:
    reader = PdfReader(src)
    if reader.is_encrypted and not reader.decrypt(""):
        sys.exit("dd1561: could not open with an empty user password")
    writer = PdfWriter(clone_from=reader)
    root = writer._root_object
    acro = root.get("/AcroForm")
    if acro is not None:
        acro = acro.get_object()
        if NameObject("/XFA") in acro:
            del acro[NameObject("/XFA")]
    if NameObject("/NeedsRendering") in root:
        del root[NameObject("/NeedsRendering")]
    with open(dst, "wb") as fh:
        writer.write(fh)


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])
