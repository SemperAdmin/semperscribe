# Headless companion

The companion runs SemperScribe without a browser. It takes an NLDP
package in, validates it against the same rules the editor applies, and
renders the same PDF or DOCX the editor downloads. Two front doors sit on
one set of operations: an HTTP server for an EDMS or a script, and an MCP
server over stdio for an agent.

It exists for integration. The EDMS side needs a document rendered from
data it already holds, on a schedule, with no person at a keyboard. The
agent side needs the same four operations described well enough for a
model to call them without guessing.

The companion lives in `companion/` at the repository root, outside
`src/`, so `next build` never bundles it and nothing in it reaches the
browser.

## Running it

```bash
npm ci
npm run companion          # HTTP on http://127.0.0.1:7719
npm run companion:mcp      # MCP over stdio
```

Both read static assets (fonts, seals, official form blanks, NAVMC
template pages) from `public/` on disk through the asset seam in
`src/lib/assets.ts`, so both must run from the repository root or point
`COMPANION_PUBLIC_DIR` at the `public/` directory of a checkout.

### Environment

| Variable | Default | Meaning |
|---|---|---|
| `COMPANION_PORT` | `7719` | HTTP port |
| `COMPANION_HOST` | `127.0.0.1` | HTTP bind address. Read the security section before changing it |
| `COMPANION_MAX_BODY` | `2097152` | Largest request body in bytes |
| `COMPANION_TIMEOUT_MS` | `45000` | Wall-clock ceiling on one validate or render |
| `COMPANION_OUT_DIR` | unset | Directory rendered files are written into. Unset means no writes at all |
| `COMPANION_PUBLIC_DIR` | `<cwd>/public` | Where the static assets are read from |

## HTTP routes

Errors are JSON in one shape at every route.

```json
{ "error": "sensitive_data", "message": "...", "details": { "findings": ["Possible SSN detected"] } }
```

| Status | When |
|---|---|
| 400 | Bad input: no document, a body which is not a JSON object, an unknown format, a rejected output path |
| 404, 405 | No such route, or the wrong method on one |
| 413 | Body past the cap |
| 415 | `Content-Type` was not `application/json` |
| 422 | NLDP validation failed, the document type is unknown, the type does not export the requested format, or the sensitive-data scan fired and nobody acknowledged it |
| 504 | The render passed the timeout |

### GET /health

```bash
curl http://127.0.0.1:7719/health
```

```json
{ "ok": true, "version": "0.5.0", "documentTypes": 27 }
```

### GET /document-types

```bash
curl http://127.0.0.1:7719/document-types
```

```json
{
  "documentTypes": [
    {
      "id": "basic",
      "name": "Basic Letter",
      "description": "Standard format for routine correspondence and official communications.",
      "category": "standard-letter",
      "exportFormats": ["pdf", "docx"],
      "companionFormats": ["pdf", "docx"],
      "pdfPipeline": "standard",
      "isDirective": false
    }
  ]
}
```

`exportFormats` is what the application offers for the type, `amhs-text`
included. `companionFormats` is the subset the companion renders, which is
PDF and DOCX. A type with an empty `companionFormats` is refused with 422
at `/render`.

Add `?type=<id>` for one type's schema: a JSON Schema for `data.formData`
generated from the application zod schema, the editor's field list with
its labels, and the NLDP envelope the form data sits inside.

```bash
curl 'http://127.0.0.1:7719/document-types?type=basic'
```

### POST /validate

```bash
curl -X POST http://127.0.0.1:7719/validate \
  -H 'Content-Type: application/json' \
  -d '{"document": <NLDP package>}'
```

`document` is the parsed NLDP object or the JSON text of one.

```json
{
  "ok": true,
  "documentType": "basic",
  "errors": [],
  "warnings": ["Every listed reference must be cited in the text: ..."],
  "findings": [],
  "issues": [{ "id": "ref-not-cited-a", "severity": "fail", "rule": "...", "citation": "...", "detail": "..." }]
}
```

A document which fails to validate is a 200 answer with `ok: false`, not
an error response. `errors` holds the structural failures and the
block-severity rule violations, `warnings` holds everything else the
validators reported, and `findings` holds sensitive-data hits from the
export gate. `issues` repeats the rule violations in full with their
citations.

### POST /render

```bash
curl -X POST http://127.0.0.1:7719/render \
  -H 'Content-Type: application/json' \
  -d '{"document": <NLDP package>, "format": "pdf"}' \
  -o letter.pdf
```

| Field | Required | Meaning |
|---|---|---|
| `document` | yes | NLDP package, object or JSON text |
| `format` | yes | `"pdf"` or `"docx"` |
| `edms` | no | `{requestId?, ruc, ssic, docType, section?}`. Present means the file takes the EDMS name convention |
| `out` | no | File name under `COMPANION_OUT_DIR`. Returns a path instead of bytes |
| `acknowledgeSensitive` | no | `true` proceeds past the sensitive-data gate |

Without `out` the response body is the file:

```
HTTP/1.1 200 OK
Content-Type: application/pdf
Content-Disposition: attachment; filename="1000 SUBJECT.pdf"; filename*=UTF-8''1000%20SUBJECT.pdf
Cache-Control: no-store
```

With `out` the response is JSON:

```json
{
  "path": "/srv/semperscribe-out/letter.pdf",
  "filename": "1000 SUBJECT.pdf",
  "contentType": "application/pdf",
  "documentType": "basic",
  "bytes": 881077,
  "findings": []
}
```

A document carrying sensitive data is refused:

```json
{
  "error": "sensitive_data",
  "message": "The document carries sensitive data. Review the findings and resend with acknowledgeSensitive set to true.",
  "details": { "findings": ["Possible SSN detected"] }
}
```

Resend the same request with `"acknowledgeSensitive": true` to render it.
The findings come back on the successful response too, so the caller has
a record of what it waved through.

## MCP tools

Four tools, one per operation. Each answers with a single JSON text block.

| Tool | Input | Answer |
|---|---|---|
| `list_document_types` | none | Every type with its formats |
| `get_document_schema` | `type` | Schema, field list, and envelope for one type |
| `validate_document` | `document` | The `/validate` payload |
| `render_document` | `document`, `format`, `out?`, `acknowledgeSensitive?`, `edms?` | The written path with `out`, otherwise base64 |

`render_document` without `out` returns the file as base64 alongside a
warning once the file passes 256 KB, because base64 of a naval letter runs
to several hundred kilobytes of text and spends an agent's context on
bytes it never reads. Set `COMPANION_OUT_DIR`, pass `out`, and take the
path back instead.

A failed call answers with `isError` and the same error payload the HTTP
routes send, so an agent reads the code and the findings rather than a
stack trace.

### Client configuration

```json
{
  "mcpServers": {
    "semperscribe": {
      "command": "npx",
      "args": ["tsx", "companion/mcp.ts"]
    }
  }
}
```

Run it with the repository root as the working directory, or add
`"env": { "COMPANION_PUBLIC_DIR": "/path/to/semperscribe/public" }`.

## Security posture

**Loopback only.** The HTTP server binds `127.0.0.1`. `COMPANION_HOST`
widens the bind and publishes an unauthenticated document renderer to
whatever the new address reaches. Anything wider than loopback belongs
behind a reverse proxy which authenticates the caller, and the process
prints a warning on startup when the bind is not loopback.

**No authentication, by design.** There are no tokens, no sessions, and
no accounts. The trust boundary is the loopback interface and the
operating system account the process runs under. Adding a token to a
loopback listener would give the appearance of a control without the
substance of one, and the honest statement is the one above: anything
which reaches the socket renders documents.

**No CORS headers.** A page from another origin has no business calling
the companion, and the absence of the headers is what stops a browser from
delivering the response to one.

**The PII gate is mirrored, not skipped.** The editor scans every export
for SSN and EDIPI patterns and for clusters of PHI keywords, and puts a
dialog in front of the download. The companion runs the identical scan and
refuses the render with a 422 naming the findings. Only an explicit
`acknowledgeSensitive` proceeds, which is the headless form of the same
consent. A caller which sets the flag on every request has turned the gate
off for itself, and the findings on the response are the audit trail.

**Output confinement.** Writes happen only under `COMPANION_OUT_DIR` and
only when the caller asks for one. The path is resolved through realpath
before the check, so traversal, an absolute path, a planted symlink, and a
symlinked subdirectory are each refused. Directories are never created.
With the variable unset there are no writes at all.

**Body and time limits.** Two megabytes of request body and forty five
seconds per operation, both overridable. The timeout bounds the caller's
wait rather than the process's load: Node has no way to cancel work
already inside a pipeline, so an abandoned render keeps running until it
returns.

**Local only.** Neither surface makes a network request of its own. The
render reads `public/` from disk and nothing else.

## What it does not do

- **No authentication, no authorization, no rate limiting.** Put a proxy
  in front of it if the deployment needs any of the three.
- **No TLS.** Loopback traffic never leaves the machine.
- **No AMHS text.** The message format exports through the editor. The
  companion renders PDF and DOCX only, and refuses anything else with a
  422 naming the formats the type offers.
- **No enclosure file merging and no signature fields.** Both depend on
  binaries the editor holds in browser storage. A PDF from the companion
  is the letter itself.
- **No same-page composition.** A document whose `endorsementPlacement`
  is `same-page` renders to the endorsement BLOCK alone: no letterhead,
  no seal, no page number, no continuation header, and no subject when
  the 9-2.1.a omission is taken. SECNAV M-5216.5 9-1 settles placement
  against the signature page of the document being endorsed, and one
  request carries one document, so the page to measure against is not
  present. The validator report the companion returns carries the
  9-1 warning saying exactly that. The block is the file to hand a
  drafter who will add it to a page already signed; to have the fit
  measured and the block drawn onto the page, assemble the package in
  the editor. The composer itself, `src/lib/same-page-endorsement.ts`,
  is pure over PDF bytes and runs under plain Node, so a future
  two-document route would use the same code.
- **No editing.** There is no store, no session, and no document library.
  Every request is a whole document in and a whole document out.
- **No batch route.** One document per request. A caller which needs fifty
  sends fifty.
- **No proofreading or GunnyBot.** The companion never contacts a model.

## Testing

`tests/companion/` runs under the plain Node environment, one file per
concern: the handler operations, the limits, output confinement, the HTTP
routes against a real listener on an ephemeral port, and the MCP server
spawned over stdio with the SDK's own client.

`tests/companion/pdf-parity.test.ts` is the one which keeps the companion
honest. It packs the frozen golden fixture into an NLDP package, renders
it through the companion, and compares the positioned text layout against
the committed golden snapshot the browser pipeline is measured on. A
divergence there means the companion's route through the pipeline is no
longer the application's.
