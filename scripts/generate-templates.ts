import fs from 'fs';
import path from 'path';
import { PUBLISHED_TEMPLATES } from '../src/lib/templates';
import { serializeTemplatePackage, indexEntry } from '../src/lib/templates/publish';

/**
 * Publishes the code templates to public/templates/global as .nldp
 * files and rewrites the picker's index.json.
 *
 * The filename is the KEY of PUBLISHED_TEMPLATES, not the document
 * type, so a type can publish more than one template. The Order ships
 * two: a worked example and a format guide.
 *
 * Output is deterministic (see TEMPLATE_PACKAGE_EPOCH), so a run that
 * changes nothing writes nothing and
 * tests/published-templates.test.ts can hold the files on disk to the
 * code byte for byte.
 *
 * Run with:  npx tsx scripts/generate-templates.ts
 */

const OUTPUT_DIR = path.join(process.cwd(), 'public/templates/global');
const INDEX_FILE = path.join(OUTPUT_DIR, 'index.json');

function generate() {
  console.log(`Generating templates in ${OUTPUT_DIR}...`);

  const existingIndex = JSON.parse(fs.readFileSync(INDEX_FILE, 'utf-8')) as { id: string }[];
  const generatedIds = new Set(Object.keys(PUBLISHED_TEMPLATES));
  const generatedRows: ReturnType<typeof indexEntry>[] = [];
  let written = 0;

  for (const [id, template] of Object.entries(PUBLISHED_TEMPLATES)) {
    const filePath = path.join(OUTPUT_DIR, `${id}.nldp`);
    const body = serializeTemplatePackage(id, template);
    const current = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf-8') : null;
    if (current !== body) {
      fs.writeFileSync(filePath, body);
      console.log(`Wrote: ${id}.nldp`);
      written++;
    }
    generatedRows.push(indexEntry(id, template));
  }

  // Index ORDER is curated and must survive a regeneration. Rows sit
  // where a person put them: same-page-endorsement is deliberately
  // next to endorsement, and a test pins that adjacency. Rebuilding
  // the list as "everything generated, then everything else" threw
  // that away. So walk the existing index, refresh the generated rows
  // in place, and give a genuinely new row a home next to its own
  // document type.
  const byId = new Map(generatedRows.map((r) => [r.id, r]));
  const placed = new Set<string>();
  const finalIndex: (ReturnType<typeof indexEntry> | { id: string })[] = [];

  for (const row of existingIndex) {
    const refreshed = byId.get(row.id);
    if (refreshed) {
      finalIndex.push(refreshed);
      placed.add(row.id);
    } else {
      finalIndex.push(row);
    }
  }

  for (const row of generatedRows) {
    if (placed.has(row.id)) continue;
    const lastOfType = finalIndex.map((r) =>
      (r as { documentType?: string }).documentType).lastIndexOf(row.documentType);
    if (lastOfType === -1) finalIndex.push(row);
    else finalIndex.splice(lastOfType + 1, 0, row);
    console.log(`Indexed new template: ${row.id}`);
  }

  const indexBody = JSON.stringify(finalIndex, null, 2);
  if (fs.readFileSync(INDEX_FILE, 'utf-8') !== indexBody) {
    fs.writeFileSync(INDEX_FILE, indexBody);
    console.log('Updated index.json');
  }
  console.log(`${written} template file(s) changed. Index lists ${finalIndex.length}.`);
}

generate();
