# SemperScribe Demo Script - Next Meeting of the Minds

Purpose: close the four false gaps the 2026-07-15 demo created, then show the capabilities DonDocs lacks. Target runtime: 12 minutes. Every step below runs against a plain browser with no prior state - rehearse once on the presentation machine.

## Setup before the meeting (5 minutes, off camera)

1. Open the app, Settings, Profile: fill name, rank, unit, SSIC. Save.
2. Save three drafts with distinct subjects so the Document Library has content.
3. Put a 2-3 row CSV (name, unit columns) on the desktop for the batch demo.
4. Put one small PDF (a certificate or memo) on the desktop for the enclosure demo.
5. Set Settings, Data, Auto Backup to a visible folder like Desktop\SemperScribe Backups.
6. In Edge: browser menu, Apps, Install SemperScribe. Confirm the desktop icon.

## Segment 1 - Close the false gaps (4 minutes)

These four exist today and were absent from the last demo. Say the feature name, show it, move on.

1. Profiles: open Settings, show the filled profile, new naval letter, point at the pre-filled From, signature block, and unit header.
2. Dark mode: Settings, Appearance, toggle it. One sentence, toggle back.
3. DOCX export: Export menu, Word Document. Open the download, show the formatting.
4. Batch generate: Export, Batch Generate. Import the desktop CSV, map the name variable into To, generate - show the ZIP with one PDF per row. Say the sentence: "Every document, one ZIP, one click." (His live batch demo produced one file of three.)

## Segment 2 - Trust features (4 minutes)

5. Encrypted share link: File, Copy Share Link. Set a password, 7-day expiry, generate. Paste in a new tab: password prompt, wrong password refused, right password loads. Say: "The payload is AES-256 encrypted and rides the URL fragment - it never lands in a server log. Password travels separately. Links expire."
6. Document library: File, Document Library. Search, rename, duplicate, delete one draft. Say: "No ten-draft cap, nothing silently evicted."
7. Auto backup: save the draft, open the backup folder, show the timestamped .nldp appear. Say: "Clearing the browser costs nothing - these re-import."
8. Offline: open the installed desktop app, DevTools offline mode (or pull the network), author a paragraph, export a PDF. Say: "Full function in a disconnected space."

## Segment 3 - What DonDocs does not have (3 minutes)

9. Marking validation: enable Classification Markings on a letter, set banner CUI, portion-mark one paragraph SECRET. Point at the fail: "The banner must equal or exceed the highest portion. The tool checks the rule, not only prints the marking." Fix it, export, show banner top and bottom of every page plus the designation block.
10. Undo: delete a paragraph, replace-all a word via Find and Replace, then Ctrl+Z twice - both operations reverse. 
11. Enclosure merge: attach the desktop PDF in Enclosures, show the auto-added enclosure line, export PDF, scroll to the cover page and merged pages.
12. Import: File, Import Word/PDF Document with any old letter - point at the detected document type. Say: "Paste nothing. It reformats."

## Close (1 minute)

- One sentence on the roadmap: 508 accessibility for the app.gov path, I-Type technical publications, and the guide (show the Correspondence Guide dialog for three seconds).
- Credit Cpl Chiofalo's work and restate the offer to collaborate - the room responds better to unity than rivalry, and Track A may need MIU.

## Rules

- Never type real PII or CUI during the demo. Use TESTER, I. M. and unit placeholders.
- If a step fails live, name it, move on, fix it after. No dwelling - his batch failure cost him credibility only when the room noticed him noticing.
