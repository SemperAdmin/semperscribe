# Routing the GenAI.mil defect report

Companion to `GENAI_MIL_CORS_DEFECT_REPORT.md`. Where to send it, in what
order, and what to say.

---

## The finding that changes the pitch

CDAO owns GenAI.mil. No public developer bug intake exists, and no
support address is published for the API.

More useful than an address: on 30 April 2026, DefenseScoop published
"Improved but incomplete: GenAI.mil and the last-mile problem" by
Dr. Silas Schaeffer, a contractor supporting the Joint Personnel Recovery
Agency under the Joint Chiefs. He wrote that the API release "holds
massive promise for integrating GenAI.mil into existing developer tools"
and that "the rollout has been met with frustration by some due to
frequent connection failures and errors."

"Connection failures and errors" is the exact symptom these two defects
produce in a browser, and a CORS abort is uninformative by design: no
status, no body, no message. A developer hitting it has no way to
distinguish it from a network outage, a dead key, or their own bug.

So the report is not "my app is broken." It is: **a known class of
complaints about the new API has a measured root cause and a two-line
configuration fix.** Lead with that. It converts a support ticket into
something a program office wants.

Whether every reported failure traces to this is unproven, and the report
says so. Overclaiming here would be the fastest way to be dismissed.

---

## Routes, in priority order

**1. In-platform support inside genai.mil. Do this first.**

Maj Gannon is an authenticated user. Whatever Help, Feedback, or Support
control the platform exposes routes to the team owning the gateway and
arrives with his account context attached, which no external email does.
Attach the report. This is the shortest path and costs one session.

**2. The Marine Corps GenAI.mil adoption POC.**

Five of six services elevated GenAI.mil as their enterprise AI platform,
so HQMC owns a coordination role for it. Route through the unit
knowledge-management or G-6 shop to find who holds it. A service POC
escalating a defect carries more weight than an individual user, and this
one has a Marine Corps program behind it.

**3. The GenAI.mil Task Force (GenTF).**

A 180-day CDAO pilot placing technical experts directly with operational
units to get AI into live mission workflows. Announced publicly by CDAO,
led by Capt Anthony McHugh (USAF) and Capt Ryan Hetrick (USA).

This is the best fit on paper. GenTF exists to unblock exactly this: a
unit with a real workflow, a real integration, and a platform defect
between them. You are bringing them a diagnosed problem rather than a
request for help, which is unusual and worth their time. CDAO announces
GenTF activity on LinkedIn, so that is a viable approach vector.

**4. CDAO general inquiry via ai.mil.**

Slowest, least targeted. Use it only if 1 through 3 stall, and expect
routing delay.

Run 1 and 2 in parallel. They cost different people's time.

---

## Cover message

Short enough to forward without editing. Attach the defect report.

> Subject: GenAI.mil API, measured CORS defect blocking all browser clients, two-line fix
>
> We integrated the GenAI.mil API into a Marine Corps correspondence tool
> and hit persistent connection failures. Rather than work around them we
> measured the cause, from a government workstation, on both the server
> and client side, with experimental controls in place.
>
> The gateway has two independent CORS defects. Either one alone blocks
> every browser-based client:
>
> 1. It authenticates OPTIONS preflight requests and answers the anonymous
>    preflight with HTTP 401. Browsers send preflights without credentials
>    by specification, so this refusal cannot be worked around from the
>    client.
> 2. Ordinary responses omit Access-Control-Allow-Origin. A request that
>    generates no preflight at all still fails.
>
> Non-browser clients are unaffected, which is why the failure looks
> intermittent across your user base rather than universal. The API key,
> network path, TLS, and site proxy are all healthy and were ruled out by
> measurement, not inference.
>
> The fix is gateway configuration: route OPTIONS ahead of the auth
> middleware and return 204 with the standard allow headers, and include
> Access-Control-Allow-Origin on the actual responses. No application code.
>
> The attached report contains both reproductions with exact commands, a
> results table with controls, six ruled-out theories with the evidence
> for each, and a verification procedure your team can run. We are glad to
> re-run our test harness against a staging endpoint and return the full
> result table.
>
> <name, rank, unit, contact>

---

## Before you send

- Decide the attribution line. A defect report with no named reporter is
  unactionable, so the default is your name, rank, unit, and contact. Say
  if you want it anonymised instead and the report changes accordingly.
- Describe SemperScribe as a Marine Corps correspondence tool in
  development, not as a program of record. Overstating its status invites
  a records-management question you do not need in this thread.
- Decide whether Maj Gannon is named as the measuring party. He ran both
  reproductions and would be the point of contact for a staging re-test.
- Route through your chain first if local policy requires it. This is an
  external technical report about a DoD platform, and the content is
  unclassified with no CUI, but the coordination requirement is yours to
  know.

---

## If they ask for the harness

Send `scripts/genaimil-transport-probe.html`. It is one self-contained
page with no dependencies, runs in 10 seconds, and prints its own verdict.
Offer to point it at a staging endpoint and return the result table
unedited. That offer is worth making up front: it gives them a way to
verify their own fix in one step, and it costs you nothing.

Note the trap for whoever verifies: the probe must show BOTH cors-mode
rows passing. Fixing the preflight alone leaves defect 2 in place, and a
test that only checks the OPTIONS response will report success while the
browser path stays broken.

---

## Sources

- Schaeffer, S., "Improved but incomplete: GenAI.mil and the last-mile problem," DefenseScoop, 30 April 2026: https://defensescoop.com/2026/04/30/improved-but-incomplete-genai-mil-and-the-last-mile-problem/
- "Pentagon Establishes Task Force to Accelerate GenAI.mil Adoption," ExecutiveGov: https://www.executivegov.com/articles/pentagon-cdao-genaimil-task-force
- "5 out of 6 military branches have elevated GenAI.mil as their go-to enterprise AI platform," DefenseScoop, 2 February 2026: https://defensescoop.com/2026/02/02/military-branches-genai-mil-enterprise-ai-adoption/
