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

    // Two blank lines, then the seal at 3.5in (336px at 96dpi).
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
              transformation: { width: 336, height: 336 },
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

    // Page break to page 2 (the bottom legal block lives in the first-page footer).
    children.push(new Paragraph({ children: [new PageBreak()] }));

    // --- PAGE 2 COMPONENTS AFFECTED ---
    const components = formData.componentsAffected || [];
    const widths = [2700, 2700, 2160, 3240]; // NSN 25, TAMCN 25, ID 20, MODEL 30 of 10800

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

    const rows: TableRow[] = [
      new TableRow({
        children: [
          headerCell('NSN', widths[0]),
          headerCell('TAMCN', widths[1]),
          headerCell('ID', widths[2]),
          headerCell('MODEL', widths[3]),
        ],
      }),
      ...components.map(
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
    ];

    children.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: noTableBorders,
        columnWidths: widths,
        rows,
      })
    );

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
          children,
        },
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
