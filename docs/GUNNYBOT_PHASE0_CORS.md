# GunnyBot Phase 0: Browser-Direct CORS Verdict

Status: PHASE 0 GATE ARTIFACT. Research complete. No source changed.
Date: 2026-07-22
Method: current official docs and provider community reports, July 2026.

## 1. Headline verdict

SemperScribe ships as a static export to GitHub Pages with no backend. Every LLM call goes direct from the browser to the provider. The provider's CORS response headers decide feasibility. The verdict below reshapes the multi-provider-cloud ruling: one provider is a clean go, one is conditional, two are blocked without infrastructure the app does not have.

| Provider | Browser-direct verdict | Required setup | Confidence |
|----------|------------------------|----------------|------------|
| Anthropic | GO | Headers: `x-api-key`, `anthropic-version`, `anthropic-dangerous-direct-browser-access: true` | 0.85 |
| Google Gemini | CONDITIONAL | REST `generateContent`, key via `x-goog-api-key` or query param, keep custom headers minimal to pass preflight | 0.6 |
| OpenAI | NO-GO (unreliable) | Direct browser calls blocked or inconsistent as of late 2025. Needs a proxy. | 0.7 |
| Azure OpenAI | NO-GO | Endpoints return no CORS headers. Backend proxy is the established pattern. | 0.85 |

## 2. Per-provider detail

### 2.1 Anthropic: GO

Anthropic added a request header, `anthropic-dangerous-direct-browser-access: true`, which turns on CORS and allows direct calls from browser JavaScript. Anthropic and the wider community endorse the bring-your-own-key pattern as the safe use of it: the user supplies their own key, so no shared secret sits in the shipped code. This matches the GunnyBot design exactly.

- Required headers: `x-api-key: <user key>`, `anthropic-version: <date>`, `anthropic-dangerous-direct-browser-access: true`, `content-type: application/json`.
- Key exposure caveat: any key placed in client code is readable by the page. Mitigated here by BYO-key plus session-only storage. The user owns the exposure of the user's own key.
- Confidence: 0.85. Documented and in wide production use for BYO-key browser tools.

### 2.2 Google Gemini: CONDITIONAL

The `generativelanguage.googleapis.com` `generateContent` REST endpoint is callable from the browser in practice, with the key passed as `x-goog-api-key` or a query parameter. Two caveats hold it below a clean go.

1. Google explicitly advises against client-side keys and recommends a backend proxy. This is a policy position, not a hard block, but it signals Google reserves the right to tighten this.
2. Certain request headers fail CORS preflight on Google endpoints (a documented case: a custom `Api-Revision` header). The mitigation is to send only the minimal header set and pass the key as a query parameter or the standard `x-goog-api-key` header.

- Confidence: 0.6. Works today for the plain REST path, discouraged by Google, sensitive to header choices. Empirical confirmation recommended before Phase 1 includes it.

### 2.3 OpenAI: NO-GO (unreliable)

Direct browser calls to `api.openai.com/v1/chat/completions` were reported blocked by CORS in late 2025, with the preflight failing on a missing `Access-Control-Allow-Origin` header. Reports were inconsistent: sometimes working, sometimes blocked, with the root cause left officially unconfirmed. An unreliable channel is not a foundation for a shipped feature.

Critical clarification: the OpenAI SDK `dangerouslyAllowBrowser: true` flag only disables the SDK's own client-side guard. It does not add CORS headers and does not fix a browser block. Setting it does not make OpenAI browser-direct feasible.

- Path to yes: a user-supplied CORS proxy (Section 3). Without one, treat OpenAI as blocked for a static app.
- Confidence: 0.7. The instability itself is the finding.

### 2.4 Azure OpenAI: NO-GO

Azure OpenAI endpoints do not return CORS headers for browser origins. The established and documented pattern is a backend proxy which holds the key and manages CORS. SemperScribe has no backend, so direct Azure OpenAI calls are not feasible without the user standing up that proxy.

- Path to yes: a user-supplied proxy (Section 3), or an Azure API Management front configured for CORS by the user.
- Confidence: 0.85.

## 3. The path which keeps multi-provider honest: user-supplied proxy

The static-export constraint blocks OpenAI and Azure, not the app design. A single optional field preserves multi-provider without the app hosting a backend.

- Add an optional per-provider "proxy base URL" field. When set, the adapter sends requests to the user's proxy instead of the provider host.
- The user runs a small CORS-passthrough proxy (for example a Cloudflare Worker or a Cloud Run service) which forwards to OpenAI or Azure and returns permissive CORS headers.
- The key still travels under the user's control. The app stays a pure static site.
- This is a power-user path. It stays out of Phase 1 and lands in a later phase behind a clear "advanced" label.

## 4. Recommended provider scope after Phase 0

1. Phase 1 ships Anthropic only. Clean go, one CORS path, fastest proof of the pipe.
2. Gemini enters after an empirical browser probe confirms the plain REST path from the deployment origin.
3. OpenAI and Azure ship as documented-blocked in the UI, with the optional user-supplied-proxy path deferred. The provider list shows them with a clear "needs a proxy" note rather than a broken button.

This narrows the original multi-provider-cloud ruling to match physical feasibility, and preserves a documented route to the full list.

## 5. Empirical confirmation, optional

Documentation carries the verdict to the confidence levels above. Ground truth for the two uncertain cases (OpenAI current state, Gemini preflight) comes from one test: a browser fetch from the real deployment origin with a dummy key. A dummy key exercises CORS preflight and returns a 401 with CORS headers if the channel is open, or a CORS block if not, without needing real credentials. I run this on request through your browser, or you run it from the deployed site's console.

## 6. Reasoning-engine summary

- Decompose: four providers, one constraint (browser CORS from a static origin).
- Solve with confidence: Anthropic 0.85 GO, Gemini 0.6 CONDITIONAL, OpenAI 0.7 NO-GO, Azure 0.85 NO-GO.
- Verify: each verdict rests on current official docs or provider community reports, cited in the delivery message.
- Combine: the multi-provider-cloud ruling is partially infeasible. Anthropic-first plus a documented proxy path resolves it.
- Reflect: the two sub-0.8 items (Gemini, OpenAI) both point to one cheap empirical test. No blocker to closing the gate on Anthropic. Phase 1 proceeds on Anthropic the moment you rule on provider scope.

## 7. Gate decision needed from you

1. Provider scope: Anthropic-first now, Gemini after the empirical probe, OpenAI and Azure behind an optional proxy later. Confirm or adjust.
2. Empirical probe: run it now for OpenAI and Gemini, or accept the documented verdict and move to the skeleton.
