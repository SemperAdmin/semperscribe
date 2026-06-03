# Semper Scribe

> **Not Official USMC Software.** Semper Scribe is a non-official Proof of Concept maintained on a personal basis. It is not USMC, DON, or DoD software. It does not carry an Authority to Operate. Use is at the user's discretion and risk. Users must not enter CUI, PII, or sensitive information. See the [Privacy and Security Notice](https://furby203824.github.io/SemperScribe/privacy) and [SECURITY.md](SECURITY.md) for full details.

A professional-grade, local-first web application for creating, formatting, and exporting USMC correspondence and administrative documents. Built with Next.js, Semper Scribe helps users produce properly formatted documents aligned with SECNAV M-5216.5 and MCO 5215.1K — entirely in the browser with no server-side processing.

**Live App:** [https://furby203824.github.io/SemperScribe](https://furby203824.github.io/SemperScribe)

## Document Types

Semper Scribe supports 20 document types organized into seven categories:

### Standard Letters

| Type | Description |
|------|-------------|
| **Basic Letter** | Standard format for routine correspondence and official communications |
| **Multiple-Address Letter** | Letter addressed to two or more commands/activities |
| **Endorsement** | Forwards correspondence on a new page with automatic routing |

### Memorandums

| Type | Description |
|------|-------------|
| **Memorandum for the Record** | Internal document to record events or decisions (no "To" line) |
| **From-To Memorandum** | Informal internal correspondence on plain paper |
| **Letterhead Memorandum** | Formal memo for correspondence within the activity or with other federal agencies |
| **Memorandum of Agreement** | Agreement between two or more parties (conditional) |
| **Memorandum of Understanding** | General understanding between two or more parties (non-binding) |

### Staffing Papers

| Type | Description |
|------|-------------|
| **Information Paper** | Provides factual information in concise terms |
| **Position Paper** | Advocates a specific position or solution |
| **Decision Paper** | Requests a decision from a senior official |
| **Coordination Page** | Mandatory staffing table for routing packages per MCO 5216.20B |

### External & Executive

| Type | Description |
|------|-------------|
| **Business Letter** | Correspondence with non-DoD entities or personal approach |
| **Executive Correspondence** | Letters and memorandums for HqDON, Congress, OSD, and senior officials |

### Directives

| Type | Description |
|------|-------------|
| **Marine Corps Order (MCO)** | Permanent directives that establish policy or procedures |
| **Marine Corps Bulletin (MCBul)** | Directives of a temporary nature (expire after 12 months) |
| **Change Transmittal** | Transmits amendments (page replacements) to an existing order per MCO 5215.1K |

### Forms

| Type | Description |
|------|-------------|
| **AA Form (NAVMC 10274)** | Administrative Action form for personnel requests |
| **Page 11 (NAVMC 118-11)** | Administrative Remarks for service record entries |

### Messages

| Type | Description |
|------|-------------|
| **AMHS Message** | Automated Message Handling System (GENADMIN/MARADMIN/ALMAR) with DTG, references, NARR, and POC sections |

## Features

### Document Editing

- **Dynamic Forms** — Conditional field display and validation per document type
- **Multi-Level Paragraphs** — Supports 1., 1.a., 1.a.(1), etc. with add, remove, and reorder
- **Voice Input** — Browser Speech Recognition API for dictating paragraph content
- **Spell Check** — Client-side spell checking with military-specific dictionary and acronym detection
- **References & Enclosures** — Lettered references and numbered enclosures with structured input
- **Via Chain** — Routing through intermediate commands
- **Distribution** — Copy-to and distribution statement management

### Export & Output

- **PDF Export** — Multi-pipeline PDF generation with proper formatting per document type
- **DOCX Export** — Microsoft Word format via the docx library
- **AMHS Text Export** — Plain text export formatted for AMHS message systems
- **Batch Generation (Mail Merge)** — Import a CSV, substitute `{{TOKEN}}` fields, generate a ZIP of PDFs
- **Signature Placement** — Interactive signature field positioning on generated PDF pages
- **NLDP Import/Export** — Naval Letter Data Package format for portable document data
- **Shareable Links** — Encode the full document state into a compressed URL

### Preview & Proofread

- **Live Preview** — Real-time PDF rendering as you type (desktop side panel or mobile modal)
- **Proofread Checklist** — Four-category compliance check per SECNAV M-5216.5, Ch 2, Para 19:
  - Format, Framework, Typography & Grammar, Content
  - Pass/Fail/Warn/Manual check statuses with category summaries

### Settings & Profile

- **User Profile** — Store your unit (searchable RUC database), signature name, from title, originator code, rank, and title
- **Auto-Fill** — Profile fields automatically populate new documents; identity fields fill when empty, formatting fields always track the profile
- **Formatting Defaults** — Header type (USMC/DON), body font, header color, AMHS classification and precedence
- **Appearance** — Light, dark, and system theme support
- **Data Management** — Clear saved drafts, view disclaimers, reset profile, send feedback

### Templates & Drafts

- **Template Browser** — Pre-built global and unit-specific document templates
- **Draft Saving** — Auto-save to browser localStorage with load/manage from the File menu

### AMHS Message Features

- Auto-generated Date-Time Group (DTG) in Zulu time with refresh
- Reference management with letter designators
- NARR (Narrative) auto-generation from references
- POC (Point of Contact) manager with email and phone fields
- Message validation before export
- Terminal-style preview (green text on black background)

### Responsive Design

- Desktop three-pane layout (sidebar, editor, preview)
- Mobile-friendly forms with slide-up preview modal
- Touch-friendly controls and collapsible navigation

## Getting Started

### Prerequisites

- Node.js 20+
- npm

### Installation

```bash
git clone https://github.com/furby203824/SemperScribe.git
cd SemperScribe
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

The repository includes a GitHub Actions workflow (`.github/workflows/deploy.yml`) that automatically builds and deploys to GitHub Pages on pushes to `main`. Manual deployment is also available via `workflow_dispatch`.

## Project Structure

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
│   ├── amhs/                   # AMHS editor, preview, POC manager
│   ├── pdf/                    # PDF rendering components
│   ├── wizard/                 # Multi-step document type wizard
│   ├── SettingsDialog.tsx       # User profile and app settings
│   ├── BatchGenerateModal.tsx   # Mail merge / batch generation
│   ├── ProofreadModal.tsx       # Proofreading checklist
│   └── DisclaimerModal.tsx      # Security and legal disclaimers
├── hooks/                      # React hooks
│   ├── useUserProfile.ts       # Profile persistence and form defaults
│   ├── useParagraphs.ts        # Paragraph CRUD and citation generation
│   ├── useVoiceInput.ts        # Speech-to-text integration
│   ├── useImportExport.ts      # Document import/export and sharing
│   ├── useBatchGenerate.ts     # Mail merge engine
│   ├── useSpellCheck.ts        # Military dictionary spell check
│   ├── useTemplates.ts         # Template loading and search
│   └── ...
├── lib/                        # Utilities and configuration
│   ├── schemas.ts              # Document type definitions and field schemas
│   ├── units.ts                # USMC unit database (RUC/MCC lookup)
│   ├── merge-utils.ts          # Mail merge token detection and substitution
│   ├── url-state.ts            # Shareable link encoding/decoding
│   ├── security-utils.ts       # Disclaimer constants
│   └── ...
├── services/
│   ├── export/
│   │   └── pdfPipelineService.ts  # Central PDF orchestrator (routes to correct generator)
│   ├── pdf/                       # Per-document-type PDF generators
│   └── amhs/                      # AMHS message formatting
└── types/                      # TypeScript type definitions
```

## Security & Privacy

- **Local-First Architecture** — All document processing happens entirely in the browser. No data is transmitted to external servers.
- **No Backend** — Static site deployment. No server-side code, no database, no API calls.
- **Local Storage Only** — Drafts and user profiles are stored in browser localStorage.
- **UNCLASSIFIED Use Only** — This tool is strictly for processing UNCLASSIFIED information. Do not input, process, or store Classified, CUI, or PII data.
- **Verification Required** — While Semper Scribe automates formatting, the final content is the responsibility of the originator. Always verify references and administrative details against current directives.

## Compliance Posture

Semper Scribe undergoes voluntary alignment with DoD adoption-readiness standards. This is not an authorized DoD system and carries no Authority to Operate. The current posture covers the categories below.

### What the alignment covers

- **Software Supply Chain (SCRM)**. SBOM generated on every deploy via CycloneDX. Zero known vulnerabilities in production dependencies as of the last audit pass. Maps to Executive Order 14028 SBOM requirements and the DoD CIO SWFT Initiative memo.
- **Secure Software Development Framework (SSDF)**. Aligned with NIST SP 800-218 practices PO.3.3 (toolchain configuration), PW.4.1 and PW.4.4 (third-party component management), PW.7 (review and analyze code), and PS.1 (source protection). CodeQL static analysis runs on every push and weekly.
- **Open Source Software**. Project license is MIT. Dual-license elections documented in `LICENSES.md`. All transitive licenses are approved per DoD CIO OSS Guidance dated 24 January 2022, Attachment 2 paragraph 3G.
- **Privacy**. No PII collection, no telemetry, no backend at runtime. User responsibility framing applied throughout the UI. See the in-app Privacy and Security Notice and `SECURITY.md`.
- **Records Management**. Tool outputs become Federal records under 44 USC 3301 when used in official business. Routing through a Command Designated Records Manager per MCO 5210.11F is the user's responsibility, not the application's.

### What the alignment does not cover

- This is not under the Risk Management Framework. DoDI 8510.01 does not apply to a personal PoC.
- This is not registered as an Electronic Information System under MCO 5210.11F. Tool outputs are records; the tool itself is not an EIS.
- This is not authorized for CUI processing. Users must not enter CUI, PII, PHI, or sensitive information.

See `docs/COMPLIANCE_REMEDIATION_PLAN.md` for the full audit trail of the alignment work.

### Reporting Security Issues

Vulnerabilities should be reported through GitHub's Private Vulnerability Reporting. See `SECURITY.md` for the disclosure channel and response expectations.

## Tech Stack

| Category | Technology |
|----------|------------|
| **Framework** | Next.js 16, React 18, TypeScript 5 |
| **UI** | Tailwind CSS, shadcn/ui, Radix UI, Lucide icons |
| **Forms** | React Hook Form, Zod validation |
| **State** | React hooks, Zustand |
| **PDF** | @react-pdf/renderer, pdf-lib |
| **DOCX** | docx |
| **Theming** | next-themes (light/dark/system) |
| **Compression** | lz-string |
| **Testing** | Vitest, Testing Library |

## Contributing

Contributions are welcome. Please submit issues and pull requests on GitHub.

## License

MIT License. See [LICENSE](LICENSE) for the legal text and [LICENSES.md](LICENSES.md) for the third-party license inventory, dual-license elections, and LGPL transitive documentation. The license election is recorded per DoD CIO OSS Guidance paragraph 3G.

---

*Semper Fidelis*
#   s e m p e r s c r i b e  
 