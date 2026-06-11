import React, { useMemo } from 'react';
import { useITypeStore } from '@/store/iTypeStore';
import styles from '@/styles/itype-preview.module.css';
import { ITypeHeader } from './sections/ITypeHeader';
import { ITypeTitleBlock } from './sections/ITypeTitleBlock';
import { ITypeSealSection } from './sections/ITypeSealSection';
import { ITypeNomenclatureSection } from './sections/ITypeNomenclatureSection';
import { ITypeMaterialTable } from './sections/ITypeMaterialTable';
import { ITypeFooterSection } from './sections/ITypeFooterSection';
import { ITypePage3 } from './sections/ITypePage3';

interface ITypePreviewProps {
  formData?: any;
  onUpdatePreview?: () => void;
}


export const ITypePreview: React.FC<ITypePreviewProps> = ({ formData: externalFormData }) => {
  const { formData: storeFormData, sealImageBase64, isLoading } = useITypeStore();
  const formData = externalFormData || storeFormData;

  const componentsAffected = formData?.componentsAffected || [];

  // Components Affected always begins on page 2. Page 1 stays a cover.
  // Ruling 2026-06-10 (hard stance): first SIX rows ON PAGE 1, always
  // six drawn; rows 7+ overflow to page 2.
  const firstSix = useMemo(() => {
    const out = componentsAffected.slice(0, 6);
    while (out.length < 6) out.push({ nsn: '', tamcn: '', id: '', model: '' });
    return out;
  }, [componentsAffected]);
  const overflowRows = useMemo(() => componentsAffected.slice(6), [componentsAffected]);

  // Material tables stay after Components Affected, outside the two-page scope.
  const materialBlocks = useMemo(() => {
    const blocks: { title: string; rows: any[] }[] = [];
    const add = (title: string, rows?: any[]) => {
      if (rows && rows.length > 0) blocks.push({ title, rows });
    };
    add('Material Required', formData?.materialRequired);
    add('Material Discarded', formData?.materialDiscarded);
    add('Material Retained', formData?.materialRetained);
    add('Bulk Material', formData?.bulkMaterial);
    add('Special Tools', formData?.specialTools);
    add('Jigs & Fixtures', formData?.jigsFixtures);
    return blocks;
  }, [formData]);

  const formatDateAsMonthYear = (dateString: string) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      const month = date.toLocaleString('en-US', { month: 'long' }).toUpperCase();
      const year = date.getFullYear();
      return `${month} ${year}`;
    } catch {
      return dateString;
    }
  };

  const renderComponentsTable = (rows: any[]) => (
    <table className={styles.iTypeHeaderTable}>
      <thead>
        <tr>
          <th className={styles.iTypeTableHeaderCell}>NSN</th>
          <th className={styles.iTypeTableHeaderCell}>TAMCN</th>
          <th className={styles.iTypeTableHeaderCell}>ID</th>
          <th className={styles.iTypeTableHeaderCell}>MODEL</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row: any, idx: number) => (
          <tr key={idx} className={styles.iTypeTableRow}>
            <td className={styles.iTypeTableCell}>{row.nsn || ''}</td>
            <td className={styles.iTypeTableCell}>{row.tamcn || ''}</td>
            <td className={styles.iTypeTableCell}>{row.id || ''}</td>
            <td className={styles.iTypeTableCell}>{row.model || ''}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  if (!formData) {
    return (
      <div className={styles.emptyState}>
        No form data available. Load or create an I-Type document.
      </div>
    );
  }

  return (
    <div className={styles.pageContainer}>
      {/* PAGE 1 - COVER */}
      <div className={`${styles.page} ${styles.coverPage}`}>
        <div className={styles.coverTop}>
          <ITypeHeader
            date={formatDateAsMonthYear(formData?.date) || ''}
            shortTitle={formData?.shortTitle || ''}
            volume={formData?.volume}
          />
          <ITypeTitleBlock
            publicationType={formData?.publicationType || ''}
            longTitle={formData?.longTitle || ''}
          />
          <div className={styles.iTypeTimeCompliance}>
            {formData?.timeCompliance || ''}
          </div>
          <ITypeSealSection sealImageBase64={sealImageBase64} isLoading={isLoading} />
          <ITypeNomenclatureSection nomenclature={formData?.nomenclature || ''} />
          {renderComponentsTable(firstSix)}
        </div>
        <div className={styles.coverBottom}>
          <ITypeFooterSection
            poc={formData?.poc}
            entity={formData?.entity}
            signingAuthority={formData?.signingAuthority}
            controllingOffice={formData?.controllingOffice}
            cuiCategory={formData?.cuiCategory}
            distributionControl={formData?.distributionControl}
            category={formData?.category}
            address={formData?.address}
            determinationDate={formData?.determinationDate}
            supersedureNotice={formData?.supersedureNotice}
            supersedureStatement={formData?.supersedureStatement}
            destructionNotice={formData?.destructionNotice}
            classificationDestructionProcedure={formData?.classificationDestructionProcedure}
            pcn={formData?.pcn}
          />
        </div>
      </div>

      {/* PAGE 2 - COMPONENTS AFFECTED OVERFLOW (rows 7+ only) */}
      {overflowRows.length > 0 && (
        <div className={styles.page}>
          {renderComponentsTable(overflowRows)}
        </div>
      )}

      {/* MATERIAL TABLES - retained, after Components Affected */}
      {materialBlocks.length > 0 && (
        <div className={styles.page}>
          {materialBlocks.map((block) => (
            <ITypeMaterialTable
              key={`material-${block.title}`}
              title={block.title}
              data={block.rows}
              showQtyColumn={true}
            />
          ))}
        </div>
      )}

      {/* PAGE 3 - AUTHENTICATION LETTER (always after the table) */}
      <div className={`${styles.page} ${styles.letterPage}`}>
        <ITypePage3 formData={formData} />
      </div>
    </div>
  );
};
