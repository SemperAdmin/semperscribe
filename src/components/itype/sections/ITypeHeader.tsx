import React from 'react';
import styles from '@/styles/itype-preview.module.css';

interface ITypeHeaderProps {
  date: string;
  shortTitle: string;
  volume?: string;
}

export const ITypeHeader: React.FC<ITypeHeaderProps> = ({ date, shortTitle, volume }) => {
  return (
    <div className={styles.iTypeHeader}>
      <div className={styles.iTypeHeaderLeft}>
        <div className={styles.iTypeHeaderValue}>{date || '(SELECT DATE)'}</div>
      </div>
      <div className={styles.iTypeHeaderRight}>
        <div className={styles.iTypeHeaderValue}>
          {shortTitle || '(SELECT SHORT TITLE)'}
        </div>
        {volume && (
          <div className={styles.iTypeHeaderValue}>
            VOLUME {volume}
          </div>
        )}
      </div>
    </div>
  );
};
