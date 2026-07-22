import type { Metadata } from 'next';
import Link from 'next/link';
import { getBasePath } from '@/lib/path-utils';

export const metadata: Metadata = {
  title: 'Privacy and Security Notice | SemperScribe',
  description: 'SemperScribe Privacy and Security Notice. Non-official Proof of Concept disclosures.',
};

const LAST_REVIEWED = '2026-07-22';
const DOC_VERSION = '1.1';

export default function PrivacyAndSecurityNoticePage() {
  const home = getBasePath() || '/';
  return (
    <div className="min-h-screen bg-background text-foreground py-12 px-6 sm:px-10">
      <div className="max-w-3xl mx-auto space-y-6 text-sm leading-relaxed">
        <header className="border-b pb-4 mb-4">
          <h1 className="text-2xl sm:text-3xl font-bold font-headline">SemperScribe Privacy and Security Notice</h1>
          <p className="text-xs text-muted-foreground mt-2">
            Last reviewed: {LAST_REVIEWED}. Document version: {DOC_VERSION}.
          </p>
          <p className="mt-2">
            <Link href={home} className="text-primary underline hover:no-underline">Return to the application</Link>
          </p>
        </header>

        <section>
          <h2 className="text-lg font-semibold mb-2">1. Status of This Application</h2>
          <p>
            SemperScribe is a non-official Proof of Concept (PoC) maintained on a personal basis. It is not official USMC, DON, or DoD software. It does not carry an Authority to Operate (ATO). Use is at the user's discretion and risk.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">2. What the Application Processes</h2>
          <p>
            SemperScribe processes only the text that the user enters or imports into the in-browser form. All document formatting occurs locally within the browser, and the formatter performs no server-side processing of user input. The optional GunnyBot assistant is the sole exception, described in Section 5A.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">3. What the Application Does Not Do</h2>
          <p className="mb-2">
            The following statements describe the document formatter. The optional GunnyBot assistant is the single exception and is covered in Section 5A.
          </p>
          <ul className="list-disc list-inside space-y-1 pl-2">
            <li>The formatter does not collect, store, or transmit Personally Identifiable Information (PII).</li>
            <li>The formatter does not collect, process, or transmit Controlled Unclassified Information (CUI).</li>
            <li>The application emits no telemetry, no analytics, and no usage beacons to any third-party host at runtime.</li>
            <li>The formatter calls no backend, database, or external API at runtime. GunnyBot, when the user enables it, calls the user's chosen provider directly, per Section 5A.</li>
            <li>The application sets no third-party cookies. Local browser storage is used only for the user's own draft persistence. The GunnyBot API key is held in session memory, not local storage, and clears when the tab closes.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">4. User Responsibilities</h2>
          <p>
            The application has no technical mechanism to recognize or reject sensitive input. Users must not enter CUI, PII, Protected Health Information (PHI), classified material, or any other sensitive data into the form fields. The user bears sole responsibility for the content they enter and the use they make of generated output.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">5. Outbound Network Calls</h2>
          <p>
            At build time, the static export downloads webfont files via Next.js's font/google loader and bundles them with the output. At runtime, the browser fetches only assets served from the same origin as the application, with one exception: when the user enables GunnyBot, the browser also contacts the user's chosen LLM provider, per Section 5A. Reference: Phase 2 of <code>docs/COMPLIANCE_REMEDIATION_PLAN.md</code>.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">5A. The GunnyBot Assistant</h2>
          <p>
            SemperScribe includes an optional AI assistant, GunnyBot, which stays off until the user supplies a personal LLM provider API key. When the user enables it and uses a GunnyBot feature (a format or policy question, a proofreading review, a paragraph rewrite, or a drafted paragraph), the text the user submits to it leaves the browser and goes directly to the user's chosen provider, Anthropic or Google, under the user's own key. The provider processes that text under the provider's own terms and privacy policy, outside SemperScribe's control.
          </p>
          <p className="mt-2">
            The API key is held in browser session memory only. It clears when the tab closes, is never written to disk, and is never sent to any SemperScribe-controlled host. GunnyBot applies no attestation prompt and no content filtering before sending, so the user is solely responsible for not submitting CUI, PII, PHI, or classified text to GunnyBot. GunnyBot output is advisory only. The user reviews and accepts any change, and nothing is written to the document automatically.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">6. Output as Federal Record</h2>
          <p>
            When a user takes a document generated by SemperScribe and uses it to transact official business, that document becomes a Federal record under 44 USC 3301. Records management is the user's responsibility through their Command Designated Records Manager per MCO 5210.11F. SemperScribe does not perform records-management functions and is not registered as an Electronic Information System (EIS).
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">7. Privacy Act Posture</h2>
          <p>
            Because the application does not collect or maintain a system of records, the Privacy Act of 1974 (5 USC 552a) does not apply to SemperScribe as operated. The application is also not registered under any System of Records Notice (SORN). If a user enters real PII into the form, the user assumes any resulting Privacy Act obligations personally. See SECNAVINST 5211.5F paragraph 5b for context on DON privacy responsibilities.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">8. Security Posture</h2>
          <p>
            The application is statically exported and hosted on GitHub Pages. It has no backend. There is no authentication, no session management, and no server-side state. Browser security is the user's first and last line of defense. For vulnerability reporting, see the SECURITY.md document at the repository root.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">9. Compliance References</h2>
          <ul className="list-disc list-inside space-y-1 pl-2">
            <li>Privacy Act of 1974, 5 USC 552a.</li>
            <li>44 USC 3301, Definition of Records.</li>
            <li>SECNAVINST 5211.5F, DON Privacy Program, 20 May 2019, paragraph 5b.</li>
            <li>MCO 5210.11F, Marine Corps Records Management Program, 7 April 2015.</li>
            <li>MCO 5211.5, USMC Privacy Program, 28 August 2024.</li>
            <li>DoDI 5200.48, Controlled Unclassified Information, 6 March 2020.</li>
            <li>NIST SP 800-218 (SSDF v1.1), practices PO.5.1 and PS.1.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">10. Updates to This Notice</h2>
          <p>
            This notice is reviewed when material changes to the application's data handling occur. The Last reviewed date at the top reflects the most recent review. Substantive revisions also bump the Document version field.
          </p>
        </section>

        <footer className="border-t pt-4 mt-8 text-xs text-muted-foreground">
          <p>
            SemperScribe Privacy and Security Notice. Last reviewed {LAST_REVIEWED}. Document version {DOC_VERSION}.
          </p>
          <p className="mt-1">
            <Link href={home} className="text-primary underline hover:no-underline">Return to the application</Link>
          </p>
        </footer>
      </div>
    </div>
  );
}
