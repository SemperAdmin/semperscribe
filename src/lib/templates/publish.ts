import { DocumentTemplate } from './types';

/**
 * Serialisation of a code template into the package the Browse
 * Templates picker fetches from `public/templates/global`.
 *
 * This lives in src rather than in scripts/generate-templates.ts so the
 * generator and tests/published-templates.test.ts share one definition.
 * When the test owns a second copy of the format, the two agree with
 * each other and nobody notices that the files on disk agree with
 * neither.
 *
 * NOTE ON THE SHAPE. These files carry the .nldp extension but they are
 * NOT the canonical NLDP package of src/lib/nldp-format.ts, which has a
 * `format`/`version`/`integrity` envelope and wraps vias and copyTos in
 * objects. They are the older ad-hoc template shape, which
 * `handleImport` still accepts (see the "canonical exports tuck distList
 * inside formData; the ad-hoc legacy shape carried it at the data level"
 * note in useImportExport.ts). The previous generator declared a return
 * type of NLDPFile and cast its way past every mismatch; the type below
 * describes what is actually written. Migrating the library to the
 * canonical envelope is separate work.
 */
export interface TemplatePackage {
  metadata: {
    packageId: string;
    formatVersion: string;
    createdAt: string;
    author: { name: string; unit: string };
    package: {
      title: string;
      description: string;
      subject: string;
      documentType: string;
      tags: string[];
    };
    checksums: { dataHash: string; crc32: string };
  };
  data: {
    formData: Record<string, unknown>;
    vias: unknown[];
    references: unknown[];
    enclosures: unknown[];
    copyTos: unknown[];
    paragraphs: unknown[];
    /**
     * Task 17: a Volume template's entire document travels here, verbatim,
     * the same way a live Volume document travels as `data.volume` in an
     * exported .nldp (see nldp-format.ts's NLDPData.volume and
     * useImportExport.ts's handleImport, which already reads this field
     * and calls `useVolumeStore.getState().setDoc()` with it). Absent for
     * every non-Volume template.
     */
    volume?: unknown;
  };
}

/**
 * The createdAt a generated package claims.
 *
 * Fixed, not Date.now(). The generator used to stamp the wall clock, so
 * every run rewrote every file whether its content had changed or not,
 * and a diff could not answer "are the published templates current?"
 * They were not: the Order template was rebuilt in P3.8 and its
 * published package still held the original skeleton, which is what the
 * picker served.
 */
export const TEMPLATE_PACKAGE_EPOCH = '2026-02-10T21:29:17.964Z';

export function createTemplatePackage(id: string, template: DocumentTemplate): TemplatePackage {
  // Task 17: Volume is authored through its own store (useVolumeStore) and
  // its own schema (VolumeDoc) - see volume.ts's asTemplateData comment -
  // which does not fit the letter-shaped destructure below at all (no
  // vias/enclosures/copyTos/paragraphs, and `references` means something
  // different: {text, order}[] against a Volume, not a letter's citation
  // list). Forcing it through that destructure silently drops the document
  // into `data.formData` as stray keys and never produces the `data.volume`
  // payload handleImport() actually reads, so a published Volume template
  // would fetch, "succeed", and load nothing into useVolumeStore. Branch
  // here instead: `data.formData` carries just enough for the type switch
  // (documentType), and the whole document rides as `data.volume`, exactly
  // like a live Volume document's own .nldp export. This branch is kept
  // separate from (rather than merged with) the letter-shaped path below
  // so the byte-for-byte package format every OTHER template has already
  // published stays untouched.
  if (template.typeId === 'volume') {
    return {
      metadata: {
        packageId: `nldp_template_${id}`,
        formatVersion: '1.0.0',
        createdAt: TEMPLATE_PACKAGE_EPOCH,
        author: { name: 'System Template', unit: 'HQMC' },
        package: {
          title: template.name,
          description: template.description,
          subject: 'TEMPLATE',
          documentType: template.typeId,
          tags: ['template', 'standard'],
        },
        checksums: { dataHash: '', crc32: '' },
      },
      data: {
        formData: { documentType: 'volume' },
        vias: [],
        references: [],
        enclosures: [],
        copyTos: [],
        paragraphs: [],
        volume: template.defaultData,
      },
    };
  }

  // defaultData merges formData with the document's arrays; the package
  // format keeps them apart.
  const {
    vias,
    references,
    enclosures,
    copyTos,
    paragraphs,
    ...formData
  } = template.defaultData as Record<string, unknown> & {
    vias?: unknown[]; references?: unknown[]; enclosures?: unknown[];
    copyTos?: unknown[]; paragraphs?: unknown[];
  };

  return {
    metadata: {
      packageId: `nldp_template_${id}`,
      formatVersion: '1.0.0',
      createdAt: TEMPLATE_PACKAGE_EPOCH,
      author: { name: 'System Template', unit: 'HQMC' },
      package: {
        title: template.name,
        description: template.description,
        subject: (formData.subj as string) || 'TEMPLATE',
        documentType: template.typeId,
        tags: ['template', 'standard'],
      },
      checksums: { dataHash: '', crc32: '' },
    },
    data: {
      formData,
      vias: vias || [],
      references: references || [],
      enclosures: enclosures || [],
      copyTos: copyTos || [],
      paragraphs: paragraphs || [],
    },
  };
}

/** The index.json row for a published template. */
export function indexEntry(id: string, template: DocumentTemplate) {
  return {
    id,
    title: template.name,
    description: template.description,
    documentType: template.typeId,
    url: `/templates/global/${id}.nldp`,
  };
}

/** How a published package is written to disk, byte for byte. */
export function serializeTemplatePackage(id: string, template: DocumentTemplate): string {
  return JSON.stringify(createTemplatePackage(id, template), null, 2);
}
