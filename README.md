<div align="center">

<img src="public/logo.png" alt="Semper Scribe logo" width="110" />

# Semper Scribe

**USMC correspondence, formatted right — entirely in your browser.**

[![Tests](https://github.com/SemperAdmin/semperscribe/actions/workflows/test.yml/badge.svg)](https://github.com/SemperAdmin/semperscribe/actions/workflows/test.yml)
[![CodeQL](https://github.com/SemperAdmin/semperscribe/actions/workflows/codeql.yml/badge.svg)](https://github.com/SemperAdmin/semperscribe/actions/workflows/codeql.yml)
[![Deploy](https://github.com/SemperAdmin/semperscribe/actions/workflows/deploy.yml/badge.svg)](https://github.com/SemperAdmin/semperscribe/actions/workflows/deploy.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Local First](https://img.shields.io/badge/architecture-local--first%20%C2%B7%20no%20backend-2ea44f)](#security--privacy)

[**Live App**](https://semperadmin.github.io/semperscribe) · [Report an Issue](https://github.com/SemperAdmin/semperscribe/issues) · [Security Policy](SECURITY.md)

</div>

> [!WARNING]
> **Not Official USMC Software.** Semper Scribe is a non-official Proof of Concept maintained on a personal basis. It is not USMC, DON, or DoD software and carries no Authority to Operate. Use is at the user's discretion and risk. **Do not enter CUI, PII, or sensitive information.** See the [Privacy and Security Notice](https://semperadmin.github.io/semperscribe/privacy) and [SECURITY.md](SECURITY.md) for full details.

A professional-grade, local-first web application for creating, formatting, and exporting USMC correspondence and administrative documents. Built with Next.js, Semper Scribe helps users produce properly formatted documents aligned with **SECNAV M-5216.5** and **MCO 5215.1K** — entirely in the browser, with no server-side processing.

## Highlights

- 📄 **25 document types** across 9 categories — from Basic Letters to Marine Corps Orders, AMHS messages, and technical publications
- 📥 **Word/PDF import** — upload an existing `.docx` or PDF (even a badly formatted one), review the extracted fields, and export it compliant
- 👀 **Live PDF preview** as you type, with a compliance-issue banner
- 📦 **Export anywhere** — PDF, DOCX, AMHS plain text, batch mail-merge ZIPs, shareable links
- 🔒 **Local-first** — no backend, no telemetry, no data leaves the browser

## Document Types

<details>
<summary><strong>Standard Letters</strong> (3)</summary>

| Type | Description |
|------|-------------|
| **Basic Letter** | Standard format for routine correspondence and official communications |
| **Multiple-Address Letter** | Letter addressed to two or more commands/activities |
| **Endorsement** | Forwards correspondence on a new page with automatic routing |

</details>

<details>
<summary><strong>Memorandums</strong> (5)</summary>

| Type | Description |
|------|-------------|
| **Memorandum for the Record** | Internal document to record events or decisions (no "To" line) |
| **From-To Memorandum** | Informal internal correspondence on plain paper |
| **Letterhead Memorandum** | Formal memo for correspondence within the activity or with other federal agencies |
| **Memorandum of Agreement** | Agreement between two or more parties (conditional) |
| **Memorandum of Understanding** | General understanding between two or more parties (non-binding) |

</details>

<details>
<summary><strong>Staffing Papers</strong> (4)</summary>

| Type | Description |
|------|-------------|
| **Information Paper** | Provides factual information in concise terms |
| **Position Paper** | Advocates a specific position or solution |
| **Decision Paper** | Requests a decision from a senior official |
| **Coordination Page** | Mandatory staffing table for routing packages per MCO 5216.20B |

</details>

<details>
<summary><strong>External &amp; Executive</strong> (2)</summary>

| Type | Description |
|------|-------------|
| **Business Letter** | Correspondence with non-DoD entities or personal approach |
| **Executive Correspondence** | Letters and memorandums for HqDON, Congress, OSD, and senior officials |

</details>

<details>
<summary><strong>DLA Correspondence</strong> (2)</summary>

| Type | Description |
|------|-------------|
| **DLA Memorandum** | Defense Logistics Agency internal memorandum format |
| **DLA Business Letter** | DLA correspondence with external entities |

</details>

<details>
<summary><strong>Directives</strong> (5)</summary>

| Type | Description |
|------|-------------|
| **Marine Corps Order (MCO)** | Permanent directives that establish policy or procedures |
| **Marine Corps Bulletin (MCBul)** | Directives of a temporary nature (expire after 12 months) |
| **Change Transmittal** | Transmits amendments (page replacements) to an existing order per MCO 5215.1K |
| **SECNAV Instruction** | Secretary of the Navy permanent directives per SECNAV M-5215.1 |
| **SECNAV Notice** | Secretary of the Navy directives of a temporary nature |

</details>

<details>
<summary><strong>Forms</strong> (2)</summary>

| Type | Description |
|------|-------------|
| **AA Form (NAVMC 10274)** | Administrative Action form for personnel requests |
| **Page 11 (NAVMC 118-11)** | Administrative Remarks for service record entries |

</details>

<details>
<summary><strong>Technical Publications</strong> (1)</summary>

| Type | Description |
|------|-------------|
| **I-Type Publication** | Technical manual cover and administrative pages with End Items table |

</details>

<details>
<summary><strong>Messages</strong> (1)</summary>

| Type | Description |
|------|-------------|
| **AMHS Message** | Automated Message Handling System (GENADMIN/MARADMIN/ALMAR) with DTG, references, NARR, and POC sections |

</details>

## Features

### ✍️ Document Editing

- **Dynamic Forms** — Conditional field display and validation per document type
- **Multi-Level Paragraphs** — Supports 1., 1.a., 1.a.(1), etc. with add, remove, and reorder
- **Voice Input** — Browser Speech Recognition API for dictating paragraph content
- **Spell Check** — Client-side spell checking with military-specific dictionary and acronym detection
- **References & Enclosures** — Lettered references and numbered enclosures with structured input
- **Via Chain & Distribution** — Routing through intermediate commands, copy-to and distribution statement management

### 📥 Import

- **Word/PDF Document Import** — Upload an existing `.docx` or PDF (even a badly formatted one); fields, references, enclosures, and paragraphs are extracted in the browser with rule-based parsing, presented in a review-and-confirm modal, then dropped into the normal editing flow for a compliant re-export
- **NLDP Import** — Naval Letter Data Package format for portable document data
- **Shareable Links** — Load a full document state from a compressed URL

### 📤 Export & Output

- **PDF Export** — Multi-pipeline PDF generation with proper formatting per document type
- **DOCX Export** — Microsoft Word format via the docx library
- **AMHS Text Export** — Plain text export formatted for AMHS message systems
- **Batch Generation (Mail Merge)** — Import a CSV, substitute `{{TOKEN}}` fields, generate a ZIP of PDFs
- **Signature Placement** — Interactive signature field positioning on generated PDF pages
- **NLDP Export** — Save the full document as a portable data package

### 👀 Preview & Proofread

- **Live Preview** — Real-time PDF rendering as you type (desktop side panel or mobile modal)
- **Proofread Checklist** — Four-category compliance check per SECNAV M-5216.5, Ch 2, Para 19: Format, Framework, Typography & Grammar, and Content, with Pass/Fail/Warn/Manual statuses

### ⚙️ Settings & Profile

- **User Profile** — Store your unit (searchable RUC database), signature name, from title, originator code, rank, and title
- **Auto-Fill** — Profile fields automatically populate new documents
- **Formatting Defaults** — Header type (USMC/DON/DLA), body font, header color, AMHS classification and precedence
- **Appearance** — Light, dark, and system theme support

### 🗂️ Templates & Drafts

- **Template Browser** — Pre-built global and unit-specific document templates
- **Draft Saving** — Auto-save to browser localStorage with load/manage from the File menu

### 📡 AMHS Message Features

- Auto-generated Date-Time Group (DTG) in Zulu time, reference management with letter designators, NARR auto-generation, POC manager, message validation, and a terminal-style preview

### 📱 Responsive Design

- Desktop three-pane layout (sidebar, editor, preview); mobile-friendly forms with a slide-up preview modal

## Getting Started

### Prerequisites

- Node.js 20+
- npm

### Installation

```bash
git clone https://github.com/SemperAdmin/semperscribe.git
cd semperscribe
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Production Build

```bash
npm run build
```

Static output is written to the `out/` directory, ready for deployment to any static hosting provider.

### Deploy to GitHub Pages

The repository includes a GitHub Actions workflow ([`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)) that automatically builds and deploys to GitHub Pages on pushes to `main`. Manual deployment is also available via `workflow_dispatch`.

## Project Structure

<details>
<summary>Expand the source tree overview</summary>

```
src/
├── app/                        # Next.js App Router pages
│   ├── page.tsx                # Main application entry point
│   └── dynamic-forms/          # Dynamic form route
├── components/
│   ├── ui/                     # Base UI library (shadcn/ui + Radix)
│   ├── layout/                 # App shell, sidebar, header, preview, theme
│   ├── letter/                 # Letter section components (references, enclosures, etc.)
│   ├── document/               # Document layout, header settings, signature fields
│   ├── import/                 # Word/PDF import review modal
│   ├── amhs/                   # AMHS editor, preview, POC manager
│   ├── pdf/                    # PDF rendering components
│   ├── wizard/                 # Multi-step document type wizard
│   ├── SettingsDialog.tsx      # User profile and app settings
│   ├── BatchGenerateModal.tsx  # Mail merge / batch generation
│   └── ProofreadModal.tsx      # Proofreading checklist
├── hooks/                      # React hooks
│   ├── useUserProfile.ts       # Profile persistence and form defaults
│   ├── useParagraphs.ts        # Paragraph CRUD and citation generation
│   ├── useDocumentImport.ts    # Word/PDF import orchestration
│   ├── useImportExport.ts      # Document import/export and sharing
│   ├── useBatchGenerate.ts     # Mail merge engine
│   └── ...
├── lib/                        # Utilities and configuration
│   ├── schemas.ts              # Document type definitions and field schemas
│   ├── units.ts                # USMC unit database (RUC/MCC lookup)
│   ├── url-state.ts            # Shareable link encoding/decoding
│   └── ...
├── services/
│   ├── export/                 # Central PDF orchestrator
│   ├── import/                 # Word/PDF text extraction and correspondence parsing
│   ├── pdf/                    # Per-document-type PDF generators
│   ├── docx/                   # Per-document-type DOCX generators
│   └── amhs/                   # AMHS message formatting
└── types/                      # TypeScript type definitions
```

</details>

## Security & Privacy

> [!IMPORTANT]
> This tool is strictly for processing **UNCLASSIFIED** information. Do not input, process, or store Classified, CUI, or PII data.

- **Local-First Architecture** — All document processing happens entirely in the browser. No data is transmitted to external servers.
- **No Backend** — Static site deployment. No server-side code, no database, no API calls.
- **Local Storage Only** — Drafts and user profiles are stored in browser localStorage.
- **Verification Required** — While Semper Scribe automates formatting, the final content is the responsibility of the originator. Always verify references and administrative details against current directives.

## Compliance Posture

Semper Scribe undergoes voluntary alignment with DoD adoption-readiness standards. This is not an authorized DoD system and carries no Authority to Operate.

<details>
<summary><strong>What the alignment covers</strong></summary>

- **Software Supply Chain (SCRM)** — SBOM generated on every deploy via CycloneDX. Zero known vulnerabilities in production dependencies as of the last audit pass. Maps to Executive Order 14028 SBOM requirements and the DoD CIO SWFT Initiative memo.
- **Secure Software Development Framework (SSDF)** — Aligned with NIST SP 800-218 practices PO.3.3 (toolchain configuration), PW.4.1 and PW.4.4 (third-party component management), PW.7 (review and analyze code), and PS.1 (source protection). CodeQL static analysis runs on every push and weekly.
- **Open Source Software** — Project license is MIT. Dual-license elections documented in [`LICENSES.md`](LICENSES.md). All transitive licenses are approved per DoD CIO OSS Guidance dated 24 January 2022, Attachment 2 paragraph 3G.
- **Privacy** — No PII collection, no telemetry, no backend at runtime. User responsibility framing applied throughout the UI. See the in-app Privacy and Security Notice and [`SECURITY.md`](SECURITY.md).
- **Records Management** — Tool outputs become Federal records under 44 USC 3301 when used in official business. Routing through a Command Designated Records Manager per MCO 5210.11F is the user's responsibility, not the application's.

</details>

<details>
<summary><strong>What the alignment does not cover</strong></summary>

- This is not under the Risk Management Framework. DoDI 8510.01 does not apply to a personal PoC.
- This is not registered as an Electronic Information System under MCO 5210.11F. Tool outputs are records; the tool itself is not an EIS.
- This is not authorized for CUI processing. Users must not enter CUI, PII, PHI, or sensitive information.

</details>

See [`docs/COMPLIANCE_REMEDIATION_PLAN.md`](docs/COMPLIANCE_REMEDIATION_PLAN.md) for the full audit trail of the alignment work.

### Reporting Security Issues

Vulnerabilities should be reported through GitHub's Private Vulnerability Reporting. See [`SECURITY.md`](SECURITY.md) for the disclosure channel and response expectations.

## Tech Stack

| Category | Technology |
|----------|------------|
| **Framework** | Next.js 16, React 18, TypeScript 5 |
| **UI** | Tailwind CSS, shadcn/ui, Radix UI, Lucide icons |
| **Forms** | React Hook Form, Zod validation |
| **State** | React hooks, Zustand |
| **PDF** | @react-pdf/renderer, pdf-lib, pdfjs-dist |
| **DOCX** | docx (generation), mammoth (import) |
| **Theming** | next-themes (light/dark/system) |
| **Compression** | lz-string |
| **Testing** | Vitest, Testing Library |

## Contributing

Contributions are welcome. Please submit [issues](https://github.com/SemperAdmin/semperscribe/issues) and pull requests on GitHub.

## License

MIT License. See [LICENSE](LICENSE) for the legal text and [LICENSES.md](LICENSES.md) for the third-party license inventory, dual-license elections, and LGPL transitive documentation. The license election is recorded per DoD CIO OSS Guidance paragraph 3G.

---

<div align="center">

*Semper Fidelis* 🦅

</div>
