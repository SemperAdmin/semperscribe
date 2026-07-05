# Engineering Prompt Library v1.0

Developed from the 11 source prompts audited on 2026-07-04. The source concepts survive, the defects do not. Every mode below adds the three layers the originals lacked - context intake, evidence requirements, and an output contract.

Consolidation map:

| Source prompt | Disposition |
|---|---|
| 1. Startup MVP builder | Merged into Mode 1 with prompt 6, near-duplicates |
| 2. Codebase audit | Mode 2 |
| 3. Debugging | Mode 3 |
| 4. Performance | Mode 4 |
| 5. Refactor | Mode 5 |
| 6. Backend architecture | Merged into Mode 1 |
| 7. Four-agent team | Dropped. One model role-playing four voices adds tokens, not independent review. Replaced by the Mode Chaining section |
| 8. Frontend | Mode 6 |
| 9. Tech lead | Mode 7 |
| 10. Security | Mode 8 |
| 11. DevOps | Mode 9 |

---

## Shared Context Block

Fill this once per project. Prepend it to every mode. A mode invoked without this block returns a request for it instead of output.

```
PROJECT CONTEXT
Stack: {language, framework, runtime, database - exact versions}
Deployment target: {cloud provider, container platform, or bare host}
Load profile: {requests per second, concurrent users, data volume - numbers, not adjectives}
Data sensitivity: {PII, credentials, regulated data, or none}
Team: {who maintains this after delivery, their skill level}
Non-goals: {what this project explicitly excludes}
Acceptance criteria: {testable statements defining done}
```

## Global Rules

These bind every mode.

1. Read the actual code before making claims about it. No pattern-matching on file names or folder shapes.
2. Cite file path and line range for every finding.
3. Label every material claim with an evidence tier - VERIFIED with source, INFERRED with the reasoning chain, ASSUMED with the assumption stated.
4. Severity scale for all findings: Critical, Major, Minor, Informational. Lead with the finding shaping the decision.
5. Never alter behavior during a quality task. Prove parity with tests or diff analysis.
6. When requirements conflict, surface the conflict and stop. Do not resolve tradeoffs silently.
7. When the request is ambiguous on a material point, state the interpretation chosen, then proceed under it.

---

## Mode 1 - Greenfield Build

Replaces source prompts 1 and 6.

Trigger: new application, new service, or new major feature from scratch.

Required inputs: Shared Context Block, feature list ranked by priority, one named tradeoff resolution - the originals demanded "minimal but scales to millions," which is a decision, not an instruction. State which side wins when minimal and scalable collide.

```
Design and build {feature or system} for the project described in the context block.

Sequence:
1. Propose the system architecture. List every component, its single responsibility, and each data flow between components.
2. Present the two decisions with the largest long-term cost - database choice, sync versus async, monolith versus services. Give the tradeoff for each and your recommendation with the reasoning chain. Wait for my confirmation before writing code.
3. After confirmation, deliver: file structure, database schema with indexes justified per query, API contract with request and response shapes, error handling strategy, and the implementation.
4. Every scaling decision references the load profile numbers from the context block. No design justified by unquantified future growth.

Output contract: architecture section, decision log with tiers, implementation, and a list of everything deferred with the reason for deferral.
```

## Mode 2 - Codebase Audit

Replaces source prompt 2.

Trigger: inherited code, pre-acquisition review, quarterly health check.

Required inputs: Shared Context Block, repository access or file dump, the specific concern motivating the audit if one exists.

```
Audit this codebase.

Sequence:
1. Reverse-engineer the architecture from the code as written, not from any README. Produce a component map.
2. Trace one complete request from entry point to persistence and back. Record every hop.
3. Report findings in these categories: architecture decisions with long-term cost, duplicated logic, tight coupling and circular dependencies, hidden global state, performance risks, maintainability debt.
4. Every finding carries severity, file path, line range, and evidence tier.
5. Deliver a refactoring sequence ordered by risk-adjusted value - highest impact with lowest breakage risk first.

Do not change any code in this mode. Output is the report only.
```

## Mode 3 - Root-Cause Debug

Replaces source prompt 3.

Trigger: defect, outage, or unexplained behavior.

Required inputs: Shared Context Block, exact error output or observed behavior, expected behavior, reproduction steps if known, recent change history.

```
Diagnose this failure.

Sequence:
1. State what the code in the failure path does, line by line, before theorizing about the bug.
2. Form ranked hypotheses. For each: the mechanism, the evidence supporting it, the evidence against it, and a test distinguishing it from the others.
3. Identify the root cause with tier and evidence. If the evidence supports two causes, say so - do not pick one to appear decisive.
4. Enumerate edge cases sharing the same root cause and check whether the fix covers them.
5. Deliver the fix, the regression test proving it, and the test proving the surrounding behavior held.

Never patch a symptom. If the root cause sits outside the provided code, name where it sits and what you need to confirm it.
```

## Mode 4 - Performance Pass

Replaces source prompt 4.

Trigger: measured slowness, cost pressure, pre-launch load preparation.

Required inputs: Shared Context Block, the measured symptom with numbers - latency, memory, cost - and the target number defining success.

```
Optimize {component or path} from {current measurement} toward {target measurement}.

Sequence:
1. Profile first. Identify where the time or memory goes before proposing anything. If profiling is impossible in this environment, state the instrumentation I need to add and stop.
2. Report bottlenecks ranked by measured or estimated cost, each with tier: N+1 queries, unbounded loops, synchronous blocking on hot paths, missing indexes against actual query predicates, unbounded caches, retention leaks.
3. For each proposed change: expected gain with reasoning, implementation risk, and the measurement verifying it.
4. Implement in order of gain-to-risk ratio.
5. Reject any optimization lacking a number. "Faster" is not a result.

Behavior parity per Global Rule 5 applies to every change.
```

## Mode 5 - Refactor

Replaces source prompt 5.

Trigger: working code with structural debt blocking new work.

Required inputs: Shared Context Block, the specific pain motivating the refactor - the change now hard to make, the bug class recurring - and the existing test coverage number.

```
Refactor {scope} to remove {named structural pain}.

Preconditions:
1. If test coverage on the refactor scope sits below a level proving behavior parity, write characterization tests first and show them passing against the current code. No refactor proceeds on untested behavior.

Sequence:
2. Map current structure against target structure. Name each principle applied - separation of concerns, dependency inversion, module boundaries - and the concrete problem it solves here. No principle applied for its own sake.
3. Deliver the new folder structure with the reason for each boundary.
4. Refactor in reviewable increments, tests green after each increment.
5. Close with the architectural delta: what got easier, what got harder, and the honest cost of the new indirection.
```

## Mode 6 - Frontend Component Work

Replaces source prompt 8.

Trigger: new UI components or component-system design.

Required inputs: Shared Context Block, design reference or written visual intent, target framework and styling system, the component consumers - who imports this and how.

```
Build {component or component set} for the stack in the context block.

Requirements per component:
1. Props API designed before implementation - names, types, defaults, and what is intentionally not configurable.
2. All four states designed, not defaulted: loading, empty, error, populated.
3. Accessibility verified, not asserted - keyboard path, focus management, ARIA roles, contrast. Cite the specific WCAG criterion each choice satisfies.
4. Responsive behavior defined at named breakpoints from the design reference.
5. Usage examples covering the common case and the most awkward supported case.

Output contract: component architecture, props tables, implementation, usage examples, and a list of what a consumer misusing the API sees.
```

## Mode 7 - Tech Lead Decision

Replaces source prompt 9. Run this before Mode 1 on anything expensive.

Trigger: build-versus-buy, architecture selection, any decision costing more than a sprint to reverse.

Required inputs: Shared Context Block, the decision stated as a question, the options already considered, the constraint forcing the decision now.

```
Evaluate: {decision question}

Sequence:
1. Ask up to five clarifying questions if material inputs are missing. Otherwise proceed.
2. Present each viable option with: five-year maintenance cost, failure modes, exit cost if the choice proves wrong, and the team-skill fit from the context block.
3. Challenge my framing once - the strongest case for an option I excluded or a reframing of the question, with evidence. If my framing survives, say so and move on. Do not manufacture a second objection.
4. Recommend one option. State the conditions under which the recommendation flips.
5. Deliver the implementation plan for the recommended option in sequenced milestones.

Bias toward the simple option. Complexity earns its place with a number or a named risk, never with "best practice."
```

## Mode 8 - Security Audit

Replaces source prompt 10.

Trigger: pre-launch, post-incident, handling-sensitivity change, scheduled review.

Required inputs: Shared Context Block with the data sensitivity line filled honestly, authentication and authorization model as designed, list of external inputs and integrations.

```
Security-audit this application.

Inspect, with evidence per finding:
1. Authentication - session handling, token expiry, credential storage, reset flows.
2. Authorization - every endpoint checked for enforcement, every ID-bearing route tested for IDOR.
3. Injection - SQL, command, template, header, at every input the integration list names.
4. Secrets - source, config, logs, client bundles, CI variables.
5. Data exposure - PII in logs, verbose errors reaching clients, cache and backup leakage.
6. Transport and infrastructure - TLS, cookie flags, CORS policy, dependency CVEs against pinned versions.

Output contract per finding: severity, attack scenario written as concrete steps an attacker takes, evidence location, fix with code, and the residual risk after the fix. Close with the three findings to fix first and why those three.
```

## Mode 9 - Deployment Readiness

Replaces source prompt 11.

Trigger: first production deploy, platform migration, reliability push.

Required inputs: Shared Context Block, current deploy process as it exists today, tolerance numbers - acceptable downtime, recovery time objective, on-call reality.

```
Prepare this application for production deployment on {target from context block}.

Deliver:
1. Infrastructure architecture sized to the load profile numbers, not to a generic template. Justify every managed service against its cost and its lock-in.
2. CI pipeline running lint, tests, and security scan before any deploy path.
3. Deploy strategy matched to the tolerance numbers - rolling, blue-green, or canary - with the reason the cheaper strategy fails the stated tolerance, if it does.
4. Rollback procedure written as executable steps and the test proving it works.
5. Monitoring - the five alerts paging a human, each tied to a user-visible symptom, plus structured logging and health checks. No dashboard-decoration metrics.
6. Migration reversibility or the stated recovery path per migration.

Reject Kubernetes and service-mesh complexity unless the load profile or team context earns it. State the threshold at which it becomes earned.
```

---

## Mode Chaining

Replaces source prompt 7, the four-agent theater.

Independent review comes from sequence and fresh context, not from one model narrating four personas. Chain modes across separate sessions so each pass reads the artifact cold:

1. Mode 7 decides. Output: decision log.
2. Mode 1 builds against the decision log. Output: implementation.
3. Mode 2 audits the implementation in a fresh session with no build-session context. Output: findings report.
4. Mode 4 and Mode 8 run against the post-audit code. Output: performance and security reports.
5. Mode 9 gates the deploy.

The fresh-session boundary at step 3 is the point. An auditor sharing the builder's context inherits the builder's blind spots.

## Maintenance

Version this file with the project. When a mode produces a bad result, log the failure in the table below and patch the mode - a prompt library nobody amends is a prompt library nobody trusts.

| Date | Mode | Failure observed | Patch applied |
|---|---|---|---|
| | | | |
