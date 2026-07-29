# Why GenAI.mil works in the Assistant app but not in GunnyBot

## Verdict

GunnyBot's request to GenAI.mil is essentially correct. It hits the same URL, uses the same Bearer auth, and sends an OpenAI-compatible body. The reason it fails where the Assistant app works is architectural, not a formatting bug: the Assistant app calls GenAI.mil from a local Python server, and GunnyBot calls it from the browser. GenAI.mil is a server-to-server API. It returns no CORS headers and presents a DoD PKI certificate. A browser cannot reach it directly. There is no adapter tweak that makes browser-direct GenAI.mil work. GunnyBot needs a proxy.

## What the working app actually does

`GenAI_Assistant_v0.31` is a Python `ThreadingHTTPServer` bound to `127.0.0.1:8765`. It serves the browser UI and, separately, calls GenAI.mil from Python. The browser talks only to the local server. The local server talks to GenAI.mil.

```
Browser UI  ->  http://127.0.0.1:8765/api/chat  ->  Python LiveApiClient  ->  https://api.genai.mil/v1/chat/completions
```

Evidence from `app/api_client.py` and `app/config/app.json`, ranked by how much it matters for GunnyBot:

1. Server-side call, no CORS. The provider call is Python `requests`, not browser `fetch`. Server-to-server traffic has no CORS check. This is the blocker GunnyBot hits. GenAI.mil almost certainly returns no `Access-Control-Allow-Origin`, so a browser `fetch` is blocked at preflight.

2. DoD PKI TLS trust. The app mounts a `truststore` HTTPS adapter that loads the Windows certificate store, "to avoid a known recursion issue" and, more to the point, so Python trusts GenAI.mil's DoD-issued chain. Standard Python trust (certifi) does not include DoD roots. This confirms `api.genai.mil` presents a DoD PKI certificate. A browser on a CAC-enabled machine with DoD roots trusts it natively. A browser without those roots gets a certificate error. Either way, this is a server-oriented endpoint.

3. Non-streaming. The app sends `"stream": False` and reads the full JSON at `response["choices"][0]["message"]["content"]`. GunnyBot sends `"stream": true` and expects SSE deltas plus `[DONE]`. The author chose non-streaming. If GenAI.mil does not support SSE, GunnyBot's stream parser produces nothing from a plain JSON body. Match the reference: use `stream: false` for GenAI.mil and parse the full response.

4. The gateway strips system context. A comment in `server.py` states that context "is injected directly into every user message, the only channel that survives the genai.mil proxy," and the priming block returns empty. The author found that GenAI.mil's gateway does not reliably pass the system role. For robustness, fold any system instruction into the first user message for GenAI.mil rather than relying on a separate system message.

5. URL and auth match. Base `https://api.genai.mil/v1` plus `/chat/completions` equals `https://api.genai.mil/v1/chat/completions`, which is exactly what GunnyBot builds. Auth is `Authorization: Bearer <key>`, exactly what GunnyBot sends. No difference here.

6. Operational details GunnyBot lacks. A 150 second timeout (GenAI.mil is slow), three retries with backoff, a `/v1/models` listing endpoint, and 401 handling that surfaces an `error.unlock_url` for a locked key. Nice to have, not the blocker.

## Why GunnyBot fails

GunnyBot is a static browser app with no backend. It calls `https://api.genai.mil/v1/chat/completions` with `fetch` from the page origin. Two browser-only barriers stop it that never apply to the Python server: the missing CORS headers block the call, and the DoD certificate is untrusted unless the machine has DoD roots. The Assistant app sidesteps both by never calling GenAI.mil from the browser.

## The fix

Give GunnyBot a proxy, the same role the Python server already plays. Then point GunnyBot's GenAI.mil provider at the proxy instead of at `api.genai.mil`.

```
GunnyBot (browser)  ->  http://127.0.0.1:8788/v1/chat/completions  (local proxy, adds CORS, trusts DoD certs)  ->  https://api.genai.mil/v1/chat/completions
```

A standalone proxy is delivered alongside this note (`genai_proxy.py`, about 60 lines, reusing the Assistant app's truststore approach). Run it, then in GunnyBot Settings set the GenAI.mil proxy base URL to `http://127.0.0.1:8788`. Browsers allow an https page to call `http://127.0.0.1`, so this works from the deployed site and from localhost dev.

Three GunnyBot code changes make the provider correct and usable. None affect the other providers.

1. Mark `genaimilAdapter.browserDirect = false`. It is not browser-direct. The Settings UI should label it "needs a proxy" and require a proxy base URL before enabling it.

2. Add a proxy base URL field for GenAI.mil in Settings, store it, and pass it as `req.proxyBaseUrl`. The adapter already honors `proxyBaseUrl`, so only the UI plumbing is missing.

3. Switch GenAI.mil to non-streaming to match the working reference. Set `stream: false` in the body, add an adapter capability flag `streaming: false`, and have the client read `await res.json()` and emit `choices[0].message.content` as a single token plus a done event when the adapter is non-streaming. Also fold the system message into the first user message for GenAI.mil, since its gateway drops the system role.

## Bottom line

Nothing is wrong with how GunnyBot forms the GenAI.mil request. GenAI.mil is not reachable from a browser. Run the proxy, wire the proxy URL into Settings, and switch the GenAI.mil adapter to non-streaming. That reproduces exactly what the Assistant app does and makes GunnyBot behave the same way.
