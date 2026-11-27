# Project structure and stack

## Source layout

```
src/
  app/                     Next.js App Router pages (main app, /privacy, dynamic-forms demo)
  components/
    ui/                    Base UI components (shadcn/ui with Radix)
    layout/                App shell, sidebar, header, preview
    letter/                Letter sections (references, enclosures, and so on)
    document/              Document layout, header settings, signature fields
    import/                Word and PDF import review dialog
    amhs/                  AMHS editor, preview, POC manager
    pdf/                   PDF rendering components
    counseling/            Counseling Worksheet sections
    gunnybot/              GunnyBot assistant panel and settings
    itype/                 I-Type publication editor and preview
    review/                Review comments panel
    signature/             Guided signing
    tla/                   TLA Packet sections
    volume/                Volume chapter tree, appendices, figures
  hooks/                   React hooks (profile, paragraphs, import, export, batch)
  lib/                     Schemas, unit database, share-link encoding, GunnyBot client, helpers
  services/
    export/                PDF orchestrator
    import/                Word and PDF text extraction and parsing
    pdf/                   Per-document-type PDF generators
    docx/                  Per-document-type DOCX generators
    amhs/                  AMHS message formatting
  types/                   TypeScript types
companion/                 Headless HTTP and MCP servers (see COMPANION.md)
public/                    Static assets, templates, fonts, and the nginx headers for cloud.gov
tests/                     Vitest suites (including golden tests) and Playwright end-to-end tests
scripts/                   Build checks and reports
```

## Stack

| Category | Technology |
|---|---|
| Framework | Next.js 16, React 18, TypeScript 5 |
| UI | Tailwind CSS 3, shadcn/ui, Radix UI, Lucide icons |
| Forms | React Hook Form, Zod |
| State | React hooks, Zustand |
| PDF | @react-pdf/renderer, pdf-lib, pdfjs-dist |
| DOCX | docx (generation), mammoth (import) |
| Theming | next-themes |
| Compression | lz-string |
| Testing | Vitest, Testing Library, Playwright |
