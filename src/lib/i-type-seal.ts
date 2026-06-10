// USMC seal as base64 (embedded, not fetched)
// TODO: Replace placeholder with actual USMC seal base64
export const USMC_SEAL_BASE64 = `
data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==
`;

export async function getUSMCSealDataUrl(): Promise<string> {
  return USMC_SEAL_BASE64;
}
