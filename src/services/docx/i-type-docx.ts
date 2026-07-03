import {
  Packer,
  Document,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  AlignmentType,
  BorderStyle,
  WidthType,
  VerticalAlign,
  ImageRun,
  PageBreak,
  Footer,
  LineRuleType,
} from 'docx';
import { FormData } from '@/types';
import {
  deriveService,
  deriveEntity,
  splitAddress,
  deriveAppropriatePublication,
  formatLongDate,
  PAGE3_LINKS,
} from '@/lib/i-type/page3-derivations';
import { coverColumnWidths } from '@/lib/i-type/cover-columns';
import { appendixSection } from './i-type-appendix-docx';

interface ITypeDocxData extends FormData {
  service?: string;
  entity?: string;
  address?: string;
  date?: string;
  publicationType?: string;
  shortTitle?: string;
  volume?: string;
  longTitle?: string;
  timeCompliance?: string;
  nomenclature?: string;
  signingAuthority?: string;
  controllingOffice?: string;
  cuiCategory?: string;
  distributionControl?: string;
  category?: string;
  determinationDate?: string;
  poc?: string;
  supersedureNotice?: string;
  supersedureStatement?: string;
  destructionNotice?: string;
  classificationDestructionProcedure?: string;
  miStatement?: string;
  pcn?: string;
  componentsAffected?: Array<{ nsn: string; tamcn: string; id: string; model: string }>;
}

const FONT = 'Arial';
const SIZE = 22; // 11pt in half-points
const INDENT_25IN = 3600; // 2.5in in twips

const NONE = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
const noTableBorders = {
  top: NONE,
  bottom: NONE,
  left: NONE,
  right: NONE,
  insideHorizontal: NONE,
  insideVertical: NONE,
};
const noCellBorders = { top: NONE, bottom: NONE, left: NONE, right: NONE };

const formatDateAsMonthYear = (dateString?: string) => {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    const month = date.toLocaleString('en-US', { month: 'long' }).toUpperCase();
    return `${month} ${date.getFullYear()}`;
  } catch {
    return dateString;
  }
};

const join = (parts: Array<string | undefined>, sep: string) =>
  parts.filter(Boolean).join(sep);

// Single line, no extra spacing.
const blankLine = () =>
  new Paragraph({ children: [new TextRun({ text: '', font: FONT, size: SIZE })] });

const ruleParagraph = () =>
  new Paragraph({
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 6, color: '000000', space: 1 },
    },
  });

const labelBodyParagraph = (label: string, body: string) =>
  new Paragraph({
    children: [
      new TextRun({ text: label, bold: true, underline: {}, font: FONT, size: SIZE }),
      new TextRun({ text: body, font: FONT, size: SIZE }),
    ],
  });

const textRun = (text: string) => new TextRun({ text, font: FONT, size: SIZE });
const linkRun = (text: string) =>
  new TextRun({ text, color: '0563C1', underline: {}, font: FONT, size: SIZE });

// Page-3 letterhead line at Arial 8 (size 16 half-points), centered.
const p3HeaderLine = (text: string, bold = false) =>
  new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text, bold, font: FONT, size: 16 })],
  });

const plainCenter = (text: string, bold = false, underline = false) =>
  new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [
      new TextRun({
        text,
        bold,
        underline: underline ? {} : undefined,
        font: FONT,
        size: SIZE,
      }),
    ],
  });

// Centered bold service line with the rule bound directly beneath it (no gap).
const serviceLineWithRule = (text: string) =>
  new Paragraph({
    alignment: AlignmentType.CENTER,
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '000000', space: 1 } },
    children: [new TextRun({ text, bold: true, font: FONT, size: SIZE })],
  });

const indentedLine = (text: string) =>
  new Paragraph({
    indent: { left: INDENT_25IN },
    children: [new TextRun({ text, font: FONT, size: SIZE })],
  });

async function loadSeal(): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch('/USMC.png');
    if (!res.ok) return null;
    return await res.arrayBuffer();
  } catch {
    return null;
  }
}

export async function generateITypeDocx(formData: ITypeDocxData): Promise<Buffer> {
  try {
    const children: (Paragraph | Table)[] = [];

    // --- PAGE 1 COVER (body, top-down) ---

    // Date row: left date, right short title + volume.
    children.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: noTableBorders,
        rows: [
          new TableRow({
            children: [
              new TableCell({
                borders: noCellBorders,
                width: { size: 50, type: WidthType.PERCENTAGE },
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: formatDateAsMonthYear(formData.date),
                        font: FONT,
                        size: SIZE,
                      }),
                    ],
                  }),
                ],
              }),
              new TableCell({
                borders: noCellBorders,
                width: { size: 50, type: WidthType.PERCENTAGE },
                children: [
                  new Paragraph({
                    alignment: AlignmentType.RIGHT,
                    children: [
                      new TextRun({ text: formData.shortTitle || '', font: FONT, size: SIZE }),
                    ],
                  }),
                  ...(formData.volume
                    ? [
                        new Paragraph({
                          alignment: AlignmentType.RIGHT,
                          children: [
                            new TextRun({
                              text: `VOLUME ${formData.volume}`,
                              font: FONT,
                              size: SIZE,
                            }),
                          ],
                        }),
                      ]
                    : []),
                ],
              }),
            ],
          }),
        ],
      })
    );

    // One blank line between the volume row and the service line.
    children.push(blankLine());

    // Service line with the rule directly beneath, no gap.
    children.push(serviceLineWithRule(`U.S. MARINE CORPS ${formData.publicationType || ''}`));

    // Long title.
    children.push(plainCenter(formData.longTitle || ''));

    // One blank line, then time compliance.
    children.push(blankLine());
    children.push(plainCenter(formData.timeCompliance || ''));

    // Two blank lines, then the seal at 2in x 2in (192px at 96dpi —
    // template Layout dialog, ruling 2026-06-10).
    children.push(blankLine());
    children.push(blankLine());
    const sealData = await loadSeal();
    if (sealData) {
      children.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new ImageRun({
              data: new Uint8Array(sealData),
              transformation: { width: 192, height: 192 },
              type: 'png',
            } as any),
          ],
        })
      );
    }

    // Two blank lines, then nomenclature.
    children.push(blankLine());
    children.push(blankLine());
    children.push(plainCenter(formData.nomenclature || '', true, true));

    // Ruling 2026-06-10 (hard stance): first SIX component rows ON
    // PAGE 1 — always six drawn, data or not; rows 7+ overflow to
    // page 2. Bottom legal block stays in the first-page footer.
    const components = formData.componentsAffected || [];
    const padToSix = (rows: typeof components) => {
      const out = rows.slice(0, 6);
      while (out.length < 6) out.push({ nsn: '', tamcn: '', id: '', model: '' });
      return out;
    };
    // Fixed column split of the 10800-twip (7.5in) table width per the
    // no-wrap ruling: MODEL gets half, NSN/TAMCN/ID share the rest.
    const widths = coverColumnWidths(10800);

    const headerCell = (text: string, width: number) =>
      new TableCell({
        borders: noCellBorders,
        width: { size: width, type: WidthType.DXA },
        children: [
          new Paragraph({
            children: [new TextRun({ text, bold: true, underline: {}, font: FONT, size: SIZE })],
          }),
        ],
        verticalAlign: VerticalAlign.TOP,
      });

    const bodyCell = (text: string, width: number) =>
      new TableCell({
        borders: noCellBorders,
        width: { size: width, type: WidthType.DXA },
        children: [
          new Paragraph({ children: [new TextRun({ text: text || '', font: FONT, size: SIZE })] }),
        ],
        verticalAlign: VerticalAlign.TOP,
      });

    const componentsTable = (rows: typeof components) =>
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: noTableBorders,
        columnWidths: widths,
        rows: [
          new TableRow({
            children: [
              headerCell('NSN', widths[0]),
              headerCell('TAMCN', widths[1]),
              headerCell('ID', widths[2]),
              headerCell('MODEL', widths[3]),
            ],
          }),
          ...rows.map(
            (row) =>
              new TableRow({
                children: [
                  bodyCell(row.nsn, widths[0]),
                  bodyCell(row.tamcn, widths[1]),
                  bodyCell(row.id, widths[2]),
                  bodyCell(row.model, widths[3]),
                ],
              })
          ),
        ],
      });

    // Page 1: the fixed six-row table after nomenclature.
    children.push(blankLine());
    children.push(componentsTable(padToSix(components)));

    // Page 2: overflow only when it exists; otherwise the page-3
    // section break follows the cover directly.
    if (components.length > 6) {
      children.push(new Paragraph({ children: [new PageBreak()] }));
      children.push(componentsTable(components.slice(6)));
    }

    // --- PAGE 3 AUTHENTICATION LETTER ---
    const p3Service = deriveService(formData.service);
    const p3Entity = deriveEntity(formData.entity);
    const [p3Addr1, p3Addr2] = splitAddress(formData.address);
    const p3Date = formatLongDate(formData.date);
    const p3Pub = deriveAppropriatePublication(formData.publicationType, formData.shortTitle);

    // Page 3 starts here. It becomes its own section (1in margins) below,
    // so the section break provides the page break.
    const page3StartIndex = children.length;

    // Letterhead, Arial 8, centered.
    children.push(p3HeaderLine(p3Service, true));
    children.push(p3HeaderLine(p3Entity));
    children.push(p3HeaderLine(p3Addr1));
    if (p3Addr2) children.push(p3HeaderLine(p3Addr2));

    // One blank line, date, one blank line.
    children.push(blankLine());
    children.push(new Paragraph({ alignment: AlignmentType.RIGHT, children: [textRun(p3Date)] }));
    children.push(blankLine());

    // 1
    children.push(
      new Paragraph({
        children: [
          textRun(
            `1.  This ${p3Pub} is authenticated for Marine Corps use and is effective upon receipt.`
          ),
        ],
      })
    );
    children.push(blankLine());

    // 2
    children.push(
      new Paragraph({
        children: [
          textRun(
            '2.  Per MCO 5100.34_, Commanders, Commanding Officers, and Officers-In-Charge shall identify and report situations that negatively affect safety of operation via the Automated Message Handling System to: COMMARCORSYSCOM DCSEAL QUANTICO VA, PEO LS QUANTICO VA, CMC PPO WASHINGTON DC, CMC I WASHINGTON DC, CMC L WASHINGTON DC, and CMC DCI WASHINGTON DC. Individuals may report potential hazards to Marine Corps Systems Command System Safety at '
          ),
          linkRun(PAGE3_LINKS.safetyEmail1),
          textRun(' and/or to Commandant of the Marine Corps Safety Division (CMC SD) at '),
          linkRun(PAGE3_LINKS.safetyEmail2),
          textRun(
            '. All significant hazards that have the potential to affect other commands and require widespread dissemination shall be reported via a Hazard Report per MCO 5100.29_.'
          ),
        ],
      })
    );
    children.push(blankLine());

    // 3
    children.push(
      new Paragraph({
        children: [
          textRun('3.  Use TDM-Publications portal, at '),
          linkRun(PAGE3_LINKS.portal),
          textRun(
            ', as your central resource for all publication feedback and support. Please use this single portal to:'
          ),
        ],
      })
    );
    children.push(blankLine());

    const sub = (text: string) =>
      new Paragraph({ indent: { firstLine: 576 }, children: [textRun(text)] });
    children.push(sub('a.  Submit a Change Request to report discrepancies or suggest changes.'));
    children.push(blankLine());
    children.push(
      sub(
        'b.  Access Knowledge Base Articles (KBA) for self-help and guidance (including the Change Request Process).'
      )
    );
    children.push(blankLine());
    children.push(sub('c.  Open a Support Case for any further questions not addressed by the KBA.'));
    children.push(blankLine());

    // 4
    children.push(
      new Paragraph({
        children: [
          textRun(
            '4.  For concerns/issues with the content/procedures contact Equipment Specialist or designated Program Office representative (Insert Name, Email, Phone, or Team/PM).'
          ),
        ],
      })
    );

    // 5 conditional
    if (formData.miStatement) {
      children.push(blankLine());
      children.push(new Paragraph({ children: [textRun(`5.  ${formData.miStatement}`)] }));
    }

    // Authentication block
    children.push(blankLine());
    children.push(
      new Paragraph({ children: [new TextRun({ text: 'OFFICIAL', underline: {}, font: FONT, size: SIZE })] })
    );
    children.push(blankLine());
    children.push(blankLine());
    children.push(blankLine());
    children.push(new Paragraph({ children: [textRun('NAME OF SIGNING OFFICIAL')] }));
    children.push(new Paragraph({ children: [textRun(formData.signingAuthority || '')] }));
    children.push(new Paragraph({ children: [textRun(formData.controllingOffice || '')] }));
    children.push(blankLine());
    children.push(new Paragraph({ children: [textRun('DISTRIBUTION: EDO')] }));

    // --- PAGE 1 BOTTOM BLOCK (first-page footer, bottom-anchored, grows upward) ---
    const controlledBy = join(
      [formData.entity, formData.signingAuthority, formData.controllingOffice],
      ' '
    );
    const authScope = join([formData.category, formData.determinationDate], ' ');
    const referral = join(
      [
        formData.entity,
        join([formData.signingAuthority, formData.controllingOffice], ' '),
        formData.address,
      ],
      ', '
    );

    const footerChildren: Paragraph[] = [];
    footerChildren.push(indentedLine(`Controlled by: ${controlledBy}`));
    footerChildren.push(indentedLine(`CUI Category: ${formData.cuiCategory || ''}`));
    footerChildren.push(
      indentedLine(`Distribution/Dissemination Control: ${formData.distributionControl || ''}`)
    );
    footerChildren.push(indentedLine(`POC: ${formData.poc || 'Phone or email address'}`));
    footerChildren.push(blankLine());

    if (formData.supersedureNotice) {
      footerChildren.push(
        labelBodyParagraph(
          formData.supersedureNotice,
          formData.supersedureStatement ? `: ${formData.supersedureStatement}` : ''
        )
      );
      footerChildren.push(blankLine());
    }

    footerChildren.push(
      labelBodyParagraph(
        'DISTRIBUTION STATEMENT C:',
        ` Distribution authorized to U.S. Government agencies and their contractors for ${authScope}. Other requests for this document must be referred to ${referral}.`
      )
    );
    footerChildren.push(blankLine());

    footerChildren.push(
      labelBodyParagraph(
        `${formData.destructionNotice || 'DESTRUCTION NOTICE'}:`,
        ` ${formData.classificationDestructionProcedure || ''}`
      )
    );
    footerChildren.push(blankLine());

    footerChildren.push(ruleParagraph());
    footerChildren.push(
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: [
          new TextRun({ text: `PCN ${formData.pcn || '### ###### ##'}`, bold: true, font: FONT, size: SIZE }),
        ],
      })
    );

    const doc = new Document({
      styles: {
        default: {
          document: {
            run: { font: FONT, size: SIZE },
            paragraph: {
              spacing: { before: 0, after: 0, line: 240, lineRule: LineRuleType.AUTO },
            },
          },
        },
      },
      sections: [
        {
          // Section 1: cover (page 1) + components table (page 2). 0.5in margins.
          properties: {
            titlePage: true,
            page: {
              margin: { top: 720, right: 720, bottom: 720, left: 720 },
            },
          },
          footers: {
            first: new Footer({ children: footerChildren }),
            default: new Footer({ children: [new Paragraph({ children: [] })] }),
          },
          children: children.slice(0, page3StartIndex),
        },
        {
          // Section 2: page 3 authentication letter. 1in left/right margins.
          properties: {
            page: {
              margin: { top: 720, right: 1440, bottom: 720, left: 1440 },
            },
          },
          footers: {
            default: new Footer({ children: [new Paragraph({ children: [] })] }),
          },
          children: children.slice(page3StartIndex),
        },
        // Section 3: Appendix A / Enclosure (1), pages 4+. Running header,
        // page number restarting at 1, 1in left/right margins.
        appendixSection(formData),
      ],
    });

    const buffer = await Packer.toBuffer(doc);
    return buffer as Buffer;
  } catch (error) {
    console.error('I-Type DOCX generation failed:', error);
    throw new Error(`Failed to generate I-Type DOCX: ${error}`);
  }
}

export async function downloadITypeDocx(
  formData: ITypeDocxData,
  filename: string = 'i-type.docx'
): Promise<void> {
  try {
    const buffer = await generateITypeDocx(formData);
    const uint8Array = new Uint8Array(buffer);
    const blob = new Blob([uint8Array], {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('I-Type DOCX download failed:', error);
    throw error;
  }
}
