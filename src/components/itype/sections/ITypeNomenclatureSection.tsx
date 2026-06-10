import React from 'react';
import styles from '@/styles/itype-preview.module.css';

interface ITypeNomenclatureSectionProps {
  nomenclature: string;
}

export const ITypeNomenclatureSection: React.FC<ITypeNomenclatureSectionProps> = ({
  nomenclature,
}) => {
  return (
    <div className={styles.iTypeNomenclatureBox}>
      {nomenclature || '(INSERT NOMENCLATURE HERE)'}
    </div>
  );
};
