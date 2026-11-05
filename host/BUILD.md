# SemperScribe local host: build specification

One Windows executable serves SemperScribe on loopback and forwards API
calls to GenAI.mil. It removes the CORS problem rather than working
around it.

Verified 2026-09-20: compiles clean for `windows/amd64`, 6.6 MB, `go vet`
clean, `gofmt` clean, offline build from a vendored tree, and every
security control exercised against a running instance.

---

## 1. Why this shape

GenAI.mil sends no `Access-Control-Allow-Origin` and refuses the anonymous
preflight. Measured on two government workstations, two network paths, and
both published base URLs. Evidence in `GENAI_MIL_CORS_DEFECT_REPORT.md`.
No application code fixes that.

Every earlier plan kept the page on `semperscribe.app.cloud.gov` and added
a proxy beside it. That inherits three problems:

- The proxy needs its own CORS headers, or it reproduces the failure.
- Chrome Local Network Access, shipped in Chrome 142, prompts each user
  when a public origin reaches loopback.
- Enterprise policy is able to deny that prompt outright.

Serve the page **from** the binary and all three vanish. The page origin
becomes `http://127.0.0.1:PORT`. A request to `/api/...` is then
same-origin. Same-origin requests carry no CORS check, generate no
preflight, need no allow-origin header, and trigger no permission prompt.

This is also why AegisCode works. No web origin, no CORS. One binary
serving both halves reaches the same place with no Electron bundle and no
Python runtime.

```
  Browser tab                    SemperScribe.exe              GenAI.mil
  http://127.0.0.1:8765
  ┌──────────────┐               ┌─────────────────┐
  │ SemperScribe │ ── GET / ───► │ embedded webroot│
  │   (page)     │ ◄── html ──── │  (next export)  │
  │              │               │                 │
  │  GunnyBot    │ ─ POST /api ► │  allowlist      │ ── TLS ──► api.genai.mil
  │              │   SAME ORIGIN │  origin check   │  Windows    /v1/chat/...
  │              │   no preflight│  header filter  │  cert store
  │              │ ◄─── json ─── │                 │  WinINET proxy
  └──────────────┘               └─────────────────┘
```

---

## 2. What SemperScribe needs changed

Nothing. The Phase 1 proxy plumbing already shipped does the whole job.

The user opens GunnyBot settings and sets the provider proxy URL to the
address the binary prints:

```
http://127.0.0.1:8765/api
```

`genaimilAdapter.buildRequest` appends `/v1/chat/completions`, giving
`http://127.0.0.1:8765/api/v1/chat/completions`, which the host maps to
`https://api.genai.mil/v1/chat/completions`. The page is served from that
same origin, so the call is same-origin and no CORS logic runs at all.

`normalizeProxyUrl` accepts that URL as written. `proxy-config.ts` stores
it per provider, so Gemini keeps going browser-direct and is untouched.

Optional later refinement: have the host inject the port into the page at
serve time so the field self-populates. Not required, and it adds a
build-time coupling, so leave it until someone asks.

---

## 3. Security model

**The key never touches the binary.** GunnyBot holds it in memory for the
tab, exactly as it does today. The page sends `Authorization` on the
same-origin call, the host forwards that one header, and stores nothing.
Nothing is written to disk and nothing is logged. The host holds no
credential of its own, which keeps the accreditation story simple.

**Loopback only.** The listener binds `127.0.0.1`, never `0.0.0.0`.
Binding all interfaces would publish a GenAI.mil forwarder to the local
network.

**No CORS headers, deliberately.** This is the control, not an oversight.
Any website the user visits is able to aim a request at loopback. With no
`Access-Control-Allow-Origin` on responses, a foreign page fails its
preflight, never gets to send `Authorization`, and is unable to read a
response even where one came back. The SemperScribe page needs none of it,
because it is same-origin. Anyone who later "fixes" this by adding CORS
headers opens the forwarder to the entire web.

**Origin and Sec-Fetch-Site checks.** Second and third locks. Both headers
are set by the browser and are not forgeable from page script.

**Path allowlist.** Three paths, each pinned to one method, matching the
three calls the gateway exposes. An open forwarder on loopback is a
hazard; this is not one.

Optional fourth lock if a reviewer wants it: a per-launch random token the
host injects into the served page and requires on `/api`. It closes the
residual case of another process on the same machine calling loopback
directly. It also adds build-time coupling between the binary and the
page, so treat it as a hardening step rather than a default.

---

## 4. Windows specifics

**Certificate trust: solved for free.** On Windows, Go validates chains
with `CertGetCertificateChain`, the same Windows API Chrome uses, so roots
installed by organizational policy are honored with no extra code and no
certificate bundle shipped beside the binary. This is precisely the
problem AegisCode solves in Python with a truststore shim, and the reason
the browser completed TLS to `api.genai.mil` in the August probes.

**Never set `tls.Config.RootCAs`.** An explicit pool REPLACES the platform
verifier. Pinning DoD roots alone breaks every ordinary site. This was the
error in the original handoff, and the language is in the source comment
so nobody repeats it.

**Proxy resolution.** Go's `http.ProxyFromEnvironment` reads only
`HTTP_PROXY` and `HTTPS_PROXY`, which a managed machine does not set. The
build uses `github.com/mattn/go-ieproxy` behind a `//go:build windows`
tag. `ieproxy.GetProxyFunc()` calls
`WinHttpGetIEProxyConfigForCurrentUser` with a registry fallback, covering
the static WinINET setting, an explicit PAC URL, and WPAD, in that order.
Same resolution order AegisCode implements by hand.

**No CGO.** `CGO_ENABLED=0` keeps it a single static file with no runtime,
no installer, and no admin rights needed to run it.

---

## 5. Error messages

A bare `dial tcp: i/o timeout` is the same failure of legibility that made
the CORS abort cost weeks. Every failure path names a cause and an action.

| Condition | Response |
|-----------|----------|
| No `Authorization` | 401, save your key in GunnyBot settings |
| Foreign `Origin` | 403, this endpoint serves the local page only |
| Cross-site `Sec-Fetch-Site` | 403, cross-site request refused |
| Path outside the allowlist | 404, names the path |
| Wrong method | 405, names the right one |
| Upstream 401 | STARK keys lock and need a CAC unlock, with the docs URL |
| Upstream 503 with HTML | You are off the government network, with the reason |
| TLS failure | Machine certificate store problem, report it, not an app bug |
| DNS failure | Confirm you are on the government network |
| Proxy refusal | The site proxy refused, this host is fenced |
| Timeout | No answer in time, check network and proxy settings |

The 503 case is measured, not guessed. On 2026-09-20 the gateway answered
a request from a commercial network with HTTP 503 and an HTML page reading
"You have reached this page because you are not authorized to visit
GenAI.mil from outside of DoW networks." Passing that HTML to a JSON
client produces a parse error and a useless message, so the host detects
it and says what actually happened.

That same measurement is the standing answer to "just call it server side
from cloud.gov." No cloud-hosted backend reaches this gateway.

---

## 6. Build

Build with Go 1.26.10 or newer. Older Go releases carry standard library vulnerabilities this code can reach, which the `Go host` CI job fails on.

```bat
:: 1. Static export with no basePath.
set DEPLOY_TARGET=cloudgov
npm run build

:: 2. Stage it where the binary embeds from.
rmdir /S /Q webroot
xcopy /E /I /Y out webroot

:: 3. One file, no runtime.
set GOOS=windows
set GOARCH=amd64
set CGO_ENABLED=0
go build -trimpath -ldflags "-s -w" -o SemperScribe.exe
```

`next.config.ts` resolves `basePath` to the empty string when
`DEPLOY_TARGET=cloudgov`, which is what makes `out/` servable from a root.
Building with the default `ghpages` target produces `/semperscribe`
prefixed assets and a page that loads unstyled. That is the single most
likely build mistake.

**Offline builds.** Government build machines may not reach
`proxy.golang.org`. Run `go mod vendor` once on a connected machine and
commit `vendor/`. Builds then work with no network. Verified: 6.6 MB
vendored, and the Windows binary builds from it.

---

## 7. Running it

The user double-clicks `SemperScribe.exe`. A console window prints:

```
SemperScribe is running at http://127.0.0.1:52341
In GunnyBot settings set the provider proxy URL to:
    http://127.0.0.1:52341/api
Leave this window open. Close it to stop.
```

The browser opens on its own. Port 0 picks a free port, so nothing
collides. Pass `-port 8765` for a stable address worth writing in a guide,
and `-no-open` for a headless run.

---

## 8. Open items before this ships

1. **Confirm the endpoint paths.** The allowlist assumes
   `/v1/chat/completions`, `/v1/embeddings`, and `/v1/models` under
   `api.genai.mil`. Read the `servers` block and paths from
   `https://genai.mil/stark/api/swagger-ui/` on a government workstation
   and correct the map if they differ. The August PowerShell POST to
   `api.genai.mil/v1/chat/completions` returned 200, so that one is
   confirmed. The other two are inferred from a secondhand description.
2. **Run it on a government workstation.** Everything above is verified in
   a Linux sandbox and cross-compiled. The WinINET path, the Windows
   certificate store path, and a real authenticated call are unverified on
   the target. Expect that to be the first real test.
3. **Unsigned executable.** Confirm a user-space unsigned `.exe` runs at
   all under whatever application control the image enforces. If it does
   not, this whole approach needs a signing path before anything else.
4. **Accreditation.** An executable on a government workstation lands
   inside the boundary. `RMF_READINESS.md` needs a paragraph. The favorable
   facts: no credential stored, no inbound network exposure, no persistence,
   no installer, no admin rights, and no telemetry.
5. **Distribution.** Decide how the binary reaches users and how they learn
   a new version exists. A version banner on the console line is the cheap
   first answer.

---

## 9. Files

| File | Purpose |
|------|---------|
| `main.go` | Server, allowlist, origin checks, forwarder, error mapping |
| `proxy_windows.go` | WinINET and PAC resolution through go-ieproxy |
| `proxy_other.go` | Environment fallback for non-Windows builds |
| `go.mod` | One direct dependency |
| `webroot/` | Build output, staged from `out/`, embedded at compile time |
