# Features

Detail behind the summary in the [README](../README.md). The 33 document types are listed in [DOCUMENT-TYPES.md](DOCUMENT-TYPES.md).

## Document editing

- **Dynamic forms.** Fields appear and are validated per document type.
- **Multi-level paragraphs.** Numbering such as 1., 1.a., 1.a.(1), with add, remove and reorder.
- **Voice input.** Dictation into paragraphs through the browser's Speech Recognition API (`src/hooks/useVoiceInput.ts`). Where the browser provides it, the browser vendor may process the audio. The cloud.gov response headers set `Permissions-Policy: microphone=()`, so dictation is not available on that deployment.
- **Spell check.** Client-side, with a military-specific dictionary and acronym detection.
- **References and enclosures.** Lettered references and numbered enclosures with structured input.
- **Via chain and distribution.** Routing through intermediate commands, copy-to lines and distribution statements.

## Import

- **Word and PDF import.** Upload an existing `.docx` or PDF. Fields, references, enclosures and paragraphs are extracted in the browser with rule-based parsing, shown in a review-and-confirm dialog, then loaded into the normal editor for a compliant re-export.
- **NLDP import.** Naval Letter Data Package files carry document data between tools. See [NLDP_FEATURE_GUIDE.md](NLDP_FEATURE_GUIDE.md).
- **Shareable links.** A full document state can be loaded from a compressed URL.

## Export and output

- **PDF** with per-document-type formatting.
- **DOCX** through the `docx` library.
- **AMHS plain text** for message systems.
- **Batch generation (mail merge).** Import a CSV, substitute `{{TOKEN}}` fields, and generate a ZIP of PDFs.
- **Signature placement** on generated PDF pages.
- **NLDP export** of the full document as a data package.
- **Sensitive-data check.** Before a PDF, DOCX, official form, batch, data package, AMHS text, NAVMC 10132 sheet or package merge is written, and before a backup-folder copy, the content is scanned for SSN and EDIPI patterns and PHI keyword clusters. A hit asks for acknowledgement; it does not block or rewrite the text, and it does not certify a document free of CUI, PII or classified material.

## Preview and proofreading

- **Live preview.** The PDF renders as you type, in a side panel on desktop and a dialog on mobile, with a compliance-issue banner.
- **Proofread checklist.** Four categories (Format, Framework, Typography and Grammar, Content) with Pass, Fail, Warn and Manual statuses.

## Settings and profile

- **Profile.** Unit (searchable RUC database), signature name, from title, originator code, rank and title, used to fill new documents.
- **Formatting defaults.** Header type (USMC, DON or DLA), body font, header color, AMHS classification and precedence.
- **Appearance.** Light, dark or system theme.
- **Backup folder.** Optional automatic copy of every library save to a folder you pick, in browsers that support the directory picker (Chrome and Edge).
- **Assistant.** GunnyBot provider and key. Off until you add a key. See the README's Privacy and security section for what it sends.

## Templates and drafts

- **Templates.** Global and unit-specific templates bundled with the site.
- **Document library.** Every save goes to an on-device IndexedDB library (search, rename, duplicate), opened from the File menu, with crash recovery and revision compare.

## AMHS messages

Date-time group in Zulu time, reference management with letter designators, NARR generation, a POC manager, message validation and a terminal-style preview.

## Classification markings

Banner level, CUI designation block and portion markings on output, off by default and enabled per document (`src/components/letter/ClassificationSection.tsx`).

## Headless companion

The `companion/` directory holds an HTTP server and an MCP stdio server that share one set of operations: list the document types, describe the fields a type takes, validate an NLDP package, and render it to PDF or DOCX. They are meant for an EDMS, a script or an agent, and render the same file the editor downloads.

```bash
npm run companion          # HTTP on http://127.0.0.1:7719
npm run companion:mcp      # MCP over stdio
```

The HTTP server binds loopback and has no authentication. The export sensitive-data check is mirrored: findings refuse the render until the caller acknowledges them. Routes, examples, MCP client configuration and the security posture are in [COMPANION.md](COMPANION.md).
