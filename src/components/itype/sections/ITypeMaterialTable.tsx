import React from 'react';
import styles from '@/styles/itype-preview.module.css';

interface TableRow {
  nomenclature: string;
  nsn: string;
  pn: string;
  qty?: number;
}

interface ITypeMaterialTableProps {
  title: string;
  data: TableRow[] | undefined;
  showQtyColumn: boolean;
}

export const ITypeMaterialTable: React.FC<ITypeMaterialTableProps> = ({
  title,
  data,
  showQtyColumn,
}) => {
  if (!data || data.length === 0) {
    return null;
  }

  return (
    <div className={styles.iTypeTableSection}>
      <div className={styles.iTypeTableTitle}>{title}</div>
      <table className={styles.iTypeContentTable}>
        <thead className={styles.iTypeHeaderTable}>
          <tr>
            <th className={styles.iTypeTableHeaderCell}>Nomenclature</th>
            <th className={styles.iTypeTableHeaderCell}>NSN</th>
            <th className={styles.iTypeTableHeaderCell}>PN</th>
            {showQtyColumn && <th className={styles.iTypeTableHeaderCell}>Qty</th>}
          </tr>
        </thead>
        <tbody>
          {data.map((row, idx) => (
            <tr key={idx} className={styles.iTypeTableRow}>
              <td className={styles.iTypeTableCell}>{row.nomenclature}</td>
              <td className={styles.iTypeTableCell}>{row.nsn}</td>
              <td className={styles.iTypeTableCell}>{row.pn}</td>
              {showQtyColumn && <td className={styles.iTypeTableCell}>{row.qty || ''}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
