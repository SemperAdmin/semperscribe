# SemperScribe

Formats USMC correspondence and administrative documents to SECNAV M-5216.5 and MCO 5215.1K in the browser, for Marines who draft letters, memorandums, directives, forms and messages.

**Live:** https://semperscribe.app.cloud.gov
**Also on GitHub Pages:** https://semperadmin.github.io/semperscribe/

## What it does

- Provides 33 document types in 10 groups: standard letters, memorandums, staffing papers, external and executive correspondence, DLA correspondence, directives, forms, a counseling worksheet, technical publications and AMHS messages. The full list is in [docs/DOCUMENT-TYPES.md](docs/DOCUMENT-TYPES.md).
- Shows a live PDF preview as you type, with a compliance-issue banner and a proofread checklist.
- Exports PDF, DOCX and AMHS plain text, generates batches from a CSV (mail merge), and saves or loads NLDP data packages and shareable links.
- Imports an existing Word or PDF file, extracts its fields in the browser, and lets you review them before re-exporting in the correct format.
- Keeps drafts in an on-device document library, with profile defaults and bundled templates.
- Offers an optional AI assistant, GunnyBot, that is off until you add your own provider key.

Detail on each of these is in [docs/FEATURES.md](docs/FEATURES.md).

## Using it

Open the live site in a current browser. No account is needed. Choose a document type in the sidebar, fill in the form, check the preview, and export. You are responsible for the content: verify references and administrative details against the current governing directives.

## Privacy and security

- **Data flow.** Formatting, import, export and storage happen in your browser, and nothing you type is sent to a SemperScribe server (there is none). The one exception is GunnyBot, which sends data off the device only when you use it, and only after you enter a provider key:
  - **Google Gemini** (`generativelanguage.googleapis.com`): the browser sends the request directly, with your key, to Google. The request is what you submit to GunnyBot: the question you type in the panel and the conversation so far; the paragraph you ask it to draft or rewrite; or, for a Review in the proofread checklist, the document type, subject line and paragraphs. Counseling Worksheets and TLA Packets are not sent. A scan prompts you before anything containing SSN or EDIPI patterns is sent.
  - **GenAI.mil** (`api.genai.mil`): the same content, but GenAI.mil does not accept direct browser calls, so GunnyBot sends to a proxy you run on your own machine (`127.0.0.1`) and refuses any proxy that is not on the local machine.
  - The key is held in memory only and is forgotten when the tab closes. Do not send CUI to a commercial provider through GunnyBot.
- Three other actions leave the browser only when you choose them: **Feedback** opens an external form in a new tab (it needs a .mil network), the signature return option can open your own mail program with a pre-filled message, and the browser's dictation feature, where available, may send audio to its vendor.
- The document library is stored in the browser's IndexedDB, and the profile and settings in browser storage, on that device only. An optional backup folder is written only where you pick it. There are no analytics or cookies.
- On cloud.gov the Content Security Policy limits connections to the site itself, the two AI hosts above and local addresses, and blocks scripts, fonts and images from other sites. GitHub Pages cannot set response headers, so the policy applies to the cloud.gov deployment only.
- Before each export, the file content is scanned for SSN and EDIPI patterns and PHI keyword clusters, and you are asked to confirm. It does not certify a document free of sensitive content.
- The local companion server (`npm run companion`) binds `127.0.0.1` with no authentication and is started only by an operator; it is not part of the website.
- CUI markings on output are a reminder for the user. This site is not an authorized system for CUI or PII; do not enter such information unless your command has approved this use.
- The hosting platforms (cloud.gov and GitHub Pages) keep standard web server access logs, such as IP address, time, requested page and browser type, for operations and security. Semper Admin does not add tracking of its own.

See the in-app [Privacy and Security Notice](https://semperscribe.app.cloud.gov/privacy/) and [Security](SECURITY.md). Third-party licenses are listed in [LICENSES.md](LICENSES.md).

## Development

Requires the Node version in [`.nvmrc`](.nvmrc) (22) and npm.

```bash
npm ci
npm run dev          # http://localhost:3000
npm test             # full suite, including the golden tests
npm run test:nogolden
npm run typecheck
npm run lint
npm run build        # static export to out/
```

The golden tests render DOCX files with LibreOffice (CI installs it); `npm run test:nogolden` skips them for a machine without it. The headless companion is described in [docs/COMPANION.md](docs/COMPANION.md).

## Deployment

| Environment | URL | How |
|---|---|---|
| cloud.gov | https://semperscribe.app.cloud.gov | `manifest.yml` (route `semperscribe.app.cloud.gov`); manual **Deploy to cloud.gov** workflow (`.github/workflows/deploy-cloudgov.yml`); sandbox managed by the private cloudgov-redeploy repository |
| GitHub Pages | https://semperadmin.github.io/semperscribe/ | `.github/workflows/deploy.yml` on push to `main`, served under `/semperscribe` |

## Documentation

- [docs/FEATURES.md](docs/FEATURES.md): editing, import, export, settings and the headless companion.
- [docs/DOCUMENT-TYPES.md](docs/DOCUMENT-TYPES.md): the 33 document types by group.
- [docs/PROJECT-STRUCTURE.md](docs/PROJECT-STRUCTURE.md): source layout and technology stack.
- [docs/COMPLIANCE-POSTURE.md](docs/COMPLIANCE-POSTURE.md): what the repository does and does not claim.
- [docs/COMPANION.md](docs/COMPANION.md): HTTP and MCP companion.
- [docs/NLDP_FEATURE_GUIDE.md](docs/NLDP_FEATURE_GUIDE.md): the NLDP data package format.
- [CHANGELOG.md](CHANGELOG.md): version history.

## Feedback and support

[Open an issue](https://github.com/SemperAdmin/semperscribe/issues), or use **Feedback** in the app from a .mil network. Report security problems as described in [SECURITY.md](SECURITY.md).

## License and disclaimer

MIT (see [LICENSE](LICENSE); third-party notices in [LICENSES.md](LICENSES.md)).

> This is an independent tool built to help Marines with administrative
> work. It is not an official Department of the Navy or U.S. Marine Corps
> system and is not endorsed by, affiliated with, or approved by either.
> Always confirm requirements against the current governing orders.

## Part of Semper Admin

One of the tools in the Semper Admin suite. Start at the
[Semper Admin Portal](https://semper-admin-portal.app.cloud.gov) for the
full set.
