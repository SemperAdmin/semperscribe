import React from 'react';
import styles from '@/styles/itype-preview.module.css';

interface ITypeFooterSectionProps {
  poc?: string;
  entity?: string;
  signingAuthority?: string;
  controllingOffice?: string;
  cuiCategory?: string;
  distributionControl?: string;
  category?: string;
  address?: string;
  determinationDate?: string;
  supersedureNotice?: string;
  supersedureStatement?: string;
  destructionNotice?: string;
  classificationDestructionProcedure?: string;
  pcn?: string;
}

export const ITypeFooterSection: React.FC<ITypeFooterSectionProps> = ({
  poc,
  entity,
  signingAuthority,
  controllingOffice,
  cuiCategory,
  distributionControl,
  category,
  address,
  determinationDate,
  supersedureNotice,
  supersedureStatement,
  destructionNotice,
  classificationDestructionProcedure,
  pcn,
}) => {
  // Controlled by uses full names joined with spaces, per current decision.
  const controlledBy = [entity, signingAuthority, controllingOffice]
    .filter(Boolean)
    .join(' ');

  // Distribution Statement referral org: entity, signing authority + controlling office, address.
  const referral = [
    entity,
    [signingAuthority, controllingOffice].filter(Boolean).join(' '),
    address,
  ]
    .filter(Boolean)
    .join(', ');

  // Authorization scope: category and the determination date when present.
  const authScope = [category, determinationDate].filter(Boolean).join(' ');

  return (
    <div className={styles.iTypeFooterContainer}>
      {/* Control Information Block */}
      <div className={styles.iTypeFooterInfo}>
        <div>Controlled by: {controlledBy}</div>
        <div>CUI Category: {cuiCategory || ''}</div>
        <div>Distribution/Dissemination Control: {distributionControl || ''}</div>
        <div>POC: {poc || 'Phone or email address'}</div>
      </div>

      {/* Supersedure Notice */}
      {supersedureNotice && (
        <div className={styles.iTypeFooterSection}>
          <span style={{ textDecoration: 'underline', fontWeight: 'bold' }}>
            {supersedureNotice}
          </span>
          {supersedureStatement ? `: ${supersedureStatement}` : ''}
        </div>
      )}

      {/* Distribution Statement C */}
      <div className={styles.iTypeFooterSection}>
        <span style={{ textDecoration: 'underline', fontWeight: 'bold' }}>DISTRIBUTION STATEMENT C:</span> Distribution authorized to U.S. Government agencies and their contractors for {authScope}. Other requests for this document must be referred to {referral}.
      </div>

      {/* Destruction Notice */}
      <div className={styles.iTypeFooterSection}>
        <span style={{ textDecoration: 'underline', fontWeight: 'bold' }}>{destructionNotice || 'DESTRUCTION NOTICE'}:</span> {classificationDestructionProcedure || ''}
      </div>

      {/* Rule above PCN, matching the cover rule */}
      <div className={styles.iTypeTitleLine} />

      {/* PCN */}
      <div className={styles.iTypeFooterPCN}>PCN {pcn || '### ###### ##'}</div>
    </div>
  );
};
