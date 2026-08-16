# Controlled diagnostic probe: reusable prompt

Use this when a system fails and the competing explanations are cheap to
argue about and expensive to test. It produces a single self-contained
file you carry to the failing machine, run once, and read the answer off.

The pattern is positive and negative controls from laboratory assay
design, joined to differential testing. The core rule: a diagnostic with
no controls measures your instrument, not your system.

---

## The prompt

```
Build me a controlled diagnostic probe.

SYMPTOM: <the failure, with the exact error text if you have it>
ENVIRONMENT: <where the failure happens, and what I am able to run
              there: OS, browser, shell, admin rights, network>
COMPETING THEORIES: <your list, or write "you generate them">
ALREADY MEASURED: <what is known, or "nothing">

Rules for the probe:

1. CONTROLS FIRST. Include a positive control aimed at something known
   to work and a negative control aimed at something known to fail. If
   either control misbehaves, the probe reports VOID and tells me to
   ignore every other result. A run with no controls measures the
   instrument, not the system.

2. DIFFERENTIAL TESTS. Each test varies exactly one factor from another
   test, so its outcome eliminates one specific theory. Name the theory
   each test kills. No test earns a slot without one.

3. VERDICT TABLE BEFORE RESULTS. Map outcome combinations to conclusions
   in advance and print the verdict automatically. I want no room to
   read what I expected into the numbers afterward.

4. NO BOOLEANS. Classify every outcome into distinct named states. A
   timeout is not a refusal. An empty answer is not an error. Record
   elapsed time on every test, since speed separates a policy block from
   a dropped connection.

5. AUDIT THE READOUT. State exactly how the API distinguishes success
   from failure, and prove that distinction is real rather than assumed.
   Most bad diagnostics are correct measurements with a wrong readout.

6. FIT THE ENVIRONMENT. Assume no dev tools, no console, no installs, no
   admin rights, unless I said otherwise above. One self-contained file,
   zero dependencies.

7. COPYABLE REPORT. Print environment metadata, every raw result, and
   the verdict as plain text I paste back in one block.

8. STATE THE LIMITS. Say what the probe does not prove and what a second
   run would be needed to close.

Before you hand it to me, run the harness in your own sandbox, force the
VOID path to confirm it fires, and tell me which behaviors you verified
by measurement versus which you took from documentation.
```

---

## Optional additions when the stakes are high

Append either or both:

```
Run this against a system where the answer is already known, and show me
it produces the correct verdict there before I take it to the failing
machine.
```

```
Name the one datum that would overturn your verdict. If no such datum
exists, you have written a belief rather than a measurement.
```

---

## Why each rule is present

| Rule | Failure it prevents |
|------|---------------------|
| 1. Controls | A broken harness reporting "no result" and being read as a real negative |
| 2. Differential tests | A pile of tests that all fail together and eliminate nothing |
| 3. Verdict written first | Reading the expected conclusion into ambiguous numbers after the fact |
| 4. No booleans | Collapsing distinct failure modes into one word and losing the diagnosis |
| 5. Readout audit | A correct measurement with a wrong success criterion, the most common defect |
| 6. Environment fit | A probe needing tooling the failing machine does not have |
| 7. Copyable report | Findings arriving as a screenshot or a paraphrase instead of data |
| 8. Stated limits | A narrow result being carried further than the evidence supports |

---

## Worked example

`scripts/genaimil-transport-probe.html`, 11 August 2026. Four theories
were live about why a browser could not reach an API host: network block,
TLS interception, proxy authentication, and CORS. A prior probe had
reported "fails at the transport layer" and the conclusion was false. The
measurement had been correct and the readout wrong, since the API returns
an opaque response with `ok: false` and `status: 0` on success.

Six tests with two controls settled it in 10 seconds and killed three of
the four theories outright, plus surfaced a second defect nobody had
looked for. Rule 5 is the one that would have prevented the original
error. Rule 1 is the one that would have caught it.
