
/**
 * Security and Privacy Utilities
 * Handles detection of PII, PHI, and Classification markings.
 */

export const SECURITY_PATTERNS = {
  // SSN: AAA-GG-SSSS or AAA GG SSSS
  SSN: /\b\d{3}[-\s]\d{2}[-\s]\d{4}\b/,
  
  // EDIPI: 10 digits
  EDIPI: /\b\d{10}\b/,
  
  // PHI Keywords (Simple detection)
  PHI_KEYWORDS: [
    "medical", "health", "diagnosis", "prognosis", "treatment", "clinic", 
    "hospital", "patient", "medication", "prescription", "surgery"
  ],
  
  // Classification Keywords
  CLASSIFICATION_LEVELS: ["Unclassified", "Confidential", "Secret", "Top Secret"]
};

export interface SecurityScanResult {
  hasPII: boolean;
  hasPHI: boolean;
  piiMatches: string[];
  phiMatches: string[];
}

/**
 * Scans text or object values for PII and PHI.
 */
export function scanForSensitiveData(data: any): SecurityScanResult {
  const textContent = JSON.stringify(data).toLowerCase();
  const rawContent = JSON.stringify(data); // For case-sensitive regex if needed
  
  const result: SecurityScanResult = {
    hasPII: false,
    hasPHI: false,
    piiMatches: [],
    phiMatches: []
  };

  // Check SSN
  if (SECURITY_PATTERNS.SSN.test(rawContent)) {
    result.hasPII = true;
    result.piiMatches.push("Possible SSN detected");
  }

  // Check EDIPI
  if (SECURITY_PATTERNS.EDIPI.test(rawContent)) {
    result.hasPII = true;
    result.piiMatches.push("Possible EDIPI detected");
  }

  // Check PHI
  SECURITY_PATTERNS.PHI_KEYWORDS.forEach(keyword => {
    if (textContent.includes(keyword)) {
      result.hasPHI = true;
      if (!result.phiMatches.includes(keyword)) {
        result.phiMatches.push(keyword);
      }
    }
  });

  return result;
}

export const DISCLAIMERS = {
  PII_WARNING: {
    title: "Sensitive Data Detected!",
    message: "Warning: Downloading documents containing PII/PHI may violate privacy regulations. Review your document carefully before proceeding."
  },
  CLASSIFIED_WARNING: {
    title: "Classified Document Warning",
    message: "This document will contain classified markings. Ensure proper handling procedures are followed per applicable security regulations."
  },
  FOUO_FOOTER: {
    line1: "FOUO - Privacy Sensitive When Filled In",
    text1: "This form contains personally identifiable information (PII) and is For Official Use Only. Ensure proper handling and storage per DoD Privacy Act guidelines.",
    line2: "FOR OFFICIAL USE ONLY - Privacy Sensitive",
    text2: "Any misuse or unauthorized disclosure can result in both civil and criminal penalties."
  },
  LEGAL_WARRANTY: `THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.`,
  OPSEC: {
    localProcessing: "Document formatting runs entirely client-side in the browser, and the formatter sends no document data to any central server. The optional GunnyBot assistant is the one exception: when you supply your own provider API key and use a GunnyBot feature, the text you submit to it leaves your browser and goes directly to the provider you chose, under your key. GunnyBot stays off until you add a key. Do not submit CUI, PII, or classified text to GunnyBot.",
    userResponsibility: "The user assumes full responsibility for ensuring that the device and network used to access this application are authorized for the level of information being processed."
  }
};
