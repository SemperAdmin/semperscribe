# SemperScribe RMF Readiness Pre-Draft

Pre-draft of artifacts an RMF Security Control Assessor would request, prepared voluntarily ahead of any DoD sponsorship. This is not an authorization package and does not substitute for one.

- Last reviewed: 2026-05-23
- Document version: 1.0
- System: SemperScribe Proof of Concept
- Repo: https://github.com/SemperAdmin/semperscribe
- Current ATO status: None. Not under RMF scope per DoDI 8510.01 paragraph 1.1.

## 1. RMF Step 1. Categorize

### System Description

SemperScribe is a client-side single-page application that helps users draft, format, and export USMC correspondence documents (letters, memoranda, directives, AMHS messages). The application processes only data the user enters in the browser. It performs no server-side processing. It maintains no system of records. It has no users in the access-control sense; anyone with a web browser can access the deployed static site.

### FIPS 199 Categorization

Per FIPS PUB 199, "Standards for Security Categorization of Federal Information and Information Systems," and NIST SP 800-60.

| Security Objective | Potential Impact | Justification |
|--------------------|------------------|---------------|
| Confidentiality | Low | The system processes only user-entered text. By design, it does not collect, store, or transmit PII, CUI, or other sensitive information. Disclosure of compromise of in-browser session data would have a limited adverse effect on the user. |
| Integrity | Low | The system processes a document draft on behalf of the user. Unauthorized modification would result in a malformed draft, not corruption of an authoritative record. Federal records are created downstream when the user uses the output officially; that record handling is out of scope for this system. |
| Availability | Low | The system is static and reproducible from source. Loss of availability of the GitHub Pages deployment would not prevent users from generating documents using a local clone or alternative deployment. |

**Overall Categorization. Low.**

### Information Types

Per NIST SP 800-60 Volume 2 information type mapping.

| Information Type | Confidentiality | Integrity | Availability |
|------------------|-----------------|-----------|--------------|
| C.3.5.4 General-Purpose Productivity Software (assistance) | Low | Low | Low |

No higher-impact information types apply because the system does not collect or store data on behalf of the Federal government.

## 2. RMF Step 2. Select Controls

NIST SP 800-53 Rev 5 Low baseline control selection. The status column indicates current implementation state.

### Access Control (AC)

| Control | Status | Notes |
|---------|--------|-------|
| AC-1 Policy and Procedures | Partial | SECURITY.md and Privacy Notice provide policy. Procedures live in COMPLIANCE_REMEDIATION_PLAN.md. |
| AC-2 Account Management | N/A | No accounts. Public static site with no authentication. |
| AC-3 Access Enforcement | N/A | No access control surface. |
| AC-7 Unsuccessful Logon Attempts | N/A | No logon. |
| AC-14 Permitted Actions Without ID/Auth | Compliant | All actions permitted without authentication, consistent with public read-only static site. |
| AC-22 Publicly Accessible Content | Compliant | Public content is reviewed via the audit pass. No CUI or sensitive information present. |

### Audit and Accountability (AU)

| Control | Status | Notes |
|---------|--------|-------|
| AU-1 Policy and Procedures | Partial | GitHub Actions workflow logs provide build and deploy audit trail. |
| AU-2 Event Logging | Partial | GitHub Actions retains workflow logs for 90 days by default. |
| AU-12 Audit Record Generation | Partial | Workflow logs plus git commit history. |

### Assessment, Authorization, and Monitoring (CA)

| Control | Status | Notes |
|---------|--------|-------|
| CA-1 Policy and Procedures | Compliant | COMPLIANCE.md plus this document. |
| CA-2 Control Assessments | Self-Assessed | This document is the self-assessment. |
| CA-5 Plan of Action and Milestones | Compliant | COMPLIANCE_REMEDIATION_PLAN.md tracks open and closed items. |
| CA-7 Continuous Monitoring | Compliant | CodeQL on every push and weekly. npm audit reviewable on demand. SBOM regenerated each deploy. |

### Configuration Management (CM)

| Control | Status | Notes |
|---------|--------|-------|
| CM-1 Policy and Procedures | Compliant | Git workflow with tagged baselines. |
| CM-2 Baseline Configuration | Compliant | Baseline tagged at `baseline-pre-compliance` SHA `4561cf5`. Pre-deletion snapshot at `pre-p2-2-orphan-removal`. |
| CM-3 Configuration Change Control | Compliant | All changes via git commits with descriptive messages. |
| CM-6 Configuration Settings | Compliant | next.config.ts, tsconfig.json, .nvmrc all version-controlled. |
| CM-8 System Component Inventory | Compliant | SBOM via CycloneDX on every deploy. LICENSES.md inventory. |

### Contingency Planning (CP)

| Control | Status | Notes |
|---------|--------|-------|
| CP-1 Policy and Procedures | Partial | Git history is the recovery mechanism. |
| CP-9 System Backup | Compliant | Git remote on github.com plus local clones. SBOM artifacts retained 90 days. |
| CP-10 System Recovery | Compliant | Reproducible from source. `git checkout baseline-pre-compliance && npm install && npm run build`. |

### Identification and Authentication (IA)

| Control | Status | Notes |
|---------|--------|-------|
| IA-1 Policy and Procedures | N/A | No authentication surface. |
| All IA-2 through IA-8 | N/A | System has no users in the IA sense. |

### Incident Response (IR)

| Control | Status | Notes |
|---------|--------|-------|
| IR-1 Policy and Procedures | Compliant | SECURITY.md establishes the disclosure process. |
| IR-4 Incident Handling | Best Effort | Per SECURITY.md, no formal SLA, best-effort triage. |
| IR-6 Incident Reporting | Compliant | GitHub Private Vulnerability Reporting + Security Advisories. |

### Planning (PL)

| Control | Status | Notes |
|---------|--------|-------|
| PL-1 Policy and Procedures | Compliant | COMPLIANCE_REMEDIATION_PLAN.md, COMPLIANCE.md, this document. |
| PL-2 System Security and Privacy Plans | Compliant | Privacy Notice at /privacy. Security and compliance posture in README. |
| PL-4 Rules of Behavior | Compliant | Persistent banner plus Privacy Notice plus README disclaimer establish user expectations. |

### PII Processing and Transparency (PT)

| Control | Status | Notes |
|---------|--------|-------|
| PT-1 Policy and Procedures | Compliant | Privacy Notice covers PII posture. |
| PT-2 Authority to Process PII | N/A | System does not process PII by design. |
| PT-5 Privacy Notice | Compliant | /privacy route plus SECURITY.md. |

### Risk Assessment (RA)

| Control | Status | Notes |
|---------|--------|-------|
| RA-1 Policy and Procedures | Compliant | COMPLIANCE_REMEDIATION_PLAN.md is the risk register and remediation plan. |
| RA-3 Risk Assessment | Compliant | Audit pass documented in COMPLIANCE_REMEDIATION_PLAN.md. |
| RA-5 Vulnerability Monitoring and Scanning | Compliant | CodeQL plus npm audit. |

### System and Services Acquisition (SA)

| Control | Status | Notes |
|---------|--------|-------|
| SA-1 Policy and Procedures | Compliant | OSS Guidance compliance documented in LICENSES.md. |
| SA-4 Acquisition Process | Compliant | OSS acquisition via npm with license review. |
| SA-8 Security and Privacy Engineering Principles | Compliant | User-responsibility framing, no telemetry, no backend, build-time-only external touch. |
| SA-22 Unsupported System Components | Tracked | inflight memory leak and old glob versions documented as accepted residual where applicable. |

### System and Communications Protection (SC)

| Control | Status | Notes |
|---------|--------|-------|
| SC-1 Policy and Procedures | Compliant | Architecture is static SPA with no backend. |
| SC-5 Denial of Service Protection | N/A | Static export, no compute to exhaust. |
| SC-7 Boundary Protection | Compliant | Boundary is the user's browser plus the github.io static origin. No external runtime hosts contacted. |
| SC-13 Cryptographic Protection | Compliant | HTTPS only via GitHub Pages. No app-level crypto required. |
| SC-23 Session Authenticity | N/A | No sessions. |

### System and Information Integrity (SI)

| Control | Status | Notes |
|---------|--------|-------|
| SI-1 Policy and Procedures | Compliant | CodeQL plus npm audit plus TypeScript strict. |
| SI-2 Flaw Remediation | Compliant | npm audit reports zero findings. CodeQL findings triaged. |
| SI-3 Malicious Code Protection | Partial | Browser native sandboxing plus CodeQL. No app-layer scanning. |
| SI-4 System Monitoring | Compliant | GitHub Security tab plus weekly CodeQL plus workflow run logs. |
| SI-7 Software and Firmware Integrity | Compliant | Git commit SHAs plus SBOM hashes. |
| SI-10 Information Input Validation | Partial | Form schemas via Zod for typed inputs. No CUI scrubbing because none expected. |

### Supply Chain Risk Management (SR)

| Control | Status | Notes |
|---------|--------|-------|
| SR-1 Policy and Procedures | Compliant | LICENSES.md plus npm overrides plus SBOM. |
| SR-2 SCRM Plan | Compliant | COMPLIANCE_REMEDIATION_PLAN.md Phase 3 covers SCRM. |
| SR-3 Supply Chain Controls and Processes | Compliant | Dependency review on each direct-dep change. CodeQL on every push. |
| SR-4 Provenance | Compliant | SBOM in CycloneDX format on each deploy. |
| SR-11 Component Authenticity | Compliant | npm install from npmjs.org with package-lock.json integrity hashes. |

## 3. RMF Step 3. Implement Controls

Implementation status summarized in the tables above. Detailed implementation evidence lives in:

- `docs/COMPLIANCE.md` (SSDF practice mapping)
- `docs/COMPLIANCE_REMEDIATION_PLAN.md` (audit trail)
- `.github/workflows/deploy.yml` (build, SBOM, deploy automation)
- `.github/workflows/codeql.yml` (static analysis)
- `SECURITY.md` (disclosure channel)
- `LICENSES.md` (third-party inventory)
- `LICENSE` (project license)
- `src/app/privacy/page.tsx` (privacy notice)

## 4. RMF Step 4. Assess Controls

Self-assessment posture only. No SCA has performed an independent assessment. If sponsored to ATO, an SCA would assess each control per the Status column above plus any supplementary controls the AO requires.

## 5. RMF Step 5. Authorize

Not authorized. No AO has reviewed this system. Use is at user discretion only.

If sponsored:

- Recommend Provisional Authorization based on Low impact categorization.
- Recommend conditional reciprocity for any subsequent DoD Component deployment.

## 6. RMF Step 6. Continuous Monitoring

Active controls reviewed on the cadence below.

| Activity | Cadence | Trigger |
|----------|---------|---------|
| CodeQL static analysis | Every push, every PR, weekly Monday | Automatic via GitHub Actions |
| npm audit | On dependency change | Manual `npm audit` |
| SBOM generation | Every deploy | Workflow `Generate SBOM` step |
| License inventory review | On direct dependency change | Manual update to LICENSES.md |
| Compliance plan refresh | When material policy or architecture changes occur | Manual |
| RMF readiness review | Annually or on material policy or architecture change | Manual |

## 7. Boundary Diagram

Text representation of the system boundary.

```
+------------------------------------------------------------+
|                  User's Web Browser                        |
|  (Browser sandbox is the authorization boundary)           |
|                                                            |
|   +-----------------+        +----------------------+      |
|   |  SemperScribe   |        |  Browser localStorage|      |
|   |  static bundle  |<------>|  (user drafts only)  |      |
|   |  (HTML/JS/CSS)  |        +----------------------+      |
|   +-----------------+                                      |
|           ^                                                |
+-----------|------------------------------------------------+
            |
            | HTTPS (same origin)
            |
+-----------v------------------------------------------------+
|              GitHub Pages CDN (https://semperadmin.         |
|              github.io/SemperScribe)                       |
|  Serves static HTML, JS, CSS, woff2 font files.            |
|  No backend logic. No database. No API endpoint.           |
+------------------------------------------------------------+
```

Build-time only. The CI/CD pipeline contacts the npm registry, fonts.googleapis.com (via next/font/google self-host), and GitHub Actions infrastructure. None of these are contacted at runtime by users.

## 8. Authorization Boundary Definition

For the purpose of FIPS 199 and NIST SP 800-37 RMF, the authorization boundary is.

- The static export bundle hosted on github.io.
- The browser-side localStorage where user drafts persist.
- The user's browser session.

Out of the boundary.

- GitHub.com itself (handled by GitHub's separate compliance posture).
- The user's workstation operating system.
- Any network the user is on.
- Any downstream system the user routes a generated document through (e.g., email, EDMS, official records repositories).

## 9. Risks Accepted

| Risk | Severity | Rationale for Acceptance |
|------|----------|--------------------------|
| Deprecated inflight package transitive | Low | Memory leak only impacts long-running Node processes. SemperScribe build is short. |
| MPL-2.0 axe-core transitive | Low | Dev-only dependency, not in production bundle. Approval gap closes if PoC moves to formal release. |
| No formal SLA for vulnerability response | Low | Personal PoC. Documented in SECURITY.md. |
| No coordinated disclosure process | Low | Documented in SECURITY.md. Best-effort triage. |

## 10. Conditions for Authorization

If a DoD Component sponsors this PoC for ATO, the following gaps would need closure.

- Formal vulnerability response SLA aligned with the sponsoring Component's expectations.
- Component CIO approval for MPL-2.0 axe-core per OSS Guidance paragraph 3G.
- Records management EIS registration per MCO 5210.11F if the tool is to be used officially.
- Privacy Impact Assessment (PIA) per OMB M-03-22 if PII processing becomes a possibility.
- Migration from github.io public hosting to a DoD-approved hosting environment per the sponsoring Component's policies.
- Continuous monitoring tied to the Component's RMF Knowledge Service tooling.
