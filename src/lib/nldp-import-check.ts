/**
 * Shape and integrity check for a data package the user opens.
 *
 * WHY. The Import menu used to JSON.parse the file and spread it into
 * the editor state, with no size cap, no shape check and no look at the
 * integrity block (security review, 2026-10-21, item 2). A hostile or
 * corrupted package could set any form key or crash the render. The
 * checking code in nldp-utils existed but nothing in the app called it.
 *
 * WHAT. Three shapes are accepted, as handleImport always has: a full
 * package ({ data: { formData, ... } }), a bare data block ({ formData,
 * ... }), and a bare form record (the legacy template shape). Lists may
 * be strings or { text } records. The integrity block, when present, is
 * recomputed; a mismatch is a warning the caller puts to the user, never
 * a refusal (owner's ruling of 2026-10-21: warn, do not block), and the
 * hash is a self-attestation that detects corruption, not tampering. A
 * package nothing can read as a letter is refused with the reason.
 */
import { z } from 'zod';
import { calculateCRC32, calculateSHA256 } from '@/lib/nldp-utils';

/** The largest package the importer reads, matching the document importer's cap. */
export const MAX_PACKAGE_BYTES = 10 * 1024 * 1024;

const listed = z.array(z.union([z.string(), z.looseObject({ text: z.string() })]));
const paragraphs = z.array(z.looseObject({ content: z.string().optional(), title: z.string().optional() }));

const dataBlock = z.looseObject({
  formData: z.record(z.string(), z.unknown()),
  paragraphs: paragraphs.optional(),
  vias: listed.optional(),
  references: listed.optional(),
  enclosures: listed.optional(),
  copyTos: listed.optional(),
});

const fullPackage = z.looseObject({
  data: dataBlock,
  integrity: z.looseObject({ crc32: z.string().optional(), dataHash: z.string().optional() }).optional(),
});

/** The legacy template shape: the form record itself, documentType at the top. */
const bareForm = z.looseObject({ documentType: z.string() });

export interface PackageCheck {
  ok: boolean;
  /** Why the package cannot be opened; empty when ok. */
  errors: string[];
  /** Things the user should hear before it opens; the import proceeds on consent. */
  warnings: string[];
}

/**
 * The refusal for a file over the cap, or null when it fits. The caller
 * runs this on the File's byte count before reading or parsing it, so an
 * oversized file never reaches JSON.parse.
 */
export function describeOversize(byteLength: number): string | null {
  if (byteLength <= MAX_PACKAGE_BYTES) return null;
  return `The file is ${(byteLength / 1024 / 1024).toFixed(1)} MB; the importer reads up to ${MAX_PACKAGE_BYTES / 1024 / 1024} MB.`;
}

export async function checkImportedPackage(raw: unknown, byteLength?: number): Promise<PackageCheck> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const oversize = typeof byteLength === 'number' ? describeOversize(byteLength) : null;
  if (oversize) return { ok: false, errors: [oversize], warnings };
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, errors: ['The file is not a data package: it does not hold a JSON object.'], warnings };
  }
  const asFull = fullPackage.safeParse(raw);
  if (asFull.success) {
    const { integrity } = asFull.data;
    if (integrity) {
      // Recomputed over the file's own data block, not zod's copy: the
      // parser reorders keys, and the exporter hashed the bytes as written.
      // Both checks, independently: CRC32 is linear, so an edit which
      // keeps it is easy to construct, and the SHA-256 is the one that
      // detects it. One warning names whichever failed.
      const serialized = JSON.stringify((raw as { data: unknown }).data);
      const failed: string[] = [];
      if (typeof integrity.crc32 === 'string' && calculateCRC32(serialized) !== integrity.crc32) failed.push('CRC32');
      if (typeof integrity.dataHash === 'string' && (await calculateSHA256(serialized)) !== integrity.dataHash) failed.push('SHA-256');
      if (failed.length > 0) {
        warnings.push(`The package was changed after it was exported (${failed.join(' and ')} mismatch).`);
      }
    }
    return { ok: true, errors, warnings };
  }
  if (dataBlock.safeParse(raw).success || bareForm.safeParse(raw).success) {
    return { ok: true, errors, warnings };
  }
  const issue = asFull.error.issues[0];
  errors.push(`The file is not a data package this app can open${issue ? ` (${issue.path.join('.') || 'root'}: ${issue.message})` : ''}.`);
  return { ok: false, errors, warnings };
}
