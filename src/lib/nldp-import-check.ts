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

export async function checkImportedPackage(raw: unknown, byteLength?: number): Promise<PackageCheck> {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (typeof byteLength === 'number' && byteLength > MAX_PACKAGE_BYTES) {
    return { ok: false, errors: [`The file is ${(byteLength / 1024 / 1024).toFixed(1)} MB; the importer reads up to ${MAX_PACKAGE_BYTES / 1024 / 1024} MB.`], warnings };
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, errors: ['The file is not a data package: it does not hold a JSON object.'], warnings };
  }
  const asFull = fullPackage.safeParse(raw);
  if (asFull.success) {
    const { integrity } = asFull.data;
    if (integrity) {
      // Recomputed over the file's own data block, not zod's copy: the
      // parser reorders keys, and the exporter hashed the bytes as written.
      const serialized = JSON.stringify((raw as { data: unknown }).data);
      if (typeof integrity.crc32 === 'string' && calculateCRC32(serialized) !== integrity.crc32) {
        warnings.push('The package was changed after it was exported (CRC32 mismatch).');
      } else if (typeof integrity.dataHash === 'string' && (await calculateSHA256(serialized)) !== integrity.dataHash) {
        warnings.push('The package was changed after it was exported (SHA-256 mismatch).');
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
