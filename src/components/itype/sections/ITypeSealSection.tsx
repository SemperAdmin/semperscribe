import React from 'react';
import styles from '@/styles/itype-preview.module.css';

interface ITypeSealSectionProps {
  sealImageBase64: string | null;
  isLoading: boolean;
}

// Default to the bundled USMC seal when no uploaded seal is present.
const DEFAULT_SEAL_SRC = '/USMC.png';

export const ITypeSealSection: React.FC<ITypeSealSectionProps> = ({
  sealImageBase64,
  isLoading,
}) => {
  const sealSrc = sealImageBase64 || DEFAULT_SEAL_SRC;

  return (
    <div className={styles.iTypeSealSection}>
      {isLoading ? (
        <div className={styles.iTypeSealPlaceholder}>Loading seal...</div>
      ) : (
        <img src={sealSrc} alt="USMC Seal" className={styles.iTypeSealImage} />
      )}
    </div>
  );
};
