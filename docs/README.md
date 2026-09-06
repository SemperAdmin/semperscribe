# Semper Scribe documentation

Semper Scribe is a local-first Next.js application for drafting, formatting, and exporting USMC correspondence and administrative documents to SECNAV M-5216.5, MCO 5216.20B, and MCO 5215.1K.

Start the development server.

```bash
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

## Where to look

- Project overview, feature list, and stack: the root [`README.md`](../README.md).
- Security policy and the GunnyBot data-flow statement: [`SECURITY.md`](../SECURITY.md).
- Change record and versions: [`CHANGELOG.md`](../CHANGELOG.md).
- Compliance mapping (SSDF, DoD OSS guidance): [`COMPLIANCE.md`](COMPLIANCE.md) and [`COMPLIANCE_REMEDIATION_PLAN.md`](COMPLIANCE_REMEDIATION_PLAN.md).
- Accessibility findings: [`SECTION_508_FINDINGS.md`](SECTION_508_FINDINGS.md).
- Export pipelines: [`EXPORT_GUIDE.md`](EXPORT_GUIDE.md).
- Portable document packages: [`NLDP_FEATURE_GUIDE.md`](NLDP_FEATURE_GUIDE.md).
- Headless HTTP and MCP companion for EDMS and agent integration: [`COMPANION.md`](COMPANION.md).
- UX and policy program, 2026-09-05: [`UX_POLICY_PLAN_2026-09.md`](UX_POLICY_PLAN_2026-09.md), with the three audits behind it under [`audits/2026-09-05/`](audits/2026-09-05/) (policy, user experience, roadmap reconciliation, and the bundle attribution of the 2026-09-05 dependency group).
- Benchmark comparison against DonDocs: [`DONDOCS_COMPARISON_2026-09-05.md`](DONDOCS_COMPARISON_2026-09-05.md) (first audit, v0.1.0) and [`DONDOCS_COMPARISON_2026-09-05-R2.md`](DONDOCS_COMPARISON_2026-09-05-R2.md) (second audit after the hardening program, v0.4.7).
- Source excerpts of SECNAV M-5216.5 used for rule citations: [`SecNav5216/`](SecNav5216/).
