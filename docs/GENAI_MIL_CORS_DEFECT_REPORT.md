# Defect report: api.genai.mil blocks all browser-based clients

**To:** GenAI.mil API gateway team
**From:** SemperScribe program, Semper Admin
**Date:** 11 August 2026
**Severity:** Blocking. No web application is able to call the API from a browser.
**Fix scope:** Gateway configuration. Two response headers and one routing change. No application code.

---

## 1. Summary

`api.genai.mil` has two independent CORS defects. Either one alone blocks every
browser-based client. Both are present. Measured on both the server and the
client side, and replicated across two separate network paths.

| # | Defect | Evidence |
|---|--------|----------|
| 1 | The gateway authenticates `OPTIONS` preflight requests and answers the anonymous preflight with `HTTP 401`. Per the WHATWG Fetch specification a preflight is sent without credentials, so this refusal is unavoidable from the client side. | T3, and the 2026-08-06 PowerShell run |
| 2 | Ordinary responses omit the `Access-Control-Allow-Origin` header. A request needing no preflight at all still fails. | T4 |

Non-browser clients are unaffected. A PowerShell or Python client presents its
Bearer token on the first and only request, and no CORS check applies. This is
why desktop integrations against this gateway work while every web integration
fails.

The API key, the network path, TLS, and the site proxy are all healthy. They
have been measured and ruled out. See section 4.

### 1.1 This is not one program's problem

Every browser-based consumer of this API is blocked by the same two
defects. A desktop or server-side client is unaffected, which is why the
failure looks intermittent across the user base rather than universal.

Public reporting is consistent with that pattern. Writing in DefenseScoop
on 30 April 2026, Dr. Silas Schaeffer noted that "the recent release of an
API holds massive promise for integrating GenAI.mil into existing
developer tools" and that "the rollout has been met with frustration by
some due to frequent connection failures and errors."

"Connection failures and errors" is exactly what these two defects produce
in a browser. A CORS abort surfaces to the developer as a bare
`TypeError: Failed to fetch` with no status code, no response body, and no
diagnostic text, because the Fetch specification requires the browser to
withhold all of it. The error is uninformative by design, so a developer
hitting it has no way to tell it apart from a network outage, an expired
key, or a bug in their own code. We spent weeks on those three theories
before measuring the real cause.

We are not asserting that every reported connection failure traces to
this. We are reporting that a measured, reproducible, two-header
configuration defect produces precisely that symptom class, and that
fixing it is cheap.

---

## 2. What we ask you to change

Two changes on the gateway. Both are standard CORS configuration.

**2.1 Answer `OPTIONS` anonymously.**

Route `OPTIONS` ahead of the authentication middleware, and return `204` with:

```
Access-Control-Allow-Origin: <the requesting origin, or a configured allowlist>
Access-Control-Allow-Methods: POST, OPTIONS
Access-Control-Allow-Headers: authorization, content-type
Access-Control-Max-Age: 86400
```

A preflight carries no credentials by design. Authenticating it is the root
cause. The common implementation error is mounting the auth middleware ahead of
the CORS handler, so the auth layer intercepts `OPTIONS` before the CORS layer
ever sees it.

**2.2 Emit `Access-Control-Allow-Origin` on the actual response.**

Include the header on every `POST /v1/chat/completions` response, success and
error alike, not only on the preflight. A browser discards a response body
lacking this header even when the request itself succeeded with `HTTP 200`.

If a wildcard is unacceptable, an allowlist is fine. Our origins:

```
https://semperscribe.app.cloud.gov
https://semperadmin.github.io
```

We do not send cookies and do not need `Access-Control-Allow-Credentials`.

---

## 3. Reproduction

### 3.1 Server side, PowerShell, 6 August 2026

Run from a Marine Corps government workstation on MCEN.

```powershell
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$u = 'https://api.genai.mil/v1/chat/completions'

# Anonymous preflight, exactly what a browser sends first.
Invoke-WebRequest -Uri $u -Method OPTIONS -Headers @{
  'Origin'                         = 'https://semperscribe.app.cloud.gov'
  'Access-Control-Request-Method'  = 'POST'
  'Access-Control-Request-Headers' = 'authorization,content-type'
}
```

Result: **HTTP 401 Unauthorized.**

```powershell
# Same endpoint, authenticated, no browser involved.
Invoke-WebRequest -Uri $u -Method POST -Headers @{
  'Authorization' = "Bearer $key"
  'Content-Type'  = 'application/json'
} -Body '{"model":"gemini-2.5-flash","messages":[{"role":"user","content":"ping"}],"stream":false,"max_tokens":16}'
```

Result: **HTTP 200.** The key is valid and the endpoint works.

### 3.2 Client side, Chromium, 11 August 2026, remote access path

Run from Edge 151 on Chromium, on a Marine Corps government workstation, same
network as the run above. Harness: a standalone HTML page issuing six `fetch`
calls with two controls. Available on request.

| ID | Request | Result | Elapsed |
|----|---------|--------|---------|
| C1 | Control. `no-cors` GET to a known-reachable commercial host | Resolved, opaque | 181 ms |
| C2 | Control. `no-cors` GET to an unroutable `.invalid` name | Rejected | 873 ms |
| T1 | `no-cors` GET `https://api.genai.mil/` | **Resolved, opaque** | 652 ms |
| T2 | `no-cors` POST `/v1/chat/completions`, `content-type: text/plain` | **Resolved, opaque** | 212 ms |
| T3 | `cors` POST `/v1/chat/completions`, `content-type: application/json` | **Rejected** | 212 ms |
| T4 | `cors` GET `https://api.genai.mil/`, no custom headers, no preflight | **Rejected** | 210 ms |

Both controls behaved as designed, so the harness discriminates success from
failure and the run is valid.

### 3.3 Independent replication, wired to the local network

The same harness, same workstation, same browser, run again at 11:24Z with
the remote access path removed and the machine cabled directly to the
local network. Network path is the only variable changed.

| ID | Result | Elapsed, remote | Elapsed, wired |
|----|--------|-----------------|----------------|
| C1 | Resolved, opaque | 181 ms | 182 ms |
| C2 | Rejected | 873 ms | 132 ms |
| T1 | Resolved, opaque | 652 ms | 520 ms |
| T2 | Resolved, opaque | 212 ms | 172 ms |
| T3 | Rejected | 212 ms | 171 ms |
| T4 | Rejected | 210 ms | 167 ms |

All six outcome classes are identical. Latency drops on the wired path as
expected. The defect is not an artifact of remote access, split tunnelling,
or a VPN concentrator.

The timings carry a second finding. On both runs the two failing rows cost
the same as the succeeding round trip: wired, T3 at 171 ms and T4 at 167 ms
against T2 at 172 ms. The browser spent one full network round trip before
rejecting, and that cost tracks network latency across both runs. A local
policy, extension, or client-side short circuit would fail in near-zero
time and would not scale with the path. The refusal is being served by the
gateway.

Reading the rows:

- T1 and T2 use only CORS-safelisted request headers, so no preflight is
  generated. Both resolved with an opaque response, meaning the request left the
  browser, traversed the network, and a response came back. **Transport to
  `api.genai.mil` from this browser is healthy.**
- T3 adds `content-type: application/json`, which is not safelisted, so the
  browser is required to preflight. It failed in 212 ms. A fast failure, not a
  timeout. The preflight received an answer and the answer was unusable. This is
  defect 1.
- T4 is the decisive row. A `cors`-mode GET with no custom headers generates
  **no preflight at all**. It still failed. The only remaining cause is the
  absence of `Access-Control-Allow-Origin` on the response. This is defect 2, and
  it is independent of defect 1.

---

## 4. Ruled out, with evidence

| Theory | Status | Evidence |
|--------|--------|----------|
| Expired or invalid API key | Dead | Authenticated POST returned 200 |
| MCEN or firewall blocks the host | Dead | T1 and T2 resolved. The host is reachable from a browser background fetch |
| Site proxy or Windows integrated auth breaks background requests | Dead | T1 traversed the proxy in 652 ms |
| TLS interception or a missing DoD root in the client truststore | Dead | Chrome completed the TLS handshake to the host on T1 and T2 |
| DNS | Dead | Resolution succeeded on every row |
| Client-side code defect in the calling application | Dead | T3 and T4 are raw `fetch` calls in a blank HTML page with no framework |
| VPN, split tunnelling, or a remote access concentrator | Dead | Section 3.3. Identical results wired directly to the local network |
| A local policy or browser extension killing the request | Dead | T3 and T4 consume a full network round trip and their cost tracks path latency across both runs |

---

## 5. Why no client-side workaround exists

Avoiding the preflight requires using only CORS-safelisted request headers.
`Authorization` is not safelisted, and `content-type` is safelisted only for
`text/plain`, `application/x-www-form-urlencoded`, and `multipart/form-data`.
The API requires a Bearer token and a JSON body, so a preflight is mandatory.

Even a hypothetical preflight-free request still fails, which T4 demonstrates
directly: the browser refuses to expose a response body arriving without
`Access-Control-Allow-Origin`.

The only client-side mitigation is routing every call through a proxy the
organization installs on each workstation, which moves an executable inside the
accreditation boundary, requires a per-user Chrome Local Network Access
permission grant as of Chrome 142, and has to be maintained per user. It also
does nothing for any other browser-based consumer of this API. The gateway
configuration change fixes it once, for everyone.

---

## 6. How to verify the fix

After the change, re-run 3.1. Expected:

- Anonymous `OPTIONS` returns `204` carrying `Access-Control-Allow-Origin`,
  `Access-Control-Allow-Methods`, and `Access-Control-Allow-Headers`.
- The authenticated `POST` continues to return `200`, and its response now also
  carries `Access-Control-Allow-Origin`.

Both halves are required. Verifying only the preflight leaves defect 2 in place
and the browser path still broken.

We are glad to re-run the browser harness against a staging endpoint and return
the full result table.

---

## 7. Reference

- Schaeffer, S., "Improved but incomplete: GenAI.mil and the last-mile problem," DefenseScoop, 30 April 2026: https://defensescoop.com/2026/04/30/improved-but-incomplete-genai-mil-and-the-last-mile-problem/
- WHATWG Fetch, CORS preflight request: https://fetch.spec.whatwg.org/#cors-preflight-request
- WHATWG Fetch, CORS-safelisted request headers: https://fetch.spec.whatwg.org/#cors-safelisted-request-header
- MDN, Access-Control-Allow-Origin: https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Access-Control-Allow-Origin
