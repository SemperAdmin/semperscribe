# GunnyBot Implementation Plan

Status: PLAN ONLY. No source changes authorized by this document. Execution waits on your gate approvals per the SemperScribe workflow rules.

Date drafted: 2026-07-22
Owner: Stephen
Scope: Add an opt-in LLM assistant, GunnyBot, driven by a user-supplied API key, to the SemperScribe client-only app.

## 1. Locked rulings (from your answers)

1. Data egress: content-aware. Once the user supplies an API key, GunnyBot has access to the content the user submits to it. Transmission of draft text to the configured provider is in scope and gated by attestation.
2. Providers: multi-provider cloud. Anthropic, OpenAI, Google, Azure OpenAI.
3. Key storage: session only. Key held in memory or sessionStorage, cleared on tab close. No localStorage persistence of the key.
4. Capabilities in scope: Proofreading assist, Drafting assist, Rewrite and tone, Policy Question and Answer.

## 2. The controlling constraint

SemperScribe ships as a static export to GitHub Pages. `next.config.ts` sets `output: 'export'`. No server, no API route, no server-side proxy. Three consequences drive the whole design.

1. The API key lives in the browser. Every request goes direct from the browser to the provider. No backend hides the key or filters outbound content.
2. Browser-direct calls depend on each provider's CORS policy. Support varies by provider and changes over time. This is the single largest feasibility risk and gets its own spike before any UI work (Phase 0).
3. The app's current security copy asserts a no-egress posture. GunnyBot voids that assertion when active. Copy revision is a hard dependency, not a nicety (Section 7).

Confidence in the constraint analysis: 0.95.

## 3. Compliance and posture impact

Three existing artifacts make claims GunnyBot contradicts. Each needs a paired revision.

1. `src/lib/security-utils.ts`, `DISCLAIMERS.OPSEC.localProcessing`: "No document data is sent to a central server for processing." Revise to state the local-first default and name the GunnyBot exception, framed as user-controlled egress to a user-chosen third party.
2. `SECURITY.md`, In Scope: "Information leakage which would route input data (drafted correspondence content) to any third-party host." Reclassify GunnyBot transmission as an intentional, opt-in, user-responsibility data flow, documented, not a defect. Keep genuine leakage (unintended routing, key exposure in logs) in scope.
3. `src/app/privacy/page.tsx`: add a GunnyBot data-handling section. State which fields leave the browser, to which provider, under whose key, and the user's duty to withhold CUI, PII, and classified content.

The CUI framing rule still binds. GunnyBot copy phrases the duty as user-side ("Do not submit CUI, PII, or classified text to GunnyBot"). No "CUI Pending" style wording. The PoC disclaimer banner stays.

Confidence: 0.9.

## 4. Architecture

New code lives under a single namespace, `src/lib/gunnybot/`, plus a store and a component folder. No existing document engine (DOCX, PDF, validators) is touched by GunnyBot logic. GunnyBot reads document state and proposes edits; it never writes to `FormData` without a user accept step.

### 4.1 Modules

1. `src/lib/gunnybot/types.ts`
   - `GunnyProviderId` = 'anthropic' | 'openai' | 'google' | 'azure'.
   - `GunnyMessage`, `GunnyTask` ('proofread' | 'draft' | 'rewrite' | 'qa'), `GunnyModel`, `GunnyRequest`, `GunnyStreamEvent`.
2. `src/lib/gunnybot/providers.ts`
   - A provider registry. Each provider implements one adapter interface:
     - `buildRequest(req): { url, headers, body }`
     - `parseStreamChunk(raw): GunnyStreamEvent[]`
     - `validateKeyShape(key): boolean`
     - `models: GunnyModel[]`
   - Provider specifics to encode:
     - Anthropic: Messages endpoint, headers `x-api-key`, `anthropic-version`, and `anthropic-dangerous-direct-browser-access: true` for browser calls.
     - OpenAI: Chat Completions endpoint, header `Authorization: Bearer`.
     - Google: Gemini generateContent endpoint, key passed per Google's current scheme.
     - Azure OpenAI: user-supplied resource endpoint plus deployment name plus api-version, header `api-key`. CORS depends on the customer's resource configuration.
3. `src/lib/gunnybot/client.ts`
   - One entry point: `streamChat(req, { onEvent, signal })`.
   - Uses `fetch` with streaming response bodies. Parses SSE or provider-specific chunk framing through the adapter. `AbortController` powers a Stop control. No provider SDKs. Raw fetch keeps the bundle small and avoids Node-oriented SDK assumptions.
4. `src/lib/gunnybot/keyring.ts`
   - Session-only key store. Backed by an in-memory value plus an optional `sessionStorage` mirror keyed per provider. Never `localStorage`.
   - `setKey`, `getKey`, `hasKey`, `clearKey`, `clearAll`. A `beforeunload` and `pagehide` clear path. Key-shape validation per provider before acceptance.
   - Reuses the versioned-envelope idea from `storage-utils.ts` for the sessionStorage record, adapted to sessionStorage.
5. `src/lib/gunnybot/redaction.ts`
   - Pre-send scan. Reuses `scanForSensitiveData` from `security-utils.ts`. If SSN, EDIPI, or PHI keywords appear in the outbound payload, the send blocks and the consent gate shows the specific finding. User overrides with an explicit second confirm, and the override records to the session egress log.
6. `src/lib/gunnybot/context-builder.ts`
   - Assembles exactly the fields which leave the browser for each task. This is the auditable egress surface. A unit test pins the output so a future field addition to `FormData` never silently widens what GunnyBot transmits.
7. `src/lib/gunnybot/prompts.ts`
   - System prompts per task, grounded in the app's own rule text. The Policy Q&A prompt embeds the proofread-check categories and the SECNAV and MCO references the app already cites. Guardrails: advisory-only output, no invented citations, no signature generation, no impersonation of named officials.

### 4.2 State

- `src/store/gunnyStore.ts` (zustand, matching `formStore.ts` and `iTypeStore.ts`).
- Holds: selected provider, selected model, key-presence flag (not the key value when session storage is memory-only), conversation transcript, streaming status, last egress-consent timestamp, session egress log.

### 4.3 UI

1. `src/components/SettingsDialog.tsx`: add a fifth tab, "Assistant". Grid changes from `grid-cols-4` to `grid-cols-5`. Contents:
   - Provider select, model select.
   - API key input (password field, no autocomplete).
   - Test-connection button (a single low-token round trip).
   - Key-presence indicator and a Clear Key button.
   - A one-line reminder of the session-only storage rule and the no-CUI duty.
2. `src/components/gunnybot/GunnyBotPanel.tsx`: a slide-out panel or dialog. Chat transcript, streaming render, input box, Stop button, provider and model badge, a visible "content leaves your browser when you send" marker.
3. `src/components/gunnybot/EgressConsentDialog.tsx`: attestation gate. Checkbox ("This text contains no CUI, PII, or classified information"), shown the first time content leaves the browser in a session and again whenever redaction flags a finding. Reuses the `DisclaimerModal` pattern.
4. Launch affordance: a `Bot` icon button in `HeaderActions.tsx`. GunnyBot persona styling stays professional.
5. Task entry points:
   - Proofreading: a "GunnyBot review" action inside `ProofreadModal.tsx`, sitting beside the existing deterministic checklist.
   - Rewrite and tone: a per-paragraph GunnyBot action in `ParagraphItem.tsx`.
   - Drafting: a "Draft with GunnyBot" action in `ParagraphSection.tsx`.
   - Policy Q&A: the main GunnyBot panel chat.

### 4.4 The accept-step rule

Every GunnyBot suggestion which would alter the document renders as a proposed change with an explicit Accept and Reject. GunnyBot never writes to `FormData` directly. This preserves the audit trail and the tight-hand posture on document behavior.

Confidence in the architecture: 0.85. The weak sub-point is provider CORS, addressed in Phase 0.

## 5. Feature specifications

### 5.1 Policy Question and Answer

- Input: a user question about naval correspondence format or policy.
- Context sent: the question plus bundled rule excerpts (proofread categories, cited references). The user's draft is not sent unless the user explicitly attaches it.
- Output: advisory answer, labeled non-authoritative, no auto-application to the document.
- Risk: a compliance tool which invents a SECNAV paragraph number causes real harm. Mitigation: ground answers in bundled text, label advisory, forbid fabricated citations in the system prompt, and surface a "verify against the source" reminder. Confidence the mitigation is required: 0.9.

### 5.2 Proofreading assist

- Input: the current document content.
- Output: tone, clarity, and grammar findings which supplement the deterministic `proofread-checks.ts` results. GunnyBot findings render in a distinct visual lane so the user never confuses a model opinion with a rule-based pass or fail.
- Egress: full draft text leaves the browser. Attestation gate applies.

### 5.3 Rewrite and tone

- Input: a selected paragraph or block.
- Output: a rewrite in naval correspondence voice, presented as a proposed replacement with Accept and Reject.
- Egress: the selected text leaves the browser.

### 5.4 Drafting assist

- Input: a short user prompt plus optional surrounding context.
- Output: a generated or expanded paragraph, inserted only on Accept.
- Egress: the prompt and any attached context leave the browser.

## 6. Cross-cutting guardrails

1. Cost and rate limits: the user pays per token. Show a pre-send token estimate. Cap per-request output. Support Stop mid-stream. No silent retry loops. Surface provider rate-limit and quota errors verbatim.
2. Key exposure: the prod build strips console output except errors (`next.config.ts` `removeConsole`). Add a guard so the key never appears in a thrown error or an error log path.
3. Impersonation: the prior CMC-impersonation audit finding binds GunnyBot. The system prompt forbids generating signatures or attributing content to named real officials.
4. Prompt injection: current inputs are the user's own text, low risk. If a future feature ingests external reference text, revisit.
5. Offline and no-key states: GunnyBot degrades to disabled with a clear reason. The deterministic engines keep working untouched.

## 7. Phasing and gates

Each phase ends at a gate. Tests green, tsc clean, golden and page-parity green, no behavior change to existing document engines. No push without your approval.

| Phase | Deliverable | Gate condition |
|-------|-------------|----------------|
| P0 | Feasibility spike: verify browser-direct CORS for all four providers. Architecture skeleton, no UI. | Documented per-provider verdict. Go or no-go per provider. |
| P1 | keyring (session-only), client, Anthropic adapter, Settings "Assistant" tab, test-connection. Policy Q&A content-free chat. | Round trip works. Key never touches localStorage (asserted by test). |
| P2 | Egress consent gate, redaction, OPSEC and disclaimer and privacy copy revision. | Content-aware path gated. Copy revised and reviewed. |
| P3 | Proofreading assist in ProofreadModal. | GunnyBot lane visually distinct from rule-based checks. |
| P4 | Rewrite and tone, per paragraph, Accept and Reject. | No direct FormData writes. |
| P5 | Drafting assist. | Insert only on Accept. |
| P6 | OpenAI, Google, Azure adapters behind the interface. | Each passes the adapter test suite. |

## 8. Testing

The repo runs a strict vitest suite with golden-file and page-parity tests. GunnyBot tests use mocked fetch, no network, matching the sandbox.

1. Adapter unit tests: request URL, headers, and body shape per provider against fixtures.
2. Keyring test: assert no `localStorage` write occurs, and the key clears on unload.
3. Redaction test: SSN and EDIPI in an outbound payload block the send.
4. Context-builder test: pin the exact egress surface so a `FormData` field addition never silently widens transmission.
5. Store test: streaming status transitions, Stop aborts.
6. No new dependency without a deliberate bump and a test pass. Raw fetch avoids adding a provider SDK.

## 9. Reasoning-engine summary

- Decompose: constraint, compliance impact, architecture, features, guardrails, phasing, tests. Done above.
- Solve with confidence: constraint 0.95, compliance 0.9, architecture 0.85, provider CORS sub-point 0.55.
- Verify: every file path named here was read from the working tree this session. The CORS sub-point is the known weakness.
- Combine: weighted plan confidence 0.82, above the 0.8 threshold.
- Reflect: the sub-0.8 element is provider CORS. Phase 0 isolates it before any UI cost. No restart needed. The plan ships decision-complete on your four rulings.

## 10. Open items for your ruling before Phase 1

1. Confirm docs/ as the home for this plan and for future GunnyBot gate logs, matching prior plans.
2. Confirm the P1 first-feature order: Policy Q&A content-free first to prove the pipe, then the content-aware features after the P2 gate.
3. Confirm the launch affordance location: header button versus a sidebar item.
4. Confirm the GunnyBot persona tone constraints, so the Gunnery Sergeant voice never overrides correctness or professionalism.
