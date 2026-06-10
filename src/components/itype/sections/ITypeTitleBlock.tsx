import React from 'react';
import styles from '@/styles/itype-preview.module.css';

interface ITypeTitleBlockProps {
  publicationType: string;
  longTitle: string;
}

export const ITypeTitleBlock: React.FC<ITypeTitleBlockProps> = ({
  publicationType,
  longTitle,
}) => {
  return (
    <div className={styles.iTypeTitleBlockContainer}>
      <div className={styles.iTypeTitleMainInline}>
        U.S. MARINE CORPS {publicationType || '(SELECT PUBLICATION TYPE)'}
      </div>
      <div className={styles.iTypeTitleLine} />
      <div className={styles.iTypeTitleLong}>
        {longTitle || '(INSERT LONG TITLE HERE)'}
      </div>
    </div>
  );
};
